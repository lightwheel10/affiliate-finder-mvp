import { GoogleGenerativeAI } from "@google/generative-ai";
import { SearchResult } from "./search";

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;

// Initialize Gemini
// Note: Using a model that supports structured JSON output if possible, or careful prompting
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

export interface AnalysisResult {
  isAffiliate: boolean;
  confidence: number; // 0-100
  personName?: string; // "John Doe"
  company?: string; // "TechReview Inc"
  role?: string; // "Marketing Manager"
  summary: string; // Short reason why
}

/**
 * Analyzes a search result to determine if it's a viable affiliate partner
 * and extracts contact entities for Lusha.
 */
export async function analyzeContent(result: SearchResult, keyword: string): Promise<AnalysisResult> {
  if (!GEMINI_API_KEY) {
    console.warn("Missing GOOGLE_API_KEY");
    return {
      isAffiliate: false,
      confidence: 0,
      summary: "API Key missing"
    };
  }

  const prompt = `
    You are an expert Affiliate Scout. Analyze this search result for the keyword: "${keyword}".
    
    Source: ${result.source}
    Title: "${result.title}"
    Snippet: "${result.snippet}"
    Link: "${result.link}"

    Task:
    1. Determine if this content creator is a potential affiliate partner (reviews products, writes comparisons, is an influencer).
    2. Extract the likely NAME of the person behind this content (author, profile owner).
    3. Extract the likely COMPANY name (if it's a blog/agency).

    Output JSON ONLY:
    {
      "isAffiliate": boolean,
      "confidence": number (0-100),
      "personName": string | null,
      "company": string | null,
      "role": string | null,
      "summary": "Brief 1-sentence explanation"
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Basic cleanup to parse JSON if the model adds markdown blocks
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanText);
    
    return data as AnalysisResult;
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return {
      isAffiliate: false,
      confidence: 0,
      summary: "Analysis failed"
    };
  }
}

