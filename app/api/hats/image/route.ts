import { getWorkspace, jsonError, STORAGE_BUCKET } from "@/lib/supabase-admin";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: Request) {
  const { error: authError, workspaceUserId, adminClient } = await getWorkspace(request);
  if (authError || !workspaceUserId || !adminClient) return jsonError(authError || "Unauthorized", 401);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Request harus berupa multipart/form-data.");
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) return jsonError("File foto wajib dikirim.");
  if (file.size > MAX_FILE_SIZE) return jsonError("Ukuran foto maksimal 2MB.", 413);
  if (!file.type.startsWith("image/")) return jsonError("File harus berupa gambar.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const timestamp = Date.now();
  const random = crypto.randomUUID().slice(0, 8);
  const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
  const path = `${workspaceUserId}/${timestamp}-${random}.${ext}`;

  const { error: uploadError } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return jsonError(`Gagal upload foto: ${uploadError.message}`, 500);

  const { data: urlData } = adminClient.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);

  return Response.json({ url: urlData.publicUrl });
}
