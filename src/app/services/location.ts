// =============================================================================
// LOCATION-BASED SEARCH UTILITIES
// 
// Created: January 16, 2026
// Updated: January 26, 2026 - Added language detection filtering (franc library)
// 
// Maps country/language names from onboarding to API-specific codes.
// Country names match OnboardingScreen.tsx countries array (lines 378-413).
// Language names match OnboardingScreen.tsx languages array (lines 416-438).
// 
// Usage:
// - Serper (Web): Uses countryCode as gl param, languageCode as hl param, lr param
// - Social (YouTube/Instagram/TikTok): Appends shortName to search query
// - Language Detection: Post-filters results using franc library
// 
// Architecture:
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  User Onboarding                                                        │
// │  ├── target_country: "Germany"                                          │
// │  └── target_language: "German"                                          │
// │           ↓                                                             │
// │  getLocationConfig() → { countryCode: 'de', languageCode: 'de', ... }  │
// │           ↓                                                             │
// │  Serper API (gl=de, hl=de, lr=lang_de) → ~70% German results           │
// │           ↓                                                             │
// │  filterResultsByLanguage() → ~95%+ German results (franc detection)    │
// └─────────────────────────────────────────────────────────────────────────┘
// =============================================================================

import { franc } from 'franc';

export interface LocationConfig {
  countryCode: string;  // ISO 3166-1 alpha-2 (for Serper gl param)
  languageCode: string; // ISO 639-1 (for Serper hl param)
  shortName: string;    // For social media queries (e.g., "UK", "Germany")
}

// =============================================================================
// COUNTRY MAPPINGS - January 16, 2026
// 
// Maps country names (stored in database as target_country) to:
// - code: Serper gl parameter (geolocation)
// - short: Appended to social media queries for localized results
// 
// Note: UK uses 'uk' for Serper (not 'gb') based on API testing
// =============================================================================
const COUNTRY_TO_CODE: Record<string, { code: string; short: string }> = {
  // North America
  'United States': { code: 'us', short: 'USA' },
  'Canada': { code: 'ca', short: 'Canada' },
  
  // Europe - Major Markets
  'United Kingdom': { code: 'uk', short: 'UK' },
  'Germany': { code: 'de', short: 'Germany' },
  'France': { code: 'fr', short: 'France' },
  'Netherlands': { code: 'nl', short: 'Netherlands' },
  'Belgium': { code: 'be', short: 'Belgium' },
  'Switzerland': { code: 'ch', short: 'Switzerland' },
  'Austria': { code: 'at', short: 'Austria' },
  'Ireland': { code: 'ie', short: 'Ireland' },
  
  // Nordics
  'Denmark': { code: 'dk', short: 'Denmark' },
  'Sweden': { code: 'se', short: 'Sweden' },
  'Norway': { code: 'no', short: 'Norway' },
  'Finland': { code: 'fi', short: 'Finland' },
  
  // Southern Europe
  'Spain': { code: 'es', short: 'Spain' },
  'Italy': { code: 'it', short: 'Italy' },
  'Portugal': { code: 'pt', short: 'Portugal' },
  
  // Central/Eastern Europe
  'Poland': { code: 'pl', short: 'Poland' },
  'Czech Republic': { code: 'cz', short: 'Czech' },
  
  // Asia-Pacific
  'Australia': { code: 'au', short: 'Australia' },
  'New Zealand': { code: 'nz', short: 'New Zealand' },
  'Japan': { code: 'jp', short: 'Japan' },
  'South Korea': { code: 'kr', short: 'Korea' },
  'Singapore': { code: 'sg', short: 'Singapore' },
  
  // Middle East
  'United Arab Emirates': { code: 'ae', short: 'UAE' },
  'Israel': { code: 'il', short: 'Israel' },
  'Saudi Arabia': { code: 'sa', short: 'Saudi Arabia' },
};

// =============================================================================
// LANGUAGE MAPPINGS - January 16, 2026
// 
// Maps language names (stored in database as target_language) to ISO 639-1 codes
// Used for Serper hl parameter (interface language)
// =============================================================================
const LANGUAGE_TO_CODE: Record<string, string> = {
  // Major Western Languages
  'English': 'en',
  'Spanish': 'es',
  'German': 'de',
  'French': 'fr',
  'Portuguese': 'pt',
  'Italian': 'it',
  'Dutch': 'nl',
  
  // Nordic Languages
  'Swedish': 'sv',
  'Danish': 'da',
  'Norwegian': 'no',
  'Finnish': 'fi',
  
  // Central/Eastern European
  'Polish': 'pl',
  'Czech': 'cs',
  
  // Asian Languages
  'Japanese': 'ja',
  'Korean': 'ko',
  
  // Middle Eastern
  'Arabic': 'ar',
  'Hebrew': 'he',
};

