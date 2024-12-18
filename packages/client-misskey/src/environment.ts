import * as zod from "zod";

export const MisskeyEnvironmentSchema = zod.object({
  MISSKEY_TOKEN: zod.string(),
  MISSKEY_API_URL: zod.string().url(),
});

export type MisskeyEnvironment = zod.infer<typeof MisskeyEnvironmentSchema>;
