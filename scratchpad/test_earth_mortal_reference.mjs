import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {chatRuntime, pluginSourcePath} from './ejs_chat_runtime.mjs';
const require = createRequire(resolve('../tavern_helper_template-main/package.json'));
const YAML = require('yaml');
const read = p => fs.readFileSync(p, 'utf8');
const mod = {exports: {}};
new vm.Script(read(pluginSourcePath.replace('function/chat.ts', '3rdparty/ejs.js')))
  .runInNewContext({module: mod, exports: mod.exports});
const source = read('世界书/地球/[mvu_plot]地球版凡界简述.txt');
const render = (messages = [], world = '地球', location = '') => mod.exports.render(source, {
  getMessageVar: k => ({'stat_data.地点.世界': world, 'stat_data.地点.具体地点': location})[k],
  ...chatRuntime(messages),
});
let checks = 0;
const ok = (v, message) => {assert(v, message); checks++;};
for (const world of ['凡界', '灵界', '冥界', '仙界']) ok(render([], world).trim() === '', world + '隐藏');
const brief = render();
ok((brief.match(/^## /gm) || []).length === 5, '五域简介');
ok((brief.match(/^- /gm) || []).length === 27, '27个宗门或机构简介');
ok(!brief.includes('主要人物:'), '未命中不展开');
ok(render(['问道仙宗']).includes('主要人物: 宗主李道玄'), '宗门关键词');
ok(render(['洛雪铃']).includes('主要人物: 宗主李道玄'), '人物关键词');
ok(!render(['问道仙宗']).includes('主要人物: 宗主卜玄机'), '不展开邻宗');
ok(render(['道盟']).includes('湘灵阁领道盟'), '阵营展开大陆');
ok(!render(['南疆']).includes('主要人物:'), '大陆不展开全部宗门');
ok(render([], '地球', '千机门交流处').includes('主要人物: 门主公输冶'), '具体地点匹配');
ok(!render(['问道仙宗', ...Array(11).fill('无关')]).includes('主要人物:'), '旧关键词退出窗口');
const allNames = [...source.matchAll(/name: '([^']+)'/g)].map(m => m[1]);
const full = render([allNames.join(' ')]);
ok((full.match(/主要人物:/g) || []).length === 27, '全部detail可展开');
const config = YAML.parse(read('本格修仙.yaml'));
const index = config.条目.findIndex(e => e.名称 === '[mvu_plot]地球版凡界简述');
const entry = config.条目[index];
ok(entry.启用 && entry.激活策略.类型 === '蓝灯', '启用蓝灯');
ok(entry.插入位置.顺序 === 53 && config.条目[index - 1].插入位置.顺序 === 52, '紧接地球总览');
ok(entry.递归.不可激活其他条目, '不递归激活凡界条目');
const earth = read('世界书/地球/[mvu_plot]地球总览.txt');
const joined = mod.exports.render(earth + '\n' + source, {
  getMessageVar: k => ({'stat_data.地点.世界':'地球', 'stat_data.时间':{年:7026}})[k],
  ...chatRuntime([]),
});
ok((joined.match(/<region_information region="地球">/g) || []).length === 2 && joined.includes('凡界神陆分'), '合并渲染无变量冲突');
console.log(`${checks} checks passed; brief=${brief.length} chars; full=${full.length} chars.`);
