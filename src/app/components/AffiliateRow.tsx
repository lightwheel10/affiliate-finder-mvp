/**
 * =============================================================================
 * AffiliateRow Component
 * =============================================================================
 * Displays a single affiliate result as a table row on find / discovered /
 * saved pages. Supports bulk selection, saving, deletion, email lookup,
 * and three modals (Relevant Content, Email Results, View details).
 *
 * HISTORY:
 *   January 10th, 2026 — i18n migration: all strings go through useLanguage().
 *   April   23rd, 2026 — "Smoover" refresh for the INLINE row only
 *                        (Phase 2e). Soft borders, rounded pills, yellow
 *                        glow CTA matching the landing hero, hairline table
 *                        divider. The THREE MODALS (Relevant Content, Email
 *                        Results, View details) and their per-platform content
 *                        renderers (YouTube / Instagram / TikTok / Web) are
 *                        still neo-brutalist and will be migrated in follow-up
 *                        PRs so changes stay reviewable.
 *
 * Translation hook usage: const { t } = useLanguage();
 * =============================================================================
 */
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Trash2, Eye, Save, Globe, Youtube, Instagram, Mail, ChevronDown, CheckCircle2, Users, Play, Loader2, Search, X, Copy, Check, RotateCw, AlertCircle, Linkedin, Phone, Briefcase, User, BarChart2, TrendingUp, MapPin, Clock, MousePointer, FileText, ArrowUpRight, Info } from 'lucide-react';
import { Modal } from './Modal';
import { ResultItem, YouTubeChannelInfo } from '../types';
import { useLanguage } from '@/contexts/LanguageContext';
import type { SupabaseUserData } from '../hooks/useSupabaseUser';
import { getDiscoveryReasons } from '../utils/discovery';

