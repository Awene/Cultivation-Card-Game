// 对实际 EJS 执行行为回归测试，--draft 用于写入前检查。
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import { sources, target } from "./build_spirit_overviews.mjs";
import { emit } from "./overview_star_style.mjs";
import { chatRuntime } from './ejs_chat_runtime.mjs';
let checks = 0;
function ok(v, label) {
  assert(v, label);
  checks++;
}
function compile(src) {
  src = src.replace(
    "  // ========== 装配输出",
    "  globalThis.__data={characters,M,RES,ecoData,sectsData,kingsData,重要秘境};\n  // ========== 装配输出",
  );
  let code = 'let rendered="";\n';
  for (const m of src.matchAll(/<%([_=\-]?)([\s\S]*?)([_\-]?)%>/g))
    code += ["-", "="].includes(m[1])
      ? "rendered += (" + m[2] + ");\n"
      : m[2] + "\n";
  return new vm.Script(code + "\nrendered;");
}
const yaml = readFileSync("本格修仙.yaml", "utf8");
// 可选：仅忽略 Markdown 表格排版空格与分隔线宽度，仍检查全部内容及实际 EJS 行为。
// 默认保持严格逐字检查；不为后续人物落地覆盖用户已整理的表格格式。
const canonicalTableSpacing = text => text.split('\n').map(line => line.startsWith('|')
  ? line.split('|').map(cell => /^\s*-+\s*$/.test(cell) ? '---' : cell.trim()).join('|')
  : line).join('\n');
for (const r of ["星坠大陆", ...Object.keys(sources)]) {
  const src =
    process.argv.includes("--draft") && sources[r]
      ? emit(sources[r])
      : readFileSync(target(r), "utf8").replace(/\r\n/g, "\n");
  if (sources[r] && !process.argv.includes("--draft"))
    ok(process.argv.includes('--ignore-table-spacing')
      ? canonicalTableSpacing(src) === canonicalTableSpacing(emit(sources[r]))
      : src === emit(sources[r]), r + "蓝图与生成结果一致");
  for (const name of [
    "characters",
    "M",
    "RES",
    "ecoData",
    "sectsData",
    "kingsData",
    "mapText",
  ])
    ok(src.includes("const " + name + " ="), r + "结构 " + name);
  const program = compile(src);
  const run = (vars = {}, msgs = [], api = true) => {
    const defaults = {
      "地点.世界": "灵界",
      "地点.地域": r,
      "地点.具体地点": "",
      ...vars,
    };
    const deterministicMath = Object.create(Math);
    deterministicMath.random = () => 0.5;
    const ctx = {
      Math: deterministicMath,
      getMessageVar: (k) => defaults[k.replace("stat_data.", "")],
    };
    if (api)
      ctx.getChatMessages = (...args) => {
        if (msgs instanceof Error) throw msgs;
        return chatRuntime([...Array(20).fill('无关旧消息'),...msgs.map(m=>typeof m==='string'?m:String(m?.message??m?.content??''))]).getChatMessages(...args);
      };
    const output = program.runInNewContext(ctx, { timeout: 3000 });
    return { output, data: ctx.__data };
  };
  const { output: base, data } = run();
  const expected={
    星坠大陆:[42,24,8,6,10],圣银大陆:[42,21,7,6,12],灵境大陆:[32,24,8,7,12],
    万兽大陆:[45,24,8,9,17],沧溟大陆:[63,27,9,9,17],太初大陆:[32,24,8,6,13],
  }[r];
  ok(JSON.stringify([data.characters,data.M,data.ecoData,data.sectsData,data.kingsData].map(x=>Object.keys(x).length))===JSON.stringify(expected),r+' 已确认数量');
  ok(!/下一次天魔入侵.{0,12}(?:\d+|[一二三四五六七八九十百千]+)\s*[年月日]/.test(src),r+' 不写入侵具体时间');
  const civil=Object.values(data.kingsData)[0];
  const key=civil.kws[0];
  ok(run({},[key,...Array(20).fill('无关聊天')]).output.indexOf(civil.detail)<0,r+' 旧关键词不触发');
  ok(run({},[...Array(20).fill('无关聊天'),key]).output.includes(civil.detail),r+' 最新关键词触发');
  for(const world of ['冥界','仙界','',null])ok(run({'地点.世界':world},[key]).output==='',r+' 世界隔离 '+world);
  ok(!src.includes("玄黄大陆"), r + "无玄黄大陆残留");
  if (r === "星坠大陆")
    ok(data.characters["苏浣渠"].realm === "金丹后期", "星坠凡国人物境界修正");
  ok(run({ "地点.世界": "凡界" }, [r]).output === "", r + " hidden");
  const other = run({
    "地点.地域": "其他大陆",
    "地点.具体地点": Object.keys(data.M)[0],
  }).output;
  ok(
    !other.includes("<region_map") && !other.includes("凡国城市"),
    r + " other 隔离",
  );
  ok(!other.includes("      险:"), r + " other 不泄露秘境");
  ok(
    base.includes("<region_map") && base.includes("## " + r + "凡国城市"),
    r + " 本地完整",
  );
  ok(!base.includes("      险:"), r + " 默认不展开秘境");
  ok(!base.includes("undefined") && !base.includes("NaN"), r + " 无空字段");
  for (const [n, s] of Object.entries(data.M)) {
    ok(
      run({ "地点.具体地点": n }).output.includes(s.detail),
      r + " 地点展开 " + n,
    );
    ok(!run({}, [n]).output.includes(s.detail), r + " 聊天不展开 " + n);
    ok((s.detail.match(/\n\s+险:/g) || []).length === 4, r + " 四阶段 " + n);
    ok(
      other.includes(s.brief.split("\n")[0]) === data.重要秘境.has(n),
      r + " 白名单 " + n,
    );
  }
  for (const [n, k] of Object.entries(data.kingsData)) {
    ok(base.includes(k.brief), r + " 凡国城市默认简报 " + n);
    ok(
      run({}, [{ content: n }]).output.includes(k.detail),
      r + " 关键词详情 " + n,
    );
    for (const kw of k.kws)
      ok(
        run({ "地点.具体地点": kw }).output.includes(k.detail),
        r + " 地标人物详情 " + kw,
      );
  }
  for (const [n, s] of Object.entries(data.sectsData))
    if (s.门内) {
      ok(!run({'地点.地域':'其他大陆',身份:[n+'弟子']}).output.includes(s.门内.外门),r+' 跨大陆无门内 '+n);
      for (const [realm, tier] of [
        ["凡人", "外门"],
        ["元婴后期", "外门"],
        ["化神初期", "内门"],
        ["炼虚后期", "管事"],
        ["合体中期", "长老"],
      ]) {
        ok(
          run({ 身份: [n + "弟子"], "修炼进度.境界": realm }).output.includes(
            s.门内[tier],
          ),
          r + " 门内 " + n + " " + tier,
        );
      }
    }
  for (const [n, c] of Object.entries(data.characters))
    if (c.moderate) {
      const shown = run({ 关系列表: { [n]: {} } }, [n]).output;
      ok(
        c.moderate.every((line) => !shown.includes(line)),
        r + " 已出场不重置外貌 " + n,
      );
    }
  ok(run({}, [], false).output === base, r + " 无聊天API");
  ok(run({}, new Error("模拟API不可用")).output.length > 0, r + " API异常回退");
  ok(
    run({ "地点.世界": " 灵界 ", "地点.地域": " " + r + " " }).output.length >
      0,
    r + " trim",
  );
  ok(
    yaml.includes(
      "文件: " +
        target(r)
          .replace(/\//g, "\\")
          .replace(/\.txt$/, ""),
    ),
    r + " 角色卡入口",
  );
  const block = yaml
    .split('名称: "[mvu_plot]地域-灵界-' + r + '"')[1]
    ?.split("\n  - 名称:")[0];
  ok(
    block?.includes("启用: true") && block.includes("类型: 蓝灯"),
    r + " 入口启用",
  );
  console.log(
    r,
    JSON.stringify({
      characters: Object.keys(data.characters).length,
      secrets: Object.keys(data.M).length,
      ecology: Object.keys(data.ecoData).length,
      sects: Object.keys(data.sectsData).length,
      civic: Object.keys(data.kingsData).length,
      localChars: base.length,
      otherChars: other.length,
    }),
  );
}
const sacred = sources["圣银大陆"];
for(const [r,female,total] of [['圣银大陆',35,42],['灵境大陆',28,32],['万兽大陆',36,45],['沧溟大陆',54,63],['太初大陆',28,32]]){
  const chars=Object.values(sources[r].characters);
  ok(chars.length===total&&chars.filter(c=>c.gender==='女').length===female,r+' 性别与人数');
  if(r==='沧溟大陆'){
    ok(chars.filter(c=>c.race==='人族').length===1,'沧溟仅一位已确认外来人族');
    ok(Object.entries(sources[r].characters).find(([,c])=>c.race==='人族')[0]==='苏知帆','外来人族姓名');
  }
}
ok(Object.keys(sacred.characters).length === 42, "圣银42人");
ok(
  Object.values(sacred.characters).filter((c) => c.gender === "女").length ===
    35,
  "圣银35名女性",
);
ok(
  Object.values(sacred.characters).filter((c) => c.gender === "男").length ===
    7,
  "圣银7名男性",
);
ok(
  Object.values(sacred.characters).every((c) => c.age),
  "圣银全员保留实际年龄",
);
ok(
  sacred.secrets
    .filter((s) => s.important)
    .map((s) => s.name)
    .join("、") === "柱根回廊、无主誓庭",
  "圣银重要秘境",
);
for (const [type, n] of [
  ["御姐", 13],
  ["少女", 11],
  ["萝莉", 11],
])
  ok(
    Object.values(sacred.characters).filter((c) => c.appearanceType === type)
      .length === n,
    type,
  );
for (const [r, d] of Object.entries(sources))
  for (const k of d.countries)
    for (const n of k.roster)
      ok(
        /凡人|炼气|筑基|金丹/.test(d.characters[n].realm),
        r + "世俗境界 " + n,
      );
ok(!yaml.includes("玄黄大陆"), "角色卡无玄黄");
ok(!existsSync(target("玄黄大陆")), "玄黄条目已删除");
console.log("通过 " + checks + " 项检查。");
