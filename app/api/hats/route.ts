import { getWorkspace, jsonError, isOwner, parseStockQuantity, extractStoragePath, STORAGE_BUCKET } from "@/lib/supabase-admin";

type HatPayload = {
  code?: unknown;
  name?: unknown;
  cost_price?: unknown;
  stock_quantity?: unknown;
  status?: unknown;
  sold_price?: unknown;
  platform?: unknown;
  bought_at?: unknown;
  sold_at?: unknown;
  image_url?: unknown;
};

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
    stock_quantity: parseStockQuantity(row.stock_quantity),
    status: row.status === "SOLD" ? "SOLD" : "AVAILABLE",
    sold_price: row.sold_price ? Number(row.sold_price) : null,
    platform: row.platform ? String(row.platform) : "",
    bought_at: String(row.bought_at || new Date().toLocaleDateString("sv-SE")),
    sold_at: row.sold_at ? String(row.sold_at) : null,
    image_url: row.image_url ? String(row.image_url) : null,
  }));

  if (safeRows.some((row) => !row.code || !row.name || !row.cost_price)) {
    return jsonError("Kode, nama, dan harga modal wajib diisi.");
  }
  if (safeRows.some((row) => row.stock_quantity === null)) {
    return jsonError("Jumlah stok harus berupa bilangan bulat 0 atau lebih.");
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
  const rawUpdates = body.updates || {};
  if (!id) return jsonError("ID topi wajib dikirim.");

  if (body.action === "SELL") {
    const soldPrice = Number(body.sale?.sold_price);
    const platform = String(body.sale?.platform || "").trim();
    const soldAt = String(body.sale?.sold_at || new Date().toLocaleDateString("sv-SE"));
    if (!Number.isFinite(soldPrice) || soldPrice <= 0) return jsonError("Harga jual wajib lebih dari 0.");

    const { data: inventoryHat, error: inventoryError } = await adminClient
      .from("hats")
      .select("*")
      .eq("id", id)
      .eq("user_id", workspaceUserId)
      .eq("status", "AVAILABLE")
      .single();
    if (inventoryError || !inventoryHat) return jsonError("Barang stok tidak ditemukan.", 404);

    const currentQuantity = Number(inventoryHat.stock_quantity || 0);
    if (currentQuantity < 1) return jsonError("Stok barang sudah habis.");

    const { data: sale, error: saleError } = await adminClient
      .from("hats")
      .insert({
        user_id: workspaceUserId,
        code: inventoryHat.code,
        name: inventoryHat.name,
        cost_price: inventoryHat.cost_price,
        stock_quantity: 0,
        status: "SOLD",
        sold_price: soldPrice,
        platform,
        bought_at: inventoryHat.bought_at,
        sold_at: soldAt,
        image_url: inventoryHat.image_url,
        inventory_hat_id: inventoryHat.id,
      })
      .select("*")
      .single();
    if (saleError || !sale) return jsonError(saleError?.message || "Gagal membuat laporan penjualan.");

    const { data: updatedInventory, error: updateError } = await adminClient
      .from("hats")
      .update({ stock_quantity: currentQuantity - 1 })
      .eq("id", id)
      .eq("user_id", workspaceUserId)
      .eq("stock_quantity", currentQuantity)
      .select("*")
      .maybeSingle();

    if (updateError || !updatedInventory) {
      await adminClient.from("hats").delete().eq("id", sale.id).eq("user_id", workspaceUserId);
      return jsonError(updateError?.message || "Stok berubah saat transaksi diproses. Silakan coba lagi.", 409);
    }

    return Response.json({ inventoryHat: updatedInventory, sale });
  }

  if (body.action === "RETURN") {
    if (!isOwner(requester)) return jsonError("Hanya Owner yang bisa menghapus laporan SOLD.", 403);

    const { data: sale, error: saleError } = await adminClient
      .from("hats")
      .select("*")
      .eq("id", id)
      .eq("user_id", workspaceUserId)
      .eq("status", "SOLD")
      .single();
    if (saleError || !sale) return jsonError("Laporan SOLD tidak ditemukan.", 404);

    if (!sale.inventory_hat_id) {
      const legacyQuantity = Math.max(0, Number(sale.stock_quantity || 0)) + 1;
      const { data: restoredHat, error: restoreError } = await adminClient
        .from("hats")
        .update({ status: "AVAILABLE", stock_quantity: legacyQuantity, sold_price: null, platform: "", sold_at: null })
        .eq("id", id)
        .eq("user_id", workspaceUserId)
        .select("*")
        .single();
      if (restoreError) return jsonError(restoreError.message);
      return Response.json({ inventoryHat: restoredHat, removedSaleId: null });
    }

    const { data: inventoryHat, error: inventoryError } = await adminClient
      .from("hats")
      .select("*")
      .eq("id", sale.inventory_hat_id)
      .eq("user_id", workspaceUserId)
      .eq("status", "AVAILABLE")
      .single();
    if (inventoryError || !inventoryHat) return jsonError("Barang asal transaksi tidak ditemukan.", 404);

    const currentQuantity = Number(inventoryHat.stock_quantity || 0);
    const { data: restoredInventory, error: restoreError } = await adminClient
      .from("hats")
      .update({ stock_quantity: currentQuantity + 1 })
      .eq("id", inventoryHat.id)
      .eq("user_id", workspaceUserId)
      .eq("stock_quantity", currentQuantity)
      .select("*")
      .maybeSingle();
    if (restoreError || !restoredInventory) return jsonError(restoreError?.message || "Stok berubah saat retur diproses. Silakan coba lagi.", 409);

    const { error: deleteError } = await adminClient.from("hats").delete().eq("id", sale.id).eq("user_id", workspaceUserId);
    if (deleteError) {
      await adminClient.from("hats").update({ stock_quantity: currentQuantity }).eq("id", inventoryHat.id).eq("user_id", workspaceUserId);
      return jsonError(deleteError.message);
    }

    return Response.json({ inventoryHat: restoredInventory, removedSaleId: sale.id });
  }

  if (isReportCorrection(rawUpdates) && !isOwner(requester)) {
    return jsonError("Hanya Owner yang bisa mengubah atau menghapus laporan SOLD.", 403);
  }

  // Whitelist: hanya field yang boleh di-update dari client.
  const allowedFields = ["name", "cost_price", "stock_quantity", "status", "sold_price", "platform", "sold_at", "image_url"];
  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in rawUpdates) {
      updates[key] = rawUpdates[key];
    }
  }

  if ("stock_quantity" in updates) {
    const stockQuantity = parseStockQuantity(updates.stock_quantity);
    if (stockQuantity === null) return jsonError("Jumlah stok harus berupa bilangan bulat 0 atau lebih.");
    updates.stock_quantity = stockQuantity;
  }

  if (Object.keys(updates).length === 0) return jsonError("Tidak ada field valid untuk di-update.");

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

  const { data: hat } = await adminClient
    .from("hats")
    .select("image_url")
    .eq("id", id)
    .eq("user_id", workspaceUserId)
    .single();

  const { error } = await adminClient.from("hats").delete().eq("id", id).eq("user_id", workspaceUserId);
  if (error) return jsonError(error.message);

  const storagePath = extractStoragePath(hat?.image_url);
  if (storagePath) {
    const { count } = await adminClient
      .from("hats")
      .select("id", { count: "exact", head: true })
      .eq("user_id", workspaceUserId)
      .eq("image_url", hat!.image_url);

    if (count === null || count === 0) {
      await adminClient.storage.from(STORAGE_BUCKET).remove([storagePath]);
    }
  }

  return Response.json({ ok: true });
}
