'use client';

/**
 * =============================================================================
 * OUTREACH PAGE - AI Email Generation
 * =============================================================================
 * 
 * Updated: January 3rd, 2026
 * 
 * This page allows users to generate AI-powered outreach emails for their
 * saved affiliates. The AI generation is handled via n8n webhook integration.
 * 
 * ARCHITECTURE CHANGE (January 3rd, 2026):
 * -----------------------------------------
 * This page is now part of the (dashboard) route group. The layout handles:
 *   - AuthGuard (authentication + onboarding check)
 *   - ErrorBoundary (error handling)
 *   - Sidebar (navigation - persists across page navigation)
 *   - Main container with ml-52 margin
 * 
 * This page only renders the content: header + main content area + modals.
 * 
 * KEY FEATURES:
 * - Single & bulk email generation
 * - Visual status indicators (generating, success, failed)
 * - Progress tracking for bulk operations
 * - Error handling with inline notifications (not alerts)
 * - Credit consumption per generation
 * 
 * VISUAL STATES (December 17, 2025):
 * 1. Default: Yellow "Generate" button
 * 2. Generating: Grey button with spinner
 * 3. Success: Yellow-tinted "View Message" button
 * 4. Failed: Red-tinted "Failed - Retry" button
 * 
 * =============================================================================
 * MULTI-CONTACT SUPPORT (December 25, 2025)
 * =============================================================================
 * 
 * When Lusha returns multiple contacts for an affiliate, users can now select
 * which specific contact(s) to generate emails for:
 * 
 * - Contact Picker Modal: Shows all available contacts with name, title, email
 * - Per-Contact Messages: Messages are now stored by email address, not affiliate ID
 * - Credit Display: Shows how many AI credits will be consumed before generation
 * - Multiple Messages Per Affiliate: Each contact gets their own personalized email
 * 
 * @see src/app/api/ai/outreach/route.ts - Backend API
 * @see src/lib/n8n-ai-outreach.ts - n8n webhook integration
 * =============================================================================
 */

import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner'; // January 5th, 2026: Global toast notifications via Sonner
import { ScanCountdown } from '../../components/ScanCountdown';
import { CreditsDisplay } from '../../components/CreditsDisplay';
import { useSavedAffiliates } from '../../hooks/useAffiliates';
import { cn } from '@/lib/utils';
import { ResultItem } from '../../types';
import { 
  Search, 
  Mail,
  Plus,
  Sparkles,
  Wand2,
  Copy,
  Check,
  RefreshCw,
  Globe,
  Youtube,
  Instagram,
  Music,
  MessageSquare,
  ExternalLink,
  User,
  AlertTriangle,
  X,
  Loader2,
  Users,
  Briefcase,
  ChevronRight,
  Clock,  // Added January 6th, 2026 for neo-brutalist header
  CheckCircle2,  // Added January 16, 2026 for verified badge
} from 'lucide-react';
// =============================================================================
// i18n SUPPORT (January 9th, 2026)
// See LANGUAGE_MIGRATION.md for documentation
// =============================================================================
import { useLanguage } from '@/contexts/LanguageContext';

