import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { FileText, TrendingUp, Clock, DollarSign, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

const CaseStudies: React.FC = () => {
  const { t, language } = useLanguage();

  const cases = [
    {
        id: 1,
        client: "SaaSify Inc.",
        industry: "B2B Software",
        stats: { leads: "+415%", hours: "120/mo", rev: "$1.2M" },
        desc: language === 'en' ? "Replaced 3 SDRs with one autonomous agent cluster." : "Ersetzte 3 SDRs durch ein autonomes Agenten-Cluster."
    },
    {
        id: 2,
        client: "LogisticsPro",
        industry: "Supply Chain",
        stats: { leads: "+220%", hours: "85/mo", rev: "$850k" },
        desc: language === 'en' ? "Automated freight quoting and follow-ups entirely." : "Frachtangebote und Follow-ups komplett automatisiert."
    },
    {
        id: 3,
        client: "GrowthMasters",
        industry: "Agency",
        stats: { leads: "+500%", hours: "200/mo", rev: "$2.4M" },
        desc: language === 'en' ? "Scaled outbound volume by 10x without adding headcount." : "Skalierte das Outbound-Volumen um das 10-fache ohne zusätzliches Personal."
    },
    {
        id: 4,
        client: "FinTech Global",
        industry: "Finance",
        stats: { leads: "+180%", hours: "60/mo", rev: "$3.1M" },
        desc: language === 'en' ? "AI handles compliance checks and initial discovery calls." : "KI übernimmt Compliance-Prüfungen und erste Discovery-Calls."
    }
  ];

  return (
    <div className="min-h-screen pt-12 bg-brandWhite dark:bg-brandBlack">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="mb-20">
           <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-brandYellow border-2 border-brandBlack dark:border-brandWhite font-mono font-bold text-brandBlack shadow-neo dark:shadow-neo-white">
                <FileText size={16} strokeWidth={3} />
                <span>CONFIDENTIAL_FILES_DECRYPTED</span>
            </div>
          <h1 className="text-5xl md:text-8xl font-black text-brandBlack dark:text-brandWhite uppercase mb-4 tracking-tighter">
            {t.caseStudiesPage.title}
          </h1>
          <div className="max-w-3xl">
            <p className="text-xl text-gray-600 dark:text-gray-300 font-medium mb-4">
                {t.caseStudiesPage.subtitle}
            </p>
            <div className="flex items-start gap-2 text-sm font-mono text-gray-500 dark:text-gray-400 border-l-2 border-brandYellow pl-4">
                <Lock size={16} className="shrink-0 mt-0.5" />
                <p>{t.caseStudiesPage.ndaNote}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {cases.map((study, index) => (
                <motion.div 
                    key={study.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-brandWhite dark:bg-brandBlack border-4 border-brandBlack dark:border-brandWhite p-8 hover:-translate-y-2 transition-transform duration-300 shadow-[8px_8px_0px_0px_#000] dark:shadow-[8px_8px_0px_0px_#fff]"
                >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b-2 border-dashed border-gray-300 dark:border-gray-700 pb-4 gap-4">
                        <div>
                            {/* Replaced Client Name with NDA Badge */}
                            <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 border-2 border-brandBlack dark:border-gray-600 px-3 py-1 mb-2">
                                <Lock size={14} className="text-gray-500" />
                                <span className="font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest text-sm">
                                    {t.caseStudiesPage.restricted}
                                </span>
                            </div>
                            <div className="block mt-1">
                                <span className="bg-brandBlack dark:bg-brandWhite text-brandWhite dark:text-brandBlack px-2 py-1 text-xs font-mono font-bold uppercase">
                                    {study.industry}
                                </span>
                            </div>
                        </div>
                        <div className="px-3 py-1 bg-green-500 text-brandBlack font-black text-xs uppercase border-2 border-brandBlack">
                            {t.caseStudiesPage.status}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="text-center">
                            <div className="flex justify-center text-brandYellow mb-2"><TrendingUp size={24} /></div>
                            <div className="font-black text-xl md:text-2xl text-brandBlack dark:text-brandWhite">{study.stats.leads}</div>
                            <div className="text-xs font-bold text-gray-500 uppercase">{t.caseStudiesPage.metrics.leads}</div>
                        </div>
                        <div className="text-center border-l-2 border-gray-200 dark:border-gray-800">
                            <div className="flex justify-center text-brandYellow mb-2"><Clock size={24} /></div>
                            <div className="font-black text-xl md:text-2xl text-brandBlack dark:text-brandWhite">{study.stats.hours}</div>
                            <div className="text-xs font-bold text-gray-500 uppercase">{t.caseStudiesPage.metrics.saved}</div>
                        </div>
                        <div className="text-center border-l-2 border-gray-200 dark:border-gray-800">
                            <div className="flex justify-center text-brandYellow mb-2"><DollarSign size={24} /></div>
                            <div className="font-black text-xl md:text-2xl text-brandBlack dark:text-brandWhite">{study.stats.rev}</div>
                            <div className="text-xs font-bold text-gray-500 uppercase">{t.caseStudiesPage.metrics.rev}</div>
                        </div>
                    </div>

                    <p className="font-mono text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        &gt; {study.desc}
                    </p>
                </motion.div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default CaseStudies;