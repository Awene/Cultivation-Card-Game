// ST-Prompt-Template 本机实现：正数取头部，负数取尾部；返回 string[]。
// 只修读取代码，不改世界书正文；输出补丁交给 apply_patch。
import {readdirSync,readFileSync} from 'node:fs';
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
let patch='';const changes=[];
for(const path of walk('世界书').filter(p=>/\.(txt|ejs|ya?ml)$/.test(p))){
  const old=readFileSync(path,'utf8').replace(/\r\n/g,'\n');let next=old;
  next=next.replace(/getChatMessages\(10\)/g,'getChatMessages(-10)');
  next=next.replace(/getChatMessages\(`\$\{起\}-\$\{lastMessageId\}`\)/g,'getChatMessages(-6)');
  next=next.replace(/getChatMessages\(`\$\{_始\}-\$\{lastMessageId\}`\)/g,'getChatMessages(-4)');
  next=next.replace(/getChatMessages\(`\$\{Math\.max\(0,\s*lastMessageId\s*-\s*(\d+)\)\}-\$\{lastMessageId\}`\)/g,(_,n)=>'getChatMessages(-'+(Number(n)+1)+')');
  next=next.replace(/(getChatMessages\(-\d+\))\.map\(m\s*=>\s*m\.message\)/g,'$1');
  next=next.replace(/^\s*const (起|_始) = Math\.max\(0,\s*lastMessageId - [35]\);\n/gm,'\n');
  next=next.replace(/    const latest = asArray\(getChatMessages\(-1, \{hide_state:'all'\}\)\);[\s\S]*?    recentText = recent\.map\(textOf\)\.join\('\\n'\);/g,
    "    // 本机 EJS 插件的负数表示从末尾取消息，返回字符串数组。\n    recentText = asArray(getChatMessages(-10)).map(textOf).join('\\n');");
  if(next!==old){
    changes.push(path);
    // 逐行窄补丁，避免将长篇正文再次写入。
    const a=old.split('\n'),b=next.split('\n');
    let prefix=0;while(prefix<Math.min(a.length,b.length)&&a[prefix]===b[prefix])prefix++;
    let suffix=0;while(suffix<Math.min(a.length,b.length)-prefix&&a.at(-1-suffix)===b.at(-1-suffix))suffix++;
    patch+='*** Update File: '+path+'\n@@\n'+a.slice(prefix,a.length-suffix).map(l=>'-'+l).join('\n')+'\n'+b.slice(prefix,b.length-suffix).map(l=>'+'+l).join('\n')+'\n';
  }
}
if(process.argv.includes('--inspect'))console.log(JSON.stringify({count:changes.length,files:changes},null,2));
else process.stdout.write('*** Begin Patch\n'+patch+'*** End Patch\n');
