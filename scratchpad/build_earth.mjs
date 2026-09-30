// 只输出 apply_patch 补丁，不写文件。以地球蓝图为人物资料来源。
import fs from 'node:fs';
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const blueprint = read('Doc/世界书设定相关/地球蓝图.md');
const q = s => JSON.stringify(s, null, 2);
const template = s => '`' + s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
function data(value, depth=0) {
  if(typeof value==='string') return value.includes('\n') ? template(value) : q(value);
  if(value===null || typeof value!=='object') return q(value);
  if(Array.isArray(value)) return '['+value.map(v=>data(v,depth+1)).join(', ')+']';
  const pad='  '.repeat(depth);
  return '{\n'+Object.entries(value).map(([k,v])=>pad+'  '+q(k)+': '+data(v,depth+1)).join(',\n')+'\n'+pad+'}';
}
const changes = [];
function put(path, text) {
  text = text.trimEnd() + '\n';
  if (fs.existsSync(path)) {
    const old = read(path);
    if (old === text) return;
    const a=old.trimEnd().split('\n'), b=text.trimEnd().split('\n');
    let start=0, end=0;
    while(start<Math.min(a.length,b.length) && a[start]===b[start]) start++;
    while(end<Math.min(a.length,b.length)-start && a[a.length-1-end]===b[b.length-1-end]) end++;
    const context=a.slice(Math.max(0,start-2),start).map(l=>' '+l);
    const tail=end?a.slice(a.length-end,a.length-end+2).map(l=>' '+l):[];
    changes.push(`*** Update File: ${path}\n@@\n` + [...context,...a.slice(start,a.length-end).map(l=>'-'+l),...b.slice(start,b.length-end).map(l=>'+'+l),...tail].join('\n'));
  } else changes.push(`*** Add File: ${path}\n` + text.trimEnd().split('\n').map(l => '+' + l).join('\n'));
}
const groups = [
  {id:'CN', region:'中国', kws:['中国','北京','洛阳','华夏修真科学技术大学','修科大','仙改委','华修院'], school:'华夏修真科学技术大学'},
  {id:'EU', region:'欧盟', kws:['欧盟','意大利','罗马','法国','德国','西班牙','葡萄牙','圣钥恩典大学','圣钥大学','圣约理事会','圣匣集团'], school:'圣钥恩典大学'},
  {id:'US', region:'英美', kws:['英美','美国','英国','波士顿','蒙召恩典大学','蒙恩大学','创世能源','永约救赎资本','永约资本','伦敦','永恩圣约学院','永恩学院','天佑永续基金'], school:'蒙召恩典大学'},
  {id:"JP", region:"日本", kws:["日本","京都","东京","大阪","伊势","常世奉纳学园","常世学园","御利益信托","高千穗","倒悬天岩"], school:"常世奉纳学园"},
  {id:"RU", region:"俄罗斯", kws:["俄罗斯","莫斯科","圣彼得堡","永昼圣像学院","圣像学院","白夜能源联合体","拉多加","沉钟石阶"], school:"永昼圣像学院"},
  {id:"IL", region:"以色列", kws:["以色列","耶路撒冷","特拉维夫","盟约经卷研究院","经卷院","应许资产信托","凯撒利亚","回潮拱廊"], school:"盟约经卷研究院"},
  {id:"ME", region:"中东", kws:["中东","埃及","开罗","土耳其","伊斯坦布尔","沙特","沙特阿拉伯","伊朗","阿联酋","新月明证学院","明证学院","长明绿洲基金","萨卡拉","沙下星井"], school:"新月明证学院"},
  {id:"IN", region:"印度", kws:["印度","瓦拉纳西","新德里","孟买","恒河明觉学院","明觉学院","轮回红利基金","曼杜","月池回城"], school:"恒河明觉学院"},
  {id:"AF", region:"非洲", kws:["非洲","贝宁","科托努","维达","多哥","洛美","加纳","归鼓传承学院","归鼓学院","祖荫共益社","维达","回鼓林庭"], school:"归鼓传承学院"},
];
const people = [...blueprint.matchAll(/^#### ((?:CN|EU|US|JP|RU|IL|ME|IN|AF)\d\d) ([^\n]+)\n([\s\S]*?)(?=\n### |\n#### |(?![\s\S]))/gm)].map(m => {
  const fields = Object.fromEntries([...m[3].matchAll(/^- ([^：\n]+)：([^\n]+)/gm)].map(x => [x[1],x[2]]));
  const [gender,race,age,look,realm,root] = fields.基础.split('｜');
  return {id:m[1],name:m[2],gender,race,age:parseInt(age),look:look.replace('外观为',''),realm:realm.replace('前期','初期'),root:root.replace(/。$/,''),fields};
});
if(people.length!==49) throw Error('人物解析数量不符');
// 总览及已有人物正文手工维护；仅为缺失条目生成初稿并补登记。
const overviewPath = '世界书/地球/[mvu_plot]地球总览.txt';
read(overviewPath);
const entries = [{name:'[mvu_plot]地域-地球',path:overviewPath,order:52}];
for(const g of groups){
  const cast = people.filter(p=>p.id.startsWith(g.id));
  const charPath = `世界书/地球/人物/[mvu_plot]人物-地球-${g.region}.txt`;
  g.cast=cast; g.charPath=charPath;
  const C = Object.fromEntries(cast.map(p=>{
    const body = Object.entries(p.fields).filter(([k])=>!['基础','外貌','身份与地点'].includes(k)).map(([k,v])=>k+': '+v).join('\n').replace('，不担任神父或司铎职务','').replace('，不靠一句劝说完成','').replace('，并非全球顶尖战力或能压过元婴的万能武器','');
    return [p.name,{kws:[p.name,...(p.name.includes('·')?[p.name.split('·')[0]]:[]),...(p.name==='明澄'?['明澄法师']:[])],locationKws:[],moderate:'### '+p.name+' ('+p.look+')\n身份: '+p.fields['身份与地点']+'\n外貌: '+p.fields.外貌,detail:'### '+p.name+' ('+p.look+')\n身份: '+p.fields['身份与地点']+'\n外貌: '+p.fields.外貌+'\n'+body}];
  }));
  if (!fs.existsSync(charPath)) put(charPath, `<%_ {
const 人物关系 = getMessageVar('stat_data.关系列表') || {};
const 具体地点 = String(getMessageVar('stat_data.地点.具体地点') || '');
const recentText = (getChatMessages(-10) || []).join('\\n');
const C = ${data(C)};
const outputText = Object.entries(C).map(([name,c]) => {
  if (Object.prototype.hasOwnProperty.call(人物关系,name)) return c.detail;
  return c.kws.some(k => recentText.includes(k)) || c.locationKws.some(k => 具体地点.includes(k)) ? c.moderate : '';
}).filter(Boolean).join('\\n\\n');
_%>
<%- outputText %>
<%_ } _%>`);
  entries.push({name:`[mvu_plot]人物-地球-${g.region}`,path:charPath,order:200,kws:[...new Set([...Object.values(C).flatMap(c=>c.kws),...g.kws])]});
}
function yamlEntry(e){return `  - 名称: "${e.name}"
    启用: true
    激活策略:
      类型: ${e.kws?'绿灯':'蓝灯'}${e.kws?'\n      关键字:\n'+e.kws.map(k=>'        - '+k).join('\n'):''}
    插入位置:
      类型: 角色定义之前
      顺序: ${e.order}
    激活概率: 100${e.kws?'\n    特殊效果:\n      黏性: 5':''}
    递归:
      不可被其他条目激活: false
      不可激活其他条目: true
    文件: ${e.path.slice(0,-4).replaceAll('/','\\')}

`;}
let yaml=read('本格修仙.yaml');
if(!yaml.includes('文件: 世界书\\地球\\')){
  yaml=yaml.replace('  - 名称: ➤人物信息-end',entries.map(yamlEntry).join('')+'  - 名称: ➤人物信息-end');
  put('本格修仙.yaml',yaml);
}
// 沿用原 CSV 列序；未经设计的衣饰、恋爱等字段留空。
const csvPath='Doc/世界书设定相关/角色蓝图.csv';
let csv=read(csvPath);
const headers=csv.split('\n')[0].replace(/^\uFEFF/,'').split(',');
const cell=s=>/[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
for(const g of groups)for(const p of g.cast){
  if(csv.split('\n').some(l=>l.startsWith(p.name+',')))continue;
  const row={'人物名称':p.name,'性别':p.gender,'关键字':p.name+'、'+g.school,'初遇地点':g.school,'外观':p.look,'外观特征':p.fields.外貌,'性格特征':p.fields['性格与生活'],'世界':'地球','大陆':g.region,'种族':p.race,'初始境界':p.realm,'实际年龄':String(p.age),'所属分组':g.school,'身份职责':p.fields['身份与地点'],'人物世界书文件':g.charPath,'关系与交往':p.fields['关系与剧情'],'可选故事':p.fields['职责与矛盾']||p.fields['积累与职责']||p.fields['职责与剧情']||''};
  csv=csv.trimEnd()+'\n'+headers.map(k=>cell(row[k]||'')).join(',')+'\n';
}
put(csvPath,csv);
console.log('*** Begin Patch\n'+changes.join('\n')+'\n*** End Patch');
