import { Platform, SearchResult, searchWeb } from '../../services/search';
import { analyzeContent } from '../../services/analysis';
import { trackSearch, completeSearch, API_COSTS } from '../../services/tracking';
import { 
  enrichDomainsBatch, 
  SimilarWebData,
  searchYouTubeApify,
  searchInstagramApify,
  searchTikTokApify 
} from '../../services/apify';
import { stackServerApp } from '@/stack/server';
import { sql } from '@/lib/db';
import { checkCredits, consumeCredits } from '@/lib/credits';

// ============================================================================
// VERCEL FUNCTION CONFIGURATION (December 16, 2025)
// 
// IMPORTANT: This sets the maximum execution time for this serverless function.
// 
// Vercel Plan Limits:
// - Hobby: max 60 seconds
// - Pro: max 300 seconds (5 minutes), or 800 seconds with Fluid Compute
// - Enterprise: max 900 seconds (15 minutes)
//
// We set 300 seconds (5 minutes) which is the Pro plan maximum without Fluid.
// This gives enough time for:
// - Platform searches (~30 seconds)
// - SimilarWeb batch enrichment (~120 seconds for 20+ domains)
// - Buffer for network latency
// ============================================================================
export const maxDuration = 300; // 5 minutes - Vercel Pro plan limit

/**
 * Scout API - Searches for affiliates across multiple platforms
 * 
 * Platforms:
 * - Web: Uses Serper.dev (Google search)
 * - YouTube/Instagram/TikTok: Uses Apify scrapers for rich data
 * 
 * Mode 1 (default): Fast mode - returns raw search results immediately
 * Mode 2 (analyze=true): Slow mode - includes AI analysis (takes longer)
 * 
 * SECURITY (December 2025):
 * - Requires authenticated Stack Auth session
 * - Verifies user has topic_search credits
 * - Consumes 1 credit per successful search
 * - ENFORCE_CREDITS flag controls enforcement (default: false for safe rollout)
 * 
 * STREAMING OPTIMIZATION (December 16, 2025):
 * - Results are now streamed IMMEDIATELY as each platform completes
 * - Previously: Wait for ALL platforms → Wait for ALL SimilarWeb → Stream everything
 * - Now: Stream each platform's results as soon as it finishes
 * - SimilarWeb runs in background via batch processing (1 call instead of N)
 * - Web results display immediately; SimilarWeb data arrives as 'enrichment_update' events
 * 
 * TIMEOUT CONFIGURATION (December 16, 2025):
 * - maxDuration set to 300 seconds (Vercel Pro plan limit)
 * - SimilarWeb has 120-second internal timeout (generous for batch processing)
 */

// Check if credit enforcement is enabled
function isCreditEnforcementEnabled(): boolean {
  const flag = process.env.ENFORCE_CREDITS;
  if (!flag) return false;
  return flag.toLowerCase() === 'true' || flag === '1';
}

