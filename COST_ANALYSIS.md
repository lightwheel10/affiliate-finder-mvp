# Crew Cast Studio - Infrastructure & Operating Costs

**Client:** Revenue Works Ltd (David Schmidt)  
**Prepared by:** Spectrum AI Labs (Paras)  
**Date:** December 2025

---

## Overview

This document outlines all operational costs required to run the Crew Cast Studio platform. All scraping services (Instagram, YouTube, TikTok, SimilarWeb) run through **Apify**, while web content discovery uses **Serper**.

---

## 1. Fixed Monthly Costs (Paid Services)

| Service | Purpose | Monthly Cost | Included Credits |
|---------|---------|--------------|------------------|
| **Apify Platform** | All scrapers (Instagram, YouTube, TikTok, SimilarWeb) | **$39.00** | $39 usage credits |
| **Serper API** | Web/Blog content discovery | **$50.00** | 50,000 searches |
| **Apollo.io** | Email finder | **$59.00** | 2,500 email credits |
| **TOTAL FIXED** | | **$148/month** | |

> **Note**: OpenAI is pay-as-you-go with no base subscription.

---

## 2. Free Tier Services (With Limits)

These services are **$0/month** until you exceed their free tier limits:

| Service | Purpose | Free Tier Limit | When Paid Plan Needed |
|---------|---------|-----------------|----------------------|
| **Vercel** | Hosting | 100GB bandwidth, 100K serverless invocations | >100GB bandwidth OR commercial use |
| **Convex** | Database | 1M function calls, 1GB storage, 1GB bandwidth | >1M calls OR >1GB storage |
| **Clerk** | Authentication | 10,000 Monthly Active Users (MAUs) | >10,000 MAUs → $0.02/MAU |

### Paid Plan Costs (If Exceeded)

| Service | Trigger | Paid Plan Cost |
|---------|---------|----------------|
| Vercel Pro | Commercial use or >100GB | $20/month |
| Convex Pro | >1M calls or >1GB storage | $25/month |
| Clerk | >10,000 MAUs | $0.02 per additional MAU |

---

## 3. Apify Credit Breakdown

The $39/month Apify plan gives you **$39 in usage credits**. The SimilarWeb scraper rental ($19/month) **comes out of these credits**.

### How Credits Are Allocated

```
Apify Plan:              $39/month
├── SimilarWeb Rental:   -$19 (monthly rental fee from credits)
└── Remaining Credits:    $20 (for all scraper usage)
```

### Scraper Costs (Per Run)

| Scraper | Actor ID | Rental Fee | Usage Cost | What You Get |
|---------|----------|------------|------------|--------------|
| **SimilarWeb** | `yOYYzj2J5K88boIVO` | $19/month (from credits) | ~$0.05/domain | Traffic, rankings, sources, keywords |
| **Instagram Profile** | `dSCLg0C3YEZ83HzYX` | $0 | ~$0.002/profile | Followers, posts, engagement |
| **Instagram Search** | `DrF9mzPPEuVizVF4l` | $0 | ~$0.002/search | Discovery + profile data |
| **YouTube** | `h7sDV53CddomktSi5` | $0 | ~$0.005/video | Views, likes, subscribers, comments |
| **TikTok** | `GdWCkxBtKWOsKjdch` | $0 | ~$0.0002/video | Followers, likes, views, engagement |

### Monthly Credit Allocation Example

Starting with $39 credits, $19 goes to SimilarWeb rental = **$20 remaining**:

| Item | Cost | Running Total |
|------|------|---------------|
| SimilarWeb Rental | $19.00 | $19.00 |
| SimilarWeb Usage (100 domains) | $5.00 | $24.00 |
| Instagram Search (100 searches) | $0.20 | $24.20 |
| Instagram Profile (500 profiles) | $1.00 | $25.20 |
| YouTube (500 videos) | $2.50 | $27.70 |
| TikTok (2,000 videos) | $0.40 | $28.10 |
| **TOTAL** | **$28.10** | ✅ Within $39 |

> **Overage**: If you exceed $39 in credits, additional usage costs ~$0.30 per compute unit.

### ⚠️ Credit Budget Warning

With SimilarWeb rental taking $19, you only have **$20/month** for actual scraping:

| Usage Level | SimilarWeb Domains | Other Scrapers | Total Usage | Within Budget? |
|-------------|-------------------|----------------|-------------|----------------|
| Light | 50 ($2.50) | $5 | $7.50 | ✅ Yes ($20) |
| Moderate | 150 ($7.50) | $10 | $17.50 | ✅ Yes ($20) |
| Heavy | 300 ($15) | $15 | $30 | ❌ Over by $10 |

---

