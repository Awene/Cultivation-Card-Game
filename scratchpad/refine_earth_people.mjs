import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(resolve('../tavern_helper_template-main/package.json')),ts=require('typescript');
const data=JSON.parse(fs.readFileSync('scratchpad/earth_people_refinement_data.json','utf8'));
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n'),changes=new Map();
const put=(p,s)=>{if(read(p).trimEnd()!==s.trimEnd())changes.set(p,s.trimEnd()+'\n');};
const regions={CN:'中国',EU:'欧盟',US:'英美',JP:'日本',RU:'俄罗斯',IL:'以色列',ME:'中东',IN:'印度',AF:'非洲'};
const tick=String.fromCharCode(96);
const template=s=>tick+s.replace(/\\/g,'\\\\').replaceAll(tick,'\\'+tick).replace(/\$\{/g,'\\'+'$'+'{')+tick;
function js(v,d=0){
 if(typeof v==='string')return v.includes('\n')?template(v):JSON.stringify(v);
 if(v===null||typeof v!=='object')return JSON.stringify(v);
 if(Array.isArray(v))return '['+v.map(x=>js(x,d+1)).join(', ')+']';
 const pad='  '.repeat(d);
 return '{\n'+Object.entries(v).map(([k,x])=>pad+'  '+JSON.stringify(k)+': '+js(x,d+1)).join(',\n')+'\n'+pad+'}';
}
const bpPath='Doc/世界书设定相关/地球蓝图.md';let bp=read(bpPath);
const people=[...bp.matchAll(/^#### ((?:CN|EU|US|JP|RU|IL|ME|IN|AF)\d\d) ([^\n]+)\n([\s\S]*?)(?=\n### |\n#### |(?![\s\S]))/gm)].map(m=>{
 const f=Object.fromEntries([...m[3].matchAll(/^- ([^：\n]+)：([^\n]+)/gm)].map(x=>[x[1],x[2]]));
 const [gender,race,age,look,realm,root]=f.基础.split('｜');
 return {id:m[1],name:m[2],gender,race,age:parseInt(age),look:look.replace(/^外观为/,''),realm:realm.replace('前期','初期'),root:root.replace(/。$/,''),f};
});
for(const n of data.newcomers)if(!people.some(p=>p.name===n.name))people.push({...n,gender:'女',race:'人族',f:{'身份与地点':n.title,外貌:n.face,'性格与生活':n.life,'职责与剧情':n.story}});
const overviewPath='世界书/地球/[mvu_plot]地球总览.txt';let overview=read(overviewPath);
const charsStart=overview.indexOf('  const characters ='),countriesStart=overview.indexOf('  const countriesData ='),citiesStart=overview.indexOf('  const citiesData =');
const characters=vm.runInNewContext(overview.slice(charsStart,countriesStart)+'\ncharacters;');
const countries=vm.runInNewContext(overview.slice(countriesStart,citiesStart)+'\ncountriesData;');
const byRegion={},refined=new Map(),nums=['①','②','③','④'];
for(const p of people){
 const spec=data.details[p.name];if(!spec)throw Error('缺少detail '+p.name);
 const female=p.gender==='女';p.age=female?(data.ages[p.name]??p.age):p.age;
 if(female&&(p.age<18||p.age>35))throw Error('年龄范围 '+p.name);
 const wardrobe=data.outfits[p.name],oldLook=p.f.外貌,split=oldLook.indexOf('。')+1;
 const face=data.faces?.[p.name]||p.face||(female&&split?oldLook.slice(0,split):oldLook);
 const outer=wardrobe?.[0]||data.maleOutfits[p.name],inner=wardrobe?.[1]||'素色棉质汗衫、宽松衬裤与长袜；休息时换柔软睡衣。';
 const title=p.f['身份与地点'],base='### '+p.name+' ('+p.look+')\n身份: '+title+'\n外貌: '+face;
 const history=Object.entries(p.f).filter(([k])=>['职责与矛盾','积累与职责','职责与剧情','关系与剧情'].includes(k)).map(([,v])=>v).join('').replace('，不担任神父或司铎职务','').replace('，不靠一句劝说完成','').replace('，并非全球顶尖战力或能压过元婴的万能武器','');
 const trait=t=>'['+t[0]+']\n'+t.slice(1).map((v,i)=>nums[i]+' '+v).join('\n');
 const c={kws:[p.name,...(p.name.includes('·')?[p.name.split('·')[0]]:[]),...(p.name==='明澄'?['明澄法师']:[])],locationKws:[],moderate:base+'\n着装: '+outer+'\n法宝: '+spec.tools,
 detail:base+'\n角色魅力: '+spec.charm+'\n着装(外): '+outer+'\n着装(内): '+inner+'\n法宝: '+spec.tools+'\n底色: '+spec.core+(history?'\n经历与牵连: '+history:'')+'\n\n'+trait(spec.a)+'\n\n'+trait(spec.b)};
 if(female){if(spec.love.length!==5)throw Error('缺少感情片段 '+p.name);c.表白='[表白]\n'+spec.love[0];c.道侣='[道侣相处]\n'+spec.love.slice(1).map((x,i)=>nums[i]+' '+x).join('\n');}
 const region=regions[p.id.slice(0,2)];(byRegion[region]??={})[p.name]=c;
 characters[p.name]={title,realm:p.realm,appearanceType:p.look,age:p.age,root:p.root,moderate:'外貌: '+face+'\n    着装: '+outer};
 if(!countries[region].roster.includes(p.name))countries[region].roster.push(p.name);
 refined.set(p.name,{p,c,face,outer,inner,spec});
 const fields={...p.f,基础:[p.gender,p.race,p.age+'岁',p.look,p.realm,p.root+'。'].join('｜'),外貌:face,'着装(外)':outer,'着装(内)':inner,法宝:spec.tools,底色:spec.core};
 const block='#### '+p.id+' '+p.name+'\n\n'+Object.entries(fields).map(([k,v])=>'- '+k+'：'+v).join('\n')+'\n';
 const re=new RegExp('^#### '+p.id+' '+p.name+'\\n[\\s\\S]*?(?=\\n#{2,4} |(?![\\s\\S]))','m');
 if(re.test(bp))bp=bp.replace(re,()=>block);else p.newBlock=block;
}
const newBlocks=people.filter(p=>p.newBlock);
if(newBlocks.length)bp=bp.trimEnd()+'\n\n## 十六、中国、欧盟与英美女性增补\n\n新增六名女性，人物detail按《人物提示词示例》细化，表白与道侣片段按关系条件输出。\n\n'+newBlocks.map(p=>p.newBlock).join('\n');
bp=bp.replace('开局年龄20~39岁','开局年龄18~35岁').replace('共新增21人、7城与7处秘境。','本批新增21人、7城与7处秘境；后续六名女性见第十六节。');put(bpPath,bp);
overview=overview.slice(0,charsStart)+'  const characters = '+js(characters)+';\n\n'+overview.slice(countriesStart);
for(const region of ['中国','欧盟','英美']){
 const start=overview.indexOf('  "'+region+'": {',overview.indexOf('  const countriesData =')),r=overview.indexOf('"roster": [',start),end=overview.indexOf(']',r)+1;
 overview=overview.slice(0,r)+'"roster": '+JSON.stringify(countries[region].roster,null,2).replace(/\n/g,'\n    ')+overview.slice(end);
}put(overviewPath,overview);
const render=[
"const outputText = Object.entries(C).map(([name,c]) => {",
"  if (!Object.prototype.hasOwnProperty.call(人物关系,name))",
"    return c.kws.some(k => recentText.includes(k)) || c.locationKws.some(k => 具体地点.includes(k)) ? c.moderate : '';",
"  const rel = 人物关系[name];",
"  const score = typeof rel === 'number' ? rel : rel?.好感度 ?? 0;",
"  const partner = rel?.道侣 || (rel?.关系 ?? rel?.关系类型) === '道侣';",
"  return c.detail + (partner && c.道侣 ? '\\n\\n' + c.道侣 : !partner && score > 80 && c.表白 ? '\\n\\n' + c.表白 : '');",
"}).filter(Boolean).join('\\n\\n');","_%>","<%- outputText %>","<%_ } _%>",""].join('\n');
for(const [region,C]of Object.entries(byRegion)){const p='世界书/地球/人物/[mvu_plot]人物-地球-'+region+'.txt',src=read(p);put(p,src.slice(0,src.indexOf('const C ='))+'const C = '+js(C)+';\n'+render);}
let yaml=read('本格修仙.yaml');
for(const region of ['中国','欧盟','英美']){
 const start=yaml.indexOf('  - 名称: "[mvu_plot]人物-地球-'+region+'"'),end=yaml.indexOf('\n  - 名称:',start+1);let entry=yaml.slice(start,end);
 const keys=data.newcomers.filter(p=>p.region===region).flatMap(p=>[p.name,...(p.name.includes('·')?[p.name.split('·')[0]]:[])]);
 entry=entry.replace('      关键字:\n','      关键字:\n'+keys.filter(k=>!entry.includes('        - '+k+'\n')).map(k=>'        - '+k+'\n').join(''));yaml=yaml.slice(0,start)+entry+yaml.slice(end);
}put('本格修仙.yaml',yaml);
function parseRow(line){const out=[];let v='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){v+='"';i++;}else q=!q;}else if(c===','&&!q){out.push(v);v='';}else v+=c;}out.push(v);return out;}
const csvPath='Doc/世界书设定相关/角色蓝图.csv',csv=read(csvPath).trimEnd().split('\n'),header=parseRow(csv[0]),rows=csv.slice(1).map(line=>({line,cells:parseRow(line)}));
const maleNames=new Set(rows.filter(r=>r.cells[header.indexOf('性别')]==='男').map(r=>r.cells[0]));
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]),removed=[],scopedMales=new Set();
for(const p of [...walk('世界书/灵界'),...walk('世界书/冥界')].filter(p=>p.includes('/人物/')&&p.endsWith('.txt'))){
 const src=read(p),m=src.match(/const C = (\{[\s\S]*?\n\});/);if(!m)throw Error('缺少C '+p);
 const ast=ts.createSourceFile('C.ts',m[0],ts.ScriptTarget.Latest,true),obj=ast.statements[0].declarationList.declarations[0].initializer,edits=[];
 for(const member of obj.properties){const name=member.name.text;if(!maleNames.has(name))continue;scopedMales.add(name);
  for(const prop of member.initializer.properties)if(['表白','道侣'].includes(prop.name?.text)){const start=m.index+prop.getFullStart();let end=m.index+prop.end;if(src[end]===',')end++;edits.push({start,end});removed.push({file:p,name,section:prop.name.text});}
 }
 if(edits.length){let next=src;for(const e of edits.sort((a,b)=>b.start-a.start))next=next.slice(0,e.start)+next.slice(e.end);
 next=next.replace("if (r.关系 === '道侣') out +=", "if (r.关系 === '道侣' && c.道侣) out +=").replace("else if ((r.好感度 || 0) > 80) out +=","else if ((r.好感度 || 0) > 80 && c.表白) out +=");put(p,next);}
}
const cell=s=>/[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s,result=[csv[0]],seen=new Set();
for(const r of rows){
 const name=r.cells[0],item=r.cells[header.indexOf('世界')]==='地球'?refined.get(name):null;let changed=false;
 if(item){const {p,c,face,outer,inner,spec}=item;
 const values={'实际年龄':String(p.age),'外观':p.look,'外观特征':face,'穿衣习惯(外)':outer,'穿衣习惯(内)':inner,'常用法宝类型':spec.tools,'女性魅力':p.gender==='女'?spec.charm:'','性格底色':spec.core,'性格特征A':spec.a[0],'性格A场景':spec.a.slice(1).join('；'),'性格特征B':spec.b[0],'性格B场景':spec.b.slice(1).join('；'),'主动表白':p.gender==='女'?spec.love[0]:'','道侣相处':p.gender==='女'?spec.love.slice(1).join('；'):''};
 for(const [k,v]of Object.entries(values))r.cells[header.indexOf(k)]=v;changed=true;seen.add(name);
 }else if(scopedMales.has(name)&&['灵界','冥界'].includes(r.cells[header.indexOf('世界')])){r.cells[header.indexOf('主动表白')]='';r.cells[header.indexOf('道侣相处')]='';changed=true;}
 result.push(changed?r.cells.map(cell).join(','):r.line);
}
for(const [name,{p,c,face,outer,inner,spec}]of refined)if(!seen.has(name)){
 const n=data.newcomers.find(x=>x.name===name);if(!n)throw Error('原角色CSV缺失 '+name);
 const row={'人物名称':name,'性别':p.gender,'关键字':c.kws.join('、')+'、'+n.school,'初遇地点':n.school,'外观':p.look,'女性魅力':spec.charm,'外观特征':face,'穿衣习惯(外)':outer,'穿衣习惯(内)':inner,'性格特征':p.f['性格与生活'],'常用法宝类型':spec.tools,'世界':'地球','大陆':regions[p.id.slice(0,2)],'种族':'人族','初始境界':p.realm,'实际年龄':String(p.age),'所属分组':n.school,'身份职责':n.title,'人物世界书文件':'世界书/地球/人物/[mvu_plot]人物-地球-'+n.region+'.txt','可选故事':n.story,'性格底色':spec.core,'性格特征A':spec.a[0],'性格A场景':spec.a.slice(1).join('；'),'性格特征B':spec.b[0],'性格B场景':spec.b.slice(1).join('；'),'主动表白':spec.love[0],'道侣相处':spec.love.slice(1).join('；')};result.push(header.map(k=>cell(row[k]||'')).join(','));
}put(csvPath,result.join('\n')+'\n');
function patch(p,next){
 const a=read(p).trimEnd().split('\n'),b=next.trimEnd().split('\n'),lines=['*** Begin Patch','*** Update File: '+p];
 if(p===csvPath){for(let i=0;i<a.length;i++)if(a[i]!==b[i]){lines.push('@@','-'+a[i],'+'+b[i]);if(i===a.length-1)lines.push(...b.slice(a.length).map(x=>'+'+x));}if(b.length>a.length&&a.at(-1)===b[a.length-1])lines.push('@@',' '+a.at(-1),...b.slice(a.length).map(x=>'+'+x));}
 else{let i=0,j=0;while(i<Math.min(a.length,b.length)&&a[i]===b[i])i++;while(j<Math.min(a.length,b.length)-i&&a.at(-1-j)===b.at(-1-j))j++;lines.push('@@',...a.slice(Math.max(0,i-2),i).map(x=>' '+x),...a.slice(i,a.length-j).map(x=>'-'+x),...b.slice(i,b.length-j).map(x=>'+'+x),...a.slice(a.length-j,a.length-j+2).map(x=>' '+x));}
 lines.push('*** End Patch');return lines.join('\n');
}
if(process.argv[2]==='--list')console.log(JSON.stringify({files:[...changes.keys()],people:people.length,maleCharacters:new Set(removed.map(x=>x.name)).size,maleSections:removed.length}));
else if(process.argv[2]==='--file'){const p=process.argv[3];if(!changes.has(p))throw Error('没有待修改文件 '+p);console.log(patch(p,changes.get(p)));}
else throw Error('使用 --list 或 --file 路径');