/**
 * Get location configuration for search APIs
 * 
 * @param targetCountry - Country name from database (e.g., "Germany", "United Kingdom")
 * @param targetLanguage - Language name from database (e.g., "German", "English")
 * @returns LocationConfig with codes for Serper and social queries, or null if no country
 * 
 * @example
 * getLocationConfig("Germany", "German")
 * // Returns: { countryCode: 'de', languageCode: 'de', shortName: 'Germany' }
 * 
 * @example
 * getLocationConfig("United Kingdom", "English")
 * // Returns: { countryCode: 'uk', languageCode: 'en', shortName: 'UK' }
 */
export function getLocationConfig(
  targetCountry: string | null | undefined,
  targetLanguage: string | null | undefined
): LocationConfig | null {
  if (!targetCountry) return null;
  
  const countryInfo = COUNTRY_TO_CODE[targetCountry];
  if (!countryInfo) {
    console.warn(`⚠️ Unknown country for location filtering: "${targetCountry}"`);
    return null;
  }
  
  // Use provided language code, or default to English
  const languageCode = targetLanguage 
    ? LANGUAGE_TO_CODE[targetLanguage] || 'en'
    : 'en';
  
  return {
    countryCode: countryInfo.code,
    languageCode,
    shortName: countryInfo.short,
  };
}

// =============================================================================
// LANGUAGE DETECTION - January 26, 2026
// 
// Post-filters search results using the franc library to ensure content matches
// the user's target language. This addresses a limitation where Serper's `lr`
// parameter achieves ~70% accuracy, leaving ~30% of results in wrong languages.
// 
// Why this is needed:
// - Serper's `lr` parameter relies on Google's language detection
// - Google's detection isn't 100% accurate (especially for:
//   - Multilingual pages
//   - Pages with English product names but local content
//   - Spam sites gaming language detection)
// - Post-filtering with franc improves accuracy to ~95%+
// 
// How franc works:
// - Analyzes text using trigram frequency analysis
// - Returns ISO 639-3 code (3-letter) like 'deu', 'eng', 'fra'
// - Requires ~20+ characters for reliable detection
// - Returns 'und' (undetermined) for short or ambiguous text
// 
// Performance considerations:
// - franc is synchronous and fast (~1ms per text)
// - Filtering 20 results adds ~20ms total overhead
// - Minimal impact on search response time
// =============================================================================

/**
 * ISO 639-1 (2-letter) to ISO 639-3 (3-letter) language code mapping
 * 
 * franc library returns ISO 639-3 codes, but our system uses ISO 639-1.
 * This mapping allows us to compare detected language with target language.
 * 
 * Reference: https://en.wikipedia.org/wiki/List_of_ISO_639-3_codes
 */
const ISO_639_1_TO_639_3: Record<string, string> = {
  // Major Western Languages
  'en': 'eng',  // English
  'es': 'spa',  // Spanish
  'de': 'deu',  // German
  'fr': 'fra',  // French
  'pt': 'por',  // Portuguese
  'it': 'ita',  // Italian
  'nl': 'nld',  // Dutch
  
  // Nordic Languages
  'sv': 'swe',  // Swedish
  'da': 'dan',  // Danish
  'no': 'nor',  // Norwegian (note: franc may return 'nob' or 'nno')
  'fi': 'fin',  // Finnish
  
  // Central/Eastern European
  'pl': 'pol',  // Polish
  'cs': 'ces',  // Czech
  
  // Asian Languages
  'ja': 'jpn',  // Japanese
  'ko': 'kor',  // Korean
  
  // Middle Eastern
  'ar': 'arb',  // Arabic (Standard)
  'he': 'heb',  // Hebrew
};

/**
 * Related Language Groups - January 26, 2026
 * 
 * franc (trigram-based detection) often confuses closely related languages.
 * To avoid filtering out valid content, we accept detection of related
 * languages as a match. This is a design decision prioritizing recall
 * (keeping good content) over precision (strict language matching).
 * 
 * Based on test results:
 * - Norwegian ↔ Danish (85% similar, mutual intelligibility)
 * - Spanish ↔ Catalan/Galician (Iberian Romance family)
 * - Portuguese ↔ Galician (nearly identical written forms)
 * - Swedish ↔ Norwegian/Danish (Scandinavian continuum)
 * 
 * This map defines: target language code → array of acceptable detected codes
 */
