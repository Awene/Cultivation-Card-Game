import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../tavern_helper_template-main/package.json',import.meta.url));
const _=require('lodash'), {z}=require('zod'), YAML=require('yaml');
const context={_,z,YAML,console,$:f=>f(),eventOn(){},registerMvuSchema(){}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../脚本/变量结构.js',import.meta.url),'utf8').replace(/^import .*?;\r?\n/,'').replace('export const Schema','const Schema')+'\nthis.api={Schema,jsonPatchPreprocessor,splitPath,tryParseValue};',context);
const {Schema,jsonPatchPreprocessor:pre,splitPath,tryParseValue:parse}=context.api;
globalThis._=_;
const {Schema:Frontend}=await import('../../tavern_helper_template-main/src/修仙状态栏/schema.ts');
const samples={'卯时':'卯时','卯':'卯时','12时':'午时','17时':'酉时','晚间':'戌时','晚':'戌时','白天':'午时','早':'卯时','日间':'午时','12点':'午时','0点':'子时','21点':'亥时','凌晨2点':'丑时','下午3点':'申时','晚上十二点':'子时','１２：３０':'午时','子时三刻':'子时'};
for(const schema of [Schema,Frontend]) {
 for(const [input,expected] of Object.entries(samples)) assert.equal(schema.parse({时间:{时辰:input}}).时间.时辰,expected,input);
 for(const [input,expected] of [['一月',1],['十二月',12],['腊月',12],['正月',1],['冬月',11]]) assert.equal(schema.parse({时间:{月:input}}).时间.月,expected,input);
 const data=schema.parse({时间:{年:'七千二百年',月:'腊月',日:'廿三'},传闻:{条目:{'悬赏/[时间].~1"':{类别:'高额悬赏',内容:'消息',难度:'筑基初期-筑基后期'},缺项:{内容:'有线索'}}}});
 assert.equal(data.时间.年,7200);assert.equal(data.时间.日,23);
 assert.equal(data.传闻.条目['悬赏/[时间].~1"'].难度,'筑基初期-筑基后期');
 assert.equal(data.传闻.条目.缺项.难度,'待查');
 assert.deepEqual(schema.parse(data),data);
}
const variables={stat_data:Schema.parse({时间:{年:7200,月:6,日:7,时辰:'卯时'}})};
const make=(op,path,value)=>({type:op,reason:'json_patch',full_match:JSON.stringify({op,path,value}),args:op==='insert'?['wrong','wrong',JSON.stringify(value)]:['wrong',JSON.stringify(value)]});
for(const title of ['悬赏/[时间].~1"','时间','坊市[限时]','引号"与反斜杠\\','字面~1~0','a/b/c']) {
 const encoded=title.replace(/~/g,'~0').replace(/\//g,'~1');
 const entry={类别:'高额悬赏',内容:'消息',难度:'筑基初期-筑基后期'};
 const cmds=[make('insert','/传闻/条目/'+encoded,entry),make('set','/传闻/条目/'+encoded+'/内容','新消息')];
 pre(variables,cmds);assert.equal(cmds.length,2);
 assert.equal(parse(cmds[0].args[1]),title);
 assert.deepEqual(Array.from(splitPath(cmds[1].args[0])),['传闻','条目',title,'内容']);
 _.set(variables.stat_data,[...splitPath(cmds[0].args[0]),parse(cmds[0].args[1])],parse(cmds[0].args[2]));
 _.set(variables.stat_data,splitPath(cmds[1].args[0]),parse(cmds[1].args[1]));
 assert.equal(Schema.parse(variables.stat_data).传闻.条目[title].内容,'新消息');
 const del=[{type:'delete',args:['wrong'],reason:'json_patch',full_match:JSON.stringify({op:'remove',path:'/传闻/条目/'+encoded})}];
 pre(variables,del);assert.equal(del.length,1,title+'删除路径应保留');
}
const cmds=[make('set','/传闻/条目/坊市/限时/内容','消息'),make('set','/时间/月','腊月'),make('set','/时间/时辰','17点'),make('set','/时间/年','遥远未来')];
pre(variables,cmds);assert.equal(cmds.length,3);
assert.deepEqual(Array.from(splitPath(cmds[0].args[0])),['传闻','条目','坊市/限时','内容']);
assert.equal(cmds[1].args[1],12);assert.equal(parse(cmds[2].args[1]),'酉时');
const bad=[make('set','/时间',{年:'未知',月:'未知',日:'未知',时辰:'未知'})];
pre(variables,bad);assert.deepEqual(JSON.parse(JSON.stringify(bad[0].args[1])),JSON.parse(JSON.stringify(variables.stat_data.时间)));
const unsafe=[make('set','/传闻/条目/__proto__/内容','禁止')];pre(variables,unsafe);assert.equal(unsafe.length,0);assert.equal({}.内容,undefined);
console.log('PASS: frontend/runtime parity, time aliases, rumor ranges, special-title insert/update/delete, invalid time preservation, prototype guard');
