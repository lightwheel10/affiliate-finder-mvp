# Affiliate Finder

**Discover high-converting affiliate partners for your brand — in minutes, not months.**

## 🎯 What is Affiliate Finder?

Affiliate Finder is an AI-powered platform that helps SaaS companies and e-commerce brands discover, qualify, and connect with affiliate marketers who are already active in their niche.

Instead of spending hours manually searching for potential partners, our intelligent discovery engine surfaces relevant affiliates across the web — complete with verified contact information and performance insights.

## ✨ Key Features

- **🔍 Smart Discovery** — Find affiliates actively promoting products in your industry
- **📊 Performance Insights** — See traffic estimates, engagement metrics, and content quality
- **📧 Verified Contacts** — Get accurate email addresses for direct outreach
- **🔄 Continuous Monitoring** — Fresh affiliate prospects delivered regularly
- **🎯 Multi-Platform Search** — Discover partners across websites, YouTube, Instagram, and more

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Backend**: [Convex](https://convex.dev) — Real-time database & serverless functions
- **Authentication**: [Clerk](https://clerk.com) — User authentication & session management
- **Styling**: Tailwind CSS 4
- **Animation**: Framer Motion
- **Language**: TypeScript
- **Deployment**: Vercel

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Convex account (for backend)
- Clerk account (for authentication)

### Installation

```bash
# Clone the repository
git clone https://github.com/lightwheel10/affiliate-finder-mvp.git

# Navigate to project directory
cd affiliate-finder-mvp

# Install dependencies
npm install

# Set up environment variables (see .env.example)
cp .env.example .env.local

# Start Convex development server (in a separate terminal)
npx convex dev

# Start Next.js development server
npm run dev
```

### Environment Variables

Create a `.env.local` file with the following:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Convex Backend
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud

# Serper.dev - Search API (https://serper.dev)
SERPER_API_KEY=your_serper_api_key

# Google AI - Content Analysis
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
│   ├── api/           # API routes (serverless functions)
│   ├── components/    # Reusable UI components
│   ├── context/       # React context providers
│   ├── services/      # Business logic & external integrations
│   ├── discovered/    # Discovered affiliates page
│   ├── pipeline/      # Affiliate pipeline page
│   ├── saved/         # Saved affiliates page
│   └── settings/      # User settings page
├── lib/               # Utility functions
└── types/             # TypeScript type definitions
```

## 🌐 Deployment

This app is optimized for deployment on [Vercel](https://vercel.com):

1. Push your code to GitHub
2. Import the repository in Vercel
3. Deploy with one click

## 📄 License

Private - All rights reserved.

---

Built with ❤️ for affiliate marketers who value their time.
