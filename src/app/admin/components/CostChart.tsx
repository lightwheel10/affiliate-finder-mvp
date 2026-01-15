'use client';

import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

// Admin UI refresh (neo-brutalist, light-only) - January 15th, 2026
// Chart colors adjusted for high-contrast light theme.
// Polish pass (lighter gridlines, consistent tooltip) - January 15th, 2026

interface CostChartProps {
  data: Array<{
    date: string;
    cost: number;
    calls: number;
  }>;
}

export function CostChart({ data }: CostChartProps) {
  // Format data for display
  const chartData = data.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
    cost: Number(Number(item.cost || 0).toFixed(4)),
  }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#D4E815" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#D4E815" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#111827"
            strokeOpacity={0.2}
            vertical={false}
          />
          <XAxis 
            dataKey="date" 
            stroke="#111827"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="#111827"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '2px solid #111827',
              borderRadius: '0px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#111827' }}
            itemStyle={{ color: '#111827' }}
            formatter={(value: number) => [`$${Number(value || 0).toFixed(4)}`, 'Cost']}
          />
          <Area
            type="monotone"
            dataKey="cost"
            stroke="#111827"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorCost)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
