import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { CheckCircle, ArrowLeft } from 'lucide-react';

const ThankYou: React.FC = () => {
  const { language } = useLanguage();
  
  return (
    <div className="min-h-screen pt-24 pb-20 px-4 bg-brandWhite dark:bg-brandBlack flex items-center justify-center">
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex justify-center items-center w-24 h-24 bg-brandYellow border-4 border-brandBlack dark:border-brandWhite rounded-full mb-8 shadow-neo dark:shadow-neo-white">
            <CheckCircle size={48} className="text-brandBlack" strokeWidth={3} />
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-brandBlack dark:text-brandWhite uppercase mb-6 tracking-tighter leading-none">
          {language === 'de' ? 'Anmeldung Erfolgreich' : 'Subscription Confirmed'}
        </h1>
        <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 font-medium mb-12">
           {language === 'de' 
             ? 'Du bist jetzt auf der Liste. Halte Ausschau nach der ersten Ausgabe.' 
             : 'You are on the list. Watch your inbox for the first edition.'}
        </p>
        
        <Link to="/">
            <button className="px-8 py-4 bg-brandBlack dark:bg-brandWhite text-brandWhite dark:text-brandBlack font-black text-lg border-4 border-transparent hover:bg-brandYellow hover:text-brandBlack hover:border-brandBlack dark:hover:bg-brandYellow dark:hover:text-brandBlack dark:hover:border-brandWhite transition-all flex items-center justify-center gap-2 mx-auto uppercase shadow-neo-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]">
                <ArrowLeft size={20} strokeWidth={3} /> {language === 'de' ? 'Zurück' : 'Return'}
            </button>
        </Link>
      </div>
    </div>
  );
};

export default ThankYou;