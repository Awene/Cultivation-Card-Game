// GitHub release operations; credentials stay in memory and are never logged.
import {execFileSync} from 'node:child_process';
const [method='GET',path='',body]=process.argv.slice(2);
if(!path.startsWith('/repos/Awene/'))throw Error('Repository scope required');
const raw=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'},stdio:['pipe','pipe','pipe']});
const credential=Object.fromEntries(raw.trim().split('\n').map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
const response=await fetch('https://api.github.com'+path,{method,headers:{Authorization:'Bearer '+credential.password,Accept:'application/vnd.github+json','Content-Type':'application/json'},...(body?{body}: {})});
const text=await response.text();
if(!response.ok)throw Error('GitHub HTTP '+response.status+' '+text);
console.log(text||JSON.stringify({status:response.status}));
