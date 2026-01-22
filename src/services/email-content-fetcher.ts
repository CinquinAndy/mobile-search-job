/**
 * Throttle manager for Resend API calls
 * Ensures we don't exceed 2 requests per second
 */
class ResendThrottler {
  private lastCallTime = 0;
  private readonly minDelay = 600; // 600ms between calls (safe for 2 req/sec)

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;

    if (timeSinceLastCall < this.minDelay) {
      const waitTime = this.minDelay - timeSinceLastCall;
      console.info(
        `[Throttler] Waiting ${waitTime}ms before next Resend call...`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastCallTime = Date.now();
    return fn();
  }
}

export const resendThrottler = new ResendThrottler();

/**
 * Fetch email content with automatic throttling
 * Calls server-side API route to avoid exposing Resend API key
 */
export async function fetchEmailContentThrottled(
  resendId: string,
  type: "outbound" | "inbound" = "outbound",
): Promise<{ html?: string; text?: string }> {
  return resendThrottler.throttle(async () => {
    // Call server-side API route with type parameter
    const response = await fetch(
      `/api/emails/content/${resendId}?type=${type}`,
    );
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch email content");
    }

    return {
      html: data.content.html || undefined,
      text: data.content.text || undefined,
    };
  });
}
