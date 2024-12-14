import { Content } from "@ai16z/eliza";
import { MisskeyPost } from "./types.js";

export function formatPost(post: Content): MisskeyPost {
  return {
    text: post.text,
    visibility: "public",
  };
}
