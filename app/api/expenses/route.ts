import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  if (!clients) return { error: "SUPABASE_SERVICE_ROLE_KEY belum disiapkan.", workspaceUserId: null, adminClient: null };

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Sesi login tidak ditemukan.", workspaceUserId: null, adminClient: null };

  const { data, error } = await clients.authClient.auth.getUser(token);
  if (error || !data.user) return { error: "Sesi login tidak valid.", workspaceUserId: null, adminClient: null };
  if (data.user.app_metadata?.status === "INACTIVE") return { error: "User ini sedang nonaktif.", workspaceUserId: null, adminClient: null };

  const workspaceUserId = String(data.user.app_metadata?.created_by || data.user.id);
  return { error: null, workspaceUserId, adminClient: clients.adminClient };
}

export async function GET(request: Request) {
  const { error: authError, workspaceUserId, adminClient } = await getWorkspace(request);
  if (authError || !workspaceUserId || !adminClient) return jsonError(authError || "Unauthorized", 401);

  const { data, error } = await adminClient
    .from("expenses")
    .select("*")
    .eq("user_id", workspaceUserId)
    .order("expense_date", { ascending: false });

  if (error) return jsonError(error.message);

  return Response.json({ expenses: data || [] });
}

export async function POST(request: Request) {
  const { error: authError, workspaceUserId, adminClient } = await getWorkspace(request);
  if (authError || !workspaceUserId || !adminClient) return jsonError(authError || "Unauthorized", 401);

  const body = await request.json();
  const label = String(body.label || "").trim();
  const amount = Number(body.amount || 0);
  const allowedTypes = ["owner_draw", "operational", "owner_capital", "savings_deposit", "savings_withdraw"];
  const type = allowedTypes.includes(body.type) ? body.type : "operational";
  const expenseDate = String(body.expense_date || new Date().toLocaleDateString("sv-SE"));

  if (!label) return jsonError("Keterangan pengeluaran wajib diisi.");
  if (!amount || amount <= 0) return jsonError("Jumlah pengeluaran harus lebih dari 0.");

  const { data, error } = await adminClient
    .from("expenses")
    .insert({ user_id: workspaceUserId, label, amount, type, expense_date: expenseDate })
    .select("*")
    .single();

  if (error) return jsonError(error.message);

  return Response.json({ expense: data });
}

export async function DELETE(request: Request) {
  const { error: authError, workspaceUserId, adminClient } = await getWorkspace(request);
  if (authError || !workspaceUserId || !adminClient) return jsonError(authError || "Unauthorized", 401);

  const { id } = await request.json();
  if (!id) return jsonError("ID pengeluaran wajib dikirim.");

  const { error } = await adminClient.from("expenses").delete().eq("id", id).eq("user_id", workspaceUserId);
  if (error) return jsonError(error.message);

  return Response.json({ ok: true });
}
