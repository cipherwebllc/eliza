import { Client, Content, Memory, UUID, IAgentRuntime } from "@ai16z/eliza";
import { BskyAgent } from "@atproto/api";
import { BlueskyPost } from "./types.js";
import { formatPosts } from "./posts.js";
import { formatTimestamp } from "./utils.js";

export class BlueskyClient implements Client {
    agent: BskyAgent;
    runtime: IAgentRuntime;
    type = "bluesky";

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        this.agent = new BskyAgent({
            service: "https://bsky.social",
        });
    }

    async start(runtime?: IAgentRuntime): Promise<void> {
        if (runtime) {
            this.runtime = runtime;
        }
        const identifier = this.runtime.getSetting("BLUESKY_IDENTIFIER");
        const password = this.runtime.getSetting("BLUESKY_APP_PASSWORD");

        if (!identifier || !password) {
            throw new Error("Missing Bluesky credentials. Please set BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD.");
        }

        await this.agent.login({ identifier, password });
    }

    async stop(_runtime?: IAgentRuntime): Promise<void> {
        return;
    }

    async createMessage(content: Content, roomId: UUID): Promise<Memory> {
        const timestamp = new Date().getTime();
        const actor = {
            id: this.runtime.getSetting("BLUESKY_IDENTIFIER") as UUID,
            name: this.runtime.getSetting("BLUESKY_NAME") || "Unknown User",
            username: this.runtime.getSetting("BLUESKY_USERNAME") || "unknown",
            details: {
                tagline: "",
                summary: "",
                quote: "",
            },
        };

        const formattedPost = formatPosts({
            messages: [{
                id: "temp" as UUID,
                userId: actor.id,
                roomId,
                createdAt: timestamp,
                content,
                agentId: actor.id,
            }],
            actors: [actor],
            conversationHeader: true,
        });

        const blueskyPost: BlueskyPost = {
            text: formattedPost
        };

        const post = await this.agent.post({
            text: blueskyPost.text,
            createdAt: new Date(timestamp).toISOString(),
        });

        return {
            id: post.uri as UUID,
            userId: actor.id,
            roomId,
            createdAt: timestamp,
            content: {
                ...content,
                text: content.text,
                action: content.action || undefined,
            },
            agentId: actor.id,
        };
    }

    async replyToMessage(content: Content, replyTo: Memory, roomId: UUID): Promise<Memory> {
        if (!replyTo.id) {
            throw new Error("Cannot reply to message without ID");
        }

        const replyId = replyTo.id.toString();
        const timestamp = new Date().getTime();
        const actor = {
            id: this.runtime.getSetting("BLUESKY_IDENTIFIER") as UUID,
            name: this.runtime.getSetting("BLUESKY_NAME") || "Unknown User",
            username: this.runtime.getSetting("BLUESKY_USERNAME") || "unknown",
            details: {
                tagline: "",
                summary: "",
                quote: "",
            },
        };

        const formattedPost = formatPosts({
            messages: [{
                id: "temp" as UUID,
                userId: actor.id,
                roomId,
                createdAt: timestamp,
                content: {
                    ...content,
                    inReplyTo: replyTo.id,
                },
                agentId: actor.id,
            }],
            actors: [actor],
            conversationHeader: true,
        });

        const blueskyPost: BlueskyPost = {
            text: formattedPost,
            replyTo: {
                uri: replyId,
                cid: replyId
            }
        };

        const post = await this.agent.post({
            text: blueskyPost.text,
            reply: {
                root: { uri: replyId, cid: replyId },
                parent: { uri: replyId, cid: replyId },
            },
            createdAt: new Date(timestamp).toISOString(),
        });

        return {
            id: post.uri as UUID,
            userId: actor.id,
            roomId,
            createdAt: timestamp,
            content: {
                ...content,
                text: content.text,
                inReplyTo: replyTo.id,
                action: content.action || undefined,
            },
            agentId: actor.id,
        };
    }

    async deleteMessage(messageId: UUID): Promise<void> {
        await this.agent.deletePost(messageId);
    }
}
