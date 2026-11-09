import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { descriptorSchema } from "./descriptor.ts";

const schemaPath = join(import.meta.dirname, "..", "apps", "descriptor.schema.json");

const schemaText = `${JSON.stringify(z.toJSONSchema(descriptorSchema, { io: "input" }), undefined, 2)}\n`;

export const isSchemaCurrent = () => readFileSync(schemaPath, "utf8") === schemaText;

if (import.meta.main) writeFileSync(schemaPath, schemaText);
