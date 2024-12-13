import { IAgentRuntime, elizaLogger } from "@ai16z/eliza";

export async function validateMastodonConfig(runtime: IAgentRuntime) {
    const serverUrl = runtime.getSetting("MASTODON_SERVER_URL");
    const accessToken = runtime.getSetting("MASTODON_ACCESS_TOKEN");

    if (!serverUrl || !accessToken) {
        throw new Error("Mastodon credentials not configured");
    }
}
