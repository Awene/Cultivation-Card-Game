import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {chatRuntime} from './ejs_chat_runtime.mjs';

const source = fs.readFileSync('世界书/[角色生成规则].txt', 'utf8');
const code = source.match(/<%_\r?\n([\s\S]*?)_%>/)[1];
const script = new vm.Script(code + '\n({chinese:_chineseNameStrategies,western:_westernNameStrategies,keywords:_keywordNameStrategies,picked:_pickedNameStrategies,text:nameStrategies});');
const run = (world, messages=[]) => script.runInNewContext({getMessageVar: () => world,...chatRuntime(messages)});
let checks = 0;
for (const world of ['地球', '凡界', '灵界', '冥界', '仙界', undefined]) {
  for (let i = 0; i < 100; i++) {
    const result = run(world);
    assert.equal(result.chinese.length, 20);
    assert.equal(result.western.length, 1);
    assert.equal(result.western[0].desc, '音译外文名，符合其文化');
    for (const strategy of result.western) {
      assert.equal(strategy.pool.length, 32);
      assert.equal(new Set(strategy.pool).size, 32);
      assert.deepEqual(Object.keys(strategy), ['name', 'desc', 'pool']);
    }
    const foreign = result.picked.filter(s => result.western.includes(s));
    assert.equal(result.picked.length, 4);
    assert.equal(foreign.length, world === '地球' ? 1 : 0);
    assert.equal(result.picked.filter(s => result.chinese.includes(s)).length, world === '地球' ? 3 : 4);
    assert.equal(new Set(result.picked.map(s => s.name)).size, result.picked.length);
    assert.equal((result.text.match(/• 【/g) || []).length, result.picked.length);
    if (foreign.length) {
      const line = result.text.split('\n').find(l => l.includes('【' + foreign[0].name + '】'));
      assert.equal(line.match(/\(如:(.*?)\)/)[1].split('、').length, 4);
    }
    checks++;
  }
}
const cases = [
  [['伦敦'], '英文姓名'],
  [['曼彻斯特 苏格兰 北爱尔兰'], '英文姓名'],
  [['伦敦 巴黎 巴黎'], '法文姓名'],
  [['拜火教 拜火教 巴黎'], '拜火教传承'],
  [['法国 巴黎 伦敦 曼彻斯特 苏格兰'], '英文姓名'],
  [['伦敦 巴黎'], '英文姓名'], // 同频按配置顺序。
  [['英国 英国', ...Array(10).fill('寻常街景')], undefined],
  [['法国', ...Array(9).fill('寻常街景')], '法文姓名'],
  [['巴黎', ...Array(10).fill('寻常街景'), '拜火教'], '拜火教传承'],
  [[], undefined],
  [['澳大利亚 悉尼'], '英文姓名'],
  [['塞内加尔 达喀尔'], '法文姓名'],
  [['莫斯科 西伯利亚'], '俄文姓名'],
  [['维也纳 苏黎世'], '德文姓名'],
  [['开罗 卡萨布兰卡'], '阿拉伯姓名'],
  [['墨西哥'], '西班牙文姓名'],
  [['赤道几内亚'], '西班牙文姓名'],
  [['法属圭亚那'], '法文姓名'],
  [['阿拉伯语 伦敦 伦敦'], '英文姓名'],
  [['京都 伊势神宫'], '日文姓名'],
  [['拜火坛 赤焰拜日国'], '拜火教传承'],
  [['血莲密教 千骨陉'], '血莲密教法名'],
  [['圣银大陆 十二柱神庭'], undefined],
  [['湘灵阁 九歌殿'], undefined],
  [['非洲'], undefined],
  [['巴西'], undefined],
];
for (const world of ['地球','凡界','灵界','冥界','仙界',undefined]) {
  for (const [messages,expected] of cases) {
    for (let i=0;i<20;i++) {
      const r=run(world,messages);
      const keyword=r.picked.filter(s=>r.keywords.includes(s));
      assert.equal(r.picked.length,4);
      assert.equal(keyword.length,expected?1:0);
      assert.equal(keyword[0]?.name,expected);
      assert.equal(r.picked.filter(s=>r.western.includes(s)).length,world==='地球'?1:0);
      assert.equal(r.picked.filter(s=>r.chinese.includes(s)).length,(world==='地球'?3:4)-(expected?1:0));
      assert.equal(new Set(r.picked.map(s=>s.name)).size,4);
      assert.equal((r.text.match(/• 【/g)||[]).length,4);
      for(const s of r.keywords){
        assert.equal(s.pool.length,32);
        assert.equal(new Set(s.pool).size,32);
        assert(s.desc.length<=6);
        assert(s.kws.every(k=>k.length>0));
      }
      checks++;
    }
  }
}
const configured = run('地球');
assert.equal(configured.keywords.length, 9);
assert(!configured.keywords.some(s => ['圣银柱氏族', '湘灵楚巫'].includes(s.name)));
const german = configured.keywords.find(s => s.name === '德文姓名');
assert(german.pool.some(n => n.includes('·冯·')));
assert(german.pool.some(n => !n.includes('·冯·')));
console.log(`PASS: ${checks} naming draws; four slots, keyword frequency, ties and recent-chat window.`);
