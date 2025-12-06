'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function ScanCountdown() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 7,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    // Simple countdown starting from 7 days
    const calculateTimeLeft = () => {
      setTimeLeft(prev => {
        let { days, hours, minutes, seconds } = prev;
        
        // Countdown logic
        if (seconds > 0) {
          seconds--;
        } else if (minutes > 0) {
          minutes--;
          seconds = 59;
        } else if (hours > 0) {
          hours--;
          minutes = 59;
          seconds = 59;
        } else if (days > 0) {
          days--;
          hours = 23;
          minutes = 59;
          seconds = 59;
        }
        
        return { days, hours, minutes, seconds };
      });
    };

    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatNumber = (num: number) => num.toString().padStart(2, '0');

  return (
    <div className="relative bg-[#1A1D21] rounded-lg px-3 py-1.5 text-white overflow-hidden">
      {/* Background pattern */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(#D4E815_1px,transparent_1px)] [background-size:12px_12px]"></div>
      
      <div className="relative z-10 flex items-center gap-2.5">
        {/* Icon */}
        <div className="p-1 rounded-md backdrop-blur-sm bg-[#D4E815]/20">
          <Clock size={10} className="text-[#D4E815]" />
        </div>
        
        {/* Label */}
        <span className="text-[9px] font-bold tracking-wide uppercase text-white/90 whitespace-nowrap">Next Scan</span>
        
        {/* Separator */}
        <div className="h-4 w-[1px] bg-white/20"></div>
        
        {/* Numbers */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-white bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm min-w-[22px] text-center">
            {formatNumber(timeLeft.days)}
          </span>
          <span className="text-[10px] text-white/60 font-bold">:</span>
          <span className="text-xs font-bold text-white bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm min-w-[22px] text-center">
            {formatNumber(timeLeft.hours)}
          </span>
          <span className="text-[10px] text-white/60 font-bold">:</span>
          <span className="text-xs font-bold text-white bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm min-w-[22px] text-center">
            {formatNumber(timeLeft.minutes)}
          </span>
          <span className="text-[10px] text-white/60 font-bold">:</span>
          <span className="text-xs font-bold text-white bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm min-w-[22px] text-center">
            {formatNumber(timeLeft.seconds)}
          </span>
        </div>
      </div>
    </div>
  );
}
