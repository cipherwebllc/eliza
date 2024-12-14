import { api } from "misskey-js";
import type { MisskeyEnvironment } from "./environment.js";

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

export { api as MisskeyClient };