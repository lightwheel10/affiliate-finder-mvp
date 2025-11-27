import React, { useState } from 'react';
import { ExternalLink, Trash2, Eye, Save, Globe, Youtube, Instagram, MessageCircle, MoreHorizontal, Mail, ChevronDown } from 'lucide-react';
import { Modal } from './Modal';
import { ResultItem } from '../types';

interface AffiliateRowProps {
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
  isPipelineView?: boolean;
  discoveryMethod?: {
    type: 'competitor' | 'keyword' | 'topic' | 'tagged';
    value: string;
  };
  isAlreadyAffiliate?: boolean;
  isNew?: boolean;
  subItems?: ResultItem[];
}

export const AffiliateRow: React.FC<AffiliateRowProps> = ({ 
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
  isPipelineView = false,
  discoveryMethod = { type: 'keyword', value: keyword || 'Keyword' },
  isAlreadyAffiliate = false,
  isNew = true,
  subItems = []
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Determine icon based on source
  const getSourceIcon = () => {
    switch(source.toLowerCase()) {
      case 'youtube': return <Youtube size={14} className="text-red-600" />;
      case 'instagram': return <Instagram size={14} className="text-pink-600" />;
      case 'reddit': return <MessageCircle size={14} className="text-orange-600" />;
      default: return <Globe size={14} className="text-blue-600" />;
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
                     discoveryMethod.type === 'topic' ? 'text-purple-600' : 'text-blue-600';
                     
    const bgColor = discoveryMethod.type === 'competitor' ? 'bg-amber-50' :
                   discoveryMethod.type === 'tagged' ? 'bg-orange-50' : 
                   discoveryMethod.type === 'topic' ? 'bg-purple-50' : 'bg-blue-50';

    const borderColor = discoveryMethod.type === 'competitor' ? 'border-amber-100' :
                       discoveryMethod.type === 'tagged' ? 'border-orange-100' : 
                       discoveryMethod.type === 'topic' ? 'border-purple-100' : 'border-blue-100';

    return (
      <div>
        <p className={`text-[10px] font-bold mb-1 ${textColor}`}>{label}</p>
        <span className={`inline-block px-2 py-1 rounded-md text-[11px] font-medium ${bgColor} ${textColor} border ${borderColor}`}>
          {discoveryMethod.value}
        </span>
      </div>
    );
  };

  const gridClass = isPipelineView 
    ? "grid grid-cols-[48px_280px_1fr_160px_120px_100px_160px_100px] gap-0"
    : "grid grid-cols-[48px_280px_1fr_160px_128px_144px] gap-0";

  return (
    <div className={`group ${gridClass} items-center p-4 bg-white border-b border-slate-50 hover:bg-slate-50/80 transition-all duration-200`}>
      {/* Checkbox */}
      <div className="flex justify-center">
        <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer" />
      </div>

      {/* Affiliate Info */}
      <div className="pr-6">
        <div className="flex items-center gap-3">
           <div className={`${thumbnail ? 'w-8 h-8 rounded-md' : 'w-8 h-8 rounded-full'} bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden`}>
            <img 
              src={thumbnail || `https://www.google.com/s2/favicons?domain=${domain}&sz=64`} 
              alt="" 
              className={`${thumbnail ? 'w-full h-full object-cover' : 'w-4 h-4 opacity-90'}`}
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
          <div className="min-w-0 flex items-center gap-2">
             <h4 className="font-bold text-sm text-slate-900 truncate">{domain}</h4>
             <a href={`https://${domain}`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-600 transition-colors">
               <ExternalLink size={12} />
             </a>
             {isNew && !isAlreadyAffiliate && (
               <span className="px-1.5 py-[1px] bg-[#FF4500] text-white text-[9px] font-bold rounded-[3px] shadow-sm">NEW</span>
             )}
             {isAlreadyAffiliate && (
               <span className="px-1.5 py-[1px] bg-slate-200 text-slate-600 text-[9px] font-bold rounded-[3px] shadow-sm">ALREADY</span>
             )}
          </div>
        </div>
      </div>

      {/* Relevant Content */}
      <div className="pr-8 min-w-0">
        <div className="space-y-1">
          <a 
            href={link}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-blue-600 hover:underline decoration-blue-200 underline-offset-2 cursor-pointer truncate block"
          >
            {title}
          </a>
          
          <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
            <span className="font-medium text-slate-700">rank {rank}</span>
            <span>for keyword</span>
            <span className="font-medium text-slate-900">{keyword}</span>
          </div>

          {subItems && subItems.length > 0 && (
             <p 
               onClick={() => setIsModalOpen(true)}
               className="text-[10px] text-emerald-600 font-bold cursor-pointer hover:underline mt-1.5 inline-block select-none"
             >
               +{subItems.length} more pages
             </p>
          )}

          {/* Only show snippet in pipeline view or if explicitly needed, to match competitor clean look in discovery */}
          {isPipelineView && snippet && renderHighlightedSnippet()}
        </div>
      </div>

      {/* Discovery Method */}
      <div>
         {renderDiscoveryMethod()}
      </div>

      {/* Discovery Date */}
      <div className="text-xs font-medium text-slate-500">
        {date || new Date().toLocaleDateString()}
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
            {email ? (
               <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-100 transition-colors text-[10px] font-bold">
                 <div className="w-3.5 h-3.5 rounded-full border border-emerald-200 flex items-center justify-center bg-white shrink-0">
                    <Mail size={8} className="text-emerald-600" />
                 </div>
                 Access Email
               </button>
            ) : (
               <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-100 text-slate-400 text-[10px] font-medium">
                 <div className="w-3.5 h-3.5 rounded-full border border-slate-200 flex items-center justify-center bg-white shrink-0">
                    <Mail size={8} className="text-slate-300" />
                 </div>
                 No emails found
               </div>
            )}
         </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 shrink-0">
        <button className="w-7 h-7 flex items-center justify-center bg-red-400 text-white rounded hover:bg-red-500 transition-colors shadow-sm" title="Delete">
          <Trash2 size={14} />
        </button>
        <button className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded hover:bg-slate-50 transition-colors shadow-sm" title="View">
          <Eye size={14} />
        </button>
        <button 
          onClick={onSave}
          className={`w-7 h-7 flex items-center justify-center rounded transition-all shadow-sm ${
            isSaved 
              ? 'bg-emerald-500 text-white border border-emerald-600' 
              : 'bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100'
          }`}
          title={isSaved ? "Saved" : "Save to Pipeline"}
        >
          <Save size={14} />
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
             <a href={`https://${domain}`} target="_blank" rel="noreferrer" className="absolute top-4 right-4 text-slate-300 hover:text-blue-600 transition-colors">
               <ExternalLink size={16} />
             </a>
             
             <a href={link} target="_blank" rel="noreferrer" className="text-base font-semibold text-blue-600 hover:underline decoration-blue-200 underline-offset-2 mb-3 block pr-10">
               {title}
             </a>
             
             <div className="flex flex-wrap gap-2.5 mb-4">
               <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md border border-slate-200">
                 Ranking: <span className="text-slate-900 font-bold bg-white px-1.5 rounded shadow-sm border border-slate-100">{rank}</span>
               </span>
               <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-md border border-blue-100">
                 Keyword: <span className="font-bold bg-white px-1.5 rounded shadow-sm border border-blue-100">{keyword}</span>
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
                <a href={`https://${item.domain}`} target="_blank" rel="noreferrer" className="absolute top-4 right-4 text-slate-300 hover:text-blue-600 transition-colors">
                  <ExternalLink size={16} />
                </a>

                <a href={item.link} target="_blank" rel="noreferrer" className="text-base font-semibold text-blue-600 hover:underline decoration-blue-200 underline-offset-2 mb-3 block pr-10">
                  {item.title}
                </a>

                <div className="flex flex-wrap gap-2.5 mb-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md border border-slate-200">
                    Ranking: <span className="text-slate-900 font-bold bg-white px-1.5 rounded shadow-sm border border-slate-100">{item.rank || '-'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-md border border-blue-100">
                    Keyword: <span className="font-bold bg-white px-1.5 rounded shadow-sm border border-blue-100">{item.keyword || keyword}</span>
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
    </div>
  );
};

