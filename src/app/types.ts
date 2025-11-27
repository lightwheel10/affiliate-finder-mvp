/**
 * YouTube Channel Info for rich display
 */
export interface YouTubeChannelInfo {
  name: string;
  link: string;
  thumbnail?: string;
  verified?: boolean;
  subscribers?: string;  // e.g., "1.9K subscribers"
}

export interface ResultItem {
  title: string;
  link: string;
  domain: string;
  snippet: string;
  source: string;
  isAffiliate?: boolean;
  personName?: string;
  summary?: string;
  email?: string;
  thumbnail?: string;
  views?: string;
  date?: string;
  highlightedWords?: string[];
  rank?: number;
  keyword?: string;
  discoveryMethod?: {
    type: 'competitor' | 'keyword' | 'topic' | 'tagged';
    value: string;
  };
  isAlreadyAffiliate?: boolean;
  isNew?: boolean;
  
  // YouTube-specific fields
  channel?: YouTubeChannelInfo;
  duration?: string;     // Video length e.g., "12:34"
  
  /**
   * TODO: Future enhancements for YouTube analytics:
   * - engagementRate?: number;    // (likes + comments) / views * 100 - needs YouTube Data API
   * - uploadFrequency?: string;   // e.g., "4/m uploads" - needs channel video analysis
   * - viewToSubRatio?: number;    // avgViews / subscribers * 100 - can calculate client-side
   */
}

