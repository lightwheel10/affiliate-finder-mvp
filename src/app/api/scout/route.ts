import { searchMultiPlatform, Platform, SearchResult } from '../../services/search';
import { analyzeContent } from '../../services/analysis';

/**
 * Scout API - Searches for affiliates across multiple platforms
 * 
 * Mode 1 (default): Fast mode - returns raw search results immediately
 * Mode 2 (analyze=true): Slow mode - includes AI analysis (takes longer)
 */
export async function POST(req: Request) {
  try {
    const { keyword, sources, analyze = false } = await req.json();

    if (!keyword) {
      return new Response(JSON.stringify({ error: 'Keyword is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const activeSources: Platform[] = sources && sources.length > 0 
      ? sources 
      : ['Web'];

    // Create a TransformStream for streaming results
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Process search and stream results
    (async () => {
      let isStreamClosed = false;
      
      try {
        console.log(`🔍 Starting search for "${keyword}" on: ${activeSources.join(', ')}`);
        
        // 1. Search Step - get all results first
        const searchResults = await searchMultiPlatform(keyword, activeSources);
        console.log(`📊 Found ${searchResults.length} total results`);
        
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
                return { ...item, ...analysis, isAffiliate: analysis.isAffiliate ?? true };
              } catch (error) {
                // On analysis error, return item without analysis
                return { ...item, isAffiliate: true, summary: 'Analysis pending' };
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
            const result = {
              ...item,
              isAffiliate: true,
              summary: `Found via ${item.source} search`
            };
            
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
          } catch (closeError) {
            // Ignore close errors
          }
        }
        
      } catch (error: any) {
        console.error("Stream Error:", error);
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

