import { MisskeyInteraction } from "./types.js";

export function createFavorite(postId: string): MisskeyInteraction {
  return {
    type: "favorite",
    postId,
  };
}

export function createBoost(postId: string): MisskeyInteraction {
  return {
    type: "boost",
    postId,
  };
}

export function createReply(postId: string, content: string): MisskeyInteraction {
  return {
    type: "reply",
    postId,
    content,
  };
}
