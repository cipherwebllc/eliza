export class RateLimiter {
  private lastRequest: number = 0;
  private readonly minInterval: number = 1000; // 1 second between requests

  async waitForToken(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;

    if (timeSinceLastRequest < this.minInterval) {
      await new Promise(resolve =>
        setTimeout(resolve, this.minInterval - timeSinceLastRequest)
      );
    }

    this.lastRequest = Date.now();
  }
}
