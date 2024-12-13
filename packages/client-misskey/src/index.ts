import { Client, IAgentRuntime, elizaLogger } from "@ai16z/eliza";
import { MisskeyClient } from "./client.js";
import { validateMisskeyConfig } from "./environment.js";

export const MisskeyClientInterface: Client = {
    async start(runtime?: IAgentRuntime): Promise<unknown> {
        if (!runtime) {
            throw new Error("Runtime is required for Misskey client");
        }
        await validateMisskeyConfig(runtime);
        const client = new MisskeyClient(runtime);
        await client.start(runtime);
        elizaLogger.log("Misskey client started");
        return client;
    },

    async stop(_runtime?: IAgentRuntime): Promise<unknown> {
        elizaLogger.log("Misskey client stopped");
        return undefined;
    },
};
