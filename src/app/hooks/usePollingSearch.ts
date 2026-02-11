'use client';

/**
 * =============================================================================
 * usePollingSearch Hook - January 29, 2026
 * Updated: January 30, 2026 - Added 'enriching' status for non-blocking enrichment
 * =============================================================================
 * 
 * Handles polling-based search using Apify google-search-scraper.
 * 
 * FLOW (Updated January 30, 2026):
 * February 4, 2026: Changed to keywords[] for batched search (1 credit per session)
 * 1. startSearch(keywords[], sources) → POST /api/search/start → returns jobId
 * 2. pollUntilComplete(jobId) → GET /api/search/status → polls every 3s
 *    - status='running': Google Scraper searching
 *    - status='enriching': Enrichment actors running (non-blocking)
 *    - status='done': Results ready
 * 3. When done, returns SearchResult[] with enriched data
 * 
 * FEATURES:
 * - Progress callbacks for UI updates (elapsed time, status)
 * - AbortController for cancellation
 * - Auto-retry on transient failures (max 2 retries)
 * - Proper error typing for credit errors, auth errors, etc.
 * 
 * USAGE:
 * ```typescript
 * const { searchWithPolling, isSearching, progress, error, cancelSearch } = usePollingSearch();
 * 
 * // February 4, 2026: Pass keywords array (1 credit per session, not per keyword)
 * const results = await searchWithPolling(['propolis', 'honey'], ['YouTube', 'Instagram'], {
 *   onProgress: (p) => console.log(`Status: ${p.status}, Elapsed: ${p.elapsedSeconds}s`)
 * });
 * ```
 * =============================================================================
 */

import { useState, useCallback, useRef } from 'react';
import { Platform, SearchResult } from '../services/search';

// =============================================================================
// TYPES
// January 30, 2026: Added 'enriching' status for non-blocking enrichment
// =============================================================================

export type SearchStatus = 
  | 'idle'
  | 'starting'
  | 'running'
  | 'enriching'  // January 30, 2026: Non-blocking enrichment in progress
  | 'processing'
  | 'done'
  | 'failed'
  | 'timeout'
  | 'cancelled';

export interface SearchProgress {
  status: SearchStatus;
  elapsedSeconds: number;
  message: string;
  jobId?: number;
}

export interface SearchError {
  code: string;
  message: string;
  httpStatus?: number;
  creditError?: boolean;
  remaining?: number;
}

export interface StartSearchResponse {
  jobId: number;
  status: 'started';
  message: string;
}

export interface StatusResponse {
  status: 'running' | 'processing' | 'enriching' | 'done' | 'failed' | 'timeout';
  elapsedSeconds?: number;
  message?: string;
  results?: SearchResult[];
  resultsCount?: number;
  breakdown?: Record<string, number>;
}

export interface SearchOptions {
  onProgress?: (progress: SearchProgress) => void;
  pollIntervalMs?: number;
  maxRetries?: number;
  /** Competitor domains for this run (optional; used with keywords for Find Affiliates) */
  competitors?: string[];
}

export interface UsePollingSearchReturn {
  /**
   * Start a search and poll until complete.
   * Returns results array when done, throws on error.
   * February 4, 2026: Changed to keywords[] for batched search (1 credit per session)
   */
  searchWithPolling: (
    keywords: string[], 
    sources: Platform[], 
    options?: SearchOptions
  ) => Promise<SearchResult[]>;
  
  /**
   * Cancel the current search (if any).
   */
  cancelSearch: () => void;
  
  /**
   * True while a search is in progress.
   */
  isSearching: boolean;
  
  /**
   * Current progress state (null when idle).
   */
  progress: SearchProgress | null;
  
