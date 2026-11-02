'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const source=fs.readFileSync(path.join(__dirname,'recorder.js'),'utf8');
const context={Blob};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('const WEBM ='),source.indexOf('// Значок «в Хаб»'))+';globalThis.fixVideo=fixVideo;globalThis.MP4=MP4;globalThis.WEBM=WEBM;',context);
const {MP4,fixVideo}=context;
const box=(type,body=[])=>Buffer.from(MP4.mk(type,body));
const concat=(...parts)=>Buffer.concat(parts);
const u32=n=>Buffer.from(MP4.u32(n));
function fixture(){
  const mvhd=Buffer.alloc(100);mvhd.writeUInt32BE(1000,12);
  const tkhd=Buffer.alloc(84);tkhd.writeUInt32BE(1,12);
  const mdhd=Buffer.alloc(24);mdhd.writeUInt32BE(1000,12);
  const trex=concat(Buffer.alloc(4),u32(1),u32(1),u32(100),u32(4),u32(0));
  const moov=box('moov',concat(box('mvhd',mvhd),box('trak',concat(box('tkhd',tkhd),box('mdia',box('mdhd',mdhd)))),box('mvex',box('trex',trex))));
  const ftyp=box('ftyp',Buffer.from('isom0000'));
  const makeMoof=offset=>box('moof',box('traf',concat(box('tfhd',concat(u32(1),u32(1),Buffer.from(MP4.u64(offset)))),box('tfdt',concat(u32(0),u32(0))),box('trun',concat(u32(0),u32(2))))));
  const moof=makeMoof(ftyp.length+moov.length+makeMoof(0).length+8);
  return concat(ftyp,moov,moof,box('mdat',Buffer.alloc(8,1)));
}
test('MP4 finalization preserves all original byte addresses and adds random-access index',async()=>{
  const input=fixture(),before=MP4.kids(input,0,input.length),output=Buffer.from(await (await fixVideo(new Blob([input],{type:'video/mp4'}),200)).arrayBuffer()),after=MP4.kids(output,0,output.length);
  const oldMoov=before.find(x=>x.type==='moov'),newMoov=after.find(x=>x.type==='moov');
  assert.equal(newMoov.size,oldMoov.size,'optional mehd must not move absolute sample offsets');
  for(const type of ['moof','mdat']){
    const a=before.find(x=>x.type===type),b=after.find(x=>x.type===type);
    assert.equal(b.p,a.p,type+' byte position');assert.deepEqual(output.subarray(b.p,b.end),input.subarray(a.p,a.end));
  }
  assert.ok(after.some(x=>x.type==='mfra'));
  const mfra=after.find(x=>x.type==='mfra'),tfra=MP4.kids(output,mfra.p+8,mfra.end).find(x=>x.type==='tfra');
  assert.equal(Number(output.readBigUInt64BE(tfra.p+32)),before.find(x=>x.type==='moof').p,'tfra addresses original moof');
});
const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
const ffmpegAvailable=spawnSync(ffmpeg,['-version'],{encoding:'utf8',windowsHide:true}).status===0;
function run(args){const r=spawnSync(ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-xerror','-threads','1','-filter_threads','1',...args],{encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:8*1024*1024});assert.equal(r.status,0,r.stderr||r.error?.message);return r.stdout;}
test('real fragmented MP4 remains decodable when seeking forward with absolute or moof-relative offsets',{skip:!ffmpegAvailable},async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'zerk-recorder-'));
  try{
    for(const relative of [false,true]){
      const original=path.join(directory,'original-'+relative+'.mp4'),fixed=path.join(directory,'fixed-'+relative+'.mp4');
      run(['-f','lavfi','-i','testsrc2=size=160x90:rate=30','-t','8','-c:v','libx264','-g','30','-keyint_min','30','-sc_threshold','0','-movflags','frag_keyframe+empty_moov'+(relative?'+default_base_moof':''),'-y',original]);
      const bytes=fs.readFileSync(original),top=MP4.kids(bytes,0,bytes.length),stream=Buffer.concat(top.filter(x=>x.type!=='mfra').map(x=>bytes.subarray(x.p,x.end)));
      const result=await fixVideo(new Blob([stream],{type:'video/mp4'}),8000);fs.writeFileSync(fixed,Buffer.from(await result.arrayBuffer()));
      for(const at of ['0','1.4','3.5','6.7','7.8']){
        const digest=file=>run(['-ss',at,'-i',file,'-frames:v','1','-f','framemd5','-']).split('\n').filter(x=>x&&!x.startsWith('#')).map(x=>x.split(',').at(-1).trim());
        const expected=digest(original);assert.equal(expected.length,1);assert.deepEqual(digest(fixed),expected,'seek '+at+', relative='+relative);
      }
    }
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('WebM finalization keeps forward seeking with video-only and audio-first live streams',{skip:!ffmpegAvailable},async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'zerk-recorder-webm-'));
  try{
    for(const audio of [false,true]){
      const original=path.join(directory,'original-'+audio+'.webm'),fixed=path.join(directory,'fixed-'+audio+'.webm');
      run([...(audio?['-f','lavfi','-i','sine=frequency=400:sample_rate=48000']:[]),'-f','lavfi','-i','testsrc2=size=160x90:rate=30','-t','8',...(audio?['-map','0:a','-map','1:v','-c:a','libopus']:[]),'-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','8','-g','30','-cluster_time_limit','500','-live','1','-y',original]);
      const result=await fixVideo(new Blob([fs.readFileSync(original)],{type:'video/webm'}),8000);fs.writeFileSync(fixed,Buffer.from(await result.arrayBuffer()));
      for(const at of ['0','1.4','3.5','6.7','7.8']){
        const digest=file=>run(['-ss',at,'-i',file,'-map','0:v','-frames:v','1','-f','framemd5','-']).split('\n').filter(x=>x&&!x.startsWith('#')).map(x=>x.split(',').at(-1).trim());
        const expected=digest(original);assert.equal(expected.length,1);assert.deepEqual(digest(fixed),expected,'seek '+at+', audio='+audio);
      }
    }
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