const RELATED_LANGUAGE_GROUPS: Record<string, string[]> = {
  // Norwegian: Accept Danish and Swedish (Scandinavian languages)
  'no': ['nor', 'nob', 'nno', 'dan', 'swe'],
  
  // Danish: Accept Norwegian and Swedish
  'da': ['dan', 'nor', 'nob', 'nno', 'swe'],
  
  // Swedish: Accept Norwegian and Danish
  'sv': ['swe', 'nor', 'nob', 'nno', 'dan'],
  
  // Spanish: Accept Catalan and Galician (Iberian Romance)
  'es': ['spa', 'cat', 'glg'],
  
  // Portuguese: Accept Galician (nearly identical)
  'pt': ['por', 'glg'],
  
  // Finnish: Accept Estonian (Finnic languages, though less similar)
  'fi': ['fin', 'est'],
};

/**
 * Minimum text length required for reliable language detection
 * 
 * franc needs sufficient text to analyze trigram patterns.
 * Below this threshold, detection is unreliable, so we skip filtering.
 * 
 * Based on testing:
 * - < 20 chars: Very unreliable (often returns 'und')
 * - 20-50 chars: Moderately reliable
 * - > 50 chars: Highly reliable
 */
const MIN_TEXT_LENGTH_FOR_DETECTION = 20;

/**
 * Result of language detection analysis
 */
export interface LanguageDetectionResult {
  /** ISO 639-3 code detected by franc (e.g., 'deu', 'eng') */
  detectedCode: string;
  /** Whether the detected language matches the target */
  isMatch: boolean;
  /** Confidence level: 'high', 'medium', 'low', or 'skipped' */
  confidence: 'high' | 'medium' | 'low' | 'skipped';
  /** Reason for the result (useful for debugging) */
  reason: string;
}

/**
 * Detect the language of a given text
 * 
 * @param text - The text to analyze (title + snippet recommended)
 * @param targetLanguageCode - ISO 639-1 code of target language (e.g., 'de')
 * @returns LanguageDetectionResult with match status and confidence
 * 
 * @example
 * detectLanguage("Manuka Honig kaufen - Die besten Angebote", "de")
 * // Returns: { detectedCode: 'deu', isMatch: true, confidence: 'high', reason: 'Language matches target' }
 * 
 * @example
 * detectLanguage("Buy honey online", "de")
 * // Returns: { detectedCode: 'eng', isMatch: false, confidence: 'high', reason: 'Detected eng, expected deu' }
 */
export function detectLanguage(
  text: string,
  targetLanguageCode: string
): LanguageDetectionResult {
  // Validate input
  if (!text || text.trim().length < MIN_TEXT_LENGTH_FOR_DETECTION) {
    return {
      detectedCode: 'und',
      isMatch: true, // Don't filter out short texts
      confidence: 'skipped',
      reason: `Text too short (${text?.trim().length || 0} chars < ${MIN_TEXT_LENGTH_FOR_DETECTION} min)`,
    };
  }

  // Get the expected ISO 639-3 code for the target language
  const expectedCode = ISO_639_1_TO_639_3[targetLanguageCode];
  if (!expectedCode) {
    return {
      detectedCode: 'und',
      isMatch: true, // Don't filter if we don't know the target language
      confidence: 'skipped',
      reason: `Unknown target language code: ${targetLanguageCode}`,
    };
  }

  // Detect language using franc
  const detectedCode = franc(text.trim());

  // Handle undetermined results
  if (detectedCode === 'und') {
    return {
      detectedCode: 'und',
      isMatch: true, // Don't filter ambiguous texts
      confidence: 'low',
      reason: 'Language could not be determined (ambiguous text)',
    };
  }

  // ==========================================================================
  // RELATED LANGUAGE MATCHING - January 26, 2026
  // 
  // Check if the detected language is in the "related languages" group.
  // This handles franc's known limitation with similar languages:
  // - Norwegian/Danish/Swedish (Scandinavian)
  // - Spanish/Catalan/Galician (Iberian Romance)
  // - Portuguese/Galician
  // 
  // If a related group exists, accept any language in that group as a match.
  // Otherwise, do a strict comparison with the expected code.
  // ==========================================================================
  const relatedGroup = RELATED_LANGUAGE_GROUPS[targetLanguageCode];
  
  if (relatedGroup) {
    const isRelatedMatch = relatedGroup.includes(detectedCode);
    return {
      detectedCode,
      isMatch: isRelatedMatch,
      confidence: 'high',
      reason: isRelatedMatch 
        ? detectedCode === expectedCode 
          ? 'Language matches target' 
          : `Related language accepted (${detectedCode} ≈ ${expectedCode})`
        : `Detected ${detectedCode}, expected ${expectedCode} or related (${relatedGroup.join('/')})`,
    };
  }

  // Standard comparison for languages without related groups
  const isMatch = detectedCode === expectedCode;
  return {
    detectedCode,
    isMatch,
    confidence: 'high',
    reason: isMatch 
      ? 'Language matches target' 
      : `Detected ${detectedCode}, expected ${expectedCode}`,
  };
}

