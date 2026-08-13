import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../脚本/【本格修仙】MVU核验.js', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

let variables = {
  stat_data: {
    时间: { 年: 7020 },
    寿元: { 生日: null, 年龄: 16, 寿命: 80, 外观年龄: 16 },
    修炼进度: { 境界: '筑基中期' },
    体质: { 根骨: 10, 气感: 20, 元阴: null, 元阳: true },
    资源池: { 气血: { 现值: 50, 上限: 100 }, 灵气: { 现值: 25, 上限: 50 } },
    关系列表: {
      甲: {
        类型: '人物',
        在场: false,
        寿元: { 生日: 6990, 年龄: 20 },
        修炼进度: { 境界: '炼气后期' },
        体质: { 根骨: 0, 气感: 0, 元阴: null, 元阳: true },
        资源池: { 气血: { 现值: 50, 上限: 100 }, 灵气: { 现值: 80, 上限: 100 } },
      },
      灵兽甲: {
        类型: '灵兽',
        寿元: { 年龄: 999 },
        修炼进度: { 境界: '筑基中期' },
        体质: { 根骨: 99, 气感: 99 },
        资源池: { 气血: { 现值: 7, 上限: 9 }, 灵气: { 现值: 7, 上限: 9 } },
      },
      凡人甲: {
        类型: '人物',
        在场: false,
        寿元: { 年龄: 10 },
        修炼进度: { 境界: '凡人' },
        体质: { 根骨: 10, 气感: 20 },
        资源池: { 气血: { 现值: 20, 上限: 20 }, 灵气: { 现值: 5, 上限: 10 } },
      },
      冥族甲: {
        类型: '人物',
        种族: '冥族',
        在场: false,
        寿元: { 年龄: 77 },
        修炼进度: { 境界: '炼气初期' },
        体质: { 根骨: 10, 气感: 10 },
        资源池: { 气血: { 现值: 10, 上限: 10 }, 灵气: { 现值: 5, 上限: 10 } },
      },
    },
  },
};

const timers = [];
const events = new Map();
let writes = 0;
const lodash = {
  get(object, path) {
    return String(path).split('.').reduce((value, key) => value?.[key], object);
  },
  isEmpty(value) {
    return value == null || (typeof value === 'object' && Object.keys(value).length === 0);
  },
  cloneDeep(value) {
    return structuredClone(value);
  },
};

const context = {
  console,
  Math,
  Number,
  Object,
  Array,
  String,
  structuredClone,
  _: lodash,
  tavern_events: { MESSAGE_RECEIVED: 'message_received', CHAT_CHANGED: 'chat_changed' },
  eventOn(name, callback) {
    events.set(name, callback);
  },
  getVariables() {
    return variables;
  },
  async updateVariablesWith(callback) {
    writes += 1;
    variables = callback(variables);
  },
  setTimeout(callback) {
    timers.push(callback);
    return timers.length;
  },
  clearTimeout() {},
};

vm.runInNewContext(source, context, { filename: '【本格修仙】MVU核验.js' });
assert.ok(events.has('mag_variable_update_ended'), '应监听 MVU 更新结束事件');
assert.equal(timers.length, 1, '加载时应安排一次核验');
await timers.shift()();

const stat = variables.stat_data;
assert.deepEqual({ 生日: stat.寿元.生日, 年龄: stat.寿元.年龄 }, { 生日: 7004, 年龄: 16 });
assert.equal(stat.修炼进度.上次突破时间点, null, '主角首次补齐仅建立突破时间基线');
assert.deepEqual(plain(stat.资源池.气血), { 现值: 158, 上限: 316 });
assert.deepEqual(plain(stat.资源池.灵气), { 现值: 238, 上限: 475 });
assert.deepEqual({ 生日: stat.关系列表.甲.寿元.生日, 年龄: stat.关系列表.甲.寿元.年龄 }, { 生日: 6990, 年龄: 30 });
assert.deepEqual(plain(stat.关系列表.甲.资源池.气血), { 现值: 13, 上限: 25 });
assert.deepEqual(plain(stat.关系列表.甲.资源池.灵气), { 现值: 20, 上限: 25 });
assert.deepEqual(plain(stat.关系列表.灵兽甲.寿元), { 年龄: 999 }, '非人物关系不得核验生日');
assert.deepEqual(plain(stat.关系列表.灵兽甲.资源池.气血), { 现值: 7, 上限: 9 }, '非人物关系不得核验资源');
assert.deepEqual(plain(stat.关系列表.凡人甲.资源池.气血), { 现值: 2, 上限: 2 }, '凡人同样严格使用公式');
assert.deepEqual(plain(stat.关系列表.凡人甲.资源池.灵气), { 现值: 2, 上限: 3 }, '凡人灵气应按旧比例换算');
assert.deepEqual(
  plain(stat.关系列表.冥族甲.寿元),
  { 年龄: 77, 冥族停龄: true },
  '冥族人物应冻结年龄并写入本地转换标记',
);
assert.deepEqual(plain(stat.关系列表.冥族甲.资源池.气血), { 现值: 20, 上限: 20 }, '冥族仍应核验资源');
assert.equal(writes, 1);

// 新增 NPC 仅补隐藏字段的空基线，不能把首次出场判作突破。
const beforeNewNpc = structuredClone(variables);
variables.stat_data.关系列表.新人物 = {
  类型: '人物',
  在场: true,
  寿元: { 年龄: 19 },
  修炼进度: { 境界: '炼气初期' },
  体质: { 根骨: 1, 气感: 1 },
  资源池: { 气血: { 现值: 10, 上限: 10 }, 灵气: { 现值: 10, 上限: 10 } },
};
events.get('mag_variable_update_ended')(variables, beforeNewNpc);
await timers.shift()();
assert.equal(variables.stat_data.关系列表.新人物.修炼进度.上次突破时间点, null);

// 既有 NPC 的境界变化只记录同回合的年份。
const beforeBreakthrough = structuredClone(variables);
variables.stat_data.时间 = { 年: 7022, 月: 4, 日: 9, 时辰: '酉时' };
variables.stat_data.关系列表.甲.修炼进度.境界 = '筑基初期';
events.get('mag_variable_update_ended')(variables, beforeBreakthrough);
await timers.shift()();
assert.deepEqual(
  plain(variables.stat_data.关系列表.甲.修炼进度.上次突破时间点),
  7022,
);

// 主角同样记录境界变化年份。
const beforeUserBreakthrough = structuredClone(variables);
variables.stat_data.时间.年 = 7023;
variables.stat_data.修炼进度.境界 = '筑基后期';
events.get('mag_variable_update_ended')(variables, beforeUserBreakthrough);
await timers.shift()();
assert.equal(variables.stat_data.修炼进度.上次突破时间点, 7023);

events.get('mag_variable_update_ended')();
await timers.shift()();
assert.equal(writes, 4, '数据已正确时不得重复写入');

variables.stat_data.时间.年 = 7030;
variables.stat_data.关系列表.冥族甲.种族 = '人族';
events.get('mag_variable_update_ended')();
await timers.shift()();
assert.deepEqual(
  plain(variables.stat_data.关系列表.冥族甲.寿元),
  { 年龄: 77, 生日: 6953 },
  '离开冥族时应以冻结年龄重新锚定生日并清除标记',
);

variables.stat_data.时间.年 = 7031;
events.get('mag_variable_update_ended')();
await timers.shift()();
assert.equal(variables.stat_data.关系列表.冥族甲.寿元.年龄, 78, '恢复非冥族后年龄应从新生日继续增长');

console.log('MVU verifier tests passed.');
