function isCloudinaryUrl(url: string): boolean {
  return url.includes("cloudinary.com");
}

function isBarboraUrl(url: string): boolean {
  return url.includes("barbora.lv");
}

function cleanCloudinaryUrl(url: string, width: number): string {
  return url
    .replace(/dpr_auto,/g, "")
    .replace(/,dpr_auto/g, "")
    .replace(/\bq_auto:low\b/g, "q_auto")
    .replace(/\bw_auto\b/g, `w_${width}`)
    .replace(/\bw_\d+\b/g, `w_${width}`);
}

function barboraProxyUrl(rawUrl: string, width: number): string {
  return `/api/image-proxy?url=${encodeURIComponent(rawUrl)}&w=${width}`;
}

export function getPhotoSrc(rawUrl: string | undefined | null, width: number, fallbackText?: string): string {
  if (!rawUrl) {
    const h = Math.round((width * 2) / 3);
    const text = fallbackText ? encodeURIComponent(fallbackText) : "No+Image";
    return `https://via.placeholder.com/${width}x${h}?text=${text}`;
  }
  if (isCloudinaryUrl(rawUrl)) return cleanCloudinaryUrl(rawUrl, width);
  if (isBarboraUrl(rawUrl)) return barboraProxyUrl(rawUrl, width);
  return rawUrl;
}

export function getPhotoSrcSet(rawUrl: string | undefined | null, widths: number[]): string | undefined {
  if (!rawUrl) return undefined;
  if (isCloudinaryUrl(rawUrl)) {
    const base = rawUrl
      .replace(/dpr_auto,/g, "")
      .replace(/,dpr_auto/g, "")
      .replace(/\bq_auto:low\b/g, "q_auto");
    return widths
      .map((w) => `${base.replace(/\bw_auto\b/g, `w_${w}`).replace(/\bw_\d+\b/g, `w_${w}`)} ${w}w`)
      .join(", ");
  }
  if (isBarboraUrl(rawUrl)) {
    return widths.map((w) => `${barboraProxyUrl(rawUrl, w)} ${w}w`).join(", ");
  }
  return undefined;
}

export function getServerSidePreloadUrl(rawUrl: string | undefined | null, width: number): string | null {
  if (!rawUrl) return null;
  if (isCloudinaryUrl(rawUrl)) return cleanCloudinaryUrl(rawUrl, width);
  if (isBarboraUrl(rawUrl)) return `/api/image-proxy?url=${encodeURIComponent(rawUrl)}&w=${width}`;
  return rawUrl;
}

export function getServerSidePreloadSrcSet(rawUrl: string | undefined | null, widths: number[]): string | null {
  if (!rawUrl) return null;
  if (isCloudinaryUrl(rawUrl)) {
    const base = rawUrl
      .replace(/dpr_auto,/g, "")
      .replace(/,dpr_auto/g, "")
      .replace(/\bq_auto:low\b/g, "q_auto");
    return widths
      .map((w) => `${base.replace(/\bw_auto\b/g, `w_${w}`).replace(/\bw_\d+\b/g, `w_${w}`)} ${w}w`)
      .join(", ");
  }
  if (isBarboraUrl(rawUrl)) {
    return widths.map((w) => `/api/image-proxy?url=${encodeURIComponent(rawUrl)}&w=${w} ${w}w`).join(", ");
  }
  return null;
}
