import { BskyAgent } from "@atproto/api";
import { IAgentRuntime, Memory, Content, UUID, Client } from "@ai16z/eliza";
import { BlueskyPost } from "./post.js";

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

    async start(runtime: IAgentRuntime): Promise<void> {
        this.runtime = runtime;
        const identifier = this.runtime.getSetting("BLUESKY_IDENTIFIER");
        const password = this.runtime.getSetting("BLUESKY_APP_PASSWORD");

        if (!identifier || !password) {
            throw new Error("Missing Bluesky credentials. Please set BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD.");
        }

        await this.agent.login({ identifier, password });
    }

    async stop(): Promise<void> {
        // Cleanup any resources if needed
        return;
    }

    async createMessage(content: Content, roomId: UUID): Promise<Memory> {
        // Format message according to core package format
        const shortId = (this.runtime.getSetting("BLUESKY_IDENTIFIER") as UUID).slice(-5);
        const timestamp = new Date().getTime();
        const formattedTimestamp = this.formatTimestamp(timestamp);

        let messageText = `(${formattedTimestamp}) [${shortId}] ${this.runtime.getSetting("BLUESKY_NAME") || "Unknown User"}: ${content.text}`;

        // Handle attachments if present
        if (content.attachments && content.attachments.length > 0) {
            messageText += ` (Attachments: ${content.attachments
                .map(media => `[${media.id} - ${media.title} (${media.url})]`)
                .join(", ")})`;
        }

        // Add action if present
        if (content.action && content.action !== "null") {
            messageText += ` (${content.action})`;
        }

        const blueskyPost: BlueskyPost = {
            text: messageText
        };

        const post = await this.agent.post({
            text: blueskyPost.text,
            createdAt: new Date(timestamp).toISOString(),
        });

        return {
            id: post.uri as UUID,
            userId: this.runtime.getSetting("BLUESKY_IDENTIFIER") as UUID,
            roomId,
            createdAt: timestamp,
            content: {
                ...content,
                text: messageText,
                action: content.action || undefined,
            },
            agentId: this.runtime.getSetting("BLUESKY_IDENTIFIER") as UUID,
        };
    }

    async replyToMessage(content: Content, replyTo: Memory, roomId: UUID): Promise<Memory> {
        if (!replyTo.id) {
            throw new Error("Cannot reply to message without ID");
        }

        const replyId = replyTo.id.toString();
        const shortId = (this.runtime.getSetting("BLUESKY_IDENTIFIER") as UUID).slice(-5);
        const timestamp = new Date().getTime();
        const formattedTimestamp = this.formatTimestamp(timestamp);

        let messageText = `(${formattedTimestamp}) [${shortId}] ${this.runtime.getSetting("BLUESKY_NAME") || "Unknown User"}: ${content.text}`;

        // Handle attachments if present
        if (content.attachments && content.attachments.length > 0) {
            messageText += ` (Attachments: ${content.attachments
                .map(media => `[${media.id} - ${media.title} (${media.url})]`)
                .join(", ")})`;
        }

        // Add action if present
        if (content.action && content.action !== "null") {
            messageText += ` (${content.action})`;
        }

        const blueskyPost: BlueskyPost = {
            text: messageText,
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
            userId: this.runtime.getSetting("BLUESKY_IDENTIFIER") as UUID,
            roomId,
            createdAt: timestamp,
            content: {
                ...content,
                text: messageText,
                inReplyTo: replyTo.id,
                action: content.action || undefined,
            },
            agentId: this.runtime.getSetting("BLUESKY_IDENTIFIER") as UUID,
        };
    }

    async deleteMessage(messageId: UUID): Promise<void> {
        await this.agent.deletePost(messageId);
    }

    private formatTimestamp(messageDate: number): string {
        const now = new Date();
        const diff = now.getTime() - messageDate;

        const absDiff = Math.abs(diff);
        const seconds = Math.floor(absDiff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (absDiff < 60000) {
            return "just now";
        } else if (minutes < 60) {
            return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
        } else if (hours < 24) {
            return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
        } else {
            return `${days} day${days !== 1 ? "s" : ""} ago`;
        }
    }
}
