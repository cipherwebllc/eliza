import { api } from "misskey-js";
import { MisskeyPost } from "./types.js";

export async function createPost(
    client: api.APIClient,
    post: MisskeyPost
): Promise<string> {
    const response = await client.request("notes/create", {
        text: post.text,
        replyId: post.replyId,
        visibility: post.visibility || "public"
    });

    return response.createdNote.id;
}
