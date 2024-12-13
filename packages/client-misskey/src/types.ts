export interface MisskeyConfig {
    serverUrl: string;
    apiKey: string;
}

export interface MisskeyPost {
    text: string;
    replyId?: string;
    visibility?: 'public' | 'home' | 'followers' | 'specified';
}

export interface MisskeyInteraction {
    type: "reaction" | "renote";
    noteId: string;
    reaction?: string;
}
