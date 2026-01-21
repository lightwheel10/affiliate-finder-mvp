/**
 * =============================================================================
 * GERMAN DICTIONARY - i18n Translations (Deutsch)
 * =============================================================================
 *
 * Created: January 9th, 2026
 *
 * This file contains all German (de) translations for the CrewCast Studio app.
 *
 * LANGUAGE STYLE:
 * ---------------
 * - Uses formal "Sie" form (not informal "du")
 * - B2B professional tone
 * - Industry-standard terminology where applicable
 *
 * TRANSLATOR NOTES:
 * -----------------
 * - Some English terms are kept when commonly used in German tech/marketing
 *   (e.g., "Dashboard", "Pipeline", "Affiliate", "CRM")
 * - "E-Mail" is hyphenated per German convention
 * - Numbers use German formatting where shown in UI
 *
 * =============================================================================
 */

import { Dictionary } from './index';

export const de: Dictionary = {
  // =========================================================================
  // COMMON
  // =========================================================================
  common: {
    loading: 'Wird geladen...',
    error: 'Fehler',
    success: 'Erfolg',
    cancel: 'Abbrechen',
    save: 'Speichern',
    delete: 'Löschen',
    remove: 'Entfernen',
    back: 'Zurück',
    next: 'Weiter',
    continue: 'Fortfahren',
    skip: 'Überspringen',
    close: 'Schließen',
    confirm: 'Bestätigen',
    edit: 'Bearbeiten',
    update: 'Aktualisieren',
    add: 'Hinzufügen',
    search: 'Suchen',
    filter: 'Filtern',
    clear: 'Löschen',
    clearAll: 'Alle löschen',
    selectAll: 'Alle auswählen',
    deselectAll: 'Auswahl aufheben',
    selected: 'ausgewählt',
    retry: 'Erneut versuchen',
    refresh: 'Aktualisieren',
    copy: 'Kopieren',
    copied: 'Kopiert!',
    view: 'Ansehen',
    download: 'Herunterladen',
    upload: 'Hochladen',
    yes: 'Ja',
    no: 'Nein',
    or: 'oder',
    and: 'und',
    of: 'von',
    to: 'bis',
    from: 'von',
    all: 'Alle',
    none: 'Keine',
    days: 'Tage',
    day: 'Tag',
    hours: 'Stunden',
    hour: 'Stunde',
    minutes: 'Minuten',
    minute: 'Minute',
  },

  // =========================================================================
  // NAVIGATION
  // =========================================================================
  nav: {
    login: 'Anmelden',
    logout: 'Abmelden',
    signup: 'Registrieren',
    startFreeTrial: 'Kostenlos testen',
    features: 'Funktionen',
    howItWorks: 'So funktioniert es',
    pricing: 'Preise',
    settings: 'Einstellungen',
    discovery: 'Entdecken',
    findNew: 'Neu suchen',
    allDiscovered: 'Alle entdeckten',
    management: 'Verwaltung',
    savedAffiliates: 'Gespeicherte Affiliates',
    outreach: 'Kontaktaufnahme',
    businessPlan: 'Abonnement',
    activeSubscription: 'Aktives Abonnement',
    managePlan: 'Abo verwalten',
    upgradePlan: 'Abo upgraden',
  },

  // =========================================================================
  // LANDING PAGE
  // =========================================================================
  landing: {
    hero: {
      badge: 'Vertraut von über 1.300 Marken',
      title: 'Entdecken Sie Affiliates',
      titleHighlight: 'die Wettbewerber bewerben',
      subtitle: 'Finden Sie über 500 aktive Affiliates mit verifizierten Kontaktdaten sofort. Überspringen Sie wochenlange manuelle Recherche.',
      ctaPrimary: 'Kostenlos testen',
      ctaSecondary: 'Demo anfordern',
      socialProof: 'Beliebt bei über 1.300 SaaS- und E-Commerce-Marken',
    },
    trustedBy: 'Vertraut von Plattformen',
    features: {
      sectionTitle: 'Wie clevere Marken ihr Affiliate-Wachstum verdreifachen',
      sectionSubtitle: 'Verschwenden Sie keine 20+ Stunden pro Woche mit manueller Affiliate-Suche. Finden Sie alle Creator und Publisher in Ihrer Nische in wenigen Minuten.',
      mainFeature: {
        title: 'Analysieren Sie Wettbewerber-Programme',
        description: 'Finden Sie alle Top-Affiliates über 100+ Netzwerke.',
        badge1: '500+ sofortige Treffer',
        badge2: 'Wöchentlich neue Leads',
      },
      feature2: {
        title: 'E-Mails finden, die niemand sonst hat',
        description: 'Über 90% Kontaktrate inklusive LinkedIn-Profile.',
      },
      feature3: {
        title: 'Sofort mit der Rekrutierung beginnen',
        description: 'Export zu CRM und sofortiger Start der Kontaktaufnahme.',
      },
    },
    howItWorks: {
      sectionTitle: 'Von null auf über 500 Affiliates in Minuten',
      sectionSubtitle: 'Beobachten Sie, wie sich Ihr Dashboard mit qualifizierten Partnern füllt, die bereit sind, Ihre Marke zu bewerben.',
      step1: {
        number: '01',
        title: 'Finden Sie die Top-Affiliates Ihrer Wettbewerber',
        description: 'Geben Sie Ihre Wettbewerber ein und wir analysieren deren Affiliate-Programme über 100+ Netzwerke, um alle Top-Affiliates zu finden — auch die versteckten.',
        overlayTitle: 'Wettbewerber-Analyse',
        overlaySubtitle: '1.243 Affiliates gefunden',
        bullets: [
          'Durchsuchen von YouTube, Instagram, TikTok und Blogs',
          'Affiliates finden, die ähnliche Produkte bewerben',
          'Kein Durchsuchen von Ahrefs oder Semrush mehr nötig',
        ],
      },
      step2: {
        number: '02',
        title: '500-2.500 qualifizierte Prospects erhalten',
        description: 'Beobachten Sie, wie sich Ihr Dashboard mit qualifizierten Affiliates füllt. Sortieren Sie nach Traffic-Volumen, Google-Rankings, Follower-Anzahl oder Engagement-Raten, um schnell Ihre perfekten Partner zu finden.',
        overlayTitle: 'Hochwertige Treffer',
        overlaySubtitle: 'Sortiert nach Engagement-Rate',
        bullets: [
          'Filtern nach Traffic, Rankings und Engagement',
          'Zielgruppen-Demografie und Standortdaten anzeigen',
          'Frühere Markenpartnerschaften verfolgen',
        ],
      },
      step3: {
        number: '03',
        title: 'Sofort mit der Rekrutierung beginnen',
        description: 'Exportieren Sie verifizierte E-Mails, nutzen Sie unsere bewährten Vorlagen und starten Sie noch heute mit dem Aufbau von Partnerschaften. Erhalten Sie wöchentlich über 150 neue Leads.',
        overlayTitle: 'Bereit zur Kontaktaufnahme',
        overlaySubtitle: '150+ neue Leads wöchentlich',
        bullets: [
          'Über 90% E-Mail-Zustellbarkeit',
          'Bewährte Outreach-Vorlagen inklusive',
          'Ein-Klick CRM-Export',
        ],
      },
    },
    pricing: {
      badge: 'Einfache, transparente Preise',
      sectionTitle: 'Finden Sie den perfekten Plan für Ihr Wachstum',
      sectionSubtitle: 'Alle Pläne beinhalten wöchentliche Affiliate-Entdeckung, um Ihre Pipeline voll zu halten. Starten Sie mit einer 7-tägigen kostenlosen Testversion.',
      mostPopular: 'Am beliebtesten',
      perMonth: '/Monat',
      pro: {
        name: 'Pro',
        description: 'Für wachsende SaaS- und E-Commerce-Marken',
        price: '99 €',
        cta: '7-Tage-Testversion starten',
        features: [
          'Unbegrenzte Affiliate-Entdeckung (500+ Treffer)',
          'Wöchentlich neue Affiliate-Entdeckungen',
          '150 verifizierte E-Mail-Credits/Monat',
          'Erweiterte Such- und Filtertools',
          '2 Team-Plätze',
          'Ein-Klick CRM-Export',
        ],
      },
      growth: {
        name: 'Growth',
        description: 'Für Agenturen und Multi-Marken-Unternehmen',
        price: '249 €',
        cta: '7-Tage-Testversion starten',
        features: [
          'Alles in Pro +',
          '500 verifizierte E-Mail-Credits/Monat',
          '5 Marken oder geografische Märkte',
          '5 Team-Plätze',
          'Erweitertes Analytics-Dashboard',
          'Dedizierter Account Manager',
        ],
      },
      enterprise: {
        name: 'Enterprise',
        description: 'Für große Organisationen mit individuellen Anforderungen',
        price: 'Individuell',
        cta: 'Kontakt aufnehmen',
        features: [
          'Alles in Growth +',
          'Unbegrenzte verifizierte E-Mails',
          'Unbegrenztes Marken-Portfolio',
          'Unbegrenzter Team-Zugang',
          'API-Zugang und Webhooks',
          '24/7 Priority-Support',
        ],
      },
      trustNote: '✨ 7 Tage kostenlos testen • Jederzeit kündbar • 30 Tage Geld-zurück-Garantie',
    },
    cta: {
      title: 'Bereit, Ihre perfekten Affiliates zu finden?',
      subtitle: 'Schließen Sie sich über 1.300 Marken an, die ihre idealen Affiliate-Partner in Minuten statt Monaten gefunden haben.',
      ctaPrimary: 'Ihre 7-Tage-Testversion starten',
      ctaSecondary: 'Demo anfordern',
      trustNote: '7 Tage kostenlos testen • Jederzeit kündbar',
    },
    // January 21st, 2026: Removed "Unterstützt von selecdoo AI" from brandDescription per client request
    footer: {
      brandDescription: 'Der neue Standard für Affiliate-Entdeckung. Wir helfen Marken, ihre Partner-Netzwerke 10x schneller zu skalieren.',
      product: 'Produkt',
      legal: 'Rechtliches',
      privacyPolicy: 'Datenschutzerklärung',
      termsOfService: 'Nutzungsbedingungen',
      cookiePolicy: 'Cookie-Richtlinie',
      security: 'Sicherheit',
      copyright: '© 2025 CrewCast Studio. Alle Rechte vorbehalten.',
      madeBy: 'Entwickelt von Spectrum AI Labs',
      systemStatus: 'Alle Systeme funktionsfähig',
    },
    // Demo component strings (January 9th, 2026)
    demo: {
      searchPlaceholder: 'Nische oder Keyword eingeben...',
      scoutButton: 'Suchen',
      scanning: 'Scanne...',
      analyzing: 'Analysiere...',
      emptyState: 'Geben Sie eine Nische ein, um Affiliates zu finden',
      emailFound: 'Gefunden',
      noEmail: 'Keine E-Mail',
      resultsVisible: 'Ergebnisse sichtbar',
      searchTime: '0,8s Suchzeit',
      analysisComplete: 'Analyse abgeschlossen',
    },
  },

  // =========================================================================
  // ONBOARDING (Updated January 9th, 2026)
  // Restructured to match actual OnboardingScreen.tsx component
  // Uses formal "Sie" form throughout
  // =========================================================================
  onboarding: {
    // Common strings used across onboarding steps
    common: {
      search: 'Suchen...',
      noResults: 'Keine Ergebnisse gefunden',
    },
    // Step 1: Name, Role, Brand (combined step)
    step1: {
      header: 'Willkommen bei CrewCast Studio',
      title: 'Lernen wir uns kennen',
      nameLabel: 'Name',
      namePlaceholder: 'Geben Sie Ihren vollständigen Namen ein',
      roleLabel: 'Was ist Ihre Rolle',
      rolePlaceholder: 'Wählen Sie Ihre Rolle',
      roles: {
        brandOwner: 'Markeninhaber',
        affiliateManager: 'Affiliate Manager',
        agencyOwner: 'Agenturinhaber',
        freelancer: 'Freelancer',
        contentCreator: 'Content Creator',
        other: 'Andere',
      },
      brandLabel: 'Für welche Marke möchten Sie Affiliates finden?',
      brandPlaceholder: 'z.B. guffles.de',
      helpText: 'Für Agenturen: Geben Sie hier die Website Ihres Kunden an, nicht Ihre eigene.',
      validation: {
        invalidFormat: 'Geben Sie ein gültiges Domain-Format ein (z.B. beispiel.de)',
        domainNotReachable: 'Domain ist nicht erreichbar',
        failedToValidate: 'Domain-Validierung fehlgeschlagen. Bitte versuchen Sie es erneut.',
      },
    },
    // Step 2: Target Market (Country + Language)
    step2: {
      title: 'Zielmarkt',
      countryLabel: 'Land',
      countryPlaceholder: 'Wählen Sie Ihr Zielland...',
      languageLabel: 'Zielsprache',
      languagePlaceholder: 'Wählen Sie Ihre Zielsprache...',
    },
    // Step 3: Competitors
    step3: {
      title: 'Fügen Sie Ihre Top 5 Wettbewerber hinzu',
      inputPlaceholder: 'z.B. wettbewerber.de',
      count: '{count}/5 hinzugefügt',
      suggestionsTitle: 'Vorschläge für Sie:',
      yourCompetitors: 'Ihre Wettbewerber:',
      emptyState: 'Geben Sie oben Wettbewerber-Domains ein (z.B. wettbewerber.de)',
    },
    // Step 4: Topics
    // Max topics reduced from 10 to 5 - January 15th, 2026
    step4: {
      title: 'Welche Themen behandeln Sie?',
      inputPlaceholder: 'z.B. beste CRMs, Hautpflege...',
      count: '{count}/5 hinzugefügt',
      suggestionsTitle: 'Vorschläge für Sie:',
      yourTopics: 'Ihre Themen:',
      emptyState: 'Geben Sie oben Themen ein (z.B. "beste CRMs", "Hautpflege-Routinen")',
    },
    // Step 5: Pricing / Plan Selection
    step5: {
      title: 'Wählen Sie Ihren Plan',
      trialInfo: 'Starten Sie mit einer 3-tägigen kostenlosen Testversion • Jederzeit kündbar',
      monthly: 'Monatlich',
      annual: 'Jährlich',
      discountBadge: '-20%',
      bestValue: 'Bester Wert',
      perMonth: '/Monat',
      billedAnnually: 'Abgerechnet {amount}/Jahr',
      contactSales: 'Vertrieb kontaktieren',
      selected: 'Ausgewählt',
      selectPlan: 'Plan auswählen',
      included: 'Enthalten:',
      // January 17, 2026: Added pricing plan translations
      plans: {
        pro: {
          name: 'Pro',
          description: 'Perfekt für Einzelgründer & kleine Teams am Anfang ihrer Affiliate-Reise.',
          features: [
            '500 neue Affiliates / Monat finden',
            '150 verifizierte E-Mail-Credits / Monat',
            '1 Markenprojekt',
            'Grundlegende Suchfilter',
            'E-Mail-Support',
            'CSV-Export',
          ],
        },
        business: {
          name: 'Business',
          description: 'Für wachsende Marken, die ihr Outreach-Volumen skalieren müssen.',
          features: [
            'Unbegrenzt Affiliates finden',
            '500 verifizierte E-Mail-Credits / Monat',
            '5 Markenprojekte',
            'Erweiterte Wettbewerber-Analyse',
            'Prioritäts-Chat-Support',
            'API-Zugang',
            'Team-Zusammenarbeit (5 Plätze)',
          ],
        },
        enterprise: {
          name: 'Enterprise',
          description: 'Maßgeschneiderte Lösungen für große Organisationen mit spezifischen Anforderungen.',
          priceLabel: 'Individuell',
          features: [
            'Alles unbegrenzt',
            'Dedizierter Account Manager',
            'Kundenspezifisches KI-Modell-Training',
            'SSO & Erweiterte Sicherheit',
            'Premium-Onboarding',
            'Individuelle Rechnungsstellung',
          ],
        },
      },
    },
    // Step 6: Affiliate Types
    step6: {
      title: 'Welche Arten von Affiliates möchten Sie?',
      types: {
        publishersBloggers: 'Publisher/Blogger',
        instagram: 'Instagram',
        tiktok: 'TikTok',
        xTwitter: 'X (Twitter)',
        linkedin: 'LinkedIn',
        reddit: 'Reddit',
        youtube: 'YouTube',
        other: 'Andere',
      },
    },
    // Step 7: Payment / Card Details (Step7CardForm)
    step7: {
      secureCheckout: 'Sichere Zahlung',
      title: 'Starten Sie Ihre 3-tägige kostenlose Testversion',
      subtitle: 'Geben Sie Ihre Kartendaten ein • Heute wird nichts berechnet',
      selectedPlan: 'Ausgewählter Plan',
      perMonth: '/Monat',
      billedAnnually: 'Jährlich abgerechnet',
      firstCharge: 'Erste Abbuchung: in 3 Tagen',
      discountLabel: 'Rabattcode (Optional)',
      discountPlaceholder: 'SPARE20',
      apply: 'Anwenden',
      applied: 'Angewendet',
      processing: 'Wird verarbeitet...',
      startTrial: '3-Tage-Testversion starten',
      discountApplied: '% Rabatt angewendet! Sie sparen',
      cardholderName: 'Name des Karteninhabers',
      cardDetails: 'Kartendaten',
      nameOnCard: 'Name auf der Karte',
    },
    // Analyzing Screen (between step 1 and 2)
    analyzing: {
      title: 'Ihre Marke wird analysiert',
      titleError: 'Analyse abgeschlossen',
      gettingInsightsFor: 'Einblicke werden geholt für',
      errorTitle: 'Wir konnten keine automatischen Vorschläge finden',
      continueManually: 'Manuell fortfahren',
      timeEstimate: 'Dies dauert normalerweise 10-15 Sekunden',
      steps: {
        step1Label: 'Ihre Website wird analysiert',
        step1Desc: 'Inhalt und Struktur werden gelesen',
        step2Label: 'Ihre Produkte werden verstanden',
        step2Desc: 'Ihr Angebot wird identifiziert',
        step3Label: 'Ihre Wettbewerber werden gefunden',
        step3Desc: 'Ähnliche Unternehmen werden entdeckt',
      },
    },
    // Navigation buttons
    navigation: {
      gettingStarted: 'Erste Schritte',
      stepOf: 'Schritt {current} von {total}',
      continue: 'Weiter',
      next: 'Weiter',
      choosePlan: 'Plan wählen',
      continueToPayment: 'Weiter zur Zahlung',
      contactSales: 'Vertrieb kontaktieren',
      validatingDomain: 'Domain wird validiert...',
    },
  },

  // =========================================================================
  // DASHBOARD
  // =========================================================================
  dashboard: {
    header: {
      nextScan: 'NÄCHSTER SCAN',
      pro: 'PRO',
      findAffiliates: 'Affiliates finden',
    },
    credits: {
      topicSearches: 'Themensuchen',
      topicSearchesShort: 'Suche',
      emailCredits: 'E-Mail-Credits',
      emailCreditsShort: 'E-Mail',
      aiCredits: 'KI-Credits',
      aiCreditsShort: 'KI',
      topic: 'Thema',
    },
    filters: {
      searchPlaceholder: 'Affiliates suchen...',
      all: 'Alle',
      web: 'Web',
      youtube: 'YouTube',
      instagram: 'Instagram',
      tiktok: 'TikTok',
    },
    table: {
      affiliate: 'Affiliate',
      relevantContent: 'Relevanter Inhalt',
      discoveryMethod: 'Entdeckungsmethode',
      date: 'Datum',
      status: 'Status',
      email: 'E-Mail',
      message: 'Nachricht',
      action: 'Aktion',
      creator: 'Creator',  // January 17, 2026: Added for outreach page table header
    },
    find: {
      pageTitle: 'Neu suchen',
      emptyState: {
        title: 'Noch keine Affiliates gefunden',
        subtitle: 'Starten Sie eine Suche, um Ergebnisse zu sehen',
      },
      loading: {
        scanning: 'Das Web wird nach Affiliates durchsucht...',
        subtitle: 'Suche auf YouTube, Instagram, TikTok und Websites',
        badge: 'Scan wird gestartet',
        // January 17, 2026: Added dynamic loading messages
        fromYouTube: 'von YouTube',
        fromInstagram: 'von Instagram',
        fromTikTok: 'von TikTok',
        fromWebsites: 'von Websites',
        analyzing: 'Ergebnisse werden analysiert...',
        found: 'gefunden',
        progressTitles: {
          title1: 'Tolle Funde kommen rein!',
          title2: 'Potenzielle Partner werden entdeckt...',
          title3: 'Ihre Affiliate-Liste wird erstellt...',
          title4: 'Versteckte Perlen werden aufgedeckt...',
        },
      },
      // January 17, 2026: Added toast messages for save/delete feedback
      toasts: {
        affiliatesSaved: 'Affiliate(s) gespeichert!',
        noNewAffiliatesSaved: 'Keine neuen Affiliates gespeichert',
        addedToPipeline: 'Erfolgreich zur Pipeline hinzugefügt.',
        alreadyInPipeline: 'bereits in Pipeline (übersprungen)',
        affiliateDeleted: 'Affiliate gelöscht',
        affiliatesDeleted: 'Affiliates gelöscht',
        removedFromDiscovered: 'Erfolgreich aus Entdeckte-Liste entfernt.',
      },
      modal: {
        title: 'Affiliates finden',
        subtitle: 'Fügen Sie bis zu 5 Keywords hinzu, um relevante Creator zu entdecken',
        keywordsLabel: 'Keywords',
        keywordsPlaceholder: 'Keyword eingeben + Enter...',
        addButton: 'Hinzufügen',
        websiteLabel: 'Website',
        competitorsLabel: 'Wettbewerber',
        competitorsAdded: 'hinzugefügt',
        noCompetitors: 'Keine Wettbewerber hinzugefügt',
        notSetDuringOnboarding: 'Beim Onboarding nicht festgelegt',
        clearAllKeywords: 'Alle Keywords löschen',
        noKeywordsYet: 'Noch keine Keywords hinzugefügt',
        ctaButton: 'Affiliates finden',
        searching: 'Suche läuft...',
        tip: '💡 Tipp: Verwenden Sie spezifische Keywords wie "beste CRM-Software" anstatt nur "CRM"',
      },
      bulkActions: {
        selected: 'ausgewählt',
        selectAllVisible: 'Alle sichtbaren auswählen',
        deselectAll: 'Auswahl aufheben',
        alreadyInPipeline: 'bereits in Pipeline',
        deleteSelected: 'Ausgewählte löschen',
        saveToPipeline: 'In Pipeline speichern',
        allAlreadySaved: 'Alle bereits gespeichert',
      },
      newSearchWarning: {
        title: 'Neue Suche gestartet',
        subtitle: 'Vorherige Ergebnisse wurden auf die Seite "Alle entdeckten" verschoben.',
      },
      creditError: {
        title: 'Keine Themen-Such-Credits mehr',
        message: 'Unzureichende Themen-Such-Credits',
        upgradeHint: 'Upgraden Sie Ihren Plan für mehr Suchen, oder warten Sie, bis Ihre Credits aktualisiert werden.',
      },
      noResults: 'Keine Ergebnisse für diesen Filter gefunden.',
    },
    // Pagination - Added January 9th, 2026 for i18n
    pagination: {
      showing: 'Zeige',
      toOf: 'bis',
      affiliates: 'Affiliates',
      previous: 'Zurück',
      next: 'Weiter',
      perPage: 'pro Seite',
    },
    discovered: {
      pageTitle: 'Alle entdeckten',
      emptyState: {
        title: 'Keine entdeckten Affiliates',
        subtitle: 'Affiliates aus Ihren Suchen werden hier angezeigt',
      },
      // January 17, 2026: Added loading message
      loading: 'Entdeckte Affiliates werden geladen...',
    },
    saved: {
      pageTitle: 'Gespeicherte Affiliates',
      emptyState: {
        title: 'Keine gespeicherten Affiliates',
        subtitle: 'Affiliates, die Sie speichern, werden hier angezeigt',
      },
      bulkActions: {
        findEmails: 'E-Mails finden',
        emailProgress: 'E-Mails werden gesucht...',
      },
      emailStatus: {
        found: 'Gefunden',
        notFound: 'Nicht gefunden',
        searching: 'Suche läuft...',
        none: 'Keine',
      },
      // Toast notification helpers (January 10th, 2026)
      savedCount: '{count} gespeichert',
      deletedCount: '{count} gelöscht',
      emailResults: {
        found: 'Gefunden',
        errors: 'Fehler',
      },
      // January 17, 2026: Added toast translations
      toasts: {
        affiliateRemoved: 'Affiliate entfernt',
        affiliatesRemoved: 'Affiliates entfernt',
        removedFromPipeline: 'Erfolgreich aus Ihrer Pipeline entfernt.',
        emailLookupFailed: 'E-Mail-Suche fehlgeschlagen',
        errors: 'Fehler',
        // Email lookup result messages
        insufficientCredits: 'Unzureichende Credits',
        emailsFound: 'E-Mail(s) gefunden!',
        readyForOutreach: 'Bereit für Kontaktaufnahme',
        found: 'gefunden',
        notFound: 'nicht gefunden',
      },
    },
    // =========================================================================
    // OUTREACH PAGE TRANSLATIONS
    // Updated: January 17, 2026 - Added comprehensive i18n support
    // =========================================================================
    outreach: {
      pageTitle: 'Kontaktaufnahme',
      // Loading state
      loading: 'Affiliates werden geladen...',
      // Empty & No Results states
      emptyState: {
        title: 'Beginnen Sie mit dem Aufbau von Verbindungen',
        subtitle: 'Speichern Sie Affiliates, um KI-gestützte Outreach-Nachrichten zu generieren.',
      },
      noResults: {
        title: 'Keine Ergebnisse gefunden',
        subtitle: 'Versuchen Sie, Ihre Suche oder den Filter anzupassen.',
      },
      // Selection actions (January 17, 2026)
      selected: 'Ausgewählt',
      selectAll: 'Alle auswählen',
      deselectAll: 'Auswahl aufheben',
      // Row action buttons
      generate: 'Generieren',
      generating: 'Generierung...',
      viewMessage: 'Ansehen',
      messages: 'Nachr.',
      messagesLabel: 'Nachrichten',  // For modal badge
      failed: 'Fehlgeschlagen',
      retry: 'Erneut',
      selectContacts: 'Kontakte auswählen',
      contacts: 'Kontakte',
      bulkGenerate: 'Generieren',
      // Contact Picker Modal (January 17, 2026: Comprehensive translations)
      contactPicker: {
        title: 'Kontakte auswählen',
        subtitle: 'Wählen Sie die Kontakte aus, für die Sie personalisierte E-Mails generieren möchten:',
        creditsUsed: 'Verbraucht',
        credit: 'Credit',
        credits: 'Credits',
        selectContacts: 'Kontakte auswählen',
        alreadyGenerated: 'Fertig',
        unknownName: 'Unbekannt',
        cancel: 'Abbrechen',
      },
      // Message Viewer Modal (January 17, 2026: Added edit mode translations)
      messageViewer: {
        title: 'KI-generierte Nachricht',
        to: 'an',
        primaryContact: 'Hauptkontakt',
        affiliateDetails: 'Affiliate-Details',
        contactName: 'Kontaktname',
        platform: 'Plattform',
        keyword: 'Keyword',
        // Action buttons
        redo: 'Neu erstellen',
        regenerating: 'Neu generieren...',
        edit: 'Bearbeiten',
        editPlaceholder: 'Bearbeiten Sie Ihre Nachricht...',
        save: 'Speichern',
        saving: 'Speichern...',
        cancel: 'Abbrechen',
        copy: 'Kopieren',
        copied: 'Kopiert!',
        done: 'Fertig!',
      },
      // Toast notifications (January 10th, 2026)
      email: 'E-Mail',
      emails: 'E-Mails',
      failedRetry: 'fehlgeschlagen - klicken Sie auf "Erneut versuchen".',
    },
    settings: {
      pageTitle: 'Einstellungen',
      tabs: {
        profile: {
          label: 'Mein Profil',
          description: 'Verwalten Sie Ihre persönlichen Informationen',
        },
        plan: {
          label: 'Abo & Abrechnung',
          description: 'Verwalten Sie Ihr Abonnement und die Abrechnung',
        },
        notifications: {
          label: 'Benachrichtigungen',
          description: 'Konfigurieren Sie, wie Sie benachrichtigt werden möchten',
        },
        security: {
          label: 'Sicherheit',
          description: 'Schützen Sie Ihr Konto',
        },
      },
      // =======================================================================
      // PROFILE SECTION - Updated January 17, 2026
      // Added all missing profile form translations
      // =======================================================================
      profile: {
        photoTitle: 'Profilfoto',
        photoDescription: 'Aktualisieren Sie Ihr Profilbild in den Kontoeinstellungen.',
        fullName: 'Vollständiger Name',
        emailAddress: 'E-Mail-Adresse',
        editProfile: 'Profil bearbeiten',
        // January 17, 2026: Added missing profile translations
        targetMarket: 'Zielmarkt',
        country: 'Land',
        language: 'Sprache',
        selectCountry: 'Land auswählen',
        selectLanguage: 'Sprache auswählen',
        notSet: 'Nicht festgelegt',
        emailCannotChange: 'E-Mail kann hier nicht geändert werden.',
        enterYourName: 'Geben Sie Ihren Namen ein',
        nameCannotBeEmpty: 'Name darf nicht leer sein',
        failedToSave: 'Speichern fehlgeschlagen. Bitte versuchen Sie es erneut.',
        failedToUpdateDatabase: 'Datenbank konnte nicht aktualisiert werden',
        saveChanges: 'Änderungen speichern',
        saving: 'Speichern...',
        cancel: 'Abbrechen',
      },
      plan: {
        currentPlan: 'Aktueller Plan',
        freeTrial: 'Kostenlose Testversion',
        pro: 'Pro',
        growth: 'Growth',
        enterprise: 'Enterprise',
        active: 'Aktiv',
        trial: 'Testversion',
        cancelled: 'Gekündigt',
        daysLeft: 'Tage in der Testversion übrig',
        trialEndsToday: 'Testversion endet heute',
        nextBilling: 'Nächste Abrechnung',
        billedAnnually: 'jährliche Abrechnung',
        choosePlan: 'Plan wählen',
        upgradePlan: 'Plan upgraden',
        managePlan: 'Plan verwalten',
        trialEndingSoon: {
          title: 'Ihre Testversion endet bald',
          subtitle: 'Fügen Sie eine Zahlungsmethode hinzu, um alle Funktionen weiter nutzen zu können.',
        },
        paymentMethod: 'Zahlungsmethode',
        noPaymentMethod: {
          title: 'Keine Zahlungsmethode hinzugefügt',
          trialSubtitle: 'Fügen Sie eine Karte hinzu, um alle Funktionen nach Ablauf Ihrer Testversion weiter nutzen zu können.',
          defaultSubtitle: 'Fügen Sie eine Zahlungsmethode hinzu, um Ihren Plan zu upgraden.',
        },
        addPaymentMethod: 'Zahlungsmethode hinzufügen',
        updatePaymentMethod: 'Aktualisieren',
        expires: 'Läuft ab',
        invoiceHistory: 'Rechnungsverlauf',
        loadingInvoices: 'Rechnungen werden geladen...',
        noInvoicesYet: {
          title: 'Noch keine Rechnungen',
          subtitle: 'Rechnungen werden hier nach Ihrem ersten Abrechnungszyklus angezeigt',
        },
        invoiceColumns: {
          invoice: 'Rechnung',
          date: 'Datum',
          amount: 'Betrag',
          status: 'Status',
          actions: 'Aktionen',
        },
        invoiceStatus: {
          paid: 'Bezahlt',
          open: 'Offen',
          draft: 'Entwurf',
          void: 'Storniert',
          uncollectible: 'Uneinbringlich',
          unknown: 'Unbekannt',
        },
        // January 17, 2026: Added missing plan translations
        noPlan: 'Kein Plan',
        card: 'Karte',
        dayLeftInTrial: 'Tag in Testversion übrig',
        viewInvoice: 'Rechnung anzeigen',
        downloadPdf: 'PDF herunterladen',
        retry: 'Erneut versuchen',
        subscriptionWillRemainActive: 'Ihr Abonnement bleibt bis zum Ende Ihres aktuellen Abrechnungszeitraums aktiv. Sie können es jederzeit vorher fortsetzen.',
        cancelSubscription: {
          title: 'Abonnement kündigen',
          subtitle: 'Wenn Sie kündigen, haben Sie bis zum Ende Ihres aktuellen Abrechnungszeitraums weiterhin Zugang zu Ihrem Plan.',
          button: 'Plan kündigen',
        },
        cancelModal: {
          cancelTitle: 'Abonnement kündigen',
          resumeTitle: 'Abonnement fortsetzen',
          cancelWarning: 'Sind Sie sicher, dass Sie kündigen möchten?',
          cancelMessage: 'Sie verlieren den Zugang zu Premium-Funktionen am Ende Ihres aktuellen Abrechnungszeitraums.',
          resumeMessage: 'Möchten Sie Ihr Abonnement fortsetzen? Ihr Plan wird wie gewohnt fortgesetzt und Sie werden zum nächsten Abrechnungszyklus belastet.',
          keepSubscription: 'Abonnement behalten',
          keepCanceled: 'Gekündigt lassen',
          confirmCancel: 'Abonnement kündigen',
          confirmResume: 'Abonnement fortsetzen',
        },
        cancellationPending: {
          title: 'Abonnement wird gekündigt',
          subtitle: 'Ihr Plan wird am Ende des aktuellen Abrechnungszeitraums gekündigt. Sie haben bis dahin weiterhin Zugang.',
          resumeButton: 'Abonnement fortsetzen',
        },
      },
      notifications: {
        emailNotifications: 'E-Mail-Benachrichtigungen',
        appNotifications: 'App-Benachrichtigungen',
        options: {
          newMatches: {
            label: 'Neue Affiliate-Treffer gefunden',
            description: 'Werden Sie benachrichtigt, wenn wir neue vielversprechende Affiliates finden.',
          },
          weeklyReport: {
            label: 'Wöchentlicher Leistungsbericht',
            description: 'Zusammenfassung Ihrer Kampagnen-Performance und Outreach-Statistiken.',
          },
          productUpdates: {
            label: 'Produkt-Updates',
            description: 'Neuigkeiten über neue Funktionen und Verbesserungen.',
          },
          successfulReplies: {
            label: 'Erfolgreiche Outreach-Antworten',
            description: 'Benachrichtigen Sie mich, wenn ein Affiliate auf meine E-Mail antwortet.',
          },
          taskReminders: {
            label: 'Aufgaben-Erinnerungen',
            description: 'Erinnern Sie mich an Follow-ups und geplante Aufgaben.',
          },
        },
      },
      // =======================================================================
      // SECURITY SECTION - Updated January 17, 2026
      // Added password modal and delete account modal translations
      // =======================================================================
      security: {
        passwordSecurity: 'Passwort & Sicherheit',
        securityDescription: 'Ändern Sie Ihr Passwort, um Ihr Konto zu schützen.',
        changePassword: 'Passwort ändern',
        dangerZone: 'Gefahrenzone',
        dangerZoneWarning: 'Sobald Sie Ihr Konto löschen, gibt es kein Zurück. Bitte seien Sie sich sicher.',
        deleteAccount: 'Konto löschen',
        // Password Modal
        passwordModal: {
          title: 'Passwort ändern',
          currentPassword: 'Aktuelles Passwort',
          newPassword: 'Neues Passwort',
          confirmPassword: 'Neues Passwort bestätigen',
          currentPlaceholder: 'Aktuelles Passwort eingeben',
          newPlaceholder: 'Neues Passwort eingeben (min. 8 Zeichen)',
          confirmPlaceholder: 'Neues Passwort bestätigen',
          success: 'Passwort erfolgreich geändert!',
          // Validation errors
          allFieldsRequired: 'Alle Felder sind erforderlich',
          minLength: 'Neues Passwort muss mindestens 8 Zeichen lang sein',
          passwordsDontMatch: 'Neue Passwörter stimmen nicht überein',
          mustBeDifferent: 'Neues Passwort muss sich vom aktuellen unterscheiden',
          incorrectPassword: 'Aktuelles Passwort ist falsch',
          requirementsNotMet: 'Passwort erfüllt nicht die Anforderungen',
          genericError: 'Passwort konnte nicht geändert werden. Bitte erneut versuchen.',
          // Buttons
          cancel: 'Abbrechen',
          save: 'Passwort speichern',
          saving: 'Speichern...',
        },
        // Delete Account Modal
        deleteModal: {
          title: 'Konto löschen',
          warning: 'Diese Aktion kann nicht rückgängig gemacht werden',
          warningDetail: 'Ihr Konto und alle zugehörigen Daten werden dauerhaft gelöscht.',
          willBeDeleted: 'Folgendes wird dauerhaft gelöscht:',
          items: {
            subscription: 'Ihr Abonnement (sofort gekündigt)',
            savedAffiliates: 'Alle gespeicherten Affiliates',
            discoveredAffiliates: 'Alle entdeckten Affiliates',
            searchHistory: 'Gesamter Suchverlauf',
            account: 'Ihr Konto und Anmeldedaten',
          },
          typeToConfirm: 'Geben Sie DELETE zur Bestätigung ein',
          confirmError: 'Bitte geben Sie DELETE zur Bestätigung ein',
          userIdError: 'Benutzer-ID nicht gefunden. Bitte aktualisieren und erneut versuchen.',
          genericError: 'Konto konnte nicht gelöscht werden. Bitte erneut versuchen oder Support kontaktieren.',
          // Buttons
          cancel: 'Abbrechen',
          delete: 'Endgültig löschen',
          deleting: 'Wird gelöscht...',
        },
      },
      // January 17, 2026: Added account section label
      accountLabel: 'Konto',
    },
  },

  // =========================================================================
  // SIDEBAR
  // =========================================================================
  // January 21st, 2026: Removed selecdoo branding per client request
  sidebar: {
    brand: 'CrewCast Studio',
    tagline: '', // Was: 'powered by selecdoo AI'
    planCard: {
      planSuffix: 'Plan',
      daysLeft: 'Tage übrig',
      activeSubscription: 'Aktives Abonnement',
      upgradeAvailable: 'Upgrade verfügbar',
      managePlan: 'Plan verwalten',
      upgradePlan: 'Plan upgraden',
    },
    profile: {
      settings: 'Einstellungen',
      logout: 'Abmelden',
    },
    logoutModal: {
      title: 'Abmelden',
      message: 'Sind Sie sicher, dass Sie sich abmelden möchten? Sie müssen sich erneut anmelden, um auf Ihren Arbeitsbereich zuzugreifen.',
      cancel: 'Abbrechen',
      confirm: 'Abmelden',
    },
  },

  // =========================================================================
  // MODALS
  // =========================================================================
  modals: {
    confirmDelete: {
      title: 'Löschen',
      message: 'Sind Sie sicher, dass Sie löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.',
      deleteButton: 'Löschen',
      deleting: 'Wird gelöscht...',
      deleteCount: 'Löschen',
      willBeDeleted: 'werden dauerhaft gelöscht',
      affiliates: 'Affiliates',
      affiliate: 'Affiliate',
      cancel: 'Abbrechen',
    },
    addCard: {
      title: 'Zahlungsmethode hinzufügen',
      subtitle: 'Ihre Karte wird sicher gespeichert',
      saveButton: 'Zahlungsmethode speichern',
      saving: 'Wird gespeichert...',
      discountLabel: 'Rabattcode (Optional)',
      discountPlaceholder: 'SPAREN20',
      apply: 'Anwenden',
      applied: 'Angewendet',
      discountComingSoon: 'Rabattcodes bald verfügbar',
      failedToValidate: 'Code konnte nicht validiert werden',
      discountApplied: '% Rabatt wird auf Ihren nächsten Abrechnungszeitraum angewendet',
      completeCardDetails: 'Bitte füllen Sie alle Kartendetails aus',
      securityNote: 'Ihre Kartendaten werden sicher von Stripe gespeichert. Wir sehen niemals Ihre vollständige Kartennummer.',
      processing: 'Wird verarbeitet...',
    },
  },

  // =========================================================================
  // TOASTS
  // =========================================================================
  // =========================================================================
  // TOASTS - Notification messages
  // Updated: January 10th, 2026 - Phase 3: Toast Notifications
  // =========================================================================
  toasts: {
    success: {
      emailGenerated: 'E-Mail erfolgreich generiert!',
      messageCopied: 'Nachricht in Zwischenablage kopiert!',
      affiliatesSaved: 'In Pipeline gespeichert!',
      affiliatesSavedWithDuplicates: 'bereits in Pipeline',
      affiliatesDeleted: 'Erfolgreich gelöscht',
      affiliatesDeletedFromPipeline: 'aus Pipeline',
      emailsFound: 'E-Mail(s) gefunden!',
      bulkEmailsGenerated: 'Erfolgreich generiert',
      csvExported: 'CSV erfolgreich exportiert!',
      planChanged: 'Plan erfolgreich geändert!',
      cardAdded: 'Zahlungsmethode hinzugefügt!',
      subscriptionCancelled: 'Abonnement gekündigt',
      subscriptionResumed: 'Abonnement fortgesetzt!',
      messageSaved: 'Nachricht gespeichert!',  // January 17, 2026: Added for edit message feature
    },
    error: {
      genericError: 'Etwas ist schief gelaufen. Bitte versuchen Sie es erneut.',
      searchFailed: 'Suche fehlgeschlagen. Bitte versuchen Sie es erneut.',
      saveFailed: 'Affiliates konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.',
      deleteFailed: 'Affiliates konnten nicht gelöscht werden. Bitte versuchen Sie es erneut.',
      emailLookupFailed: 'E-Mail-Suche fehlgeschlagen. Bitte versuchen Sie es erneut.',
      emailLookupFailedCount: 'E-Mail-Suche fehlgeschlagen für',
      aiGenerationFailed: 'Nachrichtengenerierung fehlgeschlagen',
      aiServiceNotConfigured: 'KI-Dienst nicht konfiguriert. Bitte kontaktieren Sie den Support.',
      aiConnectionFailed: 'Verbindung zum KI-Dienst fehlgeschlagen. Bitte versuchen Sie es erneut.',
      bulkGenerationFailed: 'Generierung fehlgeschlagen für',
      exportFailed: 'Export fehlgeschlagen',
      paymentFailed: 'Zahlung fehlgeschlagen. Bitte versuchen Sie es erneut.',
      messageSaveFailed: 'Nachricht konnte nicht gespeichert werden',  // January 17, 2026: Added for edit message feature
      messageEmpty: 'Nachricht darf nicht leer sein',  // January 17, 2026: Added for edit message validation
    },
    warning: {
      insufficientCredits: 'Unzureichende Such-Credits. Bitte upgraden Sie Ihren Plan.',
      insufficientAICredits: 'Unzureichende KI-Credits. Bitte upgraden Sie Ihren Plan.',
      insufficientEmailCredits: 'E-Mail-Credits aufgebraucht',
      noEmailsFound: 'Keine E-Mails gefunden für',
      partialBulkFailure: 'von',
      invalidThreshold: 'Bitte geben Sie einen gültigen Schwellenwert ein',
      trialEnding: 'Ihre Testversion endet bald. Fügen Sie eine Zahlungsmethode hinzu, um fortzufahren.',
      allAlreadyHaveEmails: 'Alle ausgewählten Affiliates haben bereits E-Mails',
    },
    info: {
      allAlreadyInPipeline: 'Affiliates sind bereits in Ihrer Pipeline',
      allAlreadyHaveEmails: 'Alle ausgewählten Affiliates haben bereits E-Mails',
      mixedEmailResults: 'nicht gefunden',
      mixedResults: 'Einige Vorgänge wurden mit Warnungen abgeschlossen',
      noEmailsFound: 'Keine E-Mails für ausgewählte Affiliates gefunden',
    },
  },

  // =========================================================================
  // AUTH
  // =========================================================================
  auth: {
    loading: {
      title: 'Wird geladen...',
      subtitle: 'Ihr Arbeitsbereich wird vorbereitet',
    },
    // =========================================================================
    // SIGN-IN PAGE TRANSLATIONS - January 21st, 2026
    // 
    // German translations for authentication pages.
    // Uses formal "Sie" form consistent with the rest of the app.
    // =========================================================================
    signIn: {
      backToHome: 'Zurück zur Startseite',
      title: 'Willkommen zurück',
      subtitle: 'Geben Sie Ihre E-Mail-Adresse ein, um einen Magic Link zu erhalten',
      emailLabel: 'E-Mail-Adresse',
      emailPlaceholder: 'sie@beispiel.de',
      sendMagicLink: 'Magic Link senden',
      sending: 'Wird gesendet...',
      checkEmail: 'Überprüfen Sie Ihre E-Mails',
      magicLinkSent: 'Wir haben einen Magic Link gesendet an',
      clickToSignIn: 'Klicken Sie auf den Link in der E-Mail, um sich anzumelden.',
      checkSpam: 'Nicht gefunden? Überprüfen Sie Ihren Spam-Ordner.',
      useDifferentEmail: 'Andere E-Mail-Adresse verwenden',
      noPasswordNeeded: 'Kein Passwort erforderlich! Wir senden Ihnen einen sicheren Link zum Anmelden.',
      newHere: 'Neu hier?',
      startTrial: 'Kostenlose Testversion starten',
      privacyPolicy: 'Datenschutzrichtlinie',
      termsOfService: 'Nutzungsbedingungen',
      alreadySignedIn: 'Bereits angemeldet, wird weitergeleitet...',
      // OTP (6-stelliger Code) - January 22nd, 2026
      enterCode: 'Code eingeben',
      otpLabel: '6-stelliger Code',
      verifyCode: 'Code bestätigen',
      verifying: 'Wird überprüft...',
      backToMagicLink: '← Zurück zum Magic Link',
      invalidOtp: 'Bitte geben Sie einen gültigen 6-stelligen Code ein',
      otpExpired: 'Code abgelaufen. Bitte fordern Sie einen neuen an.',
      otpInvalid: 'Ungültiger Code. Bitte überprüfen und erneut versuchen.',
      // Error messages
      invalidEmail: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
      authFailed: 'Authentifizierung fehlgeschlagen. Bitte versuchen Sie es erneut.',
      configError: 'Konfigurationsfehler. Bitte kontaktieren Sie den Support.',
      invalidToken: 'Der Magic Link ist abgelaufen. Bitte fordern Sie einen neuen an.',
      accessDenied: 'Zugriff verweigert. Bitte versuchen Sie es erneut.',
      genericError: 'Etwas ist schief gelaufen. Bitte versuchen Sie es erneut.',
    },
    signUp: {
      title: 'Starten Sie Ihre kostenlose Testversion',
      subtitle: 'Geben Sie Ihre E-Mail-Adresse ein — keine Kreditkarte erforderlich',
      clickToCreate: 'Klicken Sie auf den Link in der E-Mail, um Ihr Konto zu erstellen.',
      noPasswordNeeded: 'Kein Passwort erforderlich! Wir senden Ihnen einen sicheren Link zum Starten.',
      alreadyHaveAccount: 'Bereits ein Konto?',
      signIn: 'Anmelden',
    },
  },

  // =========================================================================
  // LOADING ONBOARDING SCREEN - Post-onboarding loading state
  // Added: January 10th, 2026 - Remaining Components
  // =========================================================================
  loadingOnboarding: {
    title: 'Ihr Arbeitsbereich wird eingerichtet!',
    subtitle: 'Einen Moment, während wir Ihr Dashboard vorbereiten...',
    description: 'Ihre Affiliate-Discovery-Tools werden konfiguriert.',
  },

  // =========================================================================
  // =========================================================================
  // FINDING AFFILIATES SCREEN - January 21st, 2026 (Enhanced)
  // 
  // Shows animated progress bar with cycling step messages.
  // Progress animates 0% → 95% over ~2 minutes, then jumps to 100% on complete.
  // =========================================================================
  findingAffiliates: {
    // Step messages that cycle during the search (array for animation)
    steps: [
      'Wir suchen nach Affiliates...',
      'Wettbewerber scannen',
      'Keywords prüfen',
      'Instagram & TikTok scannen',
      'Erste Ergebnisse vorbereiten',
      'Fertig!',
    ],
    // Completion message (shown when API returns)
    complete: 'Fertig!',
    // Elapsed time suffix
    elapsed: 'vergangen',
    // Estimated time note at bottom
    estimatedTime: 'Geschätzte Zeit: ~3 Minuten',
    // Legacy fields kept for backwards compatibility
    thankYou: 'Vielen Dank!',
    preparingDashboard: 'Ihr Dashboard wird vorbereitet...',
    pleaseWait: 'Bitte warten Sie einen Moment',
    title: 'Affiliates werden gesucht',
    subtitle: 'Partner für {brand} werden entdeckt',
    timeEstimate: 'Dies dauert normalerweise 20-30 Sekunden',
  },

  // =========================================================================
  // LANDING PAGE GRAPHICS - Decorative animations in BentoGrid
  // Added: January 10th, 2026 - Remaining Components
  // =========================================================================
  landingGraphics: {
    discovery: {
      scanning: 'Wird gescannt...',
      indexing: 'Indizierung',
      followers: 'Follower',
    },
    verifiedEmail: {
      verified: 'Verifiziert & zustellbar',
      syntax: 'Syntax',
      domain: 'Domain',
      mx: 'MX',
      smtp: 'SMTP',
    },
    pipeline: {
      new: 'Neu',
      outreach: 'Kontakt',
      done: 'Fertig',
    },
  },

  // =========================================================================
  // ERROR BOUNDARY - Error fallback UI
  // Added: January 10th, 2026 - Priority 5: Shared Components
  // =========================================================================
  errorBoundary: {
    title: 'Etwas ist schiefgelaufen',
    message: 'Bitte versuchen Sie es später erneut. Wenn das Problem weiterhin besteht, kontaktieren Sie uns unter',
    contactPrefix: 'support@crewcast.studio',
    tryAgain: 'Erneut versuchen',
  },

  // =========================================================================
  // LEGAL PAGES - Privacy, Terms, Cookies, Security
  // Added: January 10th, 2026 - Priority 6: Static Pages
  // =========================================================================
  legalPages: {
    common: {
      backToHome: 'Zurück zur Startseite',
      lastUpdated: 'Zuletzt aktualisiert:',
      contentComingSoon: 'Inhalt in Kürze verfügbar',
      contactUs: 'Kontakt',
    },
    privacy: {
      title: 'Datenschutzerklärung',
      comingSoonMessage: 'Diese Datenschutzerklärung wird derzeit von unserem Rechtsteam erstellt. Die endgültige Version wird beschreiben, wie wir Ihre personenbezogenen Daten erheben, verwenden und schützen.',
      sections: {
        informationWeCollect: '1. Von uns erhobene Informationen',
        informationWeCollectPlaceholder: '[Platzhalter: Details zu personenbezogenen Daten, Nutzungsdaten, Cookies und Drittanbieter-Integrationen werden hier hinzugefügt.]',
        howWeUseInfo: '2. Wie wir Ihre Informationen verwenden',
        howWeUseInfoPlaceholder: '[Platzhalter: Informationen darüber, wie wir erhobene Daten für die Bereitstellung, Verbesserung und Kommunikation unserer Dienste verwenden, werden hier hinzugefügt.]',
        dataSharing: '3. Datenweitergabe und Offenlegung',
        dataSharingPlaceholder: '[Platzhalter: Details zu Drittanbieterdiensten, rechtlichen Anforderungen und Geschäftsübertragungen werden hier hinzugefügt.]',
        dataSecurity: '4. Datensicherheit',
        dataSecurityPlaceholder: '[Platzhalter: Informationen zu unseren Sicherheitsmaßnahmen, Verschlüsselung und Datenschutzpraktiken werden hier hinzugefügt.]',
        yourRights: '5. Ihre Rechte',
        yourRightsPlaceholder: '[Platzhalter: Details zu DSGVO-Rechten, Datenzugriff, Löschanfragen und Opt-out-Optionen werden hier hinzugefügt.]',
        contactUs: '6. Kontakt',
        contactUsText: 'Wenn Sie Fragen zu dieser Datenschutzerklärung haben, kontaktieren Sie uns bitte unter',
      },
    },
    terms: {
      title: 'Nutzungsbedingungen',
      comingSoonMessage: 'Diese Nutzungsbedingungen werden derzeit von unserem Rechtsteam erstellt. Die endgültige Version wird die Regeln und Richtlinien für die Nutzung von CrewCast Studio detailliert beschreiben.',
      sections: {
        acceptanceOfTerms: '1. Annahme der Bedingungen',
        acceptanceOfTermsPlaceholder: '[Platzhalter: Details zur Zustimmung zu den Bedingungen, Berechtigungsanforderungen und Kontoverantwortlichkeiten werden hier hinzugefügt.]',
        descriptionOfService: '2. Beschreibung des Dienstes',
        descriptionOfServicePlaceholder: '[Platzhalter: Informationen zur CrewCast Studio-Plattform, Funktionen und Dienstverfügbarkeit werden hier hinzugefügt.]',
        userAccounts: '3. Benutzerkonten',
        userAccountsPlaceholder: '[Platzhalter: Details zur Kontoerstellung, Sicherheit und Benutzerverantwortlichkeiten werden hier hinzugefügt.]',
        paymentAndBilling: '4. Zahlung und Abrechnung',
        paymentAndBillingPlaceholder: '[Platzhalter: Informationen zu Abonnementplänen, Preisen, Rückerstattungen und Zahlungsabwicklung werden hier hinzugefügt.]',
        acceptableUse: '5. Akzeptable Nutzung',
        acceptableUsePlaceholder: '[Platzhalter: Richtlinien für die ordnungsgemäße Nutzung der Plattform, verbotene Aktivitäten und Inhaltsbeschränkungen werden hier hinzugefügt.]',
        intellectualProperty: '6. Geistiges Eigentum',
        intellectualPropertyPlaceholder: '[Platzhalter: Details zu Eigentumsrechten, Lizenzen und Schutz des geistigen Eigentums werden hier hinzugefügt.]',
        limitationOfLiability: '7. Haftungsbeschränkung',
        limitationOfLiabilityPlaceholder: '[Platzhalter: Informationen zu Haftungsbeschränkungen, Haftungsausschlüssen und Freistellung werden hier hinzugefügt.]',
        contactUs: '8. Kontakt',
        contactUsText: 'Wenn Sie Fragen zu diesen Bedingungen haben, kontaktieren Sie uns bitte unter',
      },
    },
    cookies: {
      title: 'Cookie-Richtlinie',
      comingSoonMessage: 'Diese Cookie-Richtlinie wird derzeit von unserem Rechtsteam erstellt. Die endgültige Version wird erklären, wie wir Cookies und ähnliche Technologien verwenden.',
      sections: {
        whatAreCookies: '1. Was sind Cookies?',
        whatAreCookiesPlaceholder: '[Platzhalter: Erklärung zu Cookies, wie sie funktionieren und warum Websites sie verwenden, wird hier hinzugefügt.]',
        typesOfCookies: '2. Arten von Cookies, die wir verwenden',
        typesOfCookiesPlaceholder: '[Platzhalter: Details zu essentiellen Cookies, Analyse-Cookies, funktionalen Cookies und Marketing-Cookies werden hier hinzugefügt.]',
        essentialCookies: '3. Essentielle Cookies',
        essentialCookiesPlaceholder: '[Platzhalter: Informationen zu Cookies, die für die ordnungsgemäße Funktion der Website erforderlich sind, werden hier hinzugefügt.]',
        analyticsCookies: '4. Analyse-Cookies',
        analyticsCookiesPlaceholder: '[Platzhalter: Details zu Cookies, die verwendet werden, um zu verstehen, wie Besucher mit unserer Website interagieren, werden hier hinzugefügt.]',
        thirdPartyCookies: '5. Drittanbieter-Cookies',
        thirdPartyCookiesPlaceholder: '[Platzhalter: Informationen zu Cookies, die von Drittanbieterdiensten wie Stripe, Analyseanbietern usw. gesetzt werden, werden hier hinzugefügt.]',
        managingCookies: '6. Cookies verwalten',
        managingCookiesPlaceholder: '[Platzhalter: Anweisungen zum Kontrollieren, Deaktivieren oder Löschen von Cookies über Browsereinstellungen werden hier hinzugefügt.]',
        contactUs: '7. Kontakt',
        contactUsText: 'Wenn Sie Fragen zu unserer Cookie-Richtlinie haben, kontaktieren Sie uns bitte unter',
      },
    },
    security: {
      title: 'Sicherheit',
      subtitle: 'Wie wir Ihre Daten schützen',
      comingSoonMessage: 'Unsere umfassende Sicherheitsdokumentation wird derzeit vorbereitet. Sie wird unsere Sicherheitspraktiken, Zertifizierungen und Datenschutzmaßnahmen detailliert beschreiben.',
      highlights: {
        soc2Title: 'SOC 2-konform',
        soc2Description: 'Unternehmenstaugliche Sicherheitsstandards',
        encryptionTitle: 'Ende-zu-Ende-Verschlüsselung',
        encryptionDescription: 'Alle Daten während der Übertragung und im Ruhezustand verschlüsselt',
        infrastructureTitle: 'Sichere Infrastruktur',
        infrastructureDescription: 'Gehostet auf Vercel & Neon mit 99,9% Verfügbarkeit',
        gdprTitle: 'DSGVO-konform',
        gdprDescription: 'Vollständige Einhaltung des EU-Datenschutzes',
      },
      sections: {
        dataProtection: '1. Datenschutz',
        dataProtectionPlaceholder: '[Platzhalter: Details zu Verschlüsselungsstandards, Datenspeicherungspraktiken und Zugriffskontrollen werden hier hinzugefügt.]',
        authentication: '2. Authentifizierung & Zugriff',
        authenticationPlaceholder: '[Platzhalter: Informationen zur sicheren Authentifizierung, Sitzungsverwaltung und rollenbasiertem Zugriff werden hier hinzugefügt.]',
        paymentSecurity: '3. Zahlungssicherheit',
        paymentSecurityPlaceholder: '[Platzhalter: Details zur PCI-DSS-Konformität, Stripe-Integration und zum Umgang mit Zahlungsdaten werden hier hinzugefügt.]',
        infrastructureSecurity: '4. Infrastruktursicherheit',
        infrastructureSecurityPlaceholder: '[Platzhalter: Informationen zu unseren Hosting-Anbietern, Netzwerksicherheit und Überwachungssystemen werden hier hinzugefügt.]',
        vulnerabilityManagement: '5. Schwachstellenmanagement',
        vulnerabilityManagementPlaceholder: '[Platzhalter: Details zu Sicherheitstests, Bug-Bounty-Programmen und Reaktion auf Vorfälle werden hier hinzugefügt.]',
        reportVulnerability: '6. Schwachstelle melden',
        reportVulnerabilityText: 'Wenn Sie eine Sicherheitslücke entdecken, melden Sie diese bitte verantwortungsvoll an',
      },
    },
  },

  // =========================================================================
  // AFFILIATE ROW - Shared component for displaying affiliate results
  // Added: January 10th, 2026 - Priority 5: Shared Components
  // =========================================================================
  affiliateRow: {
    badges: {
      new: 'NEU',
      saved: 'GESPEICHERT',
      discovered: 'Entdeckt',
    },
    metrics: {
      followers: 'Follower',
      subscribers: 'Abonnenten',
      views: 'Aufrufe',
      likes: 'Likes',
      comments: 'Kommentare',
      visitsPerMonth: 'Besuche/Mo.',
      loading: 'Wird geladen...',
    },
    discovery: {
      keywordLabel: 'Keyword:',
      rankFor: 'für',
      more: 'weitere',
    },
    actions: {
      confirm: 'Bestätigen?',
      findEmail: 'E-Mail finden',
      found: 'Gefunden',
      notFound: '0 Gefunden',
      retry: 'Erneut',
      save: 'Speichern',
      saved: 'Gespeichert',
      saving: 'Wird gespeichert...',
      saveToPipeline: 'In Pipeline speichern',
      delete: 'Löschen',
      view: 'Ansehen',
    },
    contentModal: {
      title: 'Relevanter Inhalt',
      articles: 'Artikel',
      ranking: 'Ranking:',
      keyword: 'Keyword:',
      discoveredVia: 'Entdeckt über',
    },
    emailModal: {
      title: 'E-Mail-Ergebnisse',
      found: 'Gefunden',
      emailAddresses: 'E-Mail-Adressen',
      noEmailsFound: 'Keine E-Mails gefunden',
      trySearchingAgain: 'Versuchen Sie es erneut',
      email: 'E-Mail',
      emails: 'E-Mails',
      copy: 'Kopieren',
      done: 'Fertig!',
    },
    viewModal: {
      title: 'Details anzeigen',
      visitChannel: 'Kanal besuchen',
      visitAccount: 'Profil besuchen',
      visitWebsite: 'Website besuchen',
      youtube: {
        subscribers: 'Abonnenten',
        relevantVideos: 'Relevante Videos',
      },
      instagram: {
        followers: 'Follower',
        relevantPosts: 'Relevante Beiträge',
      },
      tiktok: {
        followers: 'Follower',
        relevantPosts: 'Relevante Beiträge',
      },
      web: {
        trafficPerMonth: 'Traffic/Mo.',
        about: 'Über',
        trafficMetrics: 'Traffic- & Engagement-Metriken',
        ranking: 'Ranking',
        global: 'Global',
        category: 'Kategorie',
        userEngagement: 'Nutzer-Engagement',
        pagesPerVisit: 'Seiten/Besuch',
        timeOnSite: 'Verweildauer',
        bounceRate: 'Absprungrate',
        trafficSources: 'Traffic-Quellen',
        search: 'Suche',
        direct: 'Direkt',
        referrals: 'Verweise',
        social: 'Social',
        paid: 'Bezahlt',
        mail: 'E-Mail',
        noTrafficData: 'Keine Traffic-Daten',
        noTrafficDataDesc: 'Traffic-Daten werden während der Suche abgerufen',
        relevantContent: 'Relevanter Inhalt',
      },
    },
  },

  // =========================================================================
  // AFFILIATE CARD - Card component for displaying affiliate summary
  // Added: January 10th, 2026 - Priority 5: Shared Components
  // =========================================================================
  affiliateCard: {
    totalFollowers: 'Follower gesamt',
    engagementRate: 'Engagement-Rate',
    recentGrowth: 'Aktuelles Wachstum',
    addProfile: 'Profil hinzufügen',
  },

  // =========================================================================
  // FILTER PANEL - Advanced filtering for affiliates
  // Added: January 10th, 2026 - Priority 5: Shared Components
  // =========================================================================
  filterPanel: {
    competitors: 'Wettbewerber',
    topics: 'Themen',
    followers: 'Follower',
    date: 'Datum',
    posts: 'Beiträge',
    noCompetitorsFound: 'Keine Wettbewerber gefunden',
    noTopicsFound: 'Keine Themen gefunden',
    noOptionsAvailable: 'Keine Optionen verfügbar',
    showLess: '− Weniger anzeigen',
    more: 'weitere',
    clearAll: 'Alle löschen',
    clear: '× Löschen',
    days7: '7 Tage',
    days30: '30 Tage',
    days90: '90 Tage',
    year1: '1 Jahr',
  },

  // =========================================================================
  // SCAN COUNTDOWN - Auto-scan countdown timer in dashboard header
  // Added: January 13th, 2026 - Auto-scan feature
  // =========================================================================
  scanCountdown: {
    upgradeToUnlock: 'Upgrade um Auto-Scan freizuschalten',
    noCredits: 'Keine Credits',
    noCreditsTooltip: 'Keine Credits verfügbar. Upgrade für mehr.',
    scanning: 'Scanne...',
    scanningTooltip: 'Auto-Scan läuft...',
    nextScanAt: 'Nächster Scan um',
  },

  // =========================================================================
  // PRICING MODAL - Plan selection and subscription management
  // Added: January 10th, 2026 - Priority 5: Shared Components
  // =========================================================================
  pricingModal: {
    manageYourPlan: 'Plan verwalten',
    superchargeYour: 'Beschleunigen Sie Ihr',
    affiliateGrowth: 'Affiliate-Wachstum',
    manageSubtitle: 'Upgraden Sie, um mehr Funktionen freizuschalten, oder passen Sie Ihre Abrechnungseinstellungen an.',
    newSubtitle: 'Verschwenden Sie keine Stunden mit manueller Suche. Erhalten Sie sofortigen Zugang zu Tausenden von leistungsstarken Affiliates, die auf Ihre Nische zugeschnitten sind.',
    currentPlan: 'Aktueller Plan',
    trial: 'Testversion',
    monthly: 'Monatlich',
    annual: 'Jährlich',
    save20: '20% sparen',
    perMonth: '/Mo.',
    billedYearly: 'Jährlich abgerechnet',
    custom: 'Individuell',
    whatsIncluded: 'Enthalten:',
    bestValue: 'Bester Wert',
    contactSales: 'Vertrieb kontaktieren',
    buyNow: 'Jetzt kaufen',
    upgradeNow: 'Jetzt upgraden',
    switchPlan: 'Plan wechseln',
    switchToAnnual: 'Zu jährlich wechseln',
    switchToMonthly: 'Zu monatlich wechseln',
    getStarted: 'Jetzt starten',
    trialTitle: 'Sie sind derzeit in einer Testversion',
    trialMessage: 'Möchten Sie Ihre Testversion jetzt beenden und die Abrechnung sofort starten, oder Ihre Testversion behalten und nur den Plan ändern?',
    keepTrialChangePlan: 'Testversion behalten, Plan ändern',
    endTrialStartBilling: 'Testversion beenden & Abrechnung starten',
    immediateUpgrade: '⬆️ Sofortiges Upgrade mit anteiliger Berechnung',
    takesEffectNextCycle: '⬇️ Wirksam zum nächsten Abrechnungszeitraum',
    billingChangeProration: '🔄 Abrechnungsänderung mit anteiliger Berechnung',
    securePayment: 'Sichere SSL-Zahlung',
    cancelAnytime: 'Jederzeit kündbar',
    upgradeDowngradeNote: 'Upgrades werden sofort wirksam. Downgrades werden am Ende des aktuellen Abrechnungszeitraums wirksam.',
    signInRequired: 'Bitte melden Sie sich an, um Ihren Plan zu ändern.',
  },
};

