const PocketBase = require("pocketbase/cjs");

async function diag() {
  const pb = new PocketBase("https://jobs.andy-cinquin.fr");
  const secret =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2xsZWN0aW9uSWQiOiJwYmNfMzE0MjYzNTgyMyIsImV4cCI6MzE3ODkwMTgyOCwiaWQiOiJibTFqODBjZXVieXp1bXciLCJyZWZyZXNoYWJsZSI6ZmFsc2UsInR5cGUiOiJhdXRoIn0.rcqMrVTFsGXEuHkOY0x5GjaddgcthUuTnpkpnmIxwK0";

  pb.authStore.save(secret, null);

  try {
    const logs = await pb
      .collection("email_logs")
      .getList(1, 1, { filter: 'direction = "inbound"' });
    const emails = await pb
      .collection("emails")
      .getList(1, 1, { filter: 'folder = "inbox"' });
    const responses = await pb.collection("responses").getList(1, 1);

    console.log(`Inbound Logs: ${logs.totalItems}`);
    console.log(`Inbox Emails: ${emails.totalItems}`);
    console.log(`Responses: ${responses.totalItems}`);
  } catch (e) {
    console.error(e.message);
  }
}
diag();
