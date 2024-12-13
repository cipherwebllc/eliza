import { elizaLogger } from "@ai16z/eliza";
import { MastodonPost } from "./types.js";

export async function createPost(client: any, post: MastodonPost): Promise<string> {
    try {
        const status = await client.v1.statuses.create({
            status: post.text,
            inReplyToId: post.replyToId,
            visibility: post.visibility || 'public',
            sensitive: post.sensitive,
            spoilerText: post.spoilerText,
            mediaIds: post.mediaIds,
            poll: post.poll ? {
                options: post.poll.options,
                expiresIn: post.poll.expiresIn,
                multiple: post.poll.multiple,
                hideTotals: post.poll.hideTotals,
            } : undefined,
            language: post.language,
            scheduledAt: post.scheduledAt,
        });

        elizaLogger.info(`Created Mastodon post with ID: ${status.id}`);
        return status.id;
    } catch (error) {
        elizaLogger.error("Failed to create Mastodon post:", error);
        throw error;
    }
}
