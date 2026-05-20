import { createClient } from "@supabase/supabase-js";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const service = env("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = `smoke-${Date.now()}@bextudio.test`;
  const password = "Sm0keTest!ng";

  console.log(`[smoke] 1/5 createUser ${email}`);
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  const authUserId = created.data.user.id;
  console.log(`        auth_user_id=${authUserId}`);

  console.log(`[smoke] 2/5 signInWithPassword`);
  const signIn = await anonClient.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  console.log(`        session token type=${signIn.data.session?.token_type}`);

  console.log(`[smoke] 3/5 upsert users_profile`);
  const upsert = await admin
    .from("users_profile")
    .upsert(
      {
        auth_user_id: authUserId,
        email,
        full_name: "Smoke Test",
        global_role: "REGISTERED_USER",
      },
      { onConflict: "auth_user_id" },
    )
    .select("id, global_role")
    .single();
  if (upsert.error) throw upsert.error;
  console.log(
    `        profile_id=${upsert.data.id} role=${upsert.data.global_role}`,
  );

  console.log(`[smoke] 4/5 listIdentities (would show google when linked)`);
  const { data: idents } = await admin.auth.admin.getUserById(authUserId);
  console.log(
    `        identities=${idents.user?.identities?.map((i) => i.provider).join(",")}`,
  );

  console.log(`[smoke] 5/5 cleanup: delete user`);
  const del = await admin.auth.admin.deleteUser(authUserId);
  if (del.error) throw del.error;
  console.log(`[smoke] OK — full email auth round-trip succeeded.`);
}

main().catch((e) => {
  console.error("[smoke] FAILED:", e?.message ?? e);
  process.exit(1);
});
