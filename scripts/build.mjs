import { build } from "@ncpa0cpl/nodepack";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const p = (...filepaths) => path.resolve(__dirname, "..", ...filepaths);

async function main() {
  await build({
    srcDir: p("src"),
    entrypoint: "index.ts",
    outDir: p("dist"),
    tsConfig: p("tsconfig.json"),
    target: "ES2022",
    formats: ["cjs", "esm", "legacy"],
    declarations: true,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
