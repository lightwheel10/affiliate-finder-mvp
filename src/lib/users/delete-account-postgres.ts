export interface AccountDeletionSqlExecutor {
  <T extends object = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<readonly T[]>;
}

export interface AccountDeletionDatabase extends AccountDeletionSqlExecutor {
  begin<T>(
    operation: (transaction: AccountDeletionSqlExecutor) => Promise<T>,
  ): Promise<T>;
}

export interface DeletedAccountData {
  savedAffiliates: number;
  discoveredAffiliates: number;
  searches: number;
  apiCalls: number;
  suggestionAnalyses: number;
  onboardingEntitlements: number;
  searchReservations: number;
  subscriptions: number;
}

/**
 * Deletes one account's application data atomically. Every workflow that can
 * create a restrictive search/entitlement child locks the same user row first,
 * so no such child can be recreated between these deletes and the user delete.
 */
export function deletePostgresAccountData(
  accountId: number,
  database: AccountDeletionDatabase,
): Promise<DeletedAccountData> {
  return database.begin(async (transaction) => {
    const lockedAccounts = await transaction`
      SELECT id
      FROM crewcast.users
      WHERE id = ${accountId}
      FOR UPDATE
    `;
    if (lockedAccounts.length !== 1) {
      throw new Error('The account disappeared before database deletion started.');
    }

    const deletedSaved = await transaction`
      DELETE FROM crewcast.saved_affiliates WHERE user_id = ${accountId}
      RETURNING id
    `;
    const deletedDiscovered = await transaction`
      DELETE FROM crewcast.discovered_affiliates WHERE user_id = ${accountId}
      RETURNING id
    `;
    const deletedSearches = await transaction`
      DELETE FROM crewcast.searches WHERE user_id = ${accountId}
      RETURNING id
    `;
    const deletedApiCalls = await transaction`
      DELETE FROM crewcast.api_calls WHERE user_id = ${accountId}
      RETURNING id
    `;

    // These server-owned claims deliberately use restrictive lifecycle rules.
    // Remove them explicitly before the account cascade reaches their parents
    // so the deletion audit reports every protected-cost record it erased.
    const deletedSuggestionAnalyses = await transaction`
      DELETE FROM crewcast.onboarding_suggestion_analyses
      WHERE user_id = ${accountId}
      RETURNING user_id
    `;
    const deletedOnboardingEntitlements = await transaction`
      DELETE FROM crewcast.onboarding_search_entitlements
      WHERE user_id = ${accountId}
      RETURNING user_id
    `;
    const deletedSearchReservations = await transaction`
      DELETE FROM crewcast.search_credit_reservations
      WHERE user_id = ${accountId}
      RETURNING id
    `;
    const deletedSubscriptions = await transaction`
      DELETE FROM crewcast.subscriptions WHERE user_id = ${accountId}
      RETURNING id
    `;
    const deletedUsers = await transaction`
      DELETE FROM crewcast.users WHERE id = ${accountId}
      RETURNING id
    `;
    if (deletedUsers.length !== 1) {
      throw new Error('The account was not deleted exactly once.');
    }

    return {
      savedAffiliates: deletedSaved.length,
      discoveredAffiliates: deletedDiscovered.length,
      searches: deletedSearches.length,
      apiCalls: deletedApiCalls.length,
      suggestionAnalyses: deletedSuggestionAnalyses.length,
      onboardingEntitlements: deletedOnboardingEntitlements.length,
      searchReservations: deletedSearchReservations.length,
      subscriptions: deletedSubscriptions.length,
    };
  });
}