  /**
   * Last error (null when no error).
   */
  error: SearchError | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_POLL_INTERVAL_MS = 3000; // 3 seconds
const DEFAULT_MAX_RETRIES = 2;
const MAX_POLL_DURATION_MS = 180000; // 3 minutes timeout

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function usePollingSearch(): UsePollingSearchReturn {
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const [error, setError] = useState<SearchError | null>(null);
  
  // AbortController for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  
  /**
   * Cancel any ongoing search
   */
  const cancelSearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsSearching(false);
    setProgress(prev => prev ? { ...prev, status: 'cancelled', message: 'Search cancelled' } : null);
  }, []);
  
  /**
   * Start search and poll until complete
   * February 4, 2026: Changed to keywords[] for batched search (1 credit per session)
   */
  const searchWithPolling = useCallback(async (
    keywords: string[],
    sources: Platform[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> => {
    const {
      onProgress,
      pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
      maxRetries = DEFAULT_MAX_RETRIES,
      competitors,
    } = options;
    
    // Reset state
    setIsSearching(true);
    setError(null);
    setProgress({ status: 'starting', elapsedSeconds: 0, message: 'Starting search...' });
    
    // Create new AbortController
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    const updateProgress = (p: SearchProgress) => {
      setProgress(p);
      onProgress?.(p);
    };
    
    try {
      // ========================================================================
      // STEP 1: Start the search
      // ========================================================================
      updateProgress({ status: 'starting', elapsedSeconds: 0, message: 'Starting search...' });
      
      // February 4, 2026: Send keywords[] for batched search (1 credit per session)
      // Competitors optional: when provided, search runs keyword + competitor queries
      const startResponse = await fetch('/api/search/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, sources, competitors: competitors ?? [] }),
        signal,
      });
      
      // Handle start errors
      if (!startResponse.ok) {
        const errorData = await startResponse.json();
        
        // Credit error (402)
        if (startResponse.status === 402) {
          const searchError: SearchError = {
            code: errorData.code || 'INSUFFICIENT_CREDITS',
            message: errorData.error || 'Insufficient credits',
            httpStatus: 402,
            creditError: true,
            remaining: errorData.remaining,
          };
          setError(searchError);
          setIsSearching(false);
          throw searchError;
        }
        
        // Other errors
        const searchError: SearchError = {
          code: errorData.code || 'START_ERROR',
          message: errorData.error || 'Failed to start search',
          httpStatus: startResponse.status,
        };
        setError(searchError);
        setIsSearching(false);
        throw searchError;
      }
      
      const startData: StartSearchResponse = await startResponse.json();
      const { jobId } = startData;
      
      updateProgress({
        status: 'running',
        elapsedSeconds: 0,
        message: 'Searching...',
        jobId,
      });
      
      // ========================================================================
      // STEP 2: Poll for results
      // ========================================================================
      const pollStartTime = Date.now();
      let retryCount = 0;
      
      while (true) {
        // Check for cancellation
        if (signal.aborted) {
          throw new DOMException('Search cancelled', 'AbortError');
        }
        
        // Check for timeout
        const elapsedMs = Date.now() - pollStartTime;
        if (elapsedMs > MAX_POLL_DURATION_MS) {
          const searchError: SearchError = {
            code: 'POLL_TIMEOUT',
            message: 'Search timed out. Please try again.',
          };
          setError(searchError);
          setIsSearching(false);
          throw searchError;
        }
        
        // Wait before polling
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        
        // Check for cancellation again after wait
        if (signal.aborted) {
          throw new DOMException('Search cancelled', 'AbortError');
        }
        
        try {
          const statusResponse = await fetch(`/api/search/status?jobId=${jobId}`, {
            signal,
          });
          
          if (!statusResponse.ok) {
            const errorData = await statusResponse.json();
            
            // Job not found (could be expired)
            if (statusResponse.status === 404) {
              const searchError: SearchError = {
                code: errorData.code || 'JOB_NOT_FOUND',
                message: errorData.error || 'Search job not found or expired',
                httpStatus: 404,
              };
              setError(searchError);
              setIsSearching(false);
              throw searchError;
            }
            
            // Other errors - retry if transient
            retryCount++;
            if (retryCount > maxRetries) {
              const searchError: SearchError = {
                code: errorData.code || 'STATUS_ERROR',
                message: errorData.error || 'Failed to check search status',
                httpStatus: statusResponse.status,
              };
              setError(searchError);
              setIsSearching(false);
              throw searchError;
            }
            
            console.warn(`[usePollingSearch] Status error, retrying (${retryCount}/${maxRetries})`);
            continue;
          }
          
          // Reset retry count on success
          retryCount = 0;
          
          const statusData: StatusResponse = await statusResponse.json();
          const elapsedSeconds = statusData.elapsedSeconds ?? Math.round(elapsedMs / 1000);
          
          // Handle different statuses
          switch (statusData.status) {
            case 'running':
              updateProgress({
                status: 'running',
                elapsedSeconds,
                message: `Searching... (${elapsedSeconds}s)`,
                jobId,
              });
              break;
              
            case 'processing':
              updateProgress({
                status: 'processing',
                elapsedSeconds,
                message: 'Processing results...',
                jobId,
              });
              break;
            
            // January 30, 2026: Handle 'enriching' status for non-blocking enrichment
            case 'enriching':
              updateProgress({
                status: 'enriching',
                elapsedSeconds,
                message: 'Enriching social media data...',
                jobId,
              });
              break;
              
            case 'done':
              // Success! Return results
              updateProgress({
                status: 'done',
                elapsedSeconds,
                message: `Found ${statusData.resultsCount || 0} results`,
                jobId,
              });
              setIsSearching(false);
              

              return statusData.results || [];
              
            case 'failed':
              const failedError: SearchError = {
                code: 'SEARCH_FAILED',
                message: statusData.message || 'Search failed',
              };
              setError(failedError);
              setIsSearching(false);
              throw failedError;
              
            case 'timeout':
              const timeoutError: SearchError = {
                code: 'SEARCH_TIMEOUT',
                message: statusData.message || 'Search timed out',
              };
              setError(timeoutError);
              setIsSearching(false);
              throw timeoutError;
              
            default:
              console.warn(`[usePollingSearch] Unknown status: ${statusData.status}`);
          }
          
        } catch (pollError: any) {
          // Re-throw if it's already our error type
          if (pollError.code) {
            throw pollError;
          }
          
          // Handle abort
          if (pollError.name === 'AbortError') {
            throw pollError;
          }
          
          // Network error - retry
          retryCount++;
          if (retryCount > maxRetries) {
            const searchError: SearchError = {
              code: 'NETWORK_ERROR',
              message: 'Network error while checking search status',
            };
            setError(searchError);
            setIsSearching(false);
            throw searchError;
          }
          
          console.warn(`[usePollingSearch] Network error, retrying (${retryCount}/${maxRetries})`);
        }
      }
      
    } catch (err: any) {
      // Handle abort
      if (err.name === 'AbortError') {
        setProgress(prev => prev ? { ...prev, status: 'cancelled', message: 'Search cancelled' } : null);
        setIsSearching(false);
        throw err;
      }
      
      // Re-throw if it's already our error type
      if (err.code) {
        throw err;
      }
      
      // Unexpected error
      const searchError: SearchError = {
        code: 'UNEXPECTED_ERROR',
        message: err.message || 'An unexpected error occurred',
      };
      setError(searchError);
      setIsSearching(false);
      throw searchError;
    }
  }, []);
  
  return {
    searchWithPolling,
    cancelSearch,
    isSearching,
    progress,
    error,
  };
}

export default usePollingSearch;
