import Mastodon from "mastodon-api";
import { MastodonPost } from "./types.js";

export async function createPost(
    client: Mastodon,
    post: MastodonPost
): Promise<string> {
    const response = await client.post("statuses", {
        status: post.text,
        in_reply_to_id: post.replyToId,
        visibility: post.visibility || "public"
    });

    return response.data.id;
}
