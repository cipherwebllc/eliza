import Mastodon from "mastodon-api";
import { MastodonInteraction } from "./types.js";

export async function handleInteraction(
    client: Mastodon,
    interaction: MastodonInteraction
): Promise<void> {
    switch (interaction.type) {
        case "favourite":
            await client.post(`statuses/${interaction.statusId}/favourite`);
            break;
        case "boost":
            await client.post(`statuses/${interaction.statusId}/reblog`);
            break;
    }
}
