import {data as lingjing} from './build_lingjing_overview.mjs';
import {data as wanshou} from './build_wanshou_overview.mjs';
import {data as cangming} from './build_cangming_overview.mjs';
import {data as taichu} from './build_taichu_overview.mjs';
import {data as shengyin} from './build_shengyin_overview.mjs';
import {normalize,emit,patchFile} from './overview_star_style.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export const sources={
  圣银大陆:shengyin,
  灵境大陆:normalize('灵境大陆',lingjing),
  万兽大陆:normalize('万兽大陆',wanshou),
  沧溟大陆:normalize('沧溟大陆',cangming),
  太初大陆:normalize('太初大陆',taichu),
};
export const target=r=>'世界书/灵界/'+r+'/[mvu_plot]'+r+'总览.txt';
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const regions=process.argv[2]?[process.argv[2]]:Object.keys(sources);
  process.stdout.write('*** Begin Patch\n'+regions.map(r=>patchFile(target(r),emit(sources[r]))).join('')+'*** End Patch\n');
}
