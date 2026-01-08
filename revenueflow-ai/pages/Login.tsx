import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Terminal, Lock, ArrowRight, Loader2, Server } from 'lucide-react';
import { motion } from 'framer-motion';

const Login: React.FC = () => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);

    // Simulate authentication delay then redirect
    setTimeout(() => {
        setIsSuccess(true);
        setTimeout(() => {
            window.location.href = 'https://app.revenueworks.ai';
        }, 1500);
    }, 2000);
  };

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 flex items-center justify-center bg-brandWhite dark:bg-brandBlack">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="bg-brandWhite dark:bg-brandBlack border-4 border-brandBlack dark:border-brandWhite p-8 shadow-[12px_12px_0px_0px_#ffbf23]">
            
            {/* Header */}
            <div className="flex items-center gap-4 mb-8 border-b-4 border-brandBlack dark:border-brandWhite pb-6">
                <div className="p-3 bg-brandBlack dark:bg-brandWhite text-brandWhite dark:text-brandBlack">
                    <Terminal size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-black uppercase text-brandBlack dark:text-brandWhite leading-none">
                        {t.login.title}
                    </h1>
                    <p className="font-mono text-xs text-gray-500 uppercase mt-1 tracking-widest">
                        {t.login.subtitle}
                    </p>
                </div>
            </div>

            {/* Success State */}
            {isSuccess ? (
                <div className="text-center py-8">
                    <Server size={48} className="mx-auto text-green-500 mb-4 animate-pulse" />
                    <h3 className="text-xl font-black uppercase text-brandBlack dark:text-brandWhite mb-2">
                        {t.login.success}
                    </h3>
                    <div className="h-2 bg-gray-200 dark:bg-gray-800 w-full mt-4 overflow-hidden">
                        <motion.div 
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 1.5 }}
                            className="h-full bg-green-500"
                        />
                    </div>
                </div>
            ) : (
                /* Login Form */
                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="font-black uppercase text-xs text-brandBlack dark:text-brandWhite tracking-widest flex items-center gap-2">
                            {t.login.email}
                        </label>
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                            className="w-full p-4 border-4 border-brandBlack dark:border-brandWhite bg-gray-50 dark:bg-gray-900 text-brandBlack dark:text-brandWhite focus:outline-none focus:border-brandYellow dark:focus:border-brandYellow transition-colors font-mono font-bold"
                            placeholder="OPERATOR_ID"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <label className="font-black uppercase text-xs text-brandBlack dark:text-brandWhite tracking-widest flex items-center gap-2">
                           <Lock size={12} /> {t.login.password}
                        </label>
                        <input 
                            type="password" 
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                            className="w-full p-4 border-4 border-brandBlack dark:border-brandWhite bg-gray-50 dark:bg-gray-900 text-brandBlack dark:text-brandWhite focus:outline-none focus:border-brandYellow dark:focus:border-brandYellow transition-colors font-mono font-bold"
                            placeholder="••••••••"
                        />
                    </div>

                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 bg-brandYellow text-brandBlack font-black text-xl border-4 border-brandBlack dark:border-brandWhite hover:bg-brandBlack hover:text-brandYellow hover:border-brandYellow dark:hover:bg-brandWhite dark:hover:text-brandBlack dark:hover:border-brandBlack transition-all uppercase shadow-neo dark:shadow-neo-white hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-3 mt-8"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="animate-spin" /> {t.login.redirect}
                            </>
                        ) : (
                            <>
                                {t.login.submit} <ArrowRight size={24} strokeWidth={3} />
                            </>
                        )}
                    </button>
                    
                    <div className="text-center mt-4">
                        <a href="#" className="text-xs font-bold uppercase text-gray-500 hover:text-brandBlack dark:hover:text-brandWhite underline decoration-brandYellow decoration-2">
                            {t.login.forgot}
                        </a>
                    </div>
                </form>
            )}
            
            {/* Footer decoration */}
            <div className="mt-8 pt-4 border-t-2 border-dashed border-gray-300 dark:border-gray-700 flex justify-between items-center text-[10px] font-mono uppercase text-gray-400">
                <span>System Status: Online</span>
                <span>v3.1.4</span>
            </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;