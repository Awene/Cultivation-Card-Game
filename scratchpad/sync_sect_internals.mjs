// 将已确认的门内四档回填总览。CLI 仅输出 apply_patch，不直接写文件。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { sectInternals, internalRuntime } from './sect_internal_source.mjs';

function objectEnd(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if ('\'"`'.includes(text[i])) {
      const quote = text[i++];
      for (; i < text.length; i++) {
        if (text[i] === '\\') i++;
        else if (text[i] === quote) break;
      }
    } else if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i + 1;
  }
  throw new Error('未找到门内对象结尾');
}

function removeInner(entry) {
  entry = entry.replace(/\s*门内kws:\s*\[[\s\S]*?\],?/, '');
  for (const field of ['门内', '门内身份档']) {
    const m = new RegExp('\\s*' + field + ':\\s*(\\{|null)').exec(entry);
    if (!m) continue;
    const valueStart = m.index + m[0].length - m[1].length;
    let end = m[1] === 'null' ? valueStart + 4 : objectEnd(entry, valueStart);
    if (entry[end] === ',') end++;
    entry = entry.slice(0, m.index) + entry.slice(end);
  }
  return entry;
}

export function backfill(source, items) {
  let src = source.replace(/\r\n/g, '\n');
  const begin = src.indexOf('  const sectsData = {');
  assert(begin >= 0, '缺少 sectsData');
  const end = src.indexOf('\n  };', begin);
  assert(end > begin, '缺少 sectsData 结尾');
  const table = src.slice(begin, end);
  const hits = [...table.matchAll(/^    (["'])(.+?)\1:\s*\{/gm)];
  assert.equal(hits.length, items.length, '宗门数量与文档不同');
  let updated = table.slice(0, hits[0].index);
  for (let i = 0; i < hits.length; i++) {
    const item = items.find(s => s.name === hits[i][2]);
    assert(item, '未识别宗门 ' + hits[i][2]);
    let entry = removeInner(table.slice(hits[i].index, hits[i + 1]?.index ?? table.length));
    const close = entry.match(/\n    },?\s*$/);
    assert(close, item.name + ' 对象闭合');
    let body = entry.slice(0, close.index).trimEnd();
    if (!body.endsWith(',')) body += ',';
    body += '\n      门内kws: ' + JSON.stringify(item.kws, null, item.world === '灵界' && item.region !== '星坠大陆' ? 2 : undefined) + ',';
    body += '\n      门内: ' + JSON.stringify(item.inner, null, 2);
    if (item.identityTiers) body += ',\n      门内身份档: ' + JSON.stringify(item.identityTiers, null, 2);
    updated += body + close[0];
  }
  src = src.slice(0, begin) + updated + src.slice(end);
  const identity = /^  const 身份(?:原值|List|列表) =/m.exec(src);
  const runtime = internalRuntime(items[0].world);
  if (identity) {
    const from = identity.index;
    const rest = src.slice(from);
    const oldSelector = /  const 门内选档 = s => \{[\s\S]*?\n  };/m.exec(rest);
    const tier = /  const 门内档 =[^\n]+;/m.exec(rest);
    const member = /  const 本宗弟子 =[^\n]+;/m.exec(rest);
    assert(tier && member, '缺少现有门内分档');
    const until = oldSelector ? oldSelector.index + oldSelector[0].length
      : Math.max(tier.index + tier[0].length, member.index + member[0].length);
    src = src.slice(0, from) + runtime + rest.slice(until);
  } else src = src.replace('  const sectsData = {', runtime + '\n\n  const sectsData = {');
  const plain = "sectsOut = Object.values(sectsData).map(s => s.detail).filter(Boolean).join('\\n\\n');";
  src = src.replace(plain, `sectsOut = Object.values(sectsData).map(s => {
      let out = s.detail;
      if (s.门内 && 本宗弟子(s.门内kws)) out += '\\n\\n' + s.门内[门内选档(s)];
      return out;
    }).filter(Boolean).join('\\n\\n');`);
  src = src.replaceAll('s.门内[门内档]', 's.门内[门内选档(s)]');
  assert(src.includes('s.门内[门内选档(s)]'), '门内未接入装配');
  return src;
}

export const groups = sectInternals.reduce((map, s) => map.set(s.file, [...(map.get(s.file) || []), s]), new Map());

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let patch = '*** Begin Patch\n';
  for (const [file, items] of groups) {
    const before = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const after = backfill(before, items);
    if (before === after) continue;
    patch += '*** Update File: ' + file.replaceAll('\\', '/') + '\n@@\n';
    patch += before.trimEnd().split('\n').map(l => '-' + l).join('\n') + '\n';
    patch += after.trimEnd().split('\n').map(l => '+' + l).join('\n') + '\n';
  }
  process.stdout.write(patch + '*** End Patch\n');
}
