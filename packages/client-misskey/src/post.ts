import { api } from "misskey-js";
import { MisskeyPost } from "./types.js";
import { elizaLogger } from "@ai16z/eliza";

export async function createPost(
    client: api.APIClient,
    post: MisskeyPost
): Promise<string> {
    try {
        const response = await client.request("notes/create", {
            text: post.text,
            replyId: post.replyId,
            visibility: post.visibility || "public",
            localOnly: post.localOnly,
            cw: post.cw,
            fileIds: post.fileIds,
            poll: post.poll ? {
                choices: post.poll.choices,
                multiple: post.poll.multiple,
                expiresAt: post.poll.expiresAt,
                expiredAfter: post.poll.expiredAfter
            } : undefined
        });

        elizaLogger.debug("Created Misskey post:", response.createdNote.id);
        return response.createdNote.id;
    } catch (error) {
        elizaLogger.error("Failed to create Misskey post:", error);
        throw error;
    }
}
