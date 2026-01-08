import { Service, Testimonial, Language } from './types';

export const SERVICES_DATA: Record<Language, Service[]> = {
  en: [
    {
      id: '1',
      title: 'AI Sales Agent',
      description: 'Your dedicated 24/7 sales employee. Automates prospecting and outreach to save you 20+ hours/week.',
      category: 'Outbound',
      price: 'from 2,500 € one-time',
      originalPrice: '4,200 €',
      tags: ['AI Agent', 'Cold Email', '24/7 Sales']
    },
    {
      id: '2',
      title: 'AI Receptionist Agent',
      description: 'An intelligent concierge that qualifies leads and fills your calendar while you sleep. Never miss a lead again.',
      category: 'Inbound',
      price: ' from 1,200 € one-time',
      originalPrice: '2,400 €',
      tags: ['Chatbot', 'Auto-Booking', 'Time Saver']
    },
    {
      id: '3',
      title: 'AI Ops Agent',
      description: 'The ultimate admin. Automatically syncs data and manages CRM hygiene without human error or breaks.',
      category: 'Operations',
      price: 'from 800 € one-time',
      originalPrice: '1,500 €',
      tags: ['Automation', 'No Data Entry', 'Sync']
    },
    {
      id: '4',
      title: 'AI Content Agent',
      description: 'Your 24/7 marketing team. Turns one idea into a month of high-quality content automatically.',
      category: 'Strategy',
      price: 'from 1,500 € one-time',
      originalPrice: '3,000 €',
      tags: ['Content Gen', 'Scale', 'Marketing AI']
    }
  ],
  de: [
    {
      id: '1',
      title: 'KI Vertriebs-Agent',
      description: 'Dein dedizierter 24/7 Vertriebsmitarbeiter. Automatisiert Akquise und spart dir 20+ Stunden pro Woche.',
      category: 'Outbound',
      price: 'ab 2,500 € einmalig',
      originalPrice: '4,200 €',
      tags: ['KI Agent', 'Cold Email', '24/7 Vertrieb']
    },
    {
      id: '2',
      title: 'KI Empfangs-Agent',
      description: 'Ein intelligenter Concierge, der Leads qualifiziert und deinen Kalender füllt, während du schläfst.',
      category: 'Inbound',
      price: 'ab 1,200 € einmalig',
      originalPrice: '2,400 €',
      tags: ['Chatbot', 'Auto-Buchung', 'Zeitsparer']
    },
    {
      id: '3',
      title: 'KI Ops-Agent',
      description: 'Der ultimative Admin. Synchronisiert Daten und managt CRM-Hygiene automatisch ohne menschliche Fehler.',
      category: 'Operations',
      price: 'ab 800 € einmalig',
      originalPrice: '1,500 €',
      tags: ['Automatisierung', 'Keine Dateneingabe', 'Sync']
    },
    {
      id: '4',
      title: 'KI Content-Agent',
      description: 'Dein 24/7 Marketing-Team. Verwandelt eine Idee automatisch in hochwertigen Content für einen ganzen Monat.',
      category: 'Strategy',
      price: 'ab 1,500 € einmalig €',
      originalPrice: '3,000 €',
      tags: ['Content Gen', 'Skalierung', 'Marketing KI']
    }
  ]
};

export const TESTIMONIALS: Record<Language, Testimonial[]> = {
  en: [
    {
      id: '1',
      name: 'Alex Rivera',
      company: 'TechFlow Inc.',
      text: "We hired an AI Agent from RevenueFlow. It does the work of 3 SDRs and never asks for a holiday."
    },
    {
      id: '2',
      name: 'Jordan Lee',
      company: 'GrowthHacks',
      text: "The time savings are insane. I woke up to 5 booked meetings on my calendar handled entirely by AI."
    },
    {
      id: '3',
      name: 'Casey Smith',
      company: 'SaaS Scale',
      text: "I described my manual workflow to the AI Advisor, and they built me a custom agent that automated it 100%."
    }
  ],
  de: [
    {
      id: '1',
      name: 'Alex Rivera',
      company: 'TechFlow Inc.',
      text: "Wir haben einen KI-Agenten von RevenueFlow eingestellt. Er erledigt die Arbeit von 3 SDRs und fragt nie nach Urlaub."
    },
    {
      id: '2',
      name: 'Jordan Lee',
      company: 'GrowthHacks',
      text: "Die Zeitersparnis ist wahnsinnig. Ich wachte mit 5 gebuchten Meetings auf, die komplett von der KI gemanagt wurden."
    },
    {
      id: '3',
      name: 'Casey Smith',
      company: 'SaaS Scale',
      text: "Ich beschrieb meinen manuellen Workflow dem KI-Berater, und sie bauten mir einen Agenten, der alles zu 100% automatisierte."
    }
  ]
};