/**
 * =============================================================================
 * DATABASE CONNECTION - SUPABASE PostgreSQL
 * =============================================================================
 * 
 * Created: Original (Neon)
 * Updated: January 19th, 2026 - Migrated from Neon to Supabase
 * 
 * WHAT CHANGED:
 * -------------
 * - Replaced Neon's sql function with Supabase's sql wrapper
 * - Uses 'crewcast' schema (isolated from other services in shared Supabase)
 * - Connection string from SUPABASE_DATABASE_URL env variable
 * 
 * WHY 'crewcast' SCHEMA:
 * ----------------------
 * The Supabase project is shared with other client services. Using a dedicated
 * schema ('crewcast') keeps our tables separate from:
 * - public schema (default, used by other services)
 * - Supabase internal schemas (auth, storage, etc.)
 * 
 * The sql wrapper automatically uses search_path=crewcast so all queries
 * target our tables without needing to prefix them.
 * 
 * USAGE:
 * ------
 * Same as before! The sql function works identically:
 * 
 * const users = await sql`SELECT * FROM crewcast.users WHERE id = ${id}`;
 * 
 * =============================================================================
 */

// Import the Supabase SQL wrapper (drop-in replacement for Neon)
// This uses the 'postgres' package with search_path set to 'crewcast' schema
export { sql } from './supabase/sql';

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
  profile_image_url: string | null; // January 13th, 2026: Added for Vercel Blob storage
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
  
  // ==========================================================================
  // AI GENERATED MESSAGE - Persisted outreach email (Added Dec 17, 2025)
  // 
  // These fields store the AI-generated outreach email so it persists across
  // page refreshes. Previously, generated messages were only in React state
  // and were lost on refresh.
  // ==========================================================================
  ai_generated_message: string | null;   // Full email body (legacy: primary contact)
  ai_generated_subject: string | null;   // Email subject line (legacy: primary contact)
  ai_generated_at: string | null;        // ISO timestamp when generation COMPLETED
  
  // ==========================================================================
  // AI GENERATION STARTED AT (Added January 24th, 2026)
  // 
  // Tracks when AI email generation STARTED (not completed). Used for:
  // 1. Showing "generating" spinner after page navigation
  // 2. Blocking duplicate requests while generation is in progress
  // 3. Preventing double credit consumption
  // 
  // Logic: If started_at > generated_at → Generation is in progress
  // ==========================================================================
  ai_generation_started_at: string | null;
  
  // ==========================================================================
  // AI GENERATED MESSAGES - Per-contact messages (Added Dec 25, 2025)
  // 
  // When Lusha returns multiple contacts for an affiliate, users can generate
  // personalized emails for each contact. This JSONB column stores all messages
  // keyed by contact email address.
  //
  // Structure: { "email@example.com": { message, subject, generatedAt } }
  //
  // The legacy ai_generated_message field is still updated with the most recent
  // message for backwards compatibility.
  // ==========================================================================
  ai_generated_messages: {
    [email: string]: {
      message: string;
      subject: string | null;
      generatedAt: string;
    };
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
  service: 'serper' | 'apify_youtube' | 'apify_instagram' | 'apify_tiktok' | 'apify_similarweb' | 'apollo_email' | 'lusha_email' | 'apify_google_scraper';
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

// =============================================================================
// SEARCH JOBS - January 29, 2026
// 
// Tracks async Apify google-search-scraper runs for polling-based search.
// Part of Phase 1 polling implementation.
// 
// Flow:
// 1. POST /api/search/start → creates job with status='running'
// 2. GET /api/search/status?jobId=X → polls until done/failed
// 3. When Apify completes → results processed, status='done'
// 
// January 30, 2026: Added enrichment tracking fields for non-blocking enrichment
// - enrichment_status: 'pending' | 'running' | 'succeeded' | 'failed' | null
// - enrichment_run_ids: JSONB containing runIds for each platform
// - raw_results: JSONB containing raw search results before enrichment
// =============================================================================
export interface DbSearchJob {
  id: number;
  user_id: number;
  keyword: string;
  sources: string[];
  apify_run_id: string;
  status: 'pending' | 'running' | 'processing' | 'enriching' | 'done' | 'failed' | 'timeout';
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  results_count: number | null;
  error_message: string | null;
  estimated_cost: number | null;
  // January 29, 2026: Added user_settings to store filtering params for status endpoint
  user_settings: {
    targetCountry?: string | null;
    targetLanguage?: string | null;
    userBrand?: string | null;
  } | null;
  // ==========================================================================
  // January 30, 2026: Non-blocking enrichment tracking
  // 
  // These fields support the new non-blocking enrichment architecture:
  // - enrichment_status: Tracks enrichment phase ('running' while actors run)
  // - enrichment_run_ids: Stores Apify runIds for each platform's enrichment
  // - raw_results: Stores Google Scraper results before enrichment
  // 
  // Flow:
  // 1. Google Scraper SUCCEEDED → raw_results saved, enrichment actors started
  // 2. Status returns 'enriching' while enrichment_status='running'
  // 3. All enrichment actors complete → results fetched, filtered, returned
  // ==========================================================================
  enrichment_status: 'pending' | 'running' | 'succeeded' | 'failed' | null;
  enrichment_run_ids: {
    youtube?: string;
    instagram?: string;
    tiktok?: string;
  } | null;
  raw_results: any[] | null; // Raw SearchResult[] from Google Scraper
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
  
  // ==========================================================================
  // AUTO-SCAN SCHEDULING FIELDS - January 13th, 2026
  // 
  // These fields enable the automatic affiliate scanning feature for paid users.
  // 
  // HOW IT WORKS:
  // 1. User is on trial → Clock is LOCKED (teaser to upgrade)
  // 2. User upgrades (first invoice.paid with amount > 0) → 
  //    - first_payment_at is set to NOW()
  //    - next_auto_scan_at is set to NOW() + 7 days
  // 3. Vercel Cron runs hourly, checks users where next_auto_scan_at <= NOW()
  // 4. For each qualifying user with available topic_search credits:
  //    - Re-run searches using their saved competitors[] and topics[]
  //    - Save results to discovered_affiliates (duplicates auto-blocked)
  //    - Update last_auto_scan_at = NOW()
  //    - Update next_auto_scan_at += 7 days
  // 5. If no credits available → scan is skipped, clock shows "No credits"
  // 6. If user cancels/downgrades to trial → clock locks again
  //
  // SCAN INTERVAL: 7 days for all plans (Pro, Business, Enterprise)
  // ==========================================================================
  first_payment_at: string | null;     // ISO timestamp of first successful payment (unlocks clock)
  last_auto_scan_at: string | null;    // ISO timestamp of last completed auto-scan
  next_auto_scan_at: string | null;    // ISO timestamp when next auto-scan is scheduled
}

