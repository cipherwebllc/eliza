import { MastodonConfig } from "./types.js";

export function getConfig(): MastodonConfig {
    const serverUrl = process.env.MASTODON_SERVER_URL;
    const accessToken = process.env.MASTODON_ACCESS_TOKEN;

    if (!serverUrl) {
        throw new Error("MASTODON_SERVER_URL environment variable is not set");
    }

    if (!accessToken) {
        throw new Error(
            "MASTODON_ACCESS_TOKEN environment variable is not set"
        );
    }

    return {
        serverUrl,
        accessToken,
    };
}
