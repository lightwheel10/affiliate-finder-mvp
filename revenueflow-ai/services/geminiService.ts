import { GoogleGenAI } from "@google/genai";
import { SERVICES_DATA } from '../constants';
import { Language } from '../types';

// Initialize the client safely
// We check multiple variations to support different build environments (Vite, CRA, Vercel)
// IMPORTANT: For Vercel deployment, you MUST add VITE_API_KEY or REACT_APP_API_KEY to your environment variables.
// Plain API_KEY is often blocked from the client bundle for security.

const getApiKey = () => {
  // 1. Try Vite native import.meta.env
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    if (import.meta.env.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
    // @ts-ignore
    if (import.meta.env.API_KEY) return import.meta.env.API_KEY;
  }

  // 2. Try process.env (CRA, Next.js, or Vite with polyfill)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_API_KEY) return process.env.VITE_API_KEY;
    if (process.env.REACT_APP_API_KEY) return process.env.REACT_APP_API_KEY;
    if (process.env.API_KEY) return process.env.API_KEY;
  }

  return '';
};

const apiKey = getApiKey();

let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
} else {
  console.error("API Key missing. Please add VITE_API_KEY to your Vercel Environment Variables and redeploy.");
}

export const getServiceRecommendation = async (userQuery: string, language: Language = 'en'): Promise<string> => {
  if (!ai) {
    return language === 'de' 
      ? "System Offline. Empfohlene Aktion: Setze 'Hyper-Personalisierte Outbound' ein, um sofort Leads zu generieren."
      : "System Offline. Recommended Action: Deploy 'Hyper-Personalized Outbound' to start generating leads immediately.";
  }

  try {
    const services = SERVICES_DATA[language];
    const serviceContext = services.map(s => `${s.title} (${s.category}): ${s.description} - Price: ${s.price} (Discounted from ${s.originalPrice})`).join('\n');
    
    const langInstruction = language === 'de' ? "Reply in German." : "Reply in English.";

    const prompt = `
      You are "RevBot", a sarcastic but highly effective Revenue Automation Consultant for "RevenueFlow AI".
      
      Your goal is to sell automation services to businesses.
      
      Available Services (with discounts applied):
      ${serviceContext}
      
      User Input: "${userQuery}"
      
      Task:
      1. Analyze the user's pain point.
      2. Recommend ONE service from the list.
      3. Mention the savings/discount to seal the deal.
      4. Be confident, use business slang (ROI, scale, pipeline), and keep it under 30 words.
      5. If they ask something unrelated, pivot back to making money.
      6. ${langInstruction}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || (language === 'de' ? "Pipeline unklar. Probier 'Hyper-Personalisierte Outbound'." : "Pipeline unclear. Try 'Hyper-Personalized Outbound'.");
  } catch (error) {
    console.error("Gemini API Error:", error);
    return language === 'de' ? "API-Latenz erkannt. Kauf einfach den CRM Autopilot." : "API Latency Detected. Just buy the CRM Autopilot.";
  }
};

export const getAgentBlueprint = async (userQuery: string, language: Language = 'en'): Promise<string> => {
    if (!ai) {
      return language === 'de' 
        ? "ARCHITECTURE_OFFLINE // Bitte verbinden Sie API Key."
        : "ARCHITECTURE_OFFLINE // Please connect API Key.";
    }
  
    try {
      const langInstruction = language === 'de' ? "Reply in German." : "Reply in English.";
  
      const prompt = `
        You are the "Master Architect" at RevenueWorks. Your job is to analyze a user's manual workflow and design a high-tech AI Agent solution.
        
        User's Manual Task: "${userQuery}"
        
        Task:
        Generate a "System Blueprint" that looks like a technical terminal output or a strategic memo. 
        Structure:
        1. **DIAGNOSIS**: Identify the inefficiency (e.g., "Human bottleneck detected in data entry").
        2. **AGENT SOLUTION**: Name a specific AI Agent type (e.g., "Auto-SDR v4", "Ops-Daemon X").
        3. **WORKFLOW**: 3 bullet points on how the agent solves it autonomously.
        4. **ROI PROJECTION**: Estimated hours saved or revenue gained.
  
        Tone: High-tech, professional, efficient, persuasive. "Cyberpunk corporate".
        Keep it concise (max 150 words).
        ${langInstruction}
      `;
  
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
  
      return response.text || "Blueprint generation failed.";
    } catch (error) {
      console.error("Gemini API Error:", error);
      return "System Error: Neural Link Disconnected.";
    }
  };