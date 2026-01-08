import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Send, CheckCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const Demo: React.FC = () => {
  const { t, language } = useLanguage();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [minutes, setMinutes] = useState<number>(0);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    website: '',
    company: '',
    role: '',
    message: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Generate random minutes between 21 and 59
    const randomMinutes = Math.floor(Math.random() * (59 - 21 + 1)) + 21;
    setMinutes(randomMinutes);

    try {
      // Prepare parameters for GET request (matching N8N config)
      const params = new URLSearchParams();
      
      // 1. Append all form fields
      Object.entries(formData).forEach(([key, value]) => {
        params.append(key, value as string);
      });
      
      // 2. Append required metadata (Minutes, Language, Source)
      params.append('estimated_minutes', randomMinutes.toString());
      params.append('language', language);
      params.append('form_source', 'demo_page_v2');
      params.append('ts', Date.now().toString());

      // 3. Construct URL with UUID from N8N screenshot: c2694623-3bc7-46fb-ab61-de03b86f275f
      const webhookUrl = `https://selecdoo.app.n8n.cloud/webhook/contact-form-2694623-3bc7-46fb-ab61-de03b86f275f?${params.toString()}`;

      // 4. Debugging: Log to console to verify data
      console.group("🚀 RevenueWorks Demo Form Debugger");
      console.log("Sending Payload:", Object.fromEntries(params));
      console.log("Full Webhook URL:", webhookUrl);
      console.groupEnd();

      // 5. Execute GET request
const res = await fetch(webhookUrl, {
  method: 'GET',
  headers: { Accept: 'application/json' },
});

if (!res.ok) {
  throw new Error(`Webhook failed: ${res.status}`);
}
    } catch (error) {
      console.error("Webhook submission error:", error);
    } finally {
      // Show success state regardless of no-cors opaque response
      setSubmitted(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8 bg-black">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12 relative">
          {/* Yellow accent bar above title */}
          <div className="w-24 h-4 bg-brandYellow mx-auto mb-6 shadow-[2px_2px_0px_0px_#fff]"></div>
          
          <h1 className="text-6xl md:text-8xl font-black text-white uppercase mb-4 tracking-tighter">
            {t.demo.title}
          </h1>
          <p className="text-xl text-gray-300 font-medium">
            {t.demo.subtitle}
          </p>
        </div>

        <div className="bg-black border-4 border-white p-8 md:p-12 shadow-[16px_16px_0px_0px_#ffbf23] relative">
          {submitted ? (
             <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
             >
                <div className="inline-flex justify-center items-center w-24 h-24 bg-green-400 border-4 border-white rounded-full mb-6 shadow-neo-white">
                    <CheckCircle size={48} className="text-black" />
                </div>
                <h3 className="text-3xl font-black uppercase text-white mb-4">Status: Confirmed</h3>
                <p className="text-xl font-mono text-gray-300">
                  {language === 'de' 
                    ? `Übertragung Empfangen. Ein Agent wird dich innerhalb von ${minutes} Minuten kontaktieren.`
                    : `Transmission Received. An agent will contact you within ${minutes} minutes.`
                  }
                </p>
             </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="font-black uppercase text-xs text-white tracking-widest">{t.demo.form.firstName}</label>
                        <input 
                            required 
                            type="text" 
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            className="w-full p-4 border-2 border-gray-600 bg-[#0f172a] text-white focus:outline-none focus:border-brandYellow transition-colors font-bold rounded-none" 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="font-black uppercase text-xs text-white tracking-widest">{t.demo.form.lastName}</label>
                        <input 
                            required 
                            type="text" 
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            className="w-full p-4 border-2 border-gray-600 bg-[#0f172a] text-white focus:outline-none focus:border-brandYellow transition-colors font-bold rounded-none" 
                        />
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="font-black uppercase text-xs text-white tracking-widest">{t.demo.form.email}</label>
                        <input 
                            required 
                            type="email" 
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full p-4 border-2 border-gray-600 bg-[#0f172a] text-white focus:outline-none focus:border-brandYellow transition-colors font-bold rounded-none" 
                        />
                    </div>
                     <div className="space-y-2">
                        <label className="font-black uppercase text-xs text-white tracking-widest">{t.demo.form.website}</label>
                        <input 
                            type="text" 
                            name="website"
                            value={formData.website}
                            onChange={handleChange}
                            className="w-full p-4 border-2 border-gray-600 bg-[#0f172a] text-white focus:outline-none focus:border-brandYellow transition-colors font-bold rounded-none" 
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <label className="font-black uppercase text-xs text-white tracking-widest">{t.demo.form.company}</label>
                        <input 
                            required 
                            type="text" 
                            name="company"
                            value={formData.company}
                            onChange={handleChange}
                            className="w-full p-4 border-2 border-gray-600 bg-[#0f172a] text-white focus:outline-none focus:border-brandYellow transition-colors font-bold rounded-none" 
                        />
                    </div>
                     <div className="space-y-2">
                        <label className="font-black uppercase text-xs text-white tracking-widest">{t.demo.form.role}</label>
                        <input 
                            required 
                            type="text" 
                            name="role"
                            value={formData.role}
                            onChange={handleChange}
                            className="w-full p-4 border-2 border-gray-600 bg-[#0f172a] text-white focus:outline-none focus:border-brandYellow transition-colors font-bold rounded-none" 
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="font-black uppercase text-xs text-white tracking-widest">{t.demo.form.message}</label>
                    <textarea 
                        required
                        rows={5} 
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        className="w-full p-4 border-2 border-gray-600 bg-[#0f172a] text-white focus:outline-none focus:border-brandYellow transition-colors font-bold rounded-none resize-none"
                    ></textarea>
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-5 bg-white text-black font-black text-xl border-4 border-transparent hover:bg-brandYellow hover:border-white transition-all flex items-center justify-center gap-3 uppercase shadow-[4px_4px_0px_0px_#ffbf23] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                >
                    {loading ? <Loader2 className="animate-spin" /> : t.demo.form.submit} <Send size={20} strokeWidth={3} />
                </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Demo;