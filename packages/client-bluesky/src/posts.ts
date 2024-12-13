import { Actor, Memory } from "@ai16z/eliza";
import { formatTimestamp } from "@ai16z/eliza";

export const formatPosts = ({
    messages,
    actors,
    conversationHeader = true,
}: {
    messages: Memory[];
    actors: Actor[];
    conversationHeader?: boolean;
}) => {
    // Group messages by roomId
    const groupedMessages: { [roomId: string]: Memory[] } = {};
    messages.forEach((message) => {
        if (message.roomId) {
            if (!groupedMessages[message.roomId]) {
                groupedMessages[message.roomId] = [];
            }
            groupedMessages[message.roomId].push(message);
        }
    });

    // Sort messages within each roomId by createdAt (oldest to newest)
    Object.values(groupedMessages).forEach((roomMessages) => {
        roomMessages.sort((a, b) => {
            const timeA = a.createdAt ?? 0;
            const timeB = b.createdAt ?? 0;
            return timeA - timeB;
        });
    });

    // Sort rooms by the newest message's createdAt
    const sortedRooms = Object.entries(groupedMessages).sort(
        ([, messagesA], [, messagesB]) => {
            const latestA = messagesA[messagesA.length - 1]?.createdAt ?? 0;
            const latestB = messagesB[messagesB.length - 1]?.createdAt ?? 0;
            return latestB - latestA;
        }
    );

    const formattedPosts = sortedRooms.map(([roomId, roomMessages]) => {
        const messageStrings = roomMessages
            .filter((message: Memory) => message.userId)
            .map((message: Memory) => {
                const actor = actors.find(
                    (actor: Actor) => actor.id === message.userId
                );
                const userName = actor?.name || "Unknown User";
                const displayName = actor?.username || "unknown";

                return `Name: ${userName} (@${displayName})
ID: ${message.id}${message.content.inReplyTo ? `\nIn reply to: ${message.content.inReplyTo}` : ""}
Date: ${formatTimestamp(message.createdAt ?? Date.now())}
Text:
${message.content.text}`;
            });

        const header = conversationHeader
            ? `Conversation: ${roomId.slice(-5)}\n`
            : "";
        return `${header}${messageStrings.join("\n\n")}`;
    });

    return formattedPosts.join("\n\n");
};
