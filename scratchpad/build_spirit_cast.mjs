// 创作素材分批手写；本脚本只做结构装配，输出 apply_patch，不直接写文件。
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { appearance, read, regions, sources } from "./spirit_cast_sources.mjs";
const mode = process.argv[2];
const j = (x) => JSON.stringify(x, null, 2);
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
const fields = (f) =>
  Object.entries(f || {})
    .map(([k, v]) => "- " + k + "：" + v)
    .join("\n");
const strip = (s) =>
  String(s || "")
    .replace(/\s+/g, " ")
    .trim();
const first = (f, keys) => keys.map((k) => f?.[k]).find(Boolean) || "";
const tpl = (s) =>
  "`" +
  s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") +
  "`";
const readableCast = (C) =>
  "{\n" +
  Object.entries(C)
    .map(
      ([name, c]) =>
        "  " +
        JSON.stringify(name) +
        ": {\n" +
        Object.entries(c)
          .map(
            ([k, v]) =>
              "    " +
              JSON.stringify(k) +
              ": " +
              (typeof v === "string" && v.includes("\n")
                ? tpl(v)
                : JSON.stringify(v)),
          )
          .join(",\n") +
        "\n  }",
    )
    .join(",\n\n") +
  "\n}";
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
        deep.core,
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
      c,
      region,
      gender,
      category,
      age,
      path,
      keywords: [...new Set([p.name, ...(p.keywords || []), p.group])],
    };
  });
}
export function renderGroup(region, group, people) {
  const C = Object.fromEntries(
    people.map((p) => {
      const brief =
        "- " +
        p.name +
        "（" +
        p.gender +
        "；" +
        p.c.realm +
        "；" +
        p.category +
        "；" +
        p.c.race +
        "）：" +
        p.c.title;
      const initial = [
        "- 初始身份：" + p.c.title,
        "- 初始境界：" + p.c.realm,
        "- 种族：" + p.c.race,
        "- 性别与外观分类：" + p.gender + "；" + p.category,
        "- 实际年龄：" + p.age,
        "- 形貌：" + p.features,
        ...(p.deep
          ? []
          : [
              "- 气质与魅力：" + p.charm,
              "- 外衣：" + p.outer,
              "- 内搭：" + p.inner,
              "- 常用法宝／工具类型：" + p.artifact,
            ]),
      ].join("\n");
      const numerals = ["①", "②", "③", "④"];
      const traitBody = p.deep
        ? p.deep.traits
            .map(
              (t) =>
                "[" +
                t.name +
                "]\n" +
                t.scenes.map((s, i) => numerals[i] + " " + s).join("\n"),
            )
            .join("\n\n")
        : "";
      const deepDetail = p.deep
        ? [
            "### " + p.name + " (" + p.category + ")",
            "角色魅力: " + p.deep.charm,
            "着装(外): " + p.deep.outer,
            "着装(内): " + p.deep.inner,
            "法宝: " + p.deep.artifact,
            "底色: " + p.deep.core,
            "",
            traitBody,
          ].join("\n")
        : "";
      const detail = p.deep
        ? deepDetail
        : [
            "### " + p.name,
            "- 性格层次：" + p.personality,
            "- 说话方式：" + p.voice,
            "- 生活习惯：" + p.habit,
            "- 初遇建议：" + p.encounter,
            "- 初始关系与交往：" + p.relationship,
            "- 可选故事：" + p.hook,
          ].join("\n");
      // 正式蓝图事实完整保留，新增写作建议独立标记，不预置已经发生的剧情。
      const sourceProfile = fields(p.c.profile);
      return [
        p.name,
        {
          kws: [p.name],
          brief,
          knownBrief:
            "- " +
            p.name +
            "：既有人物，当前身份、境界、形貌与关系依关系列表及实际剧情。",
          initial,
          sourceProfile,
          detail,
          ...(p.deep
            ? {
                表白: "[表白]\n" + p.deep.confession,
                道侣:
                  "[道侣相处]\n" +
                  p.deep.partner
                    .map((s, i) => numerals[i] + " " + s)
                    .join("\n"),
              }
            : {}),
        },
      ];
    }),
  );
  const groupKws = [
    ...new Set([
      group,
      ...people
        .flatMap((p) => p.keywords)
        .filter((k) => !people.some((p) => p.name === k)),
    ]),
  ];
  return `<%_ { _%>
<%_
// ${region} / ${group}；人物蓝图为初始参考，不回写或重置 MVU。
const C = ${readableCast(C)};
const groupKws = ${j(groupKws)};
const readVar = k => { try { return typeof getMessageVar === 'function' ? getMessageVar(k) : undefined; } catch(e) { return undefined; } };
const world = String(readVar('stat_data.地点.世界') || '');
const relations = readVar('stat_data.关系列表') || {};
const appeared = name => Object.prototype.hasOwnProperty.call(relations, name);
const textOf = m => typeof m === 'string' ? m : m && typeof m === 'object' ? String(m.message ?? m.content ?? '') : '';
const asArray = x => Array.isArray(x) ? x : x ? [x] : [];
let recentText = '';
try {
  if (typeof getChatMessages === 'function') {
    // 本机 EJS 插件的负数表示从末尾取消息，返回字符串数组。
    recentText = asArray(getChatMessages(-10)).map(textOf).join('\\n');
  }
} catch(e) {}
const scanText = String(readVar('stat_data.地点.具体地点') || '')+'\\n'+recentText;
const mentioned = kws => kws.some(k => k && scanText.includes(k));
const hit = Object.entries(C).filter(([n,c]) => mentioned(c.kws));
const groupHit = mentioned(groupKws);
const briefOf = ([n,c]) => appeared(n) ? c.knownBrief : c.brief;
const detailOf = ([n,c]) => {
  // 同一份正文只保存一次；既有人物运行时剔除初始外貌、衣着和装备字段。
  const knownDetail = c.detail.split('\\n').filter(line => !/^角色魅力:|^着装\\(|^法宝:/.test(line))
    .map(line => line.startsWith('### ') ? '### '+n : line).join('\\n');
  let text = appeared(n)
    ? knownDetail+'\\n- 连续性：此人已经出场；上文情境来自初始人设阶段，仅作人格参考。当前境界、年龄、身份、性格、外貌、衣着、装备和关系以变量及已有剧情为准，不恢复旧状态；不可把情境中的旧职务或修为重新当作当前值。'
    : c.detail+'\\n'+c.initial+(c.sourceProfile?'\\n[已确定蓝图档案]\\n'+c.sourceProfile:'');
  if (appeared(n)) {
    const rel=relations[n];
    const partner=rel && typeof rel==='object' && (rel.道侣===true || rel.关系==='道侣' || rel.关系类型==='道侣');
    const affection=Number(typeof rel==='number'?rel:rel?.好感度 || 0);
    if (partner && c.道侣) text += '\\n\\n'+c.道侣+'\\n关系片段仅供既有自愿成年伴侣演绎；不是必须发生的行为。';
    else if (affection>80 && c.表白) text += '\\n\\n'+c.表白+'\\n这是可能的主动表达方式，不是好感达到阈值便自动执行的事件；尊重拒绝与既有关系。';
  }
  return text;
};
let outputText = '';
if (world === '灵界') {
  if (hit.length) {
    outputText = hit.map(detailOf).join('\\n\\n');
    const others = Object.entries(C).filter(([n]) => !hit.some(([h]) => h===n));
    if (groupHit && others.length) outputText += '\\n\\n[同组其他人物]\\n'+others.map(briefOf).join('\\n');
  } else if (groupHit) outputText = '[${group}人物名册]\\n'+Object.entries(C).map(briefOf).join('\\n');
  if (outputText) outputText = '<spirit_characters region="${region}" group="${group}">\\n'
    +'写作边界：初遇与故事均为可选方案，不是已发生事件\\n'
    +outputText+'\\n</spirit_characters>';
}
_%>
<%- outputText %>
<%_ } _%>
`;
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
if (mode === "region") {
  const r = process.argv[3],
    people = cast(r);
  let out = "";
  for (const [g, ps] of groupBy(people))
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
