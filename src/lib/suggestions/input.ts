import { z } from 'zod';
import {
  isMarketCountryName,
  isMarketLanguageName,
} from '@/lib/markets/catalog';

const requiredCountry = z
  .string()
  .refine(isMarketCountryName, 'Unsupported market country');

const requiredLanguage = z
  .string()
  .refine(isMarketLanguageName, 'Unsupported market language');

export const suggestionRequestInputSchema = z
  .object({
    brandUrl: z.string().trim().min(1).max(2_048),
    targetCountry: requiredCountry,
    targetLanguage: requiredLanguage,
  })
  .strict();