## 4. Serper API Usage

The $50/month plan includes **50,000 searches**. One search = one API call.

| Usage Level | Searches/Month | Within Limit? | Overage Cost |
|-------------|---------------|---------------|--------------|
| Light | 5,000 | ✅ Yes | $0 |
| Moderate | 20,000 | ✅ Yes | $0 |
| Heavy | 50,000 | ✅ Yes | $0 |
| Very Heavy | 80,000 | ❌ Over by 30K | $30.00 |

> **Overage**: $0.001 per search after 50,000.

---

## 5. Per-Search Cost Breakdown

### Example: User searches "AI automation tools"

When a user performs a search, here's what happens and what it costs:

#### Step 1: Content Discovery

| Platform | Service Used | API Calls | Cost |
|----------|-------------|-----------|------|
| Web/Blogs | Serper | 1 search | $0.001 |
| Instagram | Apify Instagram Search | 1 run | $0.002 |
| YouTube | Apify YouTube Scraper | 1 run | $0.005 |
| TikTok | Apify TikTok Scraper | 1 run | $0.0002 |
| **Discovery Total** | | | **$0.0082** |

#### Step 2: Results Found

| Platform | Results Found | Per-Result Cost | Total |
|----------|--------------|-----------------|-------|
| Web/Blogs | 20 articles | Included in search | $0 |
| Instagram | 10 profiles | Included in search | $0 |
| YouTube | 10 videos | Included in search | $0 |
| TikTok | 10 videos | Included in search | $0 |
| **50 Total Results** | | | **$0** |

#### Step 3: Website Traffic Enrichment (Optional)

For each web result, user can view traffic data:

| Action | Service | Cost |
|--------|---------|------|
| View traffic for 1 website | SimilarWeb Scraper | $0.05 |
| View traffic for 5 websites | SimilarWeb Scraper | $0.25 |
| View traffic for all 20 websites | SimilarWeb Scraper | $1.00 |

#### Total Search Cost Summary

| Scenario | Discovery | Enrichment | Total |
|----------|-----------|------------|-------|
| Search only (no traffic view) | $0.0082 | $0 | **$0.01** |
| Search + 5 traffic views | $0.0082 | $0.25 | **$0.26** |
| Search + all 20 traffic views | $0.0082 | $1.00 | **$1.01** |

---

## 6. Per-Email Cost Breakdown

### Email Discovery + Generation Flow

| Step | Service | Cost | Notes |
|------|---------|------|-------|
| 1. Find email | Apollo.io | $0.024* | Only charged if email found |
| 2. Generate personalized email | OpenAI GPT-4 | $0.02 | Per email generated |
| **Total per email** | | **$0.044** | |

*Apollo only charges for successfully found emails. Within 2,500/month = $0.

### Apollo Credit Math

| Emails Found | Within 2,500? | Apollo Cost | OpenAI Cost | Total |
|--------------|---------------|-------------|-------------|-------|
| 100 | ✅ Yes | $0 | $2.00 | **$2.00** |
| 500 | ✅ Yes | $0 | $10.00 | **$10.00** |
| 2,500 | ✅ Yes | $0 | $50.00 | **$50.00** |
| 3,000 | ❌ Over by 500 | $12.00 | $60.00 | **$72.00** |

### Email Cost Examples

**Example 1: Find 50 emails from search results (within credits)**
```
Apollo: 50 emails × $0 (within 2,500 credits) = $0
OpenAI: 50 emails × $0.02 = $1.00
TOTAL: $1.00
```

**Example 2: Find 100 emails after credits exhausted**
```
Apollo: 100 emails × $0.024 = $2.40
OpenAI: 100 emails × $0.02 = $2.00
TOTAL: $4.40
```

---

## 7. Complete Search-to-Outreach Example

### Scenario: User searches "AI automation tools" and contacts 10 people

| Step | Action | Cost |
|------|--------|------|
| 1 | Search across all platforms | $0.01 |
| 2 | View traffic for 5 websites | $0.25 |
| 3 | Find 10 emails (within Apollo credits) | $0.00 |
| 4 | Generate 10 personalized emails | $0.20 |
| **TOTAL** | | **$0.46** |

### Cost Per Outreach

| Metric | Value |
|--------|-------|
| Total cost | $0.46 |
| Results found | 50 |
| Emails sent | 10 |
| **Cost per outreach** | **$0.046** |

---

## 8. Monthly Cost Projections

### Light User (~50 searches/month, 25 emails)

