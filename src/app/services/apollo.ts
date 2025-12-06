/**
 * Apollo.io Email Discovery Service
 * 
 * Uses Apollo's People API to find email addresses for affiliates
 * based on their domain and optional person name.
 */

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

export interface ApolloEmailResult {
  email: string | null;
  firstName?: string;
  lastName?: string;
  title?: string;
  linkedinUrl?: string;
  found: boolean;
  error?: string;
}

/**
 * Search for email using Apollo's People Search API
 * 
 * @param domain - The company/website domain (e.g., "techcrunch.com")
 * @param personName - Optional person name to narrow down search
 * @returns Email result or null if not found
 */
export async function findEmailWithApollo(
  domain: string,
  personName?: string
): Promise<ApolloEmailResult> {
  if (!APOLLO_API_KEY) {
    console.error('❌ Missing APOLLO_API_KEY in environment variables');
    return { email: null, found: false, error: 'API key not configured' };
  }

  // Clean domain (remove protocol, www, paths)
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .toLowerCase();

  console.log(`📧 Apollo email search: domain="${cleanDomain}", person="${personName || 'any'}"`);

  try {
    // Build search payload
    const searchPayload: Record<string, any> = {
      q_organization_domains: cleanDomain,
      page: 1,
      per_page: 1, // We only need one result
    };

    // Add person name filter if provided
    if (personName) {
      const nameParts = personName.trim().split(' ');
      if (nameParts.length >= 2) {
        searchPayload.q_keywords = personName;
      } else if (nameParts.length === 1) {
        searchPayload.q_keywords = nameParts[0];
      }
    }

    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': APOLLO_API_KEY,
      },
      body: JSON.stringify(searchPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Apollo API error: ${response.status} - ${errorText}`);
      return { 
        email: null, 
        found: false, 
        error: `API error: ${response.status}` 
      };
    }

    const data = await response.json();
    
    // Check if we got results
    if (!data.people || data.people.length === 0) {
      console.log(`⚠️ Apollo: No people found for ${cleanDomain}`);
      return { email: null, found: false };
    }

    const person = data.people[0];
    
    // Check if email is available
    if (person.email) {
      console.log(`✅ Apollo: Found email for ${cleanDomain}`);
      return {
        email: person.email,
        firstName: person.first_name,
        lastName: person.last_name,
        title: person.title,
        linkedinUrl: person.linkedin_url,
        found: true,
      };
    }

    // If no direct email, try to get it via reveal endpoint (costs credits)
    // For now, we'll just return not found
    console.log(`⚠️ Apollo: Person found but no email available for ${cleanDomain}`);
    return { 
      email: null, 
      firstName: person.first_name,
      lastName: person.last_name,
      found: false 
    };

  } catch (error: any) {
    console.error('❌ Apollo email search error:', error.message);
    return { 
      email: null, 
      found: false, 
      error: error.message 
    };
  }
}

/**
 * Estimate cost for Apollo API call
 * Apollo pricing: ~$0.03 per email credit
 */
export const APOLLO_EMAIL_COST = 0.03;

