import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * POST /api/username
 * Body: { username: string }
 * Returns: { email: string }
 * Lookup username dari tabel user_profiles, kembalikan email Supabase Auth yang terkait.
 * Endpoint ini tidak butuh auth (hanya mengembalikan email untuk keperluan login).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");

  if (!username) {
    return Response.json({ error: "Username tidak valid." }, { status: 400 });
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return Response.json({ error: "Server belum dikonfigurasi." }, { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Cari di tabel user_profiles berdasarkan username
  const { data: profile, error } = await adminClient
    .from("user_profiles")
    .select("auth_user_id")
    .eq("username", username)
    .maybeSingle();

  if (error || !profile) {
    return Response.json({ error: "Username tidak ditemukan." }, { status: 404 });
  }

  // Ambil email dari Supabase Auth
  const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(profile.auth_user_id);
  if (userError || !userData?.user?.email) {
    return Response.json({ error: "User tidak ditemukan." }, { status: 404 });
  }

  if (userData.user.app_metadata?.status === "INACTIVE") {
    return Response.json({ error: "User ini sedang nonaktif." }, { status: 403 });
  }

  return Response.json({ email: userData.user.email });
}
