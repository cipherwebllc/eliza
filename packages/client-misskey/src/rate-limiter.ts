import { elizaLogger } from "@ai16z/eliza";

export class RateLimiter {
    private lastRequest: number = 0;
    private requestInterval: number = 1000; // 1 second between requests

    constructor(requestsPerMinute: number = 60) {
        this.requestInterval = Math.ceil(60000 / requestsPerMinute);
    }

    async waitForNext(): Promise<void> {
        const now = Date.now();
        const timeToWait = this.lastRequest + this.requestInterval - now;

        if (timeToWait > 0) {
            elizaLogger.debug(`Rate limiter waiting for ${timeToWait}ms`);
            await new Promise(resolve => setTimeout(resolve, timeToWait));
        }

        this.lastRequest = Date.now();
    }
}
