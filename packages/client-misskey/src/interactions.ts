import { MisskeyInteraction } from "./types";

export function createFavorite(postId: string): MisskeyInteraction {
  return {
    type: "favorite",
    postId,
  };
}

export function createRenote(postId: string): MisskeyInteraction {
  return {
    type: "renote",
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
