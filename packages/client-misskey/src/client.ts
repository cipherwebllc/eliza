import { api as misskeyApi } from "misskey-js";
import { Client, Content, IAgentRuntime } from "@ai16z/eliza";
import { MisskeyClientConfig, MisskeyInteraction, MisskeyPost } from "./types.js";
import { RateLimiter } from "./rate-limiter.js";

export class MisskeyClientImpl implements Client {
  private client: InstanceType<typeof misskeyApi.APIClient>;
  private rateLimiter: RateLimiter;
  private runtime?: IAgentRuntime;

  constructor(config: MisskeyClientConfig) {
    this.client = new misskeyApi.APIClient({
      origin: config.environment.MISSKEY_API_URL,
      credential: config.environment.MISSKEY_TOKEN,
    });
    this.rateLimiter = new RateLimiter();
  }

  async start(runtime: IAgentRuntime): Promise<void> {
    this.runtime = runtime;
  }

  async stop(runtime: IAgentRuntime): Promise<void> {
    this.runtime = undefined;
  }

  async post(content: Content): Promise<string> {
    await this.rateLimiter.waitForToken();
    const post: MisskeyPost = {
      text: content.text,
      visibility: "public",
    };
    const response = await this.client.request("notes/create", post);
    return response.createdNote.id;
  }

  async interact(interaction: MisskeyInteraction): Promise<void> {
    await this.rateLimiter.waitForToken();
    switch (interaction.type) {
      case "favorite":
        await this.client.request("notes/favorites/create", {
          noteId: interaction.postId,
        });
        break;
      case "boost":
        await this.client.request("notes/create", {
          renoteId: interaction.postId,
        });
        break;
      case "reply":
        if (!interaction.content) throw new Error("Reply content is required");
        await this.client.request("notes/create", {
          text: interaction.content,
          replyId: interaction.postId,
        });
        break;
    }
  }
}
