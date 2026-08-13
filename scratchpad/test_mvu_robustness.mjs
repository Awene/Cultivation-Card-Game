import fs from "node:fs";
import assert from "node:assert/strict";
import lodash from "file:///D:/application/Tavern/mod/%E4%B8%96%E7%95%8C%E4%B9%A6/tavern_helper_template-main/node_modules/lodash/lodash.js";
import YAML from "file:///D:/application/Tavern/mod/%E4%B8%96%E7%95%8C%E4%B9%A6/tavern_helper_template-main/node_modules/yaml/dist/index.js";
import { z } from "file:///D:/application/Tavern/mod/%E4%B8%96%E7%95%8C%E4%B9%A6/tavern_helper_template-main/node_modules/zod/index.js";

const sourcePath = new URL("../脚本/变量结构.js", import.meta.url);
const handlers = new Map();
globalThis._ = lodash;
globalThis.YAML = YAML;
globalThis.z = z;
globalThis.eventOn = (name, handler) => handlers.set(name, handler);
globalThis.registerMvuSchema = () => {};
globalThis.$ = (ready) => ready();

let source = fs.readFileSync(sourcePath, "utf8");
source = source.replace(/^import .*?;\r?\n/, "").replace("export const Schema", "const Schema");
source += "\n;globalThis.__mvuTestExports = { Schema };";
new Function(source)();

const { Schema } = globalThis.__mvuTestExports;
const preprocess = handlers.get("mag_command_parsed_for_zod");
assert.equal(typeof preprocess, "function", "应注册 MVU 命令预处理器");

const variables = { stat_data: { 姓名: "测试者", 灵石: 42, 自定义旧字段: { 保留: true } } };
const item = {
  品质: "精品",
  境界: "炼气初期",
  类型: "工具",
  五行: "水",
  标签: "借用:阮卿颜，辅助修行",
  数量: "1",
  效果: "孕育灵液",
  描述: "拳头大小的白玉壶",
};
const asset = {
  类型: "店铺",
  人员规模: "3",
  所在地: { 世界: "凡界", 地域: "中原", 具体地点: "临江坊市", 杜撰字段: "应删除" },
  现状: "正常营业",
  设施: {
    丹房: {
      效果: { 炼制效率: "+10%", 丹药品质: "+1" },
      每月产出: "聚气丹:10",
      上次收取日期: { 年: 7020, 月: 1, 日: 1, 时辰: "午时" },
      杜撰字段: "应删除",
    },
  },
  所属人物: "苏绾，林清雪",
  杜撰字段: "应删除",
};
const commands = [
  {
    type: "insert",
    args: ["物品", "'白玉壶'", JSON.stringify(item)],
    reason: "json_patch",
    full_match: JSON.stringify({ op: "insert", path: "/物品/白玉壶", value: item }),
  },
  {
    type: "insert",
    args: ["固定资产", "'百草阁'", JSON.stringify(asset)],
    reason: "json_patch",
    full_match: JSON.stringify({ op: "insert", path: "/固定资产/百草阁", value: asset }),
  },
  {
    type: "insert",
    args: ["物品.丹药.A/B", "'错误边界'", JSON.stringify(item)],
    reason: "json_patch",
    full_match: JSON.stringify({ op: "insert", path: "/物品/丹药.A~1B", value: item }),
  },
  {
    type: "set",
    args: ["物品.丹药.A/B.数量", "2"],
    reason: "json_patch",
    full_match: JSON.stringify({ op: "replace", path: "/物品/丹药.A~1B/数量", value: 2 }),
  },
  {
    type: "delete",
    args: ["物品.从未存在"],
    reason: "json_patch",
    full_match: JSON.stringify({ op: "remove", path: "/物品/从未存在" }),
  },
  {
    type: "insert",
    args: ["AI杜撰字段", "'坏数据'", "1"],
    reason: "json_patch",
    full_match: JSON.stringify({ op: "insert", path: "/AI杜撰字段/坏数据", value: 1 }),
  },
];

preprocess(variables, commands);

assert.deepEqual(variables.stat_data.物品, {}, "缺失的物品父容器应恢复");
assert.deepEqual(variables.stat_data.事件, { 开启: false, 标题: "", 阶段: "", 已完成事件: [] });
assert.equal(variables.stat_data.灵石, 42, "已有玩家数值不得被默认值覆盖");
assert.deepEqual(variables.stat_data.自定义旧字段, { 保留: true }, "旧版扩展字段不得被删除");
assert.equal(commands.length, 4, "未知顶级字段与不存在的删除应被忽略");
assert.equal(commands[0].args[0], "物品");
assert.equal(JSON.parse(commands[0].args[1]), "白玉壶");
assert.equal(commands[1].args[0], "固定资产");
assert.equal(JSON.parse(commands[1].args[1]), "百草阁");
assert.equal(commands[2].args[0], "物品");
assert.equal(JSON.parse(commands[2].args[1]), "丹药.A/B", "JSON Pointer 特殊字符应保持在同一个动态 key 中");
assert.equal(commands[3].args[0], '物品["丹药.A/B"].数量', "特殊 key 的后续字段路径不得被二次拆分");

const simulated = lodash.cloneDeep(variables.stat_data);
for (const command of commands) {
  if (command.type === "insert") {
    lodash.set(
      simulated,
      [...lodash.toPath(command.args[0]), String(JSON.parse(command.args[1]))],
      command.args.at(-1),
    );
  } else {
    lodash.set(simulated, command.args[0], command.args.at(-1));
  }
}
const parsed = Schema.safeParse(simulated);
assert.equal(parsed.success, true, parsed.success ? "" : z.prettifyError(parsed.error));
assert.equal(parsed.data.物品.白玉壶.品质, "黄", "品质俗称应映射至合法品阶");
assert.deepEqual(parsed.data.物品.白玉壶.标签, ["借用:阮卿颜", "辅助修行"]);
assert.deepEqual(parsed.data.物品.白玉壶.效果, { 说明: "孕育灵液" });
assert.equal(parsed.data.物品["丹药.A/B"].数量, 2);
assert.deepEqual(parsed.data.固定资产.百草阁.所属人物, ["苏绾", "林清雪"]);
assert.equal(parsed.data.固定资产.百草阁.人员规模, 3);
assert.deepEqual(parsed.data.固定资产.百草阁.所在地, {
  世界: "凡界",
  地域: "中原",
  具体地点: "临江坊市",
});
assert.deepEqual(parsed.data.固定资产.百草阁.设施.丹房, {
  效果: { 炼制效率: "+10%", 丹药品质: "+1" },
  每月产出: "聚气丹:10",
  上次收取日期: { 年: 7020, 月: 1, 日: 1, 时辰: "午时" },
});

const dirtyEvent = Schema.safeParse({
  ...parsed.data,
  身份: "散修，炼丹师",
  事件: { 开启: "是", 标题: "试炼", 阶段: "一", 已完成事件: "前尘、入门" },
});
assert.equal(dirtyEvent.success, true, dirtyEvent.success ? "" : z.prettifyError(dirtyEvent.error));
assert.deepEqual(dirtyEvent.data.身份, ["散修", "炼丹师"]);
assert.equal(dirtyEvent.data.事件.开启, true);
assert.deepEqual(dirtyEvent.data.事件.已完成事件, ["前尘", "入门"]);

console.log("MVU robustness tests passed");
