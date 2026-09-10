/**
 * =============================================================================
 * TopCompetitorsChart Component
 * =============================================================================
 * Updated: January 16, 2026
 * 
 * Changed #D4E815 (lime green) to #ffbf23 (brand yellow)
 * for consistency with the neo-brutalist design system.
 * =============================================================================
 */
'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { getPlatformLogoAsset } from '@/app/components/PlatformLogo';

interface CompetitorData {
  name: string;
  value: number;
  avatar: string;
  platform: 'instagram' | 'tiktok' | 'youtube';
}

interface TopCompetitorsChartProps {
  data: CompetitorData[];
}

interface CustomXAxisTickProps {
  x?: number;
  y?: number;
  payload?: {
    index?: number;
    value?: string;
  };
  data: CompetitorData[];
}

// Custom X-axis tick with avatar and platform badge
const CustomXAxisTick = ({ x = 0, y = 0, payload, data }: CustomXAxisTickProps) => {
  if (!payload?.value) return null;

  const competitor = data.find((d: CompetitorData) => d.name === payload.value);
  if (!competitor) return null;

  const platformAsset = getPlatformLogoAsset(competitor.platform);

  return (
    <g transform={`translate(${x},${y + 4})`}>
      {/* Avatar circle */}
      <defs>
        <clipPath id={`avatar-clip-${payload.index ?? 0}`}>
          <circle cx="0" cy="12" r="12" />
        </clipPath>
      </defs>
      <image
        x="-12"
        y="0"
        width="24"
        height="24"
        href={competitor.avatar}
        clipPath={`url(#avatar-clip-${payload.index ?? 0})`}
      />
      {/* Platform badge - small circle at bottom right */}
      <circle
        cx="7"
        cy="19"
        r="6"
        fill="white"
        stroke="white"
        strokeWidth="1.5"
      />
      {platformAsset && (
        <image
          role="img"
          aria-label={competitor.platform}
          x="2"
          y="14"
          width="10"
          height="10"
          href={platformAsset}
        />
      )}
    </g>
  );
};

export const TopCompetitorsChart: React.FC<TopCompetitorsChartProps> = ({ data }) => {
  // Format value for display (e.g., 32000 -> 32K)
  const formatValue = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toString();
  };

  return (
    <div className="w-full h-[160px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 5, right: 10, left: 0, bottom: 40 }}
          barCategoryGap="20%"
        >
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={(props) => <CustomXAxisTick {...props} data={data} />}
            interval={0}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
            tickFormatter={formatValue}
            domain={[0, 40000]}
            ticks={[0, 10000, 20000, 30000, 40000]}
            width={32}
          />
          {/* Bar colors - Updated January 16, 2026: Changed #D4E815 to #ffbf23 */}
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={index < 2 ? '#ffbf23' : '#E8E8E8'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
