/**
 * =============================================================================
 * ENGLISH DICTIONARY - i18n Translations
 * =============================================================================
 *
 * Created: January 9th, 2026
 *
 * This file contains all English (en) translations for the CrewCast Studio app.
 * English is the default language.
 *
 * ADDING NEW TRANSLATIONS:
 * ------------------------
 * 1. Add the type definition in index.ts first
 * 2. Add the English translation here
 * 3. Add the German translation in de.ts
 *
 * STYLE GUIDE:
 * ------------
 * - Use sentence case for most strings
 * - Use Title Case for headings and buttons
 * - Keep strings short and action-oriented
 * - Avoid jargon where possible
 *
 * =============================================================================
 */

import { Dictionary } from './index';

export const en: Dictionary = {
  // =========================================================================
  // COMMON
  // =========================================================================
  common: {
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    remove: 'Remove',
    back: 'Back',
    next: 'Next',
    continue: 'Continue',
    skip: 'Skip',
    close: 'Close',
    confirm: 'Confirm',
    edit: 'Edit',
    update: 'Update',
    add: 'Add',
    search: 'Search',
    filter: 'Filter',
    clear: 'Clear',
    clearAll: 'Clear All',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    selected: 'selected',
    retry: 'Retry',
    refresh: 'Refresh',
    copy: 'Copy',
    copied: 'Copied!',
    view: 'View',
    download: 'Download',
    upload: 'Upload',
    yes: 'Yes',
    no: 'No',
    or: 'or',
    and: 'and',
    of: 'of',
    to: 'to',
    from: 'from',
    all: 'All',
    none: 'None',
    days: 'days',
    day: 'day',
    hours: 'hours',
    hour: 'hour',
    minutes: 'minutes',
    minute: 'minute',
  },

  // =========================================================================
  // NAVIGATION
  // =========================================================================
  nav: {
    login: 'Log in',
    logout: 'Log out',
    signup: 'Sign up',
    startFreeTrial: 'Start Free Trial',
    features: 'Features',
    howItWorks: 'How It Works',
    pricing: 'Pricing',
    settings: 'Settings',
    discovery: 'Discovery',
    findNew: 'Find New',
    allDiscovered: 'All Discovered',
    management: 'Management',
    savedAffiliates: 'Saved Affiliates',
    outreach: 'Outreach',
    businessPlan: 'Business Plan',
    activeSubscription: 'Active Subscription',
    managePlan: 'Manage Plan',
    upgradePlan: 'Upgrade Plan',
  },

  // =========================================================================
  // LANDING PAGE
  // =========================================================================
  landing: {
    hero: {
      badge: 'Trusted by 1,300+ brands',
      title: 'Discover Affiliates',
      titleHighlight: 'Promoting Competitors',
      subtitle: 'Find 500+ active affiliates with verified contacts instantly. Skip weeks of manual research.',
      ctaPrimary: 'Try for Free',
      ctaSecondary: 'Get a Demo',
      socialProof: 'Loved by 1,300+ SaaS & e-commerce brands',
    },
    trustedBy: 'Trusted by platforms',
    features: {
      sectionTitle: 'How Smart Brands 3X Their Affiliate Growth',
      sectionSubtitle: 'Stop wasting 20+ hours a week manually searching for affiliates. Find every creator and publisher in your niche in minutes.',
      mainFeature: {
        title: 'Reverse-Engineer Competitor Programs',
        description: 'Find all their top affiliates across 100+ networks.',
        badge1: '500+ Instant Matches',
        badge2: 'Weekly Fresh Leads',
      },
      feature2: {
        title: 'Get Emails Nobody Else Can Find',
        description: '90%+ contact rate including LinkedIn profiles.',
      },
      feature3: {
        title: 'Start Recruiting Today',
        description: 'Export to CRM and start outreach immediately.',
      },
    },
    howItWorks: {
      sectionTitle: 'From Zero to 500+ Affiliates in Minutes',
      sectionSubtitle: 'Watch your dashboard fill with qualified partners ready to promote your brand.',
      step1: {
        number: '01',
        title: "Find Your Competitors' Top Affiliates",
        description: "Enter your competitors and we'll reverse-engineer their affiliate programs across 100+ networks to find all their top affiliates — even the hidden ones.",
        overlayTitle: 'Competitor Analysis',
        overlaySubtitle: 'Found 1,243 affiliates',
        bullets: [
          'Scan across YouTube, Instagram, TikTok, and blogs',
          'Find affiliates promoting similar products',
          'No more digging through Ahrefs or Semrush',
        ],
      },
      step2: {
        number: '02',
        title: 'Get 500-2,500 Qualified Prospects',
        description: 'Watch your dashboard fill with qualified affiliates. Sort by traffic volume, Google rankings, follower count, or engagement rates to find your perfect partners fast.',
        overlayTitle: 'High-Quality Matches',
        overlaySubtitle: 'Sorted by engagement rate',
        bullets: [
          'Filter by traffic, rankings, and engagement',
          'View audience demographics and location data',
          'Track previous brand partnerships',
        ],
      },
      step3: {
        number: '03',
        title: 'Start Recruiting Immediately',
        description: 'Export verified emails, use our proven-to-convert templates, and start building partnerships today. Get 150+ fresh leads delivered every week.',
        overlayTitle: 'Outreach Ready',
        overlaySubtitle: '150+ new leads weekly',
        bullets: [
          '90%+ email deliverability rate',
          'Proven outreach templates included',
          'One-click CRM export',
        ],
      },
    },
    pricing: {
      badge: 'Simple, Transparent Pricing',
      sectionTitle: 'Find the Perfect Plan for Your Growth',
      sectionSubtitle: 'All plans include weekly affiliate discovery to keep your pipeline full. Start with a 7-day free trial.',
      mostPopular: 'Most Popular',
      perMonth: '/month',
      pro: {
        name: 'Pro',
        description: 'For growing SaaS & e-commerce brands',
        price: '$99',
        cta: 'Start 7-Day Free Trial',
        features: [
          'Unlimited affiliate discovery (500+ matches)',
          'Weekly new affiliate discoveries',
          '150 verified email credits/month',
          'Advanced search & filtering tools',
          '2 Team Seats',
          'One-click CRM export',
        ],
      },
      growth: {
        name: 'Growth',
        description: 'For agencies & multi-brand companies',
        price: '$249',
        cta: 'Start 7-Day Free Trial',
        features: [
          'Everything in Pro +',
          '500 verified email credits/month',
          '5 brands or geographical markets',
          '5 Team Seats',
          'Advanced analytics dashboard',
          'Dedicated account manager',
        ],
      },
      enterprise: {
        name: 'Enterprise',
        description: 'For large organizations with custom needs',
        price: 'Custom',
        cta: "Let's Talk",
        features: [
          'Everything in Growth +',
          'Unlimited verified emails',
          'Unlimited brand portfolio',
          'Unlimited team access',
          'API access & webhooks',
          '24/7 priority support',
        ],
      },
      trustNote: '✨ 7-day free trial • Cancel anytime • 30-day money-back guarantee',
    },
    cta: {
      title: 'Ready to Find Your Perfect Affiliates?',
      subtitle: 'Join 1,300+ brands that have found their ideal affiliate partners in minutes, not months.',
      ctaPrimary: 'Start Your 7-Day Free Trial',
      ctaSecondary: 'Get a Demo',
      trustNote: '7-day free trial • Cancel anytime',
    },
    // January 21st, 2026: Removed "Backed by selecdoo AI" from brandDescription per client request
    footer: {
      brandDescription: 'The new standard for affiliate discovery. Helping brands scale their partner networks 10x faster.',
      product: 'Product',
      legal: 'Legal',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
      cookiePolicy: 'Cookie Policy',
      security: 'Security',
      copyright: '© 2025 CrewCast Studio. All rights reserved.',
      madeBy: 'Made by Spectrum AI Labs',
      systemStatus: 'All systems operational',
    },
    // Demo component strings (January 9th, 2026)
    demo: {
      searchPlaceholder: 'Enter a niche or keyword...',
      scoutButton: 'Scout',
      scanning: 'Scanning...',
      analyzing: 'Analyzing...',
      emptyState: 'Enter a niche to find affiliates',
      emailFound: 'Found',
      noEmail: 'No Email',
      resultsVisible: 'Results Visible',
      searchTime: '0.8s Search Time',
      analysisComplete: 'Analysis Complete',
    },
  },

  // =========================================================================
  // ONBOARDING (Updated January 9th, 2026)
  // Restructured to match actual OnboardingScreen.tsx component
  // =========================================================================
  onboarding: {
    // Common strings used across onboarding steps
    common: {
      search: 'Search...',
      noResults: 'No results found',
    },
    // Step 1: Name, Role, Brand (combined step)
    step1: {
      header: 'Thanks for joining CrewCast Studio',
      title: "Let's get to know each other",
      nameLabel: 'Name',
      namePlaceholder: 'Enter your full name',
      roleLabel: "What's your role",
      rolePlaceholder: 'Select your role',
      roles: {
        brandOwner: 'Brand Owner',
        affiliateManager: 'Affiliate Manager',
        agencyOwner: 'Agency Owner',
        freelancer: 'Freelancer',
        contentCreator: 'Content Creator',
        other: 'Other',
      },
      brandLabel: 'Which brand do you want to find affiliates for?',
      brandPlaceholder: 'e.g. guffles.com',
      helpText: "For agencies, this should be your client's website, not your own.",
      validation: {
        invalidFormat: 'Enter a valid domain format (e.g., example.com)',
        domainNotReachable: 'Domain is not reachable',
        failedToValidate: 'Failed to validate domain. Please try again.',
      },
    },
    // Step 2: Target Market (Country + Language)
    step2: {
      title: 'Target market',
      countryLabel: 'Country',
      countryPlaceholder: 'Select your target country...',
      languageLabel: 'Target Language',
      languagePlaceholder: 'Select your target language...',
    },
    // Step 3: Competitors
    step3: {
      title: 'Add your top 5 competitors',
      inputPlaceholder: 'e.g. competitor.com',
      count: '{count}/5 added',
      suggestionsTitle: 'Suggestions for you:',
      yourCompetitors: 'Your competitors:',
      emptyState: 'Enter competitor domains above (e.g., competitor.com)',
    },
    // Step 4: Topics
    // Max topics reduced from 10 to 5 - January 15th, 2026
    step4: {
      title: 'What topics do you cover?',
      inputPlaceholder: 'e.g. best CRMs, skincare...',
      count: '{count}/5 added',
      suggestionsTitle: 'Suggestions for you:',
      yourTopics: 'Your topics:',
      emptyState: 'Enter topics you cover above (e.g., "best CRMs", "skincare routines")',
    },
    // Step 5: Pricing / Plan Selection
    step5: {
      title: 'Choose your plan',
      trialInfo: 'Start with a 3-day free trial • Cancel anytime',
      monthly: 'Monthly',
      annual: 'Annual',
      discountBadge: '-20%',
      bestValue: 'Best Value',
      perMonth: '/mo',
      billedAnnually: 'Billed {amount}/yr',
      contactSales: 'Contact Sales',
      selected: 'Selected',
      selectPlan: 'Select Plan',
      included: 'Included:',
      // January 17, 2026: Added pricing plan translations
      plans: {
        pro: {
          name: 'Pro',
          description: 'Perfect for solo founders & small teams starting their affiliate journey.',
          features: [
            'Find 500 new affiliates / month',
            '150 Verified email credits / month',
            '1 Brand Project',
            'Basic Search Filters',
            'Email Support',
            'Export to CSV',
          ],
        },
        business: {
          name: 'Business',
          description: 'For growing brands that need to scale their outreach volume.',
          features: [
            'Find Unlimited affiliates',
            '500 Verified email credits / month',
            '5 Brand Projects',
            'Advanced Competitor Analysis',
            'Priority Chat Support',
            'API Access',
            'Team Collaboration (5 seats)',
          ],
        },
        enterprise: {
          name: 'Enterprise',
          description: 'Custom solutions for large organizations with specific needs.',
          priceLabel: 'Custom',
          features: [
            'Unlimited everything',
            'Dedicated Account Manager',
            'Custom AI Model Training',
            'SSO & Advanced Security',
            'White-glove Onboarding',
            'Custom Invoicing',
          ],
        },
      },
    },
    // Step 6: Affiliate Types
    step6: {
      title: 'What types of affiliates do you want?',
      types: {
        publishersBloggers: 'Publishers/Bloggers',
        instagram: 'Instagram',
        tiktok: 'TikTok',
        xTwitter: 'X (Twitter)',
        linkedin: 'LinkedIn',
        reddit: 'Reddit',
        youtube: 'YouTube',
        other: 'Other',
      },
    },
    // Step 7: Payment / Card Details (Step7CardForm)
    step7: {
      secureCheckout: 'Secure Checkout',
      title: 'Start your 3-day free trial',
      subtitle: "Enter your card details • You won't be charged today",
      selectedPlan: 'Selected Plan',
      perMonth: '/mo',
      billedAnnually: 'Billed annually',
      firstCharge: 'First charge: 3 days from now',
      discountLabel: 'Discount Code (Optional)',
      discountPlaceholder: 'SAVE20',
      apply: 'Apply',
      applied: 'Applied',
      processing: 'Processing...',
      startTrial: 'Start 3-Day Free Trial',
      discountApplied: '% discount applied! You\'ll save',
      cardholderName: 'Cardholder Name',
      cardDetails: 'Card Details',
      nameOnCard: 'Name on card',
    },
    // Analyzing Screen (between step 1 and 2)
    analyzing: {
      title: 'Analyzing Your Brand',
      titleError: 'Analysis Complete',
      gettingInsightsFor: 'Getting insights for',
      errorTitle: "We couldn't find suggestions automatically",
      continueManually: 'Continue & Enter Manually',
      timeEstimate: 'This usually takes 10-15 seconds',
      steps: {
        step1Label: 'Analyzing your website',
        step1Desc: 'Reading your content and structure',
        step2Label: 'Understanding your products',
        step2Desc: 'Identifying what you offer',
        step3Label: 'Finding your competitors',
        step3Desc: 'Discovering similar businesses',
      },
    },
    // Navigation buttons
    navigation: {
      gettingStarted: 'Getting Started',
      stepOf: 'Step {current} of {total}',
      continue: 'Continue',
      next: 'Next',
      choosePlan: 'Choose Plan',
      continueToPayment: 'Continue to Payment',
      contactSales: 'Contact Sales',
      validatingDomain: 'Validating domain...',
    },
  },

  // =========================================================================
  // DASHBOARD
  // =========================================================================
  dashboard: {
    header: {
      nextScan: 'NEXT SCAN',
      pro: 'PRO',
      findAffiliates: 'Find Affiliates',
    },
    credits: {
      topicSearches: 'Topic Searches',
      topicSearchesShort: 'Search',
      emailCredits: 'Email Credits',
      emailCreditsShort: 'Email',
      aiCredits: 'AI Credits',
      aiCreditsShort: 'AI',
      topic: 'Topic',
    },
    filters: {
      searchPlaceholder: 'Search affiliates...',
      all: 'All',
      web: 'Web',
      youtube: 'YouTube',
      instagram: 'Instagram',
      tiktok: 'TikTok',
    },
    table: {
      affiliate: 'Affiliate',
      relevantContent: 'Relevant Content',
      discoveryMethod: 'Discovery Method',
      date: 'Date',
      status: 'Status',
      email: 'Email',
      message: 'Message',
      action: 'Action',
      creator: 'Creator',  // January 17, 2026: Added for outreach page table header
    },
    // =========================================================================
    // DISCOVERY REASONS - January 22, 2026
    // Updated: January 22, 2026 - More useful insights, not just thresholds
    // 
    // CLIENT REQUEST: Transparency feature showing WHY affiliates appear.
    // Used by DiscoveryReasonsPopover component in AffiliateRow.
    // =========================================================================
    discoveryReasons: {
      title: 'Why This Result Was Shown',
      emptyState: 'No additional match details',
      categories: {
        // Platform
        platform: 'Found on',
        // Search - Updated January 23, 2026: Added brand for brand search results
        searchKeyword: 'Keyword match',
        brand: 'Your brand match',
        competitor: 'Competitor match',
        // Audience
        subscribers: 'Subscribers',
        followers: 'Followers',
        // Engagement
        views: 'Views',
        likes: 'Likes',
        comments: 'Comments',
        // Traffic (Web)
        monthlyVisits: 'Monthly visits',
        globalRank: 'Global rank',
        category: 'Category',
        topTrafficSource: 'Main traffic',
        // Content
        matchedTerms: 'Matched terms',
        mentionsCompetitor: 'Mentions competitor',
        searchRank: 'Search rank',
      },
    },
    find: {
      pageTitle: 'Find New',
      emptyState: {
        title: 'No affiliates found yet',
        subtitle: 'Start a search to see results here',
      },
      loading: {
        scanning: 'Scanning the web for affiliates...',
        subtitle: 'Searching YouTube, Instagram, TikTok & websites',
        badge: 'Starting scan',
        // January 17, 2026: Added dynamic loading messages
        fromYouTube: 'from YouTube',
        fromInstagram: 'from Instagram',
        fromTikTok: 'from TikTok',
        fromWebsites: 'from websites',
        analyzing: 'Analyzing results...',
        found: 'found',
        progressTitles: {
          title1: 'Great finds coming in!',
          title2: 'Discovering potential partners...',
          title3: 'Building your affiliate list...',
          title4: 'Uncovering hidden gems...',
        },
      },
      // January 17, 2026: Added toast messages for save/delete feedback
      toasts: {
        affiliatesSaved: 'affiliate(s) saved!',
        noNewAffiliatesSaved: 'No new affiliates saved',
        addedToPipeline: 'Successfully added to your pipeline.',
        alreadyInPipeline: 'already in pipeline (skipped)',
        affiliateDeleted: 'Affiliate deleted',
        affiliatesDeleted: 'affiliates deleted',
        removedFromDiscovered: 'Successfully removed from discovered list.',
      },
      modal: {
        title: 'Find Affiliates',
        subtitle: 'Add up to 5 keywords to discover relevant creators',
        keywordsLabel: 'Keywords',
        keywordsPlaceholder: 'Type keyword + Enter...',
        addButton: 'Add',
        websiteLabel: 'Website',
        competitorsLabel: 'Competitors',
        competitorsAdded: 'added',
        noCompetitors: 'No competitors added',
        notSetDuringOnboarding: 'Not set during onboarding',
        clearAllKeywords: 'Clear all keywords',
        noKeywordsYet: 'No keywords added yet',
        ctaButton: 'Find Affiliates',
        searching: 'Searching...',
        tip: '💡 Tip: Use specific keywords like "best CRM software" instead of just "CRM"',
      },
      bulkActions: {
        selected: 'selected',
        selectAllVisible: 'Select All Visible',
        deselectAll: 'Deselect All',
        alreadyInPipeline: 'already in pipeline',
        deleteSelected: 'Delete Selected',
        saveToPipeline: 'Save to Pipeline',
        allAlreadySaved: 'All Already Saved',
      },
      newSearchWarning: {
        title: 'New search started',
        subtitle: 'Previous results have been moved to "All Discovered" page.',
      },
      creditError: {
        title: 'Out of Topic Search Credits',
        message: 'Insufficient topic search credits',
        upgradeHint: 'Upgrade your plan to get more searches, or wait for your credits to refresh.',
      },
      noResults: 'No results found for this filter.',
    },
    // Pagination - Added January 9th, 2026 for i18n
    pagination: {
      showing: 'Showing',
      toOf: 'to',
      affiliates: 'affiliates',
      previous: 'Previous',
      next: 'Next',
      perPage: 'per page',
    },
    discovered: {
      pageTitle: 'All Discovered',
      emptyState: {
        title: 'No discovered affiliates',
        subtitle: 'Affiliates from your searches will appear here',
      },
      // January 17, 2026: Added loading message
      loading: 'Loading discovered affiliates...',
    },
    saved: {
      pageTitle: 'Saved Affiliates',
      emptyState: {
        title: 'No saved affiliates',
        subtitle: 'Affiliates you save will appear here',
      },
      bulkActions: {
        findEmails: 'Find Emails',
        emailProgress: 'Finding emails...',
      },
      emailStatus: {
        found: 'Found',
        notFound: 'Not Found',
        searching: 'Searching...',
        none: 'None',
      },
      // Toast notification helpers (January 10th, 2026)
      savedCount: 'Saved {count}',
      deletedCount: 'Deleted {count}',
      emailResults: {
        found: 'Found',
        errors: 'errors',
      },
      // January 17, 2026: Added toast translations
      toasts: {
        affiliateRemoved: 'Affiliate removed',
        affiliatesRemoved: 'affiliates removed',
        removedFromPipeline: 'Successfully removed from your pipeline.',
        emailLookupFailed: 'Email lookup failed',
        errors: 'error(s)',
        // Email lookup result messages
        insufficientCredits: 'Insufficient Credits',
        emailsFound: 'email(s) found!',
        readyForOutreach: 'Ready for outreach',
        found: 'found',
        notFound: 'not found',
      },
    },
    // =========================================================================
    // OUTREACH PAGE TRANSLATIONS
    // Updated: January 17, 2026 - Added comprehensive i18n support
    // =========================================================================
    outreach: {
      pageTitle: 'Outreach',
      // Loading state
      loading: 'Loading your affiliates...',
      // Empty & No Results states
      emptyState: {
        title: 'Start Building Connections',
        subtitle: 'Save affiliates to generate AI-powered outreach messages.',
      },
      noResults: {
        title: 'No Results Found',
        subtitle: 'Try adjusting your search or filter to find affiliates.',
      },
      // Selection actions (January 17, 2026)
      selected: 'Selected',
      selectAll: 'Select All',
      deselectAll: 'Deselect All',
      // Row action buttons
      generate: 'Generate',
      generating: 'Generating...',
      viewMessage: 'View',
      messages: 'Msgs',
      messagesLabel: 'Messages',  // For modal badge
      failed: 'Failed',
      retry: 'Retry',
      selectContacts: 'Select Contacts',
      contacts: 'Contacts',
      bulkGenerate: 'Generate',
      // Contact Picker Modal (January 17, 2026: Comprehensive translations)
      contactPicker: {
        title: 'Select Contacts',
        subtitle: "Select which contacts you'd like to generate personalized emails for:",
        creditsUsed: 'Uses',
        credit: 'credit',
        credits: 'credits',
        selectContacts: 'Select contacts',
        alreadyGenerated: 'Done',
        unknownName: 'Unknown',
        cancel: 'Cancel',
      },
      // Message Viewer Modal (January 17, 2026: Added edit mode translations)
      messageViewer: {
        title: 'AI Generated Message',
        to: 'to',
        primaryContact: 'Primary Contact',
        affiliateDetails: 'Affiliate Details',
        contactName: 'Contact Name',
        platform: 'Platform',
        keyword: 'Keyword',
        // Action buttons
        redo: 'Redo',
        regenerating: 'Regenerating...',
        edit: 'Edit',
        editPlaceholder: 'Edit your message...',
        save: 'Save',
        saving: 'Saving...',
        cancel: 'Cancel',
        copy: 'Copy',
        copied: 'Copied!',
        done: 'Done!',
      },
      // Toast notifications (January 10th, 2026)
      email: 'email',
      emails: 'emails',
      failedRetry: 'failed - click "Retry" to try again.',
    },
    settings: {
      pageTitle: 'Settings',
      tabs: {
        profile: {
          label: 'My Profile',
          description: 'Manage your personal information',
        },
        plan: {
          label: 'Plan & Billing',
          description: 'Manage your subscription and billing',
        },
        notifications: {
          label: 'Notifications',
          description: 'Configure how you want to be notified',
        },
        security: {
          label: 'Security',
          description: 'Protect your account',
        },
      },
      // =======================================================================
      // PROFILE SECTION - Updated January 17, 2026
      // Added all missing profile form translations
      // =======================================================================
      profile: {
        photoTitle: 'Profile Photo',
        photoDescription: 'Update your profile picture in account settings.',
        fullName: 'Full Name',
        emailAddress: 'Email Address',
        editProfile: 'Edit Profile',
        // January 17, 2026: Added missing profile translations
        targetMarket: 'Target Market',
        country: 'Country',
        language: 'Language',
        selectCountry: 'Select country',
        selectLanguage: 'Select language',
        notSet: 'Not set',
        emailCannotChange: 'Email cannot be changed here.',
        enterYourName: 'Enter your name',
        nameCannotBeEmpty: 'Name cannot be empty',
        failedToSave: 'Failed to save. Please try again.',
        failedToUpdateDatabase: 'Failed to update database',
        saveChanges: 'Save Changes',
        saving: 'Saving...',
        cancel: 'Cancel',
      },
      plan: {
        currentPlan: 'Current Plan',
        freeTrial: 'Free Trial',
        pro: 'Pro',
        growth: 'Growth',
        enterprise: 'Enterprise',
        active: 'Active',
        trial: 'Trial',
        cancelled: 'Cancelled',
        daysLeft: 'days left in trial',
        trialEndsToday: 'Trial ends today',
        nextBilling: 'Next billing',
        billedAnnually: 'billed annually',
        choosePlan: 'Choose Plan',
        upgradePlan: 'Upgrade Plan',
        managePlan: 'Manage Plan',
        trialEndingSoon: {
          title: 'Your trial is ending soon',
          subtitle: 'Add a payment method to continue using all features.',
        },
        paymentMethod: 'Payment Method',
        noPaymentMethod: {
          title: 'No payment method added',
          trialSubtitle: 'Add a card to continue using all features after your trial ends.',
          defaultSubtitle: 'Add a payment method to upgrade your plan.',
        },
        addPaymentMethod: 'Add Payment Method',
        updatePaymentMethod: 'Update',
        expires: 'Expires',
        invoiceHistory: 'Invoice History',
        loadingInvoices: 'Loading invoices...',
        noInvoicesYet: {
          title: 'No invoices yet',
          subtitle: 'Invoices will appear here after your first billing cycle',
        },
        invoiceColumns: {
          invoice: 'Invoice',
          date: 'Date',
          amount: 'Amount',
          status: 'Status',
          actions: 'Actions',
        },
        invoiceStatus: {
          paid: 'Paid',
          open: 'Open',
          draft: 'Draft',
          void: 'Void',
          uncollectible: 'Uncollectible',
          unknown: 'Unknown',
        },
        // January 17, 2026: Added missing plan translations
        noPlan: 'No Plan',
        card: 'Card',
        dayLeftInTrial: 'day left in trial',
        viewInvoice: 'View invoice',
        downloadPdf: 'Download PDF',
        retry: 'Retry',
        subscriptionWillRemainActive: 'Your subscription will remain active until the end of your current billing period. You can resume anytime before then.',
        cancelSubscription: {
          title: 'Cancel Subscription',
          subtitle: "If you cancel, you'll still have access to your plan until the end of your current billing period.",
          button: 'Cancel Plan',
        },
        cancelModal: {
          cancelTitle: 'Cancel Subscription',
          resumeTitle: 'Resume Subscription',
          cancelWarning: 'Are you sure you want to cancel?',
          cancelMessage: "You'll lose access to premium features at the end of your current billing period.",
          resumeMessage: "Would you like to resume your subscription? Your plan will continue as normal and you'll be billed at the next billing cycle.",
          keepSubscription: 'Keep Subscription',
          keepCanceled: 'Keep Canceled',
          confirmCancel: 'Cancel Subscription',
          confirmResume: 'Resume Subscription',
        },
        cancellationPending: {
          title: 'Subscription Canceling',
          subtitle: "Your plan will be canceled at the end of the current billing period. You'll continue to have access until then.",
          resumeButton: 'Resume Subscription',
        },
      },
      notifications: {
        emailNotifications: 'Email Notifications',
        appNotifications: 'App Notifications',
        options: {
          newMatches: {
            label: 'New affiliate matches found',
            description: 'Get notified when we find new high-potential affiliates.',
          },
          weeklyReport: {
            label: 'Weekly performance report',
            description: 'Summary of your campaign performance and outreach stats.',
          },
          productUpdates: {
            label: 'Product updates',
            description: 'News about new features and improvements.',
          },
          successfulReplies: {
            label: 'Successful outreach replies',
            description: 'Notify me when an affiliate replies to my email.',
          },
          taskReminders: {
            label: 'Task reminders',
            description: 'Remind me about follow-ups and scheduled tasks.',
          },
        },
      },
      // =======================================================================
      // SECURITY SECTION - Updated January 17, 2026
      // Added password modal and delete account modal translations
      // =======================================================================
      security: {
        passwordSecurity: 'Password & Security',
        securityDescription: 'Change your password to keep your account secure.',
        changePassword: 'Change Password',
        dangerZone: 'Danger Zone',
        dangerZoneWarning: 'Once you delete your account, there is no going back. Please be certain.',
        deleteAccount: 'Delete Account',
        // Password Modal
        passwordModal: {
          title: 'Change Password',
          currentPassword: 'Current Password',
          newPassword: 'New Password',
          confirmPassword: 'Confirm New Password',
          currentPlaceholder: 'Enter current password',
          newPlaceholder: 'Enter new password (min 8 characters)',
          confirmPlaceholder: 'Confirm new password',
          success: 'Password changed successfully!',
          // Validation errors
          allFieldsRequired: 'All fields are required',
          minLength: 'New password must be at least 8 characters',
          passwordsDontMatch: 'New passwords do not match',
          mustBeDifferent: 'New password must be different from current password',
          incorrectPassword: 'Current password is incorrect',
          requirementsNotMet: 'Password does not meet requirements',
          genericError: 'Failed to change password. Please try again.',
          // Buttons
          cancel: 'Cancel',
          save: 'Save Password',
          saving: 'Saving...',
        },
        // Delete Account Modal
        deleteModal: {
          title: 'Delete Account',
          warning: 'This action cannot be undone',
          warningDetail: 'Your account and all associated data will be permanently deleted.',
          willBeDeleted: 'The following will be permanently deleted:',
          items: {
            subscription: 'Your subscription (canceled immediately)',
            savedAffiliates: 'All saved affiliates',
            discoveredAffiliates: 'All discovered affiliates',
            searchHistory: 'All search history',
            account: 'Your account and login credentials',
          },
          typeToConfirm: 'Type DELETE to confirm',
          confirmError: 'Please type DELETE to confirm',
          userIdError: 'User ID not found. Please refresh and try again.',
          genericError: 'Failed to delete account. Please try again or contact support.',
          // Buttons
          cancel: 'Cancel',
          delete: 'Delete Forever',
          deleting: 'Deleting...',
        },
      },
      // January 17, 2026: Added account section label
      accountLabel: 'Account',
    },
  },

  // =========================================================================
  // SIDEBAR
  // =========================================================================
  // January 21st, 2026: Removed selecdoo branding per client request
  sidebar: {
    brand: 'CrewCast Studio',
    tagline: '', // Was: 'backed by selecdoo AI'
    planCard: {
      planSuffix: 'Plan',
      daysLeft: 'days left',
      activeSubscription: 'Active Subscription',
      upgradeAvailable: 'Upgrade Available',
      managePlan: 'Manage Plan',
      upgradePlan: 'Upgrade Plan',
    },
    profile: {
      settings: 'Settings',
      logout: 'Log out',
    },
    logoutModal: {
      title: 'Log out',
      message: "Are you sure you want to log out? You'll need to sign in again to access your workspace.",
      cancel: 'Cancel',
      confirm: 'Log out',
    },
  },

  // =========================================================================
  // MODALS
  // =========================================================================
  modals: {
    confirmDelete: {
      title: 'Delete',
      message: 'Are you sure you want to delete? This action cannot be undone.',
      deleteButton: 'Delete',
      deleting: 'Deleting...',
      deleteCount: 'Delete',
      willBeDeleted: 'will be permanently deleted',
      affiliates: 'affiliates',
      affiliate: 'affiliate',
      cancel: 'Cancel',
    },
    addCard: {
      title: 'Add Payment Method',
      subtitle: 'Your card will be saved securely',
      saveButton: 'Save Payment Method',
      saving: 'Saving...',
      discountLabel: 'Discount Code (Optional)',
      discountPlaceholder: 'SAVE20',
      apply: 'Apply',
      applied: 'Applied',
      discountComingSoon: 'Discount codes coming soon',
      failedToValidate: 'Failed to validate code',
      discountApplied: '% discount will be applied to your next billing cycle',
      completeCardDetails: 'Please complete all card details',
      securityNote: 'Your card details are stored securely by Stripe. We never see your full card number.',
      processing: 'Processing...',
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
      emailGenerated: 'Email generated successfully!',
      messageCopied: 'Message copied to clipboard!',
      affiliatesSaved: 'Saved to pipeline!',
      affiliatesSavedWithDuplicates: 'already in pipeline',
      affiliatesDeleted: 'Deleted successfully',
      affiliatesDeletedFromPipeline: 'from pipeline',
      emailsFound: 'email(s) found!',
      bulkEmailsGenerated: 'Successfully generated',
      csvExported: 'CSV exported successfully!',
      planChanged: 'Plan changed successfully!',
      cardAdded: 'Payment method added!',
      subscriptionCancelled: 'Subscription cancelled',
      subscriptionResumed: 'Subscription resumed!',
      messageSaved: 'Message saved!',  // January 17, 2026: Added for edit message feature
    },
    error: {
      genericError: 'Something went wrong. Please try again.',
      searchFailed: 'Search failed. Please try again.',
      saveFailed: 'Failed to save affiliates. Please try again.',
      deleteFailed: 'Failed to delete affiliates. Please try again.',
      emailLookupFailed: 'Failed to find emails. Please try again.',
      emailLookupFailedCount: 'Email lookup failed for',
      aiGenerationFailed: 'Failed to generate message',
      aiServiceNotConfigured: 'AI service not configured. Please contact support.',
      aiConnectionFailed: 'Failed to connect to AI service. Please try again.',
      bulkGenerationFailed: 'Failed to generate',
      exportFailed: 'Failed to export data',
      paymentFailed: 'Payment failed. Please try again.',
      messageSaveFailed: 'Failed to save message',  // January 17, 2026: Added for edit message feature
      messageEmpty: 'Message cannot be empty',  // January 17, 2026: Added for edit message validation
    },
    warning: {
      insufficientCredits: 'Insufficient search credits. Please upgrade your plan.',
      insufficientAICredits: 'Insufficient AI credits. Please upgrade your plan.',
      insufficientEmailCredits: 'Ran out of email credits',
      noEmailsFound: 'No emails found for',
      partialBulkFailure: 'of',
      invalidThreshold: 'Please enter a valid threshold amount',
      trialEnding: 'Your trial is ending soon. Add a payment method to continue.',
      allAlreadyHaveEmails: 'All selected affiliates already have emails',
    },
    info: {
      allAlreadyInPipeline: 'affiliates are already in your pipeline',
      allAlreadyHaveEmails: 'All selected affiliates already have emails',
      mixedEmailResults: 'not found',
      mixedResults: 'Some operations completed with warnings',
      noEmailsFound: 'No emails found for selected affiliates',
    },
  },

  // =========================================================================
  // AUTH
  // =========================================================================
  auth: {
    loading: {
      title: 'Loading...',
      subtitle: 'Preparing your workspace',
    },
    // =========================================================================
    // SIGN-IN PAGE TRANSLATIONS - January 21st, 2026
    // 
    // Added per client request to support German language on auth pages.
    // The sign-in page handles both sign-in and sign-up (magic link flow).
    // 
    // Mode detection:
    // - /sign-in (no mode) → Uses 'signIn' translations (returning user)
    // - /sign-in?mode=signup → Uses 'signUp' translations (new user)
    // =========================================================================
    signIn: {
      backToHome: 'Back to Home',
      title: 'Welcome Back',
      subtitle: 'Enter your email to receive a magic link',
      emailLabel: 'Email Address',
      emailPlaceholder: 'you@example.com',
      sendMagicLink: 'Send Magic Link',
      sending: 'Sending...',
      checkEmail: 'Check Your Email',
      magicLinkSent: 'We sent a magic link to',
      clickToSignIn: 'Click the link in the email to sign in.',
      checkSpam: "Don't see it? Check your spam folder.",
      useDifferentEmail: 'Use a different email',
      noPasswordNeeded: "No password needed! We'll send you a secure link to sign in.",
      newHere: 'New here?',
      startTrial: 'Start your free trial',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
      alreadySignedIn: 'Already signed in, redirecting...',
      // OTP (6-digit code) - January 22nd, 2026
      enterCode: 'Enter Code Instead',
      otpLabel: '6-Digit Code',
      verifyCode: 'Verify Code',
      verifying: 'Verifying...',
      backToMagicLink: '← Back to magic link',
      invalidOtp: 'Please enter a valid 6-digit code',
      otpExpired: 'Code expired. Please request a new one.',
      otpInvalid: 'Invalid code. Please check and try again.',
      // Error messages
      invalidEmail: 'Please enter a valid email address',
      authFailed: 'Authentication failed. Please try again.',
      configError: 'Configuration error. Please contact support.',
      invalidToken: 'The magic link has expired. Please request a new one.',
      accessDenied: 'Access denied. Please try again.',
      genericError: 'Something went wrong. Please try again.',
    },
    signUp: {
      title: 'Start Your Free Trial',
      subtitle: 'Enter your email to get started — no credit card required',
      clickToCreate: 'Click the link in the email to create your account.',
      noPasswordNeeded: "No password needed! We'll send you a secure link to get started.",
      alreadyHaveAccount: 'Already have an account?',
      signIn: 'Sign in',
    },
  },

  // =========================================================================
  // LOADING ONBOARDING SCREEN - Post-onboarding loading state
  // Added: January 10th, 2026 - Remaining Components
  // =========================================================================
  loadingOnboarding: {
    title: 'Setting up your workspace!',
    subtitle: 'Just a moment while we prepare your dashboard...',
    description: 'Your affiliate discovery tools are being configured.',
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
      'Searching for affiliates...',
      'Scanning competitors',
      'Checking keywords',
      'Scanning Instagram & TikTok',
      'Preparing your first results',
      'Complete!',
    ],
    // Completion message (shown when API returns)
    complete: 'Complete!',
    // Elapsed time suffix
    elapsed: 'elapsed',
    // Estimated time note at bottom
    estimatedTime: 'Estimated time: ~3 minutes',
    // Legacy fields kept for backwards compatibility
    thankYou: 'Thank You!',
    preparingDashboard: 'Preparing your dashboard...',
    pleaseWait: 'Please wait a moment',
    title: 'Finding Your Affiliates',
    subtitle: 'Discovering partners for {brand}',
    timeEstimate: 'This usually takes 20-30 seconds',
  },

  // =========================================================================
  // LANDING PAGE GRAPHICS - Decorative animations in BentoGrid
  // Added: January 10th, 2026 - Remaining Components
  // =========================================================================
  landingGraphics: {
    discovery: {
      scanning: 'Scanning...',
      indexing: 'Indexing',
      followers: 'followers',
    },
    verifiedEmail: {
      verified: 'Verified Deliverable',
      syntax: 'Syntax',
      domain: 'Domain',
      mx: 'MX',
      smtp: 'SMTP',
    },
    pipeline: {
      new: 'New',
      outreach: 'Outreach',
      done: 'Done',
    },
  },

  // =========================================================================
  // ERROR BOUNDARY - Error fallback UI
  // Added: January 10th, 2026 - Priority 5: Shared Components
  // =========================================================================
  errorBoundary: {
    title: 'Something went wrong',
    message: 'Please try again later. If the problem continues, contact us at',
    contactPrefix: 'support@crewcast.studio',
    tryAgain: 'Try Again',
  },

  // =========================================================================
  // LEGAL PAGES - Privacy, Terms, Cookies, Security
  // Added: January 10th, 2026 - Priority 6: Static Pages
  // =========================================================================
  legalPages: {
    common: {
      backToHome: 'Back to Home',
      lastUpdated: 'Last updated:',
      contentComingSoon: 'Content Coming Soon',
      contactUs: 'Contact Us',
    },
    privacy: {
      title: 'Privacy Policy',
      comingSoonMessage: 'This privacy policy is currently being drafted by our legal team. The final version will detail how we collect, use, and protect your personal information.',
      sections: {
        informationWeCollect: '1. Information We Collect',
        informationWeCollectPlaceholder: '[Placeholder: Details about personal information, usage data, cookies, and third-party integrations will be added here.]',
        howWeUseInfo: '2. How We Use Your Information',
        howWeUseInfoPlaceholder: '[Placeholder: Information about how we use collected data for service provision, improvement, and communication will be added here.]',
        dataSharing: '3. Data Sharing and Disclosure',
        dataSharingPlaceholder: '[Placeholder: Details about third-party services, legal requirements, and business transfers will be added here.]',
        dataSecurity: '4. Data Security',
        dataSecurityPlaceholder: '[Placeholder: Information about our security measures, encryption, and data protection practices will be added here.]',
        yourRights: '5. Your Rights',
        yourRightsPlaceholder: '[Placeholder: Details about GDPR rights, data access, deletion requests, and opt-out options will be added here.]',
        contactUs: '6. Contact Us',
        contactUsText: 'If you have any questions about this Privacy Policy, please contact us at',
      },
    },
    terms: {
      title: 'Terms of Service',
      comingSoonMessage: 'These Terms of Service are currently being drafted by our legal team. The final version will detail the rules and guidelines for using CrewCast Studio.',
      sections: {
        acceptanceOfTerms: '1. Acceptance of Terms',
        acceptanceOfTermsPlaceholder: '[Placeholder: Details about agreement to terms, eligibility requirements, and account responsibilities will be added here.]',
        descriptionOfService: '2. Description of Service',
        descriptionOfServicePlaceholder: '[Placeholder: Information about the CrewCast Studio platform, features, and service availability will be added here.]',
        userAccounts: '3. User Accounts',
        userAccountsPlaceholder: '[Placeholder: Details about account creation, security, and user responsibilities will be added here.]',
        paymentAndBilling: '4. Payment and Billing',
        paymentAndBillingPlaceholder: '[Placeholder: Information about subscription plans, pricing, refunds, and payment processing will be added here.]',
        acceptableUse: '5. Acceptable Use',
        acceptableUsePlaceholder: '[Placeholder: Guidelines for proper use of the platform, prohibited activities, and content restrictions will be added here.]',
        intellectualProperty: '6. Intellectual Property',
        intellectualPropertyPlaceholder: '[Placeholder: Details about ownership rights, licenses, and intellectual property protections will be added here.]',
        limitationOfLiability: '7. Limitation of Liability',
        limitationOfLiabilityPlaceholder: '[Placeholder: Information about liability limitations, disclaimers, and indemnification will be added here.]',
        contactUs: '8. Contact Us',
        contactUsText: 'If you have any questions about these Terms, please contact us at',
      },
    },
    cookies: {
      title: 'Cookie Policy',
      comingSoonMessage: 'This Cookie Policy is currently being drafted by our legal team. The final version will explain how we use cookies and similar technologies.',
      sections: {
        whatAreCookies: '1. What Are Cookies?',
        whatAreCookiesPlaceholder: '[Placeholder: Explanation of cookies, how they work, and why websites use them will be added here.]',
        typesOfCookies: '2. Types of Cookies We Use',
        typesOfCookiesPlaceholder: '[Placeholder: Details about essential cookies, analytics cookies, functional cookies, and marketing cookies will be added here.]',
        essentialCookies: '3. Essential Cookies',
        essentialCookiesPlaceholder: '[Placeholder: Information about cookies necessary for the website to function properly will be added here.]',
        analyticsCookies: '4. Analytics Cookies',
        analyticsCookiesPlaceholder: '[Placeholder: Details about cookies used to understand how visitors interact with our website will be added here.]',
        thirdPartyCookies: '5. Third-Party Cookies',
        thirdPartyCookiesPlaceholder: '[Placeholder: Information about cookies set by third-party services like Stripe, analytics providers, etc. will be added here.]',
        managingCookies: '6. Managing Cookies',
        managingCookiesPlaceholder: '[Placeholder: Instructions on how to control, disable, or delete cookies through browser settings will be added here.]',
        contactUs: '7. Contact Us',
        contactUsText: 'If you have any questions about our Cookie Policy, please contact us at',
      },
    },
    security: {
      title: 'Security',
      subtitle: 'How we protect your data',
      comingSoonMessage: 'Our comprehensive security documentation is currently being prepared. It will detail our security practices, certifications, and data protection measures.',
      highlights: {
        soc2Title: 'SOC 2 Compliant',
        soc2Description: 'Enterprise-grade security standards',
        encryptionTitle: 'End-to-End Encryption',
        encryptionDescription: 'All data encrypted in transit and at rest',
        infrastructureTitle: 'Secure Infrastructure',
        infrastructureDescription: 'Hosted on Vercel & Neon with 99.9% uptime',
        gdprTitle: 'GDPR Compliant',
        gdprDescription: 'Full compliance with EU data protection',
      },
      sections: {
        dataProtection: '1. Data Protection',
        dataProtectionPlaceholder: '[Placeholder: Details about encryption standards, data storage practices, and access controls will be added here.]',
        authentication: '2. Authentication & Access',
        authenticationPlaceholder: '[Placeholder: Information about secure authentication, session management, and role-based access will be added here.]',
        paymentSecurity: '3. Payment Security',
        paymentSecurityPlaceholder: '[Placeholder: Details about PCI DSS compliance, Stripe integration, and how we handle payment data will be added here.]',
        infrastructureSecurity: '4. Infrastructure Security',
        infrastructureSecurityPlaceholder: '[Placeholder: Information about our hosting providers, network security, and monitoring systems will be added here.]',
        vulnerabilityManagement: '5. Vulnerability Management',
        vulnerabilityManagementPlaceholder: '[Placeholder: Details about security testing, bug bounty programs, and incident response will be added here.]',
        reportVulnerability: '6. Report a Vulnerability',
        reportVulnerabilityText: 'If you discover a security vulnerability, please report it responsibly to',
      },
    },
  },

  // =========================================================================
  // AFFILIATE ROW - Shared component for displaying affiliate results
  // Added: January 10th, 2026 - Priority 5: Shared Components
  // =========================================================================
  affiliateRow: {
    badges: {
      new: 'NEW',
      saved: 'SAVED',
      discovered: 'Discovered',
    },
    metrics: {
      followers: 'followers',
      subscribers: 'subscribers',
      views: 'views',
      likes: 'likes',
      comments: 'comments',
      visitsPerMonth: 'visits/mo',
      loading: 'Loading...',
    },
    discovery: {
      keywordLabel: 'Keyword:',
      rankFor: 'for',
      more: 'more',
    },
    actions: {
      confirm: 'Confirm?',
      findEmail: 'Find Email',
      found: 'Found',
      notFound: '0 Found',
      retry: 'Retry',
      save: 'Save',
      saved: 'Saved',
      saving: 'Saving...',
      saveToPipeline: 'Save to Pipeline',
      delete: 'Delete',
      view: 'View',
    },
    contentModal: {
      title: 'Relevant Content',
      articles: 'articles',
      ranking: 'Ranking:',
      keyword: 'Keyword:',
      discoveredVia: 'Discovered via',
    },
    emailModal: {
      title: 'Email Results',
      found: 'Found',
      emailAddresses: 'Email Addresses',
      noEmailsFound: 'No emails found',
      trySearchingAgain: 'Try searching again',
      email: 'email',
      emails: 'emails',
      copy: 'Copy',
      done: 'Done!',
    },
    viewModal: {
      title: 'View Details',
      visitChannel: 'Visit Channel',
      visitAccount: 'Visit Account',
      visitWebsite: 'Visit Website',
      youtube: {
        subscribers: 'subscribers',
        relevantVideos: 'Relevant Videos',
      },
      instagram: {
        followers: 'followers',
        relevantPosts: 'Relevant Posts',
      },
      tiktok: {
        followers: 'followers',
        relevantPosts: 'Relevant Posts',
      },
      web: {
        trafficPerMonth: 'traffic/mo',
        about: 'About',
        trafficMetrics: 'Traffic & Engagement Metrics',
        ranking: 'Ranking',
        global: 'Global',
        category: 'Category',
        userEngagement: 'User Engagement',
        pagesPerVisit: 'Pages/Visit',
        timeOnSite: 'Time on Site',
        bounceRate: 'Bounce Rate',
        trafficSources: 'Traffic Sources',
        search: 'Search',
        direct: 'Direct',
        referrals: 'Referrals',
        social: 'Social',
        paid: 'Paid',
        mail: 'Mail',
        noTrafficData: 'No traffic data',
        noTrafficDataDesc: 'Traffic data will be fetched during search',
        relevantContent: 'Relevant Content',
      },
    },
  },

  // =========================================================================
  // AFFILIATE CARD - Card component for displaying affiliate summary
  // Added: January 10th, 2026 - Priority 5: Shared Components
  // =========================================================================
  affiliateCard: {
    totalFollowers: 'Total followers',
    engagementRate: 'Engagement rate',
    recentGrowth: 'Recent growth',
    addProfile: 'Add profile',
  },

  // =========================================================================
  // FILTER PANEL - Advanced filtering for affiliates
  // Added: January 10th, 2026 - Priority 5: Shared Components
  // =========================================================================
  filterPanel: {
    title: 'Filters',
    competitors: 'Competitors',
    topics: 'Topics',
    followers: 'Followers',
    date: 'Date',
    posts: 'Posts',
    noCompetitorsFound: 'No competitors found',
    noTopicsFound: 'No topics found',
    noOptionsAvailable: 'No options available',
    showLess: '− Show less',
    more: 'more',
    clearAll: 'Clear All',
    clear: '× Clear',
    days7: '7 days',
    days30: '30 days',
    days90: '90 days',
    year1: '1 year',
    noFiltersActive: 'No filters active',
    apply: 'Apply',
  },

  // =========================================================================
  // SCAN COUNTDOWN - Auto-scan countdown timer in dashboard header
  // Added: January 13th, 2026 - Auto-scan feature
  // =========================================================================
  scanCountdown: {
    upgradeToUnlock: 'Upgrade to unlock auto-scan',
    noCredits: 'No credits',
    noCreditsTooltip: 'No credits available. Upgrade for more.',
    scanning: 'Scanning...',
    scanningTooltip: 'Auto-scan in progress...',
    nextScanAt: 'Next scan at',
  },

  // =========================================================================
  // PRICING MODAL - Plan selection and subscription management
  // Added: January 10th, 2026 - Priority 5: Shared Components
  // =========================================================================
  pricingModal: {
    manageYourPlan: 'Manage your plan',
    superchargeYour: 'Supercharge your',
    affiliateGrowth: 'affiliate growth',
    manageSubtitle: 'Upgrade to unlock more features or adjust your billing preferences.',
    newSubtitle: 'Stop wasting hours searching manually. Get instant access to thousands of high-converting affiliates tailored to your niche.',
    currentPlan: 'Current Plan',
    trial: 'Trial',
    monthly: 'Monthly',
    annual: 'Annual',
    save20: 'Save 20%',
    perMonth: '/mo',
    billedYearly: 'Billed yearly',
    custom: 'Custom',
    whatsIncluded: "What's included:",
    bestValue: 'Best Value',
    contactSales: 'Contact Sales',
    buyNow: 'Buy Now',
    upgradeNow: 'Upgrade Now',
    switchPlan: 'Switch Plan',
    switchToAnnual: 'Switch to Annual',
    switchToMonthly: 'Switch to Monthly',
    getStarted: 'Get Started',
    trialTitle: "You're currently on a trial",
    trialMessage: 'Would you like to end your trial now and start billing immediately, or keep your trial and just change the plan?',
    keepTrialChangePlan: 'Keep Trial, Change Plan',
    endTrialStartBilling: 'End Trial & Start Billing',
    immediateUpgrade: '⬆️ Immediate upgrade with proration',
    takesEffectNextCycle: '⬇️ Takes effect next billing cycle',
    billingChangeProration: '🔄 Billing change with proration',
    securePayment: 'Secure SSL Payment',
    cancelAnytime: 'Cancel Anytime',
    upgradeDowngradeNote: 'Upgrades take effect immediately. Downgrades take effect at the end of your current billing period.',
    signInRequired: 'Please sign in to change your plan.',
  },
};

