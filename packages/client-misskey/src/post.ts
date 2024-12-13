import { Post } from "@ai16z/eliza";
import { MisskeyPost } from "./types";

export function formatPost(post: Post): MisskeyPost {
  return {
    text: post.text,
    visibility: "public",
  };
}
