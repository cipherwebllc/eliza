import { Content } from "@ai16z/eliza";

export interface MastodonConfig {
    serverUrl: string;
    accessToken: string;
}

export interface MastodonPoll {
    options: string[];
    expiresIn: number;
    multiple?: boolean;
    hideTotals?: boolean;
}

export interface MastodonPost {
    text: string;
    replyToId?: string;
    visibility?: "public" | "unlisted" | "private" | "direct";
    sensitive?: boolean;
    spoilerText?: string;
    mediaIds?: string[];
    poll?: MastodonPoll;
    language?: string;
    scheduledAt?: string;
}

export interface MastodonInteraction {
    type: "favourite" | "boost" | "reply";
    statusId: string;
    text?: string; // For replies
}

export interface MastodonStatus {
    id: string;
    content: string;
    visibility: "public" | "unlisted" | "private" | "direct";
    sensitive: boolean;
    spoilerText: string;
    mediaAttachments: any[];
    inReplyToId: string | null;
    createdAt: string;
    poll?: MastodonPoll;
}

export interface MastodonStatusToContent {
    (status: MastodonStatus): Content;
}
