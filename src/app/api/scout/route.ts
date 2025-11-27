import { searchMultiPlatform, Platform, SearchResult } from '../../services/search';
import { analyzeContent } from '../../services/analysis';
import { enrichContact } from '../../services/enrichment';

export async function POST(req: Request) {
  try {
    const { keyword, sources } = await req.json();

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
        // 1. Search Step - get all results first
        const searchResults = await searchMultiPlatform(keyword, activeSources);
        
        // 2. Process results in PARALLEL batches (3 at a time for speed)
        const BATCH_SIZE = 3;
        const resultsToProcess = searchResults.slice(0, 25);
        
        for (let i = 0; i < resultsToProcess.length; i += BATCH_SIZE) {
          // Check if stream is still open before processing batch
          if (isStreamClosed) {
            console.log('⚠️ Stream closed, stopping processing');
            break;
          }
          
          const batch = resultsToProcess.slice(i, i + BATCH_SIZE);
          
          // Process batch in parallel
          const batchPromises = batch.map(async (item) => {
            try {
              // Analyze content
              const analysis = await analyzeContent(item, keyword);
              
              // Enrich with email if applicable
              let email = null;
              if (analysis.isAffiliate && analysis.personName) {
                const contact = await enrichContact(analysis.personName, analysis.company || item.domain);
                email = contact.email || null;
              }

              return {
                ...item,
                ...analysis,
                email
              };
              
            } catch (itemError: any) {
              // Don't log ResponseAborted errors - they're expected when user cancels
              if (!itemError.message?.includes('abort') && itemError.name !== 'ResponseAborted') {
                console.error('Error processing item:', itemError);
              }
              return null; // Skip this item
            }
          });
          
          // Wait for batch to complete
          const batchResults = await Promise.all(batchPromises);
          
          // Stream each successful result
          for (const result of batchResults) {
            if (!result) continue; // Skip failed items
            
            try {
              const data = `data: ${JSON.stringify(result)}\n\n`;
              await writer.write(encoder.encode(data));
            } catch (writeError: any) {
              if (writeError.message?.includes('abort')) {
                console.log('🛑 Client disconnected, stopping stream');
                isStreamClosed = true;
                break;
              }
              throw writeError; // Re-throw if it's a different error
            }
          }
          
          if (isStreamClosed) break;
        }

        // Send completion signal (only if stream is still open)
        if (!isStreamClosed) {
          try {
            await writer.write(encoder.encode('data: [DONE]\n\n'));
            await writer.close();
            console.log('✅ Stream completed successfully');
          } catch (closeError: any) {
            if (!closeError.message?.includes('abort')) {
              console.error('Error closing stream:', closeError);
            }
          }
        }
        
      } catch (error: any) {
        // Only log non-abort errors
        if (!error.message?.includes('abort') && error.name !== 'ResponseAborted') {
          console.error("Stream Error:", error);
        }
        
        // Try to close gracefully
        try {
          if (!isStreamClosed) {
            await writer.close();
          }
        } catch (closeError) {
          // Ignore close errors
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

