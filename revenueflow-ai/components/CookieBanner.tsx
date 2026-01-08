import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const CookieBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie_consent', 'declined');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 bg-brandBlack border-t-4 border-brandYellow text-white shadow-[0px_-10px_40px_rgba(0,0,0,0.5)]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1">
          <h3 className="text-brandYellow font-black uppercase mb-2 text-lg">{t.cookie.title}</h3>
          <p className="text-sm md:text-base font-medium text-gray-300 leading-relaxed">
            {t.cookie.intro}
            <span className="text-brandYellow font-bold">"{t.cookie.acceptQuote}"</span>
            {t.cookie.agreement}
            <Link to="/privacy" className="text-white underline hover:text-brandYellow transition-colors">{t.cookie.privacy}</Link>
            {t.cookie.and}
            <Link to="/imprint" className="text-white underline hover:text-brandYellow transition-colors">{t.cookie.imprint}</Link>.
          </p>
        </div>
        <div className="flex gap-4 shrink-0 w-full md:w-auto">
          <button 
            onClick={handleDecline}
            className="flex-1 md:flex-none px-6 py-3 bg-transparent border-2 border-gray-600 text-gray-300 font-bold uppercase hover:border-white hover:text-white transition-colors text-sm tracking-wider"
          >
            {t.cookie.decline}
          </button>
          <button 
            onClick={handleAccept}
            className="flex-1 md:flex-none px-6 py-3 bg-brandYellow text-black font-black uppercase border-2 border-brandYellow hover:bg-white hover:border-white transition-all shadow-neo-sm hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] text-sm tracking-wider"
          >
            {t.cookie.accept}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;