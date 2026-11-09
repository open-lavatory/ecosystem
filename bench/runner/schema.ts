import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { descriptorSchema, screenshotSchema } from "./descriptor.ts";

const benchDirectory = join(import.meta.dirname, "..");
const schemas = [
  { path: join(benchDirectory, "apps", "descriptor.schema.json"), schema: descriptorSchema },
  { path: join(benchDirectory, "screenshots", "schema.json"), schema: screenshotSchema },
].map(({ path, schema }) => ({ path, text: `${JSON.stringify(z.toJSONSchema(schema, { io: "input" }), undefined, 2)}\n` }));

export const isSchemaCurrent = () => schemas.every(({ path, text }) => readFileSync(path, "utf8") === text);

if (import.meta.main) for (const { path, text } of schemas) writeFileSync(path, text);
