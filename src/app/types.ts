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
  id?: number;  // Database ID (for saved/discovered affiliates)
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
  
  // ==========================================================================
  // YouTube-specific fields (added to fix data pipeline)
  // These fields come from searchYouTubeApify() in apify.ts via SearchResult
  // ==========================================================================
  youtubeVideoLikes?: number;
  youtubeVideoComments?: number;
  
  // SimilarWeb data (for Web results)
  similarWeb?: SimilarWebData;
  isEnriching?: boolean;           // True while SimilarWeb is loading
  enrichmentError?: string;        // Error message if enrichment failed
  
  // Database fields
  savedAt?: string;
  discoveredAt?: string;
  searchKeyword?: string;
  
  // Email discovery fields
  emailStatus?: 'not_searched' | 'searching' | 'found' | 'not_found' | 'error';
  emailSearchedAt?: string;
  emailProvider?: string;
  
  // Full email results (for modal display)
  emailResults?: {
    emails: string[];
    contacts?: Array<{
      firstName?: string;
      lastName?: string;
      fullName?: string;
      title?: string;
      linkedinUrl?: string;
      emails: string[];
      phoneNumbers?: string[];
    }>;
    // Primary contact info (first contact)
    firstName?: string;
    lastName?: string;
    title?: string;  // Job title
    linkedinUrl?: string;
    phoneNumbers?: string[];
    provider?: string;
  };
  
  // ==========================================================================
  // Instagram-specific fields (added to fix data pipeline)
  // These fields come from searchInstagramApify() in apify.ts via SearchResult
  // and are saved to database columns: instagram_username, instagram_followers, etc.
  // ==========================================================================
  instagramUsername?: string;
  instagramFullName?: string;
  instagramBio?: string;
  instagramFollowers?: number;
  instagramFollowing?: number;
  instagramPostsCount?: number;
  instagramIsBusiness?: boolean;
  instagramIsVerified?: boolean;
  // Instagram post-level stats (from most recent post in latestPosts array)
  instagramPostLikes?: number;
  instagramPostComments?: number;
  instagramPostViews?: number;
  
  // ==========================================================================
  // TikTok-specific fields (added to fix data pipeline)
  // These fields come from searchTikTokApify() in apify.ts via SearchResult
  // and are saved to database columns: tiktok_username, tiktok_followers, etc.
  // ==========================================================================
  tiktokUsername?: string;
  tiktokDisplayName?: string;
  tiktokBio?: string;
  tiktokFollowers?: number;
  tiktokFollowing?: number;
  tiktokLikes?: number;
  tiktokVideosCount?: number;
  tiktokIsVerified?: boolean;
  tiktokVideoPlays?: number;
  tiktokVideoLikes?: number;
  tiktokVideoComments?: number;
  tiktokVideoShares?: number;
}
