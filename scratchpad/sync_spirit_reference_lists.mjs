import {sources,regions,read} from './spirit_cast_sources.mjs';
import {cast,csv,parseCSV,patch} from './build_spirit_cast.mjs';
const people=process.argv.includes('--with-cast')?regions.flatMap(cast):[];
const fieldText=s=>Object.fromEntries(String(s).split('\n').filter(l=>/^- [^:：]+[:：]/.test(l)).map(l=>{const m=l.match(/^- ([^:：]+)[:：]\s*(.*)$/);return [m[1],m[2]];}));
const first=(f,keys)=>keys.map(k=>f?.[k]).find(Boolean)||'';
const squash=s=>String(s||'').replace(/\s+/g,' ').trim();
const roleNames=(detail,chars)=>Object.keys(chars).filter(n=>detail.includes(n));
const realmOrder=['凡人','炼气','筑基','金丹','元婴','化神','返虚','合体','大乘','渡劫'];
let sectRows=[],secretRows=[],countryRows=[];
for(const r of regions){
  const s=sources[r],d=s.runtime;
  for(const [name,org] of Object.entries(d.sectsData)){
    const canonical=s.normalized?.sects.find(x=>x.name===name),f=canonical?.fields||fieldText(org.detail);
    const names=[...new Set([...(canonical?.roster||roleNames(org.detail,d.characters)),...people.filter(p=>p.region===r&&p.group===name).map(p=>p.name)])];
    const profiles=names.map(n=>{const c=d.characters[n]||people.find(p=>p.region===r&&p.name===n)?.c;return c?n+'（'+[c.gender||people.find(p=>p.name===n&&p.region===r)?.gender,c.realm,c.title].filter(Boolean).join('·')+'）':n;});
    const intro=first(f,['简介','简介与理念','简介与族群','定位','概述','结构与经济','性质','职责','理念','宗旨']);
    const ideology=first(f,['理念','理念与生活','简介与理念','宗旨','生活']);
    const location=first(f,['位置','位置与规模','疆域与都城','疆域与中心','位置与治理']);
    const complete=people.filter(p=>p.region===r&&names.includes(p.name)).map(p=>p.name);
    sectRows.push([r,name,org.type==='大'?'大宗':org.type==='中'?'中宗':'公共修行机构',location,profiles.join(' / '),complete.join(' / '),intro,ideology,'FALSE','尚未制作独立主线事件；蓝图中的冲突与人物故事仅作创作参考。']);
  }
  for(const [name,secret] of Object.entries(d.M)){
    const canonical=s.normalized?.secrets.find(x=>x.name===name);
    const ecology=Object.entries(d.ecoData).find(([,e])=>e.mizing.includes(name))?.[0]||'';
    const stages=secret.detail.split('\n').filter(l=>/^\s+[1-4]\. /.test(l)).map(squash);
    const per=stages.filter(x=>/\[[^\]]+\]/.test(x));
    const recommend=canonical?.realm||secret.brief.match(/\(([^()]*)\)\s*\n/)?.[1]||'';
    const perLevel=per.length===4?per.map(x=>x.match(/^([1-4]\. .*?\[[^\]]+\])/)[1]).join(' / '):'四阶段；推荐范围：'+recommend+'；未逐阶段单独定级';
    const realmText=per.length===4?per.join(' '):recommend;
    const max=realmOrder.filter(x=>realmText.includes(x)).at(-1)||'未单独设定';
    const entry=canonical?.entry||secret.brief.split('入口: ')[1]||'';
    const important=d.重要秘境.has(name);
    secretRows.push([r,ecology,name,perLevel,max,squash(entry),squash(secret.brief.split('\n')[0].replace(/^\s*- /,''))+'；'+stages.join(' → '),important?'TRUE':'FALSE',important?'正式总览明确列入重要秘境':'区域秘境；未列为大陆重要秘境']);
  }
  const countries=s.normalized?.countries||['九河皇朝','烟水十二城盟','长风牧国','南溟商国'].map(name=>({name,fields:fieldText(d.kingsData[name].detail)}));
  for(const country of countries){
    const f=country.fields,detail=d.kingsData[country.name]?.detail||'';
    const rulers=people.filter(p=>p.region===r&&p.group===country.name);
    const protect=Object.entries(f).filter(([k])=>/庇护/.test(k)).map(([k,v])=>k+'：'+v).join('；');
    countryRows.push([r,country.name,first(f,['位置','疆域与都城','疆域与中心','简介与疆域','疆域','位置与治理']),first(f,['都城','中心','都城与城市','政体与中心','疆域与都城']),protect||fieldText(detail)['庇护']||'详见本大陆蓝图庇护条款',rulers.map(p=>p.name+'（'+p.c.realm+'）').join(' / '),'最高金丹；高阶冲突依赖宗门庇护',first(f,['简介','简介与理念','简介与疆域','定位','政体','政体与组织','政体与立国','政体与中心','制度','制度与生活','结构与经济'])||squash(detail), '世界书/灵界/'+r+'/'+r+'蓝图.md']);
  }
}
function merge(path,newRows){
  const old=parseCSV(read(path));return patch(path,csv([old[0],...old.slice(1).filter(row=>!regions.includes(row[0])),...newRows]));
}
let out=merge('Doc/宗门设定清单.csv',sectRows)+merge('Doc/秘境清单.csv',secretRows);
out+=patch('Doc/灵界凡国设定清单.csv',csv([['大陆','凡国名称','疆域位置','都城或中心','庇护关系','已有人设角色','境界与权力边界','制度与生活摘要','来源蓝图'],...countryRows]));
if(process.argv.includes('--inspect'))console.log(JSON.stringify({sects:sectRows.length,secrets:secretRows.length,countries:countryRows.length,emptySectFields:sectRows.filter(r=>!r[3]||!r[6]||!r[7]).map(r=>({region:r[0],name:r[1],location:r[3],intro:r[6],idea:r[7]})),countriesMissing:countryRows.filter(r=>r[4].startsWith('详见')).map(r=>r.slice(0,2))},null,2));
else process.stdout.write('*** Begin Patch\n'+out+'*** End Patch\n');
