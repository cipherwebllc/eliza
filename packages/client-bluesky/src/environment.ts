import { IAgentRuntime, elizaLogger } from "@ai16z/eliza";

export async function validateBlueskyConfig(runtime: IAgentRuntime) {
    const identifier = runtime.getSetting("BLUESKY_IDENTIFIER");
    const password = runtime.getSetting("BLUESKY_APP_PASSWORD");

    if (!identifier || !password) {
        throw new Error("Bluesky credentials not configured");
    }
}
