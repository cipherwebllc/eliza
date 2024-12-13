import { api } from "misskey-js";
import { MisskeyInteraction } from "./types.js";
import { elizaLogger } from "@ai16z/eliza";

export async function handleInteraction(
    client: api.APIClient,
    interaction: MisskeyInteraction
): Promise<void> {
    try {
        switch (interaction.type) {
            case "reaction":
                await client.request("notes/reactions/create", {
                    noteId: interaction.noteId,
                    reaction: interaction.reaction || "👍"
                });
                elizaLogger.debug("Created Misskey reaction:", interaction);
                break;
            case "renote":
                await client.request("notes/create", {
                    renoteId: interaction.noteId
                });
                elizaLogger.debug("Created Misskey renote:", interaction);
                break;
            case "quote":
                await client.request("notes/create", {
                    renoteId: interaction.noteId,
                    text: interaction.text
                });
                elizaLogger.debug("Created Misskey quote:", interaction);
                break;
            default:
                throw new Error(`Unsupported interaction type: ${interaction.type}`);
        }
    } catch (error) {
        elizaLogger.error("Failed to handle Misskey interaction:", error);
        throw error;
    }
}
