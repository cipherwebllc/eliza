export interface MastodonConfig {
    serverUrl: string;
    accessToken: string;
    clientId?: string;
    clientSecret?: string;
}

export interface MastodonPost {
    text: string;
    replyToId?: string;
    visibility?: 'public' | 'unlisted' | 'private' | 'direct';
}

export interface MastodonInteraction {
    type: "favourite" | "boost";
    statusId: string;
}
