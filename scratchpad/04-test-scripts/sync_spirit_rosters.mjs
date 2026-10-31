// 只更新实际总览的人物字典与名册渲染，不重新生成地理、宗门、秘境正文。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rosterDictionary, rosterRenderer} from './spirit_roster_template.mjs';

const region = process.argv[2];
assert(['星坠大陆','圣银大陆','灵境大陆','万兽大陆','沧溟大陆','太初大陆','殒落大陆'].includes(region));
const path = `世界书/灵界/${region}/[mvu_plot]${region}总览.txt`;
const old = readFileSync(path,'utf8').replace(/\r\n/g,'\n');
let next = old;
if (region === '殒落大陆') {
  const marker = "if (world === '灵界' && regionNames.includes(region)) {\n";
  const start = next.indexOf(marker) + marker.length;
  const end = next.indexOf('  // brief仅含远观可见信息');
  assert(start > marker.length && end >= start);
  next = next.slice(0,start) +
    "  const appearedCharacters = getMessageVar('stat_data.关系列表') || {};\n" +
    "  const hasCharacterAppeared = name => Object.prototype.hasOwnProperty.call(appearedCharacters, name);\n" +
    rosterRenderer + '\n' + rosterDictionary(region) + '\n\n' + next.slice(end);
  for (const name of ['朔灯','绛苇']) {
    const line = new RegExp('【可能人物】' + name + '[^\\n]*');
    if (line.test(next)) next = next.replace(line, '【可能人物】\n${renderRosterCharacter(\'' + name + '\')}');
  }
  next = next.replace(/^- 朔灯、绛苇的境界、年龄与描述是初始设定；[^\n]*\n/m, '');
} else {
  const dict = /  const characters = \{[\s\S]*?\n\s*\};/;
  const render = /  const renderRosterCharacter = \(name, indent = 2\) => \{[\s\S]*?\n  \};/;
  assert(dict.test(next) && render.test(next), region + '人物块');
  next = next.replace(dict, () => rosterDictionary(region)).replace(render, () => rosterRenderer);
}
if (old.trimEnd() === next.trimEnd()) {
  process.stdout.write('*** Begin Patch\n*** End Patch\n');
} else {
  const a=old.trimEnd().split('\n'),b=next.trimEnd().split('\n');
  let start=0,end=0;
  while(start<Math.min(a.length,b.length)&&a[start]===b[start])start++;
  while(end<Math.min(a.length,b.length)-start&&a[a.length-1-end]===b[b.length-1-end])end++;
  const lines=[...a.slice(Math.max(0,start-3),start).map(l=>' '+l),
    ...a.slice(start,a.length-end).map(l=>'-'+l),...b.slice(start,b.length-end).map(l=>'+'+l),
    ...a.slice(a.length-end,Math.min(a.length,a.length-end+3)).map(l=>' '+l)];
  process.stdout.write('*** Begin Patch\n*** Update File: '+path+'\n@@\n'+lines.join('\n')+'\n*** End Patch\n');
}
