// Isolated preview only: no publishing, schema dumps, card writes or live sync.
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const frontend=fileURLToPath(new URL('../../tavern_helper_template-main/',import.meta.url));
process.chdir(frontend);
const require=createRequire(path.join(frontend,'package.json'));
const webpack=require('webpack');
const factories=(await import('../../tavern_helper_template-main/webpack.config.ts')).default;
const configs=factories.map(factory=>factory({}, {mode:'development'})).filter(c=>/src[\\/]自定义开局[\\/]index\.ts$/.test(String(c.entry)));
if(configs.length!==1)throw Error('Expected one custom-start entry');
for(const c of configs){c.mode='development';c.devtool=false;c.externals=[];c.output.path=fileURLToPath(new URL('./spirit-start-build/',import.meta.url));c.output.clean=false;c.plugins=c.plugins.filter(p=>!['watch_tavern_helper','schema_dump','tavern_sync'].includes(p?.apply?.name));}
const compiler=webpack(configs);
compiler.run((e,s)=>{console.log(e||s.toString({all:false,errors:true,warnings:true,timings:true}));compiler.close(()=>{process.exitCode=e||s.hasErrors()?1:0;});});
