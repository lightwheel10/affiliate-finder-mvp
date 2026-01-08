import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowRight, Bot, Zap, Clock, User } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ComparisonProps {
  humanTitle: string;
  humanPoints: string[];
  aiTitle: string;
  aiPoints: string[];
}

interface AgentPageProps {
  badge: string;
  title: string;
  subtitle: string;
  comparison: ComparisonProps;
  features: { title: string; desc: string }[];
}

const AgentPageLayout: React.FC<AgentPageProps> = ({ badge, title, subtitle, comparison, features }) => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-brandWhite dark:bg-brandBlack transition-colors duration-300">
      {/* Hero Section */}
      <div className="pt-32 pb-20 px-4 border-b-4 border-brandBlack dark:border-brandWhite relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-brandYellow border-2 border-brandBlack dark:border-brandWhite font-mono font-bold text-brandBlack shadow-neo dark:shadow-neo-white uppercase tracking-widest"
          >
            <Bot size={18} />
            {badge}
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-black text-brandBlack dark:text-brandWhite uppercase mb-8 tracking-tighter leading-none"
          >
            {title}
          </motion.h1>
          
          <motion.p 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 0.2 }}
             className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 font-medium max-w-4xl mx-auto leading-relaxed mb-10"
          >
            {subtitle}
          </motion.p>

          <Link to="/demo">
             <button className="px-10 py-6 bg-brandBlack dark:bg-brandWhite text-brandWhite dark:text-brandBlack font-black text-xl border-4 border-transparent hover:border-brandBlack dark:hover:border-brandYellow hover:bg-brandYellow hover:text-brandBlack transition-all uppercase shadow-neo dark:shadow-neo-white hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none flex items-center gap-3 mx-auto">
                {t.services.deploy} <ArrowRight size={24} strokeWidth={3} />
             </button>
          </Link>
        </div>
      </div>

      {/* Comparison Section - Human vs AI */}
      <div className="py-20 px-4 bg-gray-100 dark:bg-[#111]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
             <h2 className="text-3xl md:text-5xl font-black text-brandBlack dark:text-brandWhite uppercase tracking-tighter">
                The Efficiency Gap
             </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {/* Human Side */}
             <div className="bg-white dark:bg-[#1a1a1a] border-4 border-red-500 p-8 relative overflow-hidden opacity-90">
                <div className="absolute top-0 right-0 bg-red-500 text-white px-4 py-1 font-black text-xs uppercase">Old Way</div>
                <div className="flex items-center gap-4 mb-8 border-b-2 border-red-100 dark:border-red-900/30 pb-4">
                    <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-full text-red-600 dark:text-red-400">
                        <User size={32} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 dark:text-gray-200 uppercase">{comparison.humanTitle}</h3>
                </div>
                <ul className="space-y-4">
                    {comparison.humanPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-3 text-gray-600 dark:text-gray-400 font-medium">
                            <XCircle className="text-red-500 shrink-0 mt-1" size={20} />
                            {point}
                        </li>
                    ))}
                </ul>
             </div>

             {/* AI Side */}
             <div className="bg-brandWhite dark:bg-brandBlack border-4 border-brandYellow p-8 relative shadow-[8px_8px_0px_0px_#ffbf23]">
                <div className="absolute top-0 right-0 bg-brandYellow text-brandBlack px-4 py-1 font-black text-xs uppercase">RevenueWorks Way</div>
                 <div className="flex items-center gap-4 mb-8 border-b-2 border-gray-100 dark:border-gray-800 pb-4">
                    <div className="p-3 bg-brandYellow rounded-full text-brandBlack">
                        <Bot size={32} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-2xl font-black text-brandBlack dark:text-brandWhite uppercase">{comparison.aiTitle}</h3>
                </div>
                <ul className="space-y-4">
                    {comparison.aiPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-3 text-brandBlack dark:text-brandWhite font-bold text-lg">
                            <CheckCircle className="text-brandYellow shrink-0 mt-1" size={24} />
                            {point}
                        </li>
                    ))}
                </ul>
             </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="py-24 px-4 max-w-7xl mx-auto">
        <div className="mb-16 text-center">
           <h2 className="text-4xl md:text-6xl font-black text-brandBlack dark:text-brandWhite uppercase tracking-tighter mb-4">
              Capabilities
           </h2>
           <div className="h-2 w-24 bg-brandYellow mx-auto"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group p-8 border-4 border-brandBlack dark:border-brandWhite bg-brandWhite dark:bg-brandBlack hover:-translate-y-2 transition-all hover:shadow-neo dark:hover:shadow-neo-white"
            >
               <div className="flex items-center justify-between mb-4">
                  <Zap size={32} className="text-brandYellow" />
                  {/* Ensure number is high contrast: Black on White (light) or White on Black (dark) - Reverting standard inversion for contrast */}
                  <span className="bg-brandBlack text-brandWhite dark:bg-brandWhite dark:text-brandBlack font-black text-3xl px-4 py-2 select-none shadow-[4px_4px_0px_0px_#ffbf23] dark:shadow-none">
                    0{index + 1}
                  </span>
               </div>
              <h4 className="text-2xl font-black text-brandBlack dark:text-brandWhite uppercase mb-4">
                {feature.title}
              </h4>
              <p className="text-gray-600 dark:text-gray-400 font-medium leading-relaxed text-lg">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="bg-brandYellow py-16 text-center px-4 border-t-4 border-brandBlack dark:border-brandWhite">
          <h2 className="text-4xl md:text-6xl font-black text-brandBlack uppercase mb-8 leading-none tracking-tighter">
              Ready to eliminate<br/>manual work?
          </h2>
          <Link to="/demo">
            <button className="px-12 py-5 bg-brandBlack text-brandWhite font-black text-xl border-4 border-transparent hover:bg-white hover:text-black hover:border-black transition-all uppercase shadow-neo hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]">
                Start Building Now
            </button>
          </Link>
      </div>
    </div>
  );
};

export default AgentPageLayout;