import { z } from 'zod';
import { BRAND_LOCATION_MANAGEMENT_LIMITS } from '@/lib/brand-locations/limits';

const trimmedText = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength);

const uniqueTextArray = (maxItems: number, maxLength = 120) =>
  z.array(trimmedText(maxLength)).max(maxItems).superRefine((items, context) => {
    const normalized = items.map((item) => item.toLocaleLowerCase('en-US'));
    if (new Set(normalized).size !== normalized.length) {
      context.addIssue({
        code: 'custom',
        message: 'Values must be unique.',
      });
    }
  });

const countryCode = z.string().trim().toLowerCase().regex(/^[a-z]{2}$/);
const languageCode = z.string().trim().toLowerCase().regex(/^[a-z]{2}$/);

export const createBrandSchema = z.object({
  name: trimmedText(255),
  domain: trimmedText(2_048),
  bio: z.union([z.string().trim().max(5_000), z.null()]).optional(),
  affiliateTypes: uniqueTextArray(BRAND_LOCATION_MANAGEMENT_LIMITS.affiliateTypes).optional().default([]),
}).strict();

export const updateBrandSchema = z.object({
  name: trimmedText(255).optional(),
  domain: trimmedText(2_048).optional(),
  bio: z.union([z.string().trim().max(5_000), z.null()]).optional(),
  affiliateTypes: uniqueTextArray(BRAND_LOCATION_MANAGEMENT_LIMITS.affiliateTypes).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one brand field is required.',
});

export const createLocationSchema = z.object({
  countryCode,
  languageCode,
  topics: uniqueTextArray(BRAND_LOCATION_MANAGEMENT_LIMITS.topics).optional().default([]),
  competitors: uniqueTextArray(BRAND_LOCATION_MANAGEMENT_LIMITS.competitors).optional().default([]),
}).strict();

export const updateLocationSchema = z.object({
  countryCode: countryCode.optional(),
  languageCode: languageCode.optional(),
  topics: uniqueTextArray(BRAND_LOCATION_MANAGEMENT_LIMITS.topics).optional(),
  competitors: uniqueTextArray(BRAND_LOCATION_MANAGEMENT_LIMITS.competitors).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one location field is required.',
}).refine(
  (value) => (value.countryCode === undefined) === (value.languageCode === undefined),
  { message: 'Country and language must be changed together.' },
);

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
