import { z } from 'zod';

// These bounds cover the product's existing 12-competitor / 10-topic response
// while preventing an untrusted model response from becoming an unbounded
// database record or API payload.
export const suggestionAnalysisResultSchema = z.object({
  competitors: z.array(z.object({
    name: z.string().trim().min(1).max(160),
    domain: z.string().trim().min(1).max(253),
  }).strict()).max(12),
  topics: z.array(z.object({
    keyword: z.string().trim().min(1).max(160),
  }).strict()).max(10),
  industry: z.string().trim().min(1).max(240),
  targetAudience: z.string().trim().min(1).max(1_000),
}).strict();

export type SuggestionAnalysisResult = z.infer<typeof suggestionAnalysisResultSchema>;
