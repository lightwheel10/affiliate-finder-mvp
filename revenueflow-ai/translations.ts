import { Language } from './types';

export const UI_TEXT: Record<Language, any> = {
  en: {
    nav: {
      demo: "Terminal",
      login: "LOGIN"
    },
    hero: {
      badge: "AI WORKFORCE v3.1",
      title1: "Automate",
      title2: "Everything",
      subtitlePart1: "Manual work kills growth. ",
      subtitlePart2: "Let us Build YOUR own AI Agent.",
      subtitlePart3: " Deploy 24/7 digital employees to save time, automate boring tasks, and maximize profit without hiring new staff.",
      ctaStart: "HIRE AI AGENTS",
      ctaCase: "SEE AGENTS IN ACTION"
    },
    advisor: {
      title: "AI Workforce Architect",
      badge: "BETA",
      desc: "Where are you losing time? Describe your manual tasks, and we will design a custom AI Agent to handle them as a 24/7 employee.",
      placeholder: "e.g., My team wastes 10 hours/week entering data into Salesforce...",
      button: "Generate Blueprint",
      analysis: "Blueprint Generated"
    },
    services: {
      title: "Deployment",
      highlight: "Workforce",
      deploy: "Deploy Agent"
    },
    scalingPage: {
      title: "AI Workforce Architecture",
      subtitle: "The blueprint for your 24/7 digital team.",
      steps: [
        {
          id: "01",
          title: "AI Data Agents",
          desc: "Autonomous agents scrape 50+ data sources 24/7 to build a live profile of your market while you sleep."
        },
        {
          id: "02",
          title: "Outreach Agents",
          desc: "Your digital sales team contacts thousands of leads simultaneously with hyper-personalized messages."
        },
        {
          id: "03",
          title: "Closing Agents",
          desc: "AI negotiates, handles objections, and books meetings on your calendar. A sales rep that never sleeps."
        }
      ],
      cta: "Build This Workforce"
    },
    agentPages: {
      sales: {
        badge: "REVENUE GENERATOR",
        title: "The Sales Agent That Never Sleeps",
        subtitle: "Stop losing leads to human delay. Your AI Sales Agent prospects, nurtures, and books meetings 24/7.",
        comparison: {
          humanTitle: "Human SDRs",
          humanPoints: ["Needs sleep & weekends off", "Forgets follow-ups (48% lead leakage)", "Fear of rejection slows outreach", "Inconsistent tone & typos"],
          aiTitle: "AI Sales Agent",
          aiPoints: ["Works 24/7/365 instantly", "Follows up forever until converted", "Zero emotion, max volume", "Perfect data entry & CRM sync"]
        },
        features: [
          { title: "Hyper-Personalized Outreach", desc: "Scrapes LinkedIn & News to write 1:1 personalized emails at scale. No templates." },
          { title: "Instant Lead Response", desc: "Contacts new leads within seconds, increasing conversion rates by 391%." },
          { title: "Objection Handling", desc: "Trained on your best sales scripts to overcome 'No' and book the meeting." },
          { title: "Automated CRM Hygiene", desc: "Logs every call, email, and note into Salesforce/HubSpot automatically. Zero admin time." }
        ]
      },
      support: {
        badge: "CUSTOMER SUCCESS",
        title: "Zero-Wait Support Agent",
        subtitle: "Turn support costs into profit. Solve tickets instantly, 24/7, with perfect accuracy.",
        comparison: {
          humanTitle: "Human Support",
          humanPoints: ["Slow response times (hrs/days)", "Gets frustrated with repetitive questions", "Limited by timezones", "Expensive to scale ($40k+/yr)"],
          aiTitle: "AI Support Agent",
          aiPoints: ["Instant <1s response time", "Loves repetitive tasks", "Active globally 24/7", "Infinite scale at fixed cost"]
        },
        features: [
          { title: "Tier 1 Ticket Resolution", desc: "Instantly resolves 80% of common queries (refunds, login, shipping) without human touch." },
          { title: "Multilingual Native", desc: "Speaks 95+ languages fluently. Support global customers without hiring translators." },
          { title: "Sentiment Analysis", desc: "Detects angry customers instantly and escalates them to humans before churn happens." },
          { title: "24/7 On-Call", desc: "Your support queue is empty every morning. The agent works while you sleep." }
        ]
      },
      ops: {
        badge: "OPERATIONS BACKBONE",
        title: "The Flawless Ops Agent",
        subtitle: "Eliminate administrative chaos. Automate invoices, data entry, and scheduling with 100% accuracy.",
        comparison: {
          humanTitle: "Manual Ops",
          humanPoints: ["Prone to copy-paste errors", "Forgets invoice due dates", "Slow data processing", "Hates boring admin work"],
          aiTitle: "AI Ops Agent",
          aiPoints: ["100% Accuracy Guarantee", "Triggers workflows instantly", "Processes 10,000 rows/sec", "Never gets bored or tired"]
        },
        features: [
          { title: "Autonomous Invoicing", desc: "Generates, sends, and chases invoices automatically based on contract data." },
          { title: "Data Synchronization", desc: "Syncs data between your CRM, ERP, and Sheets in real-time. No more silos." },
          { title: "Meeting Prep", desc: "Researches attendees and prepares briefing docs before every meeting on your calendar." },
          { title: "Contract Review", desc: "Scans legal docs for risks and highlights missing clauses in seconds." }
        ]
      },
      marketing: {
        badge: "WACHSTUMS MOTOR",
        title: "Das Unendliche Marketing-Team",
        subtitle: "Skaliere Content-Produktion um das 100-fache. Dein KI-Marketing-Agent recherchiert, schreibt und postet autonom.",
        comparison: {
          humanTitle: "Menschlicher Marketer",
          humanPoints: ["Schreibblockade bremst Output", "Inkonsistenter Posting-Plan", "Begrenzte Recherchekapazität", "Burnout durch hohes Volumen"],
          aiTitle: "KI Marketing-Agent",
          aiPoints: ["Generiert unendlich viele Ideen", "Postet perfekt nach Zeitplan", "Liest das ganze Internet für Trends", "Skaliert Output sofort"]
        },
        features: [
          { title: "SEO Content in Masse", desc: "Schreibt 100+ SEO-optimierte Blog-Posts pro Monat basierend auf Keyword-Recherche." },
          { title: "Social Media Autopilot", desc: "Erstellt und plant LinkedIn, X und IG Posts, maßgeschneidert auf deine Brand Voice." },
          { title: "Trend Jacking", desc: "Überwacht Nachrichten 24/7 und entwirft Content, der sofort auf Branchentrends reagiert." },
          { title: "Ad Copy Iteration", desc: "Generiert und testet 50+ Ad-Variationen, um den Gewinner-Hook automatisch zu finden." }
        ]
      }
    },
    affiliatePage: {
      title: "Scale Affiliate Marketing with AI Agents",
      subtitle: "Automated Strategies. 24/7 Growth.",
      description: "Stop managing affiliates manually. RevenueWorks builds AI Agents that recruit, manage, and optimize your affiliate partners automatically. Save time and scale your revenue with intelligent digital employees.",
      offer: {
        title: "The AI Offer",
        description: "Elevate affiliate marketing with AI-driven agents that work around the clock. Our custom automation strategies replace manual tracking and recruitment, ensuring your program grows while you focus on strategy."
      },
      features: [
        {
          title: "AI-Powered Recruiting Agents",
          description: "Deploy agents that identify and recruit top-tier affiliates automatically. No more manual outreach or wasted hours searching for partners."
        },
        {
          title: "Automated Management",
          description: "Your AI Agents handle communication, onboarding, and support for thousands of affiliates simultaneously, saving you 40+ hours per week."
        },
        {
          title: "AI Consulting & Audits",
          description: "Unlock your program's potential. Our AI analyzes performance patterns human eyes miss, fixing inefficiencies and increasing ROI instantly."
        },
        {
          title: "Self-Optimizing Strategies",
          description: "Build a strategy that learns. Our AI systems continuously test and adapt your affiliate offers to maximize conversion rates without manual intervention."
        }
      ],
      quote: {
        text: "Built by experts, run by AI Agents.",
        subtext: "At RevenueWorks, we combine strategic expertise with autonomous AI Agents. We don't just consult; we build the digital employees that run your affiliate program for you.",
        extra: "With 25+ years of expertise, our AI Agents save you time and maximize profitability 24/7."
      }
    },
    caseStudiesPage: {
      title: "Agent Logs",
      subtitle: "Performance reports from active AI employees.",
      ndaNote: "Due to NDAs, company names are redacted. These stats are from real AI Agents currently working 24/7 for our clients.",
      restricted: "CONFIDENTIAL AGENT DATA",
      metrics: {
        leads: "Leads by AI",
        saved: "Hours Saved",
        rev: "Revenue Added"
      },
      status: "AGENT ACTIVE"
    },
    login: {
      title: "Access Terminal",
      subtitle: "Manage your AI Workforce",
      email: "Work Email",
      password: "Password",
      submit: "Initialize Session",
      forgot: "Recover Access",
      redirect: "Authenticating...",
      success: "Access Granted. Redirecting to Mainframe..."
    },
    footer: {
      desc: "We build your 24/7 AI Workforce. Replace manual labor with intelligent agents and reclaim your time.",
      modules: "AI AGENTS",
      company: "COMPANY",
      rights: "© 2025 RevenueWorks LTD // AI Systems Online",
      status: "AGENTS: ONLINE",
      links: {
        outbound: "Sales Agents",
        inbound: "Support Agents",
        crm: "Ops Agents",
        content: "Marketing Agents",
        affiliate: "Affiliate Agents",
        custom: "Custom Agents",
        cases: "Agent Logs",
        book: "Hire Agents",
        imprint: "Imprint",
        privacy: "Privacy Policy",
        demoDashboard: "Demo Dashboard"
      }
    },
    cta: {
      title1: "JOIN THE",
      title2: "AI REVOLUTION",
      desc: "Get weekly blueprints on how to build your own AI employees. Automate your work or be automated.",
      placeholder: "YOUR@EMAIL.COM",
      firstNamePlaceholder: "YOUR NAME",
      button: "GET BLUEPRINTS"
    },
    marquee: [
       "Hire AI Employees", "Save min. 10h/Week", "24/7 Automation", "Let Us Build Your Agents", "Save Personnel Costs"
    ],
    demo: {
        title: "Hire Your Agents",
        subtitle: "Our AI workforce is ready to deploy. Are you?",
        form: {
            firstName: "First Name",
            lastName: "Last Name",
            name: "Name",
            email: "Work Email",
            website: "Website URL",
            company: "Company",
            role: "Role",
            message: "Which task do you want to automate?",
            submit: "REQUEST AGENTS"
        },
        success: "Request Received. Your AI consultant will contact you within 24ms."
    },
    cookie: {
      title: "Cookie Settings",
      intro: "We use cookies to technically provide our services and improve the user experience. By clicking ",
      acceptQuote: "Accept",
      agreement: " you agree to their use. Further information can be found in our ",
      privacy: "Privacy Policy",
      and: " and ",
      imprint: "Imprint",
      decline: "Decline",
      accept: "Accept"
    },
    dashboard: {
        brand: "RevenueWorks Studio",
        backed: "backed by selecdoo AI",
        sidebar: {
            discovery: "DISCOVERY",
            find: "Find New",
            all: "All Discovered",
            management: "MANAGEMENT",
            saved: "Saved Affiliates",
            outreach: "Outreach",
            plan: "BUSINESS PLAN",
            active: "Active Subscription",
            manage: "Manage Plan"
        },
        top: {
            nextScan: "NEXT SCAN",
            topic: "Topic Searches",
            emailCredits: "Email Credits",
            aiCredits: "AI Credits",
            findBtn: "Find Affiliates"
        },
        main: {
            search: "Search...",
            generate: "Generate Messages",
            cols: {
                affiliate: "AFFILIATE",
                content: "RELEVANT CONTENT",
                method: "DISCOVERY METHOD",
                email: "EMAIL",
                message: "MESSAGE"
            },
            empty: {
                title: "Start Building Connections",
                subtitle: "Save affiliates to generate AI-powered outreach messages."
            }
        }
    }
  },
  de: {
    nav: {
      demo: "Terminal",
      login: "LOGIN"
    },
    hero: {
      badge: "KI WORKFORCE v3.1",
      title1: "Automatisiere",
      title2: "Alles",
      subtitlePart1: "Manuelle Arbeit tötet Wachstum. ",
      subtitlePart2: "Lass dir deinen AI-Agenten bauen.",
      subtitlePart3: " Setze 24/7 digitale Mitarbeiter ein, um Zeit zu sparen, langweilige Aufgaben zu automatisieren und Profit ohne Personalaufbau zu maximieren.",
      ctaStart: "AGENTEN EINSTELLEN",
      ctaCase: "AGENTEN IN AKTION"
    },
    advisor: {
      title: "AI Workforce Architekt",
      badge: "BETA",
      desc: "Wo verlierst du Zeit? Beschreibe deine manuellen Aufgaben, und wir entwerfen einen eigenen KI-Agenten, der sie als 24/7 Mitarbeiter erledigt.",
      placeholder: "z.B., Mein Team verschwendet 10h/Woche mit Dateneingabe...",
      button: "Bauplan Generieren",
      analysis: "Bauplan Generiert"
    },
    services: {
      title: "Deine AI",
      highlight: "Workforce",
      deploy: "Agent Starten"
    },
    scalingPage: {
      title: "KI Workforce Architektur",
      subtitle: "Der Bauplan für dein 24/7 digitales Team.",
      steps: [
        {
          id: "01",
          title: "KI Daten-Agenten",
          desc: "Autonome Agenten scannen 50+ Datenquellen rund um die Uhr, um ein Live-Profil deines Marktes zu erstellen, während du schläfst."
        },
        {
          id: "02",
          title: "Outreach Agenten",
          desc: "Dein digitales Vertriebsteam kontaktiert tausende Leads gleichzeitig mit hyper-personalisierten Nachrichten."
        },
        {
          id: "03",
          title: "Closing Agenten",
          desc: "KI verhandelt, behandelt Einwände und bucht Meetings in deinen Kalender. Ein Vertriebler, der nie schläft."
        }
      ],
      cta: "Workforce Bauen"
    },
    agentPages: {
      sales: {
        badge: "UMSATZ GENERATOR",
        title: "Der Vertriebs-Agent, der nie schläft",
        subtitle: "Hör auf, Leads durch menschliche Verzögerung zu verlieren. Dein KI-Vertriebsagent akquiriert, pflegt und bucht Meetings 24/7.",
        comparison: {
          humanTitle: "Menschlicher SDR",
          humanPoints: ["Braucht Schlaf & Wochenende", "Vergisst Follow-ups (48% Lead-Verlust)", "Angst vor Ablehnung bremst Outreach", "Inkonsistenter Ton & Tippfehler"],
          aiTitle: "KI Vertriebs-Agent",
          aiPoints: ["Arbeitet 24/7/365 sofort", "Fasst ewig nach bis zum Abschluss", "Keine Emotionen, max. Volumen", "Perfekte Dateneingabe & CRM Sync"]
        },
        features: [
          { title: "Hyper-Personalisierter Outreach", desc: "Scannt LinkedIn & News für 1:1 personalisierte E-Mails in Masse. Keine Vorlagen." },
          { title: "Sofortige Lead-Reaktion", desc: "Kontaktiert neue Leads innerhalb von Sekunden, steigert Konversion um 391%." },
          { title: "Einwandbehandlung", desc: "Trainiert auf deine besten Skripte, um 'Nein' zu überwinden und das Meeting zu buchen." },
          { title: "Automatisierte CRM-Hygiene", desc: "Loggt jeden Anruf, jede Mail und Notiz automatisch in Salesforce/HubSpot. Null Admin-Zeit." }
        ]
      },
      support: {
        badge: "CUSTOMER SUCCESS",
        title: "Support-Agent ohne Wartezeit",
        subtitle: "Verwandle Support-Kosten in Profit. Löse Tickets sofort, 24/7, mit perfekter Genauigkeit.",
        comparison: {
          humanTitle: "Menschlicher Support",
          humanPoints: ["Langsame Antwortzeiten (Std/Tage)", "Genervt von wiederholten Fragen", "Begrenzt durch Zeitzonen", "Teuer zu skalieren (€40k+/Jahr)"],
          aiTitle: "KI Support-Agent",
          aiPoints: ["Sofortige <1s Antwortzeit", "Liebt repetitive Aufgaben", "Aktiv weltweit 24/7", "Unendliche Skalierung, Fixkosten"]
        },
        features: [
          { title: "Tier 1 Ticket-Lösung", desc: "Löst sofort 80% der Standardanfragen (Rückerstattung, Login, Versand) ohne menschliches Zutun." },
          { title: "Muttersprachler (Multilingual)", desc: "Spricht 95+ Sprachen fließend. Supporte globale Kunden ohne Übersetzer einzustellen." },
          { title: "Sentiment-Analyse", desc: "Erkennt wütende Kunden sofort und eskaliert sie an Menschen, bevor Churn entsteht." },
          { title: "24/7 Bereitschaft", desc: "Deine Support-Queue ist jeden Morgen leer. Der Agent arbeitet, während du schläfst." }
        ]
      },
      ops: {
        badge: "OPERATIONS RÜCKGRAT",
        title: "Der Fehlerfreie Ops-Agent",
        subtitle: "Eliminiere das administrative Chaos. Automate Rechnungen, Dateneingabe und Planung mit 100% Präzision.",
        comparison: {
          humanTitle: "Manuelle Ops",
          humanPoints: ["Anfällig für Copy-Paste-Fehler", "Vergisst Rechnungsfristen", "Langsame Datenverarbeitung", "Hasst langweilige Admin-Arbeit"],
          aiTitle: "KI Ops-Agent",
          aiPoints: ["100% Genauigkeitsgarantie", "Triggers workflows sofort", "Verarbeitet 10.000 Zeilen/Sek", "Wird nie gelangweilt oder müde"]
        },
        features: [
          { title: "Autonome Rechnungsstellung", desc: "Generiert, versendet und mahnt Rechnungen automatisch basierend auf Vertragsdaten." },
          { title: "Daten-Synchronisation", desc: "Synct Daten zwischen CRM, ERP und Sheets in Echtzeit. Keine Silos mehr." },
          { title: "Meeting Vorbereitung", desc: "Recherchiert Teilnehmer und erstellt Briefing-Docs vor jedem Meeting in deinem Kalender." },
          { title: "Vertragsprüfung", desc: "Scannt rechtliche Dokumente auf Risiken und markiert fehlende Klauseln in Sekunden." }
        ]
      },
      marketing: {
        badge: "WACHSTUMS MOTOR",
        title: "Das Unendliche Marketing-Team",
        subtitle: "Skaliere Content-Produktion um das 100-fache. Dein KI-Marketing-Agent recherchiert, schreibt und postet autonom.",
        comparison: {
          humanTitle: "Menschlicher Marketer",
          humanPoints: ["Schreibblockade bremst Output", "Inkonsistenter Posting-Plan", "Begrenzte Recherchekapazität", "Burnout durch hohes Volumen"],
          aiTitle: "KI Marketing-Agent",
          aiPoints: ["Generiert unendlich viele Ideen", "Postet perfekt nach Zeitplan", "Liest das ganze Internet für Trends", "Skaliert Output sofort"]
        },
        features: [
          { title: "SEO Content in Masse", desc: "Schreibt 100+ SEO-optimierte Blog-Posts pro Monat basierend auf Keyword-Recherche." },
          { title: "Social Media Autopilot", desc: "Erstellt und plant LinkedIn, X und IG Posts, maßgeschneidert auf deine Brand Voice." },
          { title: "Trend Jacking", desc: "Überwacht Nachrichten 24/7 und entwirft Content, der sofort auf Branchentrends reagiert." },
          { title: "Ad Copy Iteration", desc: "Generiert und testet 50+ Ad-Variationen, um den Gewinner-Hook automatisch zu finden." }
        ]
      }
    },
    affiliatePage: {
      title: "Skaliere Affiliate Marketing mit KI-Agenten",
      subtitle: "Automatisierte Strategien. 24/7 Wachstum.",
      description: "Hör auf, Affiliates manuell zu managen. RevenueWorks baut KI-Agenten, die deine Partner automatisch rekrutieren und managen. Spare Zeit und skaliere deinen Umsatz mit intelligenten digitalen Mitarbeitern.",
      offer: {
        title: "Das KI Angebot",
        description: "Hebe dein Affiliate Marketing mit KI-gesteuerten Agenten, die rund um die Uhr arbeiten, auf ein neues Level. Unsere Automatisierungsstrategien ersetzen manuelles Tracking und Rekrutierung."
      },
      features: [
        {
          title: "KI-Rekrutierungs-Agenten",
          description: "Setze Agenten ein, die Top-Affiliates automatisch identifizieren und anwerben. Keine manuelle Suche oder verschwendete Stunden mehr."
        },
        {
          title: "Automatisches Management",
          description: "Deine KI-Agenten übernehmen Kommunikation, Onboarding und Support für tausende Partner gleichzeitig und sparen dir 40+ Stunden pro Woche."
        },
        {
          title: "KI Beratung & Audits",
          description: "Entfessele das Potenzial deines Programms. Unsere KI analysiert Leistungsmuster, die menschlichen Augen entgehen, und steigert den ROI sofort."
        },
        {
          title: "Selbstoptimierende Strategien",
          description: "Baue eine Strategie, die lernt. Unsere KI-Systeme testen und passen deine Affiliate-Angebote kontinuierlich an, um die Conversion ohne manuelles Eingreifen zu maximieren."
        }
      ],
      quote: {
        text: "Von Experten gebaut, von KI-Agenten betrieben.",
        subtext: "Bei RevenueWorks kombinieren wir Strategie mit autonomen KI-Agenten. Wir beraten nicht nur; wir bauen die digitalen Mitarbeiter, die dein Affiliate-Programm für dich betreiben.",
        extra: "Mit 25+ Jahren Expertise sparen dir unsere KI-Agenten Zeit und maximieren die Rentabilität 24/7."
      }
    },
    caseStudiesPage: {
      title: "Agenten Logs",
      subtitle: "Leistungsberichte von aktiven KI-Mitarbeitern.",
      ndaNote: "Aufgrund von NDAs sind Firmennamen geschwärzt. Diese Zahlen stammen von echten KI-Agenten, die aktuell 24/7 für unsere Kunden arbeiten.",
      restricted: "VERTRAULICHE AGENTEN DATEN",
      metrics: {
        leads: "Leads durch KI",
        saved: "Stunden Gespart",
        rev: "Umsatz Erhöht"
      },
      status: "AGENT AKTIV"
    },
    login: {
      title: "Zugriffs-Terminal",
      subtitle: "Verwalte deine KI-Workforce",
      email: "Arbeits-Email",
      password: "Passwort",
      submit: "Sitzung Starten",
      forgot: "Zugang Wiederherstellen",
      redirect: "Authentifizierung...",
      success: "Zugriff Genehmigt. Weiterleitung zum Mainframe..."
    },
    footer: {
      desc: "Wir bauen deine 24/7 KI-Workforce. Ersetze manuelle Arbeit durch intelligente Agenten und hol dir deine Zeit zurück.",
      modules: "KI AGENTEN",
      company: "UNTERNEHMEN",
      rights: "© 2025 RevenueWorks LTD // KI Systeme Online",
      status: "AGENTEN: ONLINE",
      links: {
        outbound: "Vertriebs-Agenten",
        inbound: "Support-Agenten",
        crm: "Ops-Agenten",
        content: "Marketing-Agenten",
        affiliate: "Affiliate-Agenten",
        custom: "Individuelle Agenten",
        cases: "Agenten Logs",
        book: "Workforce Bauen",
        imprint: "Impressum",
        privacy: "Datenschutz",
        demoDashboard: "Demo Dashboard"
      }
    },
    cta: {
      title1: "TRITT DER",
      title2: "KI REVOLUTION BEI",
      desc: "Erhalte wöchentliche Baupläne für deine eigenen KI-Mitarbeiter. Automatisiere deine Arbeit oder werde automatisiert.",
      placeholder: "DEINE@EMAIL.COM",
      firstNamePlaceholder: "DEIN VORNAME",
      button: "BAUPLÄNE ERHALTEN"
    },
    marquee: [
       "KI Mitarbeiter Einstellen", "Spare min. 10h pro Woche", "24/7 Automatisierung", "Lass dir deine Agents bauen", "Spare dir Personalkosten"
    ],
    demo: {
        title: "Workforce Bauen",
        subtitle: "Unsere KI-Workforce ist bereit zum Einsatz. Bist du es?",
        form: {
            firstName: "Vorname",
            lastName: "Nachname",
            name: "Name",
            email: "Arbeits-Email",
            website: "Webseite URL",
            company: "Unternehmen",
            role: "Rolle",
            message: "Welche Aufgabe möchtest du automatisieren?",
            submit: "AGENTEN ANFORDERN"
        },
        success: "Anfrage Empfangen. Dein KI-Berater wird dich innerhalb von 24ms kontaktieren."
    },
    cookie: {
      title: "Cookie-Einstellungen",
      intro: "Wir verwenden Cookies, um unsere Dienste technisch bereitzustellen und das Nutzererlebnis zu verbessern. Durch Klicken auf ",
      acceptQuote: "Akzeptieren",
      agreement: " stimmen Sie der Verwendung zu. Weitere Informationen finden Sie in unserer ",
      privacy: "Datenschutzerklärung",
      and: " und im ",
      imprint: "Impressum",
      decline: "Ablehnen",
      accept: "Akzeptieren"
    },
    dashboard: {
        brand: "RevenueWorks Studio",
        backed: "powered by selecdoo AI",
        sidebar: {
            discovery: "DISCOVERY",
            find: "Find New",
            all: "All Discovered",
            management: "MANAGEMENT",
            saved: "Saved Affiliates",
            outreach: "Outreach",
            plan: "BUSINESS PLAN",
            active: "Active Subscription",
            manage: "Manage Plan"
        },
        top: {
            nextScan: "NEXT SCAN",
            topic: "Topic Searches",
            emailCredits: "Email Credits",
            aiCredits: "AI Credits",
            findBtn: "Find Affiliates"
        },
        main: {
            search: "Search...",
            generate: "Generate Messages",
            cols: {
                affiliate: "AFFILIATE",
                content: "RELEVANT CONTENT",
                method: "DISCOVERY METHOD",
                email: "EMAIL",
                message: "MESSAGE"
            },
            empty: {
                title: "Start Building Connections",
                subtitle: "Save affiliates to generate AI-powered outreach messages."
            }
        }
    }
  }
};