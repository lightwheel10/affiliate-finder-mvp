import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { sql } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/supabase/server'; // January 19th, 2026: Migrated from Stack Auth

// =============================================================================
// GET /api/stripe/invoices
// 
// Created: December 2025
// Author: Development Team
// 
// PURPOSE:
// Fetches invoices from Stripe for the authenticated user.
// Returns invoice history including $0 trial invoices and paid invoices.
//
// SECURITY:
// - Requires authenticated Stack Auth session
// - Verifies authenticated user matches the requested userId
// - Only returns invoices for the user's own Stripe customer
//
// RESPONSE:
// Returns an array of invoices with:
// - id: Stripe invoice ID
// - number: Human-readable invoice number
// - amount_due: Amount in cents
// - amount_paid: Amount paid in cents
// - currency: Currency code (e.g., 'eur')
// - status: 'draft', 'open', 'paid', 'uncollectible', 'void'
// - created: Unix timestamp
// - hosted_invoice_url: Link to view invoice on Stripe
// - invoice_pdf: Link to download PDF
// - description: Invoice description or plan name
// =============================================================================

// Force dynamic rendering - this route uses authentication
export const dynamic = 'force-dynamic';

// Invoice interface for type safety
interface InvoiceResponse {
  id: string;
  number: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string | null;
  created: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  description: string | null;
  subscription_id: string | null;
}

export async function GET(request: NextRequest) {
  try {
    // =========================================================================
    // STEP 1: AUTHENTICATION
    // Verify the user is authenticated via Stack Auth
    // =========================================================================
    const authUser = await getAuthenticatedUser();
    
    if (!authUser) {
      console.error('[Stripe Invoices] Unauthorized: No authenticated user');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // =========================================================================
    // STEP 2: GET USER ID FROM QUERY PARAMS
    // =========================================================================
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // =========================================================================
    // STEP 3: GET USER AND STRIPE CUSTOMER ID FROM DATABASE
    // =========================================================================
    const users = await sql`
      SELECT u.id, u.email, s.stripe_customer_id
      FROM crewcast.users u
      LEFT JOIN crewcast.subscriptions s ON u.id = s.user_id
      WHERE u.id = ${userIdNum}
    `;

    if (users.length === 0) {
      console.error(`[Stripe Invoices] User not found: ${userIdNum}`);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = users[0];

    // =========================================================================
    // STEP 4: AUTHORIZATION CHECK
    // Verify the authenticated user matches the requested user
    // This prevents users from viewing other users' invoices
    // =========================================================================
    if (authUser.email !== userData.email) {
      console.error(`[Stripe Invoices] Authorization failed: ${authUser.email} tried to access invoices for user ${userIdNum} (${userData.email})`);
      return NextResponse.json(
        { error: 'Not authorized to access this resource' },
        { status: 403 }
      );
    }

    // =========================================================================
    // STEP 5: CHECK IF USER HAS A STRIPE CUSTOMER
    // =========================================================================
    const stripeCustomerId = userData.stripe_customer_id;

    if (!stripeCustomerId) {
      // User has no Stripe customer - return empty array (not an error)
      console.log(`[Stripe Invoices] No Stripe customer for user ${userIdNum}, returning empty invoices`);
      return NextResponse.json({
        success: true,
        invoices: [],
      });
    }

    // =========================================================================
    // STEP 6: FETCH INVOICES FROM STRIPE
    // Limit to 20 most recent invoices
    // =========================================================================
    console.log(`[Stripe Invoices] Fetching invoices for customer ${stripeCustomerId}`);

    let stripeInvoices;
    try {
      stripeInvoices = await stripe.invoices.list({
        customer: stripeCustomerId,
        limit: 20,
        // Include all statuses - paid, open, void, etc.
      });
    } catch (error) {
      console.error(`[Stripe Invoices] Failed to fetch invoices from Stripe:`, error);
      return NextResponse.json(
        { error: 'Failed to fetch invoices' },
        { status: 500 }
      );
    }

    // =========================================================================
    // STEP 7: TRANSFORM INVOICES FOR RESPONSE
    // Only include fields that are safe and useful for the frontend
    // =========================================================================
    const invoices: InvoiceResponse[] = stripeInvoices.data.map((invoice) => {
      // Get description from the first line item if available
      let description: string | null = null;
      if (invoice.lines?.data?.length > 0) {
        const firstLine = invoice.lines.data[0];
        description = firstLine.description || null;
      }

      // Fallback description
      if (!description && invoice.billing_reason) {
        const reasonMap: Record<string, string> = {
          'subscription_create': 'Subscription created',
          'subscription_cycle': 'Subscription renewal',
          'subscription_update': 'Subscription updated',
          'subscription_threshold': 'Usage threshold reached',
          'upcoming': 'Upcoming invoice',
          'manual': 'Manual invoice',
        };
        description = reasonMap[invoice.billing_reason] || invoice.billing_reason;
      }

      // Safely access subscription - can be string, object, or null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoiceAny = invoice as any;
      let subscriptionId: string | null = null;
      if (typeof invoiceAny.subscription === 'string') {
        subscriptionId = invoiceAny.subscription;
      } else if (invoiceAny.subscription && typeof invoiceAny.subscription === 'object') {
        subscriptionId = invoiceAny.subscription.id || null;
      }

      return {
        id: invoice.id,
        number: invoice.number,
        amount_due: invoice.amount_due,
        amount_paid: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status,
        created: invoice.created,
        hosted_invoice_url: invoice.hosted_invoice_url || null,
        invoice_pdf: invoice.invoice_pdf || null,
        description,
        subscription_id: subscriptionId,
      };
    });

    console.log(`[Stripe Invoices] Returning ${invoices.length} invoices for user ${userIdNum}`);

    // =========================================================================
    // STEP 8: RETURN SUCCESS RESPONSE
    // =========================================================================
    return NextResponse.json({
      success: true,
      invoices,
    });

  } catch (error) {
    // =========================================================================
    // ERROR HANDLING
    // Log error and return generic message to avoid leaking details
    // =========================================================================
    console.error('[Stripe Invoices] Unexpected error:', error);
    
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
