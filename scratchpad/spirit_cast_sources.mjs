import { readFileSync } from "node:fs";
import vm from "node:vm";
import { sources as normalized, target } from "./build_spirit_overviews.mjs";

export const regions = [
  "星坠大陆",
  "圣银大陆",
  "灵境大陆",
  "万兽大陆",
  "沧溟大陆",
  "太初大陆",
];
export const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
export function snapshot(region) {
  const source = read(target(region));
  const instrumented = source.replace(
    "  // ========== 装配输出",
    "  globalThis.__data={characters,M,ecoData,sectsData,kingsData,重要秘境};\n  // ========== 装配输出",
  );
  let code = "";
  for (const m of instrumented.matchAll(/<%([_=\-]?)([\s\S]*?)([_\-]?)%>/g))
    if (!["-", "="].includes(m[1])) code += m[2] + "\n";
  const ctx = {
    getMessageVar: (k) =>
      ({ "stat_data.地点.世界": "灵界", "stat_data.地点.地域": region })[k],
    getChatMessages: () => [],
  };
  new vm.Script(code).runInNewContext(ctx, { timeout: 3000 });
  if (!ctx.__data) throw Error("Cannot capture " + region);
  return {
    region,
    source,
    runtime: ctx.__data,
    normalized: normalized[region],
  };
}
export const sources = Object.fromEntries(regions.map((r) => [r, snapshot(r)]));
export function appearance(c) {
  const s = c.appearanceType || "";
  if (["御姐", "少女", "萝莉"].includes(s)) return s;
  if (/御姐|成熟女性|年长女性/.test(s)) return "御姐";
  if (/萝莉|幼|年轻外观/.test(s)) return "萝莉";
  if (/少女/.test(s)) return "少女";
  return s;
}
if (
  process.argv[1]?.endsWith("spirit_cast_sources.mjs") &&
  process.argv.includes("--inspect")
)
  for (const [r, s] of Object.entries(sources)) {
    console.log(
      r,
      JSON.stringify(
        {
          people: Object.keys(s.runtime.characters).length,
          sects: Object.keys(s.runtime.sectsData),
          countries: s.normalized?.countries.map((x) => x.name),
          sample: Object.entries(s.runtime.characters).slice(0, 2),
        },
        null,
        2,
      ),
    );
  }