// TikTok icon component
const TikTokIcon = ({ size = 14, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

/**
 * AffiliateRowProps Interface
 * 
 * Props for the AffiliateRow component which displays a single affiliate result
 * in a table row format with actions like save, delete, view, and select.
 * 
 * BULK SELECTION SUPPORT (Added Dec 2025 ):
 * - isSelected: Whether this row's checkbox is checked
 * - onSelect: Callback when checkbox is toggled, receives the affiliate's link as identifier
 * 
 * These props enable bulk operations (save multiple to pipeline, delete multiple)
 * from parent pages like Find New, Discovered, and Saved.
 */
interface AffiliateRowProps {
  id?: number;  // Database ID for email lookup
  title: string;
  domain: string;
  link: string;
  rank?: number;
  keyword?: string;
  source: string;
  thumbnail?: string;
  views?: string;
  date?: string;
  isSaved?: boolean;
  onSave: () => void;
  snippet?: string;
  highlightedWords?: string[];
  email?: string;
  emailStatus?: 'not_searched' | 'searching' | 'found' | 'not_found' | 'error';
  onFindEmail?: () => void;  // Callback to trigger email search
  isPipelineView?: boolean;
  // ==========================================================================
  // DISCOVERY METHOD - Updated January 23, 2026
  // Added 'brand' type for brand search results (existing affiliates)
  // ==========================================================================
  discoveryMethod?: {
    type: 'competitor' | 'keyword' | 'topic' | 'tagged' | 'brand';
    value: string;
  };
  isAlreadyAffiliate?: boolean;
  isNew?: boolean;
  subItems?: ResultItem[];
  // YouTube/TikTok/Instagram-specific props
  channel?: YouTubeChannelInfo;
  duration?: string;
  personName?: string;
  // Email results for modal display
  emailResults?: {
    emails: string[];
    contacts?: Array<{
      firstName?: string;
      lastName?: string;
      fullName?: string;
      title?: string;
      linkedinUrl?: string;
      emails: string[];
      phoneNumbers?: string[];
    }>;
    firstName?: string;
    lastName?: string;
    title?: string;
    linkedinUrl?: string;
    phoneNumbers?: string[];
    provider?: string;
  };
  // ============================================================================
  // BULK SELECTION PROPS (Added Dec 2025)
  // Used by parent pages to enable multi-select for bulk save/delete operations
  // ============================================================================
  isSelected?: boolean;           // Whether this row is selected (checkbox checked)
  onSelect?: (link: string) => void;  // Callback when selection changes, uses link as unique ID
  // ============================================================================
  // BULK SAVE VISUAL FEEDBACK (Added Dec 2025)
  // Shows saving state during bulk operations
  // ============================================================================
  isSaving?: boolean;             // Whether this item is currently being saved (shows spinner)
  // ============================================================================
  // SINGLE ITEM DELETE (Added Dec 2025)
  // Callback for deleting this individual affiliate
  // ============================================================================
  onDelete?: () => void;          // Callback when delete is confirmed
  // ============================================================================
  // VIEW MODAL DATA (Added Dec 2025)
  // Full affiliate data for the View modal - contains all source-specific fields
  // (Instagram, TikTok, YouTube, SimilarWeb data)
  // ============================================================================
  affiliateData?: ResultItem;     // Full ResultItem for View modal display
  // ============================================================================
  // SHOW STATUS INSTEAD OF DATE (Added Jan 2026)
  // For Saved page - shows "SAVED" status badge instead of date
  // ============================================================================
  showStatusInsteadOfDate?: boolean;
  // ============================================================================
  // MATCH REASONS (View Modal) - January 22, 2026
  // Used only inside View Modal actions for Find/Discovered/Saved pages.
  // ============================================================================
  currentUser?: SupabaseUserData | null;
}

export const AffiliateRow: React.FC<AffiliateRowProps> = ({ 
  id,
  title, 
  domain, 
  link,
  rank = 1, 
  keyword = "SEMRush Alternativen", 
  source,
  thumbnail,
  views,
  date,
  isSaved,
  onSave,
  snippet,
  highlightedWords,
  email,
  emailStatus = 'not_searched',
  onFindEmail,
  isPipelineView = false,
  discoveryMethod = { type: 'keyword', value: keyword || 'Keyword' },
  isAlreadyAffiliate = false,
  isNew = true,
  subItems = [],
  channel,
  duration,
  personName,
  emailResults,
  // Bulk selection props with defaults for backward compatibility
  isSelected = false,
  onSelect,
  isSaving = false,  // Added Dec 2025: Shows loading state during bulk save
  onDelete,          // Added Dec 2025: Single item delete callback
  affiliateData,     // Added Dec 2025: Full data for View modal
  showStatusInsteadOfDate = false,  // Added Jan 2026: Show "SAVED" status instead of date
  currentUser,                    // Added Jan 22, 2026: User data for match reasons
}) => {
  // i18n translation hook (January 10th, 2026)
  const { t } = useLanguage();
  
  // =============================================================================
  // MATCH REASONS IN VIEW MODAL - January 22, 2026
  //
  // Client request: explain why this result matched (keyword/competitor/terms).
  // This is now shown ONLY inside the View Modal (not inline in rows).
  // =============================================================================

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);  // Added Dec 2025: View modal state
  const [showMatchReasons, setShowMatchReasons] = useState(false); // Added Jan 22, 2026
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  
  // Fixed January 16, 2026: Portal state for View Modal to escape parent stacking context
  // The View Modal was being cut off because fixed positioning was contained by scrollable parent
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  // Reset match reasons panel when modal closes
  useEffect(() => {
    if (!isViewModalOpen) {
      setShowMatchReasons(false);
    }
  }, [isViewModalOpen]);

  // ============================================================================
  // MATCH REASONS DATA (View Modal) - January 22, 2026
  // Builds a minimal ResultItem for match-reason computation when needed.
  // ============================================================================
  const matchReasonSource = React.useMemo<ResultItem>(() => {
    return (
      affiliateData || {
        title: title || '',
        snippet: snippet || '',
        keyword,
        highlightedWords,
        discoveryMethod,
        link: link || '',
        domain: domain || '',
        source: source || '',
      }
    );
  }, [
    affiliateData,
    title,
    snippet,
    keyword,
    highlightedWords,
    discoveryMethod,
        rank,
    link,
    domain,
    source,
  ]);

  const matchReasons = React.useMemo(() => {
    if (!isViewModalOpen) return [];
    return getDiscoveryReasons(matchReasonSource, currentUser);
  }, [isViewModalOpen, matchReasonSource, currentUser]);
  
  // ============================================================================
  // SINGLE ITEM DELETE CONFIRMATION STATE (Added Dec 2025)
  // Uses inline confirmation pattern: click once to show "Confirm?", click again to delete
  // ============================================================================
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const deleteConfirmTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Handle delete button click with inline confirmation
  const handleDeleteClick = () => {
    if (isDeleteConfirming) {
      // Second click - execute delete
      if (deleteConfirmTimeoutRef.current) {
        clearTimeout(deleteConfirmTimeoutRef.current);
      }
      setIsDeleteConfirming(false);
      onDelete?.();
    } else {
      // First click - show confirmation
      setIsDeleteConfirming(true);
      // Auto-reset after 3 seconds if user doesn't confirm
      deleteConfirmTimeoutRef.current = setTimeout(() => {
        setIsDeleteConfirming(false);
      }, 3000);
    }
  };
  
  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (deleteConfirmTimeoutRef.current) {
        clearTimeout(deleteConfirmTimeoutRef.current);
      }
    };
  }, []);
  
  // Copy email to clipboard with feedback
  const copyEmail = (emailToCopy: string) => {
    navigator.clipboard.writeText(emailToCopy);
    setCopiedEmail(emailToCopy);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Check if this is a social media source
  const isSocialMedia = ['youtube', 'instagram', 'tiktok'].includes(source.toLowerCase());

  // Helper to proxy images from Instagram/TikTok to avoid CORS issues
  const getProxiedImageUrl = (url?: string) => {
    if (!url) return undefined;
    // Check if image needs proxying (Instagram or TikTok CDN)
    const needsProxy = url.includes('cdninstagram.com') || 
                       url.includes('instagram.com') || 
                       url.includes('fbcdn.net') ||
                       url.includes('tiktokcdn.com') ||
                       url.includes('tiktok.com');
    if (needsProxy) {
      return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  // Determine icon based on source
  const getSourceIcon = (size: number = 14) => {
    switch(source.toLowerCase()) {
      case 'youtube': return <Youtube size={size} className="text-red-600" />;
      case 'instagram': return <Instagram size={size} className="text-pink-600" />;
      case 'tiktok': return <TikTokIcon size={size} className="text-slate-900 dark:text-white" />;
      default: return <Globe size={size} className="text-[#1A1D21] dark:text-white" />;
    }
  };

  // Platform-specific colors for the tiny circular pin that floats over the
  // avatar bottom-left corner.
  //   January 6, 2026  — introduced for the original neo-brutalist row.
  //   April 23, 2026   — only `bg` is consumed by the JSX now (see row render);
  //                      the Phase 2e render overrides border + shadow inline,
  //                      so `border`/`text` here are legacy no-ops kept for
  //                      backwards-compat in case anything else reaches in.
  const getPlatformColors = () => {
    switch(source.toLowerCase()) {
      case 'youtube': return { bg: 'bg-red-500', border: 'border-black', text: 'text-white' };
      case 'instagram': return { bg: 'bg-pink-500', border: 'border-black', text: 'text-white' };
      case 'tiktok': return { bg: 'bg-black', border: 'border-white', text: 'text-white' };
      default: return { bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-black dark:border-gray-600', text: 'text-gray-700 dark:text-gray-300' };
    }
  };

  // Format date for display
  // Fixed January 26, 2026: Handle invalid date strings gracefully
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return new Date().toLocaleDateString();
    try {
      const d = new Date(dateStr);
      // Check if date is valid - new Date() doesn't throw on invalid strings,
      // it returns an Invalid Date object which has NaN as its time value
      if (isNaN(d.getTime())) {
        return ''; // Return empty string for invalid dates (hides from UI)
      }
      return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const renderHighlightedSnippet = () => {
    if (!snippet) return null;
    
    // If no keywords or highlighted words, return plain text
    const hasHighlight = (keyword && keyword !== "Competitor Alternative") || (highlightedWords && highlightedWords.length > 0);
    
    if (!hasHighlight) {
      return <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{snippet}</p>;
    }

    // Prepare terms to highlight
    let termsToHighlight = highlightedWords && highlightedWords.length > 0 
      ? [...highlightedWords] 
      : [];

    // If we have a keyword, add it and potential variants
    if (keyword && keyword !== "Competitor Alternative") {
      termsToHighlight.push(keyword);
      
      // If keyword looks like a domain (e.g., selecdoo.com), add the brand name (selecdoo)
      if (keyword.includes('.')) {
        const parts = keyword.split('.');
        // Add the first part if it's substantial (e.g., 'selecdoo' from 'selecdoo.com')
        if (parts[0].length > 2) {
          termsToHighlight.push(parts[0]);
        }
      }
      
      // If keyword has spaces, add individual substantial words
    if (keyword.includes(' ')) {
        const words = keyword.split(' ').filter(w => w.length > 2);
        termsToHighlight.push(...words);
    }
    }

    // Add domain name parts to highlighting if domain is present
    if (domain) {
       const domainParts = domain.split('.');
       if (domainParts.length > 0 && domainParts[0].length > 2) {
           termsToHighlight.push(domainParts[0]);
       }
    }
    
    // Deduplicate
    termsToHighlight = Array.from(new Set(termsToHighlight));

    // Escape regex special chars in terms and join with OR
    const pattern = termsToHighlight
      .filter(term => term && term.trim().length > 0) // Safety check
      .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    
    // Split by terms (case insensitive)
    const parts = snippet.split(new RegExp(`(${pattern})`, 'gi'));

    return (
      <div className="mt-1.5">
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
          {parts.map((part, i) => {
             const isMatch = termsToHighlight.some(term => term.toLowerCase() === part.toLowerCase());
             return isMatch ? (
               <mark key={i} className="bg-yellow-100 text-slate-900 font-semibold px-0.5 rounded">{part}</mark>
             ) : (
               part
             );
          })}
        </p>
      </div>
    );
  };

  // Discovery-method badge shown inline in the row (see main render below).
  //   January 16, 2026 — removed "Discovered via" label; added 5-word truncation.
  //   April 23, 2026  — Phase 2e smoover refresh: rounded hairline pill, softer
  //                     typography. Truncation + title tooltip preserved.
  const renderDiscoveryMethod = () => {
    if (!discoveryMethod) return null;
    
    const fullText = discoveryMethod.value;
    const words = fullText.split(' ');
    const truncatedText = words.length > 5 
      ? words.slice(0, 5).join(' ') + '...'
      : fullText;

    return (
      <span 
        className="inline-block px-2.5 py-1 text-[11px] font-semibold rounded-full bg-[#f6f9fc] dark:bg-gray-800 text-[#425466] dark:text-gray-300 border border-[#e6ebf1] dark:border-gray-700 max-w-[160px] truncate"
        title={fullText}
      >
        {truncatedText}
      </span>
    );
  };

  // ============================================================================
  // VIEW MODAL HELPER FUNCTIONS (Added Dec 2025)
  // ============================================================================
  
  // Format large numbers for display (e.g., 1500 -> "1.5K", 1500000 -> "1.5M")
  const formatNumber = (num?: number): string => {
    if (!num) return '0';
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
  };

  // Calculate engagement rate for videos
  const calculateEngagement = (plays?: number, likes?: number): string => {
    if (!plays || !likes || plays === 0) return '0%';
    return ((likes / plays) * 100).toFixed(2) + '%';
  };

  // Get visit button text and link based on source
  // Updated January 10th, 2026 - i18n migration
  const getVisitButtonConfig = () => {
    const sourceLower = source.toLowerCase();
    switch (sourceLower) {
      case 'youtube':
        return {
          text: t.affiliateRow.viewModal.visitChannel,
          icon: <Youtube size={12} />,
          link: channel?.link || link,
        };
      case 'instagram':
        return {
          text: t.affiliateRow.viewModal.visitAccount,
          icon: <Instagram size={12} />,
          link: affiliateData?.instagramUsername 
            ? `https://instagram.com/${affiliateData.instagramUsername}` 
            : link,
        };
      case 'tiktok':
        return {
          text: t.affiliateRow.viewModal.visitAccount,
          icon: <TikTokIcon size={12} />,
          link: affiliateData?.tiktokUsername 
            ? `https://tiktok.com/@${affiliateData.tiktokUsername}` 
            : link,
        };
      default:
        return {
          text: t.affiliateRow.viewModal.visitWebsite,
          icon: <Globe size={12} />,
          link: `https://${domain}`,
        };
    }
  };

  // ============================================================================
  // VIEW MODAL CONTENT RENDERERS (Added Dec 2025)
  // Each source type has its own content layout matching existing modal sizes
  // Note: YouTube API provides VIDEO description (snippet), not channel bio
  // ============================================================================

  // YouTube View Modal Content - NEO-BRUTALIST (Updated January 6th, 2026)
  const renderYouTubeViewContent = () => {
    const videoDescription = snippet || affiliateData?.snippet || '';
    const videoTitle = title;
    const videoThumbnail = thumbnail;
    const videoViews = views;
    const videoDate = date;
    const videoDuration = duration || affiliateData?.duration;
    const videoLikes = affiliateData?.youtubeVideoLikes;
    const videoComments = affiliateData?.youtubeVideoComments;
    
    return (
      <div className="space-y-4">
        {/* Header - NEO-BRUTALIST */}
        <div className="flex items-center gap-2 pb-3 border-b-2 border-gray-200 dark:border-gray-700">
          <div className="w-8 h-8 bg-red-600 border-2 border-black flex items-center justify-center">
            <Youtube size={16} className="text-white" />
          </div>
          <h3 className="text-sm font-black text-gray-900 dark:text-white">{channel?.name || personName || domain}</h3>
          {channel?.verified && (
            <CheckCircle2 size={12} className="text-blue-500 fill-blue-500" />
          )}
        </div>

        {/* Subscribers - NEO-BRUTALIST badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border-2 border-black dark:border-gray-600">
          <Users size={14} className="text-gray-500" />
          <span className="text-xs font-black text-black dark:text-white">{channel?.subscribers || '0'}</span>
          <span className="text-xs text-gray-500 font-medium">{t.affiliateRow.viewModal.youtube.subscribers}</span>
        </div>

        {/* Relevant Videos Section - NEO-BRUTALIST */}
        <div className="pt-3 border-t-2 border-gray-200 dark:border-gray-700">
          <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
            {t.affiliateRow.viewModal.youtube.relevantVideos} ({1 + (subItems?.length || 0)})
          </h4>

          {/* Main Video Card - NEO-BRUTALIST */}
          <div className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-900 border-2 border-black dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {/* Video Thumbnail */}
            {videoThumbnail && (
              <a 
                href={link} 
                target="_blank" 
                rel="noreferrer"
                className="shrink-0 relative group"
              >
                <div className="w-28 h-16 overflow-hidden bg-gray-200 dark:bg-gray-700 border-2 border-black dark:border-gray-600">
                  <img 
                    src={getProxiedImageUrl(videoThumbnail)} 
                    alt="" 
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
                {videoDuration && (
                  <span className="absolute bottom-0 right-0 px-1.5 py-0.5 bg-[#ffbf23] text-black text-[8px] font-black border-t border-l border-black">
                    {videoDuration}
                  </span>
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 bg-[#ffbf23] border-2 border-black flex items-center justify-center">
                    <Play size={14} className="text-black ml-0.5" fill="currentColor" />
                  </div>
                </div>
              </a>
            )}

            {/* Video Info */}
            <div className="flex-1 min-w-0">
              <a 
                href={link}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-black text-gray-900 dark:text-white hover:text-red-600 transition-colors line-clamp-2 block mb-1"
              >
                {videoTitle}
              </a>
              
              {videoDescription && (
                <p className="text-[10px] text-gray-500 line-clamp-2 mb-2">
                  {videoDescription}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                {videoViews && <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-600">{videoViews} {t.affiliateRow.metrics.views}</span>}
                {videoLikes !== undefined && <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-600">{formatNumber(videoLikes)} {t.affiliateRow.metrics.likes}</span>}
                {videoDate && <span className="text-gray-400">{formatDate(videoDate)}</span>}
              </div>
            </div>
          </div>

          {/* Additional Videos from subItems - NEO-BRUTALIST */}
          {subItems && subItems.length > 0 && (
            <div className="mt-2 space-y-2">
              {subItems.map((item, idx) => (
                <div key={idx} className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 hover:border-black dark:hover:border-white transition-colors">
                  {item.thumbnail && (
                    <a href={item.link} target="_blank" rel="noreferrer" className="shrink-0 relative">
                      <div className="w-28 h-16 overflow-hidden bg-gray-200 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600">
                        <img src={getProxiedImageUrl(item.thumbnail)} alt="" className="w-full h-full object-cover" />
                      </div>
                      {item.duration && (
                        <span className="absolute bottom-0 right-0 px-1 py-0.5 bg-black text-white text-[8px] font-bold">
                          {item.duration}
                        </span>
                      )}
                    </a>
                  )}
                  <div className="flex-1 min-w-0">
                    <a href={item.link} target="_blank" rel="noreferrer" className="text-xs font-black text-gray-900 dark:text-white hover:text-red-600 line-clamp-2 block mb-1">
                      {item.title}
                    </a>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
                      {item.views && <span>{item.views} {t.affiliateRow.metrics.views}</span>}
                      {item.date && <span>• {formatDate(item.date)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Instagram View Modal Content - NEO-BRUTALIST (Updated January 6th, 2026)
  const renderInstagramViewContent = () => {
    const username = affiliateData?.instagramUsername || channel?.name || personName || domain;
    const fullName = affiliateData?.instagramFullName || '';
    const bio = affiliateData?.instagramBio || snippet || '';
    const followers = affiliateData?.instagramFollowers;
    const isVerified = affiliateData?.instagramIsVerified;
    const postLikes = affiliateData?.instagramPostLikes;
    const postComments = affiliateData?.instagramPostComments;
    const postViews = affiliateData?.instagramPostViews;
    
    return (
      <div className="space-y-4">
        {/* Header - NEO-BRUTALIST */}
        <div className="flex items-center gap-2 pb-3 border-b-2 border-gray-200 dark:border-gray-700">
          <div className="w-8 h-8 bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 border-2 border-black flex items-center justify-center">
            <Instagram size={16} className="text-white" />
          </div>
          <h3 className="text-sm font-black text-gray-900 dark:text-white">
            {username.startsWith('@') ? username : `@${username}`}
          </h3>
          {isVerified && (
            <CheckCircle2 size={12} className="text-blue-500 fill-blue-500" />
          )}
        </div>

        {/* Profile Info - NEO-BRUTALIST badges */}
        <div className="flex flex-wrap items-center gap-2">
          {fullName && (
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-800 dark:text-gray-200">
              {fullName}
            </span>
          )}
          {followers && (
            <span className="px-2 py-1 bg-[#ffbf23] border-2 border-black text-xs font-black text-black">
              {formatNumber(followers)} {t.affiliateRow.viewModal.instagram.followers}
            </span>
          )}
        </div>

        {/* Bio - NEO-BRUTALIST */}
        {bio && (
          <div className="p-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap line-clamp-4">
              {bio}
            </p>
          </div>
        )}

        {/* Relevant Posts Section - NEO-BRUTALIST */}
        <div className="pt-3 border-t-2 border-gray-200 dark:border-gray-700">
          <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
            {t.affiliateRow.viewModal.instagram.relevantPosts} ({1 + (subItems?.length || 0)})
          </h4>

          {/* Main Post Card - NEO-BRUTALIST */}
          <div className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-900 border-2 border-black dark:border-gray-600">
            {thumbnail && (
              <a href={link} target="_blank" rel="noreferrer" className="shrink-0">
                <div className="w-16 h-16 overflow-hidden bg-gray-200 dark:bg-gray-700 border-2 border-black dark:border-gray-600">
                  <img 
                    src={getProxiedImageUrl(thumbnail)} 
                    alt="" 
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              </a>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-700 dark:text-gray-300 font-medium line-clamp-3 mb-2">
                {title || snippet}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                {/* FIX January 30, 2026: Changed !== undefined to != null */}
                {postLikes != null && <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-600">{formatNumber(postLikes)} {t.affiliateRow.metrics.likes}</span>}
                {postComments != null && <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-600">{formatNumber(postComments)} {t.affiliateRow.metrics.comments}</span>}
                {date && <span className="text-gray-400">{formatDate(date)}</span>}
              </div>
            </div>
          </div>

          {/* Additional Posts - NEO-BRUTALIST */}
          {subItems && subItems.length > 0 && (
            <div className="mt-2 space-y-2">
              {subItems.map((item, idx) => (
                <div key={idx} className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 hover:border-black dark:hover:border-white transition-colors">
                  {item.thumbnail && (
                    <a href={item.link} target="_blank" rel="noreferrer" className="shrink-0">
                      <div className="w-16 h-16 overflow-hidden bg-gray-200 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600">
                        <img src={getProxiedImageUrl(item.thumbnail)} alt="" className="w-full h-full object-cover" />
                      </div>
                    </a>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 dark:text-gray-300 font-medium line-clamp-3 mb-2">{item.title || item.snippet}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
                      {/* FIX January 30, 2026: Changed !== undefined to != null */}
                      {item.instagramPostLikes != null && <span>{formatNumber(item.instagramPostLikes)} {t.affiliateRow.metrics.likes}</span>}
                      {item.date && <span>• {formatDate(item.date)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // TikTok View Modal Content - NEO-BRUTALIST (Updated January 6th, 2026)
  const renderTikTokViewContent = () => {
    const username = affiliateData?.tiktokUsername || channel?.name || personName || domain;
    const displayName = affiliateData?.tiktokDisplayName || '';
    const bio = affiliateData?.tiktokBio || snippet || '';
    const followers = affiliateData?.tiktokFollowers;
    const isVerified = affiliateData?.tiktokIsVerified;
    const avatarUrl = channel?.thumbnail || thumbnail;
    
    const videoPlays = affiliateData?.tiktokVideoPlays;
    const videoLikes = affiliateData?.tiktokVideoLikes;
    
    return (
      <div className="space-y-4">
        {/* Header - NEO-BRUTALIST */}
        <div className="flex items-center gap-2 pb-3 border-b-2 border-gray-200 dark:border-gray-700">
          <div className="w-8 h-8 bg-black border-2 border-black flex items-center justify-center">
            <TikTokIcon size={16} className="text-white" />
          </div>
          <h3 className="text-sm font-black text-gray-900 dark:text-white">
            {username.startsWith('@') ? username : `@${username}`}
          </h3>
          {isVerified && (
            <CheckCircle2 size={12} className="text-blue-500 fill-blue-500" />
          )}
          {affiliateData?.similarWeb?.countryCode && (
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-black uppercase border-2 border-gray-200 dark:border-gray-700">
              {affiliateData.similarWeb.countryCode}
            </span>
          )}
        </div>

        {/* Profile Section - NEO-BRUTALIST */}
        <div className="flex items-start gap-3">
          {avatarUrl && (
            <div className="w-12 h-12 overflow-hidden bg-gray-100 dark:bg-gray-800 border-2 border-black dark:border-gray-600 shrink-0">
              <img 
                src={getProxiedImageUrl(avatarUrl)} 
                alt="" 
                className="w-full h-full object-cover"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>
          )}
          
          <div className="flex-1">
            {displayName && (
              <p className="text-xs font-black text-gray-900 dark:text-white">{displayName}</p>
            )}
            {followers && (
              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-[#ffbf23] text-black text-[10px] font-black uppercase border-2 border-black">
                {formatNumber(followers)} {t.affiliateRow.viewModal.tiktok.followers}
              </span>
            )}
          </div>
        </div>

        {/* Bio - NEO-BRUTALIST */}
        {bio && (
          <div className="p-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap line-clamp-4">
              {bio}
            </p>
          </div>
        )}

        {/* Relevant Posts Section - NEO-BRUTALIST */}
        <div className="pt-3 border-t-2 border-gray-200 dark:border-gray-700">
          <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
            {t.affiliateRow.viewModal.tiktok.relevantPosts} ({1 + (subItems?.length || 0)})
          </h4>

          {/* Main Video Card - NEO-BRUTALIST */}
          <div className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-900 border-2 border-black dark:border-gray-600">
            {thumbnail && (
              <a href={link} target="_blank" rel="noreferrer" className="shrink-0 relative group">
                <div className="w-16 h-20 overflow-hidden bg-gray-200 dark:bg-gray-700 border-2 border-black dark:border-gray-600">
                  <img 
                    src={getProxiedImageUrl(thumbnail)} 
                    alt="" 
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 bg-[#ffbf23] border-2 border-black flex items-center justify-center">
                    <Play size={14} className="text-black ml-0.5" fill="currentColor" />
                  </div>
                </div>
              </a>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-700 dark:text-gray-300 font-medium line-clamp-3 mb-2">
                {title || snippet}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                {videoPlays && <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-600">{formatNumber(videoPlays)} {t.affiliateRow.metrics.views}</span>}
                {videoLikes && <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-600">{formatNumber(videoLikes)} {t.affiliateRow.metrics.likes}</span>}
                {date && <span className="text-gray-400">{formatDate(date)}</span>}
              </div>
            </div>
          </div>

          {/* Additional Videos - NEO-BRUTALIST */}
          {subItems && subItems.length > 0 && (
            <div className="mt-2 space-y-2">
              {subItems.map((item, idx) => (
                <div key={idx} className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 hover:border-black dark:hover:border-white transition-colors">
                  {item.thumbnail && (
                    <a href={item.link} target="_blank" rel="noreferrer" className="shrink-0">
                      <div className="w-16 h-20 overflow-hidden bg-gray-200 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600">
                        <img src={getProxiedImageUrl(item.thumbnail)} alt="" className="w-full h-full object-cover" />
                      </div>
                    </a>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 dark:text-gray-300 font-medium line-clamp-3 mb-2">{item.title || item.snippet}</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      {item.views && <span>{item.views} {t.affiliateRow.metrics.views}</span>}
                      {item.date && <span>• {formatDate(item.date)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Web View Modal Content - Shows SimilarWeb traffic data (Dec 2025)
  // Design inspired by SimilarWeb's official data display
  const renderWebViewContent = () => {
    const swData = affiliateData?.similarWeb;
    
    // Helper to format time from seconds to readable format
    const formatTime = (seconds: number) => {
      if (!seconds || seconds === 0) return 'N/A';
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      if (mins === 0) return `${secs}s`;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Helper to format large numbers
    const formatTrafficNumber = (num: number) => {
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
      return num.toString();
    };

    // Helper to format month from date string
    const formatMonth = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short' });
    };

    // Country code to name mapping (common ones)
    const countryNames: Record<string, string> = {
      'US': 'United States', 'GB': 'United Kingdom', 'IN': 'India', 'CA': 'Canada',
      'AU': 'Australia', 'DE': 'Germany', 'FR': 'France', 'BR': 'Brazil',
      'JP': 'Japan', 'MX': 'Mexico', 'ES': 'Spain', 'IT': 'Italy',
      'NL': 'Netherlands', 'PL': 'Poland', 'RU': 'Russia', 'KR': 'South Korea',
      'ID': 'Indonesia', 'TR': 'Turkey', 'PH': 'Philippines', 'VN': 'Vietnam',
      'TH': 'Thailand', 'MY': 'Malaysia', 'SG': 'Singapore', 'PK': 'Pakistan',
      'NG': 'Nigeria', 'ZA': 'South Africa', 'EG': 'Egypt', 'AR': 'Argentina',
      'CL': 'Chile', 'CO': 'Colombia', 'PE': 'Peru', 'UA': 'Ukraine',
      'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark', 'FI': 'Finland',
      'BE': 'Belgium', 'AT': 'Austria', 'CH': 'Switzerland', 'NZ': 'New Zealand',
      'IE': 'Ireland', 'PT': 'Portugal', 'CZ': 'Czech Republic', 'RO': 'Romania',
      'HU': 'Hungary', 'GR': 'Greece', 'IL': 'Israel', 'AE': 'UAE', 'SA': 'Saudi Arabia',
      'BD': 'Bangladesh', 'HK': 'Hong Kong', 'TW': 'Taiwan', 'CN': 'China',
    };

    // Process monthly visits history for bar chart
    const getMonthlyVisitsData = () => {
      if (!swData?.monthlyVisitsHistory) return null;
      const entries = Object.entries(swData.monthlyVisitsHistory)
        .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
        .slice(-3); // Last 3 months
      if (entries.length === 0) return null;
      const maxValue = Math.max(...entries.map(([_, v]) => v));
      return { entries, maxValue };
    };

    const monthlyData = swData ? getMonthlyVisitsData() : null;
    
    return (
      <div className="space-y-5">
        {/* Header - NEO-BRUTALIST Domain with traffic badge */}
        <div className="flex items-start justify-between pb-4 border-b-2 border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {/* Screenshot or Globe icon */}
            {swData?.screenshot ? (
              <img 
                src={swData.screenshot} 
                alt={domain}
                className="w-12 h-12 object-cover border-2 border-black dark:border-gray-600"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 border-2 border-black dark:border-gray-600 flex items-center justify-center">
                <Globe size={24} className="text-gray-500" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-gray-900 dark:text-white">{domain}</h3>
                <a 
                  href={`https://${domain}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
              {swData && (
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-[#ffbf23] text-black text-xs font-black uppercase border-2 border-black">
                  <ArrowUpRight size={12} />
                  {swData.monthlyVisitsFormatted} {t.affiliateRow.viewModal.web.trafficPerMonth}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* About this website - NEO-BRUTALIST */}
        {swData?.siteDescription && (
          <div className="p-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700">
            <h5 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">{t.affiliateRow.viewModal.web.about}</h5>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{swData.siteDescription}</p>
          </div>
        )}

        {/* Traffic Overview - NEO-BRUTALIST */}
        {swData ? (
          <>
            {/* Section Title */}
            <h4 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-wide">{t.affiliateRow.viewModal.web.trafficMetrics}</h4>

            {/* Two-column layout for Ranking and Engagement */}
            <div className="grid grid-cols-2 gap-4">
              {/* Ranking Card - NEO-BRUTALIST */}
              <div className="p-4 bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-600 overflow-hidden">
                <h5 className="text-xs font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest mb-3">{t.affiliateRow.viewModal.web.ranking}</h5>
                <div className="space-y-3">
                  {/* Global Rank */}
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-500 font-medium">{t.affiliateRow.viewModal.web.global}</span>
                  </div>
                  <p className="text-xl font-black text-black dark:text-white -mt-1 ml-6">
                    {swData.globalRank ? `#${Number(swData.globalRank).toLocaleString()}` : 'N/A'}
                  </p>
                  
                  {/* Country Rank */}
                  {swData.countryCode && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase">{swData.countryCode}</span>
                        <span className="text-xs text-gray-500 truncate">{countryNames[swData.countryCode] || swData.countryCode}</span>
                      </div>
                      <p className="text-xl font-black text-black dark:text-white -mt-1 ml-6">
                        {swData.countryRank ? `#${Number(swData.countryRank).toLocaleString()}` : 'N/A'}
                      </p>
                    </>
                  )}
                  
                  {/* Category */}
                  <div className="flex items-center gap-2 pt-1">
                    <FileText size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-500 font-medium">{t.affiliateRow.viewModal.web.category}</span>
                  </div>
                  <div className="-mt-1 ml-6 overflow-hidden">
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 break-words leading-relaxed">
                      {swData.category?.replace(/_/g, ' ') || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* User Engagement Metrics Card - NEO-BRUTALIST */}
              <div className="p-4 bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-600 overflow-hidden">
                <h5 className="text-xs font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest mb-3">{t.affiliateRow.viewModal.web.userEngagement}</h5>
                <div className="grid grid-cols-3 gap-2">
                  {/* Pages/Visit */}
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
                    <FileText size={16} className="mx-auto text-gray-400 mb-1" />
                    <p className="text-lg font-black text-black dark:text-white">
                      {Number(swData.pagesPerVisit).toFixed(1)}
                    </p>
                    <p className="text-[9px] text-gray-500 font-bold uppercase">{t.affiliateRow.viewModal.web.pagesPerVisit}</p>
                  </div>
                  
                  {/* Time on Site */}
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
                    <Clock size={16} className="mx-auto text-gray-400 mb-1" />
                    <p className="text-lg font-black text-black dark:text-white">
                      {formatTime(Number(swData.timeOnSite))}
                    </p>
                    <p className="text-[9px] text-gray-500 font-bold uppercase">{t.affiliateRow.viewModal.web.timeOnSite}</p>
                  </div>
                  
                  {/* Bounce Rate */}
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
                    <MousePointer size={16} className="mx-auto text-gray-400 mb-1" />
                    <p className="text-lg font-black text-black dark:text-white">
                      {(Number(swData.bounceRate) * 100).toFixed(1)}%
                    </p>
                    <p className="text-[9px] text-gray-500 font-bold uppercase">{t.affiliateRow.viewModal.web.bounceRate}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Traffic Sources Section - NEO-BRUTALIST */}
            {swData.trafficSources && (
              <div className="p-4 bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-600">
                <h5 className="text-xs font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest mb-4">{t.affiliateRow.viewModal.web.trafficSources}</h5>
                
                {/* Traffic Sources with color dots and percentages */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {[
                    { label: t.affiliateRow.viewModal.web.search, value: Number(swData.trafficSources.search) || 0, color: 'bg-[#ffbf23]' },
                    { label: t.affiliateRow.viewModal.web.direct, value: Number(swData.trafficSources.direct) || 0, color: 'bg-black dark:bg-white' },
                    { label: t.affiliateRow.viewModal.web.referrals, value: Number(swData.trafficSources.referrals) || 0, color: 'bg-gray-400' },
                    { label: t.affiliateRow.viewModal.web.social, value: Number(swData.trafficSources.social) || 0, color: 'bg-gray-600' },
                    { label: t.affiliateRow.viewModal.web.paid, value: Number(swData.trafficSources.paid) || 0, color: 'bg-gray-500' },
                    { label: t.affiliateRow.viewModal.web.mail, value: Number(swData.trafficSources.mail) || 0, color: 'bg-gray-300' },
                  ].sort((a, b) => b.value - a.value).map(source => (
                    <div key={source.label} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 ${source.color} border border-black`}></span>
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{source.label}</span>
                      </div>
                      <span className="text-xs font-black text-black dark:text-white">
                        {(source.value * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Visual bar representation - NEO-BRUTALIST (no rounded corners) */}
                <div className="mt-4 h-4 overflow-hidden flex bg-gray-100 dark:bg-gray-800 border-2 border-black dark:border-gray-600">
                  {[
                    { value: Number(swData.trafficSources.search) || 0, color: 'bg-[#ffbf23]' },
                    { value: Number(swData.trafficSources.direct) || 0, color: 'bg-black dark:bg-white' },
                    { value: Number(swData.trafficSources.referrals) || 0, color: 'bg-gray-400' },
                    { value: Number(swData.trafficSources.social) || 0, color: 'bg-gray-600' },
                    { value: Number(swData.trafficSources.mail) || 0, color: 'bg-gray-300' },
                    { value: Number(swData.trafficSources.paid) || 0, color: 'bg-gray-500' },
                  ].filter(s => s.value > 0).map((source, idx) => (
                    <div 
                      key={idx}
                      className={`h-full ${source.color}`}
                      style={{ width: `${source.value * 100}%` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* No SimilarWeb data available - NEO-BRUTALIST */
          <div className="text-center py-8 text-gray-400 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700">
            <BarChart2 size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-black text-gray-500 uppercase">{t.affiliateRow.viewModal.web.noTrafficData}</p>
            <p className="text-xs mt-1 text-gray-400">{t.affiliateRow.viewModal.web.noTrafficDataDesc}</p>
          </div>
        )}

        {/* Relevant Content Section - NEO-BRUTALIST */}
        {(snippet || title) && (
          <div className="p-4 bg-white dark:bg-[#0f0f0f] border-2 border-black dark:border-gray-600">
            <h5 className="text-xs font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest mb-3">{t.affiliateRow.viewModal.web.relevantContent}</h5>
            <a 
              href={link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block p-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 hover:border-black dark:hover:border-white transition-all group"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-black text-black dark:text-white line-clamp-2">{title}</p>
                <ExternalLink size={12} className="text-gray-400 group-hover:text-black dark:group-hover:text-white flex-shrink-0 mt-0.5" />
              </div>
              {snippet && (
                <p className="text-[10px] text-gray-500 mt-2 line-clamp-3">{snippet}</p>
              )}
            </a>
          </div>
        )}
      </div>
    );
  };

  // Main View Modal Content - Dispatches to source-specific renderer
  const renderViewModalContent = () => {
    const sourceLower = source.toLowerCase();
    
    switch (sourceLower) {
      case 'youtube':
        return renderYouTubeViewContent();
      case 'instagram':
        return renderInstagramViewContent();
      case 'tiktok':
        return renderTikTokViewContent();
      default:
        // Web source - shows SimilarWeb traffic data
        return renderWebViewContent();
    }
  };

  // =============================================================================
  // GRID LAYOUT
  //   January 6, 2026  — introduced 12-column grid (replaced fixed-column grid).
  //   April 23, 2026   — Phase 2e smoover refresh: grid structure is UNCHANGED.
  //                      Only visual tokens (borders/shadows/radii/typography)
  //                      inside each cell were updated. This means existing
  //                      column span expectations hold for every caller.
  //
  // Column spans (per cell in the render below):
  //   col-span-1  checkbox
  //   col-span-3  affiliate info (avatar + name + metrics)
  //   col-span-3  relevant content (+ optional thumbnail)
  //   col-span-2  discovery method
  //   col-span-1  date/status        (non-pipeline only)
  //   col-span-2  actions            (non-pipeline)
  //   col-span-2  email pipeline     (pipeline only)
  //   col-span-1  actions            (pipeline only)
  // =============================================================================
  
  /* OLD_DESIGN_START - Grid Classes (pre-January 6th, 2026)
  const gridClassOld = isPipelineView 
    ? "grid grid-cols-[40px_220px_1fr_140px_100px_90px_130px_100px] gap-0"
    : "grid grid-cols-[40px_220px_1fr_140px_100px_120px] gap-0";
  OLD_DESIGN_END */
  
  const gridClass = "grid grid-cols-12 gap-4";

  const platformColors = getPlatformColors();

  return (
    // Row container.
    //   Jan 16, 2026: min-h-[72px] prevents row height shift as email/save
    //                 states toggle (spinner → badge → button, etc).
    //   Apr 23, 2026 (Phase 2e): added hairline bottom divider so consecutive
    //                 rows read as a cohesive table without heavy borders.
    //                 `last:border-b-0` so the final row doesn't clash with
    //                 whatever container wraps the list.
    <div className={`group ${gridClass} items-center p-4 min-h-[72px] bg-white dark:bg-[#0f0f0f] hover:bg-[#f6f9fc] dark:hover:bg-gray-900/50 border-b border-[#e6ebf1] dark:border-gray-800 last:border-b-0 transition-colors`}>
      {/* Checkbox - col-span-1, accent-brandYellow */}
      <div className="col-span-1 flex justify-center">
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={() => onSelect?.(link)}
          className="accent-[#ffbf23] w-4 h-4" 
        />
      </div>

      {/* Affiliate Info - col-span-3 for all views */}
      <div className="col-span-3">
        <div className="flex items-center gap-3">
          {/* Platform Icon + Avatar
              April 23rd, 2026 (Phase 2e): soft round avatar with hairline border
              and a subtle drop shadow, matching the landing/auth aesthetic. */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#f6f9fc] dark:bg-gray-800 border border-[#e6ebf1] dark:border-gray-700 shadow-soft-sm flex items-center justify-center overflow-hidden">
              <img 
                src={getProxiedImageUrl(channel?.thumbnail || thumbnail) || `https://www.google.com/s2/favicons?domain=${domain}&sz=64`} 
                alt="" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            {/* Platform badge pin - floats over avatar bottom-left
                Ring color = page bg so the pin reads as "punched out" of the row. */}
            {isSocialMedia && (
              <div className={`absolute -bottom-1 -left-1 w-5 h-5 rounded-full ${platformColors.bg} border-2 border-white dark:border-[#0f0f0f] shadow-soft-sm flex items-center justify-center`}>
                {getSourceIcon(10)}
              </div>
            )}
          </div>
          
          <div className="min-w-0 flex-1">
            {/* Row 1: Creator/Channel Name + badges */}
            {/* January 22nd, 2026: Fixed dark mode text visibility */}
            <div className="flex items-center gap-2">
              {getSourceIcon(14)}
              <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                {channel?.name || personName || domain}
              </h4>
              {channel?.verified && (
                <CheckCircle2 size={12} className="text-blue-500 fill-blue-500 shrink-0" />
              )}
              {/* Inline status badges — Phase 2e (April 23rd, 2026)
                  Rounded-full pills with hairline tinted borders. No uppercase,
                  no hard black border — reads as status, not shouting. */}
              {isNew && !isAlreadyAffiliate && (
                <span className="px-2 py-[2px] rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold border border-emerald-200/70 dark:border-emerald-800 shrink-0">{t.affiliateRow.badges.new}</span>
              )}
              {isAlreadyAffiliate && (
                <span className="px-2 py-[2px] rounded-full bg-[#f6f9fc] dark:bg-gray-800 text-[#425466] dark:text-gray-300 text-[10px] font-semibold border border-[#e6ebf1] dark:border-gray-700 shrink-0">{t.affiliateRow.badges.saved}</span>
              )}
            </div>
            
            {/* Row 2: Stats — Phase 2e smoover refresh (April 23rd, 2026)
                Brand-yellow accent pill keeps the punch; supporting pills go hairline. */}
            {isSocialMedia && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {channel?.subscribers && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#ffbf23] text-[#0f172a] shadow-yellow-glow-sm">
                    <Users size={10} />
                    {channel.subscribers} {t.affiliateRow.metrics.followers}
                  </span>
                )}
              </div>
            )}
            
            {/* Row 2: SimilarWeb stats for web sources — Phase 2e smoover refresh. */}
            {!isSocialMedia && (affiliateData?.similarWeb ? (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {/* Monthly traffic — brand-yellow punch pill */}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#ffbf23] text-[#0f172a] shadow-yellow-glow-sm">
                  <BarChart2 size={10} />
                  {affiliateData.similarWeb.monthlyVisitsFormatted} {t.affiliateRow.metrics.visitsPerMonth}
                </span>
                {/* Global rank — secondary hairline pill */}
                {affiliateData.similarWeb.globalRank && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-white dark:bg-gray-800 text-[#425466] dark:text-gray-300 border border-[#e6ebf1] dark:border-gray-700 shadow-soft-sm">
                    <TrendingUp size={10} />
                    #{affiliateData.similarWeb.globalRank.toLocaleString()}
                  </span>
                )}
              </div>
            ) : affiliateData?.isEnriching ? (
              // Enrichment loading pill — muted, no punch
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium rounded-full bg-[#f6f9fc] dark:bg-gray-800 text-[#8898aa] dark:text-gray-400 border border-[#e6ebf1] dark:border-gray-700">
                  <Loader2 size={10} className="animate-spin" />
                  {t.affiliateRow.metrics.loading}
                </span>
              </div>
            ) : null)}
          </div>
        </div>
      </div>

      {/* Relevant Content - col-span-3 for all views */}
      {/* Updated January 16, 2026: Added max-w-[200px] wrapper and break-words to prevent layout shifts */}
      {/* February 2, 2026: Back to col-span-3 for all views, reduced Action column instead */}
      <div className="col-span-3 min-w-0 overflow-hidden">
        <div className="flex items-start gap-3">
          {/* Video/Post thumbnail for social media — Phase 2e smoover refresh
              (April 23rd, 2026). Rounded frame, hairline border, soft shadow;
              duration badge becomes a dark translucent chip instead of yellow. */}
          {isSocialMedia && thumbnail && (
            <a 
              href={link} 
              target="_blank" 
              rel="noreferrer"
              className="shrink-0 relative group/thumb"
            >
              <div className="w-16 h-12 overflow-hidden rounded-lg bg-[#f6f9fc] dark:bg-gray-800 border border-[#e6ebf1] dark:border-gray-700 shadow-soft-sm">
                <img 
                  src={getProxiedImageUrl(thumbnail)} 
                  alt="" 
                  className="w-full h-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </div>
              {/* Duration chip — dark translucent pill, matches video overlays on landing */}
              {duration && (
                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-[#0f172a]/85 text-white text-[9px] font-semibold font-mono">
                  {duration}
                </span>
              )}
              {/* Play icon overlay on hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity rounded-lg bg-black/25">
                <div className="w-7 h-7 rounded-full bg-[#ffbf23] shadow-yellow-glow-sm flex items-center justify-center">
                  <Play size={12} className="text-[#0f172a] ml-0.5" fill="currentColor" />
                </div>
              </div>
            </a>
          )}
          
          {/* January 16, 2026: Fixed max-width container to prevent content from affecting table layout */}
          {/* Updated January 25, 2026: Increased max-w-[200px] to max-w-[280px] to use expanded column space */}
          <div className="flex-1 min-w-0 max-w-[280px] space-y-1 overflow-hidden">
            {/* Title with tooltip, break-words for long URLs/hashtags, line-clamp-2 for 2-line limit */}
            <a 
              href={link}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-black text-gray-900 dark:text-white hover:text-[#ffbf23] cursor-pointer line-clamp-2 block leading-tight break-words"
              title={title}
            >
              {title}
            </a>
            
            {/* Stats row for social media — Phase 2e smoover refresh (April 23rd, 2026)
                Rounded hairline pills; no uppercase or heavy black borders.
                Previous behavioural fixes preserved:
                  - Jan 27, 2026: TikTok shows video plays instead of date.
                  - Jan 30, 2026: Instagram shows post likes/views.
                  - Jan 30, 2026: `!= null` to tolerate NULL-from-DB correctly. */}
            {isSocialMedia && (
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                {source.toLowerCase() === 'tiktok' && affiliateData?.tiktokVideoPlays && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f6f9fc] dark:bg-gray-800 text-[#425466] dark:text-gray-300 font-medium border border-[#e6ebf1] dark:border-gray-700 whitespace-nowrap">
                    <Eye size={10} />
                    {formatNumber(affiliateData.tiktokVideoPlays)} {t.affiliateRow.metrics.views}
                  </span>
                )}
                {source.toLowerCase() === 'instagram' && affiliateData?.instagramPostLikes != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f6f9fc] dark:bg-gray-800 text-[#425466] dark:text-gray-300 font-medium border border-[#e6ebf1] dark:border-gray-700 whitespace-nowrap">
                    ❤️ {formatNumber(affiliateData.instagramPostLikes)} {t.affiliateRow.metrics.likes}
                  </span>
                )}
                {source.toLowerCase() === 'instagram' && affiliateData?.instagramPostViews != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f6f9fc] dark:bg-gray-800 text-[#425466] dark:text-gray-300 font-medium border border-[#e6ebf1] dark:border-gray-700 whitespace-nowrap">
                    <Eye size={10} />
                    {formatNumber(affiliateData.instagramPostViews)} {t.affiliateRow.metrics.views}
                  </span>
                )}
                {source.toLowerCase() === 'youtube' && views && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f6f9fc] dark:bg-gray-800 text-[#425466] dark:text-gray-300 font-medium border border-[#e6ebf1] dark:border-gray-700 whitespace-nowrap">
                    <Eye size={10} />
                    {views} {t.affiliateRow.metrics.views}
                  </span>
                )}
                {source.toLowerCase() !== 'tiktok' && date && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f6f9fc] dark:bg-gray-800 text-[#425466] dark:text-gray-300 font-medium border border-[#e6ebf1] dark:border-gray-700 whitespace-nowrap">
                    {formatDate(date)}
                  </span>
                )}
              </div>
            )}
            
            {/* Keyword info for web results - Neo-brutalist */}
            {/* Updated January 10th, 2026 - i18n migration */}
            {!isSocialMedia && (
              <div className="flex flex-wrap items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                <span className="font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">rank {rank}</span>
                <span className="whitespace-nowrap">{t.affiliateRow.discovery.rankFor}</span>
                <span className="font-bold text-gray-900 dark:text-white truncate max-w-[80px]" title={keyword}>{keyword}</span>
              </div>
            )}

            {subItems && subItems.length > 0 && (
               <p 
                 onClick={() => setIsModalOpen(true)}
                 className="text-[10px] text-[#ffbf23] font-semibold cursor-pointer hover:underline inline-block select-none whitespace-nowrap"
               >
                 +{subItems.length} {t.affiliateRow.discovery.more}
               </p>
            )}
          </div>
        </div>
      </div>

      {/* Discovery Method - col-span-2 for all views */}
      {/* Updated January 16, 2026: Added h-8 flex items-center for consistent height */}
      {/* Updated January 22, 2026: DiscoveryReasonsPopover removed (feature rollback) */}
      {/* February 2, 2026: Pipeline back to col-span-2 for better spacing from Email column */}
      <div className="col-span-2 h-8 flex items-center">
         {renderDiscoveryMethod()}
      </div>

      {/* Date/Status column - col-span-1 - Only show in non-pipeline view
          Phase 2e smoover refresh (April 23rd, 2026):
          - Status "SAVED" pill = rounded-full brand yellow with soft glow
          - Date pill = rounded-full hairline pill */}
      {!isPipelineView && (
        <div className="col-span-1">
          {showStatusInsteadOfDate ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#ffbf23] text-[#0f172a] text-[10px] font-semibold shadow-yellow-glow-sm">
              {t.affiliateRow.badges.saved}
            </span>
          ) : (
            <span className="inline-block px-2.5 py-1 text-[11px] font-medium font-mono rounded-full bg-[#f6f9fc] dark:bg-gray-800 text-[#425466] dark:text-gray-300 border border-[#e6ebf1] dark:border-gray-700">
              {formatDate(date)}
            </span>
          )}
        </div>
      )}

      {/* ==========================================================================
         STATUS COLUMN REMOVED - January 25, 2026
         
         The Status column (showing "DISCOVERED" badge) has been removed from the
         Saved page per client request. The Email column now gets col-span-2 instead
         of col-span-1 to utilize the freed space.
         
         Previous column layout: 1+3+2+2+1+1+2 = 12
         New column layout:      1+3+2+2+2+2 = 12
         ========================================================================== */}

      {/* Emails (Pipeline/Saved view only) - col-span-2, h-8 fixed height
          Previous behavioural history preserved (do not regress):
            - Jan 16, 2026: fixed h-8 to avoid layout shift on state change.
            - Jan 24, 2026: CRITICAL — only show email if emailStatus === 'found'
              (not `email` truthy), otherwise bio-scraped emails leak for free.
            - Jan 25, 2026: bumped heights to h-8 and px-3 so "FIND EMAIL" fits
              on one line at all locales; added whitespace-nowrap.
            - Jan 25, 2026: col-span-1 → col-span-2 after Status column was
              removed from the Saved page.
          Apr 23, 2026 (Phase 2e · smoover refresh):
            - Rounded-full pills, hairline borders, soft shadows.
            - Default "Find Email" CTA matches the landing hero CTA exactly
              (bg-[#ffbf23] + shadow-yellow-glow-sm + hover:-translate-y-0.5). */}
      {isPipelineView && (
         <div className="col-span-2 h-8 flex items-center">
            {emailStatus === 'found' && email ? (
               <button 
                 onClick={() => setIsEmailModalOpen(true)}
                 className="h-8 flex items-center gap-1.5 px-3 rounded-full bg-emerald-500 text-white text-[10px] font-semibold shadow-soft-sm hover:bg-emerald-600 transition-colors group whitespace-nowrap"
                 title={t.affiliateRow.actions.view}
               >
                 <Mail size={12} />
                 <span className="whitespace-nowrap">{emailResults?.emails?.length || 1} {t.affiliateRow.actions.found}</span>
                 <Eye size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
               </button>
            ) : emailStatus === 'searching' ? (
               /* Searching — circular yellow spinner */
               <div className="w-8 h-8 rounded-full bg-[#ffbf23] shadow-yellow-glow-sm flex items-center justify-center">
                 <Loader2 size={14} className="text-[#0f172a] animate-spin" />
               </div>
            ) : emailStatus === 'not_found' ? (
               <div className="flex items-center gap-1.5 flex-nowrap">
                 <span className="h-8 inline-flex items-center px-2.5 rounded-full bg-[#f6f9fc] dark:bg-gray-800 text-[#8898aa] dark:text-gray-400 text-[10px] font-semibold border border-[#e6ebf1] dark:border-gray-700 whitespace-nowrap">
                   0 {t.affiliateRow.actions.found}
                 </span>
                 <button 
                   onClick={onFindEmail}
                   className="w-8 h-8 rounded-full inline-flex items-center justify-center bg-white dark:bg-gray-900 text-[#8898aa] dark:text-gray-400 border border-[#e6ebf1] dark:border-gray-700 shadow-soft-sm hover:bg-[#f6f9fc] dark:hover:bg-gray-800 transition-colors group"
                   title={t.affiliateRow.actions.retry}
                 >
                   <RotateCw size={12} className="group-hover:rotate-180 transition-transform duration-300" />
                 </button>
               </div>
            ) : emailStatus === 'error' ? (
               <div className="flex items-center gap-1.5">
                 <div 
                   className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 flex items-center justify-center shadow-soft-sm"
                   title={t.common.error}
                 >
                   <AlertCircle size={14} className="text-red-600 dark:text-red-400" />
                 </div>
                 <button 
                   onClick={onFindEmail}
                   className="w-8 h-8 rounded-full bg-white dark:bg-gray-900 border border-[#e6ebf1] dark:border-gray-700 shadow-soft-sm flex items-center justify-center hover:bg-[#f6f9fc] dark:hover:bg-gray-800 transition-colors group"
                   title={t.affiliateRow.actions.retry}
                 >
                   <RotateCw size={12} className="text-[#425466] dark:text-gray-300 group-hover:rotate-180 transition-transform duration-300" />
                 </button>
               </div>
            ) : (
               /* Default "Find Email" CTA — matches landing yellow CTA pattern. */
               <button 
                 onClick={onFindEmail}
                 className="h-8 flex items-center gap-1.5 px-3 rounded-full bg-[#ffbf23] text-[#0f172a] text-[10px] font-semibold shadow-yellow-glow-sm hover:bg-[#e5ac20] hover:-translate-y-0.5 transition-all duration-200 whitespace-nowrap"
                 title={t.affiliateRow.actions.findEmail}
               >
                 <Search size={12} />
                 {t.affiliateRow.actions.findEmail}
               </button>
            )}
         </div>
      )}

      {/* Actions - col-span-1 for pipeline, col-span-2 for find/discovered
          Previous behavioural history preserved (do not regress):
            - Jan 10, 2026: i18n migration.
            - Jan 16, 2026: added h-8 so the row doesn't jump when state changes.
            - Feb  2, 2026: pipeline uses col-span-1; non-pipeline col-span-2.
          Apr 23, 2026 (Phase 2e · smoover refresh):
            - Circular rounded-full action buttons with hairline borders and
              soft shadows. Delete keeps its two-step inline-confirm pattern —
              compact trash circle → wider confirm pill — just with rounded
              edges and red accent softened. */}
      <div className={`${isPipelineView ? "col-span-1" : "col-span-2"} h-8 flex items-center justify-end gap-2`}>
        {/* Delete button — two-step confirm (first click shows pill, second click deletes) */}
        <button 
          onClick={handleDeleteClick}
          className={`rounded-full flex items-center justify-center transition-all shadow-soft-sm ${
            isDeleteConfirming
              ? 'w-[80px] h-8 bg-red-500 text-white hover:bg-red-600 animate-pulse'
              : 'w-8 h-8 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50'
          }`}
          title={isDeleteConfirming ? t.affiliateRow.actions.confirm : t.affiliateRow.actions.delete}
        >
          {isDeleteConfirming ? (
            <span className="text-[10px] font-semibold">{t.affiliateRow.actions.confirm}</span>
          ) : (
            <Trash2 size={14} />
          )}
        </button>
        {/* View button */}
        <button 
          onClick={() => setIsViewModalOpen(true)}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-gray-900 border border-[#e6ebf1] dark:border-gray-700 text-[#425466] dark:text-gray-300 shadow-soft-sm hover:bg-[#f6f9fc] dark:hover:bg-gray-800 transition-colors"
          title={t.affiliateRow.actions.view}
        >
          <Eye size={14} />
        </button>
        {/* Save button — three states: saving (yellow spinner), saved (filled green), default (soft green) */}
        <button 
          onClick={onSave}
          disabled={isSaving}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            isSaving
              ? 'bg-[#ffbf23] shadow-yellow-glow-sm cursor-wait'
              : isSaved 
                ? 'bg-emerald-500 text-white shadow-soft-md' 
                : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-soft-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
          }`}
          title={isSaving ? t.affiliateRow.actions.saving : isSaved ? t.affiliateRow.actions.saved : t.affiliateRow.actions.saveToPipeline}
        >
          {isSaving ? (
            <Loader2 size={14} className="animate-spin text-[#0f172a]" />
          ) : (
            <Save size={14} />
          )}
        </button>
      </div>

      {/* Relevant Content Modal - NEO-BRUTALIST (Updated January 6th, 2026) */}
      {/* Updated January 10th, 2026 - i18n migration */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-[#0a0a0a] border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_#000] dark:shadow-[8px_8px_0px_0px_#ffbf23] max-w-4xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b-4 border-black dark:border-white bg-[#ffbf23] flex items-center justify-between">
              <h3 className="text-lg font-black text-black uppercase">
                {t.affiliateRow.contentModal.title} ({(subItems?.length || 0) + 1} {t.affiliateRow.contentModal.articles})
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 bg-black text-white hover:bg-white hover:text-black border-2 border-black flex items-center justify-center transition-colors font-black"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)] space-y-4">
              {/* Render the current item first */}
              <div className="p-5 border-2 border-black dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors group relative bg-white dark:bg-[#0f0f0f]">
                <a href={`https://${domain}`} target="_blank" rel="noreferrer" className="absolute top-4 right-4 text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                  <ExternalLink size={16} />
                </a>
                
                <a href={link} target="_blank" rel="noreferrer" className="text-base font-black text-black dark:text-white hover:text-[#ffbf23] mb-3 block pr-10">
                  {title}
                </a>
                
                <div className="flex flex-wrap gap-2.5 mb-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-bold border-2 border-gray-200 dark:border-gray-600">
                    {t.affiliateRow.contentModal.ranking} <span className="text-black dark:text-white font-black bg-white dark:bg-black px-1.5 border border-black dark:border-gray-500">{rank}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#ffbf23]/20 text-black dark:text-[#ffbf23] text-xs font-bold border-2 border-[#ffbf23]">
                    {t.affiliateRow.contentModal.keyword} <span className="font-black bg-white dark:bg-black px-1.5 border border-black dark:border-[#ffbf23]">{keyword}</span>
                  </span>
                </div>
                
                <p className="text-xs font-bold text-gray-400 mb-2.5 border-b-2 border-gray-100 dark:border-gray-700 pb-2 uppercase">
                  {date || new Date().toLocaleDateString()} — {t.affiliateRow.contentModal.discoveredVia} {discoveryMethod?.type}
                </p>
                
                <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed pl-3 border-l-4 border-[#ffbf23]">
                  {snippet}
                </div>
              </div>

              {/* Render subItems */}
              {subItems?.map((item, idx) => (
                <div key={idx} className="p-5 border-2 border-black dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors group relative bg-white dark:bg-[#0f0f0f]">
                  <a href={`https://${item.domain}`} target="_blank" rel="noreferrer" className="absolute top-4 right-4 text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                    <ExternalLink size={16} />
                  </a>

                  <a href={item.link} target="_blank" rel="noreferrer" className="text-base font-black text-black dark:text-white hover:text-[#ffbf23] mb-3 block pr-10">
                    {item.title}
                  </a>

                  <div className="flex flex-wrap gap-2.5 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-bold border-2 border-gray-200 dark:border-gray-600">
                      {t.affiliateRow.contentModal.ranking} <span className="text-black dark:text-white font-black bg-white dark:bg-black px-1.5 border border-black dark:border-gray-500">{item.rank || '-'}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#ffbf23]/20 text-black dark:text-[#ffbf23] text-xs font-bold border-2 border-[#ffbf23]">
                      {t.affiliateRow.contentModal.keyword} <span className="font-black bg-white dark:bg-black px-1.5 border border-black dark:border-[#ffbf23]">{item.keyword || keyword}</span>
                    </span>
                  </div>

                  <p className="text-xs font-bold text-gray-400 mb-2.5 border-b-2 border-gray-100 dark:border-gray-700 pb-2 uppercase">
                    {item.date || date || new Date().toLocaleDateString()} — {t.affiliateRow.contentModal.discoveredVia} {item.discoveryMethod?.type || 'search'}
                  </p>
                  
                  <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed pl-3 border-l-4 border-[#ffbf23]">
                    {item.snippet}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t-4 border-black dark:border-white bg-gray-100 dark:bg-gray-900 flex justify-end gap-3">
              <button className="px-4 py-2 bg-emerald-500 text-white text-sm font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-2">
                <Save size={16} /> {t.affiliateRow.actions.save}
              </button>
              <button className="px-4 py-2 bg-red-500 text-white text-sm font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-2">
                <Trash2 size={16} /> {t.affiliateRow.actions.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Results Modal - NEO-BRUTALIST (Updated January 6th, 2026) */}
      {/* Updated January 10th, 2026 - i18n migration */}
      {isEmailModalOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setIsEmailModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-[#0a0a0a] border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_#000] dark:shadow-[8px_8px_0px_0px_#ffbf23] max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header - NEO-BRUTALIST Yellow */}
            <div className="px-6 py-4 border-b-4 border-black dark:border-white bg-[#ffbf23] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black border-2 border-black flex items-center justify-center">
                  <Mail size={18} className="text-[#ffbf23]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-black uppercase">{t.affiliateRow.emailModal.title}</h3>
                  <p className="text-xs text-black/70 font-medium">
                    {personName || channel?.name || domain.replace(/^www\./, '').split('.')[0]}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-black text-white text-xs font-black uppercase border-2 border-black">
                  <Mail size={12} />
                  {emailResults?.emails?.length || (email ? 1 : 0)} {t.affiliateRow.emailModal.found}
                </span>
                <button
                  onClick={() => setIsEmailModalOpen(false)}
                  className="w-8 h-8 bg-black text-white hover:bg-white hover:text-black border-2 border-black flex items-center justify-center transition-colors font-black"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)] bg-white dark:bg-[#0a0a0a]">
              {/* Show all contacts if available */}
              {emailResults?.contacts && emailResults.contacts.length > 0 ? (
                <div className="space-y-4">
                  {emailResults.contacts.map((contact, contactIdx) => {
                    const contactName = contact.firstName && contact.lastName 
                      ? `${contact.firstName} ${contact.lastName}`
                      : contact.fullName || `Contact ${contactIdx + 1}`;
                    
                    return (
                      <div key={contactIdx} className="border-2 border-black dark:border-gray-600 overflow-hidden">
                        {/* Contact Header */}
                        <div className="p-4 bg-gray-100 dark:bg-gray-800 border-b-2 border-black dark:border-gray-600">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-black flex items-center justify-center flex-shrink-0 border-2 border-black">
                              <User size={18} className="text-[#ffbf23]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-black text-gray-900 dark:text-white truncate">{contactName}</h4>
                              {contact.title && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5 mt-0.5 truncate font-medium">
                                  <Briefcase size={12} className="text-gray-400 flex-shrink-0" />
                                  {contact.title}
                                </p>
                              )}
                              {contact.linkedinUrl && (
                                <a 
                                  href={contact.linkedinUrl} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-1 font-bold uppercase"
                                >
                                  <Linkedin size={10} />
                                  LinkedIn
                                  <ExternalLink size={8} />
                                </a>
                              )}
                            </div>
                            <span className="text-[10px] font-black text-black bg-[#ffbf23] px-2 py-1 border-2 border-black uppercase">
                              {contact.emails.length} {contact.emails.length !== 1 ? t.affiliateRow.emailModal.emails : t.affiliateRow.emailModal.email}
                            </span>
                          </div>
                        </div>
                        
                        {/* Contact Emails */}
                        <div className="p-3 space-y-2 bg-white dark:bg-[#0f0f0f]">
                          {contact.emails.map((emailAddr, emailIdx) => (
                            <div 
                              key={emailIdx}
                              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 hover:border-black dark:hover:border-white transition-colors"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 bg-[#ffbf23] border-2 border-black flex items-center justify-center flex-shrink-0">
                                  <Mail size={14} className="text-black" />
                                </div>
                                <span className="font-bold text-gray-900 dark:text-white text-sm truncate font-mono">{emailAddr}</span>
                              </div>
                              <button
                                onClick={() => copyEmail(emailAddr)}
                                className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-black uppercase transition-all border-2 border-black ${
                                  copiedEmail === emailAddr
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-[#ffbf23] text-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]'
                                }`}
                              >
                                {copiedEmail === emailAddr ? <Check size={10} /> : <Copy size={10} />}
                                {copiedEmail === emailAddr ? t.affiliateRow.emailModal.done : t.affiliateRow.emailModal.copy}
                              </button>
                            </div>
                          ))}
                          
                          {/* Phone Numbers */}
                          {contact.phoneNumbers && contact.phoneNumbers.length > 0 && (
                            <div className="pt-2 mt-2 border-t-2 border-gray-200 dark:border-gray-700">
                              {contact.phoneNumbers.map((phone, phoneIdx) => (
                                <div 
                                  key={phoneIdx}
                                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 hover:border-black dark:hover:border-white transition-colors"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 border-2 border-black dark:border-gray-600 flex items-center justify-center">
                                      <Phone size={14} className="text-gray-600 dark:text-gray-300" />
                                    </div>
                                    <span className="font-bold text-gray-900 dark:text-white text-sm font-mono">{phone}</span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(phone);
                                      setCopiedEmail(phone);
                                      setTimeout(() => setCopiedEmail(null), 2000);
                                    }}
                                    className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-black uppercase transition-all border-2 ${
                                      copiedEmail === phone
                                        ? 'bg-emerald-500 text-white border-black'
                                        : 'bg-white text-black border-black hover:bg-gray-100'
                                    }`}
                                  >
                                    {copiedEmail === phone ? <Check size={10} /> : <Copy size={10} />}
                                    {copiedEmail === phone ? t.affiliateRow.emailModal.done : t.affiliateRow.emailModal.copy}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (emailResults?.emails?.length || (email ? 1 : 0)) > 0 ? (
                /* Fallback: Simple email list */
                <div>
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">{t.affiliateRow.emailModal.emailAddresses}</h4>
                  <div className="space-y-2">
                    {(emailResults?.emails || (email ? [email] : [])).map((emailAddr, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 hover:border-black dark:hover:border-white transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#ffbf23] border-2 border-black flex items-center justify-center">
                            <Mail size={16} className="text-black" />
                          </div>
                          <span className="font-bold text-gray-900 dark:text-white font-mono">{emailAddr}</span>
                        </div>
                        <button
                          onClick={() => copyEmail(emailAddr)}
                          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase transition-all border-2 border-black ${
                            copiedEmail === emailAddr
                              ? 'bg-emerald-500 text-white'
                              : 'bg-[#ffbf23] text-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]'
                          }`}
                        >
                          {copiedEmail === emailAddr ? <Check size={12} /> : <Copy size={12} />}
                          {copiedEmail === emailAddr ? t.affiliateRow.emailModal.done : t.affiliateRow.emailModal.copy}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* No emails found */
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center mx-auto mb-3">
                    <X size={20} className="text-gray-400" />
                  </div>
                  <p className="text-sm font-black text-gray-600 dark:text-gray-300 uppercase">{t.affiliateRow.emailModal.noEmailsFound}</p>
                  <p className="text-xs text-gray-400 mt-1">{t.affiliateRow.emailModal.trySearchingAgain}</p>
                  <button
                    onClick={() => {
                      setIsEmailModalOpen(false);
                      onFindEmail?.();
                    }}
                    className="mt-4 px-4 py-2 bg-[#ffbf23] text-black text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all inline-flex items-center gap-2"
                  >
                    <RotateCw size={12} />
                    {t.affiliateRow.actions.retry}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================
          VIEW MODAL (Added Dec 2025)
          Displays detailed affiliate information based on source type:
          - YouTube: Channel info, subscribers, relevant videos (video description, not channel bio)
          - Instagram: Profile info, followers, bio, relevant posts
          - TikTok: Profile with avatar, followers, bio, relevant posts
          ============================================================================ */}
      {/* View Modal - NEO-BRUTALIST (Updated January 6th, 2026) */}
      {/* Updated January 10th, 2026 - i18n migration */}
      {/* Fixed January 16, 2026 - Using createPortal to render at document.body level */}
      {/* This fixes the modal being cut off by parent scrollable containers */}
      {isViewModalOpen && portalTarget && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4"
          onClick={() => setIsViewModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-[#0a0a0a] border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_#000] dark:shadow-[8px_8px_0px_0px_#ffbf23] max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b-4 border-black dark:border-white bg-[#ffbf23] flex items-center justify-between">
              <h3 className="text-lg font-black text-black uppercase">{t.affiliateRow.viewModal.title}</h3>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="w-8 h-8 bg-black text-white hover:bg-white hover:text-black border-2 border-black flex items-center justify-center transition-colors font-black"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
              {/* ===============================================================
                  MATCH REASONS PANEL - January 22, 2026
                  Shows why the result matched (keyword/competitor/terms).
                  =============================================================== */}
              {showMatchReasons && (
                <div className="mb-4 border-2 border-black dark:border-gray-600">
                  <div className="px-3 py-2 bg-[#ffbf23] border-b-2 border-black dark:border-gray-600">
                    <h4 className="text-xs font-black text-black uppercase tracking-wide">
                      {t.dashboard.discoveryReasons?.title || 'Why This Result Was Shown'}
                    </h4>
                  </div>
                  <div className="p-3 space-y-2">
                    {matchReasons.length > 0 ? (
                      matchReasons.map((reason, index) => (
                        <div
                          key={`${reason.key}-${index}`}
                          className="flex items-start justify-between gap-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2 py-1.5"
                        >
                          <span className="text-[10px] font-black text-gray-900 dark:text-gray-100 uppercase">
                            {t.dashboard.discoveryReasons?.categories?.[reason.key] || reason.key}
                          </span>
                          <span className="text-[10px] text-gray-700 dark:text-gray-300 text-right">
                            {reason.value}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                        {t.dashboard.discoveryReasons?.emptyState || 'No additional match details'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {renderViewModalContent()}
            </div>

            {/* Footer Actions - NEO-BRUTALIST */}
            <div className="px-6 py-4 border-t-4 border-black dark:border-white bg-gray-100 dark:bg-gray-900 flex items-center justify-between">
              {/* Visit Button - Platform-specific */}
              <div className="flex items-center gap-2">
                <a
                  href={getVisitButtonConfig().link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-black text-white text-xs font-black uppercase border-2 border-black hover:bg-white hover:text-black transition-colors"
                >
                  {getVisitButtonConfig().icon}
                  {getVisitButtonConfig().text}
                </a>
                <button
                  onClick={() => setShowMatchReasons((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-black text-xs font-black uppercase border-2 border-black hover:bg-[#ffbf23] transition-colors"
                  title={t.dashboard.discoveryReasons?.title || 'Why This Result Was Shown'}
                >
                  <Info size={12} />
                  {t.dashboard.discoveryReasons?.title || 'Why This Result Was Shown'}
                </button>
              </div>

              {/* Save & Delete Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onSave();
                    setIsViewModalOpen(false);
                  }}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase transition-all border-2 border-black ${
                    isSaved
                      ? 'bg-emerald-500 text-white'
                      : 'bg-[#ffbf23] text-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]'
                  }`}
                >
                  <Save size={12} />
                  {isSaved ? t.affiliateRow.actions.saved : t.affiliateRow.actions.save}
                </button>
                <button
                  onClick={() => {
                    setIsViewModalOpen(false);
                    setTimeout(() => handleDeleteClick(), 100);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                >
                  <Trash2 size={12} />
                  {t.affiliateRow.actions.delete}
                </button>
              </div>
            </div>
          </div>
        </div>,
        portalTarget
      )}
    </div>
  );
};

