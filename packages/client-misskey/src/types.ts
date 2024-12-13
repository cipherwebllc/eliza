import { Client as MisskeyClient } from "misskey-js";
import type { MisskeyEnvironment } from "./environment";

export interface MisskeyClientConfig {
  environment: MisskeyEnvironment;
}

export interface MisskeyPost {
  text: string;
  visibility?: "public" | "home" | "followers" | "specified";
  replyId?: string;
  renoteId?: string;
}

export type MisskeyInteraction = {
  type: "favorite" | "renote" | "reply";
  postId: string;
  content?: string;
};

export { MisskeyClient };
