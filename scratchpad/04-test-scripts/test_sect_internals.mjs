import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';
import vm from 'node:vm';
import { groups, backfill } from './sync_sect_internals.mjs';
import { tiers } from './sect_internal_source.mjs';

let checks = 0;
function ok(condition, label) { assert(condition, label); checks++; }
function same(actual, expected, label) { assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)), label); checks++; }
function compile(source) {
  source = source.replace('const sectsData = {', 'const sectsData = globalThis.__sects = {');
  let code = 'let rendered = "";\n';
  for (const m of source.matchAll(/<%([_=\-]?)([\s\S]*?)([_\-]?)%>/g)) {
    code += ['-', '='].includes(m[1]) ? 'rendered += (' + m[2] + ');\n' : m[2] + '\n';
  }
  return new vm.Script(code + '\nrendered;');
}
const realmCases = [
  ['凡人', 0], ['练气初期', 1], ['炼气后期', 1], ['筑基前期', 2], ['金丹中期', 3],
  ['元婴后期', 4], ['化神初期', 5], ['化神后期', 5], ['返虚初期', 6], ['炼虚后期', 6],
  ['合体中期', 7], ['大乘前期', 8], ['渡劫后期', 9],
];
for (const [file, items] of groups) {
  const { world, region } = items[0];
  const source = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  ok(backfill(source, items) === source, region + ' 回填幂等');
  const program = compile(source);
  const run = (vars = {}, chat = [], script = program) => {
    const values = { '地点.世界': world, '地点.地域': region, '地点.具体地点': '', '时间.年': 7203, '修炼进度.境界': '凡人', 身份: [], ...vars };
    const math = Object.create(Math); math.random = () => 0.5;
    const ctx = { Math: math, getMessageVar: key => values[key.replace('stat_data.', '')], getChatMessages: () => chat };
    return { output: script.runInNewContext(ctx, { timeout: 3000 }), data: ctx.__sects };
  };
  const { output: base, data } = run();
  // 对照改动前的受版本控制总览，验证地理、人物、宗门客观档案等内容未被回填改变。
  const previous = execFileSync('git', ['show', 'HEAD:' + relative(process.cwd(), file).replaceAll('\\', '/')], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const baseline = run({}, [], compile(previous));
  ok(base === baseline.output, region + ' 非门人输出保持原样');
  same(Object.keys(data), Object.keys(baseline.data), region + ' 宗门名单不变');
  for (const item of items) {
    const sect = data[item.name];
    same(sect.门内, item.inner, item.id + ' 四档与文档逐字相同');
    same(sect.门内kws, item.kws, item.id + ' 身份关键词');
    for (const key of ['type', 'brief', 'detail']) same(sect[key], baseline.data[item.name][key], item.id + ' 原有 ' + key);
    ok(tiers.every(tier => !/^- (功法书|技艺书|取用|传承方向)[:：]/m.test(sect.门内[tier])), item.id + ' 无删除字段');
    const keyword = item.kws[0];
    const assertTier = (vars, expected, label) => {
      const output = run(vars).output;
      ok(output.includes(sect.门内[expected]), item.id + ' ' + label + ' 命中 ' + expected);
      for (const tier of tiers.filter(t => t !== expected)) {
        // 萝武门部分原有档位正文逐字相同，不能用字符串判断排除这些相同段。
        if (sect.门内[tier] !== sect.门内[expected]) ok(!output.includes(sect.门内[tier]), item.id + ' ' + label + ' 不混入 ' + tier);
      }
    };
    if (!item.identityTiers) {
      for (const [realm, L] of realmCases) {
        const index = world === '灵界' ? L <= 4 ? 0 : L === 5 ? 1 : L === 6 ? 2 : 3 : L <= 1 ? 0 : L === 2 ? 1 : L === 3 ? 2 : 3;
        assertTier({ 身份: [keyword + '弟子'], '修炼进度.境界': realm }, tiers[index], realm);
      }
    } else {
      // 特殊机构按本机构的职务匹配，不借用其他身份中的“长老”等字样。
      for (const [tier, words] of Object.entries(item.identityTiers)) for (const word of words) {
        for (const realm of ['凡人', '金丹后期', '合体后期']) {
          assertTier({ 身份: [keyword + word, '其他宗门长老'], '修炼进度.境界': realm }, tier, word + '/' + realm);
        }
      }
      assertTier({ 身份: [keyword + '见习学员', '其他宗门长老'], '修炼进度.境界': '合体后期' }, '外门', '职务隔离');
    }
    for (const kw of item.kws) assertTier({ 身份: [kw + '外门弟子'] }, '外门', kw);
    for (const vars of [
      { 身份: [], '地点.具体地点': item.name },
      { 身份: [keyword + '弟子'], '地点.地域': '其他地域' },
      { 身份: [keyword + '弟子'], '地点.世界': world === '灵界' ? '凡界' : '灵界' },
    ]) ok(!tiers.some(t => run(vars, [item.name]).output.includes(sect.门内[t])), item.id + ' 身份/地域/世界隔离');
  }
  const regular = items.filter(s => !s.identityTiers).slice(0, 2);
  if (regular.length === 2) {
    const output = run({ 身份: regular.map(s => s.kws[0] + '弟子') }).output;
    ok(regular.every(s => output.includes(s.inner.外门)), region + ' 多重门人身份');
  }
  if (region === '北境') ok(!run({ 身份: ['烬阳城居民'] }).output.includes(data.烬阳城.门内.外门), '居民不是炉坊门人');
  console.log(region + ': ' + items.length + ' 个条目通过');
}
console.log('PASS: ' + checks + ' checks');
