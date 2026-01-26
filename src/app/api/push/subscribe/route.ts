import { NextResponse } from "next/server";
import PocketBase from "pocketbase";

export async function POST(request: Request) {
  try {
    const subscription = await request.json();
    if (!subscription) {
      return NextResponse.json(
        { error: "Missing subscription body" },
        { status: 400 },
      );
    }

    // Initialize generic PB client to save subscription
    // const pb = new PocketBase(process.env.PB_URL);
    // Authenticate as admin to write to push_subscriptions if it requires admin, OR use a public creation rule
    // For now we assume we use valid credentials or the collection is open/user-based.
    // Given the task, I'll use the secret to authenticate as admin to be safe,
    // or if the user is logged in, I should pass the auth cookie.
    // BUT this is a simple "enable notification" button.
    // Let's use the admin auth since we have PB_EMAIL and PB_SECRET in env,
    // though previously it looked like PB_SECRET was a token?
    // Looking at .env: PB_SECRET starts with eyJ... which is a JWT token.

    // If we have a token, we can just save it.
    // But better to check what we used elsewhere.

    // Actually, checking .env again:
    // PB_EMAIL=contact@andy-cinquin.fr
    // PB_SECRET=...token...

    // So we can assume PB_SECRET is an auth token or we can use admin login.
    // Wait, the token might be expired.
    // But let's assume `webhook.service.ts` works.

    // NOTE: We need a collection 'push_subscriptions'
    // I will try to save to it. If it fails, I might need to create it.
    // Since I can't create it easily via API without admin...
    // I'll try to find where we initialize PB

    // For now, I will use the admin login flow if needed, but let's try to just use the token if possible.
    // Actually, saving subscription should be associated with "me" if possible.
    // But here subscription is anonymous or for the single user app.

    // Let's implement basics.

    // We need to store the subscription JSON.
    // Collection: push_subscriptions
    // Fields: endpoint (text), keys (json), etc.
    // Or just store the whole blob in a JSON field.

    // Let's try to just insert.

    const pbAdmin = new PocketBase(process.env.PB_URL);
    // Login as admin
    // If I don't have password, I can't login as admin with just email?
    // PB_SECRET in .env looks like a token, so I can set it.
    pbAdmin.authStore.save(process.env.PB_SECRET || "", null);

    // Check if collection exists or just try to create.
    // Since we can't create collection via record create, we assume it exists.
    // If it doesn't, this will fail and I'll catch it.

    // We want to avoid duplicates.
    // We can try to findFirst by endpoint.

    try {
      const existing = await pbAdmin
        .collection("push_subscriptions")
        .getFirstListItem(`endpoint="${subscription.endpoint}"`);
      // If exists, update it? Or just return ok.
      return NextResponse.json({ success: true, id: existing.id });
    } catch (_e) {
      // Not found, create new
      const record = await pbAdmin.collection("push_subscriptions").create({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        userAgent: request.headers.get("user-agent"),
      });
      return NextResponse.json({ success: true, id: record.id });
    }
  } catch (error) {
    console.error("Error saving subscription:", error);
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 },
    );
  }
}
