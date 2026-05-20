import { createClient } from "@supabase/supabase-js";

const PLATFORM_OWNER_ROLE = "PLATFORM_OWNER";

function readEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getAdminClient() {
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findAuthUserByEmail(
  client: ReturnType<typeof getAdminClient>,
  email: string,
) {
  let page = 1;
  const perPage = 200;
  const normalized = email.trim().toLowerCase();

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;

    const match = data.users.find(
      (u) => u.email?.trim().toLowerCase() === normalized,
    );
    if (match) return match;

    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function upsertOwnerProfile(
  client: ReturnType<typeof getAdminClient>,
  authUserId: string,
  email: string,
) {
  const { error } = await client
    .from("users_profile")
    .upsert(
      {
        auth_user_id: authUserId,
        email,
        global_role: PLATFORM_OWNER_ROLE,
      },
      { onConflict: "auth_user_id" },
    )
    .select("id")
    .single();

  if (error) throw error;
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Usage: npx tsx scripts/invite-admin.ts <email>");
    process.exit(1);
  }

  const appBaseUrl =
    process.env.APP_BASE_URL ?? "http://localhost:3000";
  const redirectTo = new URL("/callback", appBaseUrl);
  redirectTo.searchParams.set("next", "/admin");

  const client = getAdminClient();
  const existing = await findAuthUserByEmail(client, email);

  if (!existing) {
    console.log(`[invite-admin] No auth user found for ${email}. Sending invite…`);
    const { data, error } = await client.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectTo.toString(),
    });
    if (error) {
      console.error("[invite-admin] Invite failed:", error.message);
      process.exit(2);
    }
    console.log(
      `[invite-admin] Invite sent to ${email} (auth user id: ${data.user.id}).`,
    );
    console.log(
      "[invite-admin] After the user accepts the invitation and signs in, re-run this script to promote them to PLATFORM_OWNER.",
    );
    return;
  }

  console.log(
    `[invite-admin] Auth user already exists for ${email} (id: ${existing.id}). Promoting profile to ${PLATFORM_OWNER_ROLE}…`,
  );
  await upsertOwnerProfile(client, existing.id, email);
  console.log(`[invite-admin] ${email} is now PLATFORM_OWNER.`);
}

main().catch((error) => {
  console.error("[invite-admin] Unexpected error:", error);
  process.exit(3);
});
