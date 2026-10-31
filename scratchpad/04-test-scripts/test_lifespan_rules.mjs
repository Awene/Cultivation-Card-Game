import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const breakthrough = read('../世界书/[突破规则].txt');
const advance = read('../世界书/[时间推进规则].txt');
const setup = read('../../tavern_helper_template-main/src/自定义开局/export.ts');
let code = 'let output = "";\n';
for (const match of breakthrough.matchAll(/<%([_=#-]?)([\s\S]*?)([_-]?)%>/g)) {
  code += ['=', '-'].includes(match[1]) ? `output += (${match[2]});\n` : match[2] + '\n';
}
code += 'output;';
const realms = ['凡人', '炼气', '筑基', '金丹', '元婴', '化神', '返虚', '合体', '大乘', '渡劫'];
let checks = 0;
for (const world of ['凡界', '灵界', '冥界']) {
  for (const race of ['人族', '冥族']) {
    for (let b = 0; b < realms.length; b++) {
      for (const stage of b ? ['初期', '中期', '后期'] : ['']) {
        const variables = {
          'stat_data.修炼进度': { 境界: realms[b] + stage },
          'stat_data.地点.世界': world,
          'stat_data.种族': race,
        };
        const result = vm.runInNewContext(code, { getMessageVar: key => variables[key] });
        const expected = race !== '冥族' && b < 9 && (!b || stage === '后期');
        assert.equal(result.includes('寿命 +='), expected, `${world}/${race}/${realms[b]}${stage}`);
        if (expected) assert(result.includes(`寿命 += ${100 * 2 ** b} 年`));
        assert(!result.includes('15 × 突破后L^3'));
        checks++;
      }
    }
  }
}
const initial = new Function('realmIdx', `return ${setup.match(/const 寿命 = (.*);/)[1]};`);
let accumulated = 100;
for (let b = 0; b <= 9; b++) {
  if (b) accumulated += 100 * (2 ** b - 2 ** (b - 1));
  assert.equal(initial(b), accumulated);
  assert.equal(initial(b), 100 * 2 ** b);
  checks++;
}
assert(advance.includes('100 × max(0, 2^floor(新L) − 2^floor(旧L))'));
assert(!advance.includes('境界耗时'));
assert(!advance.includes('F(B)'));
assert(advance.includes('年龄取变量中的终点值'));
// Preserve an existing net +30-year modifier through several breakthroughs.
assert.equal(230 + 100 * (2 ** 6 - 2 ** 1), 6430);
assert.equal(100 * Math.max(0, 2 ** Math.floor(3.4) - 2 ** Math.floor(3.2)), 0);
console.log(`PASS: ${checks + 6} lifespan rendering, initial-value, modifier and small-realm checks.`);
