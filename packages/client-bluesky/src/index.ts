import { Client, IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { BlueskyClient } from "./client.js";
import { validateBlueskyConfig } from "./environment.js";

export const BlueskyClientInterface: Client = {
    async start(runtime?: IAgentRuntime): Promise<unknown> {
        if (!runtime) {
            throw new Error("Runtime is required for Bluesky client");
        }
        await validateBlueskyConfig(runtime);
        const client = new BlueskyClient(runtime);
        await client.start(runtime);
        elizaLogger.log("Bluesky client started");
        return client;
    },

    async stop(_runtime?: IAgentRuntime): Promise<unknown> {
        elizaLogger.log("Bluesky client stopped");
        return undefined;
    },
};
