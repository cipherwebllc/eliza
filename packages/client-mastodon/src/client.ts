import { Client, IAgentRuntime, Content } from "@ai16z/eliza";
import { createRestAPIClient } from "masto";
import { MastodonClientConfig, MastodonInteraction } from "./types.js";
import { RateLimiter } from "./rate-limiter.js";

export class MastodonClientImpl implements Client {
  private client;
  private rateLimiter;
  private runtime?: IAgentRuntime;

  constructor(config: MastodonClientConfig) {
    this.client = createRestAPIClient({
      url: config.environment.MASTODON_API_URL,
      accessToken: config.environment.MASTODON_TOKEN,
    });
    this.rateLimiter = new RateLimiter();
  }

  async start(runtime: IAgentRuntime): Promise<void> {
    this.runtime = runtime;
  }

  async stop(): Promise<void> {
    this.runtime = undefined;
  }

  async post(content: Content): Promise<string> {
    await this.rateLimiter.waitForToken();
    const post = await this.client.v1.statuses.create({
      status: content.text,
    });
    return post.id;
  }

  async interact(interaction: MastodonInteraction): Promise<void> {
    await this.rateLimiter.waitForToken();
    const status = await this.client.v1.statuses.$select(interaction.postId);

    switch (interaction.type) {
      case "favorite":
        await status.favourite();
        break;
      case "boost":
        await status.reblog();
        break;
      case "reply":
        if (!interaction.content) throw new Error("Reply content is required");
        await this.client.v1.statuses.create({
          status: interaction.content,
          inReplyToId: interaction.postId,
        });
        break;
    }
  }
}
