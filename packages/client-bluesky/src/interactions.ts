import { BskyAgent } from "@atproto/api";
import { BlueskyInteraction } from "./types";

export async function handleInteraction(
    agent: BskyAgent,
    interaction: BlueskyInteraction
): Promise<void> {
    switch (interaction.type) {
        case "like":
            await agent.like(interaction.uri, interaction.cid);
            break;
        case "repost":
            await agent.repost(interaction.uri, interaction.cid);
            break;
    }
}
