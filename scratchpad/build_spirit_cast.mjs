// 创作素材分批手写；本脚本只做结构装配，输出 apply_patch，不直接写文件。
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { appearance, read, regions, sources } from "./spirit_cast_sources.mjs";
import { renderGroup } from "./spirit_character_template.mjs";
export { renderGroup };
const mode = process.argv[2];
export function parseCSV(s) {
  const rows = [];
  let row = [],
    v = "",
    quoted = false;
  s = s.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      if (quoted && s[i + 1] === '"') {
        v += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(v);
      v = "";
    } else if (c === "\n" && !quoted) {
      row.push(v.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      v = "";
    } else v += c;
  }
  assert(!quoted, "CSV quote");
  if (v || row.length) {
    row.push(v);
    rows.push(row);
  }
  return rows;
}
export const csv = (rows) =>
  rows
    .map((row) =>
      row
        .map((x) => {
          const s = String(x ?? "");
          return /[",\n\r]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
        })
        .join(","),
    )
    .join("\n") + "\n";
export function patch(path, next) {
  if (!existsSync(path))
    return (
      "*** Add File: " +
      path +
      "\n" +
      next
        .trimEnd()
        .split("\n")
        .map((l) => "+" + l)
        .join("\n") +
      "\n"
    );
  const old = read(path);
  if (old.trimEnd() === next.trimEnd()) return "";
  const a = old.trimEnd().split("\n"),
    b = next.trimEnd().split("\n");
  let start = 0,
    end = 0;
  while (start < Math.min(a.length, b.length) && a[start] === b[start]) start++;
  while (
    end < Math.min(a.length, b.length) - start &&
    a[a.length - 1 - end] === b[b.length - 1 - end]
  )
    end++;
  const before = a.slice(Math.max(0, start - 3), start).map((l) => " " + l);
  const after = a
    .slice(a.length - end, Math.min(a.length, a.length - end + 3))
    .map((l) => " " + l);
  return (
    "*** Update File: " +
    path +
    "\n@@\n" +
    [
      ...before,
      ...a.slice(start, a.length - end).map((l) => "-" + l),
      ...b.slice(start, b.length - end).map((l) => "+" + l),
      ...after,
    ].join("\n") +
    "\n"
  );
}
export function cast(region, { partial = false } = {}) {
  const file = "scratchpad/cast-" + region + ".json";
  assert(existsSync(file), "待完成创作素材：" + region);
  const enriched = JSON.parse(read(file));
  const deepFile = "scratchpad/deep-cast-" + region + ".json";
  const deepRows = existsSync(deepFile) ? JSON.parse(read(deepFile)) : [];
  assert.equal(
    new Set(deepRows.map((p) => p.name)).size,
    deepRows.length,
    region + "深写重名",
  );
  const deepMap = new Map(deepRows.map((p) => [p.name, p]));
  for (const p of deepRows)
    assert(
      enriched.some((base) => base.name === p.name),
      region + " 深写姓名不在已确认名册：" + p.name,
    );
  const base = sources[region].runtime.characters;
  if (!partial) {
    assert(
      enriched.length >= Object.keys(base).length,
      region + "覆盖数 " + enriched.length + "/" + Object.keys(base).length,
    );
    for (const name of Object.keys(base))
      assert(
        enriched.some((p) => p.name === name),
        region + "遗漏 " + name,
      );
    if (!process.argv.includes("--draft")) {
      const missing = enriched
        .filter((p) => !deepMap.has(p.name))
        .map((p) => p.name);
      assert.equal(
        missing.length,
        0,
        region +
          " 缺少正式深写：" +
          missing.join("、") +
          "；仅分批预览允许显式使用 --draft",
      );
    }
  }
  assert.equal(
    new Set(enriched.map((p) => p.name)).size,
    enriched.length,
    region + "重名",
  );
  return enriched.map((original) => {
    const deep = deepMap.get(original.name);
    let p = { ...original };
    if (deep) {
      for (const field of [
        "charm",
        "outer",
        "inner",
        "artifact",
        "core",
        "confession",
      ])
        assert(
          typeof deep[field] === "string" && deep[field].trim(),
          p.name + "深写缺少" + field,
        );
      assert(
        deep.traits?.length === 2 &&
          deep.traits.every((t) => t.name && t.scenes?.length === 3) &&
          deep.partner?.length === 4,
        p.name + "深写结构",
      );
      for (const text of [
        ...deep.traits.flatMap((t) => t.scenes),
        deep.confession,
        ...deep.partner,
      ])
        assert(
          typeof text === "string" &&
            (text.match(/[\u3400-\u9fff]/g) || []).length >= 80,
          p.name + "深写段落不足 80 汉字",
        );
      p = {
        ...p,
        ...Object.fromEntries(
          ["charm", "outer", "inner", "artifact"].map((k) => [k, deep[k]]),
        ),
        personality:
          "底色：" +
          deep.core +
          "；性格特征：" +
          deep.traits.map((t) => t.name).join("、"),
      };
    }
    const c = base[p.name] || p.source;
    assert(c, region + "未知人物 " + p.name);
    if (!base[p.name])
      assert(
        read("世界书/灵界/" + region + "/" + region + "蓝图.md").includes(
          p.name,
        ),
        region + "未见蓝图 " + p.name,
      );
    for (const k of [
      "group",
      "appearance",
      "charm",
      "features",
      "outer",
      "inner",
      "personality",
      "artifact",
      "voice",
      "habit",
      "encounter",
      "relationship",
      "hook",
    ])
      assert(typeof p[k] === "string" && p[k].trim(), p.name + "缺少" + k);
    assert(!/[\\/:*?"<>|]/.test(p.group), p.name + "非法分组");
    const gender =
      c.gender ||
      p.gender ||
      (/御姐|少女|萝莉/.test(c.appearanceType) ? "女" : "男");
    const category =
      gender === "女"
        ? appearance({ appearanceType: p.appearanceClass || c.appearanceType })
        : c.appearanceType || p.appearanceClass;
    if (gender === "女")
      assert(
        ["御姐", "少女", "萝莉"].includes(category),
        p.name + "外观分类 " + category,
      );
    const age = c.age || p.age || "未设定具体岁数；成年";
    const path =
      "世界书/灵界/" +
      region +
      "/人物/[mvu_plot]人物-" +
      region +
      "-" +
      p.group +
      ".txt";
    const physical = p.features.includes(p.appearance)
      ? p.features
      : p.appearance.includes(p.features)
        ? p.appearance
        : p.appearance + "；" + p.features;
    return {
      ...p,
      deep,
      features: physical,
      shortOuter: original.outer,
      shortArtifact: original.artifact,
      c,
      region,
      gender,
      category,
      age,
      path,
      keywords: [...new Set([p.name, ...(p.kws || []), ...(p.locationKws || []), ...(p.keywords || []), p.group])],
    };
  });
}
export function groupBy(people) {
  const groups = new Map();
  for (const p of people) {
    if (!groups.has(p.group)) groups.set(p.group, []);
    groups.get(p.group).push(p);
  }
  return groups;
}
const mains = () => regions.flatMap(cast);
function characterRows(people, onlyRegion) {
  const path = "Doc/角色蓝图.csv",
    rows = parseCSV(read(path));
  const extra = [
    "世界",
    "大陆",
    "种族",
    "初始境界",
    "实际年龄",
    "所属分组",
    "身份职责",
    "人物世界书文件",
    "说话方式",
    "生活习惯",
    "初遇情境",
    "关系与交往",
    "可选故事",
    "性格底色",
    "性格特征A",
    "性格A场景",
    "性格特征B",
    "性格B场景",
    "主动表白",
    "道侣相处",
  ];
  const header = [...rows[0], ...extra.filter((k) => !rows[0].includes(k))];
  const old = rows
    .slice(1)
    .filter(
      (r) =>
        !(
          r[header.indexOf("世界")] === "灵界" &&
          regions.includes(r[header.indexOf("大陆")])
        ),
    );
  const out = [header, ...old.map((r) => header.map((_, i) => r[i] ?? ""))];
  for (const p of people) {
    const values = [
      p.name,
      p.gender,
      p.keywords.join("、"),
      "灵界-" + p.region + "-" + p.group,
      p.category,
      p.charm,
      p.features,
      p.outer,
      p.inner,
      p.personality,
      p.artifact,
    ];
    const f = {
      世界: "灵界",
      大陆: p.region,
      种族: p.c.race,
      初始境界: p.c.realm,
      实际年龄: p.age,
      所属分组: p.group,
      身份职责: p.c.title,
      人物世界书文件: p.path,
      说话方式: p.voice,
      生活习惯: p.habit,
      初遇情境: p.encounter,
      关系与交往: p.relationship,
      可选故事: p.hook,
    };
    if (p.deep)
      Object.assign(f, {
        性格底色: p.deep.core,
        性格特征A: p.deep.traits[0].name,
        性格A场景: p.deep.traits[0].scenes
          .map((s, i) => i + 1 + ". " + s)
          .join("\n"),
        性格特征B: p.deep.traits[1].name,
        性格B场景: p.deep.traits[1].scenes
          .map((s, i) => i + 1 + ". " + s)
          .join("\n"),
        主动表白: p.deep.confession,
        道侣相处: p.deep.partner.map((s, i) => i + 1 + ". " + s).join("\n"),
      });
    out.push(header.map((k, i) => (i < 11 ? values[i] : f[k] || "")));
  }
  if (onlyRegion) {
    const targets = new Map(
      out
        .slice(1)
        .filter((row) => row[header.indexOf("大陆")] === onlyRegion)
        .map((row) => [row[0], row]),
    );
    const merged = rows.slice(1).map((row) => {
      if (
        row[header.indexOf("世界")] === "灵界" &&
        row[header.indexOf("大陆")] === onlyRegion &&
        targets.has(row[0])
      ) {
        const next = targets.get(row[0]);
        targets.delete(row[0]);
        return next;
      }
      return header.map((_, i) => row[i] ?? "");
    });
    return patch(path, csv([header, ...merged, ...targets.values()]));
  }
  return patch(path, csv(out));
}
function yamlEntries(people) {
  let entries =
    "  # 灵界人物条目开始（由 scratchpad/build_spirit_cast.mjs 维护）\n";
  for (const r of regions)
    for (const [group, ps] of groupBy(people.filter((p) => p.region === r))) {
      const kws = [...new Set(ps.flatMap((p) => p.keywords))];
      entries +=
        "  - 名称: " +
        JSON.stringify("[mvu_plot]人物-" + r + "-" + group) +
        "\n    启用: true\n    激活策略:\n      类型: 绿灯\n      关键字:\n" +
        kws.map((k) => "        - " + JSON.stringify(k)).join("\n") +
        "\n    插入位置:\n      类型: 角色定义之前\n      顺序: 200\n    激活概率: 100\n    特殊效果:\n      黏性: 5\n    递归:\n      不可被其他条目激活: false\n      不可激活其他条目: true\n    文件: " +
        ps[0].path.replaceAll("/", "\\").replace(/\.txt$/, "") +
        "\n\n";
    }
  entries += "  # 灵界人物条目结束\n\n";
  const path = "本格修仙.yaml",
    old = read(path).replace(
      /  # 灵界人物条目开始[\s\S]*?  # 灵界人物条目结束\n\n/,
      "",
    );
  const marker = "  - 名称: ➤人物信息-end";
  assert(old.includes(marker));
  return patch(path, old.replace(marker, entries + marker));
}
if (mode === "region" || mode === "group") {
  const r = process.argv[3],
    people = cast(r);
  let out = "";
  for (const [g, ps] of groupBy(people))
    if (mode === "region" || g === process.argv[4])
      out += patch(ps[0].path, renderGroup(r, g, ps));
  process.stdout.write("*** Begin Patch\n" + out + "*** End Patch\n");
} else if (mode === "csv-region") {
  const region = process.argv[3];
  assert(regions.includes(region), "unknown region");
  process.stdout.write(
    "*** Begin Patch\n" + characterRows(mains(), region) + "*** End Patch\n",
  );
} else if (["integrate", "csv", "yaml"].includes(mode)) {
  const people = mains();
  process.stdout.write(
    "*** Begin Patch\n" +
      (mode !== "yaml" ? characterRows(people) : "") +
      (mode !== "csv" ? yamlEntries(people) : "") +
      "*** End Patch\n",
  );
} else if (mode === "inspect") {
  for (const r of regions) {
    if (existsSync("scratchpad/cast-" + r + ".json")) {
      const ps = cast(r);
      console.log(r, ps.length, groupBy(ps).size);
    }
  }
}
