import { Client, IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { createRestAPIClient } from "masto";
import { RateLimiter } from "./rate-limiter.js";
import { MastodonConfig, MastodonPost, MastodonInteraction } from "./types.js";
import { createPost } from "./post.js";
import { handleInteraction } from "./interactions.js";

export class MastodonClient implements Client {
    private config: MastodonConfig;
    private client: any;
    private rateLimiter: RateLimiter;
    private runtime?: IAgentRuntime;

    constructor(config: MastodonConfig) {
        this.config = config;
        this.rateLimiter = new RateLimiter(30); // Mastodon's default rate limit
    }

    async start(runtime: IAgentRuntime): Promise<void> {
        try {
            this.runtime = runtime;
            this.client = createRestAPIClient({
                url: this.config.serverUrl,
                accessToken: this.config.accessToken,
            });
            elizaLogger.info("Mastodon client started successfully");
        } catch (error) {
            elizaLogger.error("Failed to start Mastodon client:", error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        try {
            this.client = undefined;
            this.runtime = undefined;
            elizaLogger.info("Mastodon client stopped successfully");
        } catch (error) {
            elizaLogger.error("Failed to stop Mastodon client:", error);
            throw error;
        }
    }

    async post(post: MastodonPost): Promise<string> {
        await this.rateLimiter.waitForNext();
        return createPost(this.client, post);
    }

    async interact(interaction: MastodonInteraction): Promise<void> {
        await this.rateLimiter.waitForNext();
        return handleInteraction(this.client, interaction);
    }
}
