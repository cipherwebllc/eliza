import { BskyAgent } from "@atproto/api";
import { IAgentRuntime, Memory, Content, UUID } from "@ai16z/eliza";
import { BlueskyPost } from "./post.js";

export class BlueskyClient {
    agent: BskyAgent;
    runtime: IAgentRuntime;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        this.agent = new BskyAgent({
            service: "https://bsky.social",
        });
    }

    async init() {
        const identifier = this.runtime.getSetting("BLUESKY_IDENTIFIER");
        const password = this.runtime.getSetting("BLUESKY_APP_PASSWORD");

        if (!identifier || !password) {
            throw new Error("Missing Bluesky credentials. Please set BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD.");
        }

        await this.agent.login({ identifier, password });
    }

    async createMessage(content: Content, roomId: UUID): Promise<Memory> {
        const blueskyPost: BlueskyPost = {
            text: content.text
        };

        const post = await this.agent.post({
            text: blueskyPost.text,
            createdAt: new Date().toISOString(),
        });

        return {
            id: post.uri as UUID,
            userId: this.runtime.getSetting("BLUESKY_IDENTIFIER") as UUID,
            roomId,
            createdAt: Date.now(),
            content,
            agentId: this.runtime.getSetting("BLUESKY_IDENTIFIER") as UUID,
        };
    }

    async replyToMessage(content: Content, replyTo: Memory, roomId: UUID): Promise<Memory> {
        if (!replyTo.id) {
            throw new Error("Cannot reply to message without ID");
        }

        const replyId = replyTo.id.toString();
        const blueskyPost: BlueskyPost = {
            text: content.text,
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
            createdAt: new Date().toISOString(),
        });

        return {
            id: post.uri as UUID,
            userId: this.runtime.getSetting("BLUESKY_IDENTIFIER") as UUID,
            roomId,
            createdAt: Date.now(),
            content: {
                ...content,
                inReplyTo: replyTo.id,
            },
            agentId: this.runtime.getSetting("BLUESKY_IDENTIFIER") as UUID,
        };
    }
}
