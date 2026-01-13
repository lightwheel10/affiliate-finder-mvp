/**
 * =============================================================================
 * DICTIONARY TYPE DEFINITIONS - i18n Infrastructure
 * =============================================================================
 *
 * Created: January 9th, 2026
 *
 * This file defines the TypeScript types for the translation dictionary.
 * All translations must conform to this structure to ensure type-safety
 * across the application.
 *
 * ARCHITECTURE DECISION (January 9th, 2026):
 * ------------------------------------------
 * We chose Option 2 (Same URL + Language Toggle) over sub-path routing because:
 *   1. This is a SaaS dashboard - most pages are behind login (no SEO needed)
 *   2. Simpler implementation without route restructuring
 *   3. Language is stored in localStorage and auto-detected from browser
 *
 * HOW TO USE:
 * -----------
 * 1. Import the useLanguage hook:
 *    import { useLanguage } from '@/contexts/LanguageContext';
 *
 * 2. Use in component:
 *    const { t } = useLanguage();
 *    <h1>{t.landing.hero.title}</h1>
 *
 * 3. To add new strings:
 *    - Add the key/type here first
 *    - Add English translation in en.ts
 *    - Add German translation in de.ts
 *
 * SUPPORTED LANGUAGES:
 * --------------------
 * - English (en) - Default
 * - German (de) - Uses formal "Sie" form
 *
 * =============================================================================
 */

/**
 * Supported language codes
 */
export type Language = 'en' | 'de';

/**
 * Default language for the application
 */
export const DEFAULT_LANGUAGE: Language = 'en';

/**
 * Available languages with display names
 */
export const AVAILABLE_LANGUAGES: { code: Language; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
];

/**
 * Main dictionary interface - all translations must conform to this structure
 */
export interface Dictionary {
  // =========================================================================
  // COMMON - Shared strings across the app
  // =========================================================================
  common: {
    loading: string;
    error: string;
    success: string;
    cancel: string;
    save: string;
    delete: string;
    remove: string;
    back: string;
    next: string;
    continue: string;
    skip: string;
    close: string;
    confirm: string;
    edit: string;
    update: string;
    add: string;
    search: string;
    filter: string;
    clear: string;
    clearAll: string;
    selectAll: string;
    deselectAll: string;
    selected: string;
    retry: string;
    refresh: string;
    copy: string;
    copied: string;
    view: string;
    download: string;
    upload: string;
    yes: string;
    no: string;
    or: string;
    and: string;
    of: string;
    to: string;
    from: string;
    all: string;
    none: string;
    days: string;
    day: string;
    hours: string;
    hour: string;
    minutes: string;
    minute: string;
  };

  // =========================================================================
  // NAVIGATION - Nav links and menu items
  // =========================================================================
  nav: {
    login: string;
    logout: string;
    signup: string;
    startFreeTrial: string;
    features: string;
    howItWorks: string;
    pricing: string;
    settings: string;
    // Sidebar navigation
    discovery: string;
    findNew: string;
    allDiscovered: string;
    management: string;
    savedAffiliates: string;
    outreach: string;
    businessPlan: string;
    activeSubscription: string;
    managePlan: string;
    upgradePlan: string;
  };

