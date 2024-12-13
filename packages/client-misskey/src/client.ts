import { Client, Content, Memory, UUID, IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { api } from "misskey-js";
import { MisskeyPost, MisskeyConfig, MisskeyReactionType } from "./types.js";
import { createPost } from "./post.js";
import { handleInteraction } from "./interactions.js";
import { RateLimiter } from "./rate-limiter.js";

export class MisskeyClient implements Client {
    private client: api.APIClient;
    private runtime: IAgentRuntime;
    private rateLimiter: RateLimiter;
    type = "misskey";

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        this.rateLimiter = new RateLimiter(60); // 60 requests per minute limit

        try {
            const serverUrl = this.runtime.getSetting("MISSKEY_SERVER_URL");
            const apiKey = this.runtime.getSetting("MISSKEY_API_KEY");

            if (!serverUrl || !apiKey) {
                throw new Error("Missing required Misskey configuration");
            }

            this.client = new api.APIClient({
                origin: serverUrl,
                credential: apiKey
            });
        } catch (error) {
            elizaLogger.error("Failed to initialize Misskey client:", error);
            throw error;
        }
    }

    async start(runtime?: IAgentRuntime): Promise<unknown> {
        if (runtime) {
            this.runtime = runtime;
        }

        try {
            await this.rateLimiter.waitForNext();
            // Test connection and get user info
            const response = await this.client.request("i");
            elizaLogger.info("Misskey client started successfully");
            return this;
        } catch (error) {
            elizaLogger.error("Failed to start Misskey client:", error);
            throw error;
        }
    }

    async stop(_runtime?: IAgentRuntime): Promise<unknown> {
        elizaLogger.info("Stopping Misskey client");
        return undefined;
    }

    async createMessage(content: Content, roomId: UUID): Promise<Memory> {
        try {
            await this.rateLimiter.waitForNext();
            const timestamp = new Date().getTime();

            const misskeyPost: MisskeyPost = {
                text: content.text,
                visibility: "public"
            };

            const noteId = await createPost(this.client, misskeyPost);
            elizaLogger.debug("Created Misskey post:", noteId);

            return {
                id: noteId as UUID,
                userId: this.runtime.getSetting("MISSKEY_USER_ID") as UUID,
                roomId,
                createdAt: timestamp,
                content: {
                    ...content,
                    text: content.text,
                    action: content.action || undefined,
                },
                agentId: this.runtime.getSetting("MISSKEY_USER_ID") as UUID,
            };
        } catch (error) {
            elizaLogger.error("Failed to create Misskey message:", error);
            throw error;
        }
    }

    async replyToMessage(content: Content, replyTo: Memory, roomId: UUID): Promise<Memory> {
        try {
            await this.rateLimiter.waitForNext();
            const timestamp = new Date().getTime();

            const misskeyPost: MisskeyPost = {
                text: content.text,
                replyId: replyTo.id as string,
                visibility: "public"
            };

            const noteId = await createPost(this.client, misskeyPost);
            elizaLogger.debug("Created Misskey reply:", noteId);

            return {
                id: noteId as UUID,
                userId: this.runtime.getSetting("MISSKEY_USER_ID") as UUID,
                roomId,
                createdAt: timestamp,
                content: {
                    ...content,
                    text: content.text,
                    inReplyTo: replyTo.id,
                    action: content.action || undefined,
                },
                agentId: this.runtime.getSetting("MISSKEY_USER_ID") as UUID,
            };
        } catch (error) {
            elizaLogger.error("Failed to create Misskey reply:", error);
            throw error;
        }
    }

    async deleteMessage(messageId: UUID): Promise<void> {
        try {
            await this.rateLimiter.waitForNext();
            await this.client.request("notes/delete", {
                noteId: messageId
            });
            elizaLogger.debug("Deleted Misskey message:", messageId);
        } catch (error) {
            elizaLogger.error("Failed to delete Misskey message:", error);
            throw error;
        }
    }

    async addReaction(noteId: string, reaction: MisskeyReactionType): Promise<void> {
        try {
            await this.rateLimiter.waitForNext();
            await handleInteraction(this.client, {
                type: "reaction",
                noteId,
                reaction
            });
            elizaLogger.debug("Added Misskey reaction:", { noteId, reaction });
        } catch (error) {
            elizaLogger.error("Failed to add Misskey reaction:", error);
            throw error;
        }
    }

    async removeReaction(noteId: string): Promise<void> {
        try {
            await this.rateLimiter.waitForNext();
            await this.client.request("notes/reactions/delete", {
                noteId
            });
            elizaLogger.debug("Removed Misskey reaction:", noteId);
        } catch (error) {
            elizaLogger.error("Failed to remove Misskey reaction:", error);
            throw error;
        }
    }
}
