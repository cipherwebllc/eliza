import type { mastodon } from "masto";
import type { MastodonEnvironment } from "./environment.js";

export interface MastodonClientConfig {
  environment: MastodonEnvironment;
}

export interface MastodonPost {
  status: string;
  visibility?: "public" | "unlisted" | "private" | "direct";
  inReplyToId?: string;
  mediaIds?: string[];
}

export type MastodonInteraction = {
  type: "favourite" | "reblog" | "reply";
  postId: string;
  content?: string;
};

export type { mastodon };
