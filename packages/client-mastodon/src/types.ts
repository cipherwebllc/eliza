import type { mastodon } from "masto";
import type { MastodonEnvironment } from "./environment.js";

export interface MastodonClientConfig {
  environment: MastodonEnvironment;
}

interface BasePost {
  status: string;
  visibility?: "public" | "unlisted" | "private" | "direct";
  inReplyToId?: string;
}

interface MediaPost extends BasePost {
  mediaIds: string[];
}

interface TextPost extends BasePost {
  mediaIds?: never;
}

export type MastodonPost = TextPost | MediaPost;

export type MastodonInteraction = {
  type: "favourite" | "reblog" | "reply";
  postId: string;
  content?: string;
};

export type { mastodon };
