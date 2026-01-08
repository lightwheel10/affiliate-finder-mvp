import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Demo from './pages/Demo';
import Login from './pages/Login';
import Scaling from './pages/Scaling';
import Affiliate from './pages/Affiliate';
import SalesAgent from './pages/SalesAgent';
import SupportAgent from './pages/SupportAgent';
import OpsAgent from './pages/OpsAgent';
import MarketingAgent from './pages/MarketingAgent';
import CaseStudies from './pages/CaseStudies';
import ThankYou from './pages/ThankYou';
import Imprint from './pages/Imprint';
import Privacy from './pages/Privacy';
import DashboardDemo from './pages/DashboardDemo';
import Footer from './components/Footer';
import CookieBanner from './components/CookieBanner';
import { Theme } from './types';
import { LanguageProvider } from './contexts/LanguageContext';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const MainLayout: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return Theme.DARK;
    }
    return Theme.LIGHT;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === Theme.LIGHT ? Theme.DARK : Theme.LIGHT));
  };

  return (
    <div className="min-h-screen bg-brandWhite dark:bg-brandBlack transition-colors duration-300 selection:bg-brandYellow selection:text-brandBlack flex flex-col overflow-x-hidden">
      <Navbar theme={theme} toggleTheme={toggleTheme} />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/login" element={<Login />} />
          <Route path="/scaling" element={<Scaling />} />
          <Route path="/affiliate" element={<Affiliate />} />
          <Route path="/sales-agent" element={<SalesAgent />} />
          <Route path="/support-agent" element={<SupportAgent />} />
          <Route path="/ops-agent" element={<OpsAgent />} />
          <Route path="/marketing-agent" element={<MarketingAgent />} />
          <Route path="/case-studies" element={<CaseStudies />} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/imprint" element={<Imprint />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/dashboard-demo" element={<DashboardDemo />} />
        </Routes>
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <HashRouter>
        <ScrollToTop />
        <MainLayout />
      </HashRouter>
    </LanguageProvider>
  );
};

export default App;