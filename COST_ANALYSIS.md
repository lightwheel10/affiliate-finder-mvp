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

---

## 3. Apify Credit Breakdown

The $39/month Apify plan gives you **$39 in usage credits**. The SimilarWeb scraper rental ($19/month) **comes out of these credits**.

### How Credits Are Allocated

```
Apify Plan:              $39/month
├── SimilarWeb Rental:   -$19 (monthly rental fee from credits)
└── Remaining Credits:    $20 (for all scraper usage)
```

---

## 4. Cost Per Search (KEY METRIC)

When a user searches a keyword, ALL platforms are queried and SimilarWeb data is fetched for every web result.

### Search Cost Breakdown (with 20 web results)

| Component | Service | Cost |
|-----------|---------|------|
| Web Discovery | Serper | $0.001 |
| Instagram Search | Apify | ~$0.002 |
| YouTube Search | Apify | ~$0.005 |
| TikTok Search | Apify | ~$0.002 |
| **SimilarWeb Traffic** | Apify (20 domains × $0.05) | **$1.00** |
| **TOTAL PER SEARCH** | | **~$1.01** |

### Cost Varies by Web Results Shown

| Web Results | SimilarWeb Cost | Total Per Search |
|-------------|-----------------|------------------|
| 5 results | $0.25 | **~$0.26** |
| 10 results | $0.50 | **~$0.51** |
| 20 results | $1.00 | **~$1.01** |
| 30 results | $1.50 | **~$1.51** |

> **⚠️ Important:** SimilarWeb is the biggest cost driver. Reducing web results significantly reduces cost per search.

---

## 5. Per-Email Cost Breakdown

### Email Discovery + Generation Flow

| Step | Service | Cost | Notes |
|------|---------|------|-------|
| 1. Find email | Apollo.io | $0.024* | Only charged if email found |
| 2. Generate personalized email | OpenAI GPT-4 | $0.02 | Per email generated |
| **Total per email** | | **$0.044** | |

*Apollo: First 2,500 emails/month are included in the $59 plan.

### Email Cost Examples

**Within Apollo's 2,500 limit:**
```
Apollo: $0 (included)
OpenAI: $0.02
TOTAL: $0.02 per email
```

**After exceeding 2,500 limit:**
```
Apollo: $0.024
OpenAI: $0.02
TOTAL: $0.044 per email
```

---

## 6. Monthly Cost Projections

### Light Usage (50 searches/month, 25 emails)

| Item | Calculation | Cost |
|------|-------------|------|
| Fixed costs | | $148.00 |
| Search costs | 50 × $1.01 | $50.50 |
| Apify usage | ~$50.45 (over $20 budget) | +$30.45 overage |
| Serper | Within 50K limit | $0.00 |
| Apollo | Within 2,500 limit | $0.00 |
| OpenAI | 25 × $0.02 | $0.50 |
| **TOTAL** | | **~$199** |

---

### Moderate Usage (100 searches/month, 100 emails)

| Item | Calculation | Cost |
|------|-------------|------|
| Fixed costs | | $148.00 |
| Search costs | 100 × $1.01 | $101.00 |
| Apify usage | ~$100.90 (over $20 budget) | +$80.90 overage |
| OpenAI | 100 × $0.02 | $2.00 |
| **TOTAL** | | **~$231** |

---

### Heavy Usage (200 searches/month, 300 emails)

| Item | Calculation | Cost |
|------|-------------|------|
| Fixed costs | | $148.00 |
| Search costs | 200 × $1.01 | $202.00 |
| Apify usage | ~$201.80 (over $20 budget) | +$181.80 overage |
| OpenAI | 300 × $0.02 | $6.00 |
| **TOTAL** | | **~$336** |

---

### Enterprise Usage (500 searches/month, 1,000 emails)

| Item | Calculation | Cost |
|------|-------------|------|
| Fixed costs | | $148.00 |
| Search costs | 500 × $1.01 | $505.00 |
| Apify usage | ~$504.50 (over $20 budget) | +$484.50 overage |
| OpenAI | 1,000 × $0.02 | $20.00 |
| **TOTAL** | | **~$653** |

---

## 7. Cost Optimization Options

### Option A: Reduce Web Results
| Web Results | Cost Per Search | 50 searches/mo | 100 searches/mo |
|-------------|-----------------|----------------|-----------------|
| 20 | $1.01 | ~$199 | ~$231 |
| 10 | $0.51 | ~$174 | ~$181 |
| 5 | $0.26 | ~$161 | ~$164 |

### Option B: Lazy-Load SimilarWeb
Only fetch SimilarWeb data when user clicks "View Details" instead of automatically for all results.

- **Pro:** Dramatically reduces costs
- **Con:** Slightly slower UX when viewing details

---

## 8. Quick Reference

| Action | Cost |
|--------|------|
| 1 search (20 web results) | ~$1.01 |
| 1 search (10 web results) | ~$0.51 |
| 1 search (5 web results) | ~$0.26 |
| 1 email (within 2,500 limit) | $0.02 |
| 1 email (over limit) | $0.044 |

---

## 9. Service Account Requirements

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

## 10. Summary

| Metric | Value |
|--------|-------|
| **Fixed Monthly Cost** | $148 |
| **Cost per search (20 web results)** | ~$1.01 |
| **Cost per search (10 web results)** | ~$0.51 |
| **Cost per email** | $0.02 - $0.044 |
| **Light usage (50 searches)** | ~$199/month |
| **Moderate usage (100 searches)** | ~$231/month |
| **Heavy usage (200 searches)** | ~$336/month |

---

**Prepared for:** Revenue Works Ltd (David Schmidt)  
**Prepared by:** Spectrum AI Labs (Paras)  
**Date:** December 4, 2025  

*Costs based on current API pricing - verify with providers*
