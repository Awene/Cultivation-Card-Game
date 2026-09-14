// 与凡界人物模板保持相同字段、关键词和关系分档。
const quote = s => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const template = s => '`' + s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
const array = xs => '[' + xs.map(quote).join(', ') + ']';

export function moderateOf(p) {
  return p.moderate || [
    `### ${p.name} (${p.category})`,
    '身份: ' + p.c.title,
    '外貌: ' + p.features.replace(/成年/g, '').replace(new RegExp('^' + p.category + '[；;]'), ''),
    '着装: ' + p.shortOuter.replace(/成年/g, ''),
    '法宝: ' + p.shortArtifact,
  ].join('\n');
}

export function detailOf(p) {
  const d = p.deep;
  const numerals = ['①', '②', '③', '④'];
  return [
    `### ${p.name} (${p.category})`,
    (p.gender === '女' ? '女性魅力: ' : '男性魅力: ') + d.charm,
    '着装(外): ' + d.outer,
    '着装(内): ' + d.inner,
    '法宝: ' + d.artifact,
    '底色: ' + d.core,
    '',
    d.traits.map(t => '[' + t.name + ']\n' + t.scenes.map((s, i) => numerals[i] + ' ' + s).join('\n')).join('\n\n'),
  ].join('\n');
}

export function renderGroup(region, group, people) {
  const entries = people.map(p => {
    const d = p.deep;
    return `  ${quote(p.name)}: {
    kws: ${array(p.kws || [p.name])},
    locationKws: ${array(p.locationKws || [])},
    moderate: ${template(moderateOf(p))},
    detail: ${template(detailOf(p))},
    表白: ${template('[表白]\n' + d.confession)},
    道侣: ${template('[道侣相处]\n' + d.partner.map((s, i) => ['①', '②', '③', '④'][i] + ' ' + s).join('\n'))}
  },`;
  }).join('\n\n');
  return `<%_ { _%>
<%_
// ==================== 人物 · ${region} · ${group} ====================
// 收录: ${people.map(p => p.name).join(' / ')}
// ============================================================

const 人物关系 = getMessageVar('stat_data.关系列表') || {};
const 具体地点 = getMessageVar('stat_data.地点.具体地点') || '';
let recentText = '';
try {
  recentText = (getChatMessages(-10) || []).join('\\n');
} catch(e) {}
const secondaryKeywordHit = (c) =>
  c.kws.some(kw => kw && recentText.includes(kw)) ||
  (c.locationKws || []).some(kw => kw && 具体地点.includes(kw));

const queryRel = (n) => {
  if (!Object.prototype.hasOwnProperty.call(人物关系, n)) return null;
  const r = 人物关系[n];
  if (typeof r === 'number') return { 好感度: r, 关系: '' };
  if (!r || typeof r !== 'object') return { 好感度: 0, 关系: '' };
  return { 好感度: r.好感度 ?? 0, 关系: r.道侣 ? '道侣' : (r.关系 || r.关系类型 || '') };
};
const C = {

${entries}

};

const renderChar = (n, c) => {
  const r = queryRel(n);
  if (!r) return secondaryKeywordHit(c) ? c.moderate : '';
  let out = c.detail;
  if (r.关系 === '道侣') out += '\\n\\n' + c.道侣;
  else if ((r.好感度 || 0) > 80) out += '\\n\\n' + c.表白;
  return out;
};

const outputText = Object.entries(C)
  .map(([n, c]) => renderChar(n, c))
  .filter(Boolean)
  .join('\\n\\n');
_%>
<%- outputText %>
<%_ } _%>
`;
}
