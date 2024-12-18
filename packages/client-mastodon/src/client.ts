import { createRestAPIClient, type mastodon } from "masto";
import { Client, Content, IAgentRuntime } from "@ai16z/eliza";
import { MastodonClientConfig, MastodonInteraction, MastodonPost } from "./types.js";
import { RateLimiter } from "./rate-limiter.js";

export class MastodonClientImpl implements Client {
  private client: mastodon.rest.Client;
  private rateLimiter: RateLimiter;
  private runtime?: IAgentRuntime;

  constructor(config: MastodonClientConfig) {
    this.client = createRestAPIClient({
      url: config.environment.MASTODON_API_URL,
      accessToken: config.environment.MASTODON_TOKEN,
    });
    this.rateLimiter = new RateLimiter();
  }

  async start(runtime: IAgentRuntime): Promise<unknown> {
    this.runtime = runtime;
    return Promise.resolve();
  }

  async stop(runtime: IAgentRuntime): Promise<unknown> {
    this.runtime = undefined;
    return Promise.resolve();
  }

  async post(content: Content): Promise<string> {
    await this.rateLimiter.waitForToken();
    const post: MastodonPost = {
      status: content.text,
      visibility: "public",
    };
    const response = await this.client.v1.statuses.create(post);
    return response.id;
  }

  async interact(interaction: MastodonInteraction): Promise<void> {
    await this.rateLimiter.waitForToken();
    switch (interaction.type) {
      case "favourite":
        await this.client.v1.statuses.$select(interaction.postId).favourite();
        break;
      case "reblog":
        await this.client.v1.statuses.$select(interaction.postId).reblog();
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
