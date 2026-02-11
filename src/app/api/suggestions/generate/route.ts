/**
 * AI-Powered Suggestions API Endpoint
 * Created: January 3rd, 2026
 * 
 * =============================================================================
 * PURPOSE
 * =============================================================================
 * This endpoint generates AI-powered competitor and topic suggestions for a 
 * user's brand during onboarding. It uses:
 * 1. Firecrawl - To scrape the brand's website content
 * 2. Anthropic Claude (claude-haiku-4-5) - To analyze content and generate suggestions
 * 
 * =============================================================================
 * FLOW
 * =============================================================================
 * 1. User completes Step 1 of onboarding (enters brand domain)
 * 2. Domain is validated (via /api/validate-domain)
 * 3. This endpoint is called to generate suggestions
 * 4. Loading screen shows progress while this runs (~10-15 seconds)
 * 5. Results are returned and displayed in Steps 3 & 4
 * 
 * =============================================================================
 * WHAT WE GENERATE
 * =============================================================================
 * - 12 Competitors: Direct competitors offering similar products/services
 *   - User will select up to 5 in Step 3
 *   - Each competitor domain is validated before returning
 * 
 * - 10 Topics: SHORT search keywords (1-3 words max)
 *   - User will select up to 5 in Step 4
 *   - Used for affiliate discovery searches on Serper, YouTube, Instagram, TikTok
 *   - Words like "review", "blog" are added automatically by search.ts
 * 
 * =============================================================================
 * CHANGELOG
 * =============================================================================
 * January 26, 2026:
 * - Fixed topic generation to produce SHORT keywords instead of long phrases
 * - Problem: AI was generating full sentences/phrases (5+ words)
 * - These became too specific when we added "review"/"blog" suffix in search
 * - Too specific = zero results from Serper
 * - Solution: Updated prompt to request 1-3 word base keywords only
 * - AI extracts core product/ingredient/category from scraped website content
 * 
 * =============================================================================
 * ERROR HANDLING
 * =============================================================================
 * If Firecrawl or OpenAI fails:
 * - Return success: false with user-friendly error message
 * - Frontend shows "We couldn't find suggestions, please enter manually"
 * - User can still proceed with manual entry
 * 
 * =============================================================================
 * COST CONSIDERATIONS
 * =============================================================================
 * - Firecrawl: ~$0.001 per scrape
 * - Anthropic claude-haiku-4-5: ~$0.01-0.02 per request ($1/MTok input, $5/MTok output)
 * - Total per onboarding: ~$0.02-0.03
 * 
 * =============================================================================
 * FUTURE IMPROVEMENTS
 * =============================================================================
 * - Cache results by domain to avoid duplicate API calls
 * - Add retry logic with exponential backoff
 * - Consider using GPT-4o for better accuracy (higher cost)
 * - Add rate limiting per user
 * - Store raw AI response for analytics/debugging
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/supabase/server';

// =============================================================================
// CONFIGURATION
// =============================================================================

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/scrape';
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'; // Claude Haiku 4.5 - cost-efficient model
const MAX_CONTENT_LENGTH = 8000; // Truncate content to stay within token limits
const DOMAIN_VALIDATION_TIMEOUT = 5000; // 5 seconds per domain

// =============================================================================
// ZOD SCHEMA FOR STRUCTURED AI OUTPUT (January 3rd, 2026)
// 
// This schema ensures Claude returns properly structured data.
// Using Zod with Anthropic's tool use for type-safe responses.
// =============================================================================
// January 28th, 2026 (v2): Updated schema descriptions - translation is mandatory
const SuggestionsSchema = z.object({
  competitors: z.array(z.object({
    name: z.string().describe('Company or product name'),
    domain: z.string().describe('Website domain without http/https (e.g., competitor.com)'),
  })).describe('12 direct competitors to this business'),
  
  topics: z.array(z.object({
    keyword: z.string().describe('Short keyword (1-3 words) TRANSLATED to the target language. If website has English/French terms, translate them. Example: "Bee Cream" → "Bienencreme" for German.'),
  })).describe('10 specific keywords TRANSLATED to target language - based on website products/ingredients but OUTPUT IN TARGET LANGUAGE ONLY'),
  
  industry: z.string().describe('The primary industry/category of this business'),
  
  targetAudience: z.string().describe('Brief description of target customers'),
});

type SuggestionsResponse = z.infer<typeof SuggestionsSchema>;

// =============================================================================
// RESPONSE TYPES
// =============================================================================

interface Competitor {
  name: string;
  domain: string;
}

interface Topic {
  keyword: string;
}

interface SuccessResponse {
  success: true;
  competitors: Competitor[];
  topics: Topic[];
  industry: string;
  targetAudience: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  userMessage: string; // Friendly message to display to user
}

// =============================================================================
// HELPER: VALIDATE DOMAIN (January 3rd, 2026)
// 
// Checks if a competitor domain is actually reachable.
// This filters out hallucinated/fake domains from OpenAI.
// Uses HEAD request for efficiency (no body download).
// =============================================================================
async function validateDomain(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOMAIN_VALIDATION_TIMEOUT);
    
    // Try with https first
    const response = await fetch(`https://${domain}`, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    
    clearTimeout(timeoutId);
    return response.status < 500; // Accept any non-5xx response
  } catch {
    // Try with www prefix
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DOMAIN_VALIDATION_TIMEOUT);
      
      const response = await fetch(`https://www.${domain}`, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      });
      
      clearTimeout(timeoutId);
      return response.status < 500;
    } catch {
      return false;
    }
  }
}

// =============================================================================
// HELPER: VALIDATE ALL COMPETITORS IN PARALLEL (January 3rd, 2026)
// 
// Runs domain validation for all competitors simultaneously.
// Returns only valid (reachable) competitors.
// =============================================================================
async function validateCompetitors(competitors: Competitor[]): Promise<Competitor[]> {
  const validationResults = await Promise.all(
    competitors.map(async (comp) => {
      const isValid = await validateDomain(comp.domain);
      return { ...comp, isValid };
    })
  );
  
  return validationResults
    .filter(c => c.isValid)
    .map(({ name, domain }) => ({ name, domain }));
}

// =============================================================================
// HELPER: SCRAPE WEBSITE WITH FIRECRAWL (January 3rd, 2026)
// 
// Uses Firecrawl REST API to extract website content as markdown.
// Markdown format is ideal for AI analysis - structured, no HTML noise.
// =============================================================================
async function scrapeWebsite(url: string): Promise<{ content: string; title?: string } | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  
  if (!apiKey) {
    console.error('[suggestions/generate] FIRECRAWL_API_KEY not configured');
    return null;
  }
  
  try {
    const response = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url.startsWith('http') ? url : `https://${url}`,
        formats: ['markdown'],
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[suggestions/generate] Firecrawl HTTP ${response.status}:`, errorText);
      return null;
    }
    
    const result = await response.json();
    
    if (!result.success || !result.data?.markdown) {
      console.error('[suggestions/generate] Firecrawl returned no content:', result);
      return null;
    }
    
    return {
      content: result.data.markdown,
      title: result.data.metadata?.title,
    };
  } catch (error) {
    console.error('[suggestions/generate] Firecrawl error:', error);
    return null;
  }
}

// =============================================================================
// HELPER: GENERATE SUGGESTIONS WITH ANTHROPIC CLAUDE (January 3rd, 2026)
// Updated: January 17th, 2026
// Migrated to Anthropic: February 3rd, 2026
// 
// Uses Anthropic's tool use feature for reliable structured JSON responses.
// The Zod schema ensures type-safe parsing of AI output.
// 
// Prompt is carefully crafted to:
// 1. Request exactly 12 competitors (we'll filter down after validation)
// 2. Request exactly 10 topics
// 3. Focus on REAL companies, not made-up ones
// 4. Think about affiliate marketing context
// 
// January 17th, 2026 UPDATE:
// - Added targetCountry and targetLanguage parameters
// - Prompt now instructs AI to:
//   1. Find competitors relevant to the target country/market
//   2. Generate topics/keywords in the target language
// - This fixes the issue where topics were always in English
// =============================================================================
async function generateWithAI(
  websiteContent: string, 
  websiteUrl: string,
  targetCountry: string | null,
  targetLanguage: string | null
): Promise<SuggestionsResponse | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.error('[suggestions/generate] ANTHROPIC_API_KEY not configured');
    return null;
  }
  
  const client = new Anthropic({ apiKey });
  
  // Truncate content if too long
  const truncatedContent = websiteContent.length > MAX_CONTENT_LENGTH
    ? websiteContent.slice(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated for analysis...]'
    : websiteContent;
  
  // ==========================================================================
  // January 17th, 2026: Build dynamic prompt sections based on country/language
  // 
  // If country is provided:
  // - Prioritize competitors operating in that market
  // - Include local/regional competitors, not just global ones
  // 
  // If language is provided:
  // - Generate topics/keywords in that language
  // - This is crucial for non-English markets (German, French, etc.)
  // ==========================================================================
  const countryInstruction = targetCountry 
    ? `\n   - IMPORTANT: Prioritize competitors operating in ${targetCountry}
   - Include both international brands with presence in ${targetCountry} AND local/regional competitors
   - For country-specific domains (e.g., .de, .fr, .co.uk), prefer those when targeting that market`
    : '';
  
  // ==========================================================================
  // January 28th, 2026: Stricter language and specificity instructions
  // Updated: January 28th, 2026 (v2) - Even stricter translation enforcement
  // 
  // Problem: AI was generating:
  // 1. Keywords in wrong language (French "Gelée Royale" for German users)
  // 2. Product names in English when target is German (e.g., "Bee Cream")
  // 3. Generic/broad keywords not specific to the website content
  // 
  // Root cause: AI prioritizes "extract literally" over "translate to target"
  // Solution: Make translation the #1 priority with many concrete examples
  // ==========================================================================
  const topicsInstruction = (() => {
    const parts: string[] = [];
    
    if (targetLanguage) {
      // TRANSLATION IS #1 PRIORITY - put this first and make it very explicit
      parts.push(`⚠️ MANDATORY TRANSLATION RULE ⚠️`);
      parts.push(`Every single keyword MUST be in ${targetLanguage} language`);
      parts.push(`If the website uses English, French, or any other language - you MUST TRANSLATE to ${targetLanguage}`);
      parts.push(`DO NOT copy foreign language terms literally - ALWAYS translate them`);
      
      // Language-specific examples
      if (targetLanguage.toLowerCase() === 'german') {
        parts.push(`GERMAN TRANSLATION EXAMPLES (you must apply similar translations):`);
        parts.push(`  • "Bee Cream" → "Bienencreme" (NOT "Bee Cream")`);
        parts.push(`  • "Gelée Royale" → "Gelee Royal" (remove French accent)`);
        parts.push(`  • "Royal Jelly" → "Gelee Royal" (translate English to German)`);
        parts.push(`  • "Anti Aging" → "Anti-Aging" (acceptable, commonly used in German)`);
        parts.push(`  • "Face Serum" → "Gesichtsserum" (translate to German)`);
        parts.push(`  • "Honey" → "Honig" (translate to German)`);
        parts.push(`  • "Propolis Tincture" → "Propolis Tinktur" (translate to German)`);
      } else if (targetLanguage.toLowerCase() === 'french') {
        parts.push(`FRENCH TRANSLATION EXAMPLES:`);
        parts.push(`  • "Bee Cream" → "Crème d'abeille"`);
        parts.push(`  • "Honey" → "Miel"`);
        parts.push(`  • "Royal Jelly" → "Gelée Royale"`);
      } else if (targetLanguage.toLowerCase() === 'spanish') {
        parts.push(`SPANISH TRANSLATION EXAMPLES:`);
        parts.push(`  • "Bee Cream" → "Crema de abeja"`);
        parts.push(`  • "Honey" → "Miel"`);
        parts.push(`  • "Royal Jelly" → "Jalea Real"`);
      }
      
      parts.push(`VERIFICATION: Before outputting, check each keyword - if it's not in ${targetLanguage}, translate it!`);
    }
    
    // Specificity instruction (after translation)
    parts.push(`SPECIFICITY: Base keywords on products/ingredients from the website content`);
    parts.push(`Use specific product names, brand terms, ingredients - not generic categories`);
    parts.push(`BAD: "honey", "cream", "supplements" (too generic)`);
    parts.push(`GOOD: "Manuka Honig", "Propolis Tinktur", "Bienengift Salbe" (specific)`);
    
    if (targetCountry) {
      parts.push(`Generate topics relevant to what people in ${targetCountry} would search for`);
    }
    
    return parts.length > 0 ? '\n   - ' + parts.join('\n   - ') : '';
  })();
  
  // Build the system prompt
  const systemPrompt = `You are a competitive analysis expert specializing in affiliate marketing.

Your task is to analyze a website and identify competitors and search keywords.

=== COMPETITORS (exactly 12) ===
- Must be REAL, existing companies with working websites
- Direct competitors offering similar products/services
- Include a mix of large and smaller competitors
- Domain format: just the domain (e.g., "competitor.com"), no http/https/www${countryInstruction}

=== TOPICS/KEYWORDS (exactly 10) ===
- SHORT search keywords (1-3 words maximum!)
- These keywords are used to search Google, YouTube, Instagram, TikTok
- Words like "review", "blog", "test" are AUTOMATICALLY ADDED by our system
- Generate only the BASE product/ingredient keywords${topicsInstruction}

=== CRITICAL LANGUAGE RULE ===
If a target language is specified, you MUST translate ALL keywords to that language.
- DO NOT keep English product names like "Bee Cream" - translate them!
- DO NOT keep French terms like "Gelée Royale" - translate them!
- EVERY keyword must be in the target language, no exceptions.
- This is the #1 most important rule for keywords.

=== SPECIFICITY RULE ===
Keywords should be based on the website content but TRANSLATED to target language.
- BAD: "honey", "bee products" (too generic)
- BAD: "Bee Cream", "Royal Jelly" (not translated to German)
- GOOD: "Bienencreme", "Gelee Royal", "Propolis Tinktur" (specific + German)

Be specific and practical. Generic or wrong-language keywords fail.

You MUST use the extract_suggestions tool to provide your response in the correct structured format.`;

  // Build the user message
  const userMessage = `Analyze this website and provide competitor and topic suggestions.

Website: ${websiteUrl}
${targetCountry ? `Target Market: ${targetCountry}` : ''}
${targetLanguage ? `
⚠️ TARGET LANGUAGE: ${targetLanguage}
MANDATORY: Translate ALL keywords to ${targetLanguage}!
- If website has "Bee Cream" → output "${targetLanguage === 'German' ? 'Bienencreme' : 'translated term'}"
- If website has "Gelée Royale" → output "${targetLanguage === 'German' ? 'Gelee Royal' : 'translated term'}"
- Do NOT output English or French terms - ONLY ${targetLanguage}!
` : ''}

Analyze the website content below. Extract product/ingredient keywords, then TRANSLATE them to ${targetLanguage || 'the appropriate language'}:

${truncatedContent}

Use the extract_suggestions tool to provide your structured response.`;

  // Define the tool for structured output extraction
  const extractSuggestionsTool: Anthropic.Tool = {
    name: 'extract_suggestions',
    description: 'Extract and return the competitor and topic suggestions in a structured format',
    input_schema: {
      type: 'object' as const,
      properties: {
        competitors: {
          type: 'array',
          description: '12 direct competitors to this business',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Company or product name' },
              domain: { type: 'string', description: 'Website domain without http/https (e.g., competitor.com)' },
            },
            required: ['name', 'domain'],
          },
        },
        topics: {
          type: 'array',
          description: '10 specific keywords TRANSLATED to target language',
          items: {
            type: 'object',
            properties: {
              keyword: { type: 'string', description: 'Short keyword (1-3 words) in the target language' },
            },
            required: ['keyword'],
          },
        },
        industry: { type: 'string', description: 'The primary industry/category of this business' },
        targetAudience: { type: 'string', description: 'Brief description of target customers' },
      },
      required: ['competitors', 'topics', 'industry', 'targetAudience'],
    },
  };

  try {
    const message = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      tools: [extractSuggestionsTool],
      tool_choice: { type: 'tool', name: 'extract_suggestions' }, // Force tool use
      messages: [
        { role: 'user', content: userMessage }
      ],
    });
    
    // Extract the tool use result
    const toolUseBlock = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );
    
    if (toolUseBlock && toolUseBlock.name === 'extract_suggestions') {
      // Validate with Zod schema
      const parseResult = SuggestionsSchema.safeParse(toolUseBlock.input);
      
      if (parseResult.success) {
        return parseResult.data;
      } else {
        console.error('[suggestions/generate] Zod validation failed:', parseResult.error);
        // Try to return the raw input if it has the basic structure
        const rawInput = toolUseBlock.input as SuggestionsResponse;
        if (rawInput.competitors && rawInput.topics) {
          return rawInput;
        }
        return null;
      }
    }
    
    console.error('[suggestions/generate] No tool use block found in response');
    return null;
  } catch (error) {
    console.error('[suggestions/generate] Anthropic error:', error);
    return null;
  }
}

// =============================================================================
// MAIN API HANDLER
// Updated: January 17th, 2026
// 
// January 17th, 2026 UPDATE:
// - Added targetCountry and targetLanguage parameters
// - These are used to generate market-specific competitors and 
//   language-specific topics/keywords
// - Previously, topics were always in English regardless of user's market
// =============================================================================
export async function POST(request: NextRequest): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  console.log('[suggestions/generate] Request received');
  
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        userMessage: 'Please sign in to use this feature.',
      }, { status: 401 });
    }

    const body = await request.json();
    // January 17th, 2026: Now accepting targetCountry and targetLanguage
    const { brandUrl, targetCountry, targetLanguage } = body;
    
    // Validate input
    if (!brandUrl || typeof brandUrl !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'brandUrl is required',
        userMessage: 'Please provide your brand website URL.',
      }, { status: 400 });
    }
    
    // Normalize the URL
    const normalizedUrl = brandUrl
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
    
    // Log with country/language context (January 17th, 2026)
    console.log(`[suggestions/generate] Analyzing: ${normalizedUrl}`);
    console.log(`[suggestions/generate] Target market: ${targetCountry || 'not specified'}, Language: ${targetLanguage || 'not specified'}`);
    
    // Step 1: Scrape the website
    console.log('[suggestions/generate] Step 1: Scraping website...');
    const scrapeResult = await scrapeWebsite(normalizedUrl);
    
    if (!scrapeResult) {
      return NextResponse.json({
        success: false,
        error: 'Failed to scrape website',
        userMessage: "We couldn't access your website. Please check the URL and try again, or enter your details manually.",
      });
    }
    
    console.log(`[suggestions/generate] Scraped ${scrapeResult.content.length} characters`);
    
    // Step 2: Generate suggestions with AI
    // January 17th, 2026: Now passing country and language for localized suggestions
    console.log('[suggestions/generate] Step 2: Generating AI suggestions...');
    const aiSuggestions = await generateWithAI(
      scrapeResult.content, 
      normalizedUrl,
      targetCountry || null,
      targetLanguage || null
    );
    
    if (!aiSuggestions) {
      return NextResponse.json({
        success: false,
        error: 'Failed to generate suggestions',
        userMessage: "We couldn't analyze your website at this time. Please enter your competitors and topics manually.",
      });
    }
    
    console.log(`[suggestions/generate] AI returned ${aiSuggestions.competitors.length} competitors, ${aiSuggestions.topics.length} topics`);
    
    // Step 3: Validate competitor domains
    console.log('[suggestions/generate] Step 3: Validating competitor domains...');
    const validatedCompetitors = await validateCompetitors(aiSuggestions.competitors);
    
    console.log(`[suggestions/generate] ${validatedCompetitors.length}/${aiSuggestions.competitors.length} competitors validated`);
    
    // Return successful response
    return NextResponse.json({
      success: true,
      competitors: validatedCompetitors,
      topics: aiSuggestions.topics,
      industry: aiSuggestions.industry,
      targetAudience: aiSuggestions.targetAudience,
    });
    
  } catch (error) {
    console.error('[suggestions/generate] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      userMessage: "Something went wrong. Please enter your competitors and topics manually.",
    }, { status: 500 });
  }
}

