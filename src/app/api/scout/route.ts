import { searchMultiPlatform, Platform, SearchResult } from '../../services/search';
import { analyzeContent } from '../../services/analysis';
import { trackSearch, completeSearch, API_COSTS } from '../../services/tracking';
import { enrichDomainsWithSimilarWeb, SimilarWebData } from '../../services/apify';

/**
 * Scout API - Searches for affiliates across multiple platforms
 * 
 * Platforms:
 * - Web: Uses Serper.dev (Google search)
 * - YouTube/Instagram/TikTok: Uses Apify scrapers for rich data
 * 
 * Mode 1 (default): Fast mode - returns raw search results immediately
 * Mode 2 (analyze=true): Slow mode - includes AI analysis (takes longer)
 */
export async function POST(req: Request) {
  try {
    const { keyword, sources, analyze = false, userId } = await req.json();

    if (!keyword) {
      return new Response(JSON.stringify({ error: 'Keyword is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
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

