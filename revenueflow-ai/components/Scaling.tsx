import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowRight, Database, Cpu, Target } from 'lucide-react';
import { motion } from 'framer-motion';

const Scaling: React.FC = () => {
  const { t } = useLanguage();

  const icons = [Database, Cpu, Target];

  return (
    <div className="min-h-screen pt-12 bg-brandWhite dark:bg-brandBlack">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-20">
           <div className="inline-block mb-6 px-4 py-2 bg-brandBlack dark:bg-brandWhite text-brandWhite dark:text-brandBlack font-mono font-bold text-sm uppercase tracking-widest">
              System Blueprint
           </div>
          <h1 className="text-5xl md:text-8xl font-black text-brandBlack dark:text-brandWhite uppercase mb-6 tracking-tighter leading-none">
            {t.scalingPage.title}
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 font-medium max-w-3xl mx-auto">
            {t.scalingPage.subtitle}
          </p>
        </div>

        <div className="space-y-12 relative">
          {/* Vertical Line */}
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-1 bg-brandYellow hidden md:block transform -translate-x-1/2 z-0"></div>

          {t.scalingPage.steps.map((step: any, index: number) => {
            const Icon = icons[index];
            return (
              <motion.div 
                key={step.id}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className={`flex flex-col md:flex-row items-center gap-8 md:gap-20 relative z-10 ${index % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}
              >
                {/* Number / Icon Box */}
                <div className="flex-shrink-0 w-full md:w-1/2 flex justify-start md:justify-end items-center">
                    <div className={`w-full md:max-w-md bg-brandWhite dark:bg-brandBlack border-4 border-brandBlack dark:border-brandWhite p-8 shadow-[8px_8px_0px_0px_#000] dark:shadow-[8px_8px_0px_0px_#fff] ${index % 2 !== 0 ? 'md:ml-auto' : 'md:mr-auto'}`}>
                        <div className="flex items-start justify-between mb-4">
                             <div className="p-3 bg-brandYellow border-2 border-brandBlack dark:border-brandWhite">
                                <Icon size={32} className="text-brandBlack" />
                             </div>
                             <span className="bg-brandBlack text-brandWhite dark:bg-brandWhite dark:text-brandBlack font-black text-4xl px-4 py-2 select-none shadow-[4px_4px_0px_0px_#ffbf23] dark:shadow-none">
                                {step.id}
                             </span>
                        </div>
                        <h3 className="text-2xl font-black text-brandBlack dark:text-brandWhite uppercase mb-4">{step.title}</h3>
                        <p className="text-lg text-gray-600 dark:text-gray-300 font-medium">{step.desc}</p>
                    </div>
                </div>
                
                {/* Spacer for center line */}
                <div className="hidden md:block w-8 h-8 bg-brandBlack dark:bg-brandWhite border-4 border-brandYellow rounded-full absolute left-1/2 transform -translate-x-1/2"></div>
                
                <div className="w-full md:w-1/2"></div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-24 text-center">
            <Link to="/demo">
                <button className="px-10 py-6 bg-brandYellow text-brandBlack font-black text-xl border-4 border-brandBlack dark:border-brandWhite shadow-neo dark:shadow-neo-white hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all uppercase flex items-center justify-center gap-3 mx-auto">
                    {t.scalingPage.cta} <ArrowRight size={24} strokeWidth={3} />
                </button>
            </Link>
        </div>
      </div>
    </div>
  );
};

export default Scaling;