  // =========================================================================
  // LANDING PAGE - Public marketing page
  // =========================================================================
  landing: {
    hero: {
      badge: string;
      title: string;
      titleHighlight: string;
      subtitle: string;
      ctaPrimary: string;
      ctaSecondary: string;
      socialProof: string;
    };
    trustedBy: string;
    features: {
      sectionTitle: string;
      sectionSubtitle: string;
      mainFeature: {
        title: string;
        description: string;
        badge1: string;
        badge2: string;
      };
      feature2: {
        title: string;
        description: string;
      };
      feature3: {
        title: string;
        description: string;
      };
    };
    howItWorks: {
      sectionTitle: string;
      sectionSubtitle: string;
      step1: {
        number: string;
        title: string;
        description: string;
        overlayTitle: string;
        overlaySubtitle: string;
        bullets: string[];
      };
      step2: {
        number: string;
        title: string;
        description: string;
        overlayTitle: string;
        overlaySubtitle: string;
        bullets: string[];
      };
      step3: {
        number: string;
        title: string;
        description: string;
        overlayTitle: string;
        overlaySubtitle: string;
        bullets: string[];
      };
    };
    pricing: {
      badge: string;
      sectionTitle: string;
      sectionSubtitle: string;
      mostPopular: string;
      perMonth: string;
      pro: {
        name: string;
        description: string;
        price: string;
        cta: string;
        features: string[];
      };
      growth: {
        name: string;
        description: string;
        price: string;
        cta: string;
        features: string[];
      };
      enterprise: {
        name: string;
        description: string;
        price: string;
        cta: string;
        features: string[];
      };
      trustNote: string;
    };
    cta: {
      title: string;
      subtitle: string;
      ctaPrimary: string;
      ctaSecondary: string;
      trustNote: string;
    };
    footer: {
      brandDescription: string;
      product: string;
      legal: string;
      privacyPolicy: string;
      termsOfService: string;
      cookiePolicy: string;
      security: string;
      copyright: string;
      madeBy: string;
      systemStatus: string;
    };
    // Demo component strings (January 9th, 2026)
    demo: {
      searchPlaceholder: string;
      scoutButton: string;
      scanning: string;
      analyzing: string;
      emptyState: string;
      emailFound: string;
      noEmail: string;
      resultsVisible: string;
      searchTime: string;
      analysisComplete: string;
    };
  };

  // =========================================================================
  // ONBOARDING - New user setup flow (Updated January 9th, 2026)
  // Restructured to match actual OnboardingScreen.tsx component
  // =========================================================================
  onboarding: {
    // Common strings used across onboarding steps
    common: {
      search: string;
      noResults: string;
    };
    // Step 1: Name, Role, Brand (combined step)
    step1: {
      header: string;          // "Thanks for joining CrewCast Studio"
      title: string;           // "Let's get to know each other"
      nameLabel: string;
      namePlaceholder: string;
      roleLabel: string;
      rolePlaceholder: string;
      roles: {
        brandOwner: string;
        affiliateManager: string;
        agencyOwner: string;
        freelancer: string;
        contentCreator: string;
        other: string;
      };
      brandLabel: string;
      brandPlaceholder: string;
      helpText: string;        // "For agencies, this should be your client's website..."
      // Validation messages
      validation: {
        invalidFormat: string; // "Enter a valid domain format (e.g., example.com)"
        domainNotReachable: string;
        failedToValidate: string;
      };
    };
    // Step 2: Target Market (Country + Language)
    step2: {
      title: string;           // "Target market"
      countryLabel: string;
      countryPlaceholder: string;
      languageLabel: string;
      languagePlaceholder: string;
    };
    // Step 3: Competitors
    step3: {
      title: string;           // "Add your top 5 competitors"
      inputPlaceholder: string;
      count: string;           // "{count}/5 added"
      suggestionsTitle: string;
      yourCompetitors: string;
      emptyState: string;
    };
    // Step 4: Topics
    step4: {
      title: string;           // "What topics do you cover?"
      inputPlaceholder: string;
      count: string;           // "{count}/10 added"
      suggestionsTitle: string;
      yourTopics: string;
      emptyState: string;
    };
    // Step 5: Pricing / Plan Selection (displayed as Step 6 in UI but comes before affiliate types display)
    step5: {
      title: string;           // "Choose your plan"
      trialInfo: string;       // "Start with a 3-day free trial • Cancel anytime"
      monthly: string;
      annual: string;
      discountBadge: string;   // "-20%"
      bestValue: string;
      perMonth: string;        // "/mo"
      billedAnnually: string;  // "Billed {amount}/yr"
      contactSales: string;
      selected: string;
      selectPlan: string;
      included: string;
    };
    // Step 6: Affiliate Types (displayed as Step 5 in UI)
    step6: {
      title: string;           // "What types of affiliates do you want?"
      types: {
        publishersBloggers: string;
        instagram: string;
        tiktok: string;
        xTwitter: string;      // "X (Twitter)"
        linkedin: string;
        reddit: string;
        youtube: string;
        other: string;
      };
    };
    // Step 7: Payment / Card Details (Step7CardForm)
    step7: {
      secureCheckout: string;
      title: string;
      subtitle: string;
      selectedPlan: string;
      perMonth: string;
      billedAnnually: string;
      firstCharge: string;
      discountLabel: string;
      discountPlaceholder: string;
      apply: string;
      applied: string;
      processing: string;
      startTrial: string;
      discountApplied: string;
      cardholderName: string;
      cardDetails: string;
      nameOnCard: string;
    };
    // Analyzing Screen (between step 1 and 2)
    analyzing: {
      title: string;
      titleError: string;
      gettingInsightsFor: string;
      errorTitle: string;
      continueManually: string;
      timeEstimate: string;
      steps: {
        step1Label: string;
        step1Desc: string;
        step2Label: string;
        step2Desc: string;
        step3Label: string;
        step3Desc: string;
      };
    };
    // Navigation buttons
    navigation: {
      gettingStarted: string;  // "Getting Started"
      stepOf: string;          // "Step {current} of {total}"
      continue: string;
      next: string;
      choosePlan: string;
      continueToPayment: string;
      contactSales: string;
      validatingDomain: string;
    };
  };

  // =========================================================================
  // DASHBOARD - Authenticated pages
  // =========================================================================
  dashboard: {
    // Common dashboard elements
    header: {
      nextScan: string;
      pro: string;
      findAffiliates: string;
    };
    credits: {
      topicSearches: string;      // Full label: "Topic Searches"
      topicSearchesShort: string; // Short label: "Search" (January 9th, 2026)
      emailCredits: string;       // Full label: "Email Credits"
      emailCreditsShort: string;  // Short label: "Email" (January 9th, 2026)
      aiCredits: string;          // Full label: "AI Credits"
      aiCreditsShort: string;     // Short label: "AI" (January 9th, 2026)
      topic: string;              // For neo variant suffix (January 9th, 2026)
    };
    filters: {
      searchPlaceholder: string;
      all: string;
      web: string;
      youtube: string;
      instagram: string;
      tiktok: string;
    };
    table: {
      affiliate: string;
      relevantContent: string;
      discoveryMethod: string;
      date: string;
      status: string;
      email: string;
      message: string;
      action: string;
    };
    // Find New page
    find: {
      pageTitle: string;
      emptyState: {
        title: string;
        subtitle: string;
      };
      loading: {
        scanning: string;
        subtitle: string;
        badge: string;
      };
      modal: {
        title: string;
        subtitle: string;
        keywordsLabel: string;
        keywordsPlaceholder: string;
        addButton: string;
        websiteLabel: string;
        competitorsLabel: string;
        competitorsAdded: string;
        noCompetitors: string;
        notSetDuringOnboarding: string;
        clearAllKeywords: string;
        noKeywordsYet: string;
        ctaButton: string;
        searching: string;
        tip: string;
      };
      bulkActions: {
        selected: string;
        selectAllVisible: string;
        deselectAll: string;
        alreadyInPipeline: string;
        deleteSelected: string;
        saveToPipeline: string;
        allAlreadySaved: string;
      };
      newSearchWarning: {
        title: string;
        subtitle: string;
      };
      creditError: {
        title: string;
        message: string;
        upgradeHint: string;
      };
      noResults: string;
    };
    // Pagination - Added January 9th, 2026 for i18n
    pagination: {
      showing: string;
      toOf: string; // "to X of"
      affiliates: string;
      previous: string;
      next: string;
      perPage: string;
    };
    // Discovered page
    discovered: {
      pageTitle: string;
      emptyState: {
        title: string;
        subtitle: string;
      };
    };
    // Saved (Pipeline) page
    saved: {
      pageTitle: string;
      emptyState: {
        title: string;
        subtitle: string;
      };
      bulkActions: {
        findEmails: string;
        emailProgress: string;
      };
      emailStatus: {
        found: string;
        notFound: string;
        searching: string;
        none: string;
      };
      // Toast notification helpers (January 10th, 2026)
      savedCount: string;     // "Saved {count}"
      deletedCount: string;   // "Deleted {count}"
      emailResults: {
        found: string;
        errors: string;
      };
    };
    // Outreach page
    outreach: {
      pageTitle: string;
      emptyState: {
        title: string;
        subtitle: string;
      };
      noResults: {
        title: string;
        subtitle: string;
      };
      generate: string;
      generating: string;
      viewMessage: string;
      messages: string;
      failed: string;
      retry: string;
      selectContacts: string;
      contacts: string;
      bulkGenerate: string;
      contactPicker: {
        title: string;
        subtitle: string;
        creditsUsed: string;
        credit: string;
        credits: string;
        selectContacts: string;
        alreadyGenerated: string;
      };
      messageViewer: {
        title: string;
        to: string;
        affiliateDetails: string;
        contactName: string;
        platform: string;
        keyword: string;
        redo: string;
        copy: string;
        done: string;
      };
      // Additional strings for toast notifications (January 10th, 2026)
      email: string;
      emails: string;
      failedRetry: string;
    };
    // Settings page
    settings: {
      pageTitle: string;
      tabs: {
        profile: {
          label: string;
          description: string;
        };
        plan: {
          label: string;
          description: string;
        };
        notifications: {
          label: string;
          description: string;
        };
        security: {
          label: string;
          description: string;
        };
      };
      profile: {
        photoTitle: string;
        photoDescription: string;
        fullName: string;
        emailAddress: string;
        editProfile: string;
      };
      plan: {
        currentPlan: string;
        freeTrial: string;
        pro: string;
        growth: string;
        enterprise: string;
        active: string;
        trial: string;
        cancelled: string;
        daysLeft: string;
        trialEndsToday: string;
        nextBilling: string;
        billedAnnually: string;
        choosePlan: string;
        upgradePlan: string;
        managePlan: string;
        trialEndingSoon: {
          title: string;
          subtitle: string;
        };
        paymentMethod: string;
        noPaymentMethod: {
          title: string;
          trialSubtitle: string;
          defaultSubtitle: string;
        };
        addPaymentMethod: string;
        updatePaymentMethod: string;
        expires: string;
        invoiceHistory: string;
        loadingInvoices: string;
        noInvoicesYet: {
          title: string;
          subtitle: string;
        };
        invoiceColumns: {
          invoice: string;
          date: string;
          amount: string;
          status: string;
          actions: string;
        };
        invoiceStatus: {
          paid: string;
          open: string;
          draft: string;
          void: string;
          uncollectible: string;
        };
        cancelSubscription: {
          title: string;
          subtitle: string;
          button: string;
        };
        cancelModal: {
          cancelTitle: string;
          resumeTitle: string;
          cancelWarning: string;
          cancelMessage: string;
          resumeMessage: string;
          keepSubscription: string;
          keepCanceled: string;
          confirmCancel: string;
          confirmResume: string;
        };
        cancellationPending: {
          title: string;
          subtitle: string;
          resumeButton: string;
        };
      };
      notifications: {
        emailNotifications: string;
        appNotifications: string;
        options: {
          newMatches: {
            label: string;
            description: string;
          };
          weeklyReport: {
            label: string;
            description: string;
          };
          productUpdates: {
            label: string;
            description: string;
          };
          successfulReplies: {
            label: string;
            description: string;
          };
          taskReminders: {
            label: string;
            description: string;
          };
        };
      };
      security: {
        passwordSecurity: string;
        manageSecuritySettings: string;
        dangerZone: string;
        dangerZoneWarning: string;
        deleteAccount: string;
      };
    };
  };

  // =========================================================================
  // SIDEBAR - Navigation sidebar
  // =========================================================================
  sidebar: {
    brand: string;
    tagline: string;
    planCard: {
      planSuffix: string;
      daysLeft: string;
      activeSubscription: string;
      upgradeAvailable: string;
      managePlan: string;
      upgradePlan: string;
    };
    profile: {
      settings: string;
      logout: string;
    };
    logoutModal: {
      title: string;
      message: string;
      cancel: string;
      confirm: string;
    };
  };

  // =========================================================================
  // MODALS - Various modal dialogs
  // =========================================================================
  modals: {
    confirmDelete: {
      title: string;
      message: string;
      deleteButton: string;
      deleting: string;
      deleteCount: string;
      willBeDeleted: string;
      affiliates: string;
      affiliate: string;
      cancel: string;
    };
    addCard: {
      title: string;
      subtitle: string;
      saveButton: string;
      saving: string;
      discountLabel: string;
      discountPlaceholder: string;
      apply: string;
      applied: string;
      discountComingSoon: string;
      failedToValidate: string;
      discountApplied: string;
      completeCardDetails: string;
      securityNote: string;
      processing: string;
    };
  };

  // =========================================================================
  // TOASTS - Notification messages
  // =========================================================================
  // =========================================================================
  // TOASTS - Notification messages
  // Updated: January 10th, 2026 - Phase 3: Toast Notifications
  // =========================================================================
  toasts: {
    success: {
      emailGenerated: string;
      messageCopied: string;
      affiliatesSaved: string;           // "Saved {count} affiliate(s) to pipeline!"
      affiliatesSavedWithDuplicates: string; // "Saved {count} affiliate(s)! ({duplicates} already in pipeline)"
      affiliatesDeleted: string;         // "Deleted {count} affiliate(s)"
      affiliatesDeletedFromPipeline: string; // "Deleted {count} affiliate(s) from pipeline"
      emailsFound: string;               // "Found {count} email(s)!"
      bulkEmailsGenerated: string;       // "Successfully generated {count} email(s)!"
      csvExported: string;               // "CSV exported successfully!"
      planChanged: string;
      cardAdded: string;
      subscriptionCancelled: string;
      subscriptionResumed: string;
    };
    error: {
      genericError: string;
      searchFailed: string;
      saveFailed: string;
      deleteFailed: string;
      emailLookupFailed: string;
      emailLookupFailedCount: string;    // "Email lookup failed for {count} affiliate(s)"
      aiGenerationFailed: string;
      aiServiceNotConfigured: string;
      aiConnectionFailed: string;
      bulkGenerationFailed: string;      // "Failed to generate {failed} of {total} emails"
      exportFailed: string;
      paymentFailed: string;
    };
    warning: {
      insufficientCredits: string;       // Search credits
      insufficientAICredits: string;     // AI credits
      insufficientEmailCredits: string;  // Email credits
      noEmailsFound: string;             // "No emails found for {count} affiliate(s)"
      partialBulkFailure: string;        // "Failed to generate {failed} of {total} emails"
      invalidThreshold: string;          // Admin: "Please enter a valid threshold amount"
      trialEnding: string;
      allAlreadyHaveEmails: string;
    };
    info: {
      allAlreadyInPipeline: string;      // "All {count} affiliates are already in your pipeline"
      allAlreadyHaveEmails: string;      // "All selected affiliates already have emails"
      mixedEmailResults: string;         // "Found {found}, not found {notFound}, errors {errors}"
      mixedResults: string;
      noEmailsFound: string;
    };
  };

