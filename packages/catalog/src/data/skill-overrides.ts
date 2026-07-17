import type { SkillOverrides } from "../sync/index.js";

export const skillOverrides: SkillOverrides = {
  "weather-forecast": { sourceIds: ["weather-kma", "data-go-kr"], technologyIds: ["rest-api", "json", "xml"] },
  "air-quality": { sourceIds: ["airkorea", "data-go-kr"], technologyIds: ["rest-api", "json", "xml"] },
  "kakao-local-search": { sourceIds: ["kakao-local-mobility"], technologyIds: ["rest-api", "json", "geospatial"] },
  "kopis-performance-search": { sourceIds: ["culture-kopis"], technologyIds: ["rest-api", "xml"] },
};
