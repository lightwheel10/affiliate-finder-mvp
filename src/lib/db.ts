import { neon } from '@neondatabase/serverless';

// Create a SQL query function using the Neon serverless driver
export const sql = neon(process.env.DATABASE_URL!);

// Type definitions for database tables
export interface DbUser {
  id: number;
  email: string;
  name: string;
  is_onboarded: boolean;
  onboarding_step: number; // 1-5 for tracking progress, 6 = completed
  has_subscription: boolean;
  role: string | null;
  brand: string | null;
  plan: 'free_trial' | 'pro' | 'business' | 'enterprise';
  trial_plan: 'pro' | 'business' | null;
  trial_start_date: string | null;
  trial_end_date: string | null;
  bio: string | null;
  target_country: string | null;
  target_language: string | null;
  competitors: string[] | null;
  topics: string[] | null;
  affiliate_types: string[] | null;
  billing_last4: string | null;
  billing_brand: string | null;
  billing_expiry: string | null;
  email_matches: boolean;
  email_reports: boolean;
  email_updates: boolean;
  app_replies: boolean;
  app_reminders: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbSavedAffiliate {
  id: number;
  user_id: number;
  title: string;
  link: string;
  domain: string;
  snippet: string;
  source: string;
  is_affiliate: boolean | null;
  person_name: string | null;
  summary: string | null;
  email: string | null;
  thumbnail: string | null;
  views: string | null;
  date: string | null;
  rank: number | null;
  keyword: string | null;
  saved_at: string;
  highlighted_words: string[] | null;
  discovery_method_type: string | null;
  discovery_method_value: string | null;
  is_already_affiliate: boolean | null;
  is_new: boolean | null;
  channel_name: string | null;
  channel_link: string | null;
  channel_thumbnail: string | null;
  channel_verified: boolean | null;
  channel_subscribers: string | null;
  duration: string | null;
  // Instagram-specific fields
  instagram_username: string | null;
  instagram_full_name: string | null;
  instagram_bio: string | null;
  instagram_followers: number | null;
  instagram_following: number | null;
  instagram_posts_count: number | null;
  instagram_is_business: boolean | null;
  instagram_is_verified: boolean | null;
  // TikTok-specific fields
  tiktok_username: string | null;
  tiktok_display_name: string | null;
  tiktok_bio: string | null;
  tiktok_followers: number | null;
  tiktok_following: number | null;
  tiktok_likes: number | null;
  tiktok_videos_count: number | null;
  tiktok_is_verified: boolean | null;
  tiktok_video_plays: number | null;
  tiktok_video_likes: number | null;
  tiktok_video_comments: number | null;
  tiktok_video_shares: number | null;
  // SimilarWeb enrichment fields
  similarweb_monthly_visits: number | null;
  similarweb_global_rank: number | null;
  similarweb_country_rank: number | null;
  similarweb_country_code: string | null;
  similarweb_bounce_rate: number | null;
  similarweb_pages_per_visit: number | null;
  similarweb_time_on_site: number | null;
  similarweb_category: string | null;
  similarweb_traffic_sources: Record<string, number> | null;
  similarweb_top_countries: Array<{ countryCode: string; share: number }> | null;
  // NEW SimilarWeb fields (Dec 2025)
  similarweb_site_title: string | null;
  similarweb_site_description: string | null;
  similarweb_screenshot: string | null;
  similarweb_category_rank: number | null;
  similarweb_monthly_visits_history: Record<string, number> | null;
  similarweb_top_keywords: Array<{ name: string; estimatedValue: number; cpc: number | null }> | null;
  similarweb_snapshot_date: string | null;
  // Email discovery fields
  email_status: 'not_searched' | 'searching' | 'found' | 'not_found' | 'error';
  email_searched_at: string | null;
  email_provider: string | null;
  
  // ==========================================================================
  // EMAIL RESULTS - Full enrichment data (Added Dec 2025)
  // 
  // CRITICAL FIX: Previously, only the primary email was saved to the `email`
  // column. Lusha can return 1-50 emails across multiple contacts, along with
  // phone numbers, job titles, LinkedIn URLs, etc. All this data was being
  // lost on page refresh because it was only stored in React state.
  //
  // This JSONB column stores the complete enrichment response so that:
  // - All emails are preserved (not just the first one)
  // - Contact details (name, title, LinkedIn) are preserved
  // - Phone numbers are preserved (Lusha only)
  // - Data persists across page refreshes
  //
  // Structure matches ResultItem.emailResults in types.ts
  // ==========================================================================
  email_results: {
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
    firstName?: string;
    lastName?: string;
    title?: string;
    linkedinUrl?: string;
    phoneNumbers?: string[];
    provider?: string;
  } | null;
}

export interface DbDiscoveredAffiliate {
  id: number;
  user_id: number;
  title: string;
  link: string;
  domain: string;
  snippet: string;
  source: string;
  search_keyword: string;
  is_affiliate: boolean | null;
  person_name: string | null;
  summary: string | null;
  email: string | null;
  thumbnail: string | null;
  views: string | null;
  date: string | null;
  rank: number | null;
  keyword: string | null;
  discovered_at: string;
  highlighted_words: string[] | null;
  discovery_method_type: string | null;
  discovery_method_value: string | null;
  is_already_affiliate: boolean | null;
  is_new: boolean | null;
  channel_name: string | null;
  channel_link: string | null;
  channel_thumbnail: string | null;
  channel_verified: boolean | null;
  channel_subscribers: string | null;
  duration: string | null;
  // Instagram-specific fields
  instagram_username: string | null;
  instagram_full_name: string | null;
  instagram_bio: string | null;
  instagram_followers: number | null;
  instagram_following: number | null;
  instagram_posts_count: number | null;
  instagram_is_business: boolean | null;
  instagram_is_verified: boolean | null;
  // TikTok-specific fields
  tiktok_username: string | null;
  tiktok_display_name: string | null;
  tiktok_bio: string | null;
  tiktok_followers: number | null;
  tiktok_following: number | null;
  tiktok_likes: number | null;
  tiktok_videos_count: number | null;
  tiktok_is_verified: boolean | null;
  tiktok_video_plays: number | null;
  tiktok_video_likes: number | null;
  tiktok_video_comments: number | null;
  tiktok_video_shares: number | null;
  // SimilarWeb enrichment fields
  similarweb_monthly_visits: number | null;
  similarweb_global_rank: number | null;
  similarweb_country_rank: number | null;
  similarweb_country_code: string | null;
  similarweb_bounce_rate: number | null;
  similarweb_pages_per_visit: number | null;
  similarweb_time_on_site: number | null;
  similarweb_category: string | null;
  similarweb_traffic_sources: Record<string, number> | null;
  similarweb_top_countries: Array<{ countryCode: string; share: number }> | null;
  // NEW SimilarWeb fields (Dec 2025)
  similarweb_site_title: string | null;
  similarweb_site_description: string | null;
  similarweb_screenshot: string | null;
  similarweb_category_rank: number | null;
  similarweb_monthly_visits_history: Record<string, number> | null;
  similarweb_top_keywords: Array<{ name: string; estimatedValue: number; cpc: number | null }> | null;
  similarweb_snapshot_date: string | null;
  // Email discovery fields
  email_status: 'not_searched' | 'searching' | 'found' | 'not_found' | 'error';
  email_searched_at: string | null;
  email_provider: string | null;
}

export interface DbSearch {
  id: number;
  user_id: number;
  keyword: string;
  sources: string[];
  results_count: number;
  searched_at: string;
  total_cost: number | null;
  completed_at: string | null;
}

export interface DbApiCall {
  id: number;
  user_id: number;
  service: 'serper' | 'apify_youtube' | 'apify_instagram' | 'apify_tiktok' | 'apify_similarweb' | 'apollo_email' | 'lusha_email';
  endpoint: string | null;
  keyword: string | null;
  domain: string | null;
  status: 'success' | 'error' | 'timeout' | 'rate_limited';
  results_count: number;
  error_message: string | null;
  estimated_cost: number;
  apify_run_id: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface DbSubscription {
  id: number;
  user_id: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_payment_method_id: string | null;
  plan: 'free_trial' | 'pro' | 'business' | 'enterprise';
  status: 'trialing' | 'active' | 'canceled' | 'past_due' | 'incomplete';
  billing_interval: 'monthly' | 'annual' | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  card_last4: string | null;
  card_brand: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  created_at: string;
  updated_at: string;
}

