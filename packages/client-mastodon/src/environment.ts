import * as zod from "zod";

export const MastodonEnvironmentSchema = zod.object({
  MASTODON_TOKEN: zod.string(),
  MASTODON_API_URL: zod.string().url(),
});

export type MastodonEnvironment = zod.infer<typeof MastodonEnvironmentSchema>;
