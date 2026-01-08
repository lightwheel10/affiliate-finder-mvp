import React from 'react';
import { Moon, Sun, Zap, Globe, LogIn } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Theme } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface NavbarProps {
  theme: Theme;
  toggleTheme: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ theme, toggleTheme }) => {
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'de' : 'en');
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b-4 border-brandBlack dark:border-brandWhite bg-brandWhite dark:bg-brandBlack transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0 flex items-center gap-2 group cursor-pointer decoration-transparent">
             <div className="bg-brandYellow p-1 border-2 border-brandBlack dark:border-brandWhite shadow-neo-sm group-hover:translate-x-[1px] group-hover:translate-y-[1px] group-hover:shadow-none transition-all">
                <Zap size={24} className="text-brandBlack" />
             </div>
            <span className="font-black text-2xl tracking-tighter italic text-brandBlack dark:text-brandWhite">
              REVENUE<span className="text-brandYellow">WORKS</span>
            </span>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className="hidden sm:flex items-center gap-2 px-3 py-2 border-2 border-brandBlack dark:border-brandWhite bg-brandWhite dark:bg-brandBlack text-brandBlack dark:text-brandWhite shadow-neo dark:shadow-neo-white hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all font-black font-mono text-sm"
            >
              <Globe size={18} />
              {language.toUpperCase()}
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 border-2 border-brandBlack dark:border-brandWhite bg-brandWhite dark:bg-brandBlack text-brandBlack dark:text-brandWhite shadow-neo dark:shadow-neo-white hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
              aria-label="Toggle Theme"
            >
              {theme === Theme.LIGHT ? <Moon size={24} /> : <Sun size={24} />}
            </button>
            
            <button 
              onClick={() => navigate('/login')}
              className="hidden md:block px-6 py-2 font-black bg-brandYellow text-brandBlack border-2 border-brandBlack dark:border-brandWhite shadow-neo dark:shadow-neo-white hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all uppercase"
            >
              {t.nav.demo}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;