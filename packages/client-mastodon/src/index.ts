import { Client, IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { MastodonClient } from "./client.js";
import { validateMastodonConfig } from "./environment.js";

export const MastodonClientInterface: Client = {
    async start(runtime?: IAgentRuntime): Promise<unknown> {
        if (!runtime) {
            throw new Error("Runtime is required for Mastodon client");
        }
        await validateMastodonConfig(runtime);
        const client = new MastodonClient(runtime);
        await client.start(runtime);
        elizaLogger.log("Mastodon client started");
        return client;
    },

    async stop(_runtime?: IAgentRuntime): Promise<unknown> {
        elizaLogger.log("Mastodon client stopped");
        return undefined;
    },
};
