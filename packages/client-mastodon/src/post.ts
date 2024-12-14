import { Content } from "@ai16z/eliza";
import { MastodonPost } from "./types.js";

export function formatPost(post: Content): MastodonPost {
  return {
    status: post.text,
    visibility: "public",
  };
}
