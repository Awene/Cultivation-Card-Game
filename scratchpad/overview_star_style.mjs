// 只负责生成可读的星坠式单文件 EJS；本模块不写磁盘。
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const textFields = f => Object.entries(f || {}).filter(([,v]) => v != null && v !== '').map(([k,v]) => '- '+k+': '+v).join('\n');
const clean = s => String(s ?? '').replace(/玄黄大陆/g,'沧溟大陆').replace(/玄黄(?=[、/])/g,'沧溟');
const literal = s => clean(s).replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$\{/g,'\\${');
const tpl = s => '`'+literal(s)+'`';
const j = o => JSON.stringify(o,null,2);
const first = (o, keys) => keys.map(k=>o?.[k]).find(Boolean) || '';
const useful = s => String(s).replace(/\n#{1,4} [^\n]*\s*$/,'').trim();
export function normalize(region,d) {
  const chars=d.people || (Array.isArray(d.characters)?d.characters:Object.entries(d.characters).map(([name,c])=>({name,...c})));
  const characters=Object.fromEntries(chars.map(c=>{
    const f=c.fields || {};
    const type=c.type || (c.sex ? c.type : c.appearance);
    const look=c.sex?c.appearance:first(f,['形貌与衣饰','外貌与着装','外貌','形貌']);
    const age=c.age || first(f,['实际年龄','年龄']);
    const gender=c.gender || c.sex;
    const profile=Object.fromEntries(Object.entries(f).filter(([k])=>!['形貌与衣饰','外貌与着装','性别／类型','身份'].includes(k)));
    if(c.life)profile['性格与生活']=c.life;
    if(c.arts)profile['所长与法宝']=c.arts;
    if(c.purpose)profile['联系与用途']=c.purpose;
    return [c.name,{title:c.role,realm:c.realm,race:c.race,appearanceType:type,gender,...(age?{age}:{}),
      ...(gender==='女'&&look?{moderate:['外貌与着装: '+look]}:{}),profile}];
  }));
  const secrets=d.secrets.map(s=>{
    const f=s.fields || Object.fromEntries((s.detail || '').split('\n').filter(l=>/^- [^：]+：/.test(l)&&!/^\- [1-4]\. /.test(l)).map(l=>{const i=l.indexOf('：');return [l.slice(2,i),l.slice(i+1)];}));
    const realm=s.realm || s.brief?.split(': ')[1]?.split('\n')[0] || '';
    const entry=s.entrance || first(f,['入口与开放','位置与入口','位置／入口','入口','位置']) || s.brief?.split('入口: ')[1] || '';
    let stages=s.stages;
    if(!stages && s.steps) stages=s.steps.map(line=>{
      if(line.startsWith('|')){const a=line.split('|').slice(1,-1).map(x=>x.trim());if(a.length===5)return {scene:a[0]+'. '+a[1],danger:a[2],solution:a[3],reward:a[4]};return {scene:a[0],danger:a[1],solution:a[2],reward:a[3]};}
      const boxed=line.match(/^- 阶段([1-4])：场景【(.+?)】；危险【(.+?)】；解法【(.+?)】；收获【(.+?)】/);
      if(boxed)return {scene:boxed[1]+'. '+boxed[2],danger:boxed[3],solution:boxed[4],reward:boxed[5]};
      const l=line.replace(/^- 阶段([1-4])：/,'$1. ').replace(/^- /,'');
      const m=l.match(/^(.*?)；(?:险|危险)(?:为|：|:)(.*?)；(?:解|解法)(?:为|：|:)(.*?)；(?:获|收获)(?:为|：|:)([\s\S]*)$/);
      assert(m,'阶段解析失败: '+s.name+' '+line);
      return {scene:m[1],danger:m[2],solution:m[3],reward:m[4]};
    });
    assert.equal(stages?.length,4,s.name);
    return {name:s.name,important:s.important,realm,entry,stages,notes:textFields(Object.fromEntries(Object.entries(f).filter(([k])=>!['推荐境界','入口与开放','位置与入口','位置／入口','入口','位置'].includes(k)))),purpose:s.purpose || ''};
  });
  const ecology=(d.ecology || d.ecosystems).map((e,i)=>{
    let res=e.resources;
    if(typeof res==='string'){
      const pools={
        明珠珊庭:[['普通小型鱼贝'],['食用海藻','海草'],['礁砂','贝灰','可合法采集的枝状礁材']],
        青绡林海:[['普通海胆','养殖鱼（须核对归属）'],['食用藻叶','成熟藻茎','海草籽'],['贝壳','沉积砂']],
        千流环廊:[['野生小鱼','普通胶质生物'],['漂集海藻'],['海岭石材','可回收普通矿砂']],
        寒镜海原:[['食用贝','小型普通鱼'],['冷水海草','常见药用藻'],['冰晶','玄武岩']],
        赤烟海脊:[['附生贝虫'],['热泉菌类'],['玄武岩','火山玻璃','普通硫矿','铁铜矿砂']],
        初生海床:[['普通附生贝虫'],['可采食用菌'],['壳砂','沉积石片','常见育养材料']],
        生海之庭:[[],[],['外围盐析物','常见矿砂','普通石材','合规水样']],
        幽灯渊城:[['常见深水贝','普通鳗类'],['常见深水菌','合法培育的发光生物（须核对归属）'],['沉积矿砂','石材']],
        垂天海门:[['港湾鱼贝'],['岛面少量作物','晾干藻材','回收木料'],['普通海盐','浮石']]
      };
      assert(pools[e.name],'资源: '+e.name);
      e={...e,fields:{...e.fields,'资源边界':res}};
      res=Object.fromEntries(['动物','植物','矿产'].map((k,n)=>[k,pools[e.name][n]]));
    }
    return {...e,resources:res,secrets:e.secrets || secrets.slice(i*3,i*3+3).map(s=>s.name),roster:e.roster || []};
  });
  const sects=d.sects.map(s=>({...s,type:s.type || (s.large?'大':'中'),internal:s.internal || s.inner}));
  const countries=d.countries;
  const cities=d.cities.map(c=>{
    const f=c.fields || Object.fromEntries([['位置',c.location || [region,c.ecology,c.name].filter(Boolean).join('-')],['治理',c.country],['结构',c.structure],['生活',c.life],['交通',c.transport],['地标',Array.isArray(c.landmarks)?c.landmarks.join('、'):c.landmarks]].filter(([,v])=>v));
    const e=ecology.find(e=>Object.values(f).join(' ').includes(e.name));
    const roster=c.roster || [...new Set([...(e?.roster || []),...countries.filter(k=>Object.values(k.fields).join(' ').includes(c.name)).flatMap(k=>k.roster)])];
    return {name:c.name,title:c.name,fields:f,roster};
  });
  const core=d.core || textFields(d.overview) || d.general;
  const supplements=[d.history,d.general,d.daily,d.cohabitation,d.politics,d.charter,d.custody].filter(Boolean).join('\n\n');
  const map=d.map.startsWith('```')?d.map:'```mermaid\n'+d.map+'```';
  return {region,characters,secrets,ecology,sects,countries,cities,core,supplements,map,geography:[d.routes,d.geography,d.space].filter(Boolean).join('\n\n'),relations:d.relations || d.relationships || []};
}

export function emit(d){
  const r=d.region;
  const star=readFileSync('世界书/灵界/星坠大陆/[mvu_plot]星坠大陆总览.txt','utf8').replace(/\r\n/g,'\n');
  // 直接沿用基准的模式判定、取样、人物显示与门内档位。
  let out=star.slice(0,star.indexOf('  const characters = {')).replaceAll('星坠大陆',r);
  out=out.replace("if (!appeared && c.moderate)","if (!appeared && c.age) lines.push(pad + '  实际年龄: ' + c.age);\n    if (!appeared && c.moderate)");
  out+='  const characters = '+j(d.characters)+';\n\n';
  out+='  // ========== 秘境 brief / detail ==========\n  const 重要秘境 = new Set('+j(d.secrets.filter(s=>s.important).map(s=>s.name))+');\n  const M = {};\n';
  for(const s of d.secrets){
    const brief='  - '+s.name+': '+s.stages[0].scene.replace(/^\d+\. /,'')+' ('+s.realm+')\n    入口: '+s.entry;
    let detail='  - '+s.name+':\n    推荐境界: '+s.realm+'\n    入口: '+s.entry+'\n    顺序: 线性或条件分支 1→2→3→4\n';
    detail+=s.stages.map((v,i)=>'    '+(/^\d+\./.test(v.scene)?v.scene:(i+1)+'. '+v.scene)+'\n      险: '+v.danger+'\n      解: '+v.solution+'\n      获: '+v.reward).join('\n');
    if(s.notes)detail+='\n'+s.notes;
    if(s.purpose)detail+='\n    用途: '+s.purpose;
    out+='  M['+j(s.name)+'] = {\n    brief: '+tpl(brief)+',\n    detail: '+tpl(detail)+'\n  };\n';
  }
  out+='  const seg = name => inLoc(name) ? M[name].detail : M[name].brief;\n\n';
  out+='  // ========== 生态资源池：普通资源，不含秘境核心奖励 ==========\n  const RES = '+j(Object.fromEntries(d.ecology.map(e=>[e.name,e.resources])))+';\n\n';
  out+='  // ========== 生态 header / mizing / detail ==========\n  const ecoData = {\n';
  out+=d.ecology.map(e=>{
    const header=e.title+': '+(e.fields['地标'] || '');
    let detail=literal('### '+header+'\n'+textFields(e.fields)+'\n- 秘境:\n');
    detail+=e.secrets.map(n=>'${seg('+j(n)+')}').join('\n');
    if(e.roster.length)detail+='\n- 地方人物:\n${roster('+j(e.roster)+')}';
    detail+='\n- 资源: 动物 ${pick3(RES['+j(e.name)+'].动物)} | 植物 ${pick3(RES['+j(e.name)+'].植物)} | 矿产 ${pick3(RES['+j(e.name)+'].矿产)}';
    return '    '+j(e.name)+': {\n      header: '+j(header)+',\n      mizing: '+j(e.secrets)+',\n      detail: () => `'+detail+'`\n    }';
  }).join(',\n')+'\n  };\n\n';
  const orgBody=(s,brief)=>{
    const f=s.fields;
    const title='### '+(s.title || s.name);
    const intro=first(f,['简介','简介与理念','定位','结构与经济','生活']);
    const position=first(f,['位置','疆域与都城','疆域与中心','疆域','位置与治理']);
    const content=brief?[intro?'- 简介: '+intro:'',position?'- 位置: '+position:'',f['庇护']?'- 庇护: '+f['庇护']:''].filter(Boolean).join('\n'):textFields(f);
    return '`'+literal(title+'\n'+content)+(s.roster?.length?'\n- 组织:\n${roster('+j(brief?s.roster.slice(0,1):s.roster)+')}':'')+'`';
  };
  out+='  // ========== 宗门 brief / detail / 门内 ==========\n  const sectsData = {\n';
  out+=d.sects.map(s=>{
    const practice=first(s.fields,['修行','修行方向','修行与技艺','传承与技艺','技艺']);
    const inner=s.internal?Object.fromEntries(['外门','内门','管事','长老'].map((k,i)=>[k,'[门内视角]\n- 叙事指导: '+(s.fields['生活'] || s.fields['理念'] || s.fields['简介与理念'] || s.fields['简介'] || '')+(i===0?'\n- 入门: 核验来历与适合的传承方向，从基础课程、生活技艺和安全规程开始。':'')+'\n- 日常: '+s.internal[i]+'\n- 传承方向: '+practice+'\n- 技艺书: 依本宗已确认传承选择'+practice+'相关课程与记录，不凭本段自动生成可领取秘笈。\n- 取用: 按实际境界、职务与门规；不自动授予职位、功法或资源，凡人不执行需要灵力的操作。'])):null;
    return '    '+j(s.name)+': {\n      type: '+j(s.type)+',\n      brief: '+orgBody(s,true)+',\n      detail: '+orgBody(s,false)+',\n      门内kws: '+j([s.name])+',\n      门内: '+j(inner)+'\n    }';
  }).join(',\n')+'\n  };\n\n';
  out+='  // ========== 凡国与城市：默认brief，名称、地标或组织人物被提及时detail ==========\n  const kingsData = {\n';
  out+=[...d.countries,...d.cities].map(s=>{
    const strings=Object.values(s.fields).join(' ');
    const related=d.ecology.filter(e=>strings.includes(e.name)).map(e=>e.name);
    const cityNames=d.cities.filter(c=>strings.includes(c.name)).map(c=>c.name);
    const landmarks=(s.fields['地标'] || '').split(/[、，；。]/).filter(Boolean);
    const kws=[...new Set([s.name,...related,...cityNames,...landmarks,...(s.roster || [])])];
    return '    '+j(s.name)+': {\n      kws: '+j(kws)+',\n      brief: '+orgBody(s,true)+',\n      detail: '+orgBody(s,false)+'\n    }';
  }).join(',\n')+'\n  };\n\n';
  out+='  // ========== 大陆补充资料与人物初始档案 ==========\n';
  out+='  const localSetting = '+tpl(useful(d.supplements))+';\n';
  out+='  const relations = '+j(d.relations.map(x=>typeof x==='string'?x:x.text))+';\n';
  out+=`  const profileOut = mode === 'in' ? Object.entries(characters)
    .filter(([name]) => mentioned([name]) && !hasCharacterAppeared(name))
    .map(([name,c]) => '### ' + name + '\\n' + Object.entries(c.profile || {}).map(([k,v]) => '- '+k+': '+v).join('\\n')).join('\\n\\n') : '';
  const relationsOut = mode === 'in' ? relations.filter(line => {
    const pair = Object.keys(characters).filter(n => line.split('：')[0].includes(n));
    return pair.some(n => mentioned([n])) && pair.every(n => !hasCharacterAppeared(n));
  }).join('\\n') : '';
`;
  out+='  // ========== 地图 ==========\n  const mapText = '+tpl('<region_map realm="灵界" region="'+r+'">\n'+d.map+'\n'+d.geography+'\n地图表示区域关系，不代表比例尺；外部虚海为无底深空。\n</region_map>')+';\n\n';
  const assembly=star.slice(star.indexOf('  // ========== 装配输出'),star.indexOf('  outputText = `<region_information'));
  out+=assembly;
  out+='  outputText = `<region_information realm="灵界" region="'+r+'">\n地点层级: '+r+'-生态-宗门/秘境/城市(可选)-具体位置\n## '+r+'概述\n'+literal(d.core)+'\n\n## '+r+'生态\n${geoOut}\n\n## '+r+'宗门\n${sectsOut}${mode === \'in\' ? `\n\n## '+r+'凡国城市\n${kingsOut}\n\n## 大陆历史与公共生活\n${localSetting}${profileOut ? "\\n\\n## 本轮涉及人物\\n" + profileOut : ""}${relationsOut ? "\\n\\n## 初始关系参考\\n" + relationsOut : ""}` : \'\'}\n</region_information>${mapOut}`;\n}\n_%>\n<%- outputText %>\n<%_ } _%>\n';
  assert(!out.includes('undefined'),r+' 存在空字段');
  return clean(out);
}

export function patchFile(path,next){
  const prev=readFileSync(path,'utf8').replace(/\r\n/g,'\n');
  if(prev===next)return '';
  return '*** Update File: '+path+'\n@@\n'+prev.trimEnd().split('\n').map(l=>'-'+l).join('\n')+'\n'+next.trimEnd().split('\n').map(l=>'+'+l).join('\n')+'\n';
}
