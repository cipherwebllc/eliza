import { Client, IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { BlueskyClient } from "./client.js";
import { validateBlueskyConfig } from "./environment.js";

export const BlueskyClientInterface: Client = {
    async start(runtime: IAgentRuntime) {
        await validateBlueskyConfig(runtime);
        const client = new BlueskyClient(runtime);
        await client.init();
        elizaLogger.log("Bluesky client started");
        return client;
    },

    async stop(_runtime: IAgentRuntime) {
        elizaLogger.log("Bluesky client stopped");
    },
};
