import { createClient, type User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ManagedUserStatus = "ACTIVE" | "INACTIVE";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function getClients() {
  if (!supabaseUrl || !supabasePublishableKey || !supabaseServiceRoleKey) {
    return null;
  }

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
  if (!clients) return { error: "SUPABASE_SERVICE_ROLE_KEY belum disiapkan.", requesterId: null, adminClient: null };

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Sesi login tidak ditemukan.", requesterId: null, adminClient: null };

  const { data, error } = await clients.authClient.auth.getUser(token);
  if (error || !data.user) return { error: "Sesi login tidak valid.", requesterId: null, adminClient: null };

  return { error: null, requesterId: data.user.id, adminClient: clients.adminClient };
}

function normalizeStatus(value: unknown): ManagedUserStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function mapAuthUser(user: User) {
  return {
    id: user.id,
    authUserId: user.id,
    name: String(user.user_metadata?.name || user.email || "User"),
    email: user.email || "",
    role: String(user.app_metadata?.role || user.user_metadata?.role || "Staff"),
    status: normalizeStatus(user.app_metadata?.status),
    createdAt: user.created_at,
  };
}

async function listManagedUsers(adminClient: NonNullable<ReturnType<typeof getClients>>["adminClient"], requesterId: string) {
  const collected: User[] = [];
  let page = 1;

  while (page <= 10) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
    if (error) return { data: null, error };

    collected.push(...data.users);
    if (data.users.length < 100) break;
    page += 1;
  }

  const users = collected
    .filter((user) => user.id === requesterId || user.app_metadata?.created_by === requesterId)
    .map((user) =>
      user.id === requesterId
        ? {
            ...mapAuthUser(user),
            role: String(user.app_metadata?.role || user.user_metadata?.role || "Owner"),
            status: "ACTIVE" as ManagedUserStatus,
          }
        : mapAuthUser(user)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { data: users, error: null };
}

export async function GET(request: Request) {
  const { error: authError, requesterId, adminClient } = await getRequester(request);
  if (authError || !requesterId || !adminClient) return jsonError(authError || "Unauthorized", 401);

  const { data, error } = await listManagedUsers(adminClient, requesterId);
  if (error) return jsonError(error.message);

  return Response.json({ users: data });
}

export async function POST(request: Request) {
  const { error: authError, requesterId, adminClient } = await getRequester(request);
  if (authError || !requesterId || !adminClient) return jsonError(authError || "Unauthorized", 401);

  const body = await request.json();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  const role = String(body.role || "Staff").trim() || "Staff";
  const status = normalizeStatus(body.status);

  if (!name || !email || password.length < 6) {
    return jsonError("Nama, email, dan password minimal 6 karakter wajib diisi.");
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { created_by: requesterId, role, status },
  });

  if (error || !data.user) return jsonError(error?.message || "Gagal membuat akun login.");

  return Response.json({ user: mapAuthUser(data.user) });
}

export async function PATCH(request: Request) {
  const { error: authError, requesterId, adminClient } = await getRequester(request);
  if (authError || !requesterId || !adminClient) return jsonError(authError || "Unauthorized", 401);

  const body = await request.json();
  const id = String(body.id || "");
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  const role = String(body.role || "Staff").trim() || "Staff";
  const status = normalizeStatus(body.status);

  if (!id || !name || !email) return jsonError("Data user belum lengkap.");
  if (password && password.length < 6) return jsonError("Password minimal 6 karakter.");

  const current = await adminClient.auth.admin.getUserById(id);
  if (current.error || !current.data.user) return jsonError(current.error?.message || "User tidak ditemukan.");

  const isOwner = current.data.user.id === requesterId;
  const isManagedUser = current.data.user.app_metadata?.created_by === requesterId;
  if (!isOwner && !isManagedUser) return jsonError("User ini bukan milik workspace kamu.", 403);

  const updates = {
    email,
    ...(password ? { password } : {}),
    user_metadata: { ...current.data.user.user_metadata, name },
    app_metadata: {
      ...current.data.user.app_metadata,
      created_by: isOwner ? current.data.user.app_metadata?.created_by : requesterId,
      role,
      status: isOwner ? "ACTIVE" : status,
    },
  };

  const { data, error } = await adminClient.auth.admin.updateUserById(id, updates);
  if (error || !data.user) return jsonError(error?.message || "Gagal update user.");

  return Response.json({ user: mapAuthUser(data.user) });
}

export async function DELETE(request: Request) {
  const { error: authError, requesterId, adminClient } = await getRequester(request);
  if (authError || !requesterId || !adminClient) return jsonError(authError || "Unauthorized", 401);

  const { id } = await request.json();
  if (!id) return jsonError("ID user wajib dikirim.");
  if (id === requesterId) return jsonError("Akun yang sedang login tidak bisa dihapus dari sini.");

  const current = await adminClient.auth.admin.getUserById(id);
  if (current.error || !current.data.user) return jsonError(current.error?.message || "User tidak ditemukan.");
  if (current.data.user.app_metadata?.created_by !== requesterId) return jsonError("User ini bukan milik workspace kamu.", 403);

  const { error } = await adminClient.auth.admin.deleteUser(id);
  if (error) return jsonError(error.message);

  return Response.json({ ok: true });
}
