import type { mastodon } from "masto";
import type { MastodonEnvironment } from "./environment";

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
  type: "favorite" | "boost" | "reply";
  postId: string;
  content?: string;
};

export type { mastodon };
