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
} from 'lucide-react';

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
// ERROR NOTIFICATION TYPES
// =============================================================================

interface ErrorNotification {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info';
}

// =============================================================================
// OUTREACH PAGE - January 3rd, 2026
// 
// Layout now handles: AuthGuard, ErrorBoundary, and Sidebar.
// This component only renders the header and main content area.
// =============================================================================
export default function OutreachPage() {
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
  // ERROR NOTIFICATIONS (December 17, 2025)
  // Instead of using ugly alert() popups, we show inline toast notifications
  // that auto-dismiss after 5 seconds
  // =========================================================================
  const [notifications, setNotifications] = useState<ErrorNotification[]>([]);
  
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
  // NOTIFICATION HELPERS
  // =========================================================================
  
  /**
   * Add an error notification that auto-dismisses after 5 seconds
   */
  const addNotification = (message: string, type: 'error' | 'warning' | 'info' = 'error') => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  };
  
  /**
   * Remove a notification by ID
   */
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Filter and Search Logic
  const filteredResults = useMemo(() => {
    return savedAffiliates.filter(item => {
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
  }, [savedAffiliates, activeFilter, searchQuery]);

  // Calculate counts
  const counts = useMemo(() => {
    return {
      All: savedAffiliates.length,
      Web: savedAffiliates.filter(r => r.source === 'Web').length,
      YouTube: savedAffiliates.filter(r => r.source === 'YouTube').length,
      Instagram: savedAffiliates.filter(r => r.source === 'Instagram').length,
      TikTok: savedAffiliates.filter(r => r.source === 'TikTok').length,
    };
  }, [savedAffiliates]);

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
        // =====================================================================
        setGeneratedMessages(prev => {
          const next = new Map(prev);
          next.set(messageKey, data.message);
          return next;
        });

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
        if (response.status === 402) {
          addNotification('Insufficient AI credits. Please upgrade your plan.', 'warning');
        } else if (data.error?.includes('webhook not configured')) {
          addNotification('AI service not configured. Please contact support.', 'error');
        } else {
          addNotification(data.error || 'Failed to generate message', 'error');
        }
      }
    } catch (error) {
      // =====================================================================
      // NETWORK ERROR: Mark as failed
      // =====================================================================
      console.error('Error generating message:', error);
      setFailedIds(prev => new Set(prev).add(messageKey));
      addNotification('Failed to connect to AI service. Please try again.', 'error');
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
    
    // Show summary notification if there were any failures
    if (failCount > 0) {
      addNotification(
        `Generated ${successCount} of ${total} messages. ${failCount} failed - click "Retry" to try again.`,
        failCount === total ? 'error' : 'warning'
      );
    }
  };

  // =========================================================================
  // COPY MESSAGE TO CLIPBOARD (Updated December 25, 2025)
  // Now uses messageKey format "affiliateId:email"
  // =========================================================================
  const handleCopyMessage = (messageKey: string) => {
    const message = generatedMessages.get(messageKey);
    if (message) {
      navigator.clipboard.writeText(message);
      setCopiedId(messageKey);
      setTimeout(() => setCopiedId(null), 2000);
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
      {/* Header */}
      <header className="h-12 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-900">Outreach</h1>
        </div>

        {/* Countdown Timer */}
        <ScanCountdown />
          
          <div className="flex items-center gap-3 text-xs">
            {/* Credits Display - December 2025 */}
            <CreditsDisplay />
            
            {/* Action Button */}
            <button 
              className="bg-[#D4E815] text-[#1A1D21] px-3.5 py-1.5 rounded-lg hover:bg-[#c5d913] hover:shadow-md hover:shadow-[#D4E815]/20 transition-all font-semibold flex items-center gap-1.5"
            >
              <Plus size={14} /> Find Affiliates
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 px-6 lg:px-8 py-6 max-w-[1600px] mx-auto w-full">
          
          {/* Header Section */}
          <div className="mb-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              
              {/* Left: Search & Filters */}
              <div className="flex items-center gap-4 flex-1">
                <div className="w-full max-w-[160px]">
                   <div className="relative w-full group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#1A1D21] transition-colors">
                        <Search size={14} />
                      </div>
                      <input
                        className="w-full pl-9 pr-3 py-1.5 bg-white border ring-1 ring-slate-200 rounded-lg text-xs font-semibold text-slate-900 shadow-sm transition-all duration-200 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#D4E815]/20 focus:border-[#D4E815]"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                      />
                    </div>
                </div>

                <div className="h-8 w-px bg-slate-200 mx-1 hidden lg:block"></div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
                  {filterTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFilter(tab.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap",
                        activeFilter === tab.id
                          ? "bg-[#D4E815] text-[#1A1D21] border-[#D4E815] shadow-sm shadow-[#D4E815]/20"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                      )}
                    >
                      {tab.icon}
                      {/* Only show text for "All" filter */}
                      {tab.id === 'All' && <span>All</span>}
                      {tab.count > 0 && (
                        <span className={cn(
                          "ml-0.5 px-1.5 py-0.5 rounded text-[9px]",
                          activeFilter === tab.id ? "bg-[#1A1D21]/20 text-[#1A1D21]" : "bg-slate-100 text-slate-500"
                        )}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-3">
                {selectedAffiliates.size > 0 && (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-semibold text-emerald-900">
                      <Check size={12} className="text-emerald-600" />
                      {selectedAffiliates.size} selected
                    </div>
                    <button
                      onClick={handleSelectAll}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5 hover:bg-slate-50 rounded-lg"
                    >
                      Deselect All
                    </button>
                  </>
                )}
                {selectedAffiliates.size === 0 && filteredResults.length > 0 && (
                  <button
                    onClick={handleSelectAll}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5 hover:bg-slate-50 rounded-lg"
                  >
                    Select All
                  </button>
                )}
                {/* ================================================================
                    BULK GENERATE BUTTON (Updated December 17, 2025)
                    
                    Shows different states:
                    - Default: "Generate Messages (X)"
                    - In Progress: "Generating 2/5..." with spinner
                    - Disabled: Grey when nothing selected or already generating
                    ================================================================ */}
                <button
                  onClick={handleGenerateMessages}
                  disabled={selectedAffiliates.size === 0 || generatingIds.size > 0}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 rounded-lg font-semibold text-xs transition-all",
                    selectedAffiliates.size > 0 && generatingIds.size === 0
                      ? "bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] shadow-sm hover:shadow-md hover:shadow-[#D4E815]/20"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  )}
                >
                  {bulkProgress ? (
                    // Bulk generation in progress - show progress
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Generating {bulkProgress.current}/{bulkProgress.total}...
                    </>
                  ) : generatingIds.size > 0 ? (
                    // Single generation in progress
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    // Default state
                    <>
                      <Wand2 size={14} />
                      Generate Messages ({selectedAffiliates.size})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Table Header - Updated December 17, 2025: Removed Date column, widened Email column */}
          <div className="bg-white border border-slate-200 rounded-t-xl border-b-0 grid grid-cols-[40px_200px_1fr_130px_160px_130px] gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-3">
            <div className="pl-1">
              <input
                type="checkbox"
                checked={selectedAffiliates.size === filteredResults.length && filteredResults.length > 0}
                onChange={handleSelectAll}
                className="w-3.5 h-3.5 rounded border-slate-300 text-[#D4E815] focus:ring-[#D4E815]/20 focus:ring-offset-0 cursor-pointer"
              />
            </div>
            <div>Affiliate</div>
            <div>Relevant Content</div>
            <div>Discovery Method</div>
            <div>Email</div>
            <div className="text-right pr-2">Message</div>
          </div>

          {/* Results Area */}
          <div className="bg-white border border-slate-200 rounded-b-xl shadow-sm min-h-[400px]">
            
            {/* ================================================================
                LOADING STATE (December 17, 2025)
                Shows skeleton loader while fetching affiliates
                ================================================================ */}
            {loading && (
              <div className="py-16 flex flex-col items-center justify-center">
                <Loader2 size={32} className="text-[#D4E815] animate-spin mb-4" />
                <p className="text-sm font-medium text-slate-600">Loading your affiliates...</p>
              </div>
            )}
            
            {/* Empty State */}
            {!loading && savedAffiliates.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-[#D4E815]/10 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare size={28} className="text-[#1A1D21]" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Start Building Connections</h3>
                <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
                  Save affiliates to generate AI-powered outreach messages.
                </p>
              </div>
            )}
            
            {/* No Results State (when filtering) */}
            {!loading && savedAffiliates.length > 0 && filteredResults.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Search size={28} className="text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">No Results Found</h3>
                <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
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
                    "grid grid-cols-[40px_200px_1fr_130px_160px_130px] items-center gap-4 px-4 py-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors",
                    isSelected && "bg-[#D4E815]/10 hover:bg-[#D4E815]/20"
                  )}
                >
                  {/* Checkbox */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectAffiliate(item.id!)}
                      className="w-4 h-4 rounded border-slate-300 text-[#D4E815] focus:ring-[#D4E815]/20 focus:ring-offset-0 cursor-pointer"
                    />
                  </div>

                  {/* Affiliate Info - Shows thumbnail/icon + title + domain */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        getSourceIcon(item.source)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{item.title}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                        <Globe size={10} className="shrink-0" />
                        <span className="truncate">{item.domain}</span>
                      </p>
                    </div>
                  </div>

                  {/* Relevant Content - Single line with ellipsis for overflow */}
                  <div className="text-xs text-slate-600 truncate">
                    {item.snippet}
                  </div>

                  {/* Discovery Method */}
                  <div className="text-xs">
                    {item.keyword && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-md font-medium truncate max-w-full">
                        {item.keyword}
                      </span>
                    )}
                  </div>

                  {/* Email - Shows actual email + count if multiple (Dec 17, 2025) */}
                  <div className="text-xs min-w-0">
                    {item.email ? (
                      <div className="flex items-center gap-1 min-w-0">
                        <Mail size={10} className="text-emerald-600 shrink-0" />
                        <span className="truncate text-slate-700 font-medium" title={item.email}>
                          {item.email}
                        </span>
                        {/* Show +X if there are additional emails */}
                        {item.emailResults?.emails && item.emailResults.emails.length > 1 && (
                          <span className="shrink-0 text-[10px] text-emerald-600 font-semibold">
                            +{item.emailResults.emails.length - 1}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <Mail size={10} />
                        None
                      </span>
                    )}
                  </div>

                  {/* ============================================================
                      MESSAGE ACTION BUTTON (Updated December 25, 2025)
                      
                      Shows different states based on generation status:
                      1. hasMessage → "View Message(s)" (success state)
                      2. isGenerating → Spinner + "Generating..."
                      3. hasFailed → Red "Failed - Retry" button
                      4. hasMultipleContacts → Yellow "Select Contacts" button
                      5. default → Yellow "Generate" button
                      ============================================================ */}
                  <div className="text-right">
                    {hasMessage ? (
                      // =====================================================================
                      // SUCCESS STATE: Show "View Message" button (Updated December 26, 2025)
                      //
                      // BUG FIX: When messageCount > 1, we pass just the affiliateId (e.g., "123")
                      // so the modal knows to show ALL messages in a list view. Previously, we
                      // always passed messageKey which only showed the primary contact's message.
                      // =====================================================================
                      <button
                        onClick={() => setViewingMessageId(messageCount > 1 ? `${item.id}` : messageKey)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-[#D4E815]/20 text-[#1A1D21] border border-[#D4E815]/40 hover:bg-[#D4E815]/30"
                      >
                        <MessageSquare size={12} />
                        {messageCount > 1 ? `View ${messageCount} Messages` : 'View Message'}
                      </button>
                    ) : isGenerating ? (
                      // GENERATING STATE: Show spinner
                      <button
                        disabled
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-400 cursor-not-allowed"
                      >
                        <Loader2 size={12} className="animate-spin" />
                        Generating...
                      </button>
                    ) : hasFailed ? (
                      // FAILED STATE: Show red "Failed - Retry" button
                      <button
                        onClick={() => handleGenerateForSingle(item.id!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:border-red-300"
                      >
                        <AlertTriangle size={12} />
                        Retry
                      </button>
                    ) : hasMultipleContacts ? (
                      // MULTI-CONTACT STATE: Show "Select Contacts" button (December 25, 2025)
                      <button
                        onClick={() => openContactPicker(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] shadow-sm hover:shadow-md hover:shadow-[#D4E815]/20"
                      >
                        <Users size={12} />
                        {multipleContacts!.length} Contacts
                      </button>
                    ) : (
                      // DEFAULT STATE: Show yellow "Generate" button
                      <button
                        onClick={() => handleGenerateForSingle(item.id!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] shadow-sm hover:shadow-md hover:shadow-[#D4E815]/20"
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
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setViewingMessageId(null)}
            >
              <div 
                className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header - Updated December 17, 2025 to use brand colors */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-[#D4E815]/10 to-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
                      {getSourceIcon(affiliate?.source || 'Web')}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{affiliate?.title}</h3>
                      <p className="text-xs text-slate-600 flex items-center gap-1">
                        <Globe size={10} />
                        {affiliate?.domain}
                        {isMultiMessageView && (
                          <span className="ml-2 px-2 py-0.5 bg-[#D4E815]/20 text-[#1A1D21] rounded text-[10px] font-semibold">
                            {allMessages.length} Messages
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setViewingMessageId(null)}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                  >
                    <span className="text-slate-600 text-lg">×</span>
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto max-h-[calc(80vh-130px)]">
                  {/* =====================================================================
                      MULTI-MESSAGE LIST VIEW (December 26, 2025)
                      
                      When viewing multiple messages, show each in its own card with
                      the email recipient, message content, and action buttons.
                      ===================================================================== */}
                  {isMultiMessageView ? (
                    <div className="space-y-4">
                      {allMessages.map((msg, index) => {
                        const msgKey = getMessageKey(affiliateId, msg.email);
                        const msgCopied = copiedId === msgKey;
                        const msgRegenerating = generatingIds.has(msgKey);
                        
                        return (
                          // Use msgKey as React key for guaranteed uniqueness
                          <div key={msgKey} className="border border-slate-200 rounded-xl overflow-hidden">
                            {/* Message Header with Email */}
                            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Mail size={12} className="text-emerald-600" />
                                <span className="text-sm font-medium text-slate-700">{msg.email || 'Primary Contact'}</span>
                              </div>
                              <span className="text-xs text-slate-400">Message {index + 1}</span>
                            </div>
                            
                            {/* Message Content */}
                            <div className="p-4">
                              <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap border border-slate-100 max-h-[200px] overflow-y-auto">
                                {msg.message}
                              </div>
                              
                              {/* Per-Message Actions */}
                              <div className="flex items-center justify-end gap-2 mt-3">
                                <button
                                  onClick={() => {
                                    if (affiliate) {
                                      // Regenerate for this specific contact
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
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                    msgRegenerating
                                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                  )}
                                >
                                  <RefreshCw size={12} className={msgRegenerating ? "animate-spin" : ""} />
                                  {msgRegenerating ? 'Regenerating...' : 'Regenerate'}
                                </button>
                                <button
                                  onClick={() => handleCopyMessage(msgKey)}
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                    msgCopied
                                      ? "bg-emerald-600 text-white"
                                      : "bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913]"
                                  )}
                                >
                                  {msgCopied ? (
                                    <>
                                      <Check size={12} />
                                      Copied!
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
                       SINGLE MESSAGE VIEW (Original behavior)
                       ===================================================================== */
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={14} className="text-[#1A1D21]" />
                        <span className="text-sm font-semibold text-slate-700">AI Generated Message</span>
                        {/* Show which contact this message is for (December 25, 2025) */}
                        {contactEmail && (
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            to {contactEmail}
                          </span>
                        )}
                      </div>
                      <div className="bg-slate-50 rounded-xl p-5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap border border-slate-200">
                        {message}
                      </div>

                      {/* Affiliate Details */}
                      {affiliate && (
                        <div className="mt-6 pt-6 border-t border-slate-200">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Affiliate Details</h4>
                          <div className="grid grid-cols-2 gap-3">
                            {affiliate.personName && (
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Contact Name</p>
                                <p className="text-sm font-semibold text-slate-900">{affiliate.personName}</p>
                              </div>
                            )}
                            {(contactEmail || affiliate.email) && (
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Email</p>
                                <p className="text-sm font-semibold text-slate-900">{contactEmail || affiliate.email}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Platform</p>
                              <div className="flex items-center gap-1.5">
                                {getSourceIcon(affiliate.source)}
                                <p className="text-sm font-semibold text-slate-900">{affiliate.source}</p>
                              </div>
                            </div>
                            {affiliate.keyword && (
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Keyword</p>
                                <p className="text-sm font-semibold text-slate-900">{affiliate.keyword}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Modal Footer - Only show for single message view */}
                {!isMultiMessageView && (
                  <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    <button
                      onClick={() => setViewingMessageId(null)}
                      className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                    >
                      Close
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (affiliate) {
                            // ===========================================================
                            // REGENERATE MESSAGE (Fixed December 25, 2025)
                            //
                            // We need to regenerate for the SAME contact email that the
                            // original message was generated for. There are two paths:
                            //
                            // Path 1: Contact details exist in emailResults.contacts[]
                            //         → Use full contact info for personalization
                            //
                            // Path 2: Only emails exist (no contacts array)
                            //         → Use top-level emailResults firstName/lastName/title
                            //
                            // CRITICAL: Always pass the contactEmail, even if we can't
                            // find detailed contact info. This ensures the message key
                            // stays consistent.
                            // ===========================================================
                            
                            if (contactEmail) {
                              // Try to find contact details in Path 1 (contacts array)
                              const contactFromArray = affiliate.emailResults?.contacts?.find(c => 
                                c.emails?.includes(contactEmail)
                              );
                              
                              if (contactFromArray) {
                                // Path 1: Found in contacts array with full details
                                handleGenerateForContact(affiliate, {
                                  email: contactEmail,
                                  firstName: contactFromArray.firstName,
                                  lastName: contactFromArray.lastName,
                                  title: contactFromArray.title,
                                });
                              } else {
                                // Path 2: Contact was from emails array without detailed contacts
                                // Use top-level emailResults info (same for all emails in this case)
                                handleGenerateForContact(affiliate, {
                                  email: contactEmail,
                                  firstName: affiliate.emailResults?.firstName,
                                  lastName: affiliate.emailResults?.lastName,
                                  title: affiliate.emailResults?.title,
                                });
                              }
                            } else {
                              // No specific contact - regenerate for primary
                              handleGenerateForContact(affiliate);
                            }
                          }
                        }}
                        disabled={isRegenerating}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                          isRegenerating
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        )}
                      >
                        <RefreshCw size={14} className={isRegenerating ? "animate-spin" : ""} />
                        {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                      </button>
                      <button
                        onClick={() => {
                          handleCopyMessage(viewingMessageId);
                          setTimeout(() => setViewingMessageId(null), 1500);
                        }}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                          isCopied
                            ? "bg-emerald-600 text-white"
                            : "bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] shadow-sm hover:shadow-md hover:shadow-[#D4E815]/20"
                        )}
                      >
                        {isCopied ? (
                          <>
                            <Check size={14} />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            Copy Message
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Simple Close Footer for Multi-Message View */}
                {isMultiMessageView && (
                  <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-center">
                    <button
                      onClick={() => setViewingMessageId(null)}
                      className="px-6 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
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
        {contactPicker.isOpen && contactPicker.affiliate && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setContactPicker(prev => ({ ...prev, isOpen: false }))}
          >
            <div 
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-[#D4E815]/10 to-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#D4E815]/20 flex items-center justify-center">
                      <Users size={20} className="text-[#1A1D21]" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Select Contacts</h3>
                      <p className="text-xs text-slate-600">
                        {contactPicker.affiliate.domain}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setContactPicker(prev => ({ ...prev, isOpen: false }))}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                  >
                    <X size={16} className="text-slate-600" />
                  </button>
                </div>
              </div>

              {/* Contact List */}
              <div className="p-4 overflow-y-auto max-h-[50vh]">
                <p className="text-xs text-slate-500 mb-3">
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
                          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                          isSelected 
                            ? "bg-[#D4E815]/10 border-[#D4E815]/40" 
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded border-slate-300 text-[#D4E815] focus:ring-[#D4E815]/20"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {displayName}
                            </p>
                            {hasExistingMessage && (
                              <span className="shrink-0 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-semibold rounded">
                                Has Message
                              </span>
                            )}
                          </div>
                          {contact.title && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <Briefcase size={10} />
                              {contact.title}
                            </p>
                          )}
                          <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                            <Mail size={10} />
                            {contact.email}
                          </p>
                        </div>
                        
                        <ChevronRight size={14} className={cn(
                          "text-slate-300 transition-colors",
                          isSelected && "text-[#D4E815]"
                        )} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer - Shows credit cost and generate button */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                  {/* Credit cost indicator */}
                  <div className="text-xs">
                    {contactPicker.selectedContacts.size > 0 ? (
                      <span className="flex items-center gap-1.5">
                        <Sparkles size={12} className="text-amber-500" />
                        <span className="text-slate-600">
                          This will use{' '}
                          <span className="font-bold text-slate-900">
                            {contactPicker.selectedContacts.size} AI credit{contactPicker.selectedContacts.size !== 1 ? 's' : ''}
                          </span>
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-400">Select contacts to generate emails</span>
                    )}
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setContactPicker(prev => ({ ...prev, isOpen: false }))}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerateForSelectedContacts}
                      disabled={contactPicker.selectedContacts.size === 0}
                      className={cn(
                        "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
                        contactPicker.selectedContacts.size > 0
                          ? "bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] shadow-sm"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      )}
                    >
                      <Wand2 size={12} />
                      Generate {contactPicker.selectedContacts.size > 0 
                        ? `${contactPicker.selectedContacts.size} Email${contactPicker.selectedContacts.size !== 1 ? 's' : ''}`
                        : 'Emails'
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            ERROR NOTIFICATIONS TOAST (December 17, 2025)
            
            Shows inline toast notifications instead of ugly alert() popups.
            Notifications auto-dismiss after 5 seconds.
            Positioned at bottom-right of screen.
            ================================================================ */}
        {notifications.length > 0 && (
          <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-right-5 duration-300",
                  notification.type === 'error' && "bg-red-50 border-red-200 text-red-800",
                  notification.type === 'warning' && "bg-amber-50 border-amber-200 text-amber-800",
                  notification.type === 'info' && "bg-blue-50 border-blue-200 text-blue-800"
                )}
              >
                {notification.type === 'error' && <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />}
                {notification.type === 'warning' && <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />}
                {notification.type === 'info' && <MessageSquare size={16} className="text-blue-500 shrink-0 mt-0.5" />}
                <p className="flex-1 text-sm font-medium">{notification.message}</p>
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="shrink-0 p-1 hover:bg-black/10 rounded transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
    </>
  );
}
