import { elizaLogger } from "@ai16z/eliza";
import { MastodonInteraction } from "./types.js";

export async function handleInteraction(client: any, interaction: MastodonInteraction): Promise<void> {
    try {
        switch (interaction.type) {
            case 'favourite':
                await client.v1.statuses.favourite(interaction.statusId);
                elizaLogger.info(`Favourited status: ${interaction.statusId}`);
                break;

            case 'boost':
                await client.v1.statuses.reblog(interaction.statusId);
                elizaLogger.info(`Boosted status: ${interaction.statusId}`);
                break;

            case 'reply':
                if (!interaction.text) {
                    throw new Error("Reply text is required for reply interactions");
                }
                await client.v1.statuses.create({
                    status: interaction.text,
                    inReplyToId: interaction.statusId,
                });
                elizaLogger.info(`Replied to status: ${interaction.statusId}`);
                break;

            default:
                throw new Error(`Unsupported interaction type: ${interaction.type}`);
        }
    } catch (error) {
        elizaLogger.error(`Failed to handle Mastodon interaction:`, error);
        throw error;
    }
}
