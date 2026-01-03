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
 * 2. OpenAI (gpt-4o-mini) - To analyze content and generate suggestions
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
 * - 10 Topics: Keywords/topics affiliates would write about
 *   - User will select up to 10 in Step 4
 *   - Used for affiliate discovery searches
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
 * - OpenAI gpt-4o-mini: ~$0.01-0.02 per request
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
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

// =============================================================================
// CONFIGURATION
// =============================================================================

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/scrape';
const OPENAI_MODEL = 'gpt-4o-mini'; // Cost-efficient model
const MAX_CONTENT_LENGTH = 8000; // Truncate content to stay within token limits
const DOMAIN_VALIDATION_TIMEOUT = 5000; // 5 seconds per domain

// =============================================================================
// ZOD SCHEMA FOR STRUCTURED AI OUTPUT (January 3rd, 2026)
// 
// This schema ensures OpenAI returns properly structured data.
// Using Zod with OpenAI's zodResponseFormat for type-safe responses.
// =============================================================================
const SuggestionsSchema = z.object({
  competitors: z.array(z.object({
    name: z.string().describe('Company or product name'),
    domain: z.string().describe('Website domain without http/https (e.g., competitor.com)'),
  })).describe('12 direct competitors to this business'),
  
  topics: z.array(z.object({
    keyword: z.string().describe('Search keyword or topic phrase'),
  })).describe('10 relevant topics/keywords affiliates would write about'),
  
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
// HELPER: GENERATE SUGGESTIONS WITH OPENAI (January 3rd, 2026)
// 
// Uses OpenAI's structured output feature for reliable JSON responses.
// The Zod schema ensures type-safe parsing of AI output.
// 
// Prompt is carefully crafted to:
// 1. Request exactly 12 competitors (we'll filter down after validation)
// 2. Request exactly 10 topics
// 3. Focus on REAL companies, not made-up ones
// 4. Think about affiliate marketing context
// =============================================================================
async function generateWithAI(
  websiteContent: string, 
  websiteUrl: string
): Promise<SuggestionsResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('[suggestions/generate] OPENAI_API_KEY not configured');
    return null;
  }
  
  const client = new OpenAI({ apiKey });
  
  // Truncate content if too long
  const truncatedContent = websiteContent.length > MAX_CONTENT_LENGTH
    ? websiteContent.slice(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated for analysis...]'
    : websiteContent;
  
  try {
    const completion = await client.chat.completions.parse({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a competitive analysis expert specializing in affiliate marketing. 

Your task is to analyze a website and identify:

1. COMPETITORS (exactly 12):
   - Must be REAL, existing companies with working websites
   - Direct competitors offering similar products/services
   - Include a mix of large and smaller competitors
   - Domain format: just the domain (e.g., "competitor.com"), no http/https/www

2. TOPICS (exactly 10):
   - Keywords and topics that affiliate marketers and content creators would write about
   - Think: blog posts, YouTube reviews, comparison articles, "best X" listicles
   - Should be relevant to discovering affiliates in this space

Be specific and practical. These suggestions will be used for affiliate marketing outreach.`
        },
        {
          role: 'user',
          content: `Analyze this website and provide competitor and topic suggestions.

Website: ${websiteUrl}

Content:
${truncatedContent}`
        }
      ],
      response_format: zodResponseFormat(SuggestionsSchema, 'suggestions'),
    });
    
    const message = completion.choices[0]?.message;
    
    if (message?.parsed) {
      return message.parsed;
    } else if (message?.refusal) {
      console.error('[suggestions/generate] AI refused request:', message.refusal);
      return null;
    }
    
    return null;
  } catch (error) {
    console.error('[suggestions/generate] OpenAI error:', error);
    return null;
  }
}

// =============================================================================
// MAIN API HANDLER
// =============================================================================
export async function POST(request: NextRequest): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  console.log('[suggestions/generate] Request received');
  
  try {
    const body = await request.json();
    const { brandUrl } = body;
    
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
    
    console.log(`[suggestions/generate] Analyzing: ${normalizedUrl}`);
    
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
    console.log('[suggestions/generate] Step 2: Generating AI suggestions...');
    const aiSuggestions = await generateWithAI(scrapeResult.content, normalizedUrl);
    
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

