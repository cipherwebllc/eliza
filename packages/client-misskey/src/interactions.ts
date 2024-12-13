import { api } from "misskey-js";
import { MisskeyInteraction } from "./types.js";

export async function handleInteraction(
    client: api.APIClient,
    interaction: MisskeyInteraction
): Promise<void> {
    switch (interaction.type) {
        case "reaction":
            await client.request("notes/reactions/create", {
                noteId: interaction.noteId,
                reaction: interaction.reaction || "👍"
            });
            break;
        case "renote":
            await client.request("notes/create", {
                renoteId: interaction.noteId
            });
            break;
    }
}
