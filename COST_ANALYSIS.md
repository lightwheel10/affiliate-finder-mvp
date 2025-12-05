# Crew Cast Studio - Infrastructure & Operating Costs

**Client:** Revenue Works Ltd (David Schmidt)  
**Prepared by:** Spectrum AI Labs (Paras)  
**Date:** December 2025

---

## Overview

This document outlines all operational costs required to run the Crew Cast Studio platform.

---

## User Flow & Cost Structure

### Step 1: Keyword Search (1-5 keywords per session)

For **each keyword** searched, the following API calls are made:

| Service | Purpose | Cost |
|---------|---------|------|
| Serper | Web/Blog discovery (1 call) | $0.001 |
| SimilarWeb | Traffic data for each web result | $0.05 × web results |
| Apify Instagram | Search + full profile stats | ~$0.002 |
| Apify YouTube | Search + full channel/video stats | ~$0.005 |
| Apify TikTok | Search + full creator stats | ~$0.002 |

> **Note:** Apify scrapers return complete profile/channel statistics. No additional API calls needed for social media stats.

### Step 2: Browse & Save

- User reviews all results from all platforms
- Saves contacts they want to reach out to
- **Cost: $0** (no API calls)

### Step 3: Email Outreach (User-Initiated)

| Service | Purpose | Cost |
|---------|---------|------|
| Apollo.io | Find email address | $0 (within 2,500/mo) or $0.024 |
| OpenAI | Generate personalized email | $0.02 per email |

---

## Cost Per Keyword Search

The main cost driver is **SimilarWeb** ($0.05 per domain).

### With 20 Web Results (Default)

| Component | Cost |
|-----------|------|
| Serper (1 web search) | $0.001 |
| SimilarWeb (20 domains × $0.05) | $1.00 |
| Apify Instagram Search | ~$0.002 |
| Apify YouTube Scraper | ~$0.005 |
| Apify TikTok Scraper | ~$0.002 |
| **TOTAL PER KEYWORD** | **~$1.01** |

### Cost by Web Results Configuration

| Web Results | SimilarWeb Cost | Total Per Keyword |
|-------------|-----------------|-------------------|
| 1 result | $0.05 | **~$0.06** |
| 5 results | $0.25 | **~$0.26** |
| 10 results | $0.50 | **~$0.51** |
| 20 results | $1.00 | **~$1.01** |
| 30 results | $1.50 | **~$1.51** |

### Max Session Cost (5 Keywords)

| Web Results | Per Keyword | Per Session (5 keywords) |
|-------------|-------------|--------------------------|
| 1 result | $0.06 | **$0.30** |
| 5 results | $0.26 | **$1.30** |
| 10 results | $0.51 | **$2.55** |
| 20 results | $1.01 | **$5.05** |

---

## Email Costs

### Within Apollo's 2,500/month Limit

| Action | Cost |
|--------|------|
| Find email (Apollo) | $0 (included) |
| Generate email (OpenAI) | $0.02 |
| **Total per email** | **$0.02** |

### After Exceeding 2,500 Limit

| Action | Cost |
|--------|------|
| Find email (Apollo overage) | $0.024 |
| Generate email (OpenAI) | $0.02 |
| **Total per email** | **$0.044** |

---

## Fixed Monthly Costs

| Service | Purpose | Monthly Cost | Included |
|---------|---------|--------------|----------|
| **Apify** | All scrapers | $39.00 | $39 credits (−$19 SimilarWeb rental = $20 usage) |
| **Serper** | Web discovery | $50.00 | 50,000 searches |
| **Apollo.io** | Email finder | $59.00 | 2,500 email lookups |
| **TOTAL** | | **$148.00** | |

### Free Tier Services

| Service | Purpose | Free Limit | Paid Trigger |
|---------|---------|------------|--------------|
| Vercel | Hosting | 100GB bandwidth | Commercial use |
| Convex | Database | 1M calls, 1GB storage | Exceeding limits |
| Clerk | Auth | 10,000 MAUs | >10,000 users |

---

## Monthly Cost Projections

### Light Usage (5 keywords/month, 50 emails)

| Item | Calculation | Cost |
|------|-------------|------|
| Fixed costs | | $148.00 |
| Search costs | 5 × $1.01 | $5.05 |
| Apify usage | $5.05 (within $20 budget) | $0.00 overage |
| OpenAI | 50 × $0.02 | $1.00 |
| **TOTAL** | | **~$154** |

### Moderate Usage (20 keywords/month, 200 emails)

| Item | Calculation | Cost |
|------|-------------|------|
| Fixed costs | | $148.00 |
| Search costs | 20 × $1.01 | $20.20 |
| Apify usage | $20.20 (just over $20 budget) | $0.20 overage |
| OpenAI | 200 × $0.02 | $4.00 |
| **TOTAL** | | **~$152** |

### Heavy Usage (50 keywords/month, 500 emails)

| Item | Calculation | Cost |
|------|-------------|------|
| Fixed costs | | $148.00 |
| Search costs | 50 × $1.01 | $50.50 |
| Apify usage | $50.50 (over $20 budget) | $30.50 overage |
| OpenAI | 500 × $0.02 | $10.00 |
| **TOTAL** | | **~$189** |

### Enterprise Usage (100 keywords/month, 1,500 emails)

| Item | Calculation | Cost |
|------|-------------|------|
| Fixed costs | | $148.00 |
| Search costs | 100 × $1.01 | $101.00 |
| Apify usage | $101.00 (over $20 budget) | $81.00 overage |
| OpenAI | 1,500 × $0.02 | $30.00 |
| **TOTAL** | | **~$259** |

---

## Cost Optimization

### Option 1: Reduce Web Results

Reducing web results from 20 to 10 cuts keyword cost in half:

| Config | Per Keyword | 50 keywords/month |
|--------|-------------|-------------------|
| 20 web results | $1.01 | $50.50 |
| 10 web results | $0.51 | $25.50 |
| 5 web results | $0.26 | $13.00 |

### Option 2: Minimum Viable (1 Web Result)

For absolute minimum cost (~$0.06/keyword):
- Show 1 top web result with traffic data
- Full social media results (no cost difference)

---

## Quick Reference

| Metric | Value |
|--------|-------|
| **Fixed monthly cost** | $148 |
| **Cost per keyword (20 web)** | ~$1.01 |
| **Cost per keyword (10 web)** | ~$0.51 |
| **Cost per keyword (5 web)** | ~$0.26 |
| **Cost per keyword (1 web)** | ~$0.06 |
| **Max session (5 keywords, 20 web)** | ~$5.05 |
| **Cost per email (within limit)** | $0.02 |
| **Cost per email (over limit)** | $0.044 |

---

## API Keys Required

```
APIFY_TOKEN=apify_api_xxx
SERPER_API_KEY=xxx
APOLLO_API_KEY=xxx
OPENAI_API_KEY=sk-xxx
```

---

**Prepared for:** Revenue Works Ltd (David Schmidt)  
**Prepared by:** Spectrum AI Labs (Paras)  
**Date:** December 4, 2025  

*Costs based on current API pricing - verify with providers*
