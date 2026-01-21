const PocketBase = require("pocketbase/cjs");

async function checkEmails() {
  const pb = new PocketBase("http://127.0.0.1:8090");

  try {
    // Authenticate as admin
    await pb.admins.authWithPassword("admin@admin.com", "admin123456");

    const sentCount = await pb.collection("emails").getList(1, 1, {
      filter: 'folder = "sent"',
    });

    const inboxCount = await pb.collection("emails").getList(1, 1, {
      filter: 'folder = "inbox"',
    });

    const logsCount = await pb.collection("email_logs").getList(1, 1, {
      filter: 'direction = "inbound"',
    });

    console.log("--- Email Statistics ---");
    console.log(`Sent emails in "emails" collection: ${sentCount.totalItems}`);
    console.log(
      `Inbox emails in "emails" collection: ${inboxCount.totalItems}`,
    );
    console.log(
      `Inbound logs in "email_logs" collection: ${logsCount.totalItems}`,
    );
    console.log("------------------------");

    if (inboxCount.totalItems === 0 && logsCount.totalItems > 0) {
      console.log(
        "Found inbound logs but no inbox emails. Suggests sync might need to be run or is incomplete.",
      );
    }
  } catch (error) {
    console.error("Failed to check emails:", error.message);
  }
}

checkEmails();
