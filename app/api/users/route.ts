import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function formatDbError(message: string) {
  if (message.includes("Could not find the table 'public.app_users'")) {
    return "Tabel public.app_users belum aktif di Supabase. Jalankan ulang supabase/schema.sql di SQL Editor, lalu restart npm run dev.";
  }

  return message;
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

async function getRequesterId(request: Request) {
  const clients = getClients();
  if (!clients) return { error: "SUPABASE_SERVICE_ROLE_KEY belum disiapkan.", requesterId: null, adminClient: null };

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Sesi login tidak ditemukan.", requesterId: null, adminClient: null };

  const { data, error } = await clients.authClient.auth.getUser(token);
  if (error || !data.user) return { error: "Sesi login tidak valid.", requesterId: null, adminClient: null };

  return { error: null, requesterId: data.user.id, adminClient: clients.adminClient };
}

export async function POST(request: Request) {
  const { error: authError, requesterId, adminClient } = await getRequesterId(request);
  if (authError || !requesterId || !adminClient) return jsonError(authError || "Unauthorized", 401);

  const body = await request.json();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  const role = String(body.role || "Staff").trim() || "Staff";
  const status = body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

  if (!name || !email || password.length < 6) {
    return jsonError("Nama, email, dan password minimal 6 karakter wajib diisi.");
  }

  const { error: tableError } = await adminClient.from("app_users").select("id").limit(1);
  if (tableError) return jsonError(formatDbError(tableError.message));

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  });

  if (createError || !created.user) return jsonError(createError?.message || "Gagal membuat akun login.");

  const { data, error } = await adminClient
    .from("app_users")
    .insert({
      user_id: requesterId,
      auth_user_id: created.user.id,
      name,
      email,
      role,
      status,
    })
    .select("*")
    .single();

  if (error) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return jsonError(formatDbError(error.message));
  }

  return Response.json({ user: data });
}

export async function PATCH(request: Request) {
  const { error: authError, requesterId, adminClient } = await getRequesterId(request);
  if (authError || !requesterId || !adminClient) return jsonError(authError || "Unauthorized", 401);

  const body = await request.json();
  const id = String(body.id || "");
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  const role = String(body.role || "Staff").trim() || "Staff";
  const status = body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

  if (!id || !name || !email) return jsonError("Data user belum lengkap.");
  if (password && password.length < 6) return jsonError("Password minimal 6 karakter.");

  const { data: existing, error: lookupError } = await adminClient
    .from("app_users")
    .select("auth_user_id")
    .eq("id", id)
    .eq("user_id", requesterId)
    .single();

  if (lookupError) return jsonError(formatDbError(lookupError.message));

  if (existing?.auth_user_id) {
    const authUpdates = password ? { email, password, user_metadata: { name, role } } : { email, user_metadata: { name, role } };
    const { error } = await adminClient.auth.admin.updateUserById(existing.auth_user_id, authUpdates);
    if (error) return jsonError(error.message);
  }

  const { data, error } = await adminClient
    .from("app_users")
    .update({ name, email, role, status })
    .eq("id", id)
    .eq("user_id", requesterId)
    .select("*")
    .single();

  if (error) return jsonError(formatDbError(error.message));

  return Response.json({ user: data });
}

export async function DELETE(request: Request) {
  const { error: authError, requesterId, adminClient } = await getRequesterId(request);
  if (authError || !requesterId || !adminClient) return jsonError(authError || "Unauthorized", 401);

  const { id } = await request.json();
  if (!id) return jsonError("ID user wajib dikirim.");

  const { data: existing, error: lookupError } = await adminClient
    .from("app_users")
    .select("auth_user_id")
    .eq("id", id)
    .eq("user_id", requesterId)
    .single();

  if (lookupError) return jsonError(formatDbError(lookupError.message));

  const { error } = await adminClient.from("app_users").delete().eq("id", id).eq("user_id", requesterId);
  if (error) return jsonError(formatDbError(error.message));

  if (existing?.auth_user_id) {
    await adminClient.auth.admin.deleteUser(existing.auth_user_id);
  }

  return Response.json({ ok: true });
}
