// 维护旧构建入口：保留蓝图解析，统一改用星坠式输出。只输出补丁。
import {readFileSync} from 'node:fs';
import {patchFile} from './overview_star_style.mjs';
let patch='*** Begin Patch\n';
for(const [id,region,marker] of [['lingjing','灵境大陆','function renderLingjing'],['wanshou','万兽大陆','function renderWanshou'],['cangming','沧溟大陆','export function renderCangming'],['taichu','太初大陆','function renderTaichu']]){
  const path=`scratchpad/build_${id}_overview.mjs`;
  const src=readFileSync(path,'utf8').replace(/\r\n/g,'\n');
  const i=src.indexOf(marker); if(i<0)throw Error(path);
  const prefix=src.slice(0,i);
  const entry=id==='taichu'?"process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]":"process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href";
  const target=id==='taichu'?JSON.stringify(`世界书/灵界/${region}/[mvu_plot]${region}总览.txt`):'targetPath';
  const next=prefix+`export function build(){ return emit(normalize('${region}',data)); }\nif(${entry}){\n  if(process.argv.includes('--check')){\n    assert.equal(readFileSync(${target},'utf8').replace(/\\r\\n/g,'\\n'),build(),'总览与蓝图不同步');\n    console.log('${region}总览与蓝图一致。');\n  }else process.stdout.write('*** Begin Patch\\n'+patchFile(${target},build())+'*** End Patch\\n');\n}\n`;
  patch+=patchFile(path,"import {emit,normalize,patchFile} from './overview_star_style.mjs';\n"+next);
}
process.stdout.write(patch+'*** End Patch\n');