export async function POST(req: Request) {
  try {
    const { keyword, sources, analyze = false } = await req.json();

    if (!keyword) {
      return new Response(JSON.stringify({ error: 'Keyword is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ==========================================================================
    // AUTHENTICATION CHECK (December 2025)
    // Verify user is authenticated via Stack Auth
    // ==========================================================================
    const authUser = await stackServerApp.getUser();
    
    if (!authUser) {
      console.error('[Scout] Unauthorized: No authenticated user');
      return new Response(JSON.stringify({ error: 'Unauthorized. Please sign in.' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ==========================================================================
    // GET USER FROM DATABASE (December 2025)
    // Use authenticated email to get userId - never trust client-provided userId
    // ==========================================================================
    const users = await sql`
      SELECT id FROM users WHERE email = ${authUser.primaryEmail}
    `;

    if (users.length === 0) {
      console.error(`[Scout] User not found in database: ${authUser.primaryEmail}`);
      return new Response(JSON.stringify({ error: 'User account not found. Please complete onboarding.' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = users[0].id as number;

    // ==========================================================================
    // CREDIT CHECK (December 2025)
    // Verify user has topic_search credits before proceeding
    // ==========================================================================
    const enforceCredits = isCreditEnforcementEnabled();
    
    if (enforceCredits) {
      const creditCheck = await checkCredits(userId, 'topic_search', 1);
      
      if (!creditCheck.allowed) {
        console.log(`[Scout] Credit check failed for user ${userId}: ${creditCheck.message}`);
        return new Response(JSON.stringify({ 
          error: creditCheck.message || 'Insufficient credits',
          creditError: true,
          remaining: creditCheck.remaining,
          isReadOnly: creditCheck.isReadOnly,
        }), { 
          status: 402, // Payment Required
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      console.log(`[Scout] Credit check passed for user ${userId}. Remaining: ${creditCheck.remaining}`);
    } else {
      console.log(`[Scout] Credit enforcement disabled. Proceeding for user ${userId}.`);
    }

    // Filter out unsupported platforms (Reddit was removed)
    const supportedPlatforms: Platform[] = ['Web', 'YouTube', 'Instagram', 'TikTok'];
    const activeSources: Platform[] = sources && sources.length > 0 
      ? sources.filter((s: string) => supportedPlatforms.includes(s as Platform))
      : ['Web'];

    // Create a TransformStream for streaming results
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // ============================================================================
    // STREAMING SEARCH PROCESSOR (Updated December 16, 2025)
    // 
    // PREVIOUS BEHAVIOR (Blocking):
    // 1. Wait for ALL platforms to complete (searchMultiPlatform)
    // 2. Wait for ALL SimilarWeb enrichment (enrichDomainsWithSimilarWeb)
    // 3. Only THEN stream all results to client
    // Result: User waited 60+ seconds before seeing ANY results
    //
    // NEW BEHAVIOR (Streaming):
    // 1. Start ALL platform searches in parallel
    // 2. Stream results IMMEDIATELY as each platform completes
    // 3. Web results sent without SimilarWeb (marked with isEnriching: true)
    // 4. SimilarWeb batch runs in background (single API call for all domains)
    // 5. Send enrichment_update events when SimilarWeb data arrives
    // 6. Send [DONE] after all results + enrichments complete
    // Result: User sees YouTube/Instagram/TikTok results in ~5 seconds
    // ============================================================================
    (async () => {
      let isStreamClosed = false;
      let searchId: number | null = null;
      let totalCost = 0;
      let totalResultsStreamed = 0;
      
      // Collect all results for tracking purposes
      const allResults: SearchResult[] = [];
      // Track Web domains for SimilarWeb batch enrichment
      const webDomains: string[] = [];
      
      try {
        console.log(`🔍 Starting STREAMING search for "${keyword}" on: ${activeSources.join(', ')}`);
        
        // Track the search in the database
        if (userId) {
          searchId = await trackSearch({
            userId,
            keyword,
            sources: activeSources,
          });
          console.log(`📝 Search tracked with ID: ${searchId}`);
        }
        
        // ======================================================================
        // HELPER FUNCTION: Stream results from a single platform
        // Called when each platform's search completes - streams immediately
        // ======================================================================
        const streamPlatformResults = async (
          platform: Platform,
          results: SearchResult[],
          includeEnrichingFlag: boolean = false
        ): Promise<number> => {
          let streamedCount = 0;
          
          for (const item of results) {
            if (isStreamClosed) break;
            
            // Build the result object with standard fields
            const result: any = {
              ...item,
              isAffiliate: true,
              summary: `Found via ${item.source} search`,
              // For Web results, mark as "enriching" so UI can show loading state
              // SimilarWeb data will arrive later via enrichment_update event
              ...(includeEnrichingFlag ? { isEnriching: true } : {})
            };
            
            try {
              await writer.write(encoder.encode(`data: ${JSON.stringify(result)}\n\n`));
              streamedCount++;
            } catch (writeError: any) {
              if (writeError.message?.includes('abort')) {
                isStreamClosed = true;
                break;
              }
              console.error(`Error streaming ${platform} result:`, writeError.message);
            }
          }
          
          console.log(`✅ Streamed ${streamedCount}/${results.length} ${platform} results`);
          return streamedCount;
        };

        // ======================================================================
        // PARALLEL PLATFORM SEARCHES WITH IMMEDIATE STREAMING
        // Each platform search runs independently and streams as it completes
        // ======================================================================
        const platformPromises = activeSources.map(async (platform) => {
          const startTime = Date.now();
          let results: SearchResult[] = [];
          
          try {
            // Call the appropriate search function for each platform
            switch (platform) {
              case 'YouTube':
                results = await searchYouTubeApify(keyword, userId, 15);
                totalCost += API_COSTS.apify_youtube * results.length;
                break;
                
              case 'Instagram':
                results = await searchInstagramApify(keyword, userId, 15);
                totalCost += API_COSTS.apify_instagram * results.length;
                break;
                
              case 'TikTok':
                results = await searchTikTokApify(keyword, userId, 15);
                totalCost += API_COSTS.apify_tiktok * results.length;
                break;
                
              case 'Web':
                results = await searchWeb(keyword);
                totalCost += API_COSTS.serper;
                // Collect Web domains for SimilarWeb batch enrichment
                results.forEach(r => {
                  if (r.domain && !webDomains.includes(r.domain)) {
                    webDomains.push(r.domain);
                  }
                });
                break;
            }
            
            const duration = Date.now() - startTime;
            console.log(`📊 ${platform} search completed: ${results.length} results in ${duration}ms`);
            
            // STREAM IMMEDIATELY - Don't wait for other platforms!
            // Web results are marked with isEnriching: true since SimilarWeb data comes later
            const isWeb = platform === 'Web';
            const streamedCount = await streamPlatformResults(platform, results, isWeb);
            totalResultsStreamed += streamedCount;
            
            // Track results for final summary
            allResults.push(...results);
            
            return { platform, results, success: true };
            
          } catch (error: any) {
            console.error(`❌ ${platform} search failed:`, error.message);
            return { platform, results: [], success: false, error: error.message };
          }
        });

        // Wait for all platform searches to complete (they stream as they finish)
        await Promise.all(platformPromises);
        
        console.log(`📊 All platform searches complete. Total streamed: ${totalResultsStreamed}`);

        // Handle case where no results were found
        if (totalResultsStreamed === 0 && !isStreamClosed) {
          console.log('⚠️ No results found across any platform');
        }

        // ======================================================================
        // COMPLETION: Send [DONE] signal FIRST (December 16, 2025)
        // 
        // CRITICAL FIX FOR VERCEL TIMEOUT:
        // Previously, we awaited SimilarWeb before sending [DONE], which could
        // cause the function to exceed Vercel's timeout limit (60s on Hobby).
        // 
        // Now we send [DONE] FIRST, then fire SimilarWeb in the background.
        // This ensures the main search completes within ~20-30 seconds.
        // SimilarWeb enrichment is "best effort" - if the stream is still open,
        // client receives updates. If not, they can refresh to see enriched data.
        // ======================================================================
        
        // Mark search as complete in database BEFORE SimilarWeb
        if (searchId) {
          await completeSearch(searchId, totalResultsStreamed, totalCost);
          console.log(`📝 Search ${searchId} completed: ${totalResultsStreamed} results, $${totalCost.toFixed(4)} cost`);
        }
        
        // Consume credit BEFORE SimilarWeb
        if (enforceCredits && totalResultsStreamed > 0) {
          const consumeResult = await consumeCredits(
            userId, 
            'topic_search', 
            1, 
            searchId?.toString(), 
            'search'
          );
          if (consumeResult.success) {
            console.log(`💳 [Scout] Consumed 1 topic_search credit for user ${userId}. New balance: ${consumeResult.newBalance}`);
          } else {
            console.error(`❌ [Scout] Failed to consume credit for user ${userId}`);
          }
        }

        // ======================================================================
        // SIMILARWEB BATCH ENRICHMENT WITH TIMEOUT (December 16, 2025)
        // 
        // VERCEL PRO PLAN CONFIGURATION:
        // With maxDuration=300 (5 minutes), we have plenty of time for SimilarWeb.
        // We give SimilarWeb 120 seconds (2 minutes) to complete batch processing.
        // 
        // Key improvements:
        // 1. Uses enrichDomainsBatch() - ONE API call for ALL domains (not N calls)
        // 2. Has a 120-second timeout - generous for 10-25 domains
        // 3. Sends enrichment_update events before [DONE]
        // 4. Main results are NEVER blocked - they're already streamed
        // 
        // TIMING BUDGET (Pro Plan - 300 seconds max):
        // - Platform searches (parallel): ~30-60 seconds
        // - SimilarWeb batch (with timeout): max 120 seconds
        // - Buffer: ~120 seconds
        // - Total: max ~180 seconds (safely under 300s limit)
        // ======================================================================
        const SIMILARWEB_TIMEOUT_MS = 120000; // 120 seconds (2 min) for SimilarWeb batch
        
        if (webDomains.length > 0 && !isStreamClosed) {
          console.log(`📊 Starting SimilarWeb BATCH enrichment for ${webDomains.length} domains (max ${SIMILARWEB_TIMEOUT_MS/1000}s)...`);
          
          try {
            // Race between SimilarWeb and timeout
            const similarWebDataMap = await Promise.race([
              enrichDomainsBatch(webDomains, userId),
              new Promise<Map<string, SimilarWebData>>((_, reject) => 
                setTimeout(() => reject(new Error('SimilarWeb timeout')), SIMILARWEB_TIMEOUT_MS)
              )
            ]);
            
            console.log(`✅ SimilarWeb BATCH complete: ${similarWebDataMap.size}/${webDomains.length} domains`);
            
            // Stream enrichment updates
            let enrichmentsSent = 0;
            for (const [domain, swData] of similarWebDataMap) {
              if (isStreamClosed) {
                console.log(`⚠️ Stream closed, ${similarWebDataMap.size - enrichmentsSent} enrichments not sent`);
                break;
              }
              
              try {
                await writer.write(encoder.encode(`data: ${JSON.stringify({
                  type: 'enrichment_update',
                  domain: domain,
                  similarWeb: swData,
                })}\n\n`));
                enrichmentsSent++;
              } catch (writeError: any) {
                isStreamClosed = true;
                console.log(`⚠️ Stream closed during enrichment`);
                break;
              }
            }
            
            if (enrichmentsSent > 0) {
              console.log(`✅ Streamed ${enrichmentsSent} SimilarWeb enrichment updates`);
            }
            
          } catch (enrichError: any) {
            // SimilarWeb timeout or failure - main results are unaffected
            if (enrichError.message === 'SimilarWeb timeout') {
              console.warn('⚠️ SimilarWeb BATCH timed out after 120s - skipping enrichment');
            } else {
              console.error('⚠️ SimilarWeb BATCH enrichment failed:', enrichError.message);
            }
            // Continue to send [DONE] - search results are already streamed
          }
        }

        // Send [DONE] signal and close stream
        if (!isStreamClosed) {
          try {
            await writer.write(encoder.encode('data: [DONE]\n\n'));
            await writer.close();
            console.log(`✅ Search complete. Streamed ${totalResultsStreamed} results.`);
          } catch (closeError) {
            // Ignore close errors - stream may have been aborted by client
          }
        }
        
      } catch (error: any) {
        console.error("Stream Error:", error);
        // Still mark search as complete even on error
        if (searchId) {
          await completeSearch(searchId, totalResultsStreamed, totalCost);
        }
        try {
          if (!isStreamClosed) {
            await writer.close();
          }
        } catch (closeError) {
          // Ignore
        }
      }
    })();

    // Return streaming response
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

