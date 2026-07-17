import { z } from "zod";
import type { PreviewAdapterId } from "@k-source-atlas/catalog";

const coordinate = z.coerce.number().finite();
const shortText = z.string().trim().min(1).max(80);
const radius = z.coerce.number().int().min(100).max(20_000).default(2_000);
const date = z.iso.date();

export const querySchemas = {
  weather: z.object({ lat: coordinate.min(33).max(39), lng: coordinate.min(124).max(132) }),
  "air-quality": z.object({ sido: z.string().trim().min(1).max(20), station: z.string().trim().min(1).max(40).optional() }),
  "transit-arrival": z.object({ q: shortText, cityCode: z.string().regex(/^\d{2,5}$/).optional() }),
  "public-facilities": z.object({ lat: coordinate.min(33).max(39), lng: coordinate.min(124).max(132), radiusM: radius }),
  places: z.object({ q: shortText, lat: coordinate.min(33).max(39).optional(), lng: coordinate.min(124).max(132).optional(), radiusM: radius }),
  performances: z.object({ from: date, to: date, region: z.string().regex(/^\d{2}$/).optional(), q: shortText.optional() }).superRefine(({ from, to }, context) => {
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
    if (days < 0 || days > 31) context.addIssue({ code: "custom", message: "날짜 범위는 0일 이상 31일 이하여야 합니다." });
  }),
} satisfies Record<PreviewAdapterId, z.ZodType>;

export function queryObject(url: URL): Record<string, string> {
  return Object.fromEntries([...url.searchParams.entries()].filter(([, value]) => value !== ""));
}

export function normalizedCacheUrl(url: URL): string {
  const normalized = new URL(`https://cache.k-source-atlas.invalid${url.pathname}`);
  [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)).forEach(([key, value]) => normalized.searchParams.append(key, value.trim()));
  return normalized.toString();
}
