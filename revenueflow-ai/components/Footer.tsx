import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { Zap } from 'lucide-react';

const Footer: React.FC = () => {
  const { t } = useLanguage();
  
  return (
    <footer className="bg-brandBlack text-brandWhite border-t-8 border-brandYellow pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          
          {/* Logo and Description Column */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-6">
                <div className="bg-brandYellow p-1 border-2 border-white shadow-[2px_2px_0px_0px_#ffffff]">
                    <Zap size={24} className="text-brandBlack" />
                </div>
                <h3 className="text-3xl font-black italic tracking-tighter text-white">REVENUE<span className="text-brandYellow">WORKS</span></h3>
            </div>
            <p className="font-mono text-lg text-gray-400 max-w-md mb-8">
              {t.footer.desc}
            </p>
          </div>
          
          {/* Modules Column */}
          <div>
            <h4 className="text-xl font-black mb-6 uppercase text-brandYellow tracking-wider">{t.footer.modules}</h4>
            <ul className="space-y-4 font-bold text-gray-300">
              <li><Link to="/sales-agent" className="hover:text-brandYellow hover:translate-x-2 inline-block transition-transform">{t.footer.links.outbound}</Link></li>
              <li><Link to="/support-agent" className="hover:text-brandYellow hover:translate-x-2 inline-block transition-transform">{t.footer.links.inbound}</Link></li>
              <li><Link to="/ops-agent" className="hover:text-brandYellow hover:translate-x-2 inline-block transition-transform">{t.footer.links.crm}</Link></li>
              <li><Link to="/marketing-agent" className="hover:text-brandYellow hover:translate-x-2 inline-block transition-transform">{t.footer.links.content}</Link></li>
              <li><Link to="/affiliate" className="hover:text-brandYellow hover:translate-x-2 inline-block transition-transform">{t.footer.links.affiliate}</Link></li>
              <li><Link to="/scaling" className="hover:text-brandYellow hover:translate-x-2 inline-block transition-transform">{t.footer.links.custom}</Link></li>
            </ul>
          </div>
          
          {/* Company Column */}
          <div>
             <h4 className="text-xl font-black mb-6 uppercase text-brandYellow tracking-wider">{t.footer.company}</h4>
            <ul className="space-y-4 font-bold text-gray-300">
              <li><Link to="/case-studies" className="hover:text-brandYellow hover:translate-x-2 inline-block transition-transform">{t.footer.links.cases}</Link></li>
              <li><Link to="/demo" className="hover:text-brandYellow hover:translate-x-2 inline-block transition-transform">{t.footer.links.book}</Link></li>
              <li><Link to="/dashboard-demo" className="hover:text-brandYellow hover:translate-x-2 inline-block transition-transform">{t.footer.links.demoDashboard}</Link></li>
              <li><Link to="/imprint" className="hover:text-brandYellow hover:translate-x-2 inline-block transition-transform">{t.footer.links.imprint}</Link></li>
              <li><Link to="/privacy" className="hover:text-brandYellow hover:translate-x-2 inline-block transition-transform">{t.footer.links.privacy}</Link></li>
            </ul>
          </div>
        </div>
        
        {/* Copyright and Status */}
        <div className="border-t-4 border-gray-800 pt-10 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-4 md:mb-0">{t.footer.rights}</p>
          <div>
            <button className="flex items-center gap-2 font-bold text-brandYellow hover:underline">
                {t.footer.status} <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;