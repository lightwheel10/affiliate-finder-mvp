// =============================================================================
// LOCATION-BASED SEARCH UTILITIES - January 16, 2026
// 
// Maps country/language names from onboarding to API-specific codes.
// Country names match OnboardingScreen.tsx countries array (lines 378-413).
// Language names match OnboardingScreen.tsx languages array (lines 416-438).
// 
// Usage:
// - Serper (Web): Uses countryCode as gl param, languageCode as hl param
// - Social (YouTube/Instagram/TikTok): Appends shortName to search query
// =============================================================================

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
