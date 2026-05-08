import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type HatPayload = {
  code?: unknown;
  name?: unknown;
  cost_price?: unknown;
  status?: unknown;
  sold_price?: unknown;
  platform?: unknown;
  bought_at?: unknown;
  sold_at?: unknown;
  image_url?: unknown;
};

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

async function getWorkspace(request: Request) {
  const clients = getClients();
  if (!clients) return { error: "SUPABASE_SERVICE_ROLE_KEY belum disiapkan.", workspaceUserId: null, adminClient: null, requester: null };

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Sesi login tidak ditemukan.", workspaceUserId: null, adminClient: null, requester: null };

  const { data, error } = await clients.authClient.auth.getUser(token);
  if (error || !data.user) return { error: "Sesi login tidak valid.", workspaceUserId: null, adminClient: null, requester: null };
  if (data.user.app_metadata?.status === "INACTIVE") return { error: "User ini sedang nonaktif.", workspaceUserId: null, adminClient: null, requester: null };

  const workspaceUserId = String(data.user.app_metadata?.created_by || data.user.id);
  return { error: null, workspaceUserId, adminClient: clients.adminClient, requester: data.user };
}

function isOwner(user: Awaited<ReturnType<typeof getWorkspace>>["requester"]) {
  if (!user) return false;
  return typeof user.app_metadata?.created_by !== "string" || user.app_metadata?.role === "Owner";
}

function isReportCorrection(updates: Record<string, unknown>) {
  const updatesSoldFields = "sold_price" in updates || "sold_at" in updates;
  return updates.status === "AVAILABLE" || (updatesSoldFields && updates.status !== "SOLD");
}

export async function GET(request: Request) {
  const { error: authError, workspaceUserId, adminClient } = await getWorkspace(request);
  if (authError || !workspaceUserId || !adminClient) return jsonError(authError || "Unauthorized", 401);

  const { data, error } = await adminClient.from("hats").select("*").eq("user_id", workspaceUserId).order("created_at", { ascending: false });
  if (error) return jsonError(error.message);

  return Response.json({ hats: data || [] });
}

export async function POST(request: Request) {
  const { error: authError, workspaceUserId, adminClient } = await getWorkspace(request);
  if (authError || !workspaceUserId || !adminClient) return jsonError(authError || "Unauthorized", 401);

  const body = await request.json();
  const rows: HatPayload[] = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return jsonError("Tidak ada item yang dikirim.");

  const safeRows = rows.map((row) => ({
    user_id: workspaceUserId,
    code: String(row.code || "").trim(),
    name: String(row.name || "").trim(),
    cost_price: Number(row.cost_price || 0),
    status: row.status === "SOLD" ? "SOLD" : "AVAILABLE",
    sold_price: row.sold_price ? Number(row.sold_price) : null,
    platform: row.platform ? String(row.platform) : "",
    bought_at: String(row.bought_at || new Date().toISOString().slice(0, 10)),
    sold_at: row.sold_at ? String(row.sold_at) : null,
    image_url: row.image_url ? String(row.image_url) : null,
  }));

  if (safeRows.some((row) => !row.code || !row.name || !row.cost_price)) {
    return jsonError("Kode, nama, dan harga modal wajib diisi.");
  }

  const { data, error } = await adminClient.from("hats").insert(safeRows).select("*");
  if (error) return jsonError(error.message);

  return Response.json({ hats: data || [] });
}

export async function PATCH(request: Request) {
  const { error: authError, workspaceUserId, adminClient, requester } = await getWorkspace(request);
  if (authError || !workspaceUserId || !adminClient) return jsonError(authError || "Unauthorized", 401);

  const body = await request.json();
  const id = String(body.id || "");
  const updates = body.updates || {};
  if (!id) return jsonError("ID topi wajib dikirim.");
  if (isReportCorrection(updates) && !isOwner(requester)) {
    return jsonError("Hanya Owner yang bisa mengubah atau menghapus laporan SOLD.", 403);
  }

  const { data, error } = await adminClient
    .from("hats")
    .update(updates)
    .eq("id", id)
    .eq("user_id", workspaceUserId)
    .select("*")
    .single();

  if (error) return jsonError(error.message);

  return Response.json({ hat: data });
}

export async function DELETE(request: Request) {
  const { error: authError, workspaceUserId, adminClient } = await getWorkspace(request);
  if (authError || !workspaceUserId || !adminClient) return jsonError(authError || "Unauthorized", 401);

  const { id } = await request.json();
  if (!id) return jsonError("ID topi wajib dikirim.");

  const { error } = await adminClient.from("hats").delete().eq("id", id).eq("user_id", workspaceUserId);
  if (error) return jsonError(error.message);

  return Response.json({ ok: true });
}
