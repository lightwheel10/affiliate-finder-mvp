import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Hero from '../components/Hero';
import AiAdvisor from '../components/AiAdvisor';
import ServicesSection from '../components/CoursesSection';
import { useLanguage } from '../contexts/LanguageContext';
import { Loader2 } from 'lucide-react';

const Home: React.FC = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    try {
        const params = new URLSearchParams();
        params.append('name', firstName);
        params.append('email', email);
        params.append('language', language);
        params.append('form_name', 'Newsletter Signup');
        params.append('ts', Date.now().toString());

        // Using GET with no-cors is the most reliable way to trigger a webhook 
        // from the browser without strict CORS setup on the destination server.
        await fetch(`https://selecdoo.app.n8n.cloud/webhook/68a96542-e93a-433d-9025-6d31c23d7c36?${params.toString()}`, {
            method: 'GET',
            mode: 'no-cors'
        });
        navigate('/thank-you');
    } catch (err) {
        console.error(err);
        // Proceed to thank you page even on error to provide good UX for this demo
        navigate('/thank-you'); 
    } finally {
        setLoading(false);
    }
  };

  return (
    <>
      <Hero />
      <AiAdvisor />
      
      {/* Marquee */}
      <div className="bg-brandYellow border-y-4 border-brandBlack dark:border-brandWhite overflow-hidden py-6 relative z-20">
        <div className="flex space-x-12 animate-marquee whitespace-nowrap font-black text-4xl text-brandBlack uppercase tracking-tighter">
          {/* Duplicate entries to create seamless loop */}
          {t.marquee.map((item: string, i: number) => <span key={`m1-${i}`}>• {item}</span>)}
          {t.marquee.map((item: string, i: number) => <span key={`m2-${i}`}>• {item}</span>)}
        </div>
      </div>

      <ServicesSection />
      
      {/* Final CTA - Newsletter Signup */}
      <section className="py-32 px-4 bg-brandBlack border-t-4 border-brandBlack dark:border-brandWhite relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:16px_16px] opacity-25"></div>
        <div className="max-w-5xl mx-auto text-center text-brandWhite relative z-10">
          <h2 className="text-5xl md:text-8xl font-black mb-8 uppercase leading-none tracking-tighter">
            {t.cta.title1} <br/>
            <span className="text-brandYellow">{t.cta.title2}</span>
          </h2>
          <p className="text-xl font-medium mb-12 max-w-2xl mx-auto text-gray-300">
            {t.cta.desc}
          </p>
          <form onSubmit={handleSubscribe} className="flex flex-col lg:flex-row justify-center gap-6 max-w-5xl mx-auto">
              <input 
                  type="text" 
                  placeholder={t.cta.firstNamePlaceholder}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full flex-1 px-8 py-6 font-mono text-lg font-bold text-white bg-gray-800/50 border-4 border-white focus:outline-none focus:border-brandYellow shadow-neo-white transition-all placeholder-gray-400 uppercase"
              />
              <input 
                  type="email" 
                  placeholder={t.cta.placeholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full flex-1 px-8 py-6 font-mono text-lg font-bold text-white bg-gray-800/50 border-4 border-white focus:outline-none focus:border-brandYellow shadow-neo-white transition-all placeholder-gray-400 uppercase"
              />
              <button 
                type="submit" 
                disabled={loading}
                className="w-full lg:w-auto px-10 py-6 bg-brandYellow text-brandBlack font-black text-xl border-4 border-brandYellow hover:bg-brandWhite hover:border-brandWhite transition-colors shadow-neo-white uppercase disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
              >
                  {loading ? <Loader2 className="animate-spin mr-2" /> : null}
                  {t.cta.button}
              </button>
          </form>
        </div>
      </section>
    </>
  );
};

export default Home;