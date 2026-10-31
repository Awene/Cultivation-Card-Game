import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const root=path.resolve('../tavern_helper_template-main');
const require=createRequire(path.join(root,'package.json'));
const ts=require('typescript'),cache=new Map();
function load(file){
 file=path.resolve(file); if(!path.extname(file))file=fs.existsSync(file+'.ts')?file+'.ts':path.join(file,'index.ts');
 if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file,'utf8'));
 if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext('(function(require,module,exports){'+code+'\n})',{console,localStorage:{getItem:()=>null},_ : require('lodash')})(p=>p.includes('apiMode')?{}:p.startsWith('.')?load(path.resolve(path.dirname(file),p)):require(p),module,module.exports);
 return module.exports;
}
const dir=path.join(root,'src/自定义开局');
const c=load(path.join(dir,'config/index.ts')), exp=load(path.join(dir,'export.ts'));
const d=c.LOCATION_WORLDS.find(w=>w.name==='灵界');
assert.equal(d.regions.length,7);
assert.equal(new Set(c.locations.map(l=>l.id)).size,c.locations.length);
const sel={difficultyId:c.difficulties[0].id,种族:'人族',种族细分:'',种族可化形:true,root:c.emptyRootChoice(),physique:c.emptyPhysiqueChoice(),性别:'男',元阳元阴:true,门派归属:'',itemIds:[],customItems:[],storyId:'story-dadao',customStory:null,道号:'测试',变量更新模式:'额外API'};
let count=0;
for(const loc of c.locations.filter(l=>l.世界==='灵界')){
 const s={...sel,locationId:loc.id};
 assert.equal(c.findLocationPath(loc.id).region.name,loc.地域);
 const data=exp.buildInitialStatData(s);
 assert.equal(data.地点.世界,'灵界');assert.equal(data.地点.地域,loc.地域);assert.equal(data.地点.具体地点,loc.具体地点);
 assert(exp.generateAIPrompt(s).includes('并非从凡界飞升'));
 const restricted=c.stories.find(s=>s.id==='story-tianxuan-zayou');
 assert.equal(c.isStoryAvailable(restricted,s),false);
 assert.throws(()=>exp.buildInitialStatData({...s,storyId:restricted.id}),/剧本不符/);
 count++;
}
const mortal=c.locations.find(l=>l.id==='eco-dt-liufang');
assert.equal(exp.buildInitialStatData({...sel,locationId:mortal.id}).地点.世界,'凡界');
for(const race of ['冥族','神族','域外异类']){
 assert.equal(c.findRace(race).selectable,true);
 assert.equal(c.normalizeRaceName(race),race,'预设导入不回退为人族');
 const selection={...sel,种族:race,locationId:mortal.id};
 assert.equal(exp.buildInitialStatData(selection).种族,race);
 assert(exp.generateAIPrompt(selection).includes('种族：'+race));
}
console.log({spiritBirthplaces:count,worlds:c.LOCATION_WORLDS.length,exportAndStoryConstraints:'PASS'});
