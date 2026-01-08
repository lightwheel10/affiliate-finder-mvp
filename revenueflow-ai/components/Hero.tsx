import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, TrendingUp, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const Hero: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="relative overflow-hidden bg-brandWhite dark:bg-brandBlack border-b-4 border-brandBlack dark:border-brandWhite transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-left md:text-center"
        >
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-brandYellow border-2 border-brandBlack dark:border-brandWhite font-mono font-bold text-brandBlack shadow-neo dark:shadow-neo-white transform -rotate-1">
            <DollarSign size={16} strokeWidth={3} />
            <span>{t.hero.badge}</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-black text-brandBlack dark:text-brandWhite tracking-tighter leading-tight mb-8 uppercase break-words">
            {t.hero.title1} <br />
            <span className="bg-brandYellow px-4 border-4 border-brandBlack dark:border-brandWhite text-brandBlack inline-block transform hover:rotate-2 transition-transform duration-300 shadow-neo dark:shadow-neo-white">
              {t.hero.title2}
            </span>
          </h1>
          
          <p className="mt-4 max-w-3xl mx-auto text-xl md:text-2xl text-gray-800 dark:text-gray-300 font-medium leading-relaxed">
            {t.hero.subtitlePart1}
            <span className="font-black underline decoration-brandYellow decoration-4">{t.hero.subtitlePart2}</span>
            {t.hero.subtitlePart3}
          </p>
          
          <div className="mt-12 flex flex-col sm:flex-row justify-center gap-6">
            <Link to="/scaling">
              <button className="w-full sm:w-auto px-8 py-5 bg-brandBlack dark:bg-brandWhite text-brandWhite dark:text-brandBlack font-black text-xl border-4 border-transparent hover:border-brandBlack dark:hover:border-brandYellow shadow-neo dark:shadow-neo-dark hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all flex items-center justify-center gap-2 uppercase tracking-wide">
                {t.hero.ctaStart} <ArrowRight size={24} strokeWidth={3} />
              </button>
            </Link>
            <Link to="/case-studies">
              <button className="w-full sm:w-auto px-8 py-5 bg-transparent text-brandBlack dark:text-brandWhite font-black text-xl border-4 border-brandBlack dark:border-brandWhite shadow-neo dark:shadow-neo-white hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all uppercase tracking-wide">
                {t.hero.ctaCase}
              </button>
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Decorative Abstract Elements */}
      <motion.div 
        animate={{ y: [0, -20, 0] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        className="hidden md:block absolute top-20 right-10 w-48 h-48 bg-brandYellow border-4 border-brandBlack dark:border-brandWhite shadow-[8px_8px_0px_0px_#000] dark:shadow-[8px_8px_0px_0px_#fff]"
      >
          <div className="absolute inset-0 flex items-center justify-center">
              <TrendingUp size={80} className="text-brandBlack" strokeWidth={2} />
          </div>
      </motion.div>

      <motion.div 
        animate={{ rotate: [0, 360] }}
        transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
        className="hidden md:block absolute bottom-20 left-10 w-40 h-40 rounded-full border-4 border-brandBlack dark:border-brandWhite border-dashed opacity-60"
      />
      
      {/* Pattern Grid */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.1] pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(#000 2px, transparent 2px), linear-gradient(90deg, #000 2px, transparent 2px)', backgroundSize: '40px 40px' }}>
      </div>
    </div>
  );
};

export default Hero;