import { describe, expect, it } from "vitest";
import type { Source } from "@k-source-atlas/catalog";
import { addToComparison, filterSources, removeFromComparison } from "../src/lib/discovery.js";

const sources = [
  { id: "weather", name: "기상청", summary: "동네예보", domains: ["weather"], delivery: ["open-api"], auth: "api-key", realtime: "hourly", geography: ["nationwide"], keywords: ["날씨"], formats: ["JSON"], data: [{ name: "예보", fields: ["기온"] }], technologyIds: ["rest-api"] },
  { id: "culture", name: "문화포털", summary: "공연 일정", domains: ["culture"], delivery: ["file"], auth: "none", realtime: "daily", geography: ["seoul"], keywords: ["공연"], formats: ["CSV"], data: [{ name: "공연", fields: ["공연장"] }], technologyIds: ["csv"] },
] as Source[];

describe("source discovery", () => {
  it("searches names, descriptions, keywords, fields, and technology labels", () => {
    expect(filterSources(sources, { query: "기온" }).map(({ id }) => id)).toEqual(["weather"]);
    expect(filterSources(sources, { query: "rest api", technologyNames: { "rest-api": "REST API" } }).map(({ id }) => id)).toEqual(["weather"]);
  });

  it("applies compound filters", () => {
    expect(filterSources(sources, { domain: "weather", delivery: "open-api", auth: "api-key", realtime: "hourly", geography: "nationwide" })).toHaveLength(1);
    expect(filterSources(sources, { domain: "weather", delivery: "file" })).toHaveLength(0);
  });

  it("keeps comparison unique and capped at four", () => {
    expect(addToComparison(["a", "b", "c", "d"], "e")).toEqual(["a", "b", "c", "d"]);
    expect(addToComparison(["a"], "a")).toEqual(["a"]);
    expect(removeFromComparison(["a", "b"], "a")).toEqual(["b"]);
  });
});
