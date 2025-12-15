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
              <stop offset="5%" stopColor="#D4E815" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#D4E815" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#2E3338" 
            vertical={false}
          />
          <XAxis 
            dataKey="date" 
            stroke="#6B7280"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="#6B7280"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#23272B',
              border: '1px solid #2E3338',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#9CA3AF' }}
            itemStyle={{ color: '#D4E815' }}
            formatter={(value: number) => [`$${Number(value || 0).toFixed(4)}`, 'Cost']}
          />
          <Area
            type="monotone"
            dataKey="cost"
            stroke="#D4E815"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorCost)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
