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

import { useState, useMemo, useEffect, useRef } from 'react';
// =============================================================================
// January 17th, 2026: Added Link for "Find Affiliates" button navigation
// When clicked, routes to /find?openModal=true to auto-open the search modal
// =============================================================================
import Link from 'next/link';
// Removed: import { toast } from 'sonner'; 
// January 17, 2026: Now using custom neo-brutalist toast component (see showToast function)
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
  Pencil,  // Added January 16, 2026 for edit message functionality
  Save,  // Added January 16, 2026 for save edited message
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
// NOTIFICATION SYSTEM UPDATE (January 17, 2026):
// Now uses custom neo-brutalist toast component to match the rest of the app.
// Call showToast('success'|'error'|'warning'|'info', title, message?) to show toasts.
// See the customToast state and JSX at the bottom of this component.
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
  // IN-FLIGHT GENERATION TRACKING (January 24th, 2026)
  // 
  // PURPOSE: Prevents duplicate API calls when user clicks "Generate" rapidly.
  // 
  // PROBLEM SOLVED:
  // React's useState updates are async. When user clicks "Generate" multiple
  // times in quick succession, the `generatingIds` state check happens BEFORE
  // the state update commits. This causes multiple API calls to fire, each
  // consuming AI credits - a significant revenue/UX issue.
  // 
  // SOLUTION:
  // useRef provides synchronous, immediate updates that persist across renders
  // without triggering re-renders. We check this Set BEFORE starting any API
  // call. If the messageKey is already in the Set, we return early.
  // 
  // KEY FORMAT: Same as generatingIds - "affiliateId:email" or "affiliateId"
  // 
  // LIFECYCLE:
  // 1. User clicks "Generate" → Check if messageKey in Set → If yes, return
  // 2. Add messageKey to Set (synchronous, immediate)
  // 3. Make API call
  // 4. Remove from Set in `finally` block (always runs, even on error)
  // 
  // NOTE: This does NOT fix the navigation-away issue (see outreach page docs).
  // If user navigates away and back while generation is in-progress, the ref
  // resets. That requires database-level status tracking (future enhancement).
  // 
  // @see useAffiliates.ts findEmail() for the same pattern used in email lookup
  // =========================================================================
  const inFlightGenerations = useRef<Set<string>>(new Set());
  
  // =========================================================================
  // BULK GENERATION IN-FLIGHT FLAG (January 24th, 2026)
  // 
  // Prevents duplicate bulk generation when user rapidly clicks the bulk
  // generate button. Same concept as inFlightGenerations but for the entire
  // bulk operation rather than individual affiliates.
  // =========================================================================
  const isBulkGenerationInFlight = useRef<boolean>(false);
  
  // =========================================================================
  // NOTE (January 17, 2026): Using custom neo-brutalist toast component.
  // Call showToast('success'|'error'|'warning'|'info', title, message?)
  // See customToast state above and JSX at bottom of component.
  // =========================================================================
  
  const [copiedId, setCopiedId] = useState<string | null>(null); // Now stores "affiliateId:email" or "affiliateId"
  const [viewingMessageId, setViewingMessageId] = useState<string | null>(null); // Now stores "affiliateId:email" or "affiliateId"
  
  // =========================================================================
  // MULTI-MESSAGE PAGINATION STATE (January 16, 2026)
  // Tracks which message is currently visible in the multi-message carousel
  // =========================================================================
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  
  // =========================================================================
  // MESSAGE EDITING STATE (January 16, 2026)
  // 
  // Allows users to edit AI-generated messages and save their changes.
  // - editingMessageKey: The message key currently being edited (null = not editing)
  // - editedMessageText: The current text in the edit textarea
  // - isSavingEdit: Loading state while saving to database
  // =========================================================================
  const [editingMessageKey, setEditingMessageKey] = useState<string | null>(null);
  const [editedMessageText, setEditedMessageText] = useState('');
  
  // =========================================================================
  // CUSTOM TOAST STATE (January 17, 2026)
  // 
  // Neo-brutalist toast notifications to match the rest of the app.
  // This replaces Sonner toast calls with custom styled toasts.
  // Types: 'success' | 'error' | 'warning' | 'info'
  // =========================================================================
  const [customToast, setCustomToast] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
  } | null>(null);
  
  // Helper function to show custom toast
  const showToast = (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => {
    setCustomToast({ show: true, type, title, message });
    setTimeout(() => {
      setCustomToast(prev => prev ? { ...prev, show: false } : null);
    }, 4000);
  };
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const { savedAffiliates, isLoading: loading } = useSavedAffiliates();
  
  // =========================================================================
  // LOAD SAVED AI-GENERATED MESSAGES ON MOUNT (Updated January 22, 2026)
  // 
  // When affiliates are loaded from the database, populate the generatedMessages
  // state with any previously saved AI-generated messages. This ensures that
  // messages persist across page refreshes without re-generation.
  //
  // MULTI-CONTACT SUPPORT: We now use the key format "affiliateId:email" to
  // support multiple messages per affiliate. We load both:
  // 1. Per-contact messages from aiGeneratedMessages JSONB
  // 2. Legacy single message from aiGeneratedMessage (backwards compatibility)
  //
  // BUG FIX (January 22, 2026): Added validation that messages are non-empty
  // strings before storing. Empty or malformed messages are skipped.
  // =========================================================================
  useEffect(() => {
    if (savedAffiliates.length > 0) {
      const savedMessages = new Map<string, string>();
      
      savedAffiliates.forEach((affiliate) => {
        if (affiliate.id) {
          // =====================================================================
          // LOAD PER-CONTACT AI MESSAGES FROM DATABASE (December 25, 2025)
          // =====================================================================
          // 
          // The ai_generated_messages column stores a JSONB object with structure:
          //   { "email@example.com": { message, subject, generatedAt }, ... }
          // 
          // This supports unlimited contacts per affiliate - each email is a key.
          // 
          // IMPORTANT - DATA FORMAT HANDLING:
          // ---------------------------------
          // The data can come in two formats depending on how it was saved:
          // 
          // 1. CORRECT FORMAT (saved with sql.json()):
          //    { "email": { "message": "...", "subject": "...", "generatedAt": "..." } }
          //    → data is an OBJECT, directly usable
          // 
          // 2. LEGACY FORMAT (saved with JSON.stringify()::jsonb - double-encoded):
          //    { "email": "{\"message\":\"...\",\"subject\":\"...\",\"generatedAt\":\"...\"}" }
          //    → data is a STRING containing JSON, needs JSON.parse()
          // 
          // We handle BOTH formats for backwards compatibility with existing data.
          // New saves use sql.json() so they're stored correctly as objects.
          // =====================================================================
          if (affiliate.aiGeneratedMessages && typeof affiliate.aiGeneratedMessages === 'object') {
            Object.entries(affiliate.aiGeneratedMessages).forEach(([email, data]) => {
              let messageData: { message?: string; subject?: string; generatedAt?: string } | null = null;
              
              // Handle double-encoded JSON strings (legacy format)
              if (typeof data === 'string') {
                const strData = data as string;
                try {
                  messageData = JSON.parse(strData);
                } catch {
                  // If parse fails and it's a non-empty string, use it directly as the message
                  if (strData.trim()) {
                    const key = `${affiliate.id}:${email}`;
                    savedMessages.set(key, strData);
                  }
                  return;
                }
              } else if (data && typeof data === 'object' && 'message' in data) {
                // Correct format - data is already an object
                messageData = data as { message?: string };
              }
              
              // Extract and store the message if valid
              if (messageData && messageData.message && typeof messageData.message === 'string' && messageData.message.trim()) {
                const key = `${affiliate.id}:${email}`;
                savedMessages.set(key, messageData.message);
              }
            });
          }
          
          // Load legacy single message (backwards compatibility)
          // Only if we haven't already loaded a per-contact message for this email
          // BUG FIX (January 22, 2026): Validate message is a non-empty string
          if (affiliate.aiGeneratedMessage && typeof affiliate.aiGeneratedMessage === 'string' && affiliate.aiGeneratedMessage.trim()) {
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
      
      // =====================================================================
      // MERGE DATABASE MESSAGES WITH IN-MEMORY STATE
      // =====================================================================
      // 
      // Merge strategy: DB messages are the base, in-memory state overrides.
      // This ensures:
      // - Fresh page load: All DB messages are loaded
      // - Active session: Newly generated messages (in-memory) take precedence
      // - Works for any number of emails (1, 10, or 100 per affiliate)
      // =====================================================================
      if (savedMessages.size > 0) {
        setGeneratedMessages(prev => {
          const merged = new Map(savedMessages);
          prev.forEach((value, key) => {
            // Override DB value only if in-memory value is valid
            if (value && typeof value === 'string' && value.trim()) {
              merged.set(key, value);
            }
          });
          return merged;
        });
      }
      
      // =====================================================================
      // DETECT IN-PROGRESS GENERATIONS (January 24th, 2026)
      // Updated: Also REMOVE from generatingIds when generation completes
      // 
      // When user navigates away while generation is running and comes back,
      // we need to show the spinner for any affiliates that have generation
      // in progress.
      // 
      // Logic: If aiGenerationStartedAt > aiGeneratedAt → In progress
      // AND startedAt is within last 60 seconds (timeout protection)
      // 
      // IMPORTANT: This now also REMOVES from generatingIds when:
      // - Generation completed (generatedAt >= startedAt)
      // - Or timeout exceeded (startedAt > 60 seconds ago)
      // =====================================================================
      const inProgressIds = new Set<string>();
      const completedIds = new Set<string>(); // IDs that finished generating
      const now = Date.now();
      
      savedAffiliates.forEach((affiliate) => {
        if (affiliate.id) {
          const messageKey = affiliate.email 
            ? `${affiliate.id}:${affiliate.email}` 
            : `${affiliate.id}`;
          
          if (affiliate.aiGenerationStartedAt) {
            const startedAt = new Date(affiliate.aiGenerationStartedAt).getTime();
            const generatedAt = affiliate.aiGeneratedAt 
              ? new Date(affiliate.aiGeneratedAt).getTime() 
              : 0;
            
            // Check if generation is in progress:
            // - Started within last 60 seconds
            // - AND generated_at is before started_at (not completed yet)
            const isInProgress = (now - startedAt) < 60000 && 
              (generatedAt === 0 || generatedAt < startedAt);
            
            if (isInProgress) {
              inProgressIds.add(messageKey);
              console.log(`[Outreach] 🔄 Detected in-progress generation for ${messageKey} (started ${Math.round((now - startedAt) / 1000)}s ago)`);
            } else if (generatedAt >= startedAt) {
              // Generation completed - mark for removal from generatingIds
              completedIds.add(messageKey);
            }
          }
        }
      });
      
      // Update generatingIds: ADD in-progress, REMOVE completed
      setGeneratingIds(prev => {
        const updated = new Set(prev);
        
        // Add in-progress IDs
        inProgressIds.forEach(id => updated.add(id));
        
        // Remove completed IDs (generation finished)
        completedIds.forEach(id => {
          if (updated.has(id)) {
            console.log(`[Outreach] ✅ Generation completed for ${id} - removing spinner`);
            updated.delete(id);
          }
        });
        
        return updated;
      });
    }
  }, [savedAffiliates]);
  
  // =========================================================================
  // NOTIFICATION HELPERS (Updated January 17, 2026)
  // 
  // NOW USING: Custom neo-brutalist toast component (showToast function above).
  // 
  // To show notifications anywhere in this component:
  //   showToast('success', 'Title');           // Green success toast
  //   showToast('error', 'Title', 'Details');  // Red error toast
  //   showToast('warning', 'Title');           // Yellow warning toast
  //   showToast('info', 'Title');              // Blue info toast
  // 
  // Custom toast auto-dismisses after 4s, positioned at bottom-right.
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
  //
  // BUG FIX (January 22, 2026): Only counts non-empty messages
  // =========================================================================
  const hasAnyMessage = (affiliateId: number): boolean => {
    const prefix = `${affiliateId}:`;
    // Check for keys with email or just the ID
    for (const [key, message] of generatedMessages.entries()) {
      if (key === `${affiliateId}` || key.startsWith(prefix)) {
        // BUG FIX: Only count if message is non-empty
        if (message && typeof message === 'string' && message.trim()) {
          return true;
        }
      }
    }
    return false;
  };
  
  // =========================================================================
  // HELPER: GET MESSAGE COUNT FOR AFFILIATE (December 25, 2025)
  // =========================================================================
  // Returns the number of valid (non-empty) generated messages for an affiliate.
  // Supports any number of contacts - counts all keys matching "affiliateId:*".
  // =========================================================================
  const getMessageCount = (affiliateId: number): number => {
    const prefix = `${affiliateId}:`;
    let count = 0;
    for (const [key, message] of generatedMessages.entries()) {
      if (key === `${affiliateId}` || key.startsWith(prefix)) {
        // Only count valid non-empty messages
        if (message && typeof message === 'string' && message.trim()) {
          count++;
        }
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
  // =========================================================================
  // Returns an array of { email, message } for all generated messages belonging
  // to this affiliate. Used by the multi-message viewing modal.
  // 
  // Key format: "affiliateId:email@example.com" (supports any number of emails)
  // Only returns valid, non-empty messages.
  // =========================================================================
  const getAllMessagesForAffiliate = (affiliateId: number): Array<{ email: string; message: string }> => {
    const prefix = `${affiliateId}:`;
    const messages: Array<{ email: string; message: string }> = [];
    
    generatedMessages.forEach((message, key) => {
      if (key === `${affiliateId}` || key.startsWith(prefix)) {
        // Only include valid non-empty messages
        if (message && typeof message === 'string' && message.trim()) {
          // Extract email from key (format: "affiliateId:email" or just "affiliateId")
          const email = key.includes(':') 
            ? key.split(':').slice(1).join(':') // Handle emails with colons
            : ''; // Legacy key format without email
          messages.push({ email, message });
        }
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
  // Updated: January 24th, 2026 - Added in-flight duplicate prevention
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
    
    // =========================================================================
    // IN-FLIGHT DUPLICATE PREVENTION (January 24th, 2026)
    // 
    // Check if this messageKey is already being processed. If so, return early
    // to prevent duplicate API calls and duplicate credit consumption.
    // 
    // This check is SYNCHRONOUS (useRef) unlike the generatingIds state which
    // is async. This prevents race conditions when user clicks rapidly.
    // =========================================================================
    if (inFlightGenerations.current.has(messageKey)) {
      console.log(`[Outreach] ⚠️ Ignoring duplicate generation request for ${messageKey} - already in flight`);
      return;
    }
    
    // Mark as in-flight IMMEDIATELY (synchronous) before any async operations
    inFlightGenerations.current.add(messageKey);
    
    // Add to generating set (shows spinner - async state update for UI)
    setGeneratingIds(prev => new Set(prev).add(messageKey));
    
    // Clear any previous failure state
    setFailedIds(prev => {
      const next = new Set(prev);
      next.delete(messageKey);
      return next;
    });
    
    // Flag to track if we should skip cleanup (for "already in progress" case)
    // January 24th, 2026: When backend says generation is in progress elsewhere,
    // we want to KEEP the spinner showing instead of removing it
    let skipCleanup = false;

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
        // BUG FIX (January 22, 2026): Validate message is non-empty before storing
        // =====================================================================
        const messageContent = data.message;
        
        if (messageContent && typeof messageContent === 'string' && messageContent.trim()) {
          setGeneratedMessages(prev => {
            const next = new Map(prev);
            next.set(messageKey, messageContent);
            return next;
          });
          
          // Show success notification
          // i18n: January 10th, 2026
          showToast('success', t.toasts.success.emailGenerated);
        } else {
          // API returned success but message is empty - treat as error
          console.error('[Outreach] ❌ API returned success but message is empty:', data);
          setFailedIds(prev => new Set(prev).add(messageKey));
          showToast('error', t.toasts.error.aiGenerationFailed);
          return; // Exit early to skip credits refresh
        }

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
        // Updated January 24th, 2026: Handle "already in progress" gracefully
        // =====================================================================
        
        // =====================================================================
        // SPECIAL CASE: Generation already in progress (409 Conflict)
        // 
        // This happens when user navigates away and back while generation is
        // running, then clicks "Generate" before the spinner loads.
        // 
        // Instead of showing an error:
        // 1. Keep the spinner showing (skipCleanup = true)
        // 2. Show a friendly info message
        // 3. Don't mark as failed
        // 
        // The original generation will complete and update the database.
        // When user refreshes or the data reloads, they'll see the message.
        // =====================================================================
        if (response.status === 409 && data.inProgress) {
          console.log(`[Outreach] ℹ️ Generation already in progress for ${messageKey} - keeping spinner`);
          skipCleanup = true; // Don't remove from generatingIds in finally block
          showToast('info', 'Email generation is already in progress. Please wait.');
          return; // Exit early, finally will still run but skipCleanup prevents removal
        }
        
        console.error('AI generation failed:', data.error);
        setFailedIds(prev => new Set(prev).add(messageKey));
        
        // Show user-friendly error message based on error type
        // January 5th, 2026: Using global Sonner toast instead of local notification
        // i18n: January 10th, 2026
        if (response.status === 402) {
          showToast('warning', t.toasts.warning.insufficientAICredits);
        } else if (data.error?.includes('webhook not configured')) {
          showToast('error', t.toasts.error.aiServiceNotConfigured);
        } else {
          showToast('error', data.error || t.toasts.error.aiGenerationFailed);
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
      showToast('error', t.toasts.error.aiConnectionFailed);
    } finally {
      // =========================================================================
      // CLEANUP (Updated January 24th, 2026)
      // 
      // Remove from tracking mechanisms UNLESS skipCleanup is true.
      // 
      // skipCleanup = true when backend returns 409 "already in progress",
      // meaning another request is still generating. In that case, we want
      // to KEEP the spinner showing to indicate generation is happening.
      // 
      // 1. inFlightGenerations (useRef) - always clear to allow future clicks
      // 2. generatingIds (useState) - only clear if skipCleanup is false
      // =========================================================================
      inFlightGenerations.current.delete(messageKey);
      
      // Only remove spinner if we should (not when generation is in progress elsewhere)
      if (!skipCleanup) {
        setGeneratingIds(prev => {
          const next = new Set(prev);
          next.delete(messageKey);
          return next;
        });
      }
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
  // Updated: January 24th, 2026 - Added in-flight duplicate prevention
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
    
    // =========================================================================
    // IN-FLIGHT DUPLICATE PREVENTION (January 24th, 2026)
    // 
    // Prevent duplicate bulk generation if user rapidly clicks the button.
    // The button is disabled by generatingIds.size > 0, but that's async.
    // This synchronous check catches rapid clicks before state updates.
    // =========================================================================
    if (isBulkGenerationInFlight.current) {
      console.log('[Outreach] ⚠️ Ignoring duplicate bulk generation request - already in flight');
      return;
    }
    
    // Mark bulk generation as in-flight immediately (synchronous)
    isBulkGenerationInFlight.current = true;
    
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
      
      // =========================================================================
      // IN-FLIGHT TRACKING FOR INDIVIDUAL AFFILIATE (January 24th, 2026)
      // 
      // Skip if this specific affiliate is already being processed.
      // This prevents duplicate API calls for the same affiliate if user
      // somehow triggers generation through both bulk and single paths.
      // =========================================================================
      if (inFlightGenerations.current.has(messageKey)) {
        console.log(`[Outreach] ⚠️ Skipping ${messageKey} in bulk - already in flight`);
        continue;
      }
      
      // Mark as in-flight (synchronous)
      inFlightGenerations.current.add(messageKey);
      
      // Add to generating set (async UI state)
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
          // BUG FIX (January 22, 2026): Validate message is non-empty before storing
          const messageContent = data.message;
          
          if (messageContent && typeof messageContent === 'string' && messageContent.trim()) {
            setGeneratedMessages(prev => {
              const next = new Map(prev);
              next.set(messageKey, messageContent);
              return next;
            });
            successCount++;
          } else {
            // API returned success but message is empty - treat as error
            console.error(`[Outreach] Bulk generation returned empty message for ${affiliate.domain}`);
            setFailedIds(prev => new Set(prev).add(messageKey));
            failCount++;
          }
        } else {
          // FAILURE: Mark as failed
          console.error(`Failed to generate for ${affiliate.domain}:`, data.error);
          setFailedIds(prev => new Set(prev).add(messageKey));
          failCount++;
        }
        
        // =====================================================================
        // CLEANUP (Updated January 24th, 2026)
        // Remove from both in-flight tracking (sync) and generating set (async)
        // =====================================================================
        inFlightGenerations.current.delete(messageKey);
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
        
        // =====================================================================
        // CLEANUP ON ERROR (Updated January 24th, 2026)
        // Ensure in-flight tracking is cleared even on network errors
        // =====================================================================
        inFlightGenerations.current.delete(messageKey);
        setGeneratingIds(prev => {
          const next = new Set(prev);
          next.delete(messageKey);
          return next;
        });
      }
    }
    
    // =========================================================================
    // BULK GENERATION CLEANUP (January 24th, 2026)
    // 
    // Reset the bulk in-flight flag so user can trigger another bulk generation.
    // This is placed after the loop completes (success or partial failure).
    // =========================================================================
    isBulkGenerationInFlight.current = false;
    
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
      showToast('success', `${successCount} ${successCount !== 1 ? t.dashboard.outreach.emails : t.dashboard.outreach.email} generated!`, t.toasts.success.bulkEmailsGenerated);
    } else if (failCount > 0) {
      // Some or all failed
      const message = `${t.toasts.error.bulkGenerationFailed} ${successCount} ${t.toasts.warning.partialBulkFailure} ${total}. ${failCount} ${t.dashboard.outreach.failedRetry}`;
      if (failCount === total) {
        showToast('error', message);
      } else {
        showToast('warning', message);
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
      showToast('success', t.toasts.success.messageCopied);
    }
  };

  // =========================================================================
  // START EDITING MESSAGE (January 16, 2026)
  // 
  // Enters edit mode for a specific message. Copies the current message
  // text into the edit textarea.
  // =========================================================================
  const handleStartEdit = (messageKey: string) => {
    const message = generatedMessages.get(messageKey);
    if (message) {
      setEditingMessageKey(messageKey);
      setEditedMessageText(message);
    }
  };

  // =========================================================================
  // CANCEL EDITING (January 16, 2026)
  // =========================================================================
  const handleCancelEdit = () => {
    setEditingMessageKey(null);
    setEditedMessageText('');
  };

  // =========================================================================
  // SAVE EDITED MESSAGE (January 16, 2026)
  // 
  // Saves the edited message to the database and updates local state.
  // Uses PATCH /api/ai/outreach to persist the changes.
  // =========================================================================
  // January 17, 2026: Updated to use i18n translations for toast messages
  const handleSaveEdit = async (affiliateId: number, contactEmail: string | null) => {
    if (!editedMessageText.trim()) {
      showToast('error', t.toasts.error.messageEmpty);
      return;
    }

    setIsSavingEdit(true);

    try {
      const response = await fetch('/api/ai/outreach', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliateId,
          contactEmail: contactEmail || 'primary',
          message: editedMessageText,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Update local state with the edited message
        const messageKey = editingMessageKey!;
        setGeneratedMessages(prev => {
          const next = new Map(prev);
          next.set(messageKey, editedMessageText);
          return next;
        });

        // Exit edit mode
        setEditingMessageKey(null);
        setEditedMessageText('');
        
        showToast('success', t.toasts.success.messageSaved);
      } else {
        showToast('error', data.error || t.toasts.error.messageSaveFailed);
      }
    } catch (error) {
      console.error('Error saving edited message:', error);
      showToast('error', t.toasts.error.messageSaveFailed);
    } finally {
      setIsSavingEdit(false);
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

          {/* =================================================================
              Find Button - January 17th, 2026: Now functional!
              
              PREVIOUS: Button was non-functional (just styled, no onClick)
              NEW: Wrapped with Link to /find?openModal=true
              
              When clicked:
              1. Navigates to /find page
              2. Query param openModal=true triggers auto-open of search modal
              3. User can immediately start searching without clicking again
              ================================================================= */}
          <Link href="/find?openModal=true">
            <button 
              className="flex items-center gap-2 px-4 py-2 bg-[#ffbf23] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
            >
              <Plus size={14} strokeWidth={3} /> {t.dashboard.header.findAffiliates}
            </button>
          </Link>
        </div>
      </header>

      {/* =============================================================================
          CONTENT AREA - NEW DESIGN (January 6th, 2026)
          
          OVERFLOW FIX - January 23, 2026
          Added overflow-x-hidden to prevent horizontal scrolling when results table
          renders with long content. This ensures the filter bar stays visible.
          ============================================================================= */}
      <div className="flex-1 p-8 overflow-y-auto overflow-x-hidden">

        {/* =============================================================================
            FILTERS ROW - DashboardDemo.tsx EXACT STYLING
            
            LAYOUT FIX - January 23, 2026
            FilterPanel now uses a dropdown approach so filter pills don't take 
            up horizontal space.
            ============================================================================= */}
        <div className="flex flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
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
                {/* January 17, 2026: Using i18n translations for selection actions */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#ffbf23] border-2 border-black text-xs font-black text-black">
                  <Check size={12} />
                  {selectedAffiliates.size} {t.dashboard.outreach.selected.toUpperCase()}
                </div>
                <button
                  onClick={handleSelectAll}
                  className="text-xs font-black uppercase text-gray-600 hover:text-black transition-colors px-3 py-1.5 border-2 border-gray-300 dark:border-gray-600 hover:border-black"
                >
                  {t.dashboard.outreach.deselectAll}
                </button>
              </>
            )}
            {/* January 17, 2026: Using i18n translation */}
            {selectedAffiliates.size === 0 && filteredResults.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="text-xs font-black uppercase text-gray-600 hover:text-black transition-colors px-3 py-1.5 border-2 border-gray-300 dark:border-gray-600 hover:border-black"
              >
                {t.dashboard.outreach.selectAll}
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
              {/* January 17, 2026: Using i18n translations */}
              {bulkProgress ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {bulkProgress.current}/{bulkProgress.total}
                </>
              ) : generatingIds.size > 0 ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t.dashboard.outreach.generating}
                </>
              ) : (
                <>
                  <Wand2 size={14} />
                  {t.dashboard.outreach.generate} ({selectedAffiliates.size})
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
            {/* January 17, 2026: Using i18n translation */}
            <div className="col-span-2">{t.dashboard.table.creator}</div>
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
              {/* January 17, 2026: Using i18n translation */}
              <p className="text-gray-500 text-sm mt-4 font-medium">{t.dashboard.outreach.loading}</p>
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
          
          {/* No Results State - Neo-brutalist (Updated January 17, 2026: i18n) */}
          {!loading && affiliatesWithEmail.length > 0 && filteredResults.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4 border-2 border-gray-100 dark:border-gray-800">
                <Search size={24} className="text-gray-300" />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">
                {t.dashboard.outreach.noResults.title}
              </h3>
              <p className="text-gray-500 text-sm max-w-xs">
                {t.dashboard.outreach.noResults.subtitle}
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
                  {/* January 17, 2026: Show favicon for Web results using Google's favicon service */}
                  <div className="col-span-2 flex items-center gap-2 min-w-0">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 border-2 border-black dark:border-gray-600 flex items-center justify-center shrink-0 overflow-hidden">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : item.source === 'Web' && item.domain ? (
                        /* Web results: Show favicon from Google's service */
                        <img 
                          src={`https://www.google.com/s2/favicons?domain=${item.domain}&sz=32`} 
                          alt={item.domain}
                          className="w-6 h-6"
                        />
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
                      /* January 17, 2026: Using i18n translation */
                      <span className="inline-flex items-center gap-1 text-gray-400">
                        <Mail size={10} />
                        {t.dashboard.saved.emailStatus.none}
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
                    {/* January 17, 2026: All button labels now use i18n translations */}
                    {isGenerating ? (
                      // GENERATING STATE: Show spinner
                      <button
                        disabled
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-400 border-2 border-gray-300 dark:border-gray-600 cursor-not-allowed"
                      >
                        <Loader2 size={12} className="animate-spin" />
                        {t.dashboard.outreach.generating}
                      </button>
                    ) : hasMessage ? (
                      // SUCCESS STATE: Show "View Message" button
                      <button
                        onClick={() => {
                          setCurrentMessageIndex(0); // Reset to first message
                          setViewingMessageId(messageCount > 1 ? `${item.id}` : messageKey);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase bg-[#ffbf23] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                      >
                        <MessageSquare size={12} />
                        {messageCount > 1 ? `${messageCount} ${t.dashboard.outreach.messages}` : t.dashboard.outreach.viewMessage}
                      </button>
                    ) : hasFailed ? (
                      // FAILED STATE: Show red "Failed - Retry" button
                      <button
                        onClick={() => handleGenerateForSingle(item.id!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase bg-red-500 text-white border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                      >
                        <AlertTriangle size={12} />
                        {t.dashboard.outreach.retry}
                      </button>
                    ) : hasMultipleContacts ? (
                      // MULTI-CONTACT STATE: Show "Select Contacts" button
                      <button
                        onClick={() => openContactPicker(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase bg-[#ffbf23] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                      >
                        <Users size={12} />
                        {multipleContacts!.length} {t.dashboard.outreach.contacts}
                      </button>
                    ) : (
                      // DEFAULT STATE: Show yellow "Generate" button
                      <button
                        onClick={() => handleGenerateForSingle(item.id!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase bg-[#ffbf23] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                      >
                        <Wand2 size={12} />
                        {t.dashboard.outreach.generate}
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
                className="bg-white dark:bg-[#0a0a0a] border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_#000] dark:shadow-[8px_8px_0px_0px_#ffbf23] max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header - NEO-BRUTALIST (January 17, 2026: i18n translations) */}
                <div className="px-6 py-4 border-b-4 border-black dark:border-white flex items-center justify-between bg-[#ffbf23] shrink-0">
                  <div className="flex items-center gap-3">
                    <Sparkles size={20} className="text-black" />
                    <h3 className="text-base font-black text-black uppercase">{t.dashboard.outreach.messageViewer.title}</h3>
                    {isMultiMessageView && (
                      <span className="px-2 py-0.5 bg-black text-white text-[10px] font-black uppercase">
                        {allMessages.length} {t.dashboard.outreach.messagesLabel}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setViewingMessageId(null)}
                    className="w-8 h-8 bg-black text-white hover:bg-white hover:text-black border-2 border-black flex items-center justify-center transition-colors font-black"
                  >
                    ×
                  </button>
                </div>

                {/* Modal Body - NEO-BRUTALIST (Fixed January 16, 2026: Use flex-1 to ensure footer is visible) */}
                <div className="p-6 overflow-y-auto flex-1 bg-white dark:bg-[#0a0a0a]">
                  {/* =====================================================================
                      MULTI-MESSAGE CAROUSEL VIEW - NEO-BRUTALIST (January 16, 2026)
                      
                      Shows one message at a time with numbered pagination buttons.
                      User clicks 1, 2, 3... to navigate between messages.
                      ===================================================================== */}
                  {isMultiMessageView ? (() => {
                    // Ensure currentMessageIndex is within bounds
                    const safeIndex = Math.min(currentMessageIndex, allMessages.length - 1);
                    const currentMsg = allMessages[safeIndex];
                    if (!currentMsg) return null;
                    
                    const msgKey = getMessageKey(affiliateId, currentMsg.email);
                    const msgCopied = copiedId === msgKey;
                    const msgRegenerating = generatingIds.has(msgKey);
                    
                    return (
                      <div>
                        {/* =============================================================
                            PAGINATION NUMBERS - Click to navigate between messages
                            ============================================================= */}
                        {allMessages.length > 1 && (
                          <div className="flex items-center justify-center gap-2 mb-4">
                            {allMessages.map((_, idx) => (
                              <button
                                key={idx}
                                onClick={() => setCurrentMessageIndex(idx)}
                                className={cn(
                                  "w-8 h-8 text-sm font-black border-2 transition-all",
                                  idx === safeIndex
                                    ? "bg-[#ffbf23] text-black border-black shadow-[2px_2px_0px_0px_#000]"
                                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-black dark:hover:border-white"
                                )}
                              >
                                {idx + 1}
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {/* Current Message Card */}
                        <div className="border-2 border-black dark:border-gray-600 overflow-hidden">
                          {/* Message Header with Email */}
                          <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b-2 border-black dark:border-gray-600 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Mail size={14} className="text-emerald-600" />
                              {/* January 17, 2026: Using i18n translation */}
                              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                {currentMsg.email || t.dashboard.outreach.messageViewer.primaryContact}
                              </span>
                            </div>
                            <span className="px-2 py-1 bg-black text-white text-[10px] font-black uppercase">
                              {safeIndex + 1} / {allMessages.length}
                            </span>
                          </div>
                          
                          {/* Message Content - January 16, 2026: Added edit mode support */}
                          <div className="p-4 bg-white dark:bg-[#0f0f0f]">
                            {editingMessageKey === msgKey ? (
                              /* =========================================================
                                 EDIT MODE - January 16, 2026
                                 Shows textarea for editing the message with save/cancel
                                 ========================================================= */
                              <>
                                {/* January 17, 2026: Using i18n translations for edit mode */}
                                <textarea
                                  value={editedMessageText}
                                  onChange={(e) => setEditedMessageText(e.target.value)}
                                  className="w-full bg-gray-50 dark:bg-gray-900 p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed border-2 border-[#ffbf23] dark:border-[#ffbf23] min-h-[250px] max-h-[350px] overflow-y-auto font-mono focus:outline-none resize-none"
                                  placeholder={t.dashboard.outreach.messageViewer.editPlaceholder}
                                  autoFocus
                                />
                                
                                {/* Edit Mode Actions */}
                                <div className="flex items-center justify-end gap-2 mt-4">
                                  <button
                                    onClick={handleCancelEdit}
                                    disabled={isSavingEdit}
                                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase transition-all border-2 bg-white text-gray-600 border-gray-300 hover:border-black hover:text-black"
                                  >
                                    <X size={12} />
                                    {t.dashboard.outreach.messageViewer.cancel}
                                  </button>
                                  <button
                                    onClick={() => handleSaveEdit(affiliateId, currentMsg.email)}
                                    disabled={isSavingEdit || !editedMessageText.trim()}
                                    className={cn(
                                      "flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase transition-all border-2 border-black",
                                      isSavingEdit
                                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                        : "bg-emerald-500 text-white shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
                                    )}
                                  >
                                    {isSavingEdit ? (
                                      <>
                                        <Loader2 size={12} className="animate-spin" />
                                        {t.dashboard.outreach.messageViewer.saving}
                                      </>
                                    ) : (
                                      <>
                                        <Save size={12} />
                                        {t.dashboard.outreach.messageViewer.save}
                                      </>
                                    )}
                                  </button>
                                </div>
                              </>
                            ) : (
                              /* =========================================================
                                 VIEW MODE - Shows the message with action buttons
                                 ========================================================= */
                              <>
                                <div className="bg-gray-50 dark:bg-gray-900 p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap border-2 border-gray-200 dark:border-gray-700 min-h-[200px] max-h-[300px] overflow-y-auto font-mono">
                                  {currentMsg.message}
                                </div>
                                
                                {/* Per-Message Actions - NEO-BRUTALIST (Updated January 16, 2026: Added Edit button) */}
                                <div className="flex items-center justify-end gap-2 mt-4">
                                  <button
                                    onClick={() => {
                                      if (affiliate) {
                                        const email = currentMsg.email;
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
                                      "flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase transition-all border-2",
                                      msgRegenerating
                                        ? "bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed"
                                        : "bg-white text-black border-black hover:bg-gray-100"
                                    )}
                                  >
                                    {/* January 17, 2026: Using i18n translations */}
                                    <RefreshCw size={12} className={msgRegenerating ? "animate-spin" : ""} />
                                    {msgRegenerating ? t.dashboard.outreach.messageViewer.regenerating : t.dashboard.outreach.messageViewer.redo}
                                  </button>
                                  <button
                                    onClick={() => handleStartEdit(msgKey)}
                                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase transition-all border-2 bg-white text-black border-black hover:bg-gray-100"
                                  >
                                    <Pencil size={12} />
                                    {t.dashboard.outreach.messageViewer.edit}
                                  </button>
                                  <button
                                    onClick={() => handleCopyMessage(msgKey)}
                                    className={cn(
                                      "flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase transition-all border-2 border-black",
                                      msgCopied
                                        ? "bg-emerald-500 text-white"
                                        : "bg-[#ffbf23] text-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
                                    )}
                                  >
                                    {msgCopied ? (
                                      <>
                                        <Check size={14} />
                                        {t.dashboard.outreach.messageViewer.copied}
                                      </>
                                    ) : (
                                      <>
                                        <Copy size={14} />
                                        {t.dashboard.outreach.messageViewer.copy}
                                      </>
                                    )}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })() : (
                    /* =====================================================================
                       SINGLE MESSAGE VIEW - NEO-BRUTALIST (January 17, 2026)
                       Redesigned to match carousel view structure - same card layout
                       with email header, message content, and inline action buttons
                       ===================================================================== */
                    <div className="border-2 border-black dark:border-gray-600 overflow-hidden">
                      {/* Message Header with Email - matches carousel view (January 17, 2026: i18n) */}
                      <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b-2 border-black dark:border-gray-600 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail size={14} className="text-emerald-600" />
                          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                            {contactEmail || affiliate?.email || t.dashboard.outreach.messageViewer.primaryContact}
                          </span>
                        </div>
                      </div>
                      
                      {/* Message Content - View or Edit Mode (January 17, 2026) */}
                      <div className="p-4 bg-white dark:bg-[#0f0f0f]">
                        {editingMessageKey === viewingMessageId ? (
                          /* =========================================================
                             EDIT MODE - Shows textarea for editing with save/cancel
                             (January 17, 2026: Using i18n translations)
                             ========================================================= */
                          <>
                            <textarea
                              value={editedMessageText}
                              onChange={(e) => setEditedMessageText(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-gray-900 p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed border-2 border-[#ffbf23] dark:border-[#ffbf23] min-h-[250px] max-h-[350px] overflow-y-auto font-mono focus:outline-none resize-none"
                              placeholder={t.dashboard.outreach.messageViewer.editPlaceholder}
                              autoFocus
                            />
                            
                            {/* Edit Mode Actions */}
                            <div className="flex items-center justify-end gap-2 mt-4">
                              {/* January 17, 2026: Using i18n translations */}
                              <button
                                onClick={handleCancelEdit}
                                disabled={isSavingEdit}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase transition-all border-2 bg-white text-gray-600 border-gray-300 hover:border-black hover:text-black"
                              >
                                <X size={12} />
                                {t.dashboard.outreach.messageViewer.cancel}
                              </button>
                              <button
                                onClick={() => handleSaveEdit(affiliateId, contactEmail)}
                                disabled={isSavingEdit || !editedMessageText.trim()}
                                className={cn(
                                  "flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase transition-all border-2 border-black",
                                  isSavingEdit
                                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                    : "bg-emerald-500 text-white shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
                                )}
                              >
                                {isSavingEdit ? (
                                  <>
                                    <Loader2 size={12} className="animate-spin" />
                                    {t.dashboard.outreach.messageViewer.saving}
                                  </>
                                ) : (
                                  <>
                                    <Save size={12} />
                                    {t.dashboard.outreach.messageViewer.save}
                                  </>
                                )}
                              </button>
                            </div>
                          </>
                        ) : (
                          /* =========================================================
                             VIEW MODE - Shows message with inline action buttons
                             ========================================================= */
                          <>
                            <div className="bg-gray-50 dark:bg-gray-900 p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap border-2 border-gray-200 dark:border-gray-700 min-h-[200px] max-h-[300px] overflow-y-auto font-mono">
                              {message}
                            </div>
                            
                            {/* Action Buttons - Inline like carousel view (January 17, 2026) */}
                            <div className="flex items-center justify-end gap-2 mt-4">
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
                                  "flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase transition-all border-2",
                                  isRegenerating
                                    ? "bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed"
                                    : "bg-white text-black border-black hover:bg-gray-100"
                                )}
                              >
                                {/* January 17, 2026: Using i18n translations */}
                                <RefreshCw size={12} className={isRegenerating ? "animate-spin" : ""} />
                                {isRegenerating ? t.dashboard.outreach.messageViewer.regenerating : t.dashboard.outreach.messageViewer.redo}
                              </button>
                              <button
                                onClick={() => handleStartEdit(viewingMessageId)}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase transition-all border-2 bg-white text-black border-black hover:bg-gray-100"
                              >
                                <Pencil size={12} />
                                {t.dashboard.outreach.messageViewer.edit}
                              </button>
                              <button
                                onClick={() => handleCopyMessage(viewingMessageId)}
                                className={cn(
                                  "flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase transition-all border-2 border-black",
                                  isCopied
                                    ? "bg-emerald-500 text-white"
                                    : "bg-[#ffbf23] text-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
                                )}
                              >
                                {/* January 17, 2026: Using i18n translations */}
                                {isCopied ? (
                                  <>
                                    <Check size={14} />
                                    {t.dashboard.outreach.messageViewer.copied}
                                  </>
                                ) : (
                                  <>
                                    <Copy size={14} />
                                    {t.dashboard.outreach.messageViewer.copy}
                                  </>
                                )}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* =============================================================================
                    FOOTER REMOVED - January 17, 2026
                    
                    Both single and multi-message views now have action buttons inline
                    with the message content. No footer needed - close via X in header.
                    ============================================================================= */}
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
                    {/* January 17, 2026: Using i18n translations */}
                    <div>
                      <h3 className="text-base font-black text-black uppercase">{t.dashboard.outreach.contactPicker.title}</h3>
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

              {/* Contact List - NEO-BRUTALIST (January 17, 2026: i18n) */}
              <div className="p-4 overflow-y-auto max-h-[50vh] bg-white dark:bg-[#0a0a0a]">
                <p className="text-xs text-gray-500 mb-3 font-medium">
                  {t.dashboard.outreach.contactPicker.subtitle}
                </p>
                
                <div className="space-y-2">
                  {contactPicker.contacts.map((contact) => {
                    const isSelected = contactPicker.selectedContacts.has(contact.email);
                    // =========================================================================
                    // DISPLAY NAME LOGIC (Updated January 24th, 2026)
                    // 
                    // If name is available → show name + email
                    // If name is NOT available → show email only (no "Unknown")
                    // 
                    // This provides cleaner UI when we only have email addresses
                    // without associated contact names from enrichment services.
                    // =========================================================================
                    const displayName = contact.fullName || 
                      [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 
                      null; // null means no name available, will show email as primary
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
                          {/* ===============================================================
                              CONDITIONAL NAME/EMAIL DISPLAY (January 24th, 2026)
                              
                              If we have a name: Show name as primary, email as secondary
                              If no name: Show email as the primary text (larger, prominent)
                              =============================================================== */}
                          {displayName ? (
                            <>
                              {/* Has name - show name as primary */}
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                                  {displayName}
                                </p>
                                {hasExistingMessage && (
                                  <span className="shrink-0 px-1.5 py-0.5 bg-emerald-500 text-white text-[9px] font-black uppercase border border-black">
                                    {t.dashboard.outreach.contactPicker.alreadyGenerated}
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
                            </>
                          ) : (
                            <>
                              {/* No name - show email as primary */}
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-black text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                                  <Mail size={12} />
                                  {contact.email}
                                </p>
                                {hasExistingMessage && (
                                  <span className="shrink-0 px-1.5 py-0.5 bg-emerald-500 text-white text-[9px] font-black uppercase border border-black">
                                    {t.dashboard.outreach.contactPicker.alreadyGenerated}
                                  </span>
                                )}
                              </div>
                              {contact.title && (
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 font-medium">
                                  <Briefcase size={10} />
                                  {contact.title}
                                </p>
                              )}
                            </>
                          )}
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
                  {/* Credit cost indicator - January 17, 2026: i18n translations */}
                  <div className="text-xs">
                    {contactPicker.selectedContacts.size > 0 ? (
                      <span className="flex items-center gap-1.5">
                        <Sparkles size={12} className="text-[#ffbf23]" />
                        <span className="text-gray-600 dark:text-gray-400 font-medium">
                          {t.dashboard.outreach.contactPicker.creditsUsed}{' '}
                          <span className="font-black text-black dark:text-white">
                            {contactPicker.selectedContacts.size} {contactPicker.selectedContacts.size !== 1 ? t.dashboard.outreach.contactPicker.credits : t.dashboard.outreach.contactPicker.credit}
                          </span>
                        </span>
                      </span>
                    ) : (
                      <span className="text-gray-400 font-medium">{t.dashboard.outreach.contactPicker.selectContacts}</span>
                    )}
                  </div>
                  
                  {/* Action buttons - NEO-BRUTALIST (January 17, 2026: i18n) */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setContactPicker(prev => ({ ...prev, isOpen: false }))}
                      className="px-3 py-1.5 text-xs font-black uppercase text-gray-600 hover:text-black transition-colors"
                    >
                      {t.dashboard.outreach.contactPicker.cancel}
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
                      {t.dashboard.outreach.generate} {contactPicker.selectedContacts.size > 0 
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

      </div>

      {/* =============================================================================
          CUSTOM TOAST NOTIFICATION - NEO-BRUTALIST DESIGN (January 17, 2026)
          
          Matches the toast design used in find/page.tsx and discovered/page.tsx.
          Shows success/error/warning/info toasts with:
          - Sharp corners, 2px black border
          - Neo-brutalist shadow (4px 4px 0px 0px #000)
          - Icon box on left with color based on type
          - Title in uppercase font-black
          - Optional subtitle message
          - Close button on right
          - 4 second auto-dismiss
          ============================================================================= */}
      {customToast?.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_0px_#000] p-4 max-w-sm">
            <div className="flex items-start gap-3">
              {/* Icon Box - Color based on type */}
              <div className={cn(
                "w-10 h-10 border-2 border-black flex items-center justify-center shrink-0",
                customToast.type === 'success' && "bg-emerald-500",
                customToast.type === 'error' && "bg-red-500",
                customToast.type === 'warning' && "bg-amber-400",
                customToast.type === 'info' && "bg-blue-500"
              )}>
                {customToast.type === 'success' && <Check size={20} className="text-white" />}
                {customToast.type === 'error' && <X size={20} className="text-white" />}
                {customToast.type === 'warning' && <AlertTriangle size={20} className="text-black" />}
                {customToast.type === 'info' && <Sparkles size={20} className="text-white" />}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase">
                  {customToast.title}
                </h4>
                {customToast.message && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    {customToast.message}
                  </p>
                )}
              </div>
              
              {/* Close Button */}
              <button
                onClick={() => setCustomToast(prev => prev ? { ...prev, show: false } : null)}
                className="text-gray-400 hover:text-black dark:hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
