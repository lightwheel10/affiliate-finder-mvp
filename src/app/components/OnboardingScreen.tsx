'use client';

/**
 * =============================================================================
 * OnboardingScreen - NEO-BRUTALIST
 * =============================================================================
 * 
 * Last Updated: January 9th, 2026
 *
 * NEO-BRUTALIST DESIGN UPDATE:
 * - Sharp edges (no rounded corners) 
 * - Bold borders (border-2 with black)
 * - Yellow accent color (#ffbf23)
 * - Bold typography (font-black uppercase)
 * - Dark mode support
 * 
 * =============================================================================
 * CHANGELOG:
 * 
 * January 9th, 2026:
 * - Updated Step 1 (Name/Role/Brand) to neo-brutalist design
 *   - Added header with logo and progress bar
 *   - Sharp edges on all inputs and dropdowns
 *   - Dark mode support throughout
 * 
 * - Updated Step 2 (Country/Language) to neo-brutalist design
 *   - Sharp edges on country and language dropdowns
 *   - Neo-brutalist dropdown menus with offset shadow
 *   - Updated icon containers to sharp edges
 * 
 * - Updated Step 3 (Competitors) to neo-brutalist design
 *   - Sharp edges on input, add button, suggestion cards, selected cards
 *   - Updated empty state styling
 * 
 * - Updated Step 4 (Topics) to neo-brutalist design
 *   - Sharp edges on input, add button, topic pills
 *   - Updated suggestion and selected topic styling
 * 
 * - Updated Step 5 (Affiliate Types) to neo-brutalist design
 *   - Sharp edges on type buttons and checkbox indicators
 *   - Dark mode support for all elements
 * 
 * January 8th, 2026:
 * - Initial neo-brutalist container and button styling
 * 
 * January 3rd, 2026:
 * - Added AI suggestions functionality
 * - Domain validation with format checking
 * - Back button navigation for steps 3-5
 * =============================================================================
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Check, ChevronDown, Sparkles, Globe, Plus, X, MessageSquare, MousePointerClick, Star, Search, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StripeProvider } from './StripeProvider';
import { Step7CardForm } from './Step7CardForm';
import { AnalyzingScreen } from './AnalyzingScreen';
import { CURRENCY_SYMBOL } from '@/lib/stripe-client';

// =============================================================================
// AI SUGGESTIONS TYPES (January 3rd, 2026)
// 
// These types match the response from /api/suggestions/generate endpoint.
// Used to store AI-generated competitor and topic suggestions.
// =============================================================================
interface SuggestedCompetitor {
  name: string;
  domain: string;
}

interface SuggestedTopic {
  keyword: string;
}

// Pricing plans data - matching PricingModal exactly
const PRICING_PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    description: 'Perfect for solo founders & small teams starting their affiliate journey.',
    monthlyPrice: 99,
    annualPrice: 79,
    features: [
      'Find 500 new affiliates / month',
      '150 Verified email credits / month',
      '1 Brand Project',
      'Basic Search Filters',
      'Email Support',
      'Export to CSV'
    ],
    popular: false,
  },
  {
    id: 'business',
    name: 'Business',
    description: 'For growing brands that need to scale their outreach volume.',
    monthlyPrice: 249,
    annualPrice: 199,
    features: [
      'Find Unlimited affiliates',
      '500 Verified email credits / month',
      '5 Brand Projects',
      'Advanced Competitor Analysis',
      'Priority Chat Support',
      'API Access',
      'Team Collaboration (5 seats)'
    ],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solutions for large organizations with specific needs.',
    priceLabel: 'Custom',
    features: [
      'Unlimited everything',
      'Dedicated Account Manager',
      'Custom AI Model Training',
      'SSO & Advanced Security',
      'White-glove Onboarding',
      'Custom Invoicing'
    ],
    popular: false,
  },
];

// =============================================================================
// DOMAIN VALIDATION HELPER (January 3rd, 2026)
// 
// Client-side regex validation for instant feedback on domain format.
// This runs on every keystroke to show immediate visual feedback.
// Server-side validation (HEAD request) is done when user clicks "Continue".
// 
// Why both client + server validation?
// - Client: Instant UX feedback, catches obvious typos
// - Server: Verifies domain actually exists and is reachable
// =============================================================================
function isValidDomainFormat(domain: string): boolean {
  if (!domain) return false;
  
  // Normalize: strip protocols, www, paths
  let normalized = domain.trim().toLowerCase();
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^www\./, '');
  normalized = normalized.split('/')[0];
  normalized = normalized.split('?')[0];
  normalized = normalized.split('#')[0];
  normalized = normalized.split(':')[0];
  
  if (!normalized) return false;
  
  // Check domain format with regex
  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(normalized);
}

// =============================================================================
// STATIC SUGGESTIONS - DEPRECATED (January 3rd, 2026)
// 
// These static arrays are no longer used for suggestions.
// AI-generated suggestions are now fetched dynamically via:
// - /api/suggestions/generate endpoint
// - Firecrawl for website scraping
// - OpenAI gpt-4o-mini for analysis
// 
// The dynamic suggestions are stored in component state:
// - suggestedCompetitors: SuggestedCompetitor[]
// - suggestedTopics: SuggestedTopic[]
// 
// These empty arrays are kept for backwards compatibility but not used.
// See: fetchAISuggestions() function and AnalyzingScreen component.
// =============================================================================
const SUGGESTED_COMPETITORS: { name: string; domain: string; logo: string }[] = [];
const SUGGESTED_TOPICS: string[] = [];

const AFFILIATE_TYPES = [
  "Publishers/Bloggers",
  "Instagram",
  "TikTok",
  "X (Twitter)",
  "LinkedIn",
  "Reddit",
  "YouTube",
  "Other"
];

interface OnboardingScreenProps {
  userId: number;
  userName: string;
  userEmail: string; // Required for Stripe customer creation
  initialStep?: number; // Resume from this step
  userData?: {
    name?: string;
    role?: string;
    brand?: string;
    targetCountry?: string;
    targetLanguage?: string;
    competitors?: string[];
    topics?: string[];
    affiliateTypes?: string[];
  };
  onComplete: () => void;
}

export const OnboardingScreen = ({ userId, userName, userEmail, initialStep = 1, userData, onComplete }: OnboardingScreenProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(initialStep);
  
  // Step 1 Data - pre-fill from userData if resuming
  const [name, setName] = useState(userData?.name || userName || '');
  const [role, setRole] = useState(userData?.role || '');
  const [brand, setBrand] = useState(userData?.brand || '');
  
  // ==========================================================================
  // DOMAIN VALIDATION STATE (January 3rd, 2026)
  // 
  // We validate the brand domain in two phases:
  // 1. Client-side: Instant format validation (regex) on every keystroke
  // 2. Server-side: HEAD request to verify domain is reachable (on Continue click)
  // 
  // States:
  // - brandFormatValid: true if domain format is valid (instant feedback)
  // - isBrandValidating: true while server-side validation is in progress
  // - brandValidated: true if server confirmed domain is reachable
  // - brandError: error message to display (format error or reachability error)
  // ==========================================================================
  const [brandFormatValid, setBrandFormatValid] = useState<boolean | null>(null);
  const [isBrandValidating, setIsBrandValidating] = useState(false);
  const [brandValidated, setBrandValidated] = useState(false);
  const [brandError, setBrandError] = useState('');

  // ==========================================================================
  // AI SUGGESTIONS STATE (January 3rd, 2026)
  // 
  // After domain validation succeeds, we show an "Analyzing" screen while
  // fetching AI-generated suggestions from /api/suggestions/generate.
  // 
  // Flow:
  // 1. User enters brand domain in Step 1
  // 2. Domain is validated (HEAD request)
  // 3. isAnalyzing = true, show AnalyzingScreen component
  // 4. API call to Firecrawl + OpenAI generates suggestions
  // 5. Suggestions stored in state, user proceeds to Step 2
  // 6. In Steps 3 & 4, suggestions are displayed for user to select
  // 
  // States:
  // - isAnalyzing: true while AnalyzingScreen is visible
  // - analyzingStep: 1=scraping, 2=AI processing, 3=validating domains
  // - suggestedCompetitors: AI-generated competitor list (up to 12)
  // - suggestedTopics: AI-generated topic list (up to 10)
  // - suggestionError: Error message if API fails
  // ==========================================================================
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingStep, setAnalyzingStep] = useState(1);
  const [suggestedCompetitors, setSuggestedCompetitors] = useState<SuggestedCompetitor[]>([]);
  const [suggestedTopics, setSuggestedTopics] = useState<SuggestedTopic[]>([]);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  
  // Step 2 Data - pre-fill from userData if resuming
  const [targetCountry, setTargetCountry] = useState(userData?.targetCountry || '');
  const [targetLanguage, setTargetLanguage] = useState(userData?.targetLanguage || '');
  
  // Step 3 Data - pre-fill from userData if resuming
  const [competitors, setCompetitors] = useState<string[]>(userData?.competitors || []);
  const [competitorInput, setCompetitorInput] = useState('');

  // Step 4 Data - pre-fill from userData if resuming
  const [topics, setTopics] = useState<string[]>(userData?.topics || []);
  const [topicInput, setTopicInput] = useState('');

  // Step 5 Data - pre-fill from userData if resuming
  const [affiliateTypes, setAffiliateTypes] = useState<string[]>(userData?.affiliateTypes || []);

  // Step 6 Data - Pricing
  const [selectedPlan, setSelectedPlan] = useState<string>('business'); // Default to business (most popular)
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('annual');

  // Step 7 Data - Stripe Card (PCI Compliant - no raw card data)
  const [cardholderName, setCardholderName] = useState('');
  const [isCardReady, setIsCardReady] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  
  // Discount Code
  const [discountCode, setDiscountCode] = useState('');
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  const [discountApplied, setDiscountApplied] = useState(false);
  const [discountError, setDiscountError] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0); // Percentage or fixed amount

  // UI States
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  
  // Search states for dropdowns
  const [roleSearch, setRoleSearch] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [langSearch, setLangSearch] = useState('');

  // Refs for click-outside detection
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  
  // Refs for search inputs
  const roleSearchRef = useRef<HTMLInputElement>(null);
  const countrySearchRef = useRef<HTMLInputElement>(null);
  const langSearchRef = useRef<HTMLInputElement>(null);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setIsLangDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roles = [
    'Brand Owner', 'Affiliate Manager', 'Agency Owner', 
    'Freelancer', 'Content Creator', 'Other'
  ];

  // ==========================================================================
  // COUNTRIES & LANGUAGES (January 3rd, 2026)
  // 
  // Expanded list of developed market countries with ISO 3166-1 alpha-2 codes.
  // Focused on markets with strong affiliate marketing potential.
  // Excludes developing markets to focus on high-value targets.
  // 
  // Flag images are loaded from flagcdn.com CDN using ISO country codes.
  // This provides high-quality SVG flags with zero bundle size impact.
  // ==========================================================================
  const countries = [
    // North America
    { name: 'United States', code: 'us' },
    { name: 'Canada', code: 'ca' },
    // Europe - Major Markets
    { name: 'United Kingdom', code: 'gb' },
    { name: 'Germany', code: 'de' },
    { name: 'France', code: 'fr' },
    { name: 'Netherlands', code: 'nl' },
    { name: 'Belgium', code: 'be' },
    { name: 'Switzerland', code: 'ch' },
    { name: 'Austria', code: 'at' },
    { name: 'Ireland', code: 'ie' },
    // Nordics
    { name: 'Denmark', code: 'dk' },
    { name: 'Sweden', code: 'se' },
    { name: 'Norway', code: 'no' },
    { name: 'Finland', code: 'fi' },
    // Southern Europe
    { name: 'Spain', code: 'es' },
    { name: 'Italy', code: 'it' },
    { name: 'Portugal', code: 'pt' },
    // Central/Eastern Europe
    { name: 'Poland', code: 'pl' },
    { name: 'Czech Republic', code: 'cz' },
    // Asia-Pacific
    { name: 'Australia', code: 'au' },
    { name: 'New Zealand', code: 'nz' },
    { name: 'Japan', code: 'jp' },
    { name: 'South Korea', code: 'kr' },
    { name: 'Singapore', code: 'sg' },
    // Middle East
    { name: 'United Arab Emirates', code: 'ae' },
    { name: 'Israel', code: 'il' },
    { name: 'Saudi Arabia', code: 'sa' },
  ];
  
  // Languages with native script characters for visual distinction (January 3rd, 2026)
  const languages = [
    // Major Western Languages
    { name: 'English', symbol: 'Aa' },
    { name: 'Spanish', symbol: 'Ñ' },
    { name: 'German', symbol: 'Ä' },
    { name: 'French', symbol: 'Ç' },
    { name: 'Portuguese', symbol: 'Ã' },
    { name: 'Italian', symbol: 'È' },
    { name: 'Dutch', symbol: 'IJ' },
    // Nordic Languages
    { name: 'Swedish', symbol: 'Å' },
    { name: 'Danish', symbol: 'Ø' },
    { name: 'Norwegian', symbol: 'Æ' },
    { name: 'Finnish', symbol: 'Ä' },
    // Central/Eastern European
    { name: 'Polish', symbol: 'Ł' },
    { name: 'Czech', symbol: 'Č' },
    // Asian Languages
    { name: 'Japanese', symbol: 'あ' },
    { name: 'Korean', symbol: '한' },
    // Middle Eastern
    { name: 'Arabic', symbol: 'ع' },
    { name: 'Hebrew', symbol: 'ע' },
  ];
  
  // Helper function to get flag image URL from flagcdn.com (January 3rd, 2026)
  const getFlagUrl = (code: string) => `https://flagcdn.com/w40/${code}.png`;

  // ==========================================================================
  // BRAND INPUT HANDLER (January 3rd, 2026)
  // 
  // Handles brand domain input with instant format validation.
  // Provides immediate visual feedback if the domain format is invalid.
  // Server-side validation happens when user clicks "Continue".
  // ==========================================================================
  const handleBrandChange = (value: string) => {
    setBrand(value);
    setBrandError(''); // Clear any previous errors
    setBrandValidated(false); // Reset server validation status
    
    // Only validate format if user has entered something
    if (value.trim()) {
      const isValid = isValidDomainFormat(value);
      setBrandFormatValid(isValid);
    } else {
      setBrandFormatValid(null); // Reset to neutral state when empty
    }
  };

  // ==========================================================================
  // DOMAIN VALIDATION API CALL (January 3rd, 2026)
  // 
  // Called when user clicks "Continue" in Step 1.
  // Makes a server-side HEAD request to verify the domain is reachable.
  // This is critical because:
  // 1. We need a valid domain to scrape with Firecrawl later
  // 2. We generate AI suggestions based on website content
  // 3. Invalid domains would waste API credits
  // ==========================================================================
  const validateBrandDomain = async (): Promise<boolean> => {
    if (!brand.trim()) {
      setBrandError('Please enter your brand domain');
      return false;
    }
    
    // Quick format check before making API call
    if (!isValidDomainFormat(brand)) {
      setBrandError('Please enter a valid domain (e.g., example.com)');
      return false;
    }
    
    setIsBrandValidating(true);
    setBrandError('');
    
    try {
      const response = await fetch('/api/validate-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: brand }),
      });
      
      const data = await response.json();
      
      if (!data.valid) {
        setBrandError(data.error || 'Domain is not reachable');
        setBrandValidated(false);
        return false;
      }
      
      // Update brand with normalized version (strips http, www, etc.)
      if (data.normalizedDomain && data.normalizedDomain !== brand) {
        setBrand(data.normalizedDomain);
      }
      
      setBrandValidated(true);
      return true;
      
    } catch (error) {
      console.error('Domain validation failed:', error);
      setBrandError('Failed to validate domain. Please try again.');
      return false;
    } finally {
      setIsBrandValidating(false);
    }
  };

  // ==========================================================================
  // AI SUGGESTIONS FETCHER (January 3rd, 2026)
  // 
  // Calls /api/suggestions/generate to get AI-powered suggestions.
  // This endpoint:
  // 1. Scrapes the brand website using Firecrawl
  // 2. Analyzes content with OpenAI gpt-4o-mini
  // 3. Returns 12 competitors + 10 topics
  // 4. Validates all competitor domains
  // 
  // The AnalyzingScreen component shows progress during this process.
  // If the API fails, user can still proceed with manual entry.
  // ==========================================================================
  const fetchAISuggestions = async (brandUrl: string): Promise<boolean> => {
    setIsAnalyzing(true);
    setAnalyzingStep(1); // Start at step 1: Analyzing website
    setSuggestionError(null);
    
    // ==========================================================================
    // TIMER CLEANUP FIX (January 3rd, 2026)
    // 
    // BUG FIXED: Previously, timers were only cleared on the success path.
    // If fetch() or response.json() threw an exception, timers would continue
    // to fire, causing state updates after errors or component unmount.
    // 
    // FIX: Declare timer IDs outside try block, clear in finally block.
    // This ensures timers are ALWAYS cleaned up regardless of success/failure.
    // ==========================================================================
    let step2Timer: ReturnType<typeof setTimeout> | null = null;
    let step3Timer: ReturnType<typeof setTimeout> | null = null;
    
    try {
      // Simulate step progression for better UX
      // Step 1: Analyzing website (Firecrawl scraping)
      // The actual API call handles all steps, but we show progress
      
      // Move to step 2 after a short delay (simulates scraping completion)
      step2Timer = setTimeout(() => setAnalyzingStep(2), 2500);
      
      // Move to step 3 after more time (simulates AI processing)
      step3Timer = setTimeout(() => setAnalyzingStep(3), 5500);
      
      // Make the actual API call
      const response = await fetch('/api/suggestions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandUrl }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        // API returned an error - show user-friendly message
        setSuggestionError(data.userMessage || 'Failed to analyze website');
        return false;
      }
      
      // Success! Store the suggestions
      setSuggestedCompetitors(data.competitors || []);
      setSuggestedTopics(data.topics || []);
      
      console.log('[AI Suggestions] Generated:', {
        competitors: data.competitors?.length || 0,
        topics: data.topics?.length || 0,
        industry: data.industry,
      });
      
      return true;
      
    } catch (error) {
      console.error('[AI Suggestions] Error:', error);
      setSuggestionError('Something went wrong. Please enter your details manually.');
      return false;
    } finally {
      // Always clear timers to prevent state updates after error/unmount
      if (step2Timer) clearTimeout(step2Timer);
      if (step3Timer) clearTimeout(step3Timer);
    }
  };

  // ==========================================================================
  // SKIP AI SUGGESTIONS (January 3rd, 2026)
  // 
  // Called when user clicks "Continue & Enter Manually" on error screen.
  // Allows user to proceed to Step 2 without AI suggestions.
  // ==========================================================================
  const handleSkipSuggestions = () => {
    setIsAnalyzing(false);
    setSuggestionError(null);
    setStep(2);
  };

  // Helper to save progress to database
  const saveProgress = async (nextStep: number, additionalData?: Record<string, unknown>) => {
    try {
      await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          onboardingStep: nextStep,
          ...additionalData,
        }),
      });
    } catch (error) {
      console.error('Failed to save onboarding progress:', error);
    }
  };

  const handleContinue = async () => {
    if (step === 1) {
      if (!name || !role || !brand) return;
      
      // =======================================================================
      // DOMAIN VALIDATION + AI SUGGESTIONS (January 3rd, 2026)
      // 
      // Flow after Step 1:
      // 1. Validate domain format (regex) - already done on input change
      // 2. Validate domain reachability (HEAD request)
      // 3. Show AnalyzingScreen with animated progress
      // 4. Fetch AI suggestions (Firecrawl + OpenAI)
      // 5. Store suggestions in state for Steps 3 & 4
      // 6. Proceed to Step 2
      // 
      // If AI suggestions fail, user can still proceed with manual entry.
      // =======================================================================
      const isValid = await validateBrandDomain();
      if (!isValid) {
        return; // Don't proceed if domain validation failed
      }
      
      // Save step 1 data
      await saveProgress(2, { name, role, brand });
      
      // Start AI analysis (shows AnalyzingScreen)
      const suggestionsSuccess = await fetchAISuggestions(brand);
      
      if (suggestionsSuccess) {
        // AI suggestions fetched successfully - proceed to Step 2
        setIsAnalyzing(false);
        setStep(2);
      }
      // If failed, AnalyzingScreen shows error with "Continue Manually" button
      // User clicks that button -> handleSkipSuggestions() is called
      
    } else if (step === 2) {
      if (!targetCountry || !targetLanguage) return;
      // Save step 2 data and move to step 3
      await saveProgress(3, { targetCountry, targetLanguage });
      setStep(3);
    } else if (step === 3) {
      // Save step 3 data and move to step 4
      await saveProgress(4, { competitors });
      setStep(4);
    } else if (step === 4) {
      // Save step 4 data and move to step 5
      await saveProgress(5, { topics });
      setStep(5);
    } else if (step === 5) {
      // Save step 5 data and move to step 6 (Pricing)
      await saveProgress(6, { affiliateTypes });
      setStep(6);
    } else if (step === 6) {
      // User selected plan, move to step 7 (Card Details)
      // Enterprise users skip card entry
      if (selectedPlan === 'enterprise') {
        // For enterprise, just complete onboarding without card
        setIsLoading(true);
        try {
          await fetch('/api/users/onboarding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: userId,
              name,
              role,
              brand,
              targetCountry,
              targetLanguage,
              competitors,
              topics,
              affiliateTypes,
            }),
          });
          onComplete();
        } catch (error) {
          console.error('Onboarding failed', error);
        } finally {
          setIsLoading(false);
        }
        return;
      }
      await saveProgress(7, { plan: selectedPlan });
      setStep(7);
    }
    // Note: Step 7 (card submission) is handled by handleStripeSubmit below
  };

  // ==========================================================================
  // BACK BUTTON HANDLER (January 3rd, 2026)
  // 
  // Allows user to go back to previous steps with these constraints:
  // - Available on Steps 3, 4, 5 only
  // - Minimum step user can go back to is Step 2 (country/language)
  // - NOT available on Step 1 (first step), Step 2 (minimum), Step 6+ (pricing/payment)
  // 
  // This gives users flexibility to change their competitors/topics selections
  // without losing their progress, while preventing them from going back to
  // change their brand (which would require re-analyzing the website).
  // ==========================================================================
  const handleGoBack = () => {
    // Only allow going back on steps 3, 4, 5
    // Minimum step is 2 (can't go back to step 1 to change brand)
    if (step >= 3 && step <= 5) {
      setStep(step - 1);
    }
  };

  // Check if back button should be shown
  const showBackButton = step >= 3 && step <= 5 && !isAnalyzing && !isLoading;

  // ==========================================================================
  // STRIPE PAYMENT FLOW (Step 7)
  // 
  // This is called when user submits the card form. The flow is:
  // 1. Create SetupIntent on our server (gets clientSecret)
  // 2. Confirm card with Stripe (handles 3D Secure automatically)
  // 3. Create subscription with the PaymentMethod
  // 4. Complete onboarding
  //
  // SECURITY: Card data NEVER touches our server - handled entirely by Stripe
  // ==========================================================================
  const handleStripeSubmit = async (confirmSetup: (clientSecret: string, name: string) => Promise<{ success: boolean; paymentMethodId?: string; error?: string }>) => {
    if (!isCardReady || !cardholderName.trim()) {
      setStripeError('Please complete all card details');
      return;
    }

    setIsLoading(true);
    setStripeError(null);

    try {
      // Step 1: Create SetupIntent to securely collect card
      console.log('[Stripe] Creating SetupIntent...');
      const setupRes = await fetch('/api/stripe/create-setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email: userEmail,
        }),
      });

      if (!setupRes.ok) {
        const errorData = await setupRes.json();
        throw new Error(errorData.error || 'Failed to initialize payment');
      }

      const { clientSecret, customerId } = await setupRes.json();
      console.log('[Stripe] SetupIntent created, confirming card...');

      // Step 2: Confirm card setup with Stripe (handles 3D Secure)
      const setupResult = await confirmSetup(clientSecret, cardholderName);

      if (!setupResult.success || !setupResult.paymentMethodId) {
        throw new Error(setupResult.error || 'Card verification failed');
      }

      console.log('[Stripe] Card verified, creating subscription...');

      // Step 3: Create subscription with the verified PaymentMethod
      const subscriptionRes = await fetch('/api/stripe/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          plan: selectedPlan,
          billingInterval,
          paymentMethodId: setupResult.paymentMethodId,
          customerId,
        }),
      });

      if (!subscriptionRes.ok) {
        const errorData = await subscriptionRes.json();
        throw new Error(errorData.error || 'Failed to create subscription');
      }

      const subscriptionData = await subscriptionRes.json();
      console.log('[Stripe] Subscription created:', subscriptionData.subscription?.id);

      // Step 4: Complete onboarding data
      const onboardingRes = await fetch('/api/users/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          name,
          role,
          brand,
          targetCountry,
          targetLanguage,
          competitors,
          topics,
          affiliateTypes,
        }),
      });

      if (!onboardingRes.ok) {
        // CRITICAL: Onboarding data must be saved for the user to have a complete profile.
        // If this fails, throw an error to prevent marking user as onboarded.
        // The subscription is already created, but we cannot proceed without profile data.
        // Fixed December 2025 - previously this would silently continue and leave user in inconsistent state.
        const onboardingError = await onboardingRes.json().catch(() => ({}));
        console.error('[Stripe] Onboarding data save failed:', onboardingError);
        throw new Error(onboardingError.error || 'Failed to save your profile information. Please try again.');
      }

      // Success - both subscription and onboarding data saved successfully!
      onComplete();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed. Please try again.';
      console.error('[Stripe] Payment flow error:', error);
      setStripeError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Helpers
  const toggleCompetitor = (domain: string) => {
    if (competitors.includes(domain)) {
      setCompetitors(competitors.filter(c => c !== domain));
    } else {
      if (competitors.length >= 5) return;
      setCompetitors([...competitors, domain]);
    }
  };

  const addCustomCompetitor = () => {
    if (!competitorInput.trim()) return;
    if (competitors.includes(competitorInput.trim())) {
       setCompetitorInput('');
       return;
    }
    if (competitors.length >= 5) return;
    
    setCompetitors([...competitors, competitorInput.trim()]);
    setCompetitorInput('');
  };

  const toggleTopic = (topic: string) => {
    if (topics.includes(topic)) {
      setTopics(topics.filter(t => t !== topic));
    } else {
      if (topics.length >= 10) return;
      setTopics([...topics, topic]);
    }
  };

  const addCustomTopic = () => {
    if (!topicInput.trim()) return;
    if (topics.includes(topicInput.trim())) {
       setTopicInput('');
       return;
    }
    if (topics.length >= 10) return;
    
    setTopics([...topics, topicInput.trim()]);
    setTopicInput('');
  };

  const toggleAffiliateType = (type: string) => {
    if (affiliateTypes.includes(type)) {
      setAffiliateTypes(affiliateTypes.filter(t => t !== type));
    } else {
      setAffiliateTypes([...affiliateTypes, type]);
    }
  };

  // ==========================================================================
  // ANALYZING SCREEN RENDERER (January 3rd, 2026)
  // 
  // Shows the AnalyzingScreen component while fetching AI suggestions.
  // Displays animated progress through 3 steps:
  // 1. Analyzing your website (Firecrawl scraping)
  // 2. Understanding your products (OpenAI processing)
  // 3. Finding your competitors (Domain validation)
  // 
  // On error, shows "Continue & Enter Manually" button.
  // ==========================================================================
  const renderAnalyzingScreen = () => (
    <AnalyzingScreen
      currentStep={analyzingStep}
      brandName={brand}
      error={suggestionError}
      onSkip={handleSkipSuggestions}
    />
  );

  // ==========================================================================
  // STEP 1: NAME/ROLE/BRAND - NEO-BRUTALIST (Updated January 9th, 2026)
  // 
  // Design changes applied:
  // - Added header with logo and progress bar (matches Steps 2-5)
  // - Sharp edges on all inputs (removed rounded-xl)
  // - Bold borders (border-2 border-gray-300 dark:border-gray-600)
  // - Dark mode support throughout
  // - Neo-brutalist dropdown with offset shadow
  // - Updated typography (font-bold labels)
  // ==========================================================================
  const renderStep1 = () => (
    <div className="animate-in slide-in-from-right-8 duration-500">
      {/* Header - NEO-BRUTALIST (January 9th, 2026) */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-[#1A1D21] flex items-center justify-center text-[#ffbf23] border border-black dark:border-gray-600">
            <Sparkles size={10} fill="currentColor" className="opacity-90" />
          </div>
          <span className="font-black text-sm tracking-tight text-gray-900 dark:text-white">CrewCast<span className="text-[#1A1D21] dark:text-[#ffbf23]">Studio</span></span>
        </div>
        <span className="text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wide">Getting Started</span>
      </div>

      {/* Progress Bar - NEO-BRUTALIST (January 9th, 2026) */}
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div 
            key={i} 
            className={cn(
              "h-1.5 flex-1 transition-all duration-500",
              i <= 0 ? "bg-[#ffbf23]" : "bg-gray-200 dark:bg-gray-700"
            )} 
          />
        ))}
      </div>

      {/* Welcome Text - NEO-BRUTALIST (January 9th, 2026) */}
      <div className="text-center mb-5">
        <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wide mb-1">
          Thanks for joining CrewCast Studio
        </p>
        <h1 className="text-xl md:text-2xl text-gray-900 dark:text-white font-black tracking-tight">
          Let&apos;s get to know each other
        </h1>
      </div>

      <div className="space-y-4">
        {/* Name Input - NEO-BRUTALIST (January 9th, 2026) */}
        <div className="space-y-1.5">
          <label className="text-gray-900 dark:text-white font-bold text-xs uppercase tracking-wide">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:border-[#ffbf23] transition-all text-sm placeholder:text-gray-400"
            placeholder="Enter your full name"
          />
        </div>

        {/* Role Dropdown - NEO-BRUTALIST (January 9th, 2026) */}
        <div className="space-y-1.5 relative" ref={roleDropdownRef}>
          <label className="text-gray-900 dark:text-white font-bold text-xs uppercase tracking-wide">What&apos;s your role</label>
          <button
            type="button"
            onClick={() => {
              setIsRoleDropdownOpen(!isRoleDropdownOpen);
              setRoleSearch('');
              setTimeout(() => roleSearchRef.current?.focus(), 100);
            }}
            className={cn(
              "w-full px-3.5 py-2.5 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-left flex items-center justify-between focus:outline-none focus:border-[#ffbf23] transition-all text-sm",
              !role ? "text-gray-400" : "text-gray-900 dark:text-white"
            )}
          >
            {role || "Select your role"}
            <ChevronDown className={cn("text-gray-400 transition-transform", isRoleDropdownOpen && "rotate-180")} size={16} />
          </button>

          {/* Role Dropdown Menu - NEO-BRUTALIST (January 9th, 2026) */}
          {isRoleDropdownOpen && (
            <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_#000000] dark:shadow-[4px_4px_0px_0px_#333333] z-50 overflow-hidden">
              {/* Search Input */}
              <div className="p-2 border-b-2 border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    ref={roleSearchRef}
                    type="text"
                    value={roleSearch}
                    onChange={(e) => setRoleSearch(e.target.value)}
                    placeholder="Search roles..."
                    className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 focus:outline-none focus:border-[#ffbf23] text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              {/* Options */}
              <div className="max-h-44 overflow-y-auto scrollbar-hide py-1">
                {roles.filter(r => r.toLowerCase().includes(roleSearch.toLowerCase())).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setRole(r);
                      setIsRoleDropdownOpen(false);
                      setRoleSearch('');
                    }}
                    className="w-full text-left px-3.5 py-2 text-gray-600 dark:text-gray-300 hover:bg-[#ffbf23]/20 hover:text-gray-900 dark:hover:text-white transition-colors text-sm flex items-center justify-between group"
                  >
                    {r}
                    {role === r && <Check size={14} className="text-[#ffbf23]" />}
                  </button>
                ))}
                {roles.filter(r => r.toLowerCase().includes(roleSearch.toLowerCase())).length === 0 && (
                  <p className="px-3.5 py-2 text-sm text-gray-400">No results found</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Brand Input - NEO-BRUTALIST (January 9th, 2026)
            Domain validation provides two levels of feedback:
            1. Instant format validation (regex) - shows red/green border
            2. Server reachability validation (on Continue) - shows loading/error */}
        <div className="space-y-1.5">
          <label className="text-gray-900 dark:text-white font-bold text-xs uppercase tracking-wide">Which brand do you want to find affiliates for?</label>
          <div className="relative">
            <input
              type="text"
              value={brand}
              onChange={(e) => handleBrandChange(e.target.value)}
              disabled={isBrandValidating}
              className={cn(
                "w-full px-3.5 py-2.5 bg-white dark:bg-gray-900 border-2 text-gray-900 dark:text-white focus:outline-none transition-all text-sm pr-10",
                // Dynamic border color based on validation state (January 9th, 2026)
                brandError 
                  ? "border-red-500 focus:border-red-500"
                  : brandFormatValid === false
                    ? "border-amber-500 focus:border-amber-500"
                    : brandValidated
                      ? "border-green-500 focus:border-green-500"
                      : "border-gray-300 dark:border-gray-600 focus:border-[#ffbf23]",
                isBrandValidating && "opacity-70 cursor-not-allowed"
              )}
              placeholder="e.g. guffles.com"
            />
            {/* Validation status indicator */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isBrandValidating ? (
                <Loader2 size={16} className="animate-spin text-gray-400" />
              ) : brandValidated ? (
                <Check size={16} className="text-green-500" />
              ) : brandFormatValid === false && brand.trim() ? (
                <X size={16} className="text-amber-500" />
              ) : null}
            </div>
          </div>
          
          {/* Error message */}
          {brandError && (
            <p className="text-red-500 text-xs font-bold px-1 pt-0.5 flex items-center gap-1">
              <X size={12} />
              {brandError}
            </p>
          )}
          
          {/* Format hint (shown only when format is invalid) */}
          {brandFormatValid === false && brand.trim() && !brandError && (
            <p className="text-amber-500 text-xs font-medium px-1 pt-0.5">
              Enter a valid domain format (e.g., example.com)
            </p>
          )}
          
          {/* Helper text */}
          <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed px-1 pt-0.5">
            For agencies, this should be your client&apos;s website, not your own.
          </p>
        </div>
      </div>
    </div>
  );

  // ==========================================================================
  // STEP 2: COUNTRY/LANGUAGE - NEO-BRUTALIST (Updated January 9th, 2026)
  // 
  // Design changes applied:
  // - Sharp edges on all dropdowns (removed rounded-full, rounded-xl, rounded-lg)
  // - Bold borders (border-2 border-gray-300 dark:border-gray-600)
  // - Neo-brutalist dropdown menus with offset shadow
  // - Sharp progress bar segments
  // - Dark mode support throughout
  // - Updated icon containers to sharp edges
  // ==========================================================================
  const renderStep2 = () => (
    <div className="animate-in slide-in-from-right-8 duration-500">
      {/* Header - NEO-BRUTALIST (January 9th, 2026) */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-[#1A1D21] flex items-center justify-center text-[#ffbf23] border border-black dark:border-gray-600">
            <Sparkles size={10} fill="currentColor" className="opacity-90" />
          </div>
          <span className="font-black text-sm tracking-tight text-gray-900 dark:text-white">CrewCast<span className="text-[#1A1D21] dark:text-[#ffbf23]">Studio</span></span>
        </div>
        <span className="text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wide">Step 1 of 5</span>
      </div>

      {/* Progress Bar - NEO-BRUTALIST sharp edges (January 9th, 2026) */}
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div 
            key={i} 
            className={cn(
              "h-1.5 flex-1 transition-all duration-500",
              i <= 1 ? "bg-[#ffbf23]" : "bg-gray-200 dark:bg-gray-700"
            )} 
          />
        ))}
      </div>

      {/* Question Block - NEO-BRUTALIST (January 9th, 2026) */}
      <div className="space-y-4">
        <div className="flex gap-2 items-center">
          <div className="w-6 h-6 bg-[#ffbf23]/20 flex items-center justify-center shrink-0 text-[#1A1D21] dark:text-[#ffbf23] border border-[#ffbf23]/30">
            <Globe size={12} />
          </div>
          <p className="text-gray-900 dark:text-white font-bold text-sm">
            Target market
          </p>
        </div>

        {/* Country Dropdown - NEO-BRUTALIST (January 9th, 2026) */}
        <div className="space-y-1.5 relative" ref={countryDropdownRef}>
          <label className="text-gray-900 dark:text-white font-bold text-xs uppercase tracking-wide">Country</label>
          <button
            type="button"
            onClick={() => {
              setIsCountryDropdownOpen(!isCountryDropdownOpen);
              setCountrySearch('');
              setTimeout(() => countrySearchRef.current?.focus(), 100);
            }}
            className={cn(
              "w-full px-4 py-2.5 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-left flex items-center justify-between focus:outline-none focus:border-[#ffbf23] transition-all text-sm",
              !targetCountry ? "text-gray-400" : "text-gray-900 dark:text-white"
            )}
          >
            {targetCountry ? (
              <span className="flex items-center gap-2">
                <img 
                  src={getFlagUrl(countries.find(c => c.name === targetCountry)?.code || '')} 
                  alt="" 
                  className="w-5 h-auto"
                />
                <span>{targetCountry}</span>
              </span>
            ) : "Select your target country..."}
            <ChevronDown className={cn("text-gray-400 transition-transform", isCountryDropdownOpen && "rotate-180")} size={14} />
          </button>
          
          {/* Country Dropdown Menu - NEO-BRUTALIST (January 9th, 2026) */}
          {isCountryDropdownOpen && (
            <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_#000000] dark:shadow-[4px_4px_0px_0px_#333333] z-50 overflow-hidden">
              {/* Search Input */}
              <div className="p-2 border-b-2 border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    ref={countrySearchRef}
                    type="text"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    placeholder="Search countries..."
                    className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 focus:outline-none focus:border-[#ffbf23] text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              {/* Options - Flag images from flagcdn.com */}
              <div className="max-h-44 overflow-y-auto scrollbar-hide py-1">
                {countries.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase())).map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      setTargetCountry(c.name);
                      setIsCountryDropdownOpen(false);
                      setCountrySearch('');
                    }}
                    className="w-full text-left px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-[#ffbf23]/20 hover:text-gray-900 dark:hover:text-white transition-colors text-sm flex items-center justify-between group"
                  >
                    <span className="flex items-center gap-2">
                      <img src={getFlagUrl(c.code)} alt="" className="w-5 h-auto" />
                      <span>{c.name}</span>
                    </span>
                    {targetCountry === c.name && <Check size={14} className="text-[#ffbf23]" />}
                  </button>
                ))}
                {countries.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase())).length === 0 && (
                  <p className="px-4 py-2 text-sm text-gray-400">No results found</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Language Dropdown - NEO-BRUTALIST (January 9th, 2026) */}
        <div className="space-y-1.5 relative" ref={langDropdownRef}>
          <label className="text-gray-900 dark:text-white font-bold text-xs uppercase tracking-wide">Target Language</label>
          <button
            type="button"
            onClick={() => {
              setIsLangDropdownOpen(!isLangDropdownOpen);
              setLangSearch('');
              setTimeout(() => langSearchRef.current?.focus(), 100);
            }}
            className={cn(
              "w-full px-4 py-2.5 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-left flex items-center justify-between focus:outline-none focus:border-[#ffbf23] transition-all text-sm",
              !targetLanguage ? "text-gray-400" : "text-gray-900 dark:text-white"
            )}
          >
            {targetLanguage ? (
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                  {languages.find(l => l.name === targetLanguage)?.symbol}
                </span>
                <span>{targetLanguage}</span>
              </span>
            ) : "Select your target language..."}
            <ChevronDown className={cn("text-gray-400 transition-transform", isLangDropdownOpen && "rotate-180")} size={14} />
          </button>
          
          {/* Language Dropdown Menu - NEO-BRUTALIST (January 9th, 2026) */}
          {isLangDropdownOpen && (
            <div className="absolute bottom-[calc(100%+4px)] left-0 w-full bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_#000000] dark:shadow-[4px_4px_0px_0px_#333333] z-50 overflow-hidden">
              {/* Options first (dropdown opens upward) - Native script symbols */}
              <div className="max-h-44 overflow-y-auto scrollbar-hide py-1">
                {languages.filter(l => l.name.toLowerCase().includes(langSearch.toLowerCase())).map((l) => (
                  <button
                    key={l.name}
                    type="button"
                    onClick={() => {
                      setTargetLanguage(l.name);
                      setIsLangDropdownOpen(false);
                      setLangSearch('');
                    }}
                    className="w-full text-left px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-[#ffbf23]/20 hover:text-gray-900 dark:hover:text-white transition-colors text-sm flex items-center justify-between group"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="w-6 h-6 bg-gray-100 dark:bg-gray-800 group-hover:bg-[#ffbf23]/30 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-400 transition-colors border border-gray-200 dark:border-gray-700">
                        {l.symbol}
                      </span>
                      <span>{l.name}</span>
                    </span>
                    {targetLanguage === l.name && <Check size={14} className="text-[#ffbf23]" />}
                  </button>
                ))}
                {languages.filter(l => l.name.toLowerCase().includes(langSearch.toLowerCase())).length === 0 && (
                  <p className="px-4 py-2 text-sm text-gray-400">No results found</p>
                )}
              </div>
              {/* Search Input at bottom (dropdown opens upward) */}
              <div className="p-2 border-t-2 border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    ref={langSearchRef}
                    type="text"
                    value={langSearch}
                    onChange={(e) => setLangSearch(e.target.value)}
                    placeholder="Search languages..."
                    className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 focus:outline-none focus:border-[#ffbf23] text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ==========================================================================
  // STEP 3: COMPETITORS - NEO-BRUTALIST (Updated January 9th, 2026)
  // 
  // Design changes applied:
  // - Sharp edges on input and add button (removed rounded-full)
  // - Sharp edges on suggestion cards and selected cards (removed rounded-lg)
  // - Bold borders (border-2 border-gray-300 dark:border-gray-600)
  // - Dark mode support throughout
  // - Sharp progress bar segments
  // - Updated empty state to neo-brutalist style
  // ==========================================================================
  const renderStep3 = () => (
    <div className="animate-in slide-in-from-right-8 duration-500">
      {/* Header - NEO-BRUTALIST (January 9th, 2026) */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-[#1A1D21] flex items-center justify-center text-[#ffbf23] border border-black dark:border-gray-600">
            <Sparkles size={10} fill="currentColor" className="opacity-90" />
          </div>
          <span className="font-black text-sm tracking-tight text-gray-900 dark:text-white">CrewCast<span className="text-[#1A1D21] dark:text-[#ffbf23]">Studio</span></span>
        </div>
        <span className="text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wide">Step 2 of 5</span>
      </div>

      {/* Progress Bar - NEO-BRUTALIST sharp edges (January 9th, 2026) */}
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div 
            key={i} 
            className={cn(
              "h-1.5 flex-1 transition-all duration-500",
              i <= 2 ? "bg-[#ffbf23]" : "bg-gray-200 dark:bg-gray-700"
            )} 
          />
        ))}
      </div>

      {/* Question Block - NEO-BRUTALIST (January 9th, 2026) */}
      <div className="space-y-4">
        <div className="flex gap-2 items-center">
          <div className="w-6 h-6 bg-[#ffbf23]/20 flex items-center justify-center shrink-0 text-[#1A1D21] dark:text-[#ffbf23] border border-[#ffbf23]/30">
            <Sparkles size={12} />
          </div>
          <p className="text-gray-900 dark:text-white font-bold text-sm">
            Add your top 5 competitors
          </p>
        </div>

        {/* Competitor Input - NEO-BRUTALIST (January 9th, 2026) */}
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <input 
              type="text"
              value={competitorInput}
              onChange={(e) => setCompetitorInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomCompetitor())}
              placeholder="e.g. competitor.com"
              className="flex-1 px-4 py-2 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#ffbf23] transition-all placeholder:text-gray-400"
            />
            <button 
              type="button"
              onClick={addCustomCompetitor}
              disabled={!competitorInput.trim() || competitors.length >= 5}
              className="w-9 h-9 bg-[#ffbf23] text-[#1A1D21] border-2 border-black dark:border-gray-600 hover:bg-yellow-400 flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[2px_2px_0px_0px_#000000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
            >
              <Plus size={16} />
            </button>
          </div>
          
          <p className="text-[11px] text-gray-400 dark:text-gray-500 ml-1 font-medium">
            {competitors.length}/5 added
          </p>
        </div>

        {/* =================================================================
          AI SUGGESTIONS DISPLAY (January 3rd, 2026)
          Updated to NEO-BRUTALIST (January 9th, 2026)
          
          Shows AI-generated competitor suggestions if available.
          User can click to add/remove suggestions.
          Suggestions come from /api/suggestions/generate endpoint.
          ================================================================= */}
        
        {/* AI Suggested Competitors - NEO-BRUTALIST (January 9th, 2026) */}
        {suggestedCompetitors.length > 0 && (
          <div className="space-y-2">
            <p className="text-gray-600 dark:text-gray-400 text-xs font-bold flex items-center gap-1 uppercase tracking-wide">
              <Sparkles size={10} className="text-[#ffbf23]" />
              Suggestions for you:
            </p>
            
            <div className="grid grid-cols-3 gap-1.5 max-h-[120px] overflow-y-auto scrollbar-hide">
              {suggestedCompetitors
                .filter(comp => !competitors.includes(comp.domain))
                .slice(0, 12)
                .map(comp => (
                  <button
                    key={comp.domain}
                    type="button"
                    onClick={() => toggleCompetitor(comp.domain)}
                    disabled={competitors.length >= 5}
                    className={cn(
                      "group relative flex items-center gap-2 p-2 border-2 text-left transition-all",
                      competitors.length >= 5
                        ? "border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed"
                        : "border-gray-200 dark:border-gray-700 hover:border-[#ffbf23] hover:bg-[#ffbf23]/10"
                    )}
                  >
                    {/* Favicon - NEO-BRUTALIST (January 9th, 2026) */}
                    <div className="w-6 h-6 bg-white dark:bg-gray-800 flex items-center justify-center shrink-0 overflow-hidden border border-gray-200 dark:border-gray-700">
                      <img 
                        src={`https://www.google.com/s2/favicons?domain=${comp.domain}&sz=32`}
                        alt={comp.name}
                        className="w-4 h-4 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <span className="hidden text-[10px] font-bold text-gray-400">
                        {comp.name[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate">{comp.name}</p>
                      <p className="text-[9px] text-gray-400 truncate">{comp.domain}</p>
                    </div>
                    <Plus size={12} className="text-gray-300 group-hover:text-[#ffbf23] transition-colors shrink-0" />
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Selected Competitors - NEO-BRUTALIST (January 9th, 2026) */}
        {competitors.length > 0 && (
          <div className="space-y-2">
            <p className="text-gray-600 dark:text-gray-400 text-xs font-bold uppercase tracking-wide">Your competitors:</p>
            
            <div className="grid grid-cols-3 gap-1.5 max-h-[120px] overflow-y-auto scrollbar-hide">
              {competitors.map(comp => {
                const suggestion = suggestedCompetitors.find(s => s.domain === comp);
                const displayName = suggestion?.name || comp;
                
                return (
                  <button
                    key={comp}
                    type="button"
                    onClick={() => toggleCompetitor(comp)}
                    className="group relative flex items-center gap-2 p-2 bg-[#ffbf23]/10 border-2 border-[#ffbf23] text-left transition-all hover:bg-[#ffbf23]/20"
                  >
                    {/* Favicon - NEO-BRUTALIST (January 9th, 2026) */}
                    <div className="w-6 h-6 bg-white dark:bg-gray-800 flex items-center justify-center shrink-0 overflow-hidden border border-[#ffbf23]/30">
                      <img 
                        src={`https://www.google.com/s2/favicons?domain=${comp}&sz=32`}
                        alt={displayName}
                        className="w-4 h-4 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <span className="hidden text-[10px] font-bold text-gray-400">
                        {displayName[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-gray-900 dark:text-white truncate">{displayName}</p>
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 truncate">{comp}</p>
                    </div>
                    <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={10} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Empty state - NEO-BRUTALIST (January 9th, 2026) */}
        {competitors.length === 0 && suggestedCompetitors.length === 0 && (
          <div className="p-4 bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Enter competitor domains above (e.g., competitor.com)
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // ==========================================================================
  // STEP 4: TOPICS - NEO-BRUTALIST (Updated January 9th, 2026)
  // 
  // Design changes applied:
  // - Sharp edges on input and add button (removed rounded-full)
  // - Sharp edges on topic pills (removed rounded-full, rounded-md)
  // - Bold borders (border-2 border-gray-300 dark:border-gray-600)
  // - Dark mode support throughout
  // - Sharp progress bar segments
  // - Updated empty state to neo-brutalist style
  // ==========================================================================
  const renderStep4 = () => (
    <div className="animate-in slide-in-from-right-8 duration-500">
      {/* Header - NEO-BRUTALIST (January 9th, 2026) */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-[#1A1D21] flex items-center justify-center text-[#ffbf23] border border-black dark:border-gray-600">
            <Sparkles size={10} fill="currentColor" className="opacity-90" />
          </div>
          <span className="font-black text-sm tracking-tight text-gray-900 dark:text-white">CrewCast<span className="text-[#1A1D21] dark:text-[#ffbf23]">Studio</span></span>
        </div>
        <span className="text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wide">Step 3 of 5</span>
      </div>

      {/* Progress Bar - NEO-BRUTALIST sharp edges (January 9th, 2026) */}
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div 
            key={i} 
            className={cn(
              "h-1.5 flex-1 transition-all duration-500",
              i <= 3 ? "bg-[#ffbf23]" : "bg-gray-200 dark:bg-gray-700"
            )} 
          />
        ))}
      </div>

      {/* Question Block - NEO-BRUTALIST (January 9th, 2026) */}
      <div className="space-y-4">
        <div className="flex gap-2 items-center">
          <div className="w-6 h-6 bg-[#ffbf23]/20 flex items-center justify-center shrink-0 text-[#1A1D21] dark:text-[#ffbf23] border border-[#ffbf23]/30">
            <MessageSquare size={12} />
          </div>
          <p className="text-gray-900 dark:text-white font-bold text-sm">
            What topics do you cover?
          </p>
        </div>

        {/* Topic Input - NEO-BRUTALIST (January 9th, 2026) */}
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <input 
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTopic())}
              placeholder="e.g. best CRMs, skincare..."
              className="flex-1 px-4 py-2 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#ffbf23] transition-all placeholder:text-gray-400"
            />
            <button 
              type="button"
              onClick={addCustomTopic}
              disabled={!topicInput.trim() || topics.length >= 10}
              className="w-9 h-9 bg-[#ffbf23] text-[#1A1D21] border-2 border-black dark:border-gray-600 hover:bg-yellow-400 flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[2px_2px_0px_0px_#000000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
            >
              <Plus size={16} />
            </button>
          </div>
          
          <p className="text-[11px] text-gray-400 dark:text-gray-500 ml-1 font-medium">
            {topics.length}/10 added
          </p>
        </div>

        {/* =================================================================
          AI SUGGESTIONS DISPLAY (January 3rd, 2026)
          Updated to NEO-BRUTALIST (January 9th, 2026)
          
          Shows AI-generated topic suggestions if available.
          User can click to add/remove suggestions.
          Suggestions come from /api/suggestions/generate endpoint.
          ================================================================= */}
        
        {/* AI Suggested Topics - NEO-BRUTALIST (January 9th, 2026) */}
        {suggestedTopics.length > 0 && (
          <div className="space-y-2">
            <p className="text-gray-600 dark:text-gray-400 text-xs font-bold flex items-center gap-1 uppercase tracking-wide">
              <Sparkles size={10} className="text-[#ffbf23]" />
              Suggestions for you:
            </p>
            
            <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto scrollbar-hide">
              {suggestedTopics
                .filter(t => !topics.includes(t.keyword))
                .slice(0, 10)
                .map(t => (
                  <button
                    key={t.keyword}
                    type="button"
                    onClick={() => toggleTopic(t.keyword)}
                    disabled={topics.length >= 10}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 border-2 text-[11px] transition-all",
                      topics.length >= 10
                        ? "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#ffbf23] hover:bg-[#ffbf23]/10 hover:text-gray-900 dark:hover:text-white"
                    )}
                  >
                    {t.keyword}
                    <Plus size={10} className="text-gray-300" />
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Selected Topics - NEO-BRUTALIST (January 9th, 2026) */}
        {topics.length > 0 && (
          <div className="space-y-2">
            <p className="text-gray-600 dark:text-gray-400 text-xs font-bold uppercase tracking-wide">Your topics:</p>
            
            <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto scrollbar-hide">
              {topics.map(topic => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => toggleTopic(topic)}
                  className="group relative flex items-center gap-1.5 px-3 py-1.5 bg-[#ffbf23]/10 border-2 border-[#ffbf23] text-[11px] font-bold text-[#1A1D21] dark:text-[#ffbf23] transition-all text-left hover:bg-[#ffbf23]/20"
                >
                  {topic}
                  <div className="w-3.5 h-3.5 bg-[#ffbf23]/30 text-[#1A1D21] flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-colors">
                    <X size={8} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Empty state - NEO-BRUTALIST (January 9th, 2026) */}
        {topics.length === 0 && suggestedTopics.length === 0 && (
          <div className="p-4 bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Enter topics you cover above (e.g., &quot;best CRMs&quot;, &quot;skincare routines&quot;)
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // ==========================================================================
  // STEP 5: AFFILIATE TYPES - NEO-BRUTALIST (Updated January 9th, 2026)
  // 
  // Design changes applied:
  // - Sharp edges on all type buttons (removed rounded-lg, rounded)
  // - Bold borders (border-2 border-gray-300 dark:border-gray-600)
  // - Dark mode support throughout
  // - Sharp progress bar segments
  // - Sharp checkbox indicators
  // ==========================================================================
  const renderStep5 = () => (
    <div className="animate-in slide-in-from-right-8 duration-500">
      {/* Header - NEO-BRUTALIST (January 9th, 2026) */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-[#1A1D21] flex items-center justify-center text-[#ffbf23] border border-black dark:border-gray-600">
            <Sparkles size={10} fill="currentColor" className="opacity-90" />
          </div>
          <span className="font-black text-sm tracking-tight text-gray-900 dark:text-white">CrewCast<span className="text-[#1A1D21] dark:text-[#ffbf23]">Studio</span></span>
        </div>
        <span className="text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wide">Step 4 of 5</span>
      </div>

      {/* Progress Bar - NEO-BRUTALIST sharp edges (January 9th, 2026) */}
      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div 
            key={i} 
            className={cn(
              "h-1.5 flex-1 transition-all duration-500",
              i <= 4 ? "bg-[#ffbf23]" : "bg-gray-200 dark:bg-gray-700"
            )} 
          />
        ))}
      </div>

      {/* Question Block - NEO-BRUTALIST (January 9th, 2026) */}
      <div className="space-y-4">
        <div className="flex gap-2 items-center">
          <div className="w-6 h-6 bg-[#ffbf23]/20 flex items-center justify-center shrink-0 text-[#1A1D21] dark:text-[#ffbf23] border border-[#ffbf23]/30">
            <MousePointerClick size={12} />
          </div>
          <p className="text-gray-900 dark:text-white font-bold text-sm">
            What types of affiliates do you want?
          </p>
        </div>

        {/* Affiliate Types Grid - NEO-BRUTALIST (January 9th, 2026) */}
        <div className="grid grid-cols-2 gap-1.5">
          {AFFILIATE_TYPES.map((type) => {
            const isSelected = affiliateTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleAffiliateType(type)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 border-2 text-sm font-bold transition-all text-left group",
                  isSelected 
                    ? "bg-[#ffbf23]/10 border-[#ffbf23] text-gray-900 dark:text-white" 
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                {/* Checkbox indicator - NEO-BRUTALIST sharp edges (January 9th, 2026) */}
                <div className={cn(
                  "w-3.5 h-3.5 border-2 flex items-center justify-center transition-colors",
                  isSelected 
                    ? "bg-[#ffbf23] border-[#ffbf23] text-[#1A1D21]" 
                    : "border-gray-300 dark:border-gray-600 group-hover:border-[#ffbf23]"
                )}>
                  {isSelected && <Check size={8} strokeWidth={3} />}
                </div>
                <span className="truncate text-[13px]">{type}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div className="animate-in slide-in-from-right-8 duration-500">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-lg text-slate-900 font-bold tracking-tight mb-1">
          Choose your plan
        </h1>
        <p className="text-slate-500 text-xs mb-3">
          Start with a <span className="font-semibold text-[#1A1D21]">3-day free trial</span> • Cancel anytime
        </p>

        {/* Billing Toggle */}
        <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setBillingInterval('monthly')}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-bold transition-all",
              billingInterval === 'monthly' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval('annual')}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5",
              billingInterval === 'annual' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Annual
            <span className="bg-[#ffbf23]/20 text-[#1A1D21] text-[9px] font-extrabold px-1 py-0.5 rounded uppercase">-20%</span>
          </button>
        </div>
      </div>

      {/* Pricing Grid - 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PRICING_PLANS.map((plan) => {
          const price = billingInterval === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
          const isSelected = selectedPlan === plan.id;
          const isPopular = plan.popular;
          const isEnterprise = plan.id === 'enterprise';

  return (
            <button
              key={plan.id}
              type="button"
              onClick={() => !isEnterprise && setSelectedPlan(plan.id)}
              disabled={isEnterprise}
              className={cn(
                "relative rounded-lg bg-white flex flex-col text-left transition-all",
                isPopular 
                  ? "border-2 border-[#ffbf23] shadow-md shadow-[#ffbf23]/10" 
                  : "border border-slate-200 shadow-sm",
                isSelected && !isEnterprise && "ring-2 ring-[#1A1D21] ring-offset-1",
                isEnterprise && "opacity-70 cursor-not-allowed"
              )}
            >
              {isPopular && (
                <div className="absolute -top-2.5 left-0 right-0 flex justify-center">
                  <div className="bg-[#1A1D21] text-[#ffbf23] text-[9px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                    <Star size={8} fill="currentColor" />
                    Best Value
                  </div>
                </div>
              )}

              <div className="p-3 flex-1 flex flex-col">
                <div className="mb-2">
                  <h3 className={cn("text-sm font-bold", isPopular ? "text-[#1A1D21]" : "text-slate-900")}>
                    {plan.name}
                  </h3>
                  <p className="text-[10px] text-slate-500 leading-snug line-clamp-2">{plan.description}</p>
                </div>

                <div className="mb-2">
                  <div className="flex items-baseline gap-0.5">
                    {plan.priceLabel ? (
                      <span className="text-xl font-bold text-slate-900">{plan.priceLabel}</span>
                    ) : (
                      <>
                        <span className="text-xl font-bold text-slate-900">{CURRENCY_SYMBOL}{price}</span>
                        <span className="text-slate-400 text-xs font-medium">/mo</span>
                      </>
                    )}
                  </div>
                  {!plan.priceLabel && billingInterval === 'annual' && (
                    <p className="text-[9px] text-[#1A1D21] font-medium">Billed {CURRENCY_SYMBOL}{price! * 12}/yr</p>
                  )}
                </div>

                {/* Select indicator */}
                <div className={cn(
                  "w-full py-1.5 rounded-md text-[10px] font-bold mb-2 transition-all flex items-center justify-center gap-1",
                  isSelected && !isEnterprise
                    ? "bg-[#ffbf23] text-[#1A1D21]"
                    : isPopular 
                      ? "bg-[#1A1D21]/10 text-[#1A1D21]"
                      : "bg-slate-100 text-slate-600"
                )}>
                  {isEnterprise ? (
                    "Contact Sales"
                  ) : isSelected ? (
                    <>
                      <Check size={10} strokeWidth={3} />
                      Selected
                    </>
                  ) : (
                    "Select Plan"
                  )}
                </div>

                <div className="space-y-1 flex-1">
                  <p className="text-[9px] font-bold text-slate-900 uppercase tracking-wider mb-1">Included:</p>
                  {plan.features.slice(0, 5).map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <div className={cn(
                        "mt-0.5 w-3 h-3 rounded-full flex items-center justify-center shrink-0",
                        isPopular ? "bg-[#1A1D21] text-[#ffbf23]" : "bg-slate-100 text-slate-600"
                      )}>
                        <Check size={6} strokeWidth={4} />
                      </div>
                      <span className="text-[10px] text-slate-600 leading-tight">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ==========================================================================
  // STEP 7: STRIPE CARD INPUT (PCI Compliant)
  //
  // This uses Stripe Elements - card data NEVER touches our servers.
  // Step7CardForm is extracted as a separate component to prevent re-mounting
  // on every parent render (which would cause input focus issues).
  // ==========================================================================

  // Get selected plan info for Step 7
  const selectedPlanInfo = PRICING_PLANS.find(p => p.id === selectedPlan);
  const selectedPlanPrice = billingInterval === 'monthly' 
    ? selectedPlanInfo?.monthlyPrice || 0 
    : selectedPlanInfo?.annualPrice || 0;

  // ==========================================================================
  // DISCOUNT CODE VALIDATION (January 3rd, 2026)
  // 
  // TODO: Implement real discount code validation via Stripe Promotion Codes API
  // 
  // Implementation steps:
  // 1. Create API endpoint: POST /api/stripe/validate-promo-code
  // 2. Use Stripe's promotion_codes.list() or coupons.retrieve() to validate
  // 3. Return discount percentage/amount and apply to subscription creation
  // 4. Pass coupon ID to create-subscription endpoint
  //
  // For now, discount codes are disabled (always returns "Invalid discount code")
  // ==========================================================================
  const handleApplyDiscount = useCallback(async () => {
    if (!discountCode.trim()) return;
    
    setIsApplyingDiscount(true);
    setDiscountError('');
    
    try {
      // TODO: Replace with real API call to validate promo code
      // Example: const res = await fetch('/api/stripe/validate-promo-code', {
      //   method: 'POST',
      //   body: JSON.stringify({ code: discountCode })
      // });
      
      // For now, all codes are invalid until real validation is implemented
      setDiscountError('Discount codes coming soon');
      setDiscountApplied(false);
      setDiscountAmount(0);
    } catch {
      setDiscountError('Failed to validate code');
    } finally {
      setIsApplyingDiscount(false);
    }
  }, [discountCode]);

  const handleResetDiscount = useCallback(() => {
    setDiscountError('');
    setDiscountApplied(false);
  }, []);

  // Render Step 7 wrapped in StripeProvider
  const renderStep7 = () => (
    <StripeProvider>
      <Step7CardForm
        selectedPlanName={selectedPlanInfo?.name || ''}
        selectedPlanPrice={selectedPlanPrice}
        billingInterval={billingInterval}
        cardholderName={cardholderName}
        onCardholderNameChange={setCardholderName}
        isCardReady={isCardReady}
        onCardReadyChange={setIsCardReady}
        stripeError={stripeError}
        onStripeErrorChange={setStripeError}
        discountCode={discountCode}
        onDiscountCodeChange={setDiscountCode}
        isApplyingDiscount={isApplyingDiscount}
        discountApplied={discountApplied}
        discountError={discountError}
        discountAmount={discountAmount}
        onApplyDiscount={handleApplyDiscount}
        onResetDiscount={handleResetDiscount}
        onSubmit={handleStripeSubmit}
        isLoading={isLoading}
      />
    </StripeProvider>
  );

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-100 dark:bg-black font-sans py-4 px-4">
      {/* Main Card Container - NEO-BRUTALIST (Updated January 8th, 2026) */}
      <div className={cn(
        "bg-white dark:bg-[#0f0f0f] border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_#000000] dark:shadow-[8px_8px_0px_0px_#333333] relative flex flex-col",
        "p-5",
        step === 6 ? "w-full max-w-3xl" : "w-full max-w-[420px]",
        step === 7 ? "origin-center scale-[0.9]" : "max-h-[90vh]"
      )}>
        
        <form onSubmit={(e) => { e.preventDefault(); handleContinue(); }} className="flex-1 flex flex-col">
           {/* Content area - only scroll on steps that need it (3, 4, 5 have lots of content, 6 needs full width) */}
           {/* 
             January 3rd, 2026: Added isAnalyzing state to show AnalyzingScreen
             between Step 1 and Step 2 while fetching AI suggestions.
           */}
           <div className={cn(
             "flex-1 pr-1",
             (step >= 3 && step <= 5) ? "overflow-y-auto scrollbar-hide" : "overflow-visible"
           )}>
             {/* Show AnalyzingScreen when fetching AI suggestions */}
             {isAnalyzing && renderAnalyzingScreen()}
             
             {/* Regular step content (hidden during analysis) */}
             {!isAnalyzing && step === 1 && renderStep1()}
             {!isAnalyzing && step === 2 && renderStep2()}
             {!isAnalyzing && step === 3 && renderStep3()}
             {!isAnalyzing && step === 4 && renderStep4()}
             {!isAnalyzing && step === 5 && renderStep5()}
             {!isAnalyzing && step === 6 && renderStep6()}
             {!isAnalyzing && step === 7 && renderStep7()}
           </div>

           {/* Submit Button - Hidden on Step 7 (Stripe) and during AI analysis */}
          {/* January 3rd, 2026: Also hide button during isAnalyzing state */}
          {step !== 7 && !isAnalyzing && (
            <div className="pt-5 mt-auto shrink-0">
              {(() => {
                // =============================================================
                // BUTTON DISABLED STATE (Updated January 3rd, 2026)
                // 
                // Step 1 now includes domain format validation check.
                // Button is disabled if:
                // - Required fields are empty
                // - Brand domain format is invalid (instant feedback)
                // - Domain validation is in progress (server check)
                // =============================================================
                const isDisabled = 
                  (step === 1 && (!name || !role || !brand || brandFormatValid === false || isBrandValidating)) ||
                  (step === 2 && (!targetCountry || !targetLanguage)) || 
                  (step === 6 && !selectedPlan) ||
                  isLoading;

                return (
                  <div className="flex gap-2">
                    {/* =============================================================
                        BACK BUTTON (January 3rd, 2026)
                        
                        Shows on Steps 3, 4, 5 only.
                        Allows user to go back to previous step (minimum Step 2).
                        Not available on Steps 1, 2, 6, 7 because:
                        - Step 1: First step, nothing to go back to
                        - Step 2: Minimum step (going back would require re-analysis)
                        - Step 6+: Pricing/payment, commitment point
                        ============================================================= */}
                    {showBackButton && (
                      <button
                        type="button"
                        onClick={handleGoBack}
                        className="w-12 py-3 font-bold text-sm transition-all duration-200 border-2 border-gray-300 dark:border-gray-600 hover:border-black dark:hover:border-white hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400"
                      >
                        <ChevronLeft size={18} />
                      </button>
                    )}
                    
                    {/* Continue/Next Button - NEO-BRUTALIST */}
                    <button
                      type="submit"
                      disabled={isDisabled}
                      className={cn(
                        "flex-1 py-3 font-black text-sm transition-all duration-200 flex items-center justify-center gap-2 uppercase border-2",
                        isDisabled
                          ? "bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-300 dark:border-gray-600 cursor-not-allowed"
                          : "bg-[#ffbf23] text-black border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px]"
                      )}
                    >
                      {isLoading || isBrandValidating ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          {isBrandValidating && <span>Validating domain...</span>}
                        </>
                      ) : step === 6 ? (
                        selectedPlan === 'enterprise' ? (
                          "Contact Sales"
                        ) : (
                          "Continue to Payment"
                        )
                      ) : step === 5 ? (
                        "Choose Plan"
                      ) : step === 1 ? (
                        "Continue"
                      ) : (
                        "Next"
                      )}
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
        </form>

      </div>
    </div>
  );
};

