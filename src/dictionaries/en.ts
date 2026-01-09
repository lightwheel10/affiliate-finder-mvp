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
    trustedBy: 'Trusted by top brands',
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
    footer: {
      brandDescription: 'The new standard for affiliate discovery. Backed by selecdoo AI. Helping brands scale their partner networks 10x faster.',
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
    step4: {
      title: 'What topics do you cover?',
      inputPlaceholder: 'e.g. best CRMs, skincare...',
      count: '{count}/10 added',
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
    },
    outreach: {
      pageTitle: 'Outreach',
      emptyState: {
        title: 'Start Building Connections',
        subtitle: 'Save affiliates to generate AI-powered outreach messages.',
      },
      noResults: {
        title: 'No Results Found',
        subtitle: 'Try adjusting your search or filter to find affiliates.',
      },
      generate: 'Generate',
      generating: 'Generating...',
      viewMessage: 'View',
      messages: 'Msgs',
      failed: 'Failed',
      retry: 'Retry',
      selectContacts: 'Select Contacts',
      contacts: 'Contacts',
      bulkGenerate: 'Generate',
      contactPicker: {
        title: 'Select Contacts',
        subtitle: "Select which contacts you'd like to generate personalized emails for:",
        creditsUsed: 'Uses',
        credit: 'credit',
        credits: 'credits',
        selectContacts: 'Select contacts',
        alreadyGenerated: 'Done',
      },
      messageViewer: {
        title: 'AI Generated Message',
        to: 'to',
        affiliateDetails: 'Affiliate Details',
        contactName: 'Contact Name',
        platform: 'Platform',
        keyword: 'Keyword',
        redo: 'Redo',
        copy: 'Copy',
        done: 'Done!',
      },
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
      profile: {
        photoTitle: 'Profile Photo',
        photoDescription: 'Update your profile picture in account settings.',
        fullName: 'Full Name',
        emailAddress: 'Email Address',
        editProfile: 'Edit Profile',
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
        },
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
      security: {
        passwordSecurity: 'Password & Security',
        manageSecuritySettings: 'Manage Security Settings',
        dangerZone: 'Danger Zone',
        dangerZoneWarning: 'Once you delete your account, there is no going back. Please be certain.',
        deleteAccount: 'Delete Account',
      },
    },
  },

  // =========================================================================
  // SIDEBAR
  // =========================================================================
  sidebar: {
    brand: 'CrewCast Studio',
    tagline: 'backed by selecdoo AI',
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
    },
    addCard: {
      title: 'Add Payment Method',
      subtitle: 'Your card will be saved securely',
      saveButton: 'Save Card',
      saving: 'Saving...',
    },
  },

  // =========================================================================
  // TOASTS
  // =========================================================================
  toasts: {
    success: {
      emailGenerated: 'Email generated successfully!',
      messageCopied: 'Message copied to clipboard!',
      affiliatesSaved: 'Saved to pipeline!',
      affiliatesDeleted: 'Deleted successfully',
      planChanged: 'Plan changed successfully!',
      cardAdded: 'Payment method added!',
      subscriptionCancelled: 'Subscription cancelled',
      subscriptionResumed: 'Subscription resumed!',
    },
    error: {
      genericError: 'Something went wrong. Please try again.',
      searchFailed: 'Search failed. Please try again.',
      saveFailed: 'Failed to save. Please try again.',
      deleteFailed: 'Failed to delete. Please try again.',
      emailLookupFailed: 'Failed to find emails. Please try again.',
      aiGenerationFailed: 'Failed to generate message. Please try again.',
      paymentFailed: 'Payment failed. Please try again.',
    },
    warning: {
      insufficientCredits: 'Insufficient credits. Please upgrade your plan.',
      trialEnding: 'Your trial is ending soon. Add a payment method to continue.',
      allAlreadyHaveEmails: 'All selected affiliates already have emails',
    },
    info: {
      allAlreadyInPipeline: 'All affiliates are already in your pipeline',
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
  },
};

