import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const b=readFileSync('本格修仙.png');
let checked=0;
for(let p=8;p<b.length;){
  const n=b.readUInt32BE(p),t=b.toString('ascii',p+4,p+8),d=b.subarray(p+8,p+8+n);
  if(t==='tEXt'){
    const z=d.indexOf(0),k=d.toString('utf8',0,z);
    if(k==='chara'||k==='ccv3'){
      const c=JSON.parse(Buffer.from(d.subarray(z+1).toString(),'base64').toString());
      const entries=(c.data||c).character_book?.entries||[];
      const regions=entries.filter(e=>e.comment?.includes('地域-灵界-'));
      console.log(k,regions.map(e=>({name:e.comment,characters:e.content.length})));
      if(!process.argv.includes('--inspect')){
        assert.equal(regions.length,7,'角色卡须包含七个灵界入口');
        assert(!JSON.stringify(entries).includes('玄黄大陆'),'不得嵌入玄黄大陆设定');
        for(const e of regions){
          const r=e.comment.split('地域-灵界-')[1];
          const src=readFileSync(`世界书/灵界/${r}/[mvu_plot]${r}总览.txt`,'utf8');
          assert.equal(e.content.replace(/\r\n/g,'\n').trim(),src.replace(/\r\n/g,'\n').trim(),r+'打包内容一致');
          assert.equal(e.enabled,true,r+'入口启用');
        }
        checked++;
      }
    }
  }
  p+=12+n;
}
if(!process.argv.includes('--inspect')){assert(checked>0,'未找到角色卡元数据');console.log('角色卡内嵌总览与当前七个源文件完全一致。');}
