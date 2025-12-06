import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { findEmailWithApollo, APOLLO_EMAIL_COST } from '@/app/services/apollo';
import { trackApiCall } from '@/app/services/tracking';

/**
 * Email Discovery API
 * 
 * POST /api/enrich/email - Find email for a saved affiliate
 * 
 * Request body:
 * - affiliateId: number (saved_affiliates.id)
 * - userId: number (for tracking)
 * - domain: string (website domain)
 * - personName?: string (optional name to search for)
 * 
 * Returns:
 * - email: string | null
 * - status: 'found' | 'not_found' | 'error'
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { affiliateId, userId, domain, personName } = body;

    if (!affiliateId || !userId || !domain) {
      return NextResponse.json(
        { error: 'affiliateId, userId, and domain are required' },
        { status: 400 }
      );
    }

    // TODO: Check user credits before proceeding
    // const hasCredits = await checkUserCredits(userId, 'email_lookup');
    // if (!hasCredits) {
    //   return NextResponse.json({ error: 'Insufficient email credits' }, { status: 402 });
    // }

    // Update status to 'searching'
    await sql`
      UPDATE saved_affiliates 
      SET email_status = 'searching'
      WHERE id = ${affiliateId} AND user_id = ${userId}
    `;

    // Call Apollo API
    const result = await findEmailWithApollo(domain, personName);

    // Track the API call
    await trackApiCall({
      userId,
      service: 'apollo_email',
      endpoint: 'mixed_people/search',
      domain,
      status: result.error ? 'error' : 'success',
      resultsCount: result.found ? 1 : 0,
      errorMessage: result.error,
      estimatedCost: APOLLO_EMAIL_COST,
      durationMs: Date.now() - startTime,
    });

    // Determine final status
    let emailStatus: 'found' | 'not_found' | 'error';
    if (result.error) {
      emailStatus = 'error';
    } else if (result.found && result.email) {
      emailStatus = 'found';
    } else {
      emailStatus = 'not_found';
    }

    // Update the affiliate record with results
    await sql`
      UPDATE saved_affiliates 
      SET 
        email = ${result.email || null},
        email_status = ${emailStatus},
        email_searched_at = NOW(),
        email_provider = 'apollo'
      WHERE id = ${affiliateId} AND user_id = ${userId}
    `;

    // TODO: Deduct user credits after successful lookup
    // await deductCredits(userId, 'email_lookup', 1);

    return NextResponse.json({
      email: result.email,
      status: emailStatus,
      firstName: result.firstName,
      lastName: result.lastName,
      title: result.title,
    });

  } catch (error: any) {
    console.error('Email enrichment error:', error);
    return NextResponse.json(
      { error: 'Failed to find email', details: error.message },
      { status: 500 }
    );
  }
}