  // =========================================================================
  // AUTH - Authentication pages
  // =========================================================================
  auth: {
    loading: {
      title: string;
      subtitle: string;
    };
  };

  // =========================================================================
  // LOADING ONBOARDING SCREEN - Post-onboarding loading state
  // Added: January 10th, 2026 - Remaining Components
  // =========================================================================
  loadingOnboarding: {
    title: string;
    subtitle: string;
    description: string;
  };

  // =========================================================================
  // LANDING PAGE GRAPHICS - Decorative animations in BentoGrid
  // Added: January 10th, 2026 - Remaining Components
  // =========================================================================
  landingGraphics: {
    discovery: {
      scanning: string;
      indexing: string;
      followers: string;
    };
    verifiedEmail: {
      verified: string;
      syntax: string;
      domain: string;
      mx: string;
      smtp: string;
    };
    pipeline: {
      new: string;
      outreach: string;
      done: string;
    };
  };

  // =========================================================================
  // ERROR BOUNDARY - Error fallback UI
  // Added: January 10th, 2026 - Priority 5: Shared Components
  // =========================================================================
  errorBoundary: {
    title: string;
    message: string;
    contactPrefix: string;
    tryAgain: string;
  };

  // =========================================================================
  // LEGAL PAGES - Privacy, Terms, Cookies, Security
  // Added: January 10th, 2026 - Priority 6: Static Pages
  // =========================================================================
  legalPages: {
    // Shared strings across all legal pages
    common: {
      backToHome: string;
      lastUpdated: string;
      contentComingSoon: string;
      contactUs: string;
    };
    // Privacy Policy page
    privacy: {
      title: string;
      comingSoonMessage: string;
      sections: {
        informationWeCollect: string;
        informationWeCollectPlaceholder: string;
        howWeUseInfo: string;
        howWeUseInfoPlaceholder: string;
        dataSharing: string;
        dataSharingPlaceholder: string;
        dataSecurity: string;
        dataSecurityPlaceholder: string;
        yourRights: string;
        yourRightsPlaceholder: string;
        contactUs: string;
        contactUsText: string;
      };
    };
    // Terms of Service page
    terms: {
      title: string;
      comingSoonMessage: string;
      sections: {
        acceptanceOfTerms: string;
        acceptanceOfTermsPlaceholder: string;
        descriptionOfService: string;
        descriptionOfServicePlaceholder: string;
        userAccounts: string;
        userAccountsPlaceholder: string;
        paymentAndBilling: string;
        paymentAndBillingPlaceholder: string;
        acceptableUse: string;
        acceptableUsePlaceholder: string;
        intellectualProperty: string;
        intellectualPropertyPlaceholder: string;
        limitationOfLiability: string;
        limitationOfLiabilityPlaceholder: string;
        contactUs: string;
        contactUsText: string;
      };
    };
    // Cookie Policy page
    cookies: {
      title: string;
      comingSoonMessage: string;
      sections: {
        whatAreCookies: string;
        whatAreCookiesPlaceholder: string;
        typesOfCookies: string;
        typesOfCookiesPlaceholder: string;
        essentialCookies: string;
        essentialCookiesPlaceholder: string;
        analyticsCookies: string;
        analyticsCookiesPlaceholder: string;
        thirdPartyCookies: string;
        thirdPartyCookiesPlaceholder: string;
        managingCookies: string;
        managingCookiesPlaceholder: string;
        contactUs: string;
        contactUsText: string;
      };
    };
    // Security page
    security: {
      title: string;
      subtitle: string;
      comingSoonMessage: string;
      highlights: {
        soc2Title: string;
        soc2Description: string;
        encryptionTitle: string;
        encryptionDescription: string;
        infrastructureTitle: string;
        infrastructureDescription: string;
        gdprTitle: string;
        gdprDescription: string;
      };
      sections: {
        dataProtection: string;
        dataProtectionPlaceholder: string;
        authentication: string;
        authenticationPlaceholder: string;
        paymentSecurity: string;
        paymentSecurityPlaceholder: string;
        infrastructureSecurity: string;
        infrastructureSecurityPlaceholder: string;
        vulnerabilityManagement: string;
        vulnerabilityManagementPlaceholder: string;
        reportVulnerability: string;
        reportVulnerabilityText: string;
      };
    };
  };

