import { z } from "zod";

export const MisskeyEnvironmentSchema = z.object({
  MISSKEY_TOKEN: z.string(),
  MISSKEY_API_URL: z.string().url(),
});

export type MisskeyEnvironment = z.infer<typeof MisskeyEnvironmentSchema>;
