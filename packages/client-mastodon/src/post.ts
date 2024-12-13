import { Post } from "@ai16z/eliza";
import { MastodonPost } from "./types";

export function formatPost(post: Post): MastodonPost {
  return {
    status: post.text,
    visibility: "public",
  };
}
