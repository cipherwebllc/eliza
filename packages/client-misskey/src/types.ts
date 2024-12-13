export interface MisskeyConfig {
    serverUrl: string;
    apiKey: string;
}

export interface MisskeyPoll {
    choices: string[];
    multiple?: boolean;
    expiresAt?: Date;
    expiredAfter?: number;
}

export interface MisskeyPost {
    text: string;
    replyId?: string;
    visibility?: 'public' | 'home' | 'followers' | 'specified';
    localOnly?: boolean;
    cw?: string;
    fileIds?: string[];
    poll?: MisskeyPoll;
}

export type MisskeyReactionType =
    | "like"
    | "love"
    | "laugh"
    | "hmm"
    | "surprise"
    | "congrats"
    | "angry"
    | "confused"
    | "rip"
    | "pudding"
    | "star"
    | string;

export interface MisskeyInteraction {
    type: "reaction" | "renote" | "quote";
    noteId: string;
    reaction?: MisskeyReactionType;
    text?: string;
}
