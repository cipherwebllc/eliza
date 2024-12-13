import { BskyAgent } from "@atproto/api";
import { Content } from "@ai16z/eliza";

interface PostReference {
    uri: string;
    cid: string;
}

export interface BlueskyPost {
    text: string;
    replyTo?: PostReference;
}

export async function createPost(
    agent: BskyAgent,
    post: BlueskyPost
): Promise<void> {
    await agent.post({
        text: post.text,
        reply: post.replyTo
            ? {
                  root: { uri: post.replyTo.uri, cid: post.replyTo.cid },
                  parent: { uri: post.replyTo.uri, cid: post.replyTo.cid },
              }
            : undefined,
    });
}
