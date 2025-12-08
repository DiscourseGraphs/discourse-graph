import { z } from "zod";

export const FeatureFlagsSchema = z.object({
  "Enable Left sidebar": z.boolean().default(false),
});

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;