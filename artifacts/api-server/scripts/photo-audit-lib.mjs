import sharp from "sharp";

export const IMAGE_HOSTS = new Set(["cdn.barbora.lv", "rimibaltic-res.cloudinary.com"]);
const TRANSIENT = new Set([408, 425, 429, 500, 502, 503, 504]);
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function classifyStatus(status) {
  if (status === 403 || status === 401) return "access_denied";
  if (status === 404 || status === 410) return "not_found";
  if (status === 429) return "rate_limited";
  if (TRANSIENT.has(status)) return "temporary_failure";
  return "http_error";
}

export function csvCell(value) {
  let text = String(value ?? "");
  // Reports may be opened in Excel: neutralize spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function allowedUrl(value, allowedHosts) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      allowedHosts.has(url.hostname) && (!url.port || url.port === "443");
  } catch {
    return false;
  }
}

// Bound redirects, response size, and the whole download, not just response headers.
export async function download(url, allowedHosts, maxBytes = 5 * 1024 * 1024) {
  const signal = AbortSignal.timeout(12000);
  for (let redirect = 0; redirect <= 4; redirect++) {
    if (!allowedUrl(url, allowedHosts)) return { result: "unsupported_host" };
    let response;
    try {
      response = await fetch(url, {
        signal, redirect: "manual",
        headers: { "User-Agent": "ABCDE.lv/1.0 image-proxy" },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) return { result: "invalid_redirect", status: response.status };
        url = new URL(location, url).href;
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        return { result: classifyStatus(response.status), status: response.status };
      }
      const reader = response.body?.getReader();
      if (!reader) return { result: "empty_response", status: response.status };
      const chunks = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          return { result: "size_limit", status: response.status };
        }
        chunks.push(Buffer.from(value));
      }
      return {
        result: "downloaded", status: response.status, finalUrl: url,
        contentType: response.headers.get("content-type") ?? "",
        buffer: Buffer.concat(chunks),
      };
    } catch {
      return { result: signal.aborted ? "timeout" : "network_error" };
    }
  }
  return { result: "too_many_redirects" };
}

export async function checkImage(url, allowedHosts = IMAGE_HOSTS) {
  const response = await download(url, allowedHosts);
  if (response.result !== "downloaded") return response;
  const { buffer, ...details } = response;
  try {
    const metadata = await sharp(buffer, { limitInputPixels: 20_000_000 }).metadata();
    if (!metadata.width || !metadata.height) return { ...details, result: "invalid_image" };
    // Decode pixels: metadata alone can succeed for a truncated/corrupt image.
    await sharp(buffer, { limitInputPixels: 20_000_000 }).resize(16, 16).raw().toBuffer();
    return { ...details, result: "healthy", width: metadata.width, height: metadata.height };
  } catch {
    return { ...details, result: "invalid_image" };
  }
}

export function extractReplacement(html, pageUrl) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)]
        .map(match => [match[1].toLowerCase(), match[3]]),
    );
    if ((attributes.property ?? attributes.name)?.toLowerCase() !== "og:image") continue;
    try {
      const url = new URL((attributes.content ?? "").replaceAll("&amp;", "&"), pageUrl).href;
      if (allowedUrl(url, IMAGE_HOSTS)) return url;
    } catch { /* An invalid candidate is not a replacement. */ }
  }
  return null;
}
