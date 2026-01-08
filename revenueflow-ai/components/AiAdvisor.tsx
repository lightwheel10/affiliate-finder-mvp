import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, Loader2, User, Terminal, Sparkles, CheckCircle, ArrowRight, Lock, Database, Code } from 'lucide-react';
import { getAgentBlueprint } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';

type AdvisorStep = 'input' | 'processing' | 'blueprint' | 'form' | 'success';

const AiAdvisor: React.FC = () => {
  const { language, t } = useLanguage();
  const [step, setStep] = useState<AdvisorStep>('input');
  
  // Data State
  const [userPrompt, setUserPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [minutes, setMinutes] = useState(0);
  
  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    role: '',
    website: ''
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const prevStep = useRef(step);

  // Auto-scroll to top of component ONLY when step changes (not on initial load)
  useEffect(() => {
    if (prevStep.current !== step) {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        prevStep.current = step;
    }
  }, [step]);

  const examplePrompts = language === 'de' ? [
    "Mein Vertriebsteam verbringt 10h/Woche mit Kaltakquise.",
    "Wir brauchen automatischen Support am Wochenende.",
    "Ich hasse es, unbezahlten Rechnungen hinterherzulaufen."
  ] : [
    "My sales team wastes 10h/week on data entry.",
    "We miss leads because we don't reply fast enough.",
    "I need to automate invoice follow-ups."
  ];

  const handlePromptClick = (text: string) => {
    setUserPrompt(text);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // STEP 1 -> 2: Chat to Analysis
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim()) return;

    setStep('processing');
    
    // Call Gemini
    const blueprint = await getAgentBlueprint(userPrompt, language);
    setAiResponse(blueprint);
    setStep('blueprint');
  };

  // STEP 2 -> 3: Blueprint to Form
  const handleProceedToForm = () => {
    setStep('form');
  };

  // STEP 3 -> 4: Submit Form & Webhook
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('processing');

    // Generate random minutes (21-59)
    const randomMinutes = Math.floor(Math.random() * (59 - 21 + 1)) + 21;
    setMinutes(randomMinutes);

    try {
        const params = new URLSearchParams();
        // Contact Data
        params.append('first_name', formData.firstName);
        params.append('last_name', formData.lastName);
        params.append('email', formData.email);
        params.append('company', formData.company);
        params.append('role', formData.role);
        params.append('website', formData.website);
        
        // Meta Data
        params.append('estimated_minutes', randomMinutes.toString());
        params.append('language', language);
        params.append('form_source', 'ai_advisor_flow');
        
        // Chat History (The Hook)
        const chatHistory = `User Problem: ${userPrompt}\n\nAI Blueprint: ${aiResponse}`;
        params.append('chat_history', chatHistory);
        
        params.append('ts', Date.now().toString());

        // New N8N Webhook URL
        const webhookUrl = `https://selecdoo.app.n8n.cloud/webhook/1ae7586f-eeb1-4980-825e-744de3e23947?${params.toString()}`;

        console.log("🚀 Sending Advisor Data:", Object.fromEntries(params));

        await fetch(webhookUrl, {
            method: 'GET',
            mode: 'no-cors'
        });
    } catch (err) {
        console.warn("Webhook submission suppressed error:", err);
    }

    setStep('success');
  };

  return (
    <section ref={scrollRef} className="py-20 bg-brandBlack border-b-4 border-brandBlack dark:border-brandWhite relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 relative z-10">
        <div className="bg-brandWhite dark:bg-brandBlack border-4 border-brandBlack dark:border-brandWhite p-6 md:p-12 shadow-[16px_16px_0px_0px_#ffbf23] dark:shadow-[16px_16px_0px_0px_#ffbf23] min-h-[600px] flex flex-col">
          
          {/* Header */}
          <div className="flex items-center gap-4 mb-8 border-b-2 border-gray-100 dark:border-gray-800 pb-6">
            <div className="w-16 h-16 bg-brandYellow border-4 border-brandBlack dark:border-brandWhite flex items-center justify-center shadow-neo-sm">
                <Bot size={32} className="text-brandBlack" strokeWidth={2.5} />
            </div>
            <div>
                <h2 className="text-3xl md:text-4xl font-black text-brandBlack dark:text-brandWhite uppercase tracking-tighter leading-none">
                    {t.advisor.title} <span className="text-brandYellow text-base align-top">{t.advisor.badge}</span>
                </h2>
                <p className="text-gray-500 font-mono text-sm uppercase tracking-widest mt-1">
                    System Status: <span className="text-green-500">Online</span> // Module: {step === 'input' ? 'Analysis' : step === 'blueprint' ? 'Architecture' : step === 'form' ? 'Deployment' : 'Confirmed'}
                </p>
            </div>
          </div>

          <div className="flex-1 relative">
            <AnimatePresence mode="wait">
                
                {/* STEP 1: INPUT */}
                {step === 'input' && (
                    <motion.div
                        key="input"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex flex-col h-full"
                    >
                        <p className="mb-6 text-xl text-gray-800 dark:text-gray-300 font-medium">
                            {t.advisor.desc}
                        </p>
                        
                        <form onSubmit={handleAnalyze} className="flex-1 flex flex-col gap-6">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-brandYellow to-brandBlack rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-2 px-2">
                                        <div className="flex items-center gap-2 text-brandBlack dark:text-brandYellow uppercase font-black text-xs tracking-widest">
                                            <Terminal size={14} /> Mission Brief
                                        </div>
                                    </div>
                                    <textarea
                                        value={userPrompt}
                                        onChange={(e) => setUserPrompt(e.target.value)}
                                        rows={5}
                                        placeholder={t.advisor.placeholder}
                                        className="w-full p-6 border-4 border-brandBlack dark:border-brandWhite bg-gray-50 dark:bg-gray-900 text-brandBlack dark:text-gray-100 font-mono font-bold text-lg focus:outline-none focus:border-brandYellow dark:focus:border-brandYellow transition-colors placeholder-gray-400"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mr-2">
                                    <Sparkles size={12} /> Examples:
                                </span>
                                {examplePrompts.map((prompt, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handlePromptClick(prompt)}
                                        className="text-xs font-bold px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-brandYellow hover:border-brandBlack hover:text-brandBlack transition-colors text-gray-700 dark:text-gray-300 rounded-none"
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>

                            <div className="mt-auto pt-4">
                                <button
                                    type="submit"
                                    className="w-full py-5 bg-brandBlack dark:bg-brandWhite text-brandWhite dark:text-brandBlack font-black text-xl border-4 border-transparent hover:bg-brandYellow hover:text-brandBlack hover:border-brandBlack dark:hover:bg-brandYellow dark:hover:text-brandBlack transition-all uppercase flex items-center justify-center gap-3 shadow-neo dark:shadow-neo-white hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                                >
                                    {t.advisor.button} <ArrowRight size={24} />
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}

                {/* STEP 2: PROCESSING */}
                {step === 'processing' && (
                    <motion.div
                        key="processing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center h-[400px]"
                    >
                        <Loader2 size={64} className="text-brandYellow animate-spin mb-6" />
                        <h3 className="text-2xl font-black text-brandBlack dark:text-brandWhite uppercase animate-pulse">
                            {language === 'de' ? 'Analysiere Workflow...' : 'Analyzing Workflow...'}
                        </h3>
                        <div className="mt-4 font-mono text-sm text-gray-500">
                             Computing Efficiency Delta...
                        </div>
                    </motion.div>
                )}

                {/* STEP 3: BLUEPRINT (AI RESPONSE) */}
                {step === 'blueprint' && (
                    <motion.div
                        key="blueprint"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex flex-col h-full"
                    >
                        <div className="flex items-center gap-2 mb-4 text-brandYellow uppercase font-black text-xs tracking-widest">
                            <Code size={14} /> Agent Architecture Blueprint
                        </div>

                        <div className="bg-black border-4 border-gray-800 p-6 md:p-8 font-mono text-green-400 overflow-y-auto max-h-[400px] mb-8 shadow-inner">
                            <div className="whitespace-pre-wrap leading-relaxed">
                                {aiResponse}
                            </div>
                            <div className="mt-4 h-4 w-4 bg-green-400 animate-pulse"></div>
                        </div>

                        <div className="mt-auto">
                            <p className="text-center font-bold text-gray-600 dark:text-gray-400 mb-4 text-sm uppercase">
                                {language === 'de' ? 'Möchtest du diesen Agenten bauen?' : 'Ready to deploy this architecture?'}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={() => setStep('input')}
                                    className="py-4 bg-transparent text-gray-500 font-black text-lg border-4 border-gray-300 dark:border-gray-700 hover:border-gray-500 hover:text-gray-700 transition-all uppercase"
                                >
                                    {language === 'de' ? 'Zurück' : 'Restart'}
                                </button>
                                <button
                                    onClick={handleProceedToForm}
                                    className="py-4 bg-brandYellow text-brandBlack font-black text-lg border-4 border-brandBlack dark:border-brandWhite hover:bg-white hover:border-brandYellow transition-all uppercase shadow-neo dark:shadow-neo-white hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                                >
                                    {language === 'de' ? 'Diesen Agenten Bauen' : 'Build This Agent'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* STEP 4: FORM */}
                {step === 'form' && (
                    <motion.div
                        key="form"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                         <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4">
                            <p className="font-bold text-blue-800 dark:text-blue-300 text-sm">
                                {language === 'de' 
                                 ? "Exzellent. Um diesen Agenten zu konfigurieren, benötigen wir deine Kontaktdaten für den Architekten." 
                                 : "Excellent. To configure this agent, we need your contact details for the architect."}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="font-black uppercase text-xs text-brandBlack dark:text-brandWhite">{t.demo.form.firstName}</label>
                                    <input required type="text" name="firstName" value={formData.firstName} onChange={handleFormChange}
                                        className="w-full p-3 border-4 border-brandBlack dark:border-brandWhite bg-brandWhite dark:bg-brandBlack focus:outline-none focus:border-brandYellow transition-colors font-bold dark:text-brandWhite" />
                                </div>
                                <div className="space-y-2">
                                    <label className="font-black uppercase text-xs text-brandBlack dark:text-brandWhite">{t.demo.form.lastName}</label>
                                    <input required type="text" name="lastName" value={formData.lastName} onChange={handleFormChange}
                                        className="w-full p-3 border-4 border-brandBlack dark:border-brandWhite bg-brandWhite dark:bg-brandBlack focus:outline-none focus:border-brandYellow transition-colors font-bold dark:text-brandWhite" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="font-black uppercase text-xs text-brandBlack dark:text-brandWhite">{t.demo.form.email}</label>
                                    <input required type="email" name="email" value={formData.email} onChange={handleFormChange}
                                        className="w-full p-3 border-4 border-brandBlack dark:border-brandWhite bg-brandWhite dark:bg-brandBlack focus:outline-none focus:border-brandYellow transition-colors font-bold dark:text-brandWhite" />
                                </div>
                                <div className="space-y-2">
                                    <label className="font-black uppercase text-xs text-brandBlack dark:text-brandWhite">{t.demo.form.website}</label>
                                    <input type="text" name="website" value={formData.website} onChange={handleFormChange}
                                        className="w-full p-3 border-4 border-brandBlack dark:border-brandWhite bg-brandWhite dark:bg-brandBlack focus:outline-none focus:border-brandYellow transition-colors font-bold dark:text-brandWhite" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="font-black uppercase text-xs text-brandBlack dark:text-brandWhite">{t.demo.form.company}</label>
                                    <input required type="text" name="company" value={formData.company} onChange={handleFormChange}
                                        className="w-full p-3 border-4 border-brandBlack dark:border-brandWhite bg-brandWhite dark:bg-brandBlack focus:outline-none focus:border-brandYellow transition-colors font-bold dark:text-brandWhite" />
                                </div>
                                <div className="space-y-2">
                                    <label className="font-black uppercase text-xs text-brandBlack dark:text-brandWhite">{t.demo.form.role}</label>
                                    <input required type="text" name="role" value={formData.role} onChange={handleFormChange}
                                        className="w-full p-3 border-4 border-brandBlack dark:border-brandWhite bg-brandWhite dark:bg-brandBlack focus:outline-none focus:border-brandYellow transition-colors font-bold dark:text-brandWhite" />
                                </div>
                            </div>

                             <div className="mt-4 flex items-center justify-between">
                                <button type="button" onClick={() => setStep('blueprint')} className="text-xs font-bold uppercase underline text-gray-500 hover:text-brandBlack dark:hover:text-brandWhite">
                                    {language === 'de' ? 'Zurück' : 'Back'}
                                </button>
                                <button
                                    type="submit"
                                    className="px-10 py-4 bg-brandYellow text-brandBlack font-black text-lg border-4 border-brandBlack dark:border-brandWhite hover:bg-white hover:border-brandYellow transition-all uppercase shadow-neo dark:shadow-neo-white hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                                >
                                    {language === 'de' ? 'Anfrage Senden' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}

                {/* STEP 5: SUCCESS */}
                {step === 'success' && (
                     <motion.div 
                        key="success"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center h-[400px] text-center"
                     >
                        <div className="inline-flex justify-center items-center w-24 h-24 bg-green-500 border-4 border-brandBlack dark:border-brandWhite rounded-full mb-6 shadow-neo dark:shadow-neo-white">
                            <CheckCircle size={48} className="text-white" />
                        </div>
                        <h4 className="text-3xl font-black text-brandBlack dark:text-brandWhite uppercase tracking-wider mb-4">Request Confirmed</h4>
                        <div className="bg-gray-100 dark:bg-gray-800 p-6 border-2 border-dashed border-gray-400 max-w-md w-full">
                            <p className="font-mono font-bold text-gray-700 dark:text-gray-300 text-lg">
                                {language === 'de' 
                                    ? `Est. Wartezeit: ${minutes} Minuten` 
                                    : `Est. Wait Time: ${minutes} Minutes`}
                            </p>
                            <p className="text-sm text-gray-500 mt-2">
                                {language === 'de' 
                                    ? "Ein Architekt analysiert deinen Blueprint und meldet sich in Kürze." 
                                    : "An architect is reviewing your blueprint and will contact you shortly."}
                            </p>
                        </div>
                        <button 
                            onClick={() => { setStep('input'); setUserPrompt(''); }}
                            className="mt-8 text-xs font-bold uppercase underline text-brandYellow hover:text-brandBlack dark:hover:text-white"
                        >
                            Start New Session
                        </button>
                     </motion.div>
                )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AiAdvisor;