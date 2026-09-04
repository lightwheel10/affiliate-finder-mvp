import { z } from 'zod';
import { SEARCH_INPUT_LIMITS } from '@/lib/plans/catalog';

export const SEARCH_SOURCES = ['Web', 'YouTube', 'Instagram', 'TikTok'] as const;

const trimmedKeyword = z.string().trim().min(1).max(255);
const normalizedCompetitor = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .transform((value) =>
    value.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase(),
  );

const brandLocationId = z.union([
  z.string().trim().min(1).max(19),
  z.number().int().positive().safe(),
]);

const requestId = z.string().uuid().transform((value) => value.toLowerCase());

export const startSearchInputSchema = z
  .object({
    keyword: trimmedKeyword.optional(),
    keywords: z
      .array(trimmedKeyword)
      .max(SEARCH_INPUT_LIMITS.maxKeywords)
      .transform((items) => [...new Set(items)])
      .optional(),
    sources: z
      .array(z.enum(SEARCH_SOURCES))
      .min(1)
      .max(SEARCH_INPUT_LIMITS.maxSources)
      .transform((items) => [...new Set(items)])
      .default([...SEARCH_SOURCES]),
    competitors: z
      .array(normalizedCompetitor)
      .max(SEARCH_INPUT_LIMITS.maxCompetitors)
      .transform((items) => [...new Set(items)])
      .optional(),
    brandLocationId: brandLocationId.optional(),
    requestId,
  })
  .strict()
  .refine(
    ({ keyword, keywords }) => Boolean(keyword || (keywords && keywords.length > 0)),
    'At least one keyword is required',
  );

export type StartSearchInput = z.infer<typeof startSearchInputSchema>;
