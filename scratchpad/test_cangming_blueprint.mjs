import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = "世界书/灵界/沧溟大陆/沧溟大陆蓝图.md";
const text = readFileSync(file, "utf8");
const section = (start, end) => text.split(start)[1]?.split(end)[0] ?? "";
const peopleText = section("## 九、人物名册", "## 十、人物关系骨架");
const relationText = section("## 十、人物关系骨架", "## 十一、秘境设计");
const secretText = section("## 十一、秘境设计", "## 十二、第三步交付");
const entries = (source) =>
  [
    ...source.matchAll(
      /^#### (.+)\r?\n([\s\S]*?)(?=^### |^#### |$(?![\s\S]))/gm,
    ),
  ].map((m) => ({ name: m[1].trim(), body: m[2] }));
const people = entries(peopleText);
const secrets = entries(secretText);
assert.equal(people.length, 63);
assert.equal(secrets.length, 27);
assert.equal(new Set(people.map((p) => p.name)).size, 63);
assert.equal(new Set(secrets.map((p) => p.name)).size, 27);
const field = (body, label) =>
  body.match(new RegExp(label + "：([^；。\\r\\n]+)"))?.[1];
const women = people.filter((p) => field(p.body, "性别") === "女");
assert.equal(women.length, 54);
assert.equal(people.filter((p) => field(p.body, "性别") === "男").length, 9);
for (const type of ["御姐", "少女", "萝莉"]) {
  assert.equal(
    women.filter((p) => field(p.body, "外观分类") === type).length,
    18,
  );
}
for (const p of people) {
  for (const key of [
    "性别",
    "外观分类",
    "实际年龄",
    "种族",
    "境界",
    "体系",
    "身份",
    "所属",
    "外貌与着装",
    "性格",
    "职责",
    "生活侧面",
    "矛盾与剧情用途",
  ]) {
    assert(field(p.body, key), `${p.name}缺少${key}`);
  }
  assert(relationText.includes(p.name), `${p.name}未进入关系骨架`);
  const age = field(p.body, "实际年龄");
  assert(Number(age.match(/\d+/)?.[0]) >= 18, `${p.name}年龄不满足成年人约束`);
}
const officials = people.filter((p) => field(p.body, "体系") === "世俗");
assert.equal(officials.length, 9);
assert(officials.every((p) => /^(炼气|筑基|金丹)/.test(field(p.body, "境界"))));
const sectPeople = people.filter((p) => field(p.body, "体系") === "宗门");
assert.equal(sectPeople.length, 27);
for (const realm of ["化神", "返虚", "合体"]) {
  assert.equal(
    sectPeople.filter((p) => field(p.body, "境界").startsWith(realm)).length,
    9,
  );
}
const human = people.filter((p) => field(p.body, "种族") === "人族");
assert.equal(human.length, 1);
assert.equal(human[0].name, "苏知帆");
assert.equal(field(human[0].body, "体系"), "外来");
assert(human[0].body.includes("来自灵境大陆"));
let stages = 0;
const names = new Set(people.map((p) => p.name));
for (const s of secrets) {
  for (const label of [
    "推荐境界",
    "位置与入口",
    "开放条件",
    "关联人物",
    "结构",
  ])
    assert(field(s.body, label), `${s.name}缺少${label}`);
  const lines = [...s.body.matchAll(/^- 阶段([1-4])：(.+)$/gm)];
  assert.deepEqual(
    lines.map((m) => m[1]),
    ["1", "2", "3", "4"],
    s.name,
  );
  for (const [, , body] of lines)
    for (const label of ["场景", "危险", "解法", "收获"])
      assert(body.includes(label + "【"), `${s.name}阶段缺少${label}`);
  for (const name of field(s.body, "关联人物").split("、"))
    assert(names.has(name), `${s.name}引用不存在人物${name}`);
  stages += lines.length;
}
assert.equal(stages, 108);
assert.equal(
  secrets.filter(
    (s) => field(s.body, "推荐境界") && s.body.includes("重要秘境"),
  ).length,
  2,
);
assert.equal((text.match(/区域灵感：/g) ?? []).length, 9);
assert.equal((text.match(/^[1-6]\. /gm) ?? []).length, 54);
assert(!text.includes("鲛人"));
console.log(
  JSON.stringify(
    {
      people: people.length,
      women: women.length,
      men: 9,
      femaleCategories: [18, 18, 18],
      sectPeople: sectPeople.length,
      officials: officials.length,
      secrets: secrets.length,
      stages,
      status: "PASS",
    },
    null,
    2,
  ),
);
