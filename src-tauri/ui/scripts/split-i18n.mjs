import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "..", "src", "i18n.ts");
const s = fs.readFileSync(src, "utf8");
const lines = s.split(/\r?\n/);
const zh = lines.slice(185, 363).join("\n");
const en = lines.slice(366, 545).join("\n");
const zhHead = `import type { I18nKey } from "./keys";

type Dict = Record<I18nKey, string>;

export const zhCN: Dict = {
${zh}
};
`;
const enHead = `import type { I18nKey } from "./keys";

type Dict = Record<I18nKey, string>;

export const enUS: Dict = {
${en}
};
`;
const outDir = path.join(__dirname, "..", "src", "i18n");
fs.writeFileSync(path.join(outDir, "zhCN.ts"), zhHead);
fs.writeFileSync(path.join(outDir, "enUS.ts"), enHead);
