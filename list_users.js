const PocketBase = require("pocketbase/cjs");

async function listUsers() {
  const pb = new PocketBase("https://jobs.andy-cinquin.fr");
  const secret =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2xsZWN0aW9uSWQiOiJwYmNfMzE0MjYzNTgyMyIsImV4cCI6MzE3ODkwMTgyOCwiaWQiOiJibTFqODBjZXVieXp1bXciLCJyZWZyZXNoYWJsZSI6ZmFsc2UsInR5cGUiOiJhdXRoIn0.rcqMrVTFsGXEuHkOY0x5GjaddgcthUuTnpkpnmIxwK0";

  pb.authStore.save(secret, null);

  try {
    const users = await pb.collection("users").getFullList();
    console.log("Users:");
    users.forEach((u) => console.log(`- ${u.email} (${u.id})`));
  } catch (e) {
    console.error(e.message);
  }
}
listUsers();
