import { z } from 'zod';
import { isValidBrandDomainInput } from '@/lib/brands/domain';
import {
  isMarketCountryName,
  isMarketLanguageName,
} from '@/lib/markets/catalog';
import { SEARCH_INPUT_LIMITS } from '@/lib/plans/catalog';

const trimmedString = (maximum: number) =>
  z.string().trim().min(1).max(maximum);

const nullableTrimmedString = (maximum: number) =>
  z.union([
    z.string().trim().max(maximum).transform((value) => value || null),
    z.null(),
  ]);

const uniqueStringArray = (maximumItems: number, maximumLength = 255) =>
  z
    .array(trimmedString(maximumLength))
    .max(maximumItems)
    .transform((items) => [...new Set(items)]);

const countryName = z
  .string()
  .refine(isMarketCountryName, 'Unsupported market country');
const languageName = z
  .string()
  .refine(isMarketLanguageName, 'Unsupported market language');
const brandDomain = trimmedString(255).refine(
  isValidBrandDomainInput,
  'Invalid brand domain',
);

export const createAccountInputSchema = z
  .object({
    name: trimmedString(120),
    // Explicit rolling-client compatibility fields. They are validated and
    // discarded below; authenticated identity and server defaults remain the
    // only authorities for account creation.
    email: z.string().email().optional(),
    isOnboarded: z.boolean().optional(),
    onboardingStep: z.number().int().optional(),
    hasSubscription: z.boolean().optional(),
    plan: z.string().optional(),
  })
  .strict()
  .transform(({ name }) => ({ name }));

export const profilePatchInputSchema = z
  .object({
    // Accepted temporarily for rolling-client compatibility, but never used as
    // the database owner. The authenticated account ID is authoritative.
    id: z.number().int().positive().optional(),
    name: trimmedString(120).optional(),
    onboardingStep: z.number().int().min(1).max(7).optional(),
    role: nullableTrimmedString(120).optional(),
    brand: nullableTrimmedString(255).optional(),
    bio: nullableTrimmedString(5_000).optional(),
    trialPlan: z.enum(['pro', 'business']).nullable().optional(),
    targetCountry: z.union([countryName, z.null()]).optional(),
    targetLanguage: z.union([languageName, z.null()]).optional(),
    competitors: uniqueStringArray(SEARCH_INPUT_LIMITS.maxCompetitors).optional(),
    topics: uniqueStringArray(SEARCH_INPUT_LIMITS.maxKeywords).optional(),
    affiliateTypes: uniqueStringArray(20, 120).optional(),
    emailMatches: z.boolean().optional(),
    emailReports: z.boolean().optional(),
    emailUpdates: z.boolean().optional(),
    appReplies: z.boolean().optional(),
    appReminders: z.boolean().optional(),
    profileImageUrl: nullableTrimmedString(2_048).optional(),
    autoScanEnabled: z.boolean().optional(),
  })
  .strict()
  .refine(
    (input) => Object.keys(input).some((key) => key !== 'id'),
    'At least one profile field is required',
  );

export const completeOnboardingInputSchema = z
  .object({
    id: z.number().int().positive().optional(),
    name: trimmedString(120),
    role: trimmedString(120),
    brand: brandDomain,
    targetCountry: countryName,
    targetLanguage: languageName,
    competitors: uniqueStringArray(SEARCH_INPUT_LIMITS.maxCompetitors),
    topics: uniqueStringArray(SEARCH_INPUT_LIMITS.maxKeywords),
    affiliateTypes: uniqueStringArray(20, 120),
  })
  .strict();

export type ProfilePatchInput = z.infer<typeof profilePatchInputSchema>;
export type CompleteOnboardingInput = z.infer<
  typeof completeOnboardingInputSchema
>;
