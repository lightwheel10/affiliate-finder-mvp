'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface MarketShareData {
  month: string;
  value: number;
}

interface MarketShareChartProps {
  data: MarketShareData[];
}

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1A1D21] text-white px-2.5 py-1.5 rounded-lg shadow-lg text-[10px]">
        <p className="font-medium">{label}</p>
        <p className="text-[#D4E815] font-bold">{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

export const MarketShareChart: React.FC<MarketShareChartProps> = ({ data }) => {
  return (
    <div className="w-full h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
            tickFormatter={(value) => `${value}%`}
            domain={[0, 50]}
            ticks={[0, 10, 20, 30, 40, 50]}
            width={32}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#D4E815"
            strokeWidth={2}
            dot={{
              fill: '#D4E815',
              stroke: '#D4E815',
              strokeWidth: 0,
              r: 3,
            }}
            activeDot={{
              fill: '#D4E815',
              stroke: '#fff',
              strokeWidth: 2,
              r: 5,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
