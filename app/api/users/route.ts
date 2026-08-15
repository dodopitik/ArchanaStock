import { createClient, type User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ManagedUserStatus = "ACTIVE" | "INACTIVE";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function getClients() {
  if (!supabaseUrl || !supabasePublishableKey || !supabaseServiceRoleKey) return null;
  return {
    authClient: createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    adminClient: createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

async function getRequester(request: Request) {
  const clients = getClients();
  if (!clients) return { error: "SUPABASE_SERVICE_ROLE_KEY belum disiapkan.", requester: null, adminClient: null };

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Sesi login tidak ditemukan.", requester: null, adminClient: null };

  const { data, error } = await clients.authClient.auth.getUser(token);
  if (error || !data.user) return { error: "Sesi login tidak valid.", requester: null, adminClient: null };
  if (data.user.app_metadata?.status === "INACTIVE") {
    return { error: "User ini sedang nonaktif.", requester: null, adminClient: null };
  }

  return { error: null, requester: data.user, adminClient: clients.adminClient };
}

function normalizeStatus(value: unknown): ManagedUserStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function mapAuthUser(user: User, username?: string | null) {
  return {
    id: user.id,
    authUserId: user.id,
    name: String(user.user_metadata?.name || user.email || "User"),
    email: user.email || "",
    username: username ?? String(user.user_metadata?.username || ""),
    role: String(user.app_metadata?.role || user.user_metadata?.role || "Staff"),
    status: normalizeStatus(user.app_metadata?.status),
    createdAt: user.created_at,
  };
}

/** Ambil username dari user_profiles untuk satu atau banyak auth_user_id */
async function getUsernameMap(
  adminClient: NonNullable<ReturnType<typeof getClients>>["adminClient"],
  authUserIds: string[]
): Promise<Map<string, string>> {
  if (!authUserIds.length) return new Map();
  const { data } = await adminClient
    .from("user_profiles")
    .select("auth_user_id, username")
    .in("auth_user_id", authUserIds);
  const map = new Map<string, string>();
  (data || []).forEach((row: { auth_user_id: string; username: string | null }) => {
    if (row.username) map.set(row.auth_user_id, row.username);
  });
  return map;
}

/** Simpan atau update username di user_profiles */
async function upsertUsername(
  adminClient: NonNullable<ReturnType<typeof getClients>>["adminClient"],
  authUserId: string,
  workspaceOwnerId: string,
  username: string | null
) {
  if (!username) {
    // Hapus username kalau dikosongkan
    await adminClient.from("user_profiles").delete().eq("auth_user_id", authUserId);
    return null;
  }
  const { error } = await adminClient.from("user_profiles").upsert(
    { auth_user_id: authUserId, workspace_owner_id: workspaceOwnerId, username, updated_at: new Date().toISOString() },
    { onConflict: "auth_user_id" }
  );
  return error;
}

async function listManagedUsers(
  adminClient: NonNullable<ReturnType<typeof getClients>>["adminClient"],
  requesterId: string
) {
  const collected: User[] = [];
  let page = 1;

  while (page <= 10) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
    if (error) return { data: null, error };
    collected.push(...data.users);
    if (data.users.length < 100) break;
    page++;
  }

  const filtered = collected
    .filter((u) => u.id === requesterId || u.app_metadata?.created_by === requesterId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const usernameMap = await getUsernameMap(adminClient, filtered.map((u) => u.id));

  const users = filtered.map((u) =>
    u.id === requesterId
      ? { ...mapAuthUser(u, usernameMap.get(u.id) ?? null), role: String(u.app_metadata?.role || u.user_metadata?.role || "Owner"), status: "ACTIVE" as ManagedUserStatus }
      : mapAuthUser(u, usernameMap.get(u.id) ?? null)
  );

  return { data: users, error: null };
}

export async function GET(request: Request) {
  const { error: authError, requester, adminClient } = await getRequester(request);
  if (authError || !requester || !adminClient) return jsonError(authError || "Unauthorized", 401);

  const requesterId = String(requester.app_metadata?.created_by || requester.id);
  const { data, error } = await listManagedUsers(adminClient, requesterId);
  if (error) return jsonError(error.message);

  return Response.json({ users: data });
}

export async function POST(request: Request) {
  const { error: authError, requester, adminClient } = await getRequester(request);
  if (authError || !requester || !adminClient) return jsonError(authError || "Unauthorized", 401);

  if (requester.app_metadata?.created_by && requester.app_metadata?.role !== "Admin") {
    return jsonError("Hanya Owner atau Admin yang bisa membuat user.", 403);
  }

  const body = await request.json();
  const name = String(body.name || "").trim();
  const emailInput = String(body.email || "").trim();
  const username = String(body.username || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  const password = String(body.password || "");
  const role = String(body.role || "Staff").trim() || "Staff";
  const status = normalizeStatus(body.status);

  if (!name || password.length < 6) {
    return jsonError("Nama dan password minimal 6 karakter wajib diisi.");
  }
  if (!emailInput && !username) {
    return jsonError("Email atau username harus diisi.");
  }

  // Cek username unik
  if (username) {
    const { data: existing } = await adminClient.from("user_profiles").select("auth_user_id").eq("username", username).maybeSingle();
    if (existing) return jsonError(`Username "${username}" sudah dipakai.`);
  }

  // Kalau tidak ada email, generate dari username
  const email = emailInput || `${username}@archanacaps.internal`;

  const workspaceOwnerId = String(requester.app_metadata?.created_by || requester.id);

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, ...(username ? { username } : {}) },
    app_metadata: { created_by: workspaceOwnerId, role, status },
  });

  if (error || !data.user) return jsonError(error?.message || "Gagal membuat akun login.");

  // Simpan username ke user_profiles
  if (username) {
    await upsertUsername(adminClient, data.user.id, workspaceOwnerId, username);
  }

  return Response.json({ user: mapAuthUser(data.user, username || null) });
}

export async function PATCH(request: Request) {
  const { error: authError, requester, adminClient } = await getRequester(request);
  if (authError || !requester || !adminClient) return jsonError(authError || "Unauthorized", 401);

  const body = await request.json();
  const id = String(body.id || "");
  const name = String(body.name || "").trim();
  const emailInput = String(body.email || "").trim();
  const username = String(body.username || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  const password = String(body.password || "");
  const role = String(body.role || "Staff").trim() || "Staff";
  const status = normalizeStatus(body.status);

  if (!id || !name) return jsonError("Data user belum lengkap.");
  if (password && password.length < 6) return jsonError("Password minimal 6 karakter.");

  const current = await adminClient.auth.admin.getUserById(id);
  if (current.error || !current.data.user) return jsonError(current.error?.message || "User tidak ditemukan.");

  const workspaceOwnerId = String(requester.app_metadata?.created_by || requester.id);
  const isOwner = current.data.user.id === workspaceOwnerId;
  const isManagedUser = current.data.user.app_metadata?.created_by === workspaceOwnerId;
  if (!isOwner && !isManagedUser) return jsonError("User ini bukan milik workspace kamu.", 403);
  if (requester.app_metadata?.created_by && requester.app_metadata?.role !== "Admin") {
    return jsonError("Hanya Owner atau Admin yang bisa edit user.", 403);
  }

  // Cek username unik (selain milik user yang sedang diedit)
  if (username) {
    const { data: existing } = await adminClient.from("user_profiles").select("auth_user_id").eq("username", username).maybeSingle();
    if (existing && existing.auth_user_id !== id) return jsonError(`Username "${username}" sudah dipakai.`);
  }

  // Email: kalau ada input pakai itu, kalau tidak jangan ubah (tetap pakai email lama)
  const currentEmail = current.data.user.email || "";
  const newEmail = emailInput || currentEmail;

  const updates: Record<string, unknown> = {
    email: newEmail,
    user_metadata: { ...current.data.user.user_metadata, name, ...(username ? { username } : {}) },
    app_metadata: {
      ...current.data.user.app_metadata,
      created_by: isOwner ? current.data.user.app_metadata?.created_by : workspaceOwnerId,
      role,
      status: isOwner ? "ACTIVE" : status,
    },
  };
  if (password) updates.password = password;

  const { data, error } = await adminClient.auth.admin.updateUserById(id, updates);
  if (error || !data.user) return jsonError(error?.message || "Gagal update user.");

  // Upsert/hapus username di user_profiles
  await upsertUsername(adminClient, id, workspaceOwnerId, username || null);

  return Response.json({ user: mapAuthUser(data.user, username || null) });
}

export async function DELETE(request: Request) {
  const { error: authError, requester, adminClient } = await getRequester(request);
  if (authError || !requester || !adminClient) return jsonError(authError || "Unauthorized", 401);

  const { id } = await request.json();
  if (!id) return jsonError("ID user wajib dikirim.");
  if (id === requester.id) return jsonError("Akun yang sedang login tidak bisa dihapus dari sini.");
  if (requester.app_metadata?.created_by && requester.app_metadata?.role !== "Admin") {
    return jsonError("Hanya Owner atau Admin yang bisa hapus user.", 403);
  }

  const current = await adminClient.auth.admin.getUserById(id);
  if (current.error || !current.data.user) return jsonError(current.error?.message || "User tidak ditemukan.");
  const workspaceOwnerId = String(requester.app_metadata?.created_by || requester.id);
  if (current.data.user.app_metadata?.created_by !== workspaceOwnerId) return jsonError("User ini bukan milik workspace kamu.", 403);

  const { error } = await adminClient.auth.admin.deleteUser(id);
  if (error) return jsonError(error.message);

  return Response.json({ ok: true });
}
