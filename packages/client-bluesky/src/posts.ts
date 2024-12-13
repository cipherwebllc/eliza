import { Actor, Memory } from "@ai16z/eliza";

/**
 * Format posts into a string with conversation headers
 */
export function formatPosts({
    messages,
    actors,
    conversationHeader = false,
}: {
    messages: Memory[];
    actors: Actor[];
    conversationHeader?: boolean;
}): string {
    if (!messages.length) return "";

    const postStrings = messages.map((message) => {
        const actor = actors.find((a) => a.id === message.userId);
        const formattedName = actor ? `${actor.name} (@${actor.username})` : "Unknown User";

        let postString = "";
        if (conversationHeader) {
            postString += `Name: ${formattedName}\n`;
            postString += `ID: ${message.id}\n`;
            if (message.content.inReplyTo) {
                postString += `In reply to: ${message.content.inReplyTo}\n`;
            }
            postString += `Text:\n${message.content.text}`;
        } else {
            postString = message.content.text;
        }

        // Add attachments if present
        if (message.content.attachments && message.content.attachments.length > 0) {
            postString += ` (Attachments: ${message.content.attachments
                .map((media) => `[${media.id} - ${media.title} (${media.url})]`)
                .join(", ")})`;
        }

        // Add action if present
        if (message.content.action && message.content.action !== "null") {
            postString += ` (${message.content.action})`;
        }

        return postString;
    }).join("\n\n");

    return postStrings;
}
