import { MastodonInteraction } from "./types.js";

export function createFavorite(postId: string): MastodonInteraction {
  return {
    type: "favourite",
    postId,
  };
}

export function createBoost(postId: string): MastodonInteraction {
  return {
    type: "reblog",
    postId,
  };
}

export function createReply(postId: string, content: string): MastodonInteraction {
  return {
    type: "reply",
    postId,
    content,
  };
}
