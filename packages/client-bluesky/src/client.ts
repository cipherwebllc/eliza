import { BskyAgent } from "@atproto/api";
import { IAgentRuntime } from "@ai16z/eliza";

export class BlueskyClient {
    agent: BskyAgent;
    runtime: IAgentRuntime;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        this.agent = new BskyAgent({
            service: "https://bsky.social",
        });
    }

    async init() {
        const identifier = this.runtime.getSetting("BLUESKY_IDENTIFIER");
        const password = this.runtime.getSetting("BLUESKY_APP_PASSWORD");

        if (!identifier || !password) {
            throw new Error("Missing Bluesky credentials. Please set BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD.");
        }

        await this.agent.login({ identifier, password });
    }
}
