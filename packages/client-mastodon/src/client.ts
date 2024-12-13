import { createRestAPIClient } from "masto";
import { Client, Post } from "@ai16z/eliza";
import { MastodonClientConfig, MastodonInteraction, MastodonPost } from "./types";
import { RateLimiter } from "./rate-limiter";

export class MastodonClientImpl implements Client {
  private client: ReturnType<typeof createRestAPIClient>;
  private rateLimiter: RateLimiter;

  constructor(config: MastodonClientConfig) {
    this.client = createRestAPIClient({
      url: config.environment.MASTODON_API_URL,
      accessToken: config.environment.MASTODON_TOKEN,
    });
    this.rateLimiter = new RateLimiter();
  }

  async post(content: Post): Promise<string> {
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
      case "favorite":
        await this.client.v1.statuses.favourite(interaction.postId);
        break;
      case "boost":
        await this.client.v1.statuses.reblog(interaction.postId);
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
