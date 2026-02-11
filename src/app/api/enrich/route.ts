import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { enrichDomainWithSimilarWeb, enrichDomainsWithSimilarWeb } from '../../services/apify';

/**
 * SimilarWeb Enrichment API
 * 
 * POST /api/enrich - Enrich domains with SimilarWeb traffic data
 * 
 * Request body:
 * - domain: string (single domain)
 * - domains: string[] (multiple domains)
 * - userId: number (for API tracking)
 * 
 * Returns SimilarWeb data including:
 * - Monthly visits
 * - Global/country rank
 * - Bounce rate, pages per visit, time on site
 * - Traffic sources breakdown
 * - Top countries
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { domain, domains, userId } = body;

    if (userId != null) {
      const userCheck = await sql`SELECT email FROM crewcast.users WHERE id = ${userId}`;
      if (userCheck.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      if (authUser.email !== (userCheck[0] as { email: string }).email) {
        return NextResponse.json({ error: 'Not authorized to access this resource' }, { status: 403 });
      }
    }

    // Single domain enrichment
    if (domain && typeof domain === 'string') {
      console.log(`📊 Enriching single domain: ${domain}`);
      
      const data = await enrichDomainWithSimilarWeb(domain, userId);
      
      if (!data) {
        return NextResponse.json({ 
          error: 'No data available for this domain',
          domain 
        }, { status: 404 });
      }
      
      return NextResponse.json({ data });
    }

    // Multiple domains enrichment
    if (domains && Array.isArray(domains) && domains.length > 0) {
      console.log(`📊 Enriching ${domains.length} domains`);
      
      // Limit to 10 domains per request to prevent abuse
      const domainsToEnrich = domains.slice(0, 10);
      
      const results = await enrichDomainsWithSimilarWeb(domainsToEnrich, userId);
      
      // Convert Map to object for JSON response
      const data: Record<string, any> = {};
      results.forEach((value, key) => {
        data[key] = value;
      });
      
      return NextResponse.json({ 
        data,
        enriched: results.size,
        total: domainsToEnrich.length 
      });
    }

    return NextResponse.json({ 
      error: 'Either domain or domains array is required' 
    }, { status: 400 });

  } catch (error) {
    console.error('Error enriching domains:', error);
    return NextResponse.json({ 
      error: 'Failed to enrich domains' 
    }, { status: 500 });
  }
}

