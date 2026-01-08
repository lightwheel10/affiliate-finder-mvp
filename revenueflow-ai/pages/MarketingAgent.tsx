import React from 'react';
import AgentPageLayout from '../components/AgentPageLayout';
import { useLanguage } from '../contexts/LanguageContext';

const MarketingAgent: React.FC = () => {
  const { t } = useLanguage();
  const data = t.agentPages.marketing;

  return (
    <AgentPageLayout 
      badge={data.badge}
      title={data.title}
      subtitle={data.subtitle}
      comparison={data.comparison}
      features={data.features}
    />
  );
};

export default MarketingAgent;