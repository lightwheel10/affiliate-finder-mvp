/**
 * =============================================================================
 * AffiliateCard Component - i18n Migration
 * =============================================================================
 * Updated: January 10th, 2026 - Priority 5: Shared Components
 * 
 * This component displays affiliate information in a card format.
 * All UI strings have been migrated to use the translation dictionary.
 * 
 * Translation hook usage: const { t } = useLanguage();
 * =============================================================================
 */
'use client';

import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Instagram, Youtube, Music, CheckCircle2, MoreVertical } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface AffiliateCardProps {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  followers: number;
  engagementRate: number;
  avgEngagement?: number;
  recentGrowth: number;
  platform: 'Instagram' | 'TikTok' | 'YouTube';
  verified?: boolean;
  sparklineData: number[];
  onAddProfile?: () => void;
}

export const AffiliateCard: React.FC<AffiliateCardProps> = ({
  id,
  name,
  handle,
  avatar,
  followers,
  engagementRate,
  avgEngagement,
  recentGrowth,
  platform,
  verified = false,
  sparklineData,
  onAddProfile,
}) => {
  // i18n translation hook (January 10th, 2026)
  const { t } = useLanguage();

  // Format followers count
  const formatFollowers = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(count % 1000000 === 0 ? 0 : 0)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(0)}K`;
    }
    return count.toString();
  };

  // Format engagement for display
  const formatEngagement = (rate: number) => {
    if (avgEngagement) {
      return `${(avgEngagement / 1000).toFixed(2)}K`;
    }
    return `${rate.toFixed(2)}%`;
  };

  // Get platform icon
  const getPlatformIcon = () => {
    switch (platform) {
      case 'Instagram':
        return <Instagram size={10} className="text-white" />;
      case 'TikTok':
        return <Music size={10} className="text-white" />;
      case 'YouTube':
        return <Youtube size={10} className="text-white" />;
      default:
        return null;
    }
  };

  // Get platform badge color
  const getPlatformColor = () => {
    switch (platform) {
      case 'Instagram':
        return 'bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737]';
      case 'TikTok':
        return 'bg-black';
      case 'YouTube':
        return 'bg-[#FF0000]';
      default:
        return 'bg-slate-500';
    }
  };

  // Transform sparkline data for recharts
  const chartData = sparklineData.map((value, index) => ({ value, index }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-lg hover:border-slate-300 transition-all duration-200 group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {/* Avatar with platform badge */}
          <div className="relative">
            <img
              src={avatar}
              alt={name}
              className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
            />
            <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${getPlatformColor()} flex items-center justify-center shadow-sm border-[1.5px] border-white`}>
              {getPlatformIcon()}
            </div>
          </div>
          
          {/* Name & Handle */}
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h4 className="font-semibold text-sm text-slate-900 truncate">{name}</h4>
              {verified && (
                <CheckCircle2 size={12} className="text-[#1DA1F2] fill-[#1DA1F2] stroke-white shrink-0" />
              )}
            </div>
            <p className="text-xs text-slate-500 truncate">{handle}</p>
          </div>
        </div>
        
        {/* More menu */}
        <button className="p-1 hover:bg-slate-100 rounded transition-colors opacity-0 group-hover:opacity-100">
          <MoreVertical size={14} className="text-slate-400" />
        </button>
      </div>

      {/* Stats Row - i18n January 10th, 2026 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Followers */}
        <div>
          <p className="text-xl font-bold text-slate-900 tracking-tight leading-none">{formatFollowers(followers)}</p>
          <p className="text-[10px] text-slate-500 mt-1">{t.affiliateCard.totalFollowers}</p>
        </div>
        
        {/* Engagement */}
        <div>
          <p className="text-xl font-bold text-slate-900 tracking-tight leading-none">{formatEngagement(engagementRate)}</p>
          <p className="text-[10px] text-slate-500 mt-1">{t.affiliateCard.engagementRate}</p>
        </div>
      </div>

      {/* Growth & Sparkline - i18n January 10th, 2026 */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-lg font-bold text-slate-900 leading-none">{recentGrowth}%</p>
          <p className="text-[10px] text-slate-500 mt-1">{t.affiliateCard.recentGrowth}</p>
        </div>
        
        {/* Sparkline */}
        <div className="w-20 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke="#D4E815"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Add Profile Button - i18n January 10th, 2026 */}
      <button
        onClick={onAddProfile}
        className="w-full py-2 bg-[#D4E815] text-[#1A1D21] text-xs font-semibold rounded-lg hover:bg-[#c5d913] transition-all"
      >
        {t.affiliateCard.addProfile}
      </button>
    </div>
  );
};
