// Para compartir (WhatsApp, Instagram, feed de Meta) se usa la versión JPG que se genera al importar cada foto.
export function shareImageUrl(url: string): string {
  return /-w\d+\.webp$/.test(url) ? url.replace(/-w\d+\.webp$/, "-share.jpg") : url;
}