  // =========================================================================
  // AFFILIATE ROW - Shared component for displaying affiliate results
  // Added: January 10th, 2026 - Priority 5: Shared Components
  // =========================================================================
  affiliateRow: {
    // Status badges
    badges: {
      new: string;
      saved: string;
      discovered: string;
    };
    // Metrics labels
    metrics: {
      followers: string;
      subscribers: string;
      views: string;
      likes: string;
      comments: string;
      visitsPerMonth: string;
      loading: string;
    };
    // Discovery method
    discovery: {
      keywordLabel: string;
      rankFor: string;
      more: string;
    };
    // Action buttons
    actions: {
      confirm: string;
      findEmail: string;
      found: string;
      notFound: string;
      retry: string;
      save: string;
      saved: string;
      saving: string;
      saveToPipeline: string;
      delete: string;
      view: string;
    };
    // Relevant content modal
    contentModal: {
      title: string;
      articles: string;
      ranking: string;
      keyword: string;
      discoveredVia: string;
    };
    // Email results modal
    emailModal: {
      title: string;
      found: string;
      emailAddresses: string;
      noEmailsFound: string;
      trySearchingAgain: string;
      email: string;
      emails: string;
      copy: string;
      done: string;
    };
    // View details modal
    viewModal: {
      title: string;
      visitChannel: string;
      visitAccount: string;
      visitWebsite: string;
      // YouTube specific
      youtube: {
        subscribers: string;
        relevantVideos: string;
      };
      // Instagram specific
      instagram: {
        followers: string;
        relevantPosts: string;
      };
      // TikTok specific
      tiktok: {
        followers: string;
        relevantPosts: string;
      };
      // Web/SimilarWeb specific
      web: {
        trafficPerMonth: string;
        about: string;
        trafficMetrics: string;
        ranking: string;
        global: string;
        category: string;
        userEngagement: string;
        pagesPerVisit: string;
        timeOnSite: string;
        bounceRate: string;
        trafficSources: string;
        search: string;
        direct: string;
        referrals: string;
        social: string;
        paid: string;
        mail: string;
        noTrafficData: string;
        noTrafficDataDesc: string;
        relevantContent: string;
      };
    };
  };

