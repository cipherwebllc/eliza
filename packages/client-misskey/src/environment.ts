import { IAgentRuntime, elizaLogger } from "@ai16z/eliza";

export async function validateMisskeyConfig(runtime: IAgentRuntime) {
    const serverUrl = runtime.getSetting("MISSKEY_SERVER_URL");
    const apiKey = runtime.getSetting("MISSKEY_API_KEY");

    if (!serverUrl || !apiKey) {
        throw new Error("Misskey credentials not configured");
    }
}
