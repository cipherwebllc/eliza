import { MastodonInteraction } from "./types";

export function createFavorite(postId: string): MastodonInteraction {
  return {
    type: "favorite",
    postId,
  };
}

export function createBoost(postId: string): MastodonInteraction {
  return {
    type: "boost",
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
