import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const USERNAME_EMAIL_SUFFIX = "@archanacaps.internal";

/**
 * POST /api/username
 * Body: { username: string }
 * Returns: { email: string } — email yang harus dipakai untuk signInWithPassword
 *
 * Strategi pencarian:
 * 1. Coba email internal (username@archanacaps.internal) — user baru yang dibuat dengan username
 * 2. Cari di user_metadata.username — user yang punya username tersimpan di metadata
 * Endpoint ini TIDAK butuh auth karena hanya mengembalikan email (bukan data sensitif).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");

  if (!username || username.length < 1) {
    return Response.json({ error: "Username tidak valid." }, { status: 400 });
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return Response.json({ error: "Server belum dikonfigurasi." }, { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Strategi 1: email internal langsung (user dibuat dengan username saja)
  // Strategi 2: cari di seluruh user yang punya user_metadata.username cocok
  // Keduanya digabung dalam satu scan
  const internalEmail = `${username}${USERNAME_EMAIL_SUFFIX}`;
  let page = 1;
  while (page <= 10) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
    if (error || !data?.users?.length) break;

    // Cek email internal atau metadata username
    const match = data.users.find(
      (u) =>
        u.app_metadata?.status !== "INACTIVE" &&
        (u.email === internalEmail ||
          String(u.user_metadata?.username ?? "").toLowerCase() === username)
    );
    if (match?.email) {
      return Response.json({ email: match.email });
    }

    if (data.users.length < 100) break;
    page++;
  }

  return Response.json({ error: "Username tidak ditemukan." }, { status: 404 });
}
