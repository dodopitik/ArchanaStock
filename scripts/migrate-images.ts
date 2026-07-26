import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const envPath = resolve(import.meta.dirname, "..", ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET = "product-images";
const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 20;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function migrate() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (tidak ada perubahan)" : "LIVE"}`);
  console.log("");

  const { data: hats, error } = await admin
    .from("hats")
    .select("id, user_id, image_url")
    .like("image_url", "data:%");

  if (error) {
    console.error("Gagal query database:", error.message);
    process.exit(1);
  }

  if (!hats || hats.length === 0) {
    console.log("Tidak ada foto base64 yang perlu dimigrasikan.");
    return;
  }

  console.log(`Ditemukan ${hats.length} foto base64 untuk dimigrasikan.`);
  console.log("");

  let success = 0;
  let failed = 0;

  for (let i = 0; i < hats.length; i++) {
    const hat = hats[i];
    const progress = `[${i + 1}/${hats.length}]`;

    try {
      const commaIndex = hat.image_url.indexOf(",");
      if (commaIndex === -1) {
        console.log(`${progress} SKIP ${hat.id} — bukan format base64 data URI valid`);
        failed++;
        continue;
      }

      const base64Data = hat.image_url.substring(commaIndex + 1);
      const buffer = Buffer.from(base64Data, "base64");
      const webpBuffer = await sharp(buffer).webp({ quality: 82 }).toBuffer();

      const path = `${hat.user_id}/${hat.id}.webp`;

      if (DRY_RUN) {
        const originalKB = Math.round(buffer.length / 1024);
        const webpKB = Math.round(webpBuffer.length / 1024);
        const savings = Math.round((1 - webpKB / originalKB) * 100);
        console.log(`${progress} DRY RUN: ${hat.id} — ${originalKB}KB → ${webpKB}KB WebP (hemat ${savings}%) → ${path}`);
        success++;
        continue;
      }

      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(path, webpBuffer, { contentType: "image/webp", upsert: true });

      if (uploadError) {
        console.error(`${progress} GAGAL upload ${hat.id}:`, uploadError.message);
        failed++;
        continue;
      }

      const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);

      const { error: updateError } = await admin
        .from("hats")
        .update({ image_url: urlData.publicUrl })
        .eq("id", hat.id);

      if (updateError) {
        console.error(`${progress} GAGAL update DB ${hat.id}:`, updateError.message);
        failed++;
        continue;
      }

      const originalKB = Math.round(buffer.length / 1024);
      const webpKB = Math.round(webpBuffer.length / 1024);
      console.log(`${progress} OK: ${hat.id} — ${originalKB}KB → ${webpKB}KB WebP → ${urlData.publicUrl}`);
      success++;

      if ((i + 1) % BATCH_SIZE === 0 && i + 1 < hats.length) {
        console.log(`  ... pause 1 detik (batch ${Math.ceil((i + 1) / BATCH_SIZE)})...`);
        await sleep(1000);
      }
    } catch (err) {
      console.error(`${progress} ERROR ${hat.id}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log("");
  console.log("=== SELESAI ===");
  console.log(`Berhasil: ${success}`);
  console.log(`Gagal: ${failed}`);
  console.log(`Total: ${hats.length}`);
}

migrate().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