/**
 * Filter configuration for language detection
 */
export interface LanguageFilterConfig {
  /** Whether to enable language filtering (default: true when targetLanguage is set) */
  enabled: boolean;
  /** ISO 639-1 code of target language (e.g., 'de', 'fr') */
  targetLanguageCode: string;
  /** Whether to log filtering decisions (default: true in development) */
  verbose?: boolean;
}

/**
 * Statistics from a language filtering operation
 */
export interface LanguageFilterStats {
  /** Total results before filtering */
  totalBefore: number;
  /** Results that passed the filter */
  passed: number;
  /** Results filtered out (wrong language) */
  filtered: number;
  /** Results skipped (too short, ambiguous) */
  skipped: number;
  /** Breakdown by detected language */
  languageBreakdown: Record<string, number>;
}

/**
 * Filter an array of search results by detected language
 * 
 * This is a generic function that works with any object containing
 * title and snippet fields. It's designed to be used with SearchResult
 * but is flexible enough for other result types.
 * 
 * @param results - Array of results with title and optional snippet
 * @param config - Filter configuration
 * @returns Object with filtered results and statistics
 * 
 * @example
 * const { results, stats } = filterResultsByLanguage(
 *   searchResults,
 *   { enabled: true, targetLanguageCode: 'de', verbose: true }
 * );
 * console.log(`Filtered: ${stats.filtered}/${stats.totalBefore} non-German results`);
 */
export function filterResultsByLanguage<T extends { title: string; snippet?: string }>(
  results: T[],
  config: LanguageFilterConfig
): { results: T[]; stats: LanguageFilterStats } {
  const stats: LanguageFilterStats = {
    totalBefore: results.length,
    passed: 0,
    filtered: 0,
    skipped: 0,
    languageBreakdown: {},
  };

  // If filtering is disabled, return all results
  if (!config.enabled || !config.targetLanguageCode) {
    stats.passed = results.length;
    stats.skipped = results.length;
    return { results, stats };
  }

  const filtered: T[] = [];

  for (const result of results) {
    // Combine title and snippet for better detection accuracy
    const textToAnalyze = [result.title, result.snippet]
      .filter(Boolean)
      .join(' ');

    const detection = detectLanguage(textToAnalyze, config.targetLanguageCode);

    // Track language breakdown for analytics
    stats.languageBreakdown[detection.detectedCode] = 
      (stats.languageBreakdown[detection.detectedCode] || 0) + 1;

    if (detection.isMatch) {
      filtered.push(result);
      if (detection.confidence === 'skipped') {
        stats.skipped++;
      }
      stats.passed++;

      if (config.verbose) {
        console.log(`✅ KEEP: "${result.title.substring(0, 50)}..." (${detection.reason})`);
      }
    } else {
      stats.filtered++;
      if (config.verbose) {
        console.log(`❌ FILTER: "${result.title.substring(0, 50)}..." (${detection.reason})`);
      }
    }
  }

  return { results: filtered, stats };
}

/**
 * Get the language name from ISO 639-1 code
 * 
 * Utility function for logging and debugging purposes.
 * 
 * @param code - ISO 639-1 code (e.g., 'de')
 * @returns Language name (e.g., 'German') or the code if unknown
 */
export function getLanguageName(code: string): string {
  const codeToName: Record<string, string> = {
    'en': 'English', 'es': 'Spanish', 'de': 'German', 'fr': 'French',
    'pt': 'Portuguese', 'it': 'Italian', 'nl': 'Dutch', 'sv': 'Swedish',
    'da': 'Danish', 'no': 'Norwegian', 'fi': 'Finnish', 'pl': 'Polish',
    'cs': 'Czech', 'ja': 'Japanese', 'ko': 'Korean', 'ar': 'Arabic', 'he': 'Hebrew',
  };
  return codeToName[code] || code;
}
