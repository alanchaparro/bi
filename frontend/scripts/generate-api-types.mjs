import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const schemaPath = path.resolve(root, "..", "docs", "openapi-v1.json");
const outputPath = path.resolve(root, "src", "shared", "api-types.ts");

if (!existsSync(schemaPath)) {
  console.error(`[generate:types] missing schema: ${schemaPath}`);
  process.exit(1);
}

const openapiTypescriptCli = path.resolve(
  root,
  "node_modules",
  "openapi-typescript",
  "bin",
  "cli.js",
);

if (existsSync(openapiTypescriptCli)) {
  const result = spawnSync(
    process.execPath,
    [openapiTypescriptCli, schemaPath, "-o", outputPath],
    { stdio: "inherit", cwd: root },
  );
  process.exit(result.status ?? 1);
}

if (!existsSync(outputPath)) {
  console.error(
    `[generate:types] missing generated file and openapi-typescript is not installed: ${outputPath}`,
  );
  process.exit(1);
}

console.log(
  "[generate:types] openapi-typescript not installed; keeping committed src/shared/api-types.ts",
);
