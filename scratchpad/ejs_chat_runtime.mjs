// 用本机已安装插件的真实实现作测试；仅替换其外部正则/宏处理为恒等函数。
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import vm from 'node:vm';
const require=createRequire(resolve('../tavern_helper_template-main/package.json'));
const ts=require('typescript');
export const pluginSourcePath=process.env.EJS_PLUGIN_CHAT_SOURCE || 'D:/application/Tavern/SillyTavern-Launcher/SillyTavern/public/scripts/extensions/third-party/ST-Prompt-Template/src/function/chat.ts';
const source=readFileSync(pluginSourcePath,'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
  .replace(/^import .*;\s*$/gm,'').replace(/\bexport /g,'');
const program=new vm.Script(js+'\n({getChatMessages,getChatMessage});');
export function chatRuntime(messages=[]){
  const chat=messages.map((m,i)=>typeof m==='string'?{mes:m,is_user:i%2===0,is_system:false,name:'测试'}:m);
  return program.runInNewContext({chat,substituteParams:s=>s,getRegexedString:s=>s,regex_placement:{USER_INPUT:1,AI_OUTPUT:2}});
}
