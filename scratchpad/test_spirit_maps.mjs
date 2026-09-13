import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const frontend=new URL('../../tavern_helper_template-main/',import.meta.url);
const card=new URL('../',import.meta.url);
const require=createRequire(new URL('package.json',frontend));
const ts=require('typescript');
const vue=require('vue');
const regions=['沧溟大陆','圣银大陆','星坠大陆','灵境大陆','太初大陆','万兽大陆','殒落大陆'];
const source=readFileSync(new URL('src/修仙状态栏/pages/PageMap.vue',frontend),'utf8');
const script=source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*;\r?\n/gm,'');
const js=ts.transpileModule(script,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
let checks=0;
const check=(v,label)=>{assert(v,label);checks++;};
function setup(local){
  const store=vue.reactive({data:{地点:{世界:'灵界',地域:'殒落大陆'}}});
  const ctx={...vue,useDataStore:()=>store,openLightbox:()=>{},window:local?{__CULTIVATION_MAP_BASE__:'http://localhost:5500/src/修仙状态栏/maps'}:{}};
  const api=new vm.Script(js+'\n;({getMap,selectRegion,selected,currentMap,tree,isHere});').runInNewContext(ctx);
  return {api,store};
}
for(const local of [false,true]){
  const {api,store}=setup(local);
  check(api.tree.value.find(w=>w.name==='灵界').regions.join(',')===regions.join(','),'灵界七入口及排序');
  for(const r of regions){
    api.selectRegion('灵界',r);
    check(api.currentMap.value.endsWith('/灵界/'+r+'地图.png'),'选择更新图片 '+r);
    check(api.currentMap.value.startsWith(local?'http://localhost:5500/':'https://testingcf.jsdelivr.net/'),'本地与正式资源分离');
  }
  check(api.getMap('灵界','陨落大陆')===api.getMap('灵界','殒落大陆'),'别字兼容');
  check(api.getMap('灵界','玄黄大陆')===''&&api.getMap('仙界','未知')==='','缺图与删除大陆不误配');
  api.selectRegion('灵界','殒落大陆');
  store.data.地点.地域='圣银大陆';await vue.nextTick();
  check(api.selected.地域==='圣银大陆','跟随玩家地点');
  api.selectRegion('灵界','太初大陆');store.data.地点.地域='灵境大陆';await vue.nextTick();
  check(api.selected.地域==='太初大陆','手动查看不被自动覆盖');
}
const hash=b=>createHash('sha256').update(b).digest('hex');
const dist=readFileSync(new URL('dist/修仙状态栏/index.html',frontend),'utf8');
for(const r of regions){
  const master=readFileSync(new URL('世界书/灵界/'+r+'/'+r+'地图.png',card));
  const asset=readFileSync(new URL('src/修仙状态栏/maps/灵界/'+r+'地图.png',frontend));
  check(hash(master)===hash(asset),'图片逐字节一致 '+r);
  check(asset.subarray(1,4).toString()==='PNG'&&asset.readUInt32BE(16)>0,'PNG有效 '+r);
  check(dist.includes('/灵界/'+r+'地图.png'),'构建产物包含映射 '+r);
}
check(hash(readFileSync(new URL('世界书/灵界/殒落大陆/殒落大陆地图.png',card)))==='5cd5b1e85736f784abd52ab4b7931478cbf60cef4ed43cc04d2cbf58ffdac609','正式殒落图是确认的第二版');
check(!existsSync(new URL('世界书/灵界/殒落大陆/殒落大陆地图-v2.png',card)),'v2已改正式名');
check(Buffer.byteLength(dist)<20*1024*1024&&!dist.includes('data:image/png;base64'),'地图不内嵌撑大HTML');
console.log('通过 '+checks+' 项地图校验。前端构建文件：'+fileURLToPath(new URL('dist/修仙状态栏/index.html',frontend)));
