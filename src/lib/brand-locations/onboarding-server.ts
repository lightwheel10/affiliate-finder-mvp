import 'server-only';

import {
  completePostgresAccountOnboarding,
  type OnboardingDatabase,
} from '@/lib/brand-locations/onboarding-postgres';
import { sql } from '@/lib/db';
import type { CompleteOnboardingInput } from '@/lib/users/profile-input';

export function completeServerAccountOnboarding(
  accountId: number,
  input: CompleteOnboardingInput,
) {
  return completePostgresAccountOnboarding(
    accountId,
    input,
    sql as OnboardingDatabase,
  );
}
