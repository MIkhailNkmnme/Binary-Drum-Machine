/* Codex — независимый исследователь Хоррориуса · 12.10.2026.
   Verify a REAL downloaded laboratory archive: every word of every frame,
   independently rebuild its history and check SHA-256 after decoding Base64. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {create}=require('./horrorius-packed.cjs');
const filename=process.argv[2];if(!filename)throw Error('Pass the downloaded archive path');
const raw=fs.readFileSync(filename),a=JSON.parse(raw),p=a.meta;
if(a.format!=='horrorius-scale-archive-1'||a.frames.length!==p.steps)throw Error('Invalid archive');
const f=create(p.rows,p.steps);let words=0,hashes=0;
for(let i=0;i<p.steps;i++){
 f.next();const bytes=Buffer.from(a.frames[i],'base64');
 if(bytes.length!==f.bits.byteLength)throw Error('Incorrect frame size '+(i+1));
 for(let j=0;j<f.bits.length;j++){if(bytes.readUInt32LE(j*4)!==f.bits[j])throw Error('Bit mismatch at frame '+(i+1)+', word '+j);words++;}
 if(a.hashes){if(crypto.createHash('sha256').update(bytes).digest('hex')!==a.hashes[i])throw Error('Hash mismatch at frame '+(i+1));hashes++;}
}
const out={author:'Codex — независимый исследователь Хоррориуса',date:'2026-10-12',archiveSha256:crypto.createHash('sha256').update(raw).digest('hex'),archiveBytes:raw.length,
 rows:p.rows,frames:p.steps,comparedWords:words,comparedStoredBits:words*32,checkedHashes:hashes,mismatches:0,recordedViews:a.views.length,
 scope:'all stored words including padding match an independently rebuilt history; page kernel equivalence checked separately; screen resampling does not change these bits'};
fs.writeFileSync(path.join(__dirname,'horrorius-archive-check.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