  // =========================================================================
  // AFFILIATE CARD - Card component for displaying affiliate summary
  // Added: January 10th, 2026 - Priority 5: Shared Components
  // =========================================================================
  affiliateCard: {
    totalFollowers: string;
    engagementRate: string;
    recentGrowth: string;
    addProfile: string;
  };

  // =========================================================================
  // FILTER PANEL - Advanced filtering for affiliates
  // Added: January 10th, 2026 - Priority 5: Shared Components
  // =========================================================================
  filterPanel: {
    competitors: string;
    topics: string;
    followers: string;
    date: string;
    posts: string;
    noCompetitorsFound: string;
    noTopicsFound: string;
    noOptionsAvailable: string;
    showLess: string;
    more: string;
    clearAll: string;
    clear: string;
    // Date presets
    days7: string;
    days30: string;
    days90: string;
    year1: string;
  };

  // =========================================================================
  // SCAN COUNTDOWN - Auto-scan countdown timer in dashboard header
  // Added: January 13th, 2026 - Auto-scan feature
  // =========================================================================
  scanCountdown: {
    upgradeToUnlock: string;      // Tooltip for locked state
    noCredits: string;            // Display text when no credits
    noCreditsTooltip: string;     // Tooltip for no credits state
    scanning: string;             // Display text when scan is in progress
    scanningTooltip: string;      // Tooltip for scanning state
    nextScanAt: string;           // Prefix for next scan date tooltip
  };

  // =========================================================================
  // PRICING MODAL - Plan selection and subscription management
  // Added: January 10th, 2026 - Priority 5: Shared Components
  // =========================================================================
  pricingModal: {
    manageYourPlan: string;
    superchargeYour: string;
    affiliateGrowth: string;
    manageSubtitle: string;
    newSubtitle: string;
    currentPlan: string;
    trial: string;
    monthly: string;
    annual: string;
    save20: string;
    perMonth: string;
    billedYearly: string;
    custom: string;
    whatsIncluded: string;
    bestValue: string;
    // Button text
    contactSales: string;
    buyNow: string;
    upgradeNow: string;
    switchPlan: string;
    switchToAnnual: string;
    switchToMonthly: string;
    getStarted: string;
    // Trial options
    trialTitle: string;
    trialMessage: string;
    keepTrialChangePlan: string;
    endTrialStartBilling: string;
    // Change type indicators
    immediateUpgrade: string;
    takesEffectNextCycle: string;
    billingChangeProration: string;
    // Footer
    securePayment: string;
    cancelAnytime: string;
    upgradeDowngradeNote: string;
    signInRequired: string;
  };
}

