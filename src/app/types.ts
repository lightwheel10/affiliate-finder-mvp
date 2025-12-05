/**
 * YouTube/TikTok Channel/Creator Info for rich display
 */
export interface YouTubeChannelInfo {
  name: string;
  link: string;
  thumbnail?: string;
  verified?: boolean;
  subscribers?: string;  // e.g., "1.9K subscribers" or "1.9K followers" for TikTok
}

/**
 * SimilarWeb traffic data for web domains
 */
export interface SimilarWebData {
  domain: string;
  monthlyVisits: number;
  monthlyVisitsFormatted: string;  // e.g., "359.8K"
  globalRank: number | null;
  countryRank: number | null;
  countryCode: string | null;
  bounceRate: number;              // 0-1 (e.g., 0.5 = 50%)
  pagesPerVisit: number;
  timeOnSite: number;              // seconds
  trafficSources: {
    direct: number;
    search: number;
    social: number;
    referrals: number;
    mail: number;
    paid: number;
  };
  topCountries: Array<{
    countryCode: string;
    share: number;
  }>;
  category: string | null;
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
  
  // YouTube/TikTok-specific fields (channel = creator for TikTok)
  channel?: YouTubeChannelInfo;
  duration?: string;     // Video length e.g., "12:34"
  
  // SimilarWeb data (for Web results)
  similarWeb?: SimilarWebData;
  isEnriching?: boolean;           // True while SimilarWeb is loading
  enrichmentError?: string;        // Error message if enrichment failed
  
  // Database fields
  savedAt?: string;
  discoveredAt?: string;
  searchKeyword?: string;
}
