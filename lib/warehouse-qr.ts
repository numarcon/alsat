export type PickupQrData = {
  stickerCode: string;
  orderId?: string;
};

export function buildPickupQrValue(stickerCode: string, orderId?: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://alsat-ten.vercel.app";
  const url = new URL("/dispatcher", origin);
  url.searchParams.set("pickup", stickerCode.trim().toUpperCase());
  if (orderId) url.searchParams.set("order", orderId);
  return url.toString();
}

export function parsePickupQrValue(rawValue: string): PickupQrData | null {
  const raw = rawValue.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const pickup = url.searchParams.get("pickup");
    if (pickup) return normalizePickupData(pickup, url.searchParams.get("order") ?? undefined);
  } catch {
    // A manually entered sticker code is valid too.
  }

  const structured = raw.match(/^ALSAT[|:]PICKUP[|:](ST-[A-Z0-9-]+)(?:[|:]([0-9a-f-]{36}))?$/i);
  if (structured) return normalizePickupData(structured[1], structured[2]);

  const sticker = raw.toUpperCase().match(/ST-[A-Z0-9-]+/)?.[0]
    ?? (/^\d{4,}$/.test(raw) ? `ST-${raw}` : undefined);
  return sticker ? normalizePickupData(sticker) : null;
}

function normalizePickupData(stickerCode: string, orderId?: string): PickupQrData | null {
  const normalizedCode = stickerCode.trim().toUpperCase();
  if (!/^ST-[A-Z0-9-]+$/.test(normalizedCode)) return null;
  return {
    stickerCode: normalizedCode,
    ...(orderId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId) ? { orderId } : {}),
  };
}
