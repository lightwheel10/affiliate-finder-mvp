export interface RestoredLocationSubscriptionSchedule {
  status: string;
  firstPaymentAt: string | null;
  nextAutoScanAt: string | null;
}

/**
 * Restored locations inherit the account-level weekly-scan choice. A paid
 * account receives a real due date; trialing/unpaid accounts stay enabled but
 * unscheduled until payment establishes the subscription schedule.
 */
export function resolveRestoredLocationSchedule(
  accountAutoScanEnabled: boolean,
  subscription: RestoredLocationSubscriptionSchedule,
  now: Date = new Date(),
): { autoScanEnabled: boolean; nextAutoScanAt: string | null } {
  if (!accountAutoScanEnabled) {
    return { autoScanEnabled: false, nextAutoScanAt: null };
  }

  if (subscription.status !== 'active' || subscription.firstPaymentAt === null) {
    return { autoScanEnabled: true, nextAutoScanAt: null };
  }

  return {
    autoScanEnabled: true,
    nextAutoScanAt: subscription.nextAutoScanAt
      ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000).toISOString(),
  };
}
