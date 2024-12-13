export interface BlueskyConfig {
    identifier: string;
    password: string;
}

export interface BlueskyPost {
    text: string;
    replyTo?: {
        uri: string;
        cid: string;
    };
}

export interface BlueskyInteraction {
    type: "like" | "repost";
    uri: string;
    cid: string;
}
