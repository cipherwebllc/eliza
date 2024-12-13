import { Client, Content, Memory, UUID, IAgentRuntime } from "@ai16z/eliza";
import { api } from "misskey-js";
import { MisskeyPost } from "./types.js";
import { createPost } from "./post.js";
import { handleInteraction } from "./interactions.js";

export class MisskeyClient implements Client {
    client: api.APIClient;
    runtime: IAgentRuntime;
    type = "misskey";

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        const serverUrl = this.runtime.getSetting("MISSKEY_SERVER_URL");
        const apiKey = this.runtime.getSetting("MISSKEY_API_KEY");

        this.client = new api.APIClient({
            origin: serverUrl,
            credential: apiKey
        });
    }

    async start(runtime?: IAgentRuntime): Promise<unknown> {
        if (runtime) {
            this.runtime = runtime;
        }
        // Test connection
        await this.client.request("i");
        return this;
    }

    async stop(_runtime?: IAgentRuntime): Promise<unknown> {
        return undefined;
    }

    async createMessage(content: Content, roomId: UUID): Promise<Memory> {
        const timestamp = new Date().getTime();
        const misskeyPost: MisskeyPost = {
            text: content.text,
            visibility: "public"
        };

        const noteId = await createPost(this.client, misskeyPost);

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
    }

    async replyToMessage(content: Content, replyTo: Memory, roomId: UUID): Promise<Memory> {
        const timestamp = new Date().getTime();
        const misskeyPost: MisskeyPost = {
            text: content.text,
            replyId: replyTo.id as string,
            visibility: "public"
        };

        const noteId = await createPost(this.client, misskeyPost);

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
    }

    async deleteMessage(messageId: UUID): Promise<void> {
        await this.client.request("notes/delete", {
            noteId: messageId
        });
    }
}
