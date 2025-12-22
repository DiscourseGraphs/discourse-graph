import { z } from "zod";

/* eslint-disable @typescript-eslint/naming-convention */
export const FeatureFlagsSchema = z.object({
});
/* eslint-disable @typescript-eslint/naming-convention */

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
