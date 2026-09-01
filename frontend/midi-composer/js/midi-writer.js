'use strict';

/* ═══════════════════════════════════════════
   MIDI WRITER — Binary Builder, Parser,
   Watermark, Chord Detection, Expansion
   FL Studio / Ableton / Logic compatible SMF.
   by Lukas Bohez (Oroka Conner)
   ═══════════════════════════════════════════ */

// ─── CONSTANTS ──────────────────────────────────────
window.TPB = 480;
window.NN = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
window.COLORS = ['#6C63FF','#00C9A7','#F5A623','#FF6584','#2DD4A0','#60A5FA','#F472B6','#F87171','#A78BFA','#34D399'];

window.CHORD_Q = {
  '':[0,4,7],maj:[0,4,7],m:[0,3,7],min:[0,3,7],dim:[0,3,6],aug:[0,4,8],
  '7':[0,4,7,10],maj7:[0,4,7,11],m7:[0,3,7,10],mmaj7:[0,3,7,11],
  dim7:[0,3,6,9],m7b5:[0,3,6,10],hdim7:[0,3,6,10],
  '6':[0,4,7,9],m6:[0,3,7,9],
  '9':[0,4,7,10,14],maj9:[0,4,7,11,14],m9:[0,3,7,10,14],add9:[0,4,7,14],
  sus2:[0,2,7],sus4:[0,5,7],'7sus4':[0,5,7,10]
};

window.DRUM_LANES = {
  kick:{p:36,v:102},kick2:{p:35,v:100},snare:{p:38,v:96},rim:{p:37,v:80},clap:{p:39,v:90},
  hat:{p:42,v:66},hatOpen:{p:46,v:88},hatPedal:{p:44,v:60},
  tom1:{p:50,v:92},tom2:{p:47,v:90},tom3:{p:45,v:88},tom4:{p:43,v:86},
  crash:{p:49,v:104},crash2:{p:57,v:100},ride:{p:51,v:78},ride2:{p:59,v:80},
  tamb:{p:54,v:70},cowbell:{p:56,v:75},shaker:{p:70,v:65}
};

window.ROLE_PROFILE = {
  melody:{cc7:108,cc7min:95,cc7max:122,cc10:64,cc11:100,cc91:22,velTarget:88,velFloor:60,velCeil:122},
  bass:  {cc7:112,cc7min:96,cc7max:120,cc10:62,cc11:90, cc91:10,velTarget:85,velFloor:55,velCeil:118},
  chords:{cc7:56, cc7min:38,cc7max:68, cc10:64,cc11:75, cc91:38,velTarget:58,velFloor:35,velCeil:78},
  arp:   {cc7:84, cc7min:65,cc7max:98, cc10:70,cc11:80, cc91:30,velTarget:68,velFloor:40,velCeil:95},
  drums: {cc7:100,cc7min:85,cc7max:118,cc10:64,cc11:100,cc91:16,velTarget:90,velFloor:50,velCeil:127}
};

// ─── MATH HELPERS ───────────────────────────────────
const T=window.TPB;
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const TPB4=T*4;

// ─── MIDI BYTE WRITERS ──────────────────────────────
function w16(a,v){a.push((v>>8)&0xff,v&0xff);}
function w32(a,v){a.push((v>>24)&0xff,(v>>16)&0xff,(v>>8)&0xff,v&0xff);}
function wVL(a,v){
  if(v<0x80){a.push(v);return;}
  const b=[];b.push(v&0x7f);v>>=7;
  while(v>0){b.push((v&0x7f)|0x80);v>>=7;}
  for(let i=b.length-1;i>=0;i--)a.push(b[i]);
}
function wMeta(a,type,s){
  wVL(a,0);a.push(0xFF,type);
  const b=s.split('').map(c=>c.charCodeAt(0)&0x7f);
  wVL(a,b.length);a.push(...b);
}

// ─── BUILD MIDI ─────────────────────────────────────
window.buildMidi = function(tracks, bpm, tpb, copyrightName, copyrightUrl){
  tpb=tpb||T;copyrightName=copyrightName||'';copyrightUrl=copyrightUrl||'';
  const out=[];
  const us=Math.round(60000000/bpm);

  // Tempo + meta track
  const tt=[];
  wVL(tt,0);tt.push(0xFF,0x51,0x03,(us>>16)&0xff,(us>>8)&0xff,us&0xff);
  wVL(tt,0);tt.push(0xFF,0x58,0x04,4,2,24,8);
  wMeta(tt,0x03,'MIDIComposer');
  const cp='(c) '+new Date().getFullYear()+(copyrightName?' '+copyrightName:'')+(copyrightUrl?' | '+copyrightUrl:'');
  wMeta(tt,0x02,cp);
  wMeta(tt,0x01,'Created with MIDIComposer by Lukas Bohez (Oroka Conner)');
  wVL(tt,0);tt.push(0xFF,0x2F,0x00);

  // Watermark track (ch 16)
  const wt=[];
  wMeta(wt,0x03,'_MC_WM');
  wMeta(wt,0x01,'MIDIComposer by Lukas Bohez (Oroka Conner)');
  wVL(wt,0);wt.push(0x9F,108,1);
  wVL(wt,1);wt.push(0x8F,108,0);
  wVL(wt,0);wt.push(0xFF,0x2F,0x00);

  const nTracks=tracks.filter(t=>t.notes&&t.notes.length).length;
  out.push(0x4D,0x54,0x68,0x64);w32(out,6);
  w16(out,1);w16(out,nTracks+2);w16(out,tpb);

  out.push(0x4D,0x54,0x72,0x6B);w32(out,tt.length);out.push(...tt);
  out.push(0x4D,0x54,0x72,0x6B);w32(out,wt.length);out.push(...wt);

  for(const trk of tracks){
    if(!trk.notes||!trk.notes.length)continue;
    const role=trk.channel===9?'drums':(trk.role||window.detectRole(trk));
    const prof=window.ROLE_PROFILE[role]||window.ROLE_PROFILE.melody;
    const ch=(role==='drums'?9:(trk.channel||0))&0xf;
    const prog=cl(Math.round(trk.program||0),0,127);
    const isDrum=ch===9;

    const byTick=new Map();
    for(const n of trk.notes){
      const tickVal=Math.max(0,Math.round(n.tick??0));
      if(!byTick.has(tickVal))byTick.set(tickVal,[]);
      byTick.get(tickVal).push(n);
    }
    const evts=[];
    for(const[bt,grp]of byTick){
      const isC=grp.length>1;
      const srt=[...grp].sort((a,b)=>a.pitch-b.pitch);
      grp.forEach((n,gi)=>{
        let vel=cl(Math.round(n.velocity||80),1,127);
        if(isC&&srt.length>=3){
          const idx=srt.indexOf(n);
          vel=cl(Math.round(vel*(idx===0?1.0:idx===srt.length-1?0.95:0.70)),1,127);
        }
        vel=cl(vel+rnd(-6,6),1,127);
        const stag=isC?gi*4:0;
        let t0=bt+stag;
        if(!isDrum)t0=Math.max(0,t0+rnd(-4,4));
        let dur=Math.max(1,Math.round(n.durationTicks??n.dur??480));
        if(prog>=48&&prog<=54)dur=Math.max(60,dur-60);
        evts.push({t:t0,cmd:0x90|ch,p:cl(Math.round(n.pitch),0,127),v:vel});
        evts.push({t:Math.max(t0+1,t0+dur),cmd:0x80|ch,p:cl(Math.round(n.pitch),0,127),v:0});
      });
    }
    evts.sort((a,b)=>a.t!==b.t?a.t-b.t:a.cmd-b.cmd);

    const te=[];
    if(trk.name){
      const nb=[...trk.name].map(c=>c.charCodeAt(0)&0x7f);
      wVL(te,0);te.push(0xFF,0x03);wVL(te,nb.length);te.push(...nb);
    }
    wVL(te,0);te.push(0xC0|ch,prog);
    wVL(te,0);te.push(0xB0|ch,7,cl(Math.round(trk.cc7??prof.cc7),0,127));
    wVL(te,0);te.push(0xB0|ch,10,cl(Math.round(trk.cc10??prof.cc10),0,127));
    wVL(te,0);te.push(0xB0|ch,11,cl(Math.round(trk.cc11??prof.cc11),0,127));
    wVL(te,0);te.push(0xB0|ch,91,cl(Math.round(trk.cc91??prof.cc91),0,127));
    let last=0;
    for(const e of evts){wVL(te,e.t-last);te.push(e.cmd,e.p,e.v);last=e.t;}
    wVL(te,0);te.push(0xFF,0x2F,0x00);
    out.push(0x4D,0x54,0x72,0x6B);w32(out,te.length);out.push(...te);
  }
  return new Uint8Array(out);
};

// ─── DOWNLOAD ───────────────────────────────────────
window.dlMidi = function(bytes,name){
  const blob=new Blob([bytes],{type:'audio/midi'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=name;
  a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
};

// ─── WATERMARK VERIFY ───────────────────────────────
window.verifyWatermark = function(bytes){
  let pos=0;
  const r8=()=>bytes[pos++];
  const r16=()=>{const v=(bytes[pos]<<8)|bytes[pos+1];pos+=2;return v;};
  const r32=()=>{const v=(bytes[pos]<<24)|(bytes[pos+1]<<16)|(bytes[pos+2]<<8)|bytes[pos+3];pos+=4;return v>>>0;};
  const rVL=()=>{let v=0,b;while((b=r8())&0x80){v=(v<<7)|(b&0x7f);}return(v<<7)|b;};
  try{
    const hdr=String.fromCharCode(bytes[0],bytes[1],bytes[2],bytes[3]);
    if(hdr!=='MThd')return{found:false,reason:'Not a valid MIDI file'};
    r32();r16();const nTrk=r16();r16();
    for(let t=0;t<nTrk;t++){
      const tHdr=String.fromCharCode(bytes[pos],bytes[pos+1],bytes[pos+2],bytes[pos+3]);
      if(tHdr!=='MTrk')return{found:false,reason:'Bad track header'};
      pos+=4;const tlen=r32(),end=pos+tlen;
      let tname='',texts=[];
      while(pos<end){
        const d=rVL();let st=r8();
        if(st===0xFF){
          const mt=r8(),ml=rVL();
          const s=Array.from(bytes.subarray(pos,pos+ml)).map(b=>String.fromCharCode(b)).join('');
          pos+=ml;
          if(mt===0x03)tname=s;
          if(mt===0x01)texts.push(s);
          if(mt===0x2F)break;
        }else{
          if((st&0xF0)===0x90||(st&0xF0)===0x80||(st&0xF0)===0xB0||(st&0xF0)===0xE0||(st&0xF0)===0xA0){r8();r8();}
          else if((st&0xF0)===0xC0||(st&0xF0)===0xD0){r8();}
        }
      }
      pos=end;
      if(tname==='_MC_WM'&&texts.some(tx=>tx.includes('MIDIComposer by Lukas Bohez')))
        return{found:true,trackName:tname};
    }
    return{found:false,reason:'No watermark found — not created with MIDIComposer'};
  }catch(e){return{found:false,reason:'Could not read file: '+e.message};}
};

// ─── MIDI PARSER ────────────────────────────────────
window.parseMidiFile = function(bytes){
  let pos=0;
  const r8=()=>bytes[pos++];
  const r16=()=>{const v=(bytes[pos]<<8)|bytes[pos+1];pos+=2;return v;};
  const r32=()=>{const v=(bytes[pos]<<24)|(bytes[pos+1]<<16)|(bytes[pos+2]<<8)|bytes[pos+3];pos+=4;return v>>>0;};
  const rVL=()=>{let v=0,b;while((b=r8())&0x80){v=(v<<7)|(b&0x7f);}return(v<<7)|b;};
  const rStr=n=>{const s=[];for(let i=0;i<n;i++)s.push(String.fromCharCode(bytes[pos++]));return s.join('');};
  if(rStr(4)!=='MThd')throw new Error('Not a MIDI file');
  const hLen=r32();r16();const nTrk=r16(),tpb=r16();
  if(tpb>=0x8000)throw new Error('SMPTE timing not supported');
  if(hLen>6)pos+=hLen-6;
  const tracks=[];let globalBpm=120;
  for(let t=0;t<nTrk;t++){
    if(rStr(4)!=='MTrk')throw new Error('Bad chunk at track '+t);
    const tlen=r32(),end=pos+tlen;
    let tick=0,rs=0,prog=0,ch=0,tname='',gotN=false;
    const notes=[],active=new Map();
    while(pos<end){
      const d=rVL();tick+=d;let st=r8();if(st<0x80){pos--;st=rs;}else rs=st;
      const mt=st&0xF0,c=st&0x0F;
      if(st===0xFF){
        const mt2=r8(),ml=rVL(),md=bytes.subarray(pos,pos+ml);pos+=ml;
        if(mt2===0x03&&!gotN){tname=String.fromCharCode(...md).replace(/\0/g,'').trim();gotN=true;}
        else if(mt2===0x51&&ml>=3){const us_=(md[0]<<16)|(md[1]<<8)|md[2];if(tick===0)globalBpm=Math.round(60000000/us_);}
        else if(mt2===0x2F)break;
      }else if(mt===0x90){
        const p=r8(),v=r8();const k=c+'_'+p;
        if(v>0){if(!active.has(k))active.set(k,[]);active.get(k).push({tick,pitch:p,velocity:v,channel:c});}
        else if(active.has(k)&&active.get(k).length){
          const n=active.get(k).shift();
          notes.push({tick:n.tick,dur:tick-n.tick,pitch:n.pitch,velocity:n.velocity,channel:n.channel});
          if(!active.get(k).length)active.delete(k);
        }
      }else if(mt===0x80){
        const p=r8();r8();const k=c+'_'+p;
        if(active.has(k)&&active.get(k).length){
          const n=active.get(k).shift();
          notes.push({tick:n.tick,dur:tick-n.tick,pitch:n.pitch,velocity:n.velocity,channel:n.channel});
          if(!active.get(k).length)active.delete(k);
        }
      }else if(mt===0xC0){prog=r8();ch=c;}
      else if(mt===0xB0||mt===0xE0){r8();r8();}else r8();
    }
    for(const[,arr]of active)
      for(const n of arr)
        notes.push({tick:n.tick,dur:Math.max(1,tick-n.tick),pitch:n.pitch,velocity:n.velocity,channel:n.channel});
    if(notes.length>0&&tname!=='_MC_WM')
      tracks.push({name:tname||(window.getInstrumentName(prog)+(ch===9?' (Drums)':'')),notes,program:prog,channel:ch,index:tracks.length});
    pos=end;
  }
  return{tpb,tracks,bpm:globalBpm};
};

// ─── CHORD DETECTION ────────────────────────────────
window.detectChords = function(notes, tpb){
  tpb=tpb||T;
  if(!notes||!notes.length)return[];
  const bar=tpb*4,bars={};
  for(const n of notes){const b=Math.floor(n.tick/bar);if(!bars[b])bars[b]=new Set();bars[b].add(n.pitch%12);}
  const tmpl=[{name:'',i:[0,4,7]},{name:'m',i:[0,3,7]},{name:'dim',i:[0,3,6]},{name:'7',i:[0,4,7,10]},{name:'m7',i:[0,3,7,10]},{name:'maj7',i:[0,4,7,11]},{name:'sus2',i:[0,2,7]},{name:'sus4',i:[0,5,7]}];
  const res=[];
  for(const[b,pcs]of Object.entries(bars)){
    let best=null,bs=-1;
    for(let r=0;r<12;r++){
      for(const t of tmpl){
        const cp=new Set(t.i.map(i=>(r+i)%12));
        let sc=0;for(const p of pcs)if(cp.has(p))sc+=2;for(const p of cp)if(pcs.has(p))sc+=1;
        if(sc>bs){bs=sc;best={root:r,name:t.name};}
      }
    }
    res.push({bar:parseInt(b),chord:best?window.NN[best.root]+best.name:'?',root:best?best.root:-1});
  }
  return res.sort((a,b)=>a.bar-b.bar);
};

// ─── ROLE DETECTION ─────────────────────────────────
window.detectRole = function(t){
  const valid=['melody','chords','bass','arp','drums'];
  if(t&&t.role&&valid.includes(String(t.role).toLowerCase()))return String(t.role).toLowerCase();
  const s=((t&&t.name)||'').toLowerCase();
  if(s.includes('drum')||s.includes('perc'))return'drums';
  if(s.includes('bass')||s.includes('sub'))return'bass';
  if(s.includes('chord')||s.includes('pad')||s.includes('string')||s.includes('harm'))return'chords';
  if(s.includes('arp')||s.includes('texture'))return'arp';
  return'melody';
};

// ─── CHORD VOICING ──────────────────────────────────
function noteToPc(l){return {C:0,D:2,E:4,F:5,G:7,A:9,B:11}[l.toUpperCase()];}
function parseNoteSpec(spec,defOct=3){
  if(typeof spec==='number')return cl(Math.round(spec),0,127);
  const s=String(spec).trim();
  const m=/^([A-Ga-g])([#b]?)(-?\d+)?$/.exec(s);
  if(!m)return 60;
  const pc=noteToPc(m[1])+(m[2]==='#'?1:m[2]==='b'?-1:0);
  const oct=m[3]!=null?parseInt(m[3],10):defOct;
  return cl(pc+(oct+1)*12,0,127);
}
window.voiceChord = function(c){
  const tick=Math.max(0,Math.round(c.t??c.tick??0));
  const dur=Math.max(1,Math.round(c.d??c.dur??1920));
  const baseVel=cl(Math.round(c.v??c.velocity??55),1,127);
  const ivs=window.CHORD_Q[String(c.quality??'maj').toLowerCase()]||window.CHORD_Q.maj;
  const root=parseNoteSpec(c.root,c.octave??3);
  const pitches=ivs.map(iv=>cl(root+iv,0,127));
  const voicing=String(c.voicing||'pad').toLowerCase();
  const step=c.step?Math.max(20,Math.round(c.step)):T/2;
  const notes=[];
  if(voicing==='pad'||voicing==='block'){
    pitches.forEach((p,i)=>notes.push({tick,dur,pitch:p,velocity:cl(Math.round(baseVel-(i===0?0:i*2)+rnd(-3,3)),1,127)}));
  }else if(voicing==='roll'||voicing==='strum'){
    pitches.forEach((p,i)=>notes.push({tick:tick+i*18,dur:Math.max(1,dur-i*18),pitch:p,velocity:cl(Math.round(baseVel-i*2+rnd(-3,3)),1,127)}));
  }else if(voicing==='broken'||voicing==='arp'||voicing==='arpup'){
    let tt=tick,i=0;
    while(tt<tick+dur){const p=pitches[i%pitches.length];notes.push({tick:tt,dur:Math.min(step,tick+dur-tt),pitch:p,velocity:cl(Math.round(baseVel+rnd(-4,4)),1,127)});tt+=step;i++;}
  }else if(voicing==='alberti'){
    const order=[0,Math.min(2,pitches.length-1),1%pitches.length,Math.min(2,pitches.length-1)];
    let tt=tick,i=0;
    while(tt<tick+dur){const p=pitches[order[i%order.length]];notes.push({tick:tt,dur:Math.min(step,tick+dur-tt),pitch:p,velocity:cl(Math.round(baseVel+rnd(-4,4)),1,127)});tt+=step;i++;}
  }else{pitches.forEach(p=>notes.push({tick,dur,pitch:p,velocity:baseVel}));}
  return notes;
};

// ─── DRUM GRID EXPANSION ────────────────────────────
window.expandDrumGrid = function(dg){
  const notes=[];if(!dg)return notes;
  const step=dg.stepTicks||(T/4);
  const patterns=dg.patterns||{},events=dg.events||[];
  for(const ev of events){
    try{
      const rawPat=patterns[ev.pattern||ev.name];if(!rawPat)continue;
      const pat=rawPat.lanes||rawPat;
      const lens=Object.values(pat).map(s=>String(s).length);
      const lenSteps=Math.max(1,...lens);
      const spanTicks=ev.every||lenSteps*step;
      const reps=Math.max(1,Math.round(ev.repeat||1));
      for(let r=0;r<reps;r++){
        const baseTick=(ev.at||0)+r*spanTicks;
        for(const lane in pat){
          const def=window.DRUM_LANES[lane];if(!def)continue;
          const str=String(pat[lane]);
          for(let s=0;s<str.length;s++){
            const ch=str[s];if(ch==='.'||ch===' ')continue;
            let vel=def.v;
            if(ch==='X')vel+=18;else if(ch==='o')vel-=28;
            notes.push({tick:baseTick+s*step,dur:Math.max(30,Math.round(step*0.9)),pitch:def.p,velocity:cl(Math.round(vel+rnd(-4,4)),1,127)});
          }
        }
      }
    }catch(e){}
  }
  return notes;
};

// ─── PATTERN EVENT EXPANSION ────────────────────────
function patternSpan(notes){return Math.max(1,...notes.map(n=>(n.t??n.tick??0)+(n.d??n.dur??0)));}
window.expandPatternEvents = function(t){
  const notes=[];const pats=t.patterns||{},evs=t.events||t.plays||[];
  for(const ev of evs){
    try{
      const pat=pats[ev.pattern||ev.name];if(!pat||!pat.notes)continue;
      const span=ev.every||patternSpan(pat.notes);
      const reps=Math.max(1,Math.round(ev.repeat||1));
      for(let r=0;r<reps;r++){
        const off=(ev.at||0)+r*span,transp=(ev.transpose||0)+(ev.transposeStep||0)*r;
        const frac=reps>1?r/(reps-1):0;
        const velMul=ev.velocityFade!=null?(1+(ev.velocityFade-1)*frac):1;
        for(const n of pat.notes){
          notes.push({tick:off+(n.t??n.tick??0),dur:Math.max(1,n.d??n.dur??240),pitch:cl(Math.round((n.p??n.pitch??60)+transp),0,127),velocity:cl(Math.round((n.v??n.velocity??80)*velMul),1,127)});
        }
      }
    }catch(e){}
  }
  return notes;
};

// ─── FULL TRACK EXPANSION ───────────────────────────
window.expandTrack = function(t){
  let notes=[];
  try{if(t.patterns&&(t.events||t.plays))notes=notes.concat(window.expandPatternEvents(t));}catch(e){}
  try{if(t.chords||t.progression)for(const c of(t.chords||t.progression)){try{notes=notes.concat(window.voiceChord(c));}catch(e){}}}catch(e){}
  try{const dg=t.drumGrid||t.drumPattern;if(dg)notes=notes.concat(window.expandDrumGrid(dg));}catch(e){}
  try{if(t.notes)for(const n of t.notes)notes.push({tick:Math.max(0,Math.round(n.tick??n.t??0)),dur:Math.max(1,Math.round(n.durationTicks??n.dur??n.d??480)),pitch:cl(Math.round(n.pitch??n.p??60),0,127),velocity:cl(Math.round(n.velocity??n.v??80),1,127)});}catch(e){}
  return notes;
};

// ─── FORMAT HELPERS (used by app.js) ────────────────
window.fmtTime = s=>{const m=Math.floor(s/60),ss=String(s%60).padStart(2,'0');return m+':'+ss;};
window.s2bars = (sec,bpm)=>Math.max(2,Math.round((sec*bpm/60/4)/2)*2);