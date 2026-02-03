# CrewCast Studio

**Discover high-converting affiliate partners for your brand — in minutes, not months.**

*Powered by Selecdoo AI*

## 🎯 What is CrewCast Studio?

CrewCast Studio is an AI-powered affiliate discovery platform that helps brands find, qualify, and connect with content creators and affiliate marketers who are already active in their niche.

Stop spending 20+ hours a week manually searching for affiliates. Our intelligent discovery engine surfaces relevant partners across multiple platforms — complete with verified contact information and performance insights.

## ✨ Key Features

- **🔍 Reverse-Engineer Competitor Programs** — Find all their top affiliates across 100+ networks
- **📊 Multi-Platform Discovery** — Search across Google, YouTube, Instagram, TikTok, and more
- **📧 Verified Email Enrichment** — Get accurate contact information with 90%+ success rate
- **💾 Save & Organize** — Build your affiliate pipeline with saved prospects
- **📈 Performance Insights** — View traffic estimates, engagement metrics, and content quality
- **🎯 Smart Filtering** — Filter by platform, engagement, and relevance
- **⚡ Bulk Actions** — Save or delete multiple affiliates at once
- **🔄 Real-time Updates** — Fresh affiliate prospects delivered regularly

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router with Turbopack)
- **Database**: Neon (Serverless PostgreSQL)
- **Authentication**: Stack Auth
- **Styling**: Tailwind CSS 4
- **Animation**: Framer Motion
- **AI**: Google Generative AI
- **Data Enrichment**: Apollo, Lusha
- **Web Scraping**: Apify
- **Language**: TypeScript
- **Deployment**: Vercel

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Neon database account
- Stack Auth account

### Installation

```bash
# Clone the repository
git clone https://github.com/lightwheel10/affiliate-finder-mvp.git

# Navigate to project directory
cd affiliate-finder

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file with the following required variables:

```env
# Database
DATABASE_URL=postgresql://...

# Authentication
NEXT_PUBLIC_STACK_PROJECT_ID=your_project_id
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=your_publishable_key
STACK_SECRET_SERVER_KEY=your_secret_key

# Search & Discovery APIs
APIFY_API_TOKEN=your_apify_token

# Email Enrichment (Optional)
LUSHA_API_KEY=your_lusha_key
APOLLO_API_KEY=your_apollo_key

# AI (Optional)
GOOGLE_API_KEY=your_google_ai_key
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Build for Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
src/
├── app/
│   ├── api/              # API routes & serverless functions
│   │   ├── affiliates/   # Affiliate CRUD operations
│   │   ├── scout/        # Discovery & search endpoints
│   │   ├── enrich/       # Email enrichment endpoints
│   │   └── subscriptions/# Subscription management
│   ├── components/       # Reusable UI components
│   │   └── landing/      # Landing page components
│   ├── hooks/            # Custom React hooks
│   ├── services/         # Business logic & external integrations
│   │   ├── apify.ts      # Web scraping service
│   │   ├── search.ts     # Search aggregation
│   │   ├── analysis.ts   # AI content analysis
│   │   └── enrichment/   # Email enrichment providers
│   ├── discovered/       # Discovered affiliates page
│   ├── saved/            # Saved affiliates page
│   ├── dashboard/        # Analytics dashboard
│   ├── outreach/         # Outreach management
│   └── settings/         # User settings
├── lib/                  # Utility functions & database client
└── types/                # TypeScript type definitions
```

## 🌐 Deployment

This app is optimized for deployment on [Vercel](https://vercel.com):

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy with one click

**Important:** Make sure to set all required environment variables in your Vercel project settings before deploying.

## 🔧 Development

### Running Tests

```bash
# Test individual scrapers
npm run test:youtube
npm run test:instagram
npm run test:tiktok
```

### Project Documentation

- `DESIGN_SPECS.md` — UI/UX design specifications and color palette
- `PRODUCTION_ARCHITECTURE.md` — Production architecture overview
- `MIGRATION_PLAN.md` — Database migration strategies
- `APIFY_INTEGRATION_PLAN.md` — Apify scraper integration details
- `COST_ANALYSIS.md` — Cost analysis and optimization strategies

## 📄 License

Private - All rights reserved.

---

**Built with ❤️ by Selecdoo AI**
