'use strict';

/* ═══════════════════════════════════════════
   GM_INSTRUMENTS — Full General MIDI Map
   All 128 programs (0–127), 16 families.
   FL Studio, Ableton, Logic & all DAW compatible.
   Also includes GM Drum Kit note mapping.
   by Lukas Bohez (Oroka Conner)
   ═══════════════════════════════════════════ */

(function(){
  const families = [
    {name:'Pianos',               range:[0,7],   icon:'fa-piano-keyboard'},
    {name:'Chromatic Percussion', range:[8,15],  icon:'fa-bell'},
    {name:'Organs',               range:[16,23], icon:'fa-church'},
    {name:'Guitars',              range:[24,31], icon:'fa-guitar'},
    {name:'Basses',               range:[32,39], icon:'fa-wave-square'},
    {name:'Strings',              range:[40,47], icon:'fa-violin'},
    {name:'Ensembles',            range:[48,55], icon:'fa-users'},
    {name:'Brass',                range:[56,63], icon:'fa-trumpet'},
    {name:'Reeds',                range:[64,71], icon:'fa-record-vinyl'},
    {name:'Pipes',                range:[72,79], icon:'fa-flute'},
    {name:'Synth Leads',          range:[80,87], icon:'fa-microchip'},
    {name:'Synth Pads',           range:[88,95], icon:'fa-cloud'},
    {name:'Synth FX',             range:[96,103],icon:'fa-wand-sparkles'},
    {name:'Ethnic',               range:[104,111],icon:'fa-earth-americas'},
    {name:'Percussive',           range:[112,119],icon:'fa-drum'},
    {name:'Sound Effects',        range:[120,127],icon:'fa-volume-high'}
  ];
  const names=[
    'Acoustic Grand Piano','Bright Acoustic Piano','Electric Grand Piano','Honky-Tonk Piano','Electric Piano 1 (Rhodes)','Electric Piano 2 (Chorused)','Harpsichord','Clavinet',
    'Celesta','Glockenspiel','Music Box','Vibraphone','Marimba','Xylophone','Tubular Bells','Dulcimer',
    'Drawbar Organ (Hammond)','Percussive Organ','Rock Organ','Church Organ','Reed Organ','Accordion','Harmonica','Bandoneon (Tango Accordion)',
    'Acoustic Guitar (Nylon)','Acoustic Guitar (Steel)','Electric Guitar (Jazz)','Electric Guitar (Clean)','Electric Guitar (Muted)','Overdriven Guitar','Distortion Guitar','Guitar Harmonics',
    'Acoustic Bass','Electric Bass (Finger)','Electric Bass (Pick)','Fretless Bass','Slap Bass 1','Slap Bass 2','Synth Bass 1','Synth Bass 2',
    'Violin','Viola','Cello','Contrabass','Tremolo Strings','Pizzicato Strings','Orchestral Harp','Timpani',
    'String Ensemble 1','String Ensemble 2','Synth Strings 1','Synth Strings 2','Choir Aahs','Voice Oohs','Synth Voice','Orchestra Hit',
    'Trumpet','Trombone','Tuba','Muted Trumpet','French Horn','Brass Section','Synth Brass 1','Synth Brass 2',
    'Soprano Sax','Alto Sax','Tenor Sax','Baritone Sax','Oboe','English Horn','Bassoon','Clarinet',
    'Piccolo','Flute','Recorder','Pan Flute','Blown Bottle','Shakuhachi','Whistle','Ocarina',
    'Lead 1 (Square)','Lead 2 (Sawtooth)','Lead 3 (Calliope)','Lead 4 (Chiff)','Lead 5 (Charang)','Lead 6 (Voice)','Lead 7 (Fifths)','Lead 8 (Bass + Lead)',
    'Pad 1 (New Age / Warm Pad)','Pad 2 (Warm / Polysynth)','Pad 3 (Choir Pad / Polysynth)','Pad 4 (Bowed)','Pad 5 (Metallic)','Pad 6 (Halo)','Pad 7 (Sweep)','Pad 8 (Rain)',
    'FX 1 (Rain / Soundtrack)','FX 2 (Crystal / Soundtrack)','FX 3 (Atmosphere)','FX 4 (Brightness)','FX 5 (Goblins)','FX 6 (Echoes)','FX 7 (Sci-Fi)','Sitar',
    'Banjo','Shamisen','Koto','Bagpipe','Fiddle','Shanai','Tinkle Bell','Agogo',
    'Steel Drums','Woodblock','Taiko Drum','Melodic Tom','Synth Drum','Reverse Cymbal','Guitar Fret Noise','Breath Noise',
    'Seashore','Bird Tweet','Telephone Ring','Helicopter','Applause','Gunshot','',''
  ];

  // map program → {name, family, familyIcon}
  const map = {};
  for(let i=0;i<128;i++){
    const f=families.find(f=>i>=f.range[0]&&i<=f.range[1]);
    map[i]={name:names[i]||('Program '+i), family:f.name, familyIcon:f.icon};
  }
  window.GM_INSTRUMENTS=map;
  window.GM_FAMILIES=families;

  // ── GM Drum Kit (channel 9) ──
  window.GM_DRUM_NOTES={
    35:'Acoustic Bass Drum',36:'Bass Drum 1',37:'Side Stick',38:'Acoustic Snare',39:'Hand Clap',40:'Electric Snare',
    41:'Low Floor Tom',42:'Closed Hi-Hat',43:'High Floor Tom',44:'Pedal Hi-Hat',45:'Low Tom',46:'Open Hi-Hat',
    47:'Low-Mid Tom',48:'Hi-Mid Tom',49:'Crash Cymbal 1',50:'High Tom',51:'Ride Cymbal 1',52:'Chinese Cymbal',
    53:'Ride Bell',54:'Tambourine',55:'Splash Cymbal',56:'Cowbell',57:'Crash Cymbal 2',58:'Vibraslap',
    59:'Ride Cymbal 2',60:'Hi Bongo',61:'Low Bongo',62:'Mute Hi Conga',63:'Open Hi Conga',64:'Low Conga',
    65:'High Timbale',66:'Low Timbale',67:'High Agogo',68:'Low Agogo',69:'Cabasa',70:'Maracas',
    71:'Short Whistle',72:'Long Whistle',73:'Short Guiro',74:'Long Guiro',75:'Claves',76:'Hi Wood Block',
    77:'Low Wood Block',78:'Mute Cuica',79:'Open Cuica',80:'Mute Triangle',81:'Open Triangle'
  };

  // ── Helpers ──
  window.getInstrumentName=function(p){
    const e=map[Math.max(0,Math.min(127,Math.round(p)))];
    return e?e.name:'Program '+p;
  };
  window.getInstrumentCategory=function(p){
    const e=map[Math.max(0,Math.min(127,Math.round(p)))];
    return e?e.family:'Unknown';
  };
})();