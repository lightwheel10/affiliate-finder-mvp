import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { 
    Zap, Search, LayoutGrid, Briefcase, Users, 
    Globe, Youtube, Instagram, Music, MessageSquare, 
    Lock, ChevronRight, User, Plus
} from 'lucide-react';
import { motion } from 'framer-motion';

const DashboardDemo: React.FC = () => {
  const { t } = useLanguage();
  const d = t.dashboard;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-black font-sans flex text-gray-900 dark:text-gray-100">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-white dark:bg-[#0a0a0a] border-r-4 border-brandBlack dark:border-brandWhite flex flex-col shrink-0 relative z-20">
        {/* Brand */}
        <div className="p-6 border-b-4 border-brandBlack dark:border-brandWhite">
            <div className="flex items-center gap-2 mb-1">
                <div className="bg-brandYellow p-1 border-2 border-brandBlack dark:border-brandWhite shadow-neo-sm">
                    <Zap size={16} className="text-brandBlack" />
                </div>
                <span className="font-black text-lg tracking-tighter leading-none">{d.brand}</span>
            </div>
            <p className="text-[10px] text-gray-500 font-mono pl-8">{d.backed}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
            {/* Discovery Section */}
            <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-2">{d.sidebar.discovery}</h4>
                <ul className="space-y-1">
                    <li>
                        <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900 hover:text-brandBlack dark:hover:text-white transition-colors font-medium rounded-md">
                            <Search size={18} />
                            {d.sidebar.find}
                        </button>
                    </li>
                    <li>
                        <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900 hover:text-brandBlack dark:hover:text-white transition-colors font-medium rounded-md">
                            <LayoutGrid size={18} />
                            {d.sidebar.all}
                        </button>
                    </li>
                </ul>
            </div>

            {/* Management Section */}
            <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-2">{d.sidebar.management}</h4>
                <ul className="space-y-1">
                    <li>
                        <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900 hover:text-brandBlack dark:hover:text-white transition-colors font-medium rounded-md">
                            <Briefcase size={18} />
                            {d.sidebar.saved}
                        </button>
                    </li>
                    <li>
                        <button className="w-full flex items-center gap-3 px-3 py-2 bg-brandYellow/20 text-brandBlack dark:text-brandYellow font-bold border-l-4 border-brandYellow rounded-r-md">
                            <Users size={18} />
                            {d.sidebar.outreach}
                        </button>
                    </li>
                </ul>
            </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t-4 border-brandBlack dark:border-brandWhite bg-gray-50 dark:bg-[#111]">
            {/* Plan Card */}
            <div className="bg-[#1a1a1a] p-4 rounded-lg mb-4 text-white border-2 border-brandBlack dark:border-gray-700 shadow-neo-sm">
                <div className="flex items-start gap-3 mb-3">
                    <div className="p-1.5 bg-brandYellow rounded text-brandBlack">
                        <Zap size={14} fill="currentColor" />
                    </div>
                    <div>
                        <h5 className="font-black text-xs uppercase text-brandYellow">{d.sidebar.plan}</h5>
                        <p className="text-[10px] text-gray-300 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            {d.sidebar.active}
                        </p>
                    </div>
                </div>
                <button className="w-full py-1.5 bg-brandYellow text-brandBlack text-xs font-bold uppercase rounded hover:bg-white transition-colors flex items-center justify-center gap-1">
                    {d.sidebar.manage} <ChevronRight size={10} />
                </button>
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-3 px-1">
                <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center font-bold text-xs border border-gray-400">
                    TE
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">test</p>
                    <p className="text-xs text-gray-500 truncate">test@test2.de</p>
                </div>
            </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#050505]">
        
        {/* TOP BAR */}
        <header className="h-16 border-b-4 border-brandBlack dark:border-brandWhite flex items-center justify-between px-6 bg-white dark:bg-[#0a0a0a]">
            <h1 className="font-black text-xl uppercase tracking-tight">{d.sidebar.outreach}</h1>

            <div className="flex items-center gap-4">
                {/* Timer Pill */}
                <div className="hidden md:flex items-center gap-2 bg-[#1a1a1a] text-brandYellow px-3 py-1.5 rounded-full text-xs font-mono border border-brandBlack">
                    <ClockIcon /> {d.top.nextScan} <span className="text-white">PRO</span>
                </div>

                {/* Stats Pills */}
                <div className="hidden lg:flex items-center gap-3 text-xs font-bold">
                    <div className="px-3 py-1.5 border-2 border-brandBlack dark:border-gray-600 rounded-md bg-white dark:bg-black">
                        Search <span className="text-gray-400">|</span> 10/10 {d.top.topic}
                    </div>
                    <div className="px-3 py-1.5 border-2 border-brandBlack dark:border-gray-600 rounded-md bg-white dark:bg-black">
                        Email <span className="text-gray-400">|</span> 300/300 {d.top.emailCredits}
                    </div>
                     <div className="px-3 py-1.5 border-2 border-brandBlack dark:border-gray-600 rounded-md bg-white dark:bg-black">
                        AI <span className="text-gray-400">|</span> 400 {d.top.aiCredits}
                    </div>
                </div>

                <button className="flex items-center gap-2 px-4 py-2 bg-brandYellow text-brandBlack font-black text-xs uppercase border-2 border-brandBlack shadow-neo-sm hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all">
                    <Plus size={14} strokeWidth={3} /> {d.top.findBtn}
                </button>
            </div>
        </header>

        {/* CONTENT AREA */}
        <div className="flex-1 p-8 overflow-y-auto">
            
            {/* Filters Row */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder={d.main.search} 
                            className="w-full pl-10 pr-4 py-2 border-2 border-brandBlack dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-brandYellow"
                        />
                    </div>
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded border border-gray-200 dark:border-gray-800">
                        <button className="p-1.5 bg-brandYellow text-brandBlack rounded shadow-sm"><Globe size={16} /></button>
                        <button className="p-1.5 text-gray-400 hover:text-gray-600"><Youtube size={16} /></button>
                        <button className="p-1.5 text-gray-400 hover:text-gray-600"><Instagram size={16} /></button>
                        <button className="p-1.5 text-gray-400 hover:text-gray-600"><Music size={16} /></button>
                    </div>
                </div>

                <button disabled className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-400 font-bold text-xs uppercase border-2 border-gray-200 dark:border-gray-700 rounded cursor-not-allowed flex items-center gap-2">
                    <Zap size={14} /> {d.main.generate} (0)
                </button>
            </div>

            {/* Table Area */}
            <div className="bg-white dark:bg-[#0f0f0f] border-4 border-gray-200 dark:border-gray-800 rounded-lg min-h-[500px] flex flex-col">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 p-4 border-b-2 border-gray-100 dark:border-gray-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <div className="col-span-1 flex justify-center"><input type="checkbox" className="accent-brandYellow" /></div>
                    <div className="col-span-3">{d.main.cols.affiliate}</div>
                    <div className="col-span-3">{d.main.cols.content}</div>
                    <div className="col-span-2">{d.main.cols.method}</div>
                    <div className="col-span-1">{d.main.cols.email}</div>
                    <div className="col-span-2 text-right">{d.main.cols.message}</div>
                </div>

                {/* Empty State */}
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4 border-2 border-gray-100 dark:border-gray-800">
                        <MessageSquare size={24} className="text-gray-300" />
                    </div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">
                        {d.main.empty.title}
                    </h3>
                    <p className="text-gray-500 text-sm max-w-xs">
                        {d.main.empty.subtitle}
                    </p>
                </div>
            </div>

        </div>
      </main>
    </div>
  );
};

// Simple Icon component for the top bar timer
const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

export default DashboardDemo;