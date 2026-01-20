import PocketBase from "pocketbase";

const PB_URL = process.env.PB_URL ?? "https://jobs.andy-cinquin.fr";
const PB_SECRET = process.env.PB_SECRET;

if (!PB_URL) {
  throw new Error("PB_URL is required");
}

function createAdminClient(): PocketBase {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);

  if (PB_SECRET != null && PB_SECRET !== "") {
    pb.authStore.save(PB_SECRET, null);
    console.info("[PocketBase] Authenticated with admin secret");
  } else {
    console.warn(
      "[PocketBase] PB_SECRET not found - admin operations may not work",
    );
  }

  return pb;
}

export const pbAdmin = createAdminClient();
export const POCKETBASE_URL = PB_URL;

export async function getAdminPB(): Promise<PocketBase> {
  return pbAdmin;
}
