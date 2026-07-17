import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { skillOverrides } from "../data/skill-overrides.js";
import { syncSkills } from "./index.js";

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, "../generated/skills.json");
const temporary = `${output}.tmp`;
const skills = await syncSkills({ overrides: skillOverrides });
await mkdir(dirname(output), { recursive: true });
await writeFile(temporary, `${JSON.stringify(skills, null, 2)}\n`, "utf8");
await rename(temporary, output);
console.log(`Synchronized ${skills.length} k-skill entries to ${output}`);
