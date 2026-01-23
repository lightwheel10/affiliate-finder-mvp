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
 * Updated Dec 2025 to include all available API fields
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
  // NEW FIELDS - Dec 2025
  siteTitle: string | null;           // Website title
  siteDescription: string | null;     // Website description ("About this website")
  screenshot: string | null;          // Screenshot URL from SimilarWeb
  categoryRank: number | null;        // Rank within category (e.g., #10)
  monthlyVisitsHistory: {             // 3-month history for bar chart
    [date: string]: number;           // e.g., "2025-08-01": 278138
  } | null;
  topKeywords: Array<{                // Top keywords by traffic
    name: string;
    estimatedValue: number;
    cpc: number | null;
  }> | null;
  snapshotDate: string | null;        // When data was collected
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
  // ==========================================================================
  // DISCOVERY METHOD - Updated January 23, 2026
  //
  // Tracks HOW this affiliate was discovered:
  // - 'keyword': Found via user's search keyword
  // - 'brand': Found via brand search (existing affiliates)
  // - 'competitor': Found via competitor search (potential recruits)
  // - 'topic': Found via onboarding topic
  // - 'tagged': Manually tagged
  // ==========================================================================
  discoveryMethod?: {
    type: 'competitor' | 'keyword' | 'topic' | 'tagged' | 'brand';
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
  
  // ==========================================================================
  // AI Generated Outreach Message (Added Dec 17, 2025)
  // These fields persist the AI-generated email across page refreshes
  // ==========================================================================
  aiGeneratedMessage?: string;    // Full email body (legacy: primary contact)
  aiGeneratedSubject?: string;    // Email subject line (legacy: primary contact)
  aiGeneratedAt?: string;         // ISO timestamp when generated
  
  // ==========================================================================
  // AI Generated Messages - Per-contact (Added Dec 25, 2025)
  // 
  // When Lusha returns multiple contacts, users can generate personalized
  // emails for each. This stores all messages keyed by contact email.
  // ==========================================================================
  aiGeneratedMessages?: {
    [email: string]: {
      message: string;
      subject: string | null;
      generatedAt: string;
    };
  };
}

// =============================================================================
// ADVANCED FILTER TYPES (Added Dec 2025)
// Used by FilterPanel component for advanced affiliate filtering
// =============================================================================

/**
 * Range filter for numeric values (subscribers, content count, etc.)
 */
export interface RangeFilter {
  min?: number;
  max?: number;
}

/**
 * Date range filter
 */
export interface DateRangeFilter {
  start?: string;  // ISO date string
  end?: string;    // ISO date string
}

/**
 * State for all advanced filters
 * Used by FilterPanel and parent pages
 */
export interface FilterState {
  competitors: string[];              // Selected competitor values from discoveryMethod
  topics: string[];                   // Selected topic/keyword values
  subscribers: RangeFilter | null;    // Follower/subscriber count range
  datePublished: DateRangeFilter | null;  // When content was published
  lastPosted: DateRangeFilter | null;     // Recent activity filter
  contentCount: RangeFilter | null;   // Number of posts/videos
}

/**
 * Default empty filter state
 */
export const DEFAULT_FILTER_STATE: FilterState = {
  competitors: [],
  topics: [],
  subscribers: null,
  datePublished: null,
  lastPosted: null,
  contentCount: null,
};

/**
 * Check if any filters are active
 */
export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.competitors.length > 0 ||
    filters.topics.length > 0 ||
    filters.subscribers !== null ||
    filters.datePublished !== null ||
    filters.lastPosted !== null ||
    filters.contentCount !== null
  );
}

/**
 * Count number of active filter categories
 */
export function countActiveFilters(filters: FilterState): number {
  let count = 0;
  if (filters.competitors.length > 0) count++;
  if (filters.topics.length > 0) count++;
  if (filters.subscribers !== null) count++;
  if (filters.datePublished !== null) count++;
  if (filters.lastPosted !== null) count++;
  if (filters.contentCount !== null) count++;
  return count;
}

/**
 * Parse subscriber string to number (e.g., "1.9K" -> 1900, "2.5M" -> 2500000)
 */
export function parseSubscriberCount(str?: string): number | null {
  if (!str) return null;
  const match = str.match(/^([\d.]+)\s*([KMB])?/i);
  if (!match) return null;
  
  const num = parseFloat(match[1]);
  const suffix = match[2]?.toUpperCase();
  
  if (suffix === 'K') return Math.round(num * 1000);
  if (suffix === 'M') return Math.round(num * 1000000);
  if (suffix === 'B') return Math.round(num * 1000000000);
  return Math.round(num);
}
