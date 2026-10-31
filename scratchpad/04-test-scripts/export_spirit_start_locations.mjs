// Read-only extraction from current worldbook sources; output JSON for review/apply_patch.
import { sources } from './spirit_cast_sources.mjs';
const brief = text => text.match(/^- 简介[:：]\s*(.+)$/m)?.[1] || text.match(/^###\s*(.+)$/m)?.[1] || '';
const result = Object.entries(sources).map(([region, { runtime }]) => ({
  id: 'reg-spirit-' + region, name: region,
  description: '灵界 · ' + region,
  children: Object.entries(runtime.ecoData).map(([eco, data]) => ({
    id: 'eco-spirit-' + region + '-' + eco, name: eco,
    description: data.header,
    sects: Object.entries(runtime.sectsData).filter(([name, s]) => {
      const loc = (s.detail || s.brief).match(/^- 位置[:：]\s*(.+)$/m)?.[1] || '';
      return loc.includes(eco) || data.header.includes(name);
    }).map(([name, s]) => ({name, brief: brief(s.brief)})),
    kingdoms: Object.entries(runtime.kingsData).filter(([, s]) => {
      const loc = (s.detail || s.brief).match(/^- 位置[:：]\s*(.+)$/m)?.[1] || '';
      return loc.includes(eco);
    }).map(([name, s]) => ({name, brief: brief(s.brief)})),
  })),
}));
result.push({id:'reg-spirit-殒落大陆',name:'殒落大陆',description:'虚海中的破碎大陆，环境险恶、幸存者极少。出生点仅提供有存活可能的居所；不自动获得历史知识或跨虚海能力。',children:[
  {id:'eco-spirit-殒落大陆-遗火小庐',name:'遗火小庐',description:'殒落大陆的孤立居所；依当地残存生存条件开始，不默认能够横渡虚海。'},
  {id:'eco-spirit-殒落大陆-藏息医舍',name:'藏息医舍',description:'殒落大陆的残存医舍；不默认与幸存者熟识，开局需符合当地生存条件。'},
]});
console.log(JSON.stringify(result,null,2));
