import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowRight, Bot, Zap, Search, TrendingUp, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const Affiliate: React.FC = () => {
  const { t } = useLanguage();
  const icons = [Bot, Zap, Search, TrendingUp];

  return (
    <div className="min-h-screen bg-brandWhite dark:bg-brandBlack transition-colors duration-300">
      {/* Hero Section */}
      <div className="border-b-4 border-brandBlack dark:border-brandWhite pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-block mb-6 px-4 py-2 bg-brandYellow border-2 border-brandBlack dark:border-brandWhite font-mono font-bold text-brandBlack shadow-neo dark:shadow-neo-white uppercase tracking-widest"
            >
                RevenueWorks Module: Affiliate
            </motion.div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-brandBlack dark:text-brandWhite uppercase mb-8 tracking-tighter leading-none">
                {t.affiliatePage.title}
            </h1>
            <h2 className="text-2xl md:text-3xl font-bold text-brandYellow mb-8 uppercase tracking-wide">
                {t.affiliatePage.subtitle}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 font-medium max-w-4xl mx-auto leading-relaxed">
                {t.affiliatePage.description}
            </p>
        </div>
      </div>

      {/* The Offer Section */}
      <div className="py-20 px-4 bg-gray-50 dark:bg-[#0a0a0a] border-b-4 border-brandBlack dark:border-brandWhite">
        <div className="max-w-5xl mx-auto">
            <div className="bg-brandWhite dark:bg-brandBlack border-4 border-brandBlack dark:border-brandWhite p-8 md:p-12 shadow-[8px_8px_0px_0px_#000] dark:shadow-[8px_8px_0px_0px_#fff]">
                <h3 className="text-4xl font-black text-brandBlack dark:text-brandWhite uppercase mb-6">
                    {t.affiliatePage.offer.title}
                </h3>
                <p className="text-lg text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                    {t.affiliatePage.offer.description}
                </p>
            </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="py-24 px-4 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {t.affiliatePage.features.map((feature: any, index: number) => {
                const Icon = icons[index] || Zap;
                return (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                        className="group p-8 border-4 border-brandBlack dark:border-brandWhite bg-brandWhite dark:bg-brandBlack hover:-translate-y-2 transition-all hover:shadow-[8px_8px_0px_0px_#ffbf23]"
                    >
                        <div className="w-16 h-16 bg-brandBlack dark:bg-brandWhite text-brandWhite dark:text-brandBlack flex items-center justify-center mb-6 group-hover:bg-brandYellow group-hover:text-brandBlack transition-colors">
                            <Icon size={32} strokeWidth={2} />
                        </div>
                        <h4 className="text-2xl font-black text-brandBlack dark:text-brandWhite uppercase mb-4">
                            {feature.title}
                        </h4>
                        <p className="text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
                            {feature.description}
                        </p>
                    </motion.div>
                )
            })}
        </div>
      </div>

      {/* Quote / Expertise */}
      <div className="py-20 px-4 bg-brandBlack border-t-4 border-brandYellow text-brandWhite">
        <div className="max-w-4xl mx-auto text-center">
             <div className="mb-8 text-brandYellow">
                <CheckCircle size={64} className="mx-auto" strokeWidth={1.5} />
             </div>
             <h3 className="text-3xl md:text-5xl font-black uppercase mb-8 leading-tight">
                "{t.affiliatePage.quote.text}"
             </h3>
             <div className="space-y-6 text-lg md:text-xl font-medium text-gray-300">
                <p>{t.affiliatePage.quote.subtext}</p>
                <p className="text-brandYellow">{t.affiliatePage.quote.extra}</p>
             </div>

             <div className="mt-12">
                <Link to="/demo">
                    <button className="px-10 py-5 bg-brandWhite text-brandBlack font-black text-xl border-4 border-transparent hover:bg-brandYellow hover:border-brandBlack transition-all uppercase shadow-[4px_4px_0px_0px_#ffbf23]">
                        Start Scaling Now
                    </button>
                </Link>
             </div>
        </div>
      </div>
    </div>
  );
};

export default Affiliate;