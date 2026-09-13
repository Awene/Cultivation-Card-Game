import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import vm from 'node:vm';
import {chatRuntime,pluginSourcePath} from './ejs_chat_runtime.mjs';
const require=createRequire(resolve('../tavern_helper_template-main/package.json'));
const config=require('yaml').parse(readFileSync('本格修仙.yaml','utf8'));
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
let checks=0,readers=0,syntax=0,mortal=0;
const ok=(v,m)=>{assert(v,m);checks++;};
const old='很久以前的标记',fresh='刚发生的标记';
const api=chatRuntime([old,...Array(25).fill('无关'),fresh]);
ok(api.getChatMessages(10).includes(old),'本机正数为头部');
ok(!api.getChatMessages(10).includes(fresh),'本机正数不是近期');
ok(api.getChatMessages(-10).includes(fresh)&&!api.getChatMessages(-10).includes(old),'负数为尾部');
ok(api.getChatMessages('17-26').length===0,'字符串范围不属于本机API');
ok(api.getChatMessages(-1,{hide_state:'all'}).length===0,'对象选项不属于本机API');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
function codeOf(src){let code='';for(const m of src.matchAll(/<%([_=\-]?)([\s\S]*?)([_\-]?)%>/g))code+=['-','='].includes(m[1])?'void ('+m[2]+');\n':m[2]+'\n';return code;}
const errors=[];
for(const path of walk('世界书').filter(p=>/\.(txt|ejs|ya?ml)$/.test(p))){
  const src=readFileSync(path,'utf8');
  if(src.includes('<%')){try{new AsyncFunction(codeOf(src));syntax++;}catch(e){errors.push({path,error:e.message});}}
  const calls=[...src.matchAll(/getChatMessages\(([^\n]*?)\)/g)].filter(m=>!/^\s*\/\//.test(src.slice(src.lastIndexOf('\n',m.index)+1,m.index)));
  if(!calls.length)continue;readers++;
  for(const m of calls){ok(/^-\d+$/.test(m[1]),path+'参数应为负数窗口：'+m[1]);const recent=api.getChatMessages(Number(m[1]));ok(recent.includes(fresh)&&!recent.includes(old),path+'新触发/旧不触发');}
  if(path.includes('/凡界/')&&path.includes('/人物/')){
    // 捕获字典，随后用实际插件接口验证每份凡界人物的关键词分支。
    const patched=src.replace(/<%-\s*outputText\s*%>/,'<% globalThis.__C=C;globalThis.__out=outputText; %>');
    const script=new vm.Script(codeOf(patched));
    const run=messages=>{const ctx={getMessageVar:()=>undefined,...chatRuntime(messages)};script.runInNewContext(ctx,{timeout:2000});return ctx;};
    const empty=run([]),name=Object.keys(empty.__C||{})[0];ok(name,path+'可捕获人物');
    ok(!run([name,...Array(20).fill('无关')]).__out,path+'旧人名不误触');
    ok(run([...Array(20).fill('无关'),name]).__out.includes(name),path+'新近人名展开');mortal++;
  }
}
ok(errors.length===0,'EJS语法问题 '+JSON.stringify(errors));
const entries=config.条目.filter(e=>e.文件?.includes('\\人物\\'));
ok(entries.length===160,'160人物配置');
const start=config.条目.find(e=>e.名称==='➤人物信息-start').插入位置.顺序;
const end=config.条目.find(e=>e.名称==='➤人物信息-end').插入位置.顺序;
for(const e of entries)ok(e.插入位置.顺序===200&&start<200&&200<end,e.名称+'顺序在151—250包装区间');
console.log(JSON.stringify({checks,readers,syntax,mortal,characterEntries:entries.length,order:200,pluginSourcePath},null,2));