// =============================================================================
// HELPER: FORMAT NUMBER - January 16, 2026
// Formats large numbers for display (e.g., 1500 -> "1.5K", 1500000 -> "1.5M")
// Used for follower counts in the Creator column
// =============================================================================
function formatNumber(num?: number): string {
  if (!num) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

// =============================================================================
// TYPES FOR MULTI-CONTACT SUPPORT (December 25, 2025)
// =============================================================================

/**
 * Represents a single contact from emailResults.contacts[]
 * Used in the contact picker modal
 */
interface SelectableContact {
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  title?: string;
  linkedinUrl?: string;
}

/**
 * State for the contact picker modal
 */
interface ContactPickerState {
  isOpen: boolean;
  affiliateId: number | null;
  affiliate: ResultItem | null;
  contacts: SelectableContact[];
  selectedContacts: Set<string>; // Set of email addresses
}

// =============================================================================
// OUTREACH PAGE - January 3rd, 2026
// 
// NOTIFICATION SYSTEM UPDATE (January 5th, 2026):
// Removed custom ErrorNotification interface and local notification state.
// Now uses global Sonner toast system - just call toast.error(), toast.success(), etc.
// See src/app/layout.tsx for Toaster configuration.
// 
// Layout now handles: AuthGuard, ErrorBoundary, and Sidebar.
// This component only renders the header and main content area.
// =============================================================================
export default function OutreachPage() {
  // Translation hook (January 9th, 2026)
  const { t } = useLanguage();
  
  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedAffiliates, setSelectedAffiliates] = useState<Set<number>>(new Set());
  
  // =========================================================================
  // MESSAGE STORAGE (Updated December 25, 2025)
  // 
  // Messages are now stored by email address, not just affiliate ID.
  // This supports generating different messages for different contacts
  // at the same company.
  //
  // Key format: "affiliateId:email" (e.g., "123:john@acme.com")
  // For backwards compatibility with single-contact affiliates,
  // we also support "affiliateId" alone.
  // =========================================================================
  const [generatedMessages, setGeneratedMessages] = useState<Map<string, string>>(new Map());
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set()); // Now tracks "affiliateId:email"
  
  // =========================================================================
  // CONTACT PICKER MODAL STATE (December 25, 2025)
  // 
  // When an affiliate has multiple contacts (from Lusha), this modal
  // lets users select which contact(s) to generate emails for.
  // =========================================================================
  const [contactPicker, setContactPicker] = useState<ContactPickerState>({
    isOpen: false,
    affiliateId: null,
    affiliate: null,
    contacts: [],
    selectedContacts: new Set(),
  });
  
  // =========================================================================
  // FAILED IDS TRACKING (Updated December 25, 2025)
  // Tracks which affiliate:email combinations had generation failures so we can show
  // "Failed - Retry" button instead of the default "Generate" button
  // Key format: "affiliateId:email" or "affiliateId" for single-contact
  // =========================================================================
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  
  // =========================================================================
  // BULK GENERATION PROGRESS (December 17, 2025)
  // Tracks progress during bulk generation: { current: 2, total: 5 }
  // Shows "Generating 2/5..." in the header button
  // =========================================================================
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  
  // =========================================================================
  // NOTE (January 5th, 2026): Removed local notification state.
  // Now using global Sonner toast system. Just import { toast } from 'sonner'
  // and call toast.error(), toast.warning(), toast.info(), toast.success()
  // =========================================================================
  
  const [copiedId, setCopiedId] = useState<string | null>(null); // Now stores "affiliateId:email" or "affiliateId"
  const [viewingMessageId, setViewingMessageId] = useState<string | null>(null); // Now stores "affiliateId:email" or "affiliateId"

  const { savedAffiliates, isLoading: loading } = useSavedAffiliates();
  
  // =========================================================================
  // LOAD SAVED AI-GENERATED MESSAGES ON MOUNT (Updated December 25, 2025)
  // 
  // When affiliates are loaded from the database, populate the generatedMessages
  // state with any previously saved AI-generated messages. This ensures that
  // messages persist across page refreshes without re-generation.
  //
  // MULTI-CONTACT SUPPORT: We now use the key format "affiliateId:email" to
  // support multiple messages per affiliate. We load both:
  // 1. Per-contact messages from aiGeneratedMessages JSONB
  // 2. Legacy single message from aiGeneratedMessage (backwards compatibility)
  // =========================================================================
  useEffect(() => {
    if (savedAffiliates.length > 0) {
      const savedMessages = new Map<string, string>();
      
      savedAffiliates.forEach((affiliate) => {
        if (affiliate.id) {
          // Load per-contact messages from JSONB column (December 25, 2025)
          if (affiliate.aiGeneratedMessages) {
            Object.entries(affiliate.aiGeneratedMessages).forEach(([email, data]) => {
              const key = `${affiliate.id}:${email}`;
              savedMessages.set(key, data.message);
            });
          }
          
          // Load legacy single message (backwards compatibility)
          // Only if we haven't already loaded a per-contact message for this email
          if (affiliate.aiGeneratedMessage) {
            const key = affiliate.email 
              ? `${affiliate.id}:${affiliate.email}` 
              : `${affiliate.id}`;
            // Don't override per-contact messages
            if (!savedMessages.has(key)) {
              savedMessages.set(key, affiliate.aiGeneratedMessage);
            }
          }
        }
      });
      
      // Only update if we found saved messages
      if (savedMessages.size > 0) {
        setGeneratedMessages(prev => {
          // Merge saved messages with any new ones (new ones take precedence)
          const merged = new Map(savedMessages);
          prev.forEach((value, key) => {
            merged.set(key, value);
          });
          return merged;
        });
        console.log(`[Outreach] Loaded ${savedMessages.size} saved AI messages from database`);
      }
    }
  }, [savedAffiliates]);
  
  // =========================================================================
  // NOTIFICATION HELPERS (January 5th, 2026)
  // 
  // REMOVED: addNotification() and removeNotification() functions.
  // NOW USING: Global Sonner toast system.
  // 
  // To show notifications anywhere in this component:
  //   toast.error('Error message');     // Red error toast
  //   toast.warning('Warning message'); // Yellow warning toast
  //   toast.info('Info message');       // Blue info toast
  //   toast.success('Success message'); // Green success toast
  // 
  // Sonner handles auto-dismiss (4s), positioning, and close button automatically.
  // =========================================================================

  // ==========================================================================
  // AFFILIATES WITH EMAIL ONLY - January 16, 2026
  // 
  // Client requirement: Outreach page should only show affiliates for whom
  // we have found an email. This filters out affiliates without emails since
  // outreach is only possible when we have contact information.
  // ==========================================================================
  const affiliatesWithEmail = useMemo(() => {
    return savedAffiliates.filter(item => item.email && item.email.trim() !== '');
  }, [savedAffiliates]);

  // Filter and Search Logic (now operates on affiliatesWithEmail)
  const filteredResults = useMemo(() => {
    return affiliatesWithEmail.filter(item => {
      // Filter by Source
      if (activeFilter !== 'All' && item.source !== activeFilter) return false;
      
      // Filter by Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.domain.toLowerCase().includes(q) ||
          (item.email && item.email.toLowerCase().includes(q)) ||
          (item.personName && item.personName.toLowerCase().includes(q))
        );
      }
      
      return true;
    });
  }, [affiliatesWithEmail, activeFilter, searchQuery]);

  // Calculate counts (only affiliates with email - January 16, 2026)
  const counts = useMemo(() => {
    return {
      All: affiliatesWithEmail.length,
      Web: affiliatesWithEmail.filter(r => r.source === 'Web').length,
      YouTube: affiliatesWithEmail.filter(r => r.source === 'YouTube').length,
      Instagram: affiliatesWithEmail.filter(r => r.source === 'Instagram').length,
      TikTok: affiliatesWithEmail.filter(r => r.source === 'TikTok').length,
    };
  }, [affiliatesWithEmail]);

  const filterTabs = [
    { id: 'All', label: 'All', count: counts.All },
    { id: 'Web', icon: <Globe size={14} className="text-blue-500" />, count: counts.Web },
    { id: 'YouTube', icon: <Youtube size={14} className="text-red-600" />, count: counts.YouTube },
    { id: 'Instagram', icon: <Instagram size={14} className="text-pink-600" />, count: counts.Instagram },
    { id: 'TikTok', icon: <Music size={14} className="text-cyan-500" />, count: counts.TikTok },
  ];

  const handleSelectAffiliate = (id: number) => {
    const newSelected = new Set(selectedAffiliates);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAffiliates(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedAffiliates.size === filteredResults.length) {
      setSelectedAffiliates(new Set());
    } else {
      setSelectedAffiliates(new Set(filteredResults.map(a => a.id!)));
    }
  };

  // =========================================================================
  // HELPER: GET MESSAGE KEY (December 25, 2025)
  //
  // Creates a unique key for storing/retrieving messages. Format: "affiliateId:email"
  // Falls back to just "affiliateId" if no email is provided.
  // =========================================================================
  const getMessageKey = (affiliateId: number, email?: string | null): string => {
    return email ? `${affiliateId}:${email}` : `${affiliateId}`;
  };
  
  // =========================================================================
  // HELPER: CHECK IF AFFILIATE HAS MULTIPLE CONTACTS (December 25, 2025)
  //
  // Returns the list of available contacts for an affiliate, or null if
  // there's only one contact (or no enrichment data).
  // =========================================================================
  const getAffiliateContacts = (affiliate: ResultItem): SelectableContact[] | null => {
    const contacts: SelectableContact[] = [];
    
    // Check if we have emailResults with multiple contacts
    if (affiliate.emailResults?.contacts && affiliate.emailResults.contacts.length > 0) {
      // Add all contacts from Lusha enrichment
      affiliate.emailResults.contacts.forEach(contact => {
        // Each contact may have multiple emails
        if (contact.emails && contact.emails.length > 0) {
          contact.emails.forEach(email => {
            contacts.push({
              email,
              firstName: contact.firstName,
              lastName: contact.lastName,
              fullName: contact.fullName,
              title: contact.title,
              linkedinUrl: contact.linkedinUrl,
            });
          });
        }
      });
    } else if (affiliate.emailResults?.emails && affiliate.emailResults.emails.length > 1) {
      // We have multiple emails but no contact details
      affiliate.emailResults.emails.forEach(email => {
        contacts.push({
          email,
          firstName: affiliate.emailResults?.firstName,
          lastName: affiliate.emailResults?.lastName,
          title: affiliate.emailResults?.title,
        });
      });
    }
    
    // If we have 2+ contacts, return them. Otherwise, return null (single contact flow)
    return contacts.length >= 2 ? contacts : null;
  };
  
  // =========================================================================
  // HELPER: CHECK IF AFFILIATE HAS ANY MESSAGE (December 25, 2025)
  //
  // Checks if the affiliate has at least one generated message.
  // Looks for any key that starts with "affiliateId:"
  // =========================================================================
  const hasAnyMessage = (affiliateId: number): boolean => {
    const prefix = `${affiliateId}:`;
    // Check for keys with email or just the ID
    for (const key of generatedMessages.keys()) {
      if (key === `${affiliateId}` || key.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  };
  
  // =========================================================================
  // HELPER: GET MESSAGE COUNT FOR AFFILIATE (December 25, 2025)
  //
  // Returns the number of generated messages for an affiliate
  // =========================================================================
  const getMessageCount = (affiliateId: number): number => {
    const prefix = `${affiliateId}:`;
    let count = 0;
    for (const key of generatedMessages.keys()) {
      if (key === `${affiliateId}` || key.startsWith(prefix)) {
        count++;
      }
    }
    return count;
  };
  
  // =========================================================================
  // HELPER: CHECK IF ANY CONTACT IS GENERATING (December 26, 2025)
  //
  // BUG FIX: Previously, the row only checked if the PRIMARY contact's 
  // messageKey was in generatingIds. This meant if user was generating for 
  // contact #2 or #3, the row would incorrectly show "Select Contacts" button 
  // instead of the spinner.
  //
  // This helper checks ALL possible message keys for the affiliate.
  // =========================================================================
  const isAnyGenerating = (affiliateId: number): boolean => {
    const prefix = `${affiliateId}:`;
    for (const key of generatingIds) {
      if (key === `${affiliateId}` || key.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  };
  
  // =========================================================================
  // HELPER: CHECK IF ANY CONTACT HAS FAILED (December 26, 2025)
  //
  // BUG FIX: Similar to isAnyGenerating, this checks all message keys for 
  // the affiliate instead of just the primary contact's key.
  // =========================================================================
  const hasAnyFailed = (affiliateId: number): boolean => {
    const prefix = `${affiliateId}:`;
    for (const key of failedIds) {
      if (key === `${affiliateId}` || key.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  };
  
  // =========================================================================
  // HELPER: GET ALL MESSAGES FOR AFFILIATE (December 26, 2025)
  //
  // Returns an array of { email, message } objects for all generated messages
  // belonging to this affiliate. Used by the multi-message viewing modal.
  // =========================================================================
  const getAllMessagesForAffiliate = (affiliateId: number): Array<{ email: string; message: string }> => {
    const prefix = `${affiliateId}:`;
    const messages: Array<{ email: string; message: string }> = [];
    
    generatedMessages.forEach((message, key) => {
      if (key === `${affiliateId}` || key.startsWith(prefix)) {
        // Extract email from key (format: "affiliateId:email" or just "affiliateId")
        const email = key.includes(':') 
          ? key.split(':').slice(1).join(':') // Handle emails with colons
          : ''; // Legacy key format without email
        messages.push({ email, message });
      }
    });
    
    return messages;
  };

  // =========================================================================
  // OPEN CONTACT PICKER MODAL (December 25, 2025)
  //
  // Opens the modal to let user select which contact(s) to email
  // =========================================================================
  const openContactPicker = (affiliate: ResultItem) => {
    const contacts = getAffiliateContacts(affiliate);
    if (!contacts || contacts.length === 0) return;
    
    setContactPicker({
      isOpen: true,
      affiliateId: affiliate.id!,
      affiliate,
      contacts,
      selectedContacts: new Set(), // Start with none selected
    });
  };
  
  // =========================================================================
  // TOGGLE CONTACT SELECTION IN PICKER (December 25, 2025)
  // =========================================================================
  const toggleContactSelection = (email: string) => {
    setContactPicker(prev => {
      const next = new Set(prev.selectedContacts);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return { ...prev, selectedContacts: next };
    });
  };
  
  // =========================================================================
  // GENERATE FOR SELECTED CONTACTS (December 25, 2025)
  //
  // Called when user confirms selection in the contact picker modal.
  // Generates emails for each selected contact sequentially.
  // =========================================================================
  const handleGenerateForSelectedContacts = async () => {
    if (!contactPicker.affiliate || contactPicker.selectedContacts.size === 0) return;
    
    const affiliate = contactPicker.affiliate;
    const selectedEmails = Array.from(contactPicker.selectedContacts);
    
    // Close the modal
    setContactPicker(prev => ({ ...prev, isOpen: false }));
    
    // Generate for each selected contact
    for (const email of selectedEmails) {
      // Find the contact details
      const contact = contactPicker.contacts.find(c => c.email === email);
      if (!contact) continue;
      
      await handleGenerateForContact(affiliate, contact);
    }
  };
  
  // =========================================================================
  // SINGLE CONTACT EMAIL GENERATION (December 25, 2025)
  //
  // Generates an AI email for a specific contact. This is the core generation
  // function that handles both single-contact affiliates and individual
  // contacts from multi-contact affiliates.
  // =========================================================================
  const handleGenerateForContact = async (
    affiliate: ResultItem,
    contact?: SelectableContact
  ) => {
    const messageKey = getMessageKey(affiliate.id!, contact?.email || affiliate.email);
    
    // Add to generating set (shows spinner)
    setGeneratingIds(prev => new Set(prev).add(messageKey));
    
    // Clear any previous failure state
    setFailedIds(prev => {
      const next = new Set(prev);
      next.delete(messageKey);
      return next;
    });

    try {
      // Build the request with optional selectedContact
      const requestBody: Record<string, unknown> = {
        affiliateId: affiliate.id,
        affiliate: affiliate,
      };
      
      // If a specific contact was provided, include it
      if (contact) {
        requestBody.selectedContact = {
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          title: contact.title,
        };
      }
      
      // Call the AI outreach API
      const response = await fetch('/api/ai/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // =====================================================================
        // SUCCESS: Store the generated message
        // January 5th, 2026: Added success toast notification
        // =====================================================================
        setGeneratedMessages(prev => {
          const next = new Map(prev);
          next.set(messageKey, data.message);
          return next;
        });
        
        // Show success notification
        // i18n: January 10th, 2026
        toast.success(t.toasts.success.emailGenerated);

        // =====================================================================
        // CREDITS REFRESH - January 4th, 2026
        // 
        // After AI generation succeeds, backend has consumed AI credits.
        // Dispatch event to trigger useCredits hook to refetch from database.
        // 
        // SAFE: Does NOT modify credits - only triggers a refetch of existing DB value.
        // =====================================================================
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('credits-updated'));
        }
      } else {
        // =====================================================================
        // FAILURE: Mark as failed and show notification
        // =====================================================================
        console.error('AI generation failed:', data.error);
        setFailedIds(prev => new Set(prev).add(messageKey));
        
        // Show user-friendly error message based on error type
        // January 5th, 2026: Using global Sonner toast instead of local notification
        // i18n: January 10th, 2026
        if (response.status === 402) {
          toast.warning(t.toasts.warning.insufficientAICredits);
        } else if (data.error?.includes('webhook not configured')) {
          toast.error(t.toasts.error.aiServiceNotConfigured);
        } else {
          toast.error(data.error || t.toasts.error.aiGenerationFailed);
        }
      }
    } catch (error) {
      // =====================================================================
      // NETWORK ERROR: Mark as failed
      // January 5th, 2026: Using global Sonner toast
      // i18n: January 10th, 2026
      // =====================================================================
      console.error('Error generating message:', error);
      setFailedIds(prev => new Set(prev).add(messageKey));
      toast.error(t.toasts.error.aiConnectionFailed);
    } finally {
      // Remove from generating set (hides spinner)
      setGeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(messageKey);
        return next;
      });
    }
  };
  
  // =========================================================================
  // SINGLE AFFILIATE EMAIL GENERATION (Updated December 25, 2025)
  // 
  // Entry point for generating email for an affiliate. If the affiliate has
  // multiple contacts, opens the contact picker modal. Otherwise, generates
  // directly for the primary contact.
  // =========================================================================
  const handleGenerateForSingle = async (id: number) => {
    const affiliate = filteredResults.find(a => a.id === id);
    if (!affiliate) return;
    
    // Check if affiliate has multiple contacts
    const contacts = getAffiliateContacts(affiliate);
    if (contacts && contacts.length >= 2) {
      // Multiple contacts - open picker modal
      openContactPicker(affiliate);
      return;
    }
    
    // Single contact - generate directly
    await handleGenerateForContact(affiliate);
  };

  // =========================================================================
  // BULK EMAIL GENERATION (Updated December 25, 2025)
  // 
  // Generates AI emails for all selected affiliates sequentially.
  // Shows progress indicator "Generating 2/5..." in the header button.
  // Tracks failures individually so user can retry specific ones.
  //
  // NOTE: For bulk generation, we use the primary contact only (first email).
  // Users who want to email multiple contacts should use single-select mode.
  // =========================================================================
  const handleGenerateMessages = async () => {
    if (selectedAffiliates.size === 0) return;
    
    const idsToProcess = Array.from(selectedAffiliates);
    const total = idsToProcess.length;
    
    // Initialize bulk progress tracking
    setBulkProgress({ current: 0, total });
    
    let successCount = 0;
    let failCount = 0;
    
    // Process each affiliate sequentially to respect rate limits
    for (let i = 0; i < idsToProcess.length; i++) {
      const id = idsToProcess[i];
      const affiliate = filteredResults.find(a => a.id === id);
      
      // Update progress indicator
      setBulkProgress({ current: i + 1, total });
      
      if (!affiliate) continue;
      
      const messageKey = getMessageKey(id, affiliate.email);
      
      // Add to generating set
      setGeneratingIds(prev => new Set(prev).add(messageKey));
      
      // Clear previous failure state
      setFailedIds(prev => {
        const next = new Set(prev);
        next.delete(messageKey);
        return next;
      });

      try {
        const response = await fetch('/api/ai/outreach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            affiliateId: id,
            affiliate: affiliate,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // SUCCESS: Store message and update UI progressively
          setGeneratedMessages(prev => {
            const next = new Map(prev);
            next.set(messageKey, data.message);
            return next;
          });
          successCount++;
        } else {
          // FAILURE: Mark as failed
          console.error(`Failed to generate for ${affiliate.domain}:`, data.error);
          setFailedIds(prev => new Set(prev).add(messageKey));
          failCount++;
        }
        
        // Remove from generating set as it completes
        setGeneratingIds(prev => {
          const next = new Set(prev);
          next.delete(messageKey);
          return next;
        });

        // Small delay between requests to be respectful to n8n/AI service
        if (i < idsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        // NETWORK ERROR: Mark as failed
        console.error(`Error generating for ${affiliate.domain}:`, error);
        setFailedIds(prev => new Set(prev).add(messageKey));
        failCount++;
        
        setGeneratingIds(prev => {
          const next = new Set(prev);
          next.delete(messageKey);
          return next;
        });
      }
    }
    
    // Clear progress indicator
    setBulkProgress(null);

    // ==========================================================================
    // CREDITS REFRESH - January 4th, 2026
    // 
    // After bulk AI generation completes, backend has consumed AI credits.
    // Dispatch event to trigger useCredits hook to refetch from database.
    // 
    // SAFE: Does NOT modify credits - only triggers a refetch of existing DB value.
    // ==========================================================================
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('credits-updated'));
    }
    
    // Show summary notification based on results
    // January 5th, 2026: Using global Sonner toast with success/warning/error states
    // i18n: January 10th, 2026
    if (failCount === 0 && successCount > 0) {
      // All succeeded
      toast.success(`${t.toasts.success.bulkEmailsGenerated} ${successCount} ${successCount !== 1 ? t.dashboard.outreach.emails : t.dashboard.outreach.email}!`);
    } else if (failCount > 0) {
      // Some or all failed
      const message = `${t.toasts.error.bulkGenerationFailed} ${successCount} ${t.toasts.warning.partialBulkFailure} ${total}. ${failCount} ${t.dashboard.outreach.failedRetry}`;
      if (failCount === total) {
        toast.error(message);
      } else {
        toast.warning(message);
      }
    }
  };

  // =========================================================================
  // COPY MESSAGE TO CLIPBOARD (Updated January 5th, 2026)
  // Now uses messageKey format "affiliateId:email"
  // Added success toast notification
  // =========================================================================
  const handleCopyMessage = (messageKey: string) => {
    const message = generatedMessages.get(messageKey);
    if (message) {
      navigator.clipboard.writeText(message);
      setCopiedId(messageKey);
      setTimeout(() => setCopiedId(null), 2000);
      
      // January 5th, 2026: Show success toast
      // i18n: January 10th, 2026
      toast.success(t.toasts.success.messageCopied);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'YouTube': return <Youtube size={16} className="text-red-600" />;
      case 'Instagram': return <Instagram size={16} className="text-pink-600" />;
      case 'TikTok': return <Music size={16} className="text-cyan-500" />;
      default: return <Globe size={16} className="text-blue-500" />;
    }
  };

  // ==========================================================================
  // RENDER - January 3rd, 2026
  // 
  // Note: The outer container with Sidebar is now handled by the layout.
  // This component only renders the header and main content area.
  // ==========================================================================
  return (
    <>
      {/* =============================================================================
          TOP BAR - NEW DESIGN (January 6th, 2026)
          Neo-brutalist header - MATCHES DashboardDemo.tsx EXACTLY
          ============================================================================= */}
      {/* Header - Translated (January 9th, 2026) */}
      <header className="h-16 border-b-4 border-black dark:border-white flex items-center justify-between px-6 bg-white dark:bg-[#0a0a0a]">
        {/* Page Title - font-black uppercase tracking-tight */}
        <h1 className="font-black text-xl uppercase tracking-tight">{t.dashboard.outreach.pageTitle}</h1>

        <div className="flex items-center gap-4">
          {/* Timer Pill - DashboardDemo exact styling */}
          <div className="hidden md:flex items-center gap-2 bg-[#1a1a1a] text-[#ffbf23] px-3 py-1.5 rounded-full text-xs font-mono border border-black">
            <Clock size={12} />
            <span>{t.dashboard.header.nextScan}</span>
            <ScanCountdown />
            <span className="text-white font-bold">{t.dashboard.header.pro}</span>
          </div>

          {/* Stats Pills - DashboardDemo exact styling */}
          <div className="hidden lg:flex items-center gap-3">
            <CreditsDisplay variant="neo" />
          </div>

          {/* Find Button - DashboardDemo exact styling */}
          <button 
            className="flex items-center gap-2 px-4 py-2 bg-[#ffbf23] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
          >
            <Plus size={14} strokeWidth={3} /> {t.dashboard.header.findAffiliates}
          </button>
        </div>
      </header>

      {/* =============================================================================
          CONTENT AREA - NEW DESIGN (January 6th, 2026)
          ============================================================================= */}
      <div className="flex-1 p-8 overflow-y-auto">

        {/* =============================================================================
            FILTERS ROW - DashboardDemo.tsx EXACT STYLING
            ============================================================================= */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-4 w-full md:w-auto">
            {/* Search Input - Translated (January 9th, 2026) */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder={t.dashboard.filters.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border-2 border-black dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-[#ffbf23]"
              />
            </div>
            
            {/* Platform Filter Pills - DashboardDemo exact styling with counts */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded border border-gray-200 dark:border-gray-800">
              {filterTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1.5 rounded transition-colors text-xs font-bold",
                    activeFilter === tab.id
                      ? "bg-[#ffbf23] text-black shadow-sm"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  )}
                  title={tab.id}
                >
                  {tab.icon || <Globe size={16} />}
                  {tab.id === 'All' && <span>{t.dashboard.filters.all}</span>}
                  {tab.count > 0 && (
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold",
                      activeFilter === tab.id ? "bg-black/20 text-black" : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Actions - NEO-BRUTALIST */}
          <div className="flex items-center gap-3">
            {selectedAffiliates.size > 0 && (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#ffbf23] border-2 border-black text-xs font-black text-black">
                  <Check size={12} />
                  {selectedAffiliates.size} SELECTED
                </div>
                <button
                  onClick={handleSelectAll}
                  className="text-xs font-black uppercase text-gray-600 hover:text-black transition-colors px-3 py-1.5 border-2 border-gray-300 dark:border-gray-600 hover:border-black"
                >
                  Deselect All
                </button>
              </>
            )}
            {selectedAffiliates.size === 0 && filteredResults.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="text-xs font-black uppercase text-gray-600 hover:text-black transition-colors px-3 py-1.5 border-2 border-gray-300 dark:border-gray-600 hover:border-black"
              >
                Select All
              </button>
            )}
            {/* ================================================================
                BULK GENERATE BUTTON - NEO-BRUTALIST (Updated January 6th, 2026)
                ================================================================ */}
            <button
              onClick={handleGenerateMessages}
              disabled={selectedAffiliates.size === 0 || generatingIds.size > 0}
              className={cn(
                "flex items-center gap-2 px-4 py-2 font-black text-xs uppercase transition-all",
                selectedAffiliates.size > 0 && generatingIds.size === 0
                  ? "bg-[#ffbf23] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-400 border-2 border-gray-200 dark:border-gray-700 cursor-not-allowed"
              )}
            >
              {bulkProgress ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {bulkProgress.current}/{bulkProgress.total}
                </>
              ) : generatingIds.size > 0 ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 size={14} />
                  Generate ({selectedAffiliates.size})
                </>
              )}
            </button>
          </div>
        </div>

        {/* =============================================================================
            TABLE AREA - DashboardDemo.tsx EXACT STYLING (Outreach)
            ============================================================================= */}
        <div className="bg-white dark:bg-[#0f0f0f] border-4 border-gray-200 dark:border-gray-800 rounded-lg min-h-[500px] flex flex-col">
          {/* Table Header - Updated January 16, 2026: Adjusted columns for more Discovery Method space */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b-2 border-gray-100 dark:border-gray-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <div className="col-span-1 flex justify-center">
              <input
                type="checkbox"
                checked={selectedAffiliates.size === filteredResults.length && filteredResults.length > 0}
                onChange={handleSelectAll}
                className="accent-[#ffbf23] w-4 h-4"
              />
            </div>
            <div className="col-span-2">{t.dashboard.table.affiliate}</div>
            <div className="col-span-2">Creator</div>
            <div className="col-span-3">{t.dashboard.table.discoveryMethod}</div>
            <div className="col-span-2">{t.dashboard.table.email}</div>
            <div className="col-span-2 text-right">{t.dashboard.table.message}</div>
          </div>

          {/* Results Content */}
          <div className="flex-1">
          
          {/* Loading State - Neo-brutalist */}
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="relative w-12 h-12 mx-auto">
                <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-800 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-[#ffbf23] border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-gray-500 text-sm mt-4 font-medium">Loading your affiliates...</p>
            </div>
          )}
          
          {/* Empty State - Updated January 16, 2026: Only shows when no affiliates have emails */}
          {!loading && affiliatesWithEmail.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4 border-2 border-gray-100 dark:border-gray-800">
                <MessageSquare size={24} className="text-gray-300" />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">
                {t.dashboard.outreach.emptyState.title}
              </h3>
              <p className="text-gray-500 text-sm max-w-xs">
                {t.dashboard.outreach.emptyState.subtitle}
              </p>
            </div>
          )}
          
          {/* No Results State - Neo-brutalist (Updated January 16, 2026) */}
          {!loading && affiliatesWithEmail.length > 0 && filteredResults.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4 border-2 border-gray-100 dark:border-gray-800">
                <Search size={24} className="text-gray-300" />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">
                No Results Found
              </h3>
              <p className="text-gray-500 text-sm max-w-xs">
                Try adjusting your search or filter to find affiliates.
              </p>
            </div>
          )}

            {/* Affiliate Rows */}
            {/* ================================================================
                AFFILIATE ROWS (Updated December 25, 2025)
                
                Each row shows the affiliate with action button states:
                - Default: Yellow "Generate" button
                - Generating: Grey with spinner
                - Success: Yellow-tinted "View Message" button  
                - Failed: Red-tinted "Failed - Retry" button
                
                MULTI-CONTACT: If affiliate has 2+ contacts, show "Select Contacts"
                button that opens the contact picker modal.
                ================================================================ */}
            {!loading && filteredResults.length > 0 && filteredResults.map((item) => {
              const isSelected = selectedAffiliates.has(item.id!);
              const messageKey = getMessageKey(item.id!, item.email);
              const hasMessage = hasAnyMessage(item.id!);
              const messageCount = getMessageCount(item.id!);
              const isCopied = copiedId === messageKey;
              // =====================================================================
              // BUG FIX (December 26, 2025): Use isAnyGenerating/hasAnyFailed instead
              // of checking only the primary contact's messageKey. This ensures the
              // row shows spinner/failed state when ANY contact is being processed.
              // =====================================================================
              const isGenerating = isAnyGenerating(item.id!);
              const hasFailed = hasAnyFailed(item.id!);
              const multipleContacts = getAffiliateContacts(item);
              const hasMultipleContacts = multipleContacts !== null && multipleContacts.length >= 2;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "grid grid-cols-12 gap-4 items-center px-4 py-4 border-b-2 border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors",
                    isSelected && "bg-[#ffbf23]/10 hover:bg-[#ffbf23]/20"
                  )}
                >
                  {/* Checkbox - col-span-1 */}
                  <div className="col-span-1 flex justify-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectAffiliate(item.id!)}
                      className="w-4 h-4 accent-[#ffbf23]"
                    />
                  </div>

                  {/* Affiliate Info - col-span-2 (reduced January 16, 2026 to give Discovery Method more space) */}
                  <div className="col-span-2 flex items-center gap-2 min-w-0">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 border-2 border-black dark:border-gray-600 flex items-center justify-center shrink-0 overflow-hidden">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        getSourceIcon(item.source)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black text-gray-900 dark:text-white truncate">{item.title}</h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                        <Globe size={10} className="shrink-0" />
                        <span className="truncate">{item.domain}</span>
                      </p>
                    </div>
                  </div>

                  {/* ================================================================
                      CREATOR COLUMN - January 16, 2026
                      
                      Replaced "Relevant Content" (which duplicated title/snippet)
                      with Creator info that's more useful for outreach.
                      
                      DESIGN: Matches AffiliateRow.tsx pattern (lines 1118-1148):
                      - Row 1: Creator name with verified badge
                      - Row 2: Followers in neo-brutalist yellow badge
                      
                      Priority for name (same as AffiliateRow):
                      channel?.name || personName || domain
                      
                      Followers source:
                      - YouTube/TikTok: channel.subscribers (pre-formatted)
                      - Instagram: instagramFollowers (needs formatting)
                      ================================================================ */}
                  <div className="col-span-2 text-xs min-w-0">
                    {(() => {
                      // Creator name - same pattern as AffiliateRow line 1123
                      const creatorName = item.channel?.name || item.personName || item.domain;
                      const isVerified = item.channel?.verified || item.instagramIsVerified || item.tiktokIsVerified;
                      const isSocialMedia = ['YouTube', 'TikTok', 'Instagram'].includes(item.source);
                      
                      // Get followers - Instagram needs special handling
                      const followersDisplay = item.channel?.subscribers 
                        || (item.instagramFollowers ? formatNumber(item.instagramFollowers) : null);

                      return (
                        <div className="flex flex-col gap-1">
                          {/* Row 1: Creator name + verified badge */}
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900 dark:text-white truncate" title={creatorName}>
                              {creatorName}
                            </span>
                            {isVerified && (
                              <CheckCircle2 size={12} className="text-blue-500 fill-blue-500 shrink-0" />
                            )}
                          </div>
                          
                          {/* Row 2: Followers badge - Neo-brutalist style (matches AffiliateRow) */}
                          {isSocialMedia && followersDisplay && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-[#ffbf23] text-black border-2 border-black w-fit">
                              <Users size={10} />
                              {followersDisplay}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Discovery Method - col-span-3 (Updated January 16, 2026: Fixed width, max 5 words) */}
                  <div className="col-span-3 text-xs">
                    {(item.discoveryMethod?.value || item.keyword) ? (
                      (() => {
                        const fullText = item.discoveryMethod?.value || item.keyword || '';
                        // Limit to first 5 words for consistent badge size
                        const words = fullText.split(' ');
                        const truncatedText = words.length > 5 
                          ? words.slice(0, 5).join(' ') + '...'
                          : fullText;
                        
                        return (
                          <span 
                            className="inline-block px-2 py-1 bg-white dark:bg-black border-2 border-black dark:border-gray-600 text-gray-800 dark:text-gray-200 font-bold max-w-[180px] truncate"
                            title={fullText}
                          >
                            {truncatedText}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-gray-400 italic">—</span>
                    )}
                  </div>

                  {/* Email - col-span-2 (Full email - January 16, 2026) */}
                  <div className="col-span-2 text-xs min-w-0">
                    {item.email ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Mail size={12} className="text-emerald-600 shrink-0" />
                        <span className="truncate text-gray-700 dark:text-gray-300 font-mono text-[11px]" title={item.email}>
                          {item.email}
                        </span>
                        {item.emailResults?.emails && item.emailResults.emails.length > 1 && (
                          <span className="shrink-0 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded">
                            +{item.emailResults.emails.length - 1}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-400">
                        <Mail size={10} />
                        None
                      </span>
                    )}
                  </div>

                  {/* ============================================================
                      MESSAGE ACTION BUTTON - NEO-BRUTALIST (Updated January 6th, 2026)
                      
                      Shows different states based on generation status:
                      1. isGenerating → Spinner + "Generating..." (HIGHEST PRIORITY)
                      2. hasMessage → "View Message(s)" (success state)
                      3. hasFailed → Red "Failed - Retry" button
                      4. hasMultipleContacts → Yellow "Select Contacts" button
                      5. default → Yellow "Generate" button
                      ============================================================ */}
                  <div className="col-span-2 flex justify-end">
                    {isGenerating ? (
                      // GENERATING STATE: Show spinner
                      <button
                        disabled
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-400 border-2 border-gray-300 dark:border-gray-600 cursor-not-allowed"
                      >
                        <Loader2 size={12} className="animate-spin" />
                        Generating...
                      </button>
                    ) : hasMessage ? (
                      // SUCCESS STATE: Show "View Message" button
                      <button
                        onClick={() => setViewingMessageId(messageCount > 1 ? `${item.id}` : messageKey)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase bg-[#ffbf23] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                      >
                        <MessageSquare size={12} />
                        {messageCount > 1 ? `${messageCount} Msgs` : 'View'}
                      </button>
                    ) : hasFailed ? (
                      // FAILED STATE: Show red "Failed - Retry" button
                      <button
                        onClick={() => handleGenerateForSingle(item.id!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase bg-red-500 text-white border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                      >
                        <AlertTriangle size={12} />
                        Retry
                      </button>
                    ) : hasMultipleContacts ? (
                      // MULTI-CONTACT STATE: Show "Select Contacts" button
                      <button
                        onClick={() => openContactPicker(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase bg-[#ffbf23] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                      >
                        <Users size={12} />
                        {multipleContacts!.length} Contacts
                      </button>
                    ) : (
                      // DEFAULT STATE: Show yellow "Generate" button
                      <button
                        onClick={() => handleGenerateForSingle(item.id!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase bg-[#ffbf23] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                      >
                        <Wand2 size={12} />
                        Generate
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================================================================
            MESSAGE VIEWING MODAL (Updated December 26, 2025)
            
            MULTI-MESSAGE SUPPORT:
            - When viewingMessageId contains ":" → Single message view (affiliateId:email)
            - When viewingMessageId has no ":" → Multi-message list view (just affiliateId)
            
            BUG FIX: Previously "View X Messages" only showed the primary contact's
            message. Now it shows ALL messages for the affiliate in a scrollable list.
            ================================================================ */}
        {viewingMessageId !== null && (() => {
          // Detect if this is a multi-message view (no colon = affiliateId only)
          const isMultiMessageView = !viewingMessageId.includes(':');
          
          // Extract affiliateId from messageKey (format: "affiliateId:email" or "affiliateId")
          const affiliateId = parseInt(viewingMessageId.split(':')[0], 10);
          const contactEmail = viewingMessageId.includes(':') 
            ? viewingMessageId.split(':').slice(1).join(':') // Handle emails with colons
            : null;
          
          const affiliate = filteredResults.find(a => a.id === affiliateId);
          
          // For multi-message view, get ALL messages for this affiliate
          const allMessages = isMultiMessageView 
            ? getAllMessagesForAffiliate(affiliateId)
            : [];
          
          // For single message view
          const message = !isMultiMessageView ? generatedMessages.get(viewingMessageId) : null;
          const isCopied = copiedId === viewingMessageId;
          const isRegenerating = generatingIds.has(viewingMessageId);

          return (
            <div 
              className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
              onClick={() => setViewingMessageId(null)}
            >
              <div 
                className="bg-white dark:bg-[#0a0a0a] border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_#000] dark:shadow-[8px_8px_0px_0px_#ffbf23] max-w-2xl w-full max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header - NEO-BRUTALIST */}
                <div className="px-6 py-4 border-b-4 border-black dark:border-white flex items-center justify-between bg-[#ffbf23]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center">
                      {getSourceIcon(affiliate?.source || 'Web')}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-black uppercase">{affiliate?.title}</h3>
                      <p className="text-xs text-black/70 flex items-center gap-1 font-medium">
                        <Globe size={10} />
                        {affiliate?.domain}
                        {isMultiMessageView && (
                          <span className="ml-2 px-2 py-0.5 bg-black text-white text-[10px] font-black uppercase">
                            {allMessages.length} Messages
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setViewingMessageId(null)}
                    className="w-8 h-8 bg-black text-white hover:bg-white hover:text-black border-2 border-black flex items-center justify-center transition-colors font-black"
                  >
                    ×
                  </button>
                </div>

                {/* Modal Body - NEO-BRUTALIST */}
                <div className="p-6 overflow-y-auto max-h-[calc(80vh-130px)] bg-white dark:bg-[#0a0a0a]">
                  {/* =====================================================================
                      MULTI-MESSAGE LIST VIEW - NEO-BRUTALIST (Updated January 6th, 2026)
                      ===================================================================== */}
                  {isMultiMessageView ? (
                    <div className="space-y-4">
                      {allMessages.map((msg, index) => {
                        const msgKey = getMessageKey(affiliateId, msg.email);
                        const msgCopied = copiedId === msgKey;
                        const msgRegenerating = generatingIds.has(msgKey);
                        
                        return (
                          <div key={msgKey} className="border-2 border-black dark:border-gray-600 overflow-hidden">
                            {/* Message Header with Email */}
                            <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b-2 border-black dark:border-gray-600 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Mail size={12} className="text-emerald-600" />
                                <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{msg.email || 'Primary Contact'}</span>
                              </div>
                              <span className="text-xs font-black uppercase text-gray-400">#{index + 1}</span>
                            </div>
                            
                            {/* Message Content */}
                            <div className="p-4 bg-white dark:bg-[#0f0f0f]">
                              <div className="bg-gray-50 dark:bg-gray-900 p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap border-2 border-gray-200 dark:border-gray-700 max-h-[200px] overflow-y-auto font-mono">
                                {msg.message}
                              </div>
                              
                              {/* Per-Message Actions - NEO-BRUTALIST */}
                              <div className="flex items-center justify-end gap-2 mt-3">
                                <button
                                  onClick={() => {
                                    if (affiliate) {
                                      const email = msg.email;
                                      if (email) {
                                        const contactFromArray = affiliate.emailResults?.contacts?.find(c => 
                                          c.emails?.includes(email)
                                        );
                                        
                                        if (contactFromArray) {
                                          handleGenerateForContact(affiliate, {
                                            email: email,
                                            firstName: contactFromArray.firstName,
                                            lastName: contactFromArray.lastName,
                                            title: contactFromArray.title,
                                          });
                                        } else {
                                          handleGenerateForContact(affiliate, {
                                            email: email,
                                            firstName: affiliate.emailResults?.firstName,
                                            lastName: affiliate.emailResults?.lastName,
                                            title: affiliate.emailResults?.title,
                                          });
                                        }
                                      } else {
                                        handleGenerateForContact(affiliate);
                                      }
                                    }
                                  }}
                                  disabled={msgRegenerating}
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase transition-all border-2",
                                    msgRegenerating
                                      ? "bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed"
                                      : "bg-white text-black border-black hover:bg-gray-100"
                                  )}
                                >
                                  <RefreshCw size={12} className={msgRegenerating ? "animate-spin" : ""} />
                                  {msgRegenerating ? '...' : 'Redo'}
                                </button>
                                <button
                                  onClick={() => handleCopyMessage(msgKey)}
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase transition-all border-2 border-black",
                                    msgCopied
                                      ? "bg-emerald-500 text-white"
                                      : "bg-[#ffbf23] text-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
                                  )}
                                >
                                  {msgCopied ? (
                                    <>
                                      <Check size={12} />
                                      Done!
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={12} />
                                      Copy
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* =====================================================================
                       SINGLE MESSAGE VIEW - NEO-BRUTALIST (Updated January 6th, 2026)
                       ===================================================================== */
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={14} className="text-[#ffbf23]" />
                        <span className="text-sm font-black uppercase text-gray-800 dark:text-gray-200">AI Generated Message</span>
                        {contactEmail && (
                          <span className="text-xs text-black bg-[#ffbf23] px-2 py-0.5 font-bold border border-black">
                            to {contactEmail}
                          </span>
                        )}
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900 p-5 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap border-2 border-gray-200 dark:border-gray-700 font-mono">
                        {message}
                      </div>

                      {/* Affiliate Details - NEO-BRUTALIST */}
                      {affiliate && (
                        <div className="mt-6 pt-6 border-t-2 border-gray-200 dark:border-gray-700">
                          <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Affiliate Details</h4>
                          <div className="grid grid-cols-2 gap-3">
                            {affiliate.personName && (
                              <div className="p-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700">
                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Contact Name</p>
                                <p className="text-sm font-black text-gray-900 dark:text-white">{affiliate.personName}</p>
                              </div>
                            )}
                            {(contactEmail || affiliate.email) && (
                              <div className="p-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700">
                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Email</p>
                                <p className="text-sm font-black text-gray-900 dark:text-white truncate">{contactEmail || affiliate.email}</p>
                              </div>
                            )}
                            <div className="p-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700">
                              <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Platform</p>
                              <div className="flex items-center gap-1.5">
                                {getSourceIcon(affiliate.source)}
                                <p className="text-sm font-black text-gray-900 dark:text-white">{affiliate.source}</p>
                              </div>
                            </div>
                            {affiliate.keyword && (
                              <div className="p-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700">
                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Keyword</p>
                                <p className="text-sm font-black text-gray-900 dark:text-white">{affiliate.keyword}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Modal Footer - NEO-BRUTALIST - Only show for single message view */}
                {!isMultiMessageView && (
                  <div className="px-6 py-4 border-t-4 border-black dark:border-white bg-gray-100 dark:bg-gray-900 flex items-center justify-between">
                    <button
                      onClick={() => setViewingMessageId(null)}
                      className="px-4 py-2 text-sm font-black uppercase text-gray-600 hover:text-black dark:hover:text-white transition-colors"
                    >
                      Close
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (affiliate) {
                            if (contactEmail) {
                              const contactFromArray = affiliate.emailResults?.contacts?.find(c => 
                                c.emails?.includes(contactEmail)
                              );
                              
                              if (contactFromArray) {
                                handleGenerateForContact(affiliate, {
                                  email: contactEmail,
                                  firstName: contactFromArray.firstName,
                                  lastName: contactFromArray.lastName,
                                  title: contactFromArray.title,
                                });
                              } else {
                                handleGenerateForContact(affiliate, {
                                  email: contactEmail,
                                  firstName: affiliate.emailResults?.firstName,
                                  lastName: affiliate.emailResults?.lastName,
                                  title: affiliate.emailResults?.title,
                                });
                              }
                            } else {
                              handleGenerateForContact(affiliate);
                            }
                          }
                        }}
                        disabled={isRegenerating}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 text-sm font-black uppercase transition-all border-2",
                          isRegenerating
                            ? "bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed"
                            : "bg-white text-black border-black hover:bg-gray-100"
                        )}
                      >
                        <RefreshCw size={14} className={isRegenerating ? "animate-spin" : ""} />
                        {isRegenerating ? '...' : 'Redo'}
                      </button>
                      <button
                        onClick={() => {
                          handleCopyMessage(viewingMessageId);
                          setTimeout(() => setViewingMessageId(null), 1500);
                        }}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 text-sm font-black uppercase transition-all border-2 border-black",
                          isCopied
                            ? "bg-emerald-500 text-white"
                            : "bg-[#ffbf23] text-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
                        )}
                      >
                        {isCopied ? (
                          <>
                            <Check size={14} />
                            Done!
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Simple Close Footer for Multi-Message View - NEO-BRUTALIST */}
                {isMultiMessageView && (
                  <div className="px-6 py-4 border-t-4 border-black dark:border-white bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                    <button
                      onClick={() => setViewingMessageId(null)}
                      className="px-6 py-2 text-sm font-black uppercase text-black bg-white border-2 border-black hover:bg-gray-100 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ================================================================
            CONTACT PICKER MODAL (December 25, 2025)
            
            Allows users to select which contact(s) to generate emails for
            when Lusha returns multiple contacts for an affiliate.
            
            Shows:
            - List of all contacts with name, title, email
            - Checkboxes for selection
            - Credit cost indicator (1 credit per email)
            - Generate button with count
            ================================================================ */}
        {/* ================================================================
            CONTACT PICKER MODAL - NEO-BRUTALIST (Updated January 6th, 2026)
            ================================================================ */}
        {contactPicker.isOpen && contactPicker.affiliate && (
          <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setContactPicker(prev => ({ ...prev, isOpen: false }))}
          >
            <div 
              className="bg-white dark:bg-[#0a0a0a] border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_#000] dark:shadow-[8px_8px_0px_0px_#ffbf23] max-w-lg w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header - NEO-BRUTALIST */}
              <div className="px-6 py-4 border-b-4 border-black dark:border-white bg-[#ffbf23]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center">
                      <Users size={20} className="text-black" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-black uppercase">Select Contacts</h3>
                      <p className="text-xs text-black/70 font-medium">
                        {contactPicker.affiliate.domain}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setContactPicker(prev => ({ ...prev, isOpen: false }))}
                    className="w-8 h-8 bg-black text-white hover:bg-white hover:text-black border-2 border-black flex items-center justify-center transition-colors font-black"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Contact List - NEO-BRUTALIST */}
              <div className="p-4 overflow-y-auto max-h-[50vh] bg-white dark:bg-[#0a0a0a]">
                <p className="text-xs text-gray-500 mb-3 font-medium">
                  Select which contacts you&apos;d like to generate personalized emails for:
                </p>
                
                <div className="space-y-2">
                  {contactPicker.contacts.map((contact) => {
                    const isSelected = contactPicker.selectedContacts.has(contact.email);
                    const displayName = contact.fullName || 
                      [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 
                      'Unknown';
                    const hasExistingMessage = generatedMessages.has(
                      getMessageKey(contactPicker.affiliateId!, contact.email)
                    );
                    
                    return (
                      <div
                        key={contact.email}
                        onClick={() => toggleContactSelection(contact.email)}
                        className={cn(
                          "flex items-center gap-3 p-3 border-2 cursor-pointer transition-all",
                          isSelected 
                            ? "bg-[#ffbf23]/20 border-black" 
                            : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-black dark:hover:border-white"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 accent-[#ffbf23]"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                              {displayName}
                            </p>
                            {hasExistingMessage && (
                              <span className="shrink-0 px-1.5 py-0.5 bg-emerald-500 text-white text-[9px] font-black uppercase border border-black">
                                Done
                              </span>
                            )}
                          </div>
                          {contact.title && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 font-medium">
                              <Briefcase size={10} />
                              {contact.title}
                            </p>
                          )}
                          <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-0.5 font-mono">
                            <Mail size={10} />
                            {contact.email}
                          </p>
                        </div>
                        
                        <ChevronRight size={14} className={cn(
                          "text-gray-300 transition-colors",
                          isSelected && "text-black"
                        )} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer - NEO-BRUTALIST */}
              <div className="px-6 py-4 border-t-4 border-black dark:border-white bg-gray-100 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  {/* Credit cost indicator */}
                  <div className="text-xs">
                    {contactPicker.selectedContacts.size > 0 ? (
                      <span className="flex items-center gap-1.5">
                        <Sparkles size={12} className="text-[#ffbf23]" />
                        <span className="text-gray-600 dark:text-gray-400 font-medium">
                          Uses{' '}
                          <span className="font-black text-black dark:text-white">
                            {contactPicker.selectedContacts.size} credit{contactPicker.selectedContacts.size !== 1 ? 's' : ''}
                          </span>
                        </span>
                      </span>
                    ) : (
                      <span className="text-gray-400 font-medium">Select contacts</span>
                    )}
                  </div>
                  
                  {/* Action buttons - NEO-BRUTALIST */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setContactPicker(prev => ({ ...prev, isOpen: false }))}
                      className="px-3 py-1.5 text-xs font-black uppercase text-gray-600 hover:text-black transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerateForSelectedContacts}
                      disabled={contactPicker.selectedContacts.size === 0}
                      className={cn(
                        "flex items-center gap-2 px-4 py-1.5 text-xs font-black uppercase transition-all border-2",
                        contactPicker.selectedContacts.size > 0
                          ? "bg-[#ffbf23] text-black border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
                          : "bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed"
                      )}
                    >
                      <Wand2 size={12} />
                      Generate {contactPicker.selectedContacts.size > 0 
                        ? `(${contactPicker.selectedContacts.size})`
                        : ''
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            NOTIFICATIONS (January 5th, 2026)
            
            REMOVED: Custom toast notification UI.
            NOW USING: Global Sonner Toaster (configured in src/app/layout.tsx).
            
            Sonner automatically renders toasts at bottom-right with:
            - richColors (green=success, red=error, yellow=warning, blue=info)
            - Close button on each toast
            - 4 second auto-dismiss
            - Smooth animations
            
            To trigger toasts, just call:
              import { toast } from 'sonner';
              toast.success('Success!');
              toast.error('Error!');
              toast.warning('Warning!');
              toast.info('Info');
            ================================================================ */}
      </div>
    </>
  );
}
