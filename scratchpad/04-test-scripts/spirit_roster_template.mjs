// 总览仅装配南疆式短名册；完整人物资料保存在 overview-cast / cast 创作源。
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const readJSON = path => JSON.parse(readFileSync(path, 'utf8'));
const quote = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n') + "'";

export function compactCharacters(region) {
  const metadata = readJSON(`scratchpad/overview-cast-${region}.json`);
  const bases = readJSON(`scratchpad/cast-${region}.json`);
  return Object.fromEntries(Object.entries(metadata).map(([name, c]) => {
    const p = bases.find(p => p.name === name);
    assert(p, region + ' 缺少基础人物：' + name);
    const appearanceType = p.appearanceClass || c.appearanceType;
    let moderate;
    if (p.moderate) {
      moderate = p.moderate.split('\n').filter(l => /^(外貌|着装|法宝): /.test(l));
    } else {
      let look = p.features.includes(p.appearance) ? p.features
        : p.appearance.includes(p.features) ? p.appearance : p.appearance + '；' + p.features;
      look = look.replace(/成年/g, '').replace(new RegExp('^' + appearanceType + '[；;]'), '');
      moderate = ['外貌: ' + look, '着装: ' + p.outer.replace(/成年/g, ''), '法宝: ' + p.artifact];
    }
    // 非人族信息并入外貌，不额外增加一层种族标注。
    if (c.race && c.race !== '人族' && !moderate[0].includes(c.race))
      moderate[0] = moderate[0].replace('外貌: ', '外貌: ' + c.race + '；');
    moderate = moderate.map(s => s.replace(/。；/g, '；').replace(/[。；]+$/, ''));
    assert(moderate.length === 3, name + '三行简介');
    return [name, {
      title: p.overviewTitle || c.title.split(/[、，。；]/)[0],
      realm: c.realm,
      appearanceType,
      moderate,
    }];
  }));
}

export function rosterDictionary(region) {
  return '  const characters = {\n' + Object.entries(compactCharacters(region)).map(([name,c]) =>
    '    ' + quote(name) + ': {\n' +
    '      title: ' + quote(c.title) + ', realm: ' + quote(c.realm) + ', appearanceType: ' + quote(c.appearanceType) + ',\n' +
    '      moderate: [\n' + c.moderate.map(s => '        ' + quote(s) + ',').join('\n') + '\n      ],\n    },'
  ).join('\n') + '\n  };';
}

export const rosterRenderer = `  const renderRosterCharacter = (name, indent = 2) => {
    const c = characters[name];
    const appeared = hasCharacterAppeared(name);
    const pad = ' '.repeat(indent);
    const realmText = !appeared && c.realm ? c.realm + ' ' : '';
    const lines = [\x60\x24{pad}- \x24{c.title}: \x24{realmText}\x24{name}(\x24{c.appearanceType})\x60];
    if (!appeared) lines.push(...c.moderate.map(line => \x60\x24{pad}  \x24{line}\x60));
    return lines.join('\\n');
  };`;
