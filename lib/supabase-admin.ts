import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function getClients() {
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

export async function getWorkspace(request: Request) {
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

export function isOwner(user: Awaited<ReturnType<typeof getWorkspace>>["requester"]) {
  if (!user) return false;
  return typeof user.app_metadata?.created_by !== "string" || user.app_metadata?.role === "Owner";
}

export function parseStockQuantity(value: unknown) {
  if (value === "" || value === null || value === undefined) return 1;
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity >= 0 ? quantity : null;
}

const STORAGE_BUCKET = "product-images";
const STORAGE_PATH_MARKER = `/storage/v1/object/public/${STORAGE_BUCKET}/`;

export function extractStoragePath(imageUrl: string | null): string | null {
  if (!imageUrl || !imageUrl.includes(STORAGE_PATH_MARKER)) return null;
  return imageUrl.split(STORAGE_PATH_MARKER)[1] || null;
}

export { STORAGE_BUCKET };
