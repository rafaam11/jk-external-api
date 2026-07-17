import { describe, expect, it } from "vitest";
import {
  deriveRegistryPage,
  parseRegistryView,
  serializeRegistryView,
  type RegistryRowData,
} from "../src/lib/registry.js";

const rows: RegistryRowData[] = [
  { id: "gamma", searchText: "감마 대기 오픈 API", fields: { category: "환경", auth: "api-key" } },
  { id: "alpha", searchText: "알파 교통 CSV", fields: { category: "교통", auth: "none" } },
  { id: "beta", searchText: "베타 교통 JSON", fields: { category: "교통", auth: "api-key" } },
];

describe("registry view URL", () => {
  const available = {
    source: new Set(["weather-kma"]),
    skill: new Set(["weather-skill"]),
    blueprint: new Set(["commute-condition"]),
    technology: new Set(["rest-api"]),
  };

  it("parses and serializes all four registry kinds", () => {
    expect(parseRegistryView("?view=source:weather-kma", available)).toEqual({ kind: "source", id: "weather-kma" });
    expect(parseRegistryView("?view=skill:weather-skill", available)).toEqual({ kind: "skill", id: "weather-skill" });
    expect(parseRegistryView("?view=blueprint:commute-condition", available)).toEqual({ kind: "blueprint", id: "commute-condition" });
    expect(parseRegistryView("?view=technology:rest-api", available)).toEqual({ kind: "technology", id: "rest-api" });
    expect(serializeRegistryView({ kind: "source", id: "weather-kma" })).toBe("source:weather-kma");
  });

  it("ignores malformed, unknown, and unavailable views", () => {
    expect(parseRegistryView("?view=source", available)).toBeNull();
    expect(parseRegistryView("?view=unknown:weather-kma", available)).toBeNull();
    expect(parseRegistryView("?view=source:not-found", available)).toBeNull();
    expect(parseRegistryView("?view=source:%2Funsafe", available)).toBeNull();
  });
});

describe("registry query", () => {
  it("combines search and filters before sorting", () => {
    const result = deriveRegistryPage(rows, {
      query: "교통",
      filters: { auth: "api-key" },
      sort: { key: "id", direction: "asc" },
      page: 1,
      pageSize: 25,
    });
    expect(result.items.map(({ id }) => id)).toEqual(["beta"]);
    expect(result.totalItems).toBe(1);
  });

  it("sorts Korean labels in either direction", () => {
    expect(deriveRegistryPage(rows, { sort: { key: "searchText", direction: "asc" }, page: 1, pageSize: 25 }).items.map(({ id }) => id)).toEqual(["gamma", "beta", "alpha"]);
    expect(deriveRegistryPage(rows, { sort: { key: "searchText", direction: "desc" }, page: 1, pageSize: 25 }).items.map(({ id }) => id)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("paginates, clamps an invalid page, and reports counts", () => {
    const many = Array.from({ length: 62 }, (_, index) => ({ id: `row-${String(index).padStart(2, "0")}`, searchText: `행 ${index}`, fields: {} }));
    const second = deriveRegistryPage(many, { sort: { key: "id", direction: "asc" }, page: 2, pageSize: 25 });
    expect(second.items).toHaveLength(25);
    expect(second.items[0]?.id).toBe("row-25");
    expect(second.totalPages).toBe(3);
    expect(deriveRegistryPage(many, { page: 99, pageSize: 50 }).page).toBe(2);
  });
});
