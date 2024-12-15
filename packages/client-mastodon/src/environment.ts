import { z } from "zod";

export const MastodonEnvironmentSchema = z.object({
  MASTODON_TOKEN: z.string(),
  MASTODON_API_URL: z.string().url(),
});

export type MastodonEnvironment = z.infer<typeof MastodonEnvironmentSchema>;
