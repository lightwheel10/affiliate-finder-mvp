import React, { useState } from 'react';
import { ExternalLink, Trash2, Eye, Save, Globe, Youtube, Instagram, Mail, ChevronDown, CheckCircle2, Users, Play, Loader2, Search, X, Copy, Check, RotateCw, AlertCircle, Linkedin, Phone, Briefcase, User } from 'lucide-react';
import { Modal } from './Modal';
import { ResultItem, YouTubeChannelInfo } from '../types';

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
  discoveryMethod?: {
    type: 'competitor' | 'keyword' | 'topic' | 'tagged';
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
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);  // Added Dec 2025: View modal state
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  
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
      case 'tiktok': return <TikTokIcon size={size} className="text-slate-900" />;
      default: return <Globe size={size} className="text-[#1A1D21]" />;
    }
  };

  // Get platform-specific colors
  const getPlatformColors = () => {
    switch(source.toLowerCase()) {
      case 'youtube': return { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-600' };
      case 'instagram': return { bg: 'bg-gradient-to-r from-purple-50 to-pink-50', border: 'border-pink-100', text: 'text-pink-600' };
      case 'tiktok': return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-900' };
      default: return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700' };
    }
  };

  // Format date for display
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return new Date().toLocaleDateString();
    try {
      const d = new Date(dateStr);
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

  const renderDiscoveryMethod = () => {
    if (!discoveryMethod) return null;
    
    const label = discoveryMethod.type === 'competitor' ? 'Promoting Competitor:' : 
                 discoveryMethod.type === 'tagged' ? 'Tagged Competitor:' : 
                 discoveryMethod.type === 'topic' ? 'Topic:' : 'Keyword:';
    
    const textColor = discoveryMethod.type === 'competitor' ? 'text-amber-600' : 
                     discoveryMethod.type === 'tagged' ? 'text-orange-600' : 
                     discoveryMethod.type === 'topic' ? 'text-purple-600' : 'text-[#1A1D21]';
                     
    const bgColor = discoveryMethod.type === 'competitor' ? 'bg-amber-50' :
                   discoveryMethod.type === 'tagged' ? 'bg-orange-50' : 
                   discoveryMethod.type === 'topic' ? 'bg-purple-50' : 'bg-[#D4E815]/10';

    const borderColor = discoveryMethod.type === 'competitor' ? 'border-amber-100' :
                       discoveryMethod.type === 'tagged' ? 'border-orange-100' : 
                       discoveryMethod.type === 'topic' ? 'border-purple-100' : 'border-[#D4E815]/30';

    return (
      <div>
        <p className={`text-[10px] font-bold mb-1 ${textColor}`}>{label}</p>
        <span className={`inline-block px-2 py-1 rounded-md text-[11px] font-medium ${bgColor} ${textColor} border ${borderColor}`}>
          {discoveryMethod.value}
        </span>
      </div>
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
  const getVisitButtonConfig = () => {
    const sourceLower = source.toLowerCase();
    switch (sourceLower) {
      case 'youtube':
        return {
          text: 'Visit Channel',
          icon: <Youtube size={12} />,
          link: channel?.link || link,
        };
      case 'instagram':
        return {
          text: 'Visit Account',
          icon: <Instagram size={12} />,
          link: affiliateData?.instagramUsername 
            ? `https://instagram.com/${affiliateData.instagramUsername}` 
            : link,
        };
      case 'tiktok':
        return {
          text: 'Visit Account',
          icon: <TikTokIcon size={12} />,
          link: affiliateData?.tiktokUsername 
            ? `https://tiktok.com/@${affiliateData.tiktokUsername}` 
            : link,
        };
      default:
        return {
          text: 'Visit Website',
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

  // YouTube View Modal Content
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
        {/* Header - Channel Name with YouTube icon */}
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Youtube size={16} className="text-red-600" />
          <h3 className="text-sm font-bold text-slate-900">{channel?.name || personName || domain}</h3>
          {channel?.verified && (
            <CheckCircle2 size={12} className="text-blue-500 fill-blue-500" />
          )}
        </div>

        {/* Subscribers */}
        <p className="text-xs text-slate-600">
          {channel?.subscribers || '0'} subscribers
        </p>

        {/* Relevant Videos Section */}
        <div className="pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Relevant Videos ({1 + (subItems?.length || 0)})
          </h4>

          {/* Main Video Card */}
          <div className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
            {/* Video Thumbnail */}
            {videoThumbnail && (
              <a 
                href={link} 
                target="_blank" 
                rel="noreferrer"
                className="shrink-0 relative group"
              >
                <div className="w-28 h-16 rounded-md overflow-hidden bg-slate-200">
                  <img 
                    src={getProxiedImageUrl(videoThumbnail)} 
                    alt="" 
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
                {videoDuration && (
                  <span className="absolute bottom-0.5 right-0.5 px-1 py-0.5 bg-black/80 text-white text-[8px] font-medium rounded">
                    {videoDuration}
                  </span>
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow">
                    <Play size={12} className="text-slate-900 ml-0.5" fill="currentColor" />
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
                className="text-xs font-semibold text-slate-900 hover:text-red-600 transition-colors line-clamp-2 block mb-1"
              >
                {videoTitle}
              </a>
              
              {videoDescription && (
                <p className="text-[10px] text-slate-500 line-clamp-2 mb-2">
                  {videoDescription}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                {videoViews && <span>{videoViews} views</span>}
                {videoLikes !== undefined && <span>• {formatNumber(videoLikes)} likes</span>}
                {videoComments !== undefined && <span>• {formatNumber(videoComments)} comments</span>}
                {videoDate && <span>• {formatDate(videoDate)}</span>}
              </div>
            </div>
          </div>

          {/* Additional Videos from subItems */}
          {subItems && subItems.length > 0 && (
            <div className="mt-2 space-y-2">
              {subItems.map((item, idx) => (
                <div key={idx} className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                  {item.thumbnail && (
                    <a href={item.link} target="_blank" rel="noreferrer" className="shrink-0 relative">
                      <div className="w-28 h-16 rounded-md overflow-hidden bg-slate-200">
                        <img src={getProxiedImageUrl(item.thumbnail)} alt="" className="w-full h-full object-cover" />
                      </div>
                      {item.duration && (
                        <span className="absolute bottom-0.5 right-0.5 px-1 py-0.5 bg-black/80 text-white text-[8px] font-medium rounded">
                          {item.duration}
                        </span>
                      )}
                    </a>
                  )}
                  <div className="flex-1 min-w-0">
                    <a href={item.link} target="_blank" rel="noreferrer" className="text-xs font-semibold text-slate-900 hover:text-red-600 line-clamp-2 block mb-1">
                      {item.title}
                    </a>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                      {item.views && <span>{item.views} views</span>}
                      {item.youtubeVideoLikes !== undefined && <span>• {formatNumber(item.youtubeVideoLikes)} likes</span>}
                      {item.youtubeVideoComments !== undefined && <span>• {formatNumber(item.youtubeVideoComments)} comments</span>}
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

  // Instagram View Modal Content
  const renderInstagramViewContent = () => {
    const username = affiliateData?.instagramUsername || channel?.name || personName || domain;
    const fullName = affiliateData?.instagramFullName || '';
    const bio = affiliateData?.instagramBio || snippet || '';
    const followers = affiliateData?.instagramFollowers;
    const isVerified = affiliateData?.instagramIsVerified;
    // Instagram post-level stats (Added Dec 2025)
    const postLikes = affiliateData?.instagramPostLikes;
    const postComments = affiliateData?.instagramPostComments;
    const postViews = affiliateData?.instagramPostViews;
    
    return (
      <div className="space-y-4">
        {/* Header - Username with Instagram icon */}
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Instagram size={16} className="text-pink-600" />
          <h3 className="text-sm font-bold text-slate-900">
            {username.startsWith('@') ? username : `@${username}`}
          </h3>
          {isVerified && (
            <CheckCircle2 size={12} className="text-blue-500 fill-blue-500" />
          )}
        </div>

        {/* Profile Info - Full Name + Followers */}
        <p className="text-xs text-slate-600">
          {fullName && <span className="font-medium text-slate-900">{fullName}</span>}
          {fullName && followers && ' • '}
          {followers && <span>{formatNumber(followers)} followers</span>}
        </p>

        {/* Bio */}
        {bio && (
          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap line-clamp-4">
            {bio}
          </p>
        )}

        {/* Relevant Posts Section */}
        <div className="pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Relevant Posts ({1 + (subItems?.length || 0)})
          </h4>

          {/* Main Post Card */}
          <div className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            {/* Post Thumbnail */}
            {thumbnail && (
              <a href={link} target="_blank" rel="noreferrer" className="shrink-0">
                <div className="w-16 h-16 rounded-md overflow-hidden bg-slate-200">
                  <img 
                    src={getProxiedImageUrl(thumbnail)} 
                    alt="" 
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              </a>
            )}

            {/* Post Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-600 line-clamp-3 mb-2">
                {title || snippet}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                {postLikes !== undefined && <span>{formatNumber(postLikes)} likes</span>}
                {postComments !== undefined && <span>• {formatNumber(postComments)} comments</span>}
                {postViews !== undefined && <span>• {formatNumber(postViews)} views</span>}
                {date && <span>• {formatDate(date)}</span>}
              </div>
            </div>
          </div>

          {/* Additional Posts from subItems */}
          {subItems && subItems.length > 0 && (
            <div className="mt-2 space-y-2">
              {subItems.map((item, idx) => (
                <div key={idx} className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  {item.thumbnail && (
                    <a href={item.link} target="_blank" rel="noreferrer" className="shrink-0">
                      <div className="w-16 h-16 rounded-md overflow-hidden bg-slate-200">
                        <img src={getProxiedImageUrl(item.thumbnail)} alt="" className="w-full h-full object-cover" />
                      </div>
                    </a>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-600 line-clamp-3 mb-2">{item.title || item.snippet}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                      {item.instagramPostLikes !== undefined && <span>{formatNumber(item.instagramPostLikes)} likes</span>}
                      {item.instagramPostComments !== undefined && <span>• {formatNumber(item.instagramPostComments)} comments</span>}
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

  // TikTok View Modal Content
  const renderTikTokViewContent = () => {
    const username = affiliateData?.tiktokUsername || channel?.name || personName || domain;
    const displayName = affiliateData?.tiktokDisplayName || '';
    const bio = affiliateData?.tiktokBio || snippet || '';
    const followers = affiliateData?.tiktokFollowers;
    const isVerified = affiliateData?.tiktokIsVerified;
    const avatarUrl = channel?.thumbnail || thumbnail;
    
    // Video stats
    const videoPlays = affiliateData?.tiktokVideoPlays;
    const videoLikes = affiliateData?.tiktokVideoLikes;
    
    return (
      <div className="space-y-4">
        {/* Header - Username with TikTok icon */}
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <TikTokIcon size={16} className="text-slate-900" />
          <h3 className="text-sm font-bold text-slate-900">
            {username.startsWith('@') ? username : `@${username}`}
          </h3>
          {isVerified && (
            <CheckCircle2 size={12} className="text-blue-500 fill-blue-500" />
          )}
          {/* Country badge - if available */}
          {affiliateData?.similarWeb?.countryCode && (
            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-medium rounded-full border border-blue-200">
              {affiliateData.similarWeb.countryCode}
            </span>
          )}
        </div>

        {/* Profile Section with Avatar */}
        <div className="flex items-start gap-3">
          {/* Avatar */}
          {avatarUrl && (
            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
              <img 
                src={getProxiedImageUrl(avatarUrl)} 
                alt="" 
                className="w-full h-full object-cover"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>
          )}
          
          <div className="flex-1">
            {/* Display Name */}
            {displayName && (
              <p className="text-xs font-semibold text-slate-900">{displayName}</p>
            )}
            {/* Followers */}
            {followers && (
              <p className="text-[10px] text-slate-600">{formatNumber(followers)} followers</p>
            )}
          </div>
        </div>

        {/* Bio */}
        {bio && (
          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap line-clamp-4">
            {bio}
          </p>
        )}

        {/* Relevant Posts Section */}
        <div className="pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Relevant Posts ({1 + (subItems?.length || 0)})
          </h4>

          {/* Main Video Card */}
          <div className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            {/* Video Thumbnail */}
            {thumbnail && (
              <a href={link} target="_blank" rel="noreferrer" className="shrink-0 relative group">
                <div className="w-16 h-20 rounded-md overflow-hidden bg-slate-200">
                  <img 
                    src={getProxiedImageUrl(thumbnail)} 
                    alt="" 
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow">
                    <Play size={12} className="text-slate-900 ml-0.5" fill="currentColor" />
                  </div>
                </div>
              </a>
            )}

            {/* Video Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-700 line-clamp-3 mb-2">
                {title || snippet}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                {videoPlays && <span>{formatNumber(videoPlays)} views</span>}
                {videoLikes && <span>• {formatNumber(videoLikes)} likes</span>}
                {date && <span>• {formatDate(date)}</span>}
                {videoPlays && videoLikes && (
                  <span>• {calculateEngagement(videoPlays, videoLikes)} eng.</span>
                )}
              </div>
            </div>
          </div>

          {/* Additional Videos from subItems */}
          {subItems && subItems.length > 0 && (
            <div className="mt-2 space-y-2">
              {subItems.map((item, idx) => (
                <div key={idx} className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  {item.thumbnail && (
                    <a href={item.link} target="_blank" rel="noreferrer" className="shrink-0">
                      <div className="w-16 h-20 rounded-md overflow-hidden bg-slate-200">
                        <img src={getProxiedImageUrl(item.thumbnail)} alt="" className="w-full h-full object-cover" />
                      </div>
                    </a>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 line-clamp-3 mb-2">{item.title || item.snippet}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      {item.views && <span>{item.views} views</span>}
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
        // Web source - will be implemented later
        return (
          <div className="text-center py-6 text-slate-500">
            <Globe size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-xs">Web source view coming soon</p>
          </div>
        );
    }
  };

  const gridClass = isPipelineView 
    ? "grid grid-cols-[40px_220px_1fr_140px_100px_90px_130px_100px] gap-0"
    : "grid grid-cols-[40px_220px_1fr_140px_100px_120px] gap-0";

  const platformColors = getPlatformColors();

  return (
    <div className={`group ${gridClass} items-center p-4 bg-white border-b border-slate-50 hover:bg-slate-50/80 transition-all duration-200`}>
      {/* Checkbox - Connected to bulk selection system (Dec 2025)
          When onSelect is provided, clicking toggles selection state in parent component.
          Parent manages selectedLinks Set and passes isSelected based on whether link is in Set. */}
      <div className="flex justify-center">
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={() => onSelect?.(link)}
          className="w-4 h-4 rounded border-slate-300 text-[#D4E815] focus:ring-[#D4E815]/20 cursor-pointer" 
        />
      </div>

      {/* Affiliate Info - Enhanced for Social Media */}
      <div className="pr-6">
        <div className="flex items-center gap-3">
          {/* Platform Icon + Avatar */}
          <div className="relative shrink-0">
            {/* Avatar/Thumbnail */}
            <div className={`w-10 h-10 rounded-lg bg-slate-50 border ${platformColors.border} flex items-center justify-center overflow-hidden`}>
              <img 
                src={getProxiedImageUrl(channel?.thumbnail || thumbnail) || `https://www.google.com/s2/favicons?domain=${domain}&sz=64`} 
                alt="" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            {/* Platform badge */}
            {isSocialMedia && (
              <div className={`absolute -bottom-1 -left-1 w-5 h-5 rounded-full ${platformColors.bg} border ${platformColors.border} flex items-center justify-center shadow-sm`}>
                {getSourceIcon(10)}
              </div>
            )}
          </div>
          
          <div className="min-w-0 flex-1">
            {/* Row 1: Creator/Channel Name + badges */}
            <div className="flex items-center gap-2">
              {getSourceIcon(14)}
              <h4 className="font-bold text-sm text-slate-900 truncate">
                {channel?.name || personName || domain}
              </h4>
              {channel?.verified && (
                <CheckCircle2 size={12} className="text-blue-500 fill-blue-500 shrink-0" />
              )}
              {isNew && !isAlreadyAffiliate && (
                <span className="px-1.5 py-[1px] bg-emerald-500 text-white text-[9px] font-bold rounded-[3px] shadow-sm shrink-0">NEW</span>
              )}
              {isAlreadyAffiliate && (
                <span className="px-1.5 py-[1px] bg-slate-200 text-slate-600 text-[9px] font-bold rounded-[3px] shadow-sm shrink-0">ALREADY</span>
              )}
            </div>
            
            {/* Row 2: Stats - Enhanced for all social platforms */}
            {isSocialMedia && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {/* Followers/Subscribers */}
                {channel?.subscribers && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${platformColors.bg} ${platformColors.text} border ${platformColors.border}`}>
                    <Users size={10} />
                    {channel.subscribers} followers
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Relevant Content - Enhanced with thumbnail for social media */}
      <div className="pr-4 min-w-0 overflow-hidden">
        <div className="flex items-start gap-2">
          {/* Video/Post Thumbnail for social media */}
          {isSocialMedia && thumbnail && (
            <a 
              href={link} 
              target="_blank" 
              rel="noreferrer"
              className="shrink-0 relative group/thumb"
            >
              <div className="w-14 h-10 rounded-md overflow-hidden bg-slate-100 border border-slate-200">
                <img 
                  src={getProxiedImageUrl(thumbnail)} 
                  alt="" 
                  className="w-full h-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </div>
              {/* Duration badge */}
              {duration && (
                <span className="absolute bottom-0.5 right-0.5 px-1 py-0.5 bg-black/80 text-white text-[8px] font-medium rounded">
                  {duration}
                </span>
              )}
              {/* Play icon overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                <div className="w-5 h-5 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
                  <Play size={10} className="text-slate-900 ml-0.5" fill="currentColor" />
                </div>
              </div>
            </a>
          )}
          
          <div className="flex-1 min-w-0 space-y-0.5">
            <a 
              href={link}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-[#1A1D21] hover:underline decoration-[#D4E815] underline-offset-2 cursor-pointer line-clamp-2 block leading-tight"
            >
              {title}
            </a>
            
            {/* Stats row for social media */}
            {isSocialMedia && (views || date) && (
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                {views && (
                  <span className="inline-flex items-center gap-0.5">
                    <Eye size={10} className="text-slate-400" />
                    {views} views
                  </span>
                )}
                {date && (
                  <span className="inline-flex items-center gap-0.5">
                    <span className="text-slate-300">•</span>
                    {formatDate(date)}
                  </span>
                )}
              </div>
            )}
            
            {/* Keyword info for web results */}
            {!isSocialMedia && (
              <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                <span className="font-medium text-slate-700">rank {rank}</span>
                <span>for</span>
                <span className="font-medium text-slate-900 truncate max-w-[100px]">{keyword}</span>
              </div>
            )}

            {subItems && subItems.length > 0 && (
               <p 
                 onClick={() => setIsModalOpen(true)}
                 className="text-[9px] text-emerald-600 font-bold cursor-pointer hover:underline inline-block select-none"
               >
                 +{subItems.length} more
               </p>
            )}
          </div>
        </div>
      </div>

      {/* Discovery Method */}
      <div>
         {renderDiscoveryMethod()}
      </div>

      {/* Discovery Date */}
      <div className="text-xs font-medium text-slate-500">
        {formatDate(date)}
      </div>

      {/* Status (Pipeline Only) */}
      {isPipelineView && (
        <div className="shrink-0">
           <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-50 border border-amber-100 text-amber-600 text-[10px] font-bold">
             Discovered <ChevronDown size={10} className="ml-1 opacity-50" />
           </span>
        </div>
      )}

      {/* Emails (Pipeline Only) */}
      {isPipelineView && (
         <div className="shrink-0">
            {/* Email Found - Show email count badge that opens modal */}
            {(emailStatus === 'found' || email) && email ? (
               <button 
                 onClick={() => setIsEmailModalOpen(true)}
                 className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors text-[10px] font-bold group"
                 title="View email results"
               >
                 <Mail size={12} className="text-emerald-500" />
                 <span>{emailResults?.emails?.length || 1} Found</span>
                 <Eye size={10} className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
               </button>
            ) : emailStatus === 'searching' ? (
               /* Searching State - Animated spinner */
               <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                 <Loader2 size={14} className="text-blue-500 animate-spin" />
               </div>
            ) : emailStatus === 'not_found' ? (
               /* Not Found State - Show 0 found + retry */
               <div className="flex items-center gap-1">
                 <button 
                   onClick={() => setIsEmailModalOpen(true)}
                   className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors text-[10px] font-medium"
                   title="View search results"
                 >
                   <X size={10} className="text-slate-400" />
                   0 Found
                 </button>
                 <button 
                   onClick={onFindEmail}
                   className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center hover:bg-slate-200 transition-colors group"
                   title="Retry search"
                 >
                   <RotateCw size={12} className="text-slate-500 group-hover:rotate-180 transition-transform duration-300" />
                 </button>
               </div>
            ) : emailStatus === 'error' ? (
               /* Error State - Warning icon + retry */
               <div className="flex items-center gap-1">
                 <div 
                   className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center"
                   title="Error occurred"
                 >
                   <AlertCircle size={12} className="text-amber-500" />
                 </div>
                 <button 
                   onClick={onFindEmail}
                   className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center hover:bg-amber-200 transition-colors group"
                   title="Retry search"
                 >
                   <RotateCw size={12} className="text-amber-600 group-hover:rotate-180 transition-transform duration-300" />
                 </button>
               </div>
            ) : (
               /* Default: Find Email Button */
               <button 
                 onClick={onFindEmail}
                 className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#D4E815]/20 border border-[#D4E815]/40 hover:bg-[#D4E815]/40 transition-colors text-[10px] font-bold text-[#1A1D21]"
                 title="Find email"
               >
                 <Search size={12} />
                 Find Email
               </button>
            )}
         </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 shrink-0">
        {/* Delete Button with Inline Confirmation (Added Dec 2025)
            First click: Shows "Confirm?" state
            Second click: Executes delete
            Auto-resets after 3 seconds */}
        <button 
          onClick={handleDeleteClick}
          className={`flex items-center justify-center rounded transition-all shadow-sm ${
            isDeleteConfirming
              ? 'w-[70px] h-7 bg-red-500 text-white hover:bg-red-600 animate-pulse'
              : 'w-7 h-7 bg-red-400 text-white hover:bg-red-500'
          }`}
          title={isDeleteConfirming ? "Click again to confirm delete" : "Delete"}
        >
          {isDeleteConfirming ? (
            <span className="text-[10px] font-bold">Confirm?</span>
          ) : (
            <Trash2 size={14} />
          )}
        </button>
        <button 
          onClick={() => setIsViewModalOpen(true)}
          className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded hover:bg-slate-50 transition-colors shadow-sm" 
          title="View details"
        >
          <Eye size={14} />
        </button>
        {/* Save Button - Updated Dec 2025 to show saving state during bulk operations */}
        <button 
          onClick={onSave}
          disabled={isSaving}
          className={`w-7 h-7 flex items-center justify-center rounded transition-all shadow-sm ${
            isSaving
              ? 'bg-[#D4E815] border border-[#c5d913] cursor-wait'
              : isSaved 
                ? 'bg-emerald-500 text-white border border-emerald-600' 
                : 'bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100'
          }`}
          title={isSaving ? "Saving..." : isSaved ? "Saved" : "Save to Pipeline"}
        >
          {isSaving ? (
            <Loader2 size={14} className="animate-spin text-[#1A1D21]" />
          ) : (
            <Save size={14} />
          )}
        </button>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={`Relevant Content (${(subItems?.length || 0) + 1} articles)`}
        width="max-w-4xl"
      >
        <div className="space-y-4">
          {/* Render the current item first */}
          <div className="p-5 border border-slate-200 rounded-xl hover:bg-slate-50/50 transition-colors group relative bg-white shadow-sm">
             <a href={`https://${domain}`} target="_blank" rel="noreferrer" className="absolute top-4 right-4 text-slate-300 hover:text-[#1A1D21] transition-colors">
               <ExternalLink size={16} />
             </a>
             
             <a href={link} target="_blank" rel="noreferrer" className="text-base font-semibold text-[#1A1D21] hover:underline decoration-[#D4E815] underline-offset-2 mb-3 block pr-10">
               {title}
             </a>
             
             <div className="flex flex-wrap gap-2.5 mb-4">
               <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md border border-slate-200">
                 Ranking: <span className="text-slate-900 font-bold bg-white px-1.5 rounded shadow-sm border border-slate-100">{rank}</span>
               </span>
               <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#D4E815]/10 text-[#1A1D21] text-xs font-medium rounded-md border border-[#D4E815]/30">
                 Keyword: <span className="font-bold bg-white px-1.5 rounded shadow-sm border border-[#D4E815]/30">{keyword}</span>
               </span>
             </div>
             
             <p className="text-xs font-medium text-slate-400 mb-2.5 border-b border-slate-50 pb-2">
               {date || new Date().toLocaleDateString()} — <span className="text-slate-500 font-normal">Discovered via {discoveryMethod?.type}</span>
             </p>
             
             <div className="text-xs text-slate-600 leading-relaxed pl-3 border-l-2 border-slate-100">
               {snippet}
             </div>
          </div>

          {/* Render subItems */}
          {subItems?.map((item, idx) => (
             <div key={idx} className="p-5 border border-slate-200 rounded-xl hover:bg-slate-50/50 transition-colors group relative bg-white shadow-sm">
                <a href={`https://${item.domain}`} target="_blank" rel="noreferrer" className="absolute top-4 right-4 text-slate-300 hover:text-[#1A1D21] transition-colors">
                  <ExternalLink size={16} />
                </a>

                <a href={item.link} target="_blank" rel="noreferrer" className="text-base font-semibold text-[#1A1D21] hover:underline decoration-[#D4E815] underline-offset-2 mb-3 block pr-10">
                  {item.title}
                </a>

                <div className="flex flex-wrap gap-2.5 mb-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md border border-slate-200">
                    Ranking: <span className="text-slate-900 font-bold bg-white px-1.5 rounded shadow-sm border border-slate-100">{item.rank || '-'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#D4E815]/10 text-[#1A1D21] text-xs font-medium rounded-md border border-[#D4E815]/30">
                    Keyword: <span className="font-bold bg-white px-1.5 rounded shadow-sm border border-[#D4E815]/30">{item.keyword || keyword}</span>
                  </span>
                </div>

                <p className="text-xs font-medium text-slate-400 mb-2.5 border-b border-slate-50 pb-2">
                  {item.date || date || new Date().toLocaleDateString()} — <span className="text-slate-500 font-normal">Discovered via {item.discoveryMethod?.type || 'search'}</span>
                </p>
                
                <div className="text-xs text-slate-600 leading-relaxed pl-3 border-l-2 border-slate-100">
                   {item.snippet}
                </div>
             </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
           <button className="px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-sm font-bold hover:bg-emerald-100 transition-all flex items-center gap-2 shadow-sm">
              <Save size={16} /> Save
           </button>
           <button className="px-4 py-2 bg-red-400 text-white border border-red-500 rounded-lg text-sm font-bold hover:bg-red-500 transition-all flex items-center gap-2 shadow-sm">
              <Trash2 size={16} /> Delete
           </button>
        </div>
      </Modal>

      {/* Email Results Modal */}
      <Modal 
        isOpen={isEmailModalOpen} 
        onClose={() => setIsEmailModalOpen(false)}
        title=""
        width="max-w-2xl"
      >
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-slate-900">
                Email <span className="italic text-[#1A9A6D]">Results</span> for {personName || channel?.name || domain.split('.')[0]}
              </h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                (emailResults?.emails?.length || (email ? 1 : 0)) > 0 
                  ? 'bg-[#1A9A6D]/10 text-[#1A9A6D] border border-[#1A9A6D]/20' 
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}>
                <Mail size={12} />
                {emailResults?.emails?.length || (email ? 1 : 0)} Email{(emailResults?.emails?.length || 0) !== 1 ? 's' : ''} • {emailResults?.contacts?.length || (emailResults?.firstName ? 1 : 0)} Contact{(emailResults?.contacts?.length || 0) !== 1 ? 's' : ''}
              </span>
            </div>
            {emailResults?.provider && (
              <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                via {emailResults.provider}
              </span>
            )}
          </div>

          {/* Show all contacts if available, otherwise show simple email list */}
          {emailResults?.contacts && emailResults.contacts.length > 0 ? (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {emailResults.contacts.map((contact, contactIdx) => {
                const contactName = contact.firstName && contact.lastName 
                  ? `${contact.firstName} ${contact.lastName}`
                  : contact.fullName || `Contact ${contactIdx + 1}`;
                
                return (
                  <div key={contactIdx} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                    {/* Contact Header */}
                    <div className="p-4 bg-white border-b border-slate-100">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1A9A6D]/20 to-[#1A9A6D]/5 border border-[#1A9A6D]/20 flex items-center justify-center flex-shrink-0">
                          <User size={18} className="text-[#1A9A6D]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 truncate">{contactName}</h4>
                          {contact.title && (
                            <p className="text-sm text-slate-600 flex items-center gap-1.5 mt-0.5 truncate">
                              <Briefcase size={12} className="text-slate-400 flex-shrink-0" />
                              {contact.title}
                            </p>
                          )}
                          {contact.linkedinUrl && (
                            <a 
                              href={contact.linkedinUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-1 hover:underline"
                            >
                              <Linkedin size={10} />
                              LinkedIn
                              <ExternalLink size={8} />
                            </a>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-[#1A9A6D] bg-[#1A9A6D]/10 px-2 py-0.5 rounded-full border border-[#1A9A6D]/20">
                          {contact.emails.length} email{contact.emails.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    
                    {/* Contact Emails */}
                    <div className="p-3 space-y-2">
                      {contact.emails.map((emailAddr, emailIdx) => (
                        <div 
                          key={emailIdx}
                          className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg hover:border-[#1A9A6D]/30 hover:bg-[#1A9A6D]/5 transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-md bg-[#1A9A6D]/10 flex items-center justify-center flex-shrink-0">
                              <Mail size={12} className="text-[#1A9A6D]" />
                            </div>
                            <span className="font-medium text-slate-900 text-sm truncate">{emailAddr}</span>
                          </div>
                          <button
                            onClick={() => copyEmail(emailAddr)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex-shrink-0 ${
                              copiedEmail === emailAddr
                                ? 'bg-[#1A9A6D] text-white'
                                : 'bg-[#1A9A6D]/10 text-[#1A9A6D] hover:bg-[#1A9A6D]/20 border border-[#1A9A6D]/20'
                            }`}
                          >
                            {copiedEmail === emailAddr ? <Check size={10} /> : <Copy size={10} />}
                            {copiedEmail === emailAddr ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      ))}
                      
                      {/* Phone Numbers for this contact */}
                      {contact.phoneNumbers && contact.phoneNumbers.length > 0 && (
                        <div className="pt-2 mt-2 border-t border-slate-100">
                          {contact.phoneNumbers.map((phone, phoneIdx) => (
                            <div 
                              key={phoneIdx}
                              className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg hover:border-blue-200 hover:bg-blue-50/50 transition-all"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                                  <Phone size={12} className="text-blue-600" />
                                </div>
                                <span className="font-medium text-slate-900 text-sm">{phone}</span>
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(phone);
                                  setCopiedEmail(phone);
                                  setTimeout(() => setCopiedEmail(null), 2000);
                                }}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                                  copiedEmail === phone
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
                                }`}
                              >
                                {copiedEmail === phone ? <Check size={10} /> : <Copy size={10} />}
                                {copiedEmail === phone ? 'Copied!' : 'Copy'}
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
            /* Fallback: Simple email list (no contact details) */
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Email Addresses</h4>
              <div className="space-y-2">
                {(emailResults?.emails || (email ? [email] : [])).map((emailAddr, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-[#1A9A6D]/30 hover:bg-[#1A9A6D]/5 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#1A9A6D]/10 flex items-center justify-center">
                        <Mail size={14} className="text-[#1A9A6D]" />
                      </div>
                      <span className="font-medium text-slate-900">{emailAddr}</span>
                    </div>
                    <button
                      onClick={() => copyEmail(emailAddr)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        copiedEmail === emailAddr
                          ? 'bg-[#1A9A6D] text-white'
                          : 'bg-[#1A9A6D]/10 text-[#1A9A6D] hover:bg-[#1A9A6D]/20 border border-[#1A9A6D]/20'
                      }`}
                    >
                      {copiedEmail === emailAddr ? <Check size={12} /> : <Copy size={12} />}
                      {copiedEmail === emailAddr ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* No emails found */
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <X size={20} className="text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">No emails found</p>
              <p className="text-xs text-slate-400 mt-1">Try searching again or use a different provider</p>
              <button
                onClick={() => {
                  setIsEmailModalOpen(false);
                  onFindEmail?.();
                }}
                className="mt-4 px-4 py-2 bg-[#D4E815]/20 text-[#1A1D21] border border-[#D4E815]/40 rounded-lg text-xs font-bold hover:bg-[#D4E815]/40 transition-all inline-flex items-center gap-2"
              >
                <RotateCw size={12} />
                Search Again
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* ============================================================================
          VIEW MODAL (Added Dec 2025)
          Displays detailed affiliate information based on source type:
          - YouTube: Channel info, subscribers, relevant videos (video description, not channel bio)
          - Instagram: Profile info, followers, bio, relevant posts
          - TikTok: Profile with avatar, followers, bio, relevant posts
          ============================================================================ */}
      <Modal 
        isOpen={isViewModalOpen} 
        onClose={() => setIsViewModalOpen(false)}
        title=""
        width="max-w-lg"
      >
        {/* Modal Content - Source-specific */}
        {renderViewModalContent()}

        {/* Footer Actions - Consistent across all sources */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
          {/* Visit Button - Platform-specific */}
          <a
            href={getVisitButtonConfig().link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-md text-xs font-semibold transition-colors shadow-sm"
          >
            {getVisitButtonConfig().icon}
            {getVisitButtonConfig().text}
          </a>

          {/* Save & Delete Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                onSave();
                setIsViewModalOpen(false);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors shadow-sm ${
                isSaved
                  ? 'bg-emerald-500 text-white border border-emerald-600'
                  : 'bg-white text-teal-600 border border-teal-200 hover:bg-teal-50'
              }`}
            >
              <Save size={12} />
              {isSaved ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={() => {
                setIsViewModalOpen(false);
                // Trigger delete with slight delay to allow modal to close
                setTimeout(() => handleDeleteClick(), 100);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-400 hover:bg-red-500 text-white rounded-md text-xs font-semibold transition-colors shadow-sm"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

