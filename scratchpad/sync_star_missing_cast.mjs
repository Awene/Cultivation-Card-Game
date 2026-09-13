// 仅补齐已在蓝图正式具名、但旧总览遗漏的人物；不改其余总览正文。
import assert from "node:assert/strict";
import { patch } from "./build_spirit_cast.mjs";
import { read, sources } from "./spirit_cast_sources.mjs";
const r = "星坠大陆",
  source = sources[r].source;
const blueprint = read("世界书/灵界/" + r + "/" + r + "蓝图.md");
const blocks = [
  ...blueprint.matchAll(
    /^#{4,5} (.+?)（([^）]+)）\n([\s\S]*?)(?=^#{1,5} |$(?![\s\S]))/gm,
  ),
];
const map = {
  沈星晷: "天陨环域",
  钟小铛: "天陨环域",
  田穗穗: "九河平原",
  卓守拙: "青岚山域",
  唐榫: "万机原",
  姬逐风: "长风牧野",
  阿牧: "长风牧野",
  安澜: "南溟海门",
};
const chars = { ...sources[r].runtime.characters };
for (const name of Object.keys(map)) {
  if (chars[name]) continue;
  const b = blocks.find((b) => b[1] === name);
  assert(b, name);
  const f = Object.fromEntries(
    b[3]
      .split("\n")
      .filter((l) => l.startsWith("- "))
      .map((l) => {
        const i = l.indexOf("：");
        return [l.slice(2, i), l.slice(i + 1)];
      }),
  );
  const id = f["种族／境界"].split("，");
  const category =
    b[2] === "御姐"
      ? "御姐"
      : b[2] === "少女"
        ? "少女"
        : b[2] === "少年"
          ? "成年青年"
          : b[2];
  chars[name] = {
    title: f["身份"],
    realm: id[1].split(/[。；]/)[0],
    race: id[0],
    appearanceType: category,
    gender: /御姐|少女/.test(category) ? "女" : "男",
    profile: f,
  };
}
const begin = source.indexOf("  const characters = "),
  end = source.indexOf("\n  // ========== 秘境 brief / detail", begin);
assert(begin >= 0 && end > begin);
let next =
  source.slice(0, begin) +
  "  const characters = " +
  JSON.stringify(chars, null, 2) +
  ";\n" +
  source.slice(end);
for (const region of [...new Set(Object.values(map))]) {
  const names = Object.entries(map)
    .filter(([, v]) => v === region)
    .map(([n]) => n);
  const marker =
    "- 资源: 动物 ${pick3(RES[" + JSON.stringify(region) + "].动物)}";
  assert(next.includes(marker), region);
  const addition =
    "- 蓝图补录人物:\n${roster(" + JSON.stringify(names) + ")}\n";
  if (!next.includes(addition)) next = next.replace(marker, addition + marker);
}
process.stdout.write(
  "*** Begin Patch\n" +
    patch("世界书/灵界/" + r + "/[mvu_plot]" + r + "总览.txt", next) +
    "*** End Patch\n",
);