| Item | Cost |
|------|------|
| **Fixed Costs** | |
| Apify ($39 credits) | $39.00 |
| Serper | $50.00 |
| Apollo | $59.00 |
| **Fixed Total** | **$148.00** |
| **Variable Costs** | |
| SimilarWeb Rental (from Apify credits) | -$19.00 |
| Remaining Apify usage | ~$5.00 |
| Serper (within 50K) | $0 extra |
| Apollo (within 2,500) | $0 extra |
| OpenAI (25 emails × $0.02) | $0.50 |
| **Apify Overage** | $0 (within $39) |
| **MONTHLY TOTAL** | **$148.50** |

---

### Moderate User (~200 searches/month, 150 emails)

| Item | Cost |
|------|------|
| **Fixed Total** | **$148.00** |
| SimilarWeb Rental (from credits) | -$19.00 |
| Remaining Apify usage | ~$15.00 |
| **Apify Total** | $34.00 ✅ (within $39) |
| OpenAI (150 emails × $0.02) | $3.00 |
| **MONTHLY TOTAL** | **$151.00** |

---

### Heavy User (~500 searches/month, 500 emails)

| Item | Cost |
|------|------|
| **Fixed Total** | **$148.00** |
| SimilarWeb Rental (from credits) | -$19.00 |
| Remaining Apify usage | ~$25.00 |
| **Apify Total** | $44.00 ❌ ($5 overage) |
| Apify Overage | $5.00 |
| OpenAI (500 emails × $0.02) | $10.00 |
| **MONTHLY TOTAL** | **$163.00** |

---

### Very Heavy User (~2,000 searches/month, 2,500 emails)

| Item | Cost |
|------|------|
| **Fixed Total** | **$148.00** |
| SimilarWeb Rental (from credits) | -$19.00 |
| Remaining Apify usage | ~$40.00 |
| **Apify Total** | $59.00 ❌ ($20 overage) |
| Apify Overage | $20.00 |
| OpenAI (2,500 emails × $0.02) | $50.00 |
| **MONTHLY TOTAL** | **$218.00** |

---

### Enterprise User (~5,000 searches/month, 4,000 emails)

| Item | Cost |
|------|------|
| **Fixed Total** | **$148.00** |
| SimilarWeb Rental (from credits) | -$19.00 |
| Remaining Apify usage | ~$70.00 |
| **Apify Total** | $89.00 ❌ ($50 overage) |
| Apify Overage | $50.00 |
| Apollo Overage (1,500 × $0.024) | $36.00 |
| OpenAI (4,000 emails × $0.02) | $80.00 |
| **MONTHLY TOTAL** | **$314.00** |

---

## 9. Quick Reference - Cost Per Action

| Action | Service | Cost |
|--------|---------|------|
| 1 web search | Serper | $0.001 |
| 1 Instagram search | Apify | $0.002 |
| 1 Instagram profile | Apify | $0.002 |
| 1 YouTube search (10 videos) | Apify | $0.005 |
| 1 TikTok search (10 videos) | Apify | $0.0002 |
| 1 website traffic lookup | Apify SimilarWeb | $0.05 |
| 1 email lookup (found) | Apollo | $0.024* |
| 1 email generation | OpenAI | $0.02 |

*Within 2,500/month included credits = $0.

---

## 10. Service Account Requirements

### Required Accounts

| Service | Account Type | Signup URL |
|---------|--------------|------------|
| Apify | Starter ($39/mo) | apify.com |
| Serper | Standard ($50/mo) | serper.dev |
| Apollo.io | Basic ($59/mo) | apollo.io |
| OpenAI | Pay-as-you-go | platform.openai.com |
| Vercel | Free/Hobby | vercel.com |
| Convex | Free | convex.dev |
| Clerk | Free | clerk.com |

### API Keys Needed

```
APIFY_TOKEN=apify_api_xxx
SERPER_API_KEY=xxx
APOLLO_API_KEY=xxx
OPENAI_API_KEY=sk-xxx
```

---

## 11. Summary

| Metric | Value |
|--------|-------|
| **Base Monthly Cost** | $148 (Apify $39 + Serper $50 + Apollo $59) |
| **Typical Monthly Cost** | $150-165 (light to moderate use) |
| **Heavy Usage Cost** | $220-320 (high volume) |
| **Cost per search** | ~$0.01 |
| **Cost per outreach** | ~$0.05 |

### Apify Credit Reality Check

```
Apify Plan:              $39/month = $39 credits
├── SimilarWeb Rental:   $19 (from credits)
└── Available for Usage: $20 (for all scraper runs)

⚠️  Heavy SimilarWeb usage will push you into overage quickly!
```

---

---

**Prepared for:** Revenue Works Ltd (David Schmidt)  
**Prepared by:** Spectrum AI Labs (Paras)  
**Date:** December 4, 2025  

*Costs based on current API pricing - verify with providers*
