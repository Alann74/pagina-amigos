"use client";

// Achica la foto en el navegador antes de subirla (las de cámara pesan 5–15 MB y el servidor acepta hasta 4 MB).
export async function shrinkImage(file: File, maxSide = 2400, quality = 0.9): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp|heic|heif|avif)$/.test(file.type) && !file.type.startsWith("image/")) throw new Error("El archivo no es una imagen");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // formatos que el navegador no decodifica: se sube tal cual
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  return blob ?? file;
}

export async function uploadImage(file: File, fields: Record<string, string>): Promise<Record<string, unknown>> {
  const blob = await shrinkImage(file);
  const fd = new FormData();
  fd.set("file", blob, file.name.replace(/\.[^.]+$/, "") + ".jpg");
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
  return data;
}
