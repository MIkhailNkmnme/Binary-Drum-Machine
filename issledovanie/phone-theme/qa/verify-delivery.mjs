import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const repo=path.resolve(import.meta.dirname,'../../..');
const commit=process.argv[2];
if(!/^[0-9a-f]{8,40}$/.test(commit||''))throw new Error('Commit required');
const git=(args)=>execFileSync('git',args,{cwd:repo,maxBuffer:80*1024*1024});
const full=git(['rev-parse',commit]).toString().trim();
const api=await fetch('https://api.github.com/repos/MIkhailNkmnme/Binary-Drum-Machine/actions/runs?per_page=12&phone='+Date.now());
if(!api.ok)throw new Error('Actions '+api.status);
const runs=(await api.json()).workflow_runs;
const deployment=runs.find(r=>r.head_sha===full&&r.conclusion==='success');
if(!deployment){console.log(JSON.stringify({pending:true,runs:runs.slice(0,3).map(r=>({sha:r.head_sha.slice(0,8),status:r.status,conclusion:r.conclusion}))}));process.exit(2);}
const paths=git(['-c','core.quotepath=false','diff-tree','--no-commit-id','--name-only','-r',full]).toString().trim().split('\n');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const rows=[];
for(let i=0;i<paths.length;i+=6){
 await Promise.all(paths.slice(i,i+6).map(async path=>{
  try{
   const r=await fetch('https://1001100.online/'+path+'?phone-release='+commit,{signal:AbortSignal.timeout(45000)});
   const body=Buffer.from(await r.arrayBuffer()),local=git(['show',full+':'+path]);
   const norm=b=>/\.(html|css|js|cjs|mjs|py|md|txt|json|svg)$/.test(path)?Buffer.from(b.toString('utf8').replaceAll('\r\n','\n')):b;
   rows.push({path,status:r.status,bytes:body.length,sha256:sha(norm(body)),match:r.ok&&sha(norm(body))===sha(norm(local))});
  }catch(e){rows.push({path,match:false,error:e.message});}
 }));
}
rows.sort((a,b)=>a.path.localeCompare(b.path));
const report={commit:full,checkedAt:new Date().toISOString(),deployment:{id:deployment.id,url:deployment.html_url,status:deployment.conclusion},files:rows.length,matched:rows.filter(r=>r.match).length,rows};
await fs.writeFile(repo+'/issledovanie/phone-theme/qa/delivery.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({commit,files:report.files,matched:report.matched,failures:rows.filter(r=>!r.match),deployment:deployment.id}));
process.exitCode=report.files===report.matched?0:1;
