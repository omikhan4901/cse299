// Writes shared/templates.json (template id -> category) for the API, which uses it
// to enforce template plans. Run after adding or moving templates:
//   npm run templates:export
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir = mkdtempSync(path.join(tmpdir(), "resumex-templates-"));
// The registry is plain data but uses extensionless imports; copy it as .mjs to load it in Node.
writeFileSync(path.join(dir, "specs.mjs"), readFileSync(path.join(root, "src/pdf/engine/specs.js")));
writeFileSync(path.join(dir, "registry.mjs"), readFileSync(path.join(root, "src/pdf/registry.js"), "utf8").replace('"./engine/specs"', '"./specs.mjs"'));
const { TEMPLATES } = await import(path.join(dir, "registry.mjs"));
const out = Object.fromEntries(TEMPLATES.map((t) => [t.id, t.category]));
writeFileSync(path.join(root, "..", "shared", "templates.json"), `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote ${TEMPLATES.length} templates to shared/templates.json`);
