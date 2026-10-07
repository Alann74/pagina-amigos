// Listado de una carpeta de Drive compartida con "cualquiera con el enlace", sin API key: la vista
// embebida pública de Drive trae el id y el nombre de cada archivo.

export type DriveEntry = { id: string; title: string; folder: boolean };

export async function listPublicFolder(folderId: string): Promise<DriveEntry[]> {
  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}`, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "es-AR,es;q=0.9" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Drive respondió ${res.status}`);
  const html = await res.text();
  const entries: DriveEntry[] = [];
  const re = /<div class="flip-entry" id="entry-([\w-]+)"[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>/g;
  for (const m of html.matchAll(re)) {
    const block = m[0];
    const title = m[2].replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
    entries.push({ id: m[1], title, folder: /\/drive\/folders\//.test(block) });
  }
  return entries;
}
