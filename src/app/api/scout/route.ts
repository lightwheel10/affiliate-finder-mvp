import { searchMultiPlatform, Platform, SearchResult } from '../../services/search';
import { analyzeContent } from '../../services/analysis';
import { trackSearch, completeSearch, API_COSTS } from '../../services/tracking';
import { enrichDomainsWithSimilarWeb, SimilarWebData } from '../../services/apify';
import { stackServerApp } from '@/stack/server';
import { sql } from '@/lib/db';
import { checkCredits, consumeCredits } from '@/lib/credits';

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

    // Process search and stream results
    (async () => {
      let isStreamClosed = false;
      let searchId: number | null = null;
      let totalCost = 0;
      
      try {
        console.log(`🔍 Starting search for "${keyword}" on: ${activeSources.join(', ')}`);
        
        // Track the search in the database
        if (userId) {
          searchId = await trackSearch({
            userId,
            keyword,
            sources: activeSources,
          });
          console.log(`📝 Search tracked with ID: ${searchId}`);
        }
        
        // 1. Search Step - get all results first (pass userId for API tracking)
        const searchResults = await searchMultiPlatform(keyword, activeSources, userId);
        console.log(`📊 Found ${searchResults.length} total results`);
        
        // Estimate total cost based on platforms used
        if (activeSources.includes('Web')) totalCost += API_COSTS.serper;
        if (activeSources.includes('YouTube')) totalCost += API_COSTS.apify_youtube * Math.min(searchResults.filter(r => r.source === 'YouTube').length, 15);
        if (activeSources.includes('Instagram')) totalCost += API_COSTS.apify_instagram * Math.min(searchResults.filter(r => r.source === 'Instagram').length, 15);
        if (activeSources.includes('TikTok')) totalCost += API_COSTS.apify_tiktok * Math.min(searchResults.filter(r => r.source === 'TikTok').length, 15);
        
        // ========================================================================
        // 2. SimilarWeb Enrichment Step (Dec 2025)
        // Auto-enrich Web results with traffic data from SimilarWeb
        // This adds ~$0.05 per unique domain to the search cost
        // ========================================================================
        let similarWebDataMap: Map<string, SimilarWebData> = new Map();
        
        if (activeSources.includes('Web')) {
          const webResults = searchResults.filter(r => r.source === 'Web');
          const uniqueDomains = [...new Set(webResults.map(r => r.domain))];
          
          if (uniqueDomains.length > 0) {
            console.log(`📊 Enriching ${uniqueDomains.length} unique Web domains with SimilarWeb...`);
            
            try {
              similarWebDataMap = await enrichDomainsWithSimilarWeb(uniqueDomains, userId);
              
              // Add SimilarWeb cost to total
              totalCost += uniqueDomains.length * API_COSTS.apify_similarweb;
              
              console.log(`✅ SimilarWeb enrichment complete: ${similarWebDataMap.size}/${uniqueDomains.length} domains enriched`);
            } catch (enrichError: any) {
              console.error('⚠️ SimilarWeb enrichment failed (continuing without):', enrichError.message);
              // Continue without enrichment - don't fail the entire search
            }
          }
        }
        
        if (searchResults.length === 0) {
          // No results found - close stream gracefully
          await writer.write(encoder.encode('data: [DONE]\n\n'));
          await writer.close();
          return;
        }

        // 2. Process results
        const resultsToProcess = searchResults.slice(0, 100); // Process up to 100 results
        
        if (analyze) {
          // SLOW MODE: With AI analysis (batch processing)
          const BATCH_SIZE = 10;
          
          for (let i = 0; i < resultsToProcess.length; i += BATCH_SIZE) {
            if (isStreamClosed) break;
            
            const batch = resultsToProcess.slice(i, i + BATCH_SIZE);
            
            // Process batch in parallel
            const batchPromises = batch.map(async (item) => {
              try {
                const analysis = await analyzeContent(item, keyword);
                let result: any = { ...item, ...analysis, isAffiliate: analysis.isAffiliate ?? true };
                
                // Merge SimilarWeb data for Web results (Dec 2025)
                if (item.source === 'Web' && similarWebDataMap.has(item.domain)) {
                  result = {
                    ...result,
                    similarWeb: similarWebDataMap.get(item.domain),
                  };
                }
                
                return result;
              } catch (error) {
                // On analysis error, return item without analysis
                let result: any = { ...item, isAffiliate: true, summary: 'Analysis pending' };
                
                // Still add SimilarWeb data if available
                if (item.source === 'Web' && similarWebDataMap.has(item.domain)) {
                  result = {
                    ...result,
                    similarWeb: similarWebDataMap.get(item.domain),
                  };
                }
                
                return result;
              }
            });
            
            const batchResults = await Promise.all(batchPromises);
            
            // Stream each result
            for (const result of batchResults) {
              if (isStreamClosed) break;
              try {
                await writer.write(encoder.encode(`data: ${JSON.stringify(result)}\n\n`));
              } catch (writeError: any) {
                if (writeError.message?.includes('abort')) {
                  isStreamClosed = true;
                  break;
                }
              }
            }
          }
        } else {
          // FAST MODE: Stream results immediately without AI analysis
          for (const item of resultsToProcess) {
            if (isStreamClosed) break;
            
            // Add default affiliate flag (assume all results are potential affiliates)
            let result: any = {
              ...item,
              isAffiliate: true,
              summary: `Found via ${item.source} search`
            };
            
            // ====================================================================
            // Merge SimilarWeb data for Web results (Dec 2025)
            // Uses nested similarWeb object to match ResultItem/SimilarWebData type
            // ====================================================================
            if (item.source === 'Web' && similarWebDataMap.has(item.domain)) {
              const swData = similarWebDataMap.get(item.domain)!;
              result = {
                ...result,
                similarWeb: swData,  // Pass the full SimilarWebData object
              };
            }
            
            try {
              await writer.write(encoder.encode(`data: ${JSON.stringify(result)}\n\n`));
            } catch (writeError: any) {
              if (writeError.message?.includes('abort')) {
                isStreamClosed = true;
                break;
              }
            }
          }
        }

        // Send completion signal
        if (!isStreamClosed) {
          try {
            await writer.write(encoder.encode('data: [DONE]\n\n'));
            await writer.close();
            console.log(`✅ Streamed ${resultsToProcess.length} results`);
            
            // Mark search as complete
            if (searchId) {
              await completeSearch(searchId, resultsToProcess.length, totalCost);
              console.log(`📝 Search ${searchId} completed: ${resultsToProcess.length} results, $${totalCost.toFixed(4)} cost`);
            }
            
            // ================================================================
            // CONSUME CREDIT (December 2025)
            // Deduct 1 topic_search credit after successful search
            // Only consume if enforcement is enabled
            // ================================================================
            if (enforceCredits && resultsToProcess.length > 0) {
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
          } catch (closeError) {
            // Ignore close errors
          }
        }
        
      } catch (error: any) {
        console.error("Stream Error:", error);
        // Still mark search as complete even on error
        if (searchId) {
          await completeSearch(searchId, 0, totalCost);
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

