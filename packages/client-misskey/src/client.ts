import { Client as MisskeyClient } from "misskey-js";
import { Client, Post } from "@ai16z/eliza";
import { MisskeyClientConfig, MisskeyInteraction, MisskeyPost } from "./types";
import { RateLimiter } from "./rate-limiter";

export class MisskeyClientImpl implements Client {
  private client: MisskeyClient;
  private rateLimiter: RateLimiter;

  constructor(config: MisskeyClientConfig) {
    this.client = new MisskeyClient({
      origin: config.environment.MISSKEY_API_URL,
      credential: config.environment.MISSKEY_TOKEN,
    });
    this.rateLimiter = new RateLimiter();
  }

  async post(content: Post): Promise<string> {
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
      case "renote":
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
