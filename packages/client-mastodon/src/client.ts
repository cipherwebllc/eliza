import { Client, Content, Memory, UUID, IAgentRuntime } from "@ai16z/eliza";
import Mastodon from "mastodon-api";
import { MastodonPost } from "./types.js";
import { createPost } from "./post.js";
import { handleInteraction } from "./interactions.js";

export class MastodonClient implements Client {
    client: Mastodon;
    runtime: IAgentRuntime;
    type = "mastodon";

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        this.client = new Mastodon({
            access_token: this.runtime.getSetting("MASTODON_ACCESS_TOKEN"),
            api_url: `${this.runtime.getSetting("MASTODON_SERVER_URL")}/api/v1/`
        });
    }

    async start(runtime?: IAgentRuntime): Promise<unknown> {
        if (runtime) {
            this.runtime = runtime;
        }
        // Test connection by verifying credentials
        await this.client.get("accounts/verify_credentials");
        return this;
    }

    async stop(_runtime?: IAgentRuntime): Promise<unknown> {
        return undefined;
    }

    async createMessage(content: Content, roomId: UUID): Promise<Memory> {
        const timestamp = new Date().getTime();
        const mastodonPost: MastodonPost = {
            text: content.text,
            visibility: "public"
        };

        const statusId = await createPost(this.client, mastodonPost);

        return {
            id: statusId as UUID,
            userId: this.runtime.getSetting("MASTODON_USER_ID") as UUID,
            roomId,
            createdAt: timestamp,
            content: {
                ...content,
                text: content.text,
                action: content.action || undefined,
            },
            agentId: this.runtime.getSetting("MASTODON_USER_ID") as UUID,
        };
    }

    async replyToMessage(content: Content, replyTo: Memory, roomId: UUID): Promise<Memory> {
        const timestamp = new Date().getTime();
        const mastodonPost: MastodonPost = {
            text: content.text,
            replyToId: replyTo.id as string,
            visibility: "public"
        };


        const statusId = await createPost(this.client, mastodonPost);

        return {
            id: statusId as UUID,
            userId: this.runtime.getSetting("MASTODON_USER_ID") as UUID,
            roomId,
            createdAt: timestamp,
            content: {
                ...content,
                text: content.text,
                inReplyTo: replyTo.id,
                action: content.action || undefined,
            },
            agentId: this.runtime.getSetting("MASTODON_USER_ID") as UUID,
        };
    }

    async deleteMessage(messageId: UUID): Promise<void> {
        await this.client.delete(`statuses/${messageId}`);
    }
}
