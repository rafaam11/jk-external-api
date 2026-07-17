import generatedSkills from "./generated/skills.json" with { type: "json" };
import { blueprints } from "./data/blueprints.js";
import { sources } from "./data/sources.js";
import { technologies } from "./data/technologies.js";
import { catalogSchema, type Catalog } from "./schema.js";

const skills = generatedSkills.map((skill) => ({ ...skill }));
const linkedSources = sources.map((source) => ({
  ...source,
  skillIds: skills.filter(({ sourceIds }) => sourceIds.includes(source.id)).map(({ id }) => id),
}));

export const catalog: Catalog = catalogSchema.parse({ sources: linkedSources, skills, blueprints, technologies });
