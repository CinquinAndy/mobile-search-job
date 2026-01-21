const PocketBase = require("pocketbase/cjs");

async function diag() {
  const pb = new PocketBase("https://jobs.andy-cinquin.fr");
  const secret =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2xsZWN0aW9uSWQiOiJwYmNfMzE0MjYzNTgyMyIsImV4cCI6MzE3ODkwMTgyOCwiaWQiOiJibTFqODBjZXVieXp1bXciLCJyZWZyZXNoYWJsZSI6ZmFsc2UsInR5cGUiOiJhdXRoIn0.rcqMrVTFsGXEuHkOY0x5GjaddgcthUuTnpkpnmIxwK0";

  pb.authStore.save(secret, null);

  try {
    const user = await pb
      .collection("users")
      .getFirstListItem('email="cinquin.andy@gmail.com"')
      .catch(() => null);

    if (!user) {
      console.log("User not found");
      return;
    }

    console.log(`User ID: ${user.id}`);

    const inboxEmails = await pb.collection("emails").getList(1, 1, {
      filter: `user = "${user.id}" && folder = "inbox"`,
    });
    console.log(`Inbox Emails for this user: ${inboxEmails.totalItems}`);

    const sentEmails = await pb.collection("emails").getList(1, 1, {
      filter: `user = "${user.id}" && folder = "sent"`,
    });
    console.log(`Sent Emails for this user: ${sentEmails.totalItems}`);

    const inboundLogs = await pb.collection("email_logs").getList(1, 1, {
      filter: `user = "${user.id}" && direction = "inbound"`,
    });
    console.log(`Inbound Logs for this user: ${inboundLogs.totalItems}`);
  } catch (e) {
    console.error(e.message);
  }
}
diag();
