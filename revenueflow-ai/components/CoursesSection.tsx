import React from 'react';
import { motion } from 'framer-motion';
import { SERVICES_DATA } from '../constants';
import { ArrowUpRight, Database, Mail, MessageCircle, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const ServicesSection: React.FC = () => {
  const { language, t } = useLanguage();
  
  const getIcon = (category: string) => {
    switch(category) {
        case 'Outbound': return <Mail size={24} />;
        case 'Inbound': return <MessageCircle size={24} />;
        case 'Operations': return <Database size={24} />;
        default: return <Zap size={24} />;
    }
  };

  return (
    <section id="solutions" className="py-24 bg-brandWhite dark:bg-brandBlack transition-colors duration-300 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-20">
          <h2 className="text-5xl md:text-7xl font-black text-brandBlack dark:text-brandWhite tracking-tighter mb-4 uppercase">
            {t.services.title} <span className="text-brandYellow text-stroke-black">{t.services.highlight}</span>
          </h2>
          <div className="h-4 w-32 bg-brandYellow border-2 border-brandBlack dark:border-brandWhite"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-10">
          {SERVICES_DATA[language].map((service, index) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group relative flex flex-col"
            >
              {/* Shadow Block */}
              <div className="absolute inset-0 bg-brandBlack dark:bg-brandWhite translate-x-4 translate-y-4"></div>
              
              {/* Content Block */}
              <div className="relative flex-1 bg-brandWhite dark:bg-brandBlack border-4 border-brandBlack dark:border-brandWhite p-8 flex flex-col justify-between hover:-translate-y-2 hover:-translate-x-2 transition-transform duration-200">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-brandYellow border-2 border-brandBlack dark:border-brandWhite text-brandBlack">
                        {getIcon(service.category)}
                    </div>
                    
                    {/* Pricing Badge */}
                    <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-gray-500 dark:text-gray-400 line-through decoration-2 decoration-red-500 mb-1 mr-2 transform rotate-[-2deg]">
                             {service.originalPrice}
                        </span>
                        <span className="font-black text-xl md:text-2xl dark:text-brandBlack bg-brandBlack dark:bg-brandWhite text-brandWhite dark:text-brandBlack px-3 py-1 transform -rotate-2 border-2 border-transparent shadow-[4px_4px_0px_0px_#ffbf23]">
                            {service.price}
                        </span>
                    </div>
                  </div>
                  
                  <h3 className="text-3xl font-black leading-none mb-4 text-brandBlack dark:text-brandWhite uppercase">
                    {service.title}
                  </h3>
                  
                  <p className="text-gray-600 dark:text-gray-300 font-medium text-lg mb-8 leading-relaxed">
                    {service.description}
                  </p>
                </div>

                <div>
                  <div className="flex flex-wrap gap-2 mb-8">
                    {service.tags.map(tag => (
                      <span key={tag} className="text-sm font-bold px-2 py-1 border-2 border-brandBlack dark:border-brandWhite bg-gray-100 dark:bg-gray-900 text-brandBlack dark:text-brandWhite">
                        {tag.toUpperCase()}
                      </span>
                    ))}
                  </div>

                  <Link to="/demo">
                    <button className="w-full py-4 bg-brandBlack dark:bg-brandWhite text-brandWhite dark:text-brandBlack font-black text-lg border-2 border-transparent hover:bg-brandYellow hover:text-brandBlack hover:border-brandBlack dark:hover:bg-brandYellow dark:hover:text-brandBlack dark:hover:border-brandWhite transition-all flex items-center justify-center gap-2 uppercase group-hover:shadow-neo-sm dark:group-hover:shadow-none">
                        {t.services.deploy} <ArrowUpRight size={20} strokeWidth={3} />
                    </button>
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;