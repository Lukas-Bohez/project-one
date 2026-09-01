'use strict';
/* ═══════════════════════════════════════════════
   PRESETS — 19 Styles, 57 Intensities
   Each intensity has unique instrument programs.
   FL Studio / DAW compatible GM programs.
   by Lukas Bohez (Oroka Conner)
   ═══════════════════════════════════════════════ */
window.PRESETS=[
  // 1 ANIME ROMANCE ──────────────────────────────────
  {id:'anime-romance',ac:'ac-teal',icon:'fa-solid fa-heart',name:'Anime Romance',tag:'Warm emotional OST',genre:'city-pop',
   intensities:[
    {label:'Calm',icon:'fa-leaf',bpm:76,energy:3,mood:'romantic',swing:20,qa:55,i:{melody:1,chords:1,bass:1,arp:1,drums:0,extra:0},extra:'Soft piano lead, warm string pads, gentle harp arpeggios, no percussion.',promptHint:'Calm tender slice-of-life anime — peaceful.',progs:{melody:0,chords:48,bass:32,arp:46,extra:0}},
    {label:'Normal',icon:'fa-star',bpm:92,energy:5,mood:'uplifting',swing:22,qa:60,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Light groove, melodic piano/synth lead, warm strings, subtle drums.',promptHint:'Uplifting anime romantic background.',progs:{melody:4,chords:48,bass:33,arp:8,extra:0}},
    {label:'Intense',icon:'fa-bolt',bpm:115,energy:8,mood:'epic',swing:14,qa:70,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Driving rhythm, bold piano, full drums, cinematic strings swell.',promptHint:'Emotionally powerful confession scene.',progs:{melody:1,chords:48,bass:33,arp:46,extra:40}}]},
  // 2 ANIME ACTION ───────────────────────────────────
  {id:'anime-action',ac:'ac-rose',icon:'fa-solid fa-burst',name:'Anime Action',tag:'Fight & chase scenes',genre:'anime',
   intensities:[
    {label:'Tension',icon:'fa-shield',bpm:95,energy:4,mood:'intense',swing:10,qa:75,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Suspenseful — strings ostinato, sparse percussion, low brass.',promptHint:'Tense buildup before action.',progs:{melody:40,chords:49,bass:42,arp:48,extra:42}},
    {label:'Battle',icon:'fa-shield-halved',bpm:140,energy:7,mood:'intense',swing:8,qa:80,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Driving action — fast strings, punchy brass, steady drums.',promptHint:'Mid-battle action — powerful and relentless.',progs:{melody:56,chords:48,bass:39,arp:47,extra:57}},
    {label:'Climax',icon:'fa-fire',bpm:168,energy:10,mood:'epic',swing:5,qa:85,i:{melody:1,chords:1,bass:1,arp:0,drums:1,extra:0},extra:'Full epic battle — orchestra, brass fanfare, heavy timpani.',promptHint:'Final boss climax — maximum energy.',progs:{melody:56,chords:52,bass:43,arp:0,extra:58}}]},
  // 3 LOFI STUDY ─────────────────────────────────────
  {id:'lofi-study',ac:'ac-blue',icon:'fa-solid fa-mug-hot',name:'Lo-fi Study',tag:'Chill focus beats',genre:'lofi',
   intensities:[
    {label:'Ambient',icon:'fa-cloud',bpm:65,energy:2,mood:'chill',swing:40,qa:40,i:{melody:1,chords:1,bass:1,arp:0,drums:1,extra:0},extra:'Almost ambient — soft jazz piano, warm bass, gentle brushed drums.',promptHint:'Almost-ambient lo-fi on a rainy day.',progs:{melody:4,chords:88,bass:32,arp:0,extra:0}},
    {label:'Classic',icon:'fa-headphones',bpm:82,energy:4,mood:'chill',swing:50,qa:45,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Classic lo-fi hip-hop — swinging drums, warm piano, walking bass.',promptHint:'Classic lo-fi study beat — comfortable.',progs:{melody:0,chords:88,bass:33,arp:11,extra:0}},
    {label:'Groove',icon:'fa-compact-disc',bpm:98,energy:6,mood:'playful',swing:45,qa:55,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Energetic lo-fi — busier melody, active bass, more drum movement.',promptHint:'Energetic lo-fi — productive flow state.',progs:{melody:5,chords:89,bass:35,arp:46,extra:0}}]},
  // 4 CINEMATIC ──────────────────────────────────────
  {id:'cinematic',ac:'ac-ind',icon:'fa-solid fa-film',name:'Cinematic',tag:'Drama & film score',genre:'orchestral',
   intensities:[
    {label:'Sad',icon:'fa-cloud-rain',bpm:58,energy:2,mood:'melancholy',swing:10,qa:50,i:{melody:1,chords:1,bass:0,arp:1,drums:0,extra:0},extra:'Deeply melancholy — solo piano, sparse strings.',promptHint:'Deeply sad cinematic moment.',progs:{melody:0,chords:49,bass:0,arp:47,extra:0}},
    {label:'Tense',icon:'fa-triangle-exclamation',bpm:80,energy:5,mood:'dark',swing:5,qa:65,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Dark suspense — low strings, sparse melody, ominous bass.',promptHint:'Dark suspense — something is wrong.',progs:{melody:42,chords:49,bass:43,arp:88,extra:0}},
    {label:'Epic',icon:'fa-crown',bpm:108,energy:9,mood:'epic',swing:5,qa:78,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Full cinematic epic — grand orchestra, brass, choir, heavy timpani.',promptHint:'Full epic orchestral — massive and triumphant.',progs:{melody:56,chords:52,bass:43,arp:47,extra:58}}]},
  // 5 J-POP ──────────────────────────────────────────
  {id:'jpop',ac:'ac-pink',icon:'fa-solid fa-star',name:'J-Pop',tag:'Japanese pop',genre:'jpop',
   intensities:[
    {label:'Soft',icon:'fa-dove',bpm:78,energy:3,mood:'romantic',swing:15,qa:55,i:{melody:1,chords:1,bass:1,arp:1,drums:0,extra:0},extra:'Soft J-Pop ballad — no drums, warm piano, soft strings.',promptHint:'Soft J-Pop ballad — gentle and warm.',progs:{melody:0,chords:48,bass:33,arp:8,extra:0}},
    {label:'Pop',icon:'fa-music',bpm:130,energy:6,mood:'uplifting',swing:18,qa:62,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Classic J-Pop — bright synth/piano, catchy and energetic.',promptHint:'Classic upbeat J-Pop — catchy, bright.',progs:{melody:1,chords:89,bass:39,arp:80,extra:0}},
    {label:'Hype',icon:'fa-rocket',bpm:158,energy:9,mood:'uplifting',swing:10,qa:75,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'High-energy anime OP — fast, soaring melody.',promptHint:'Anime opening banger.',progs:{melody:81,chords:88,bass:38,arp:80,extra:82}}]},
  // 6 RPG / FANTASY ─────────────────────────────────
  {id:'rpg',ac:'ac-amber',icon:'fa-solid fa-dragon',name:'RPG / Fantasy',tag:'Game background music',genre:'game',
   intensities:[
    {label:'Town',icon:'fa-house',bpm:80,energy:3,mood:'playful',swing:20,qa:55,i:{melody:1,chords:1,bass:1,arp:1,drums:0,extra:0},extra:'Cozy RPG town — acoustic, warm, gentle flute, no drums.',promptHint:'Cozy RPG town theme.',progs:{melody:24,chords:48,bass:32,arp:46,extra:73}},
    {label:'Field',icon:'fa-mountain',bpm:100,energy:5,mood:'uplifting',swing:25,qa:60,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'RPG overworld — adventurous, lively, light percussion.',promptHint:'RPG overworld — exploring a vast world.',progs:{melody:73,chords:48,bass:33,arp:11,extra:75}},
    {label:'Boss',icon:'fa-skull',bpm:145,energy:9,mood:'intense',swing:8,qa:80,i:{melody:1,chords:1,bass:1,arp:0,drums:1,extra:0},extra:'RPG boss battle — heavy orchestra, fast strings, hard drums.',promptHint:'Epic RPG boss fight.',progs:{melody:56,chords:52,bass:42,arp:0,extra:58}}]},
  // 7 SYNTHWAVE ─────────────────────────────────────
  {id:'synthwave',ac:'ac-ind',icon:'fa-solid fa-robot',name:'Synthwave',tag:'Retro 80s electronic',genre:'synthwave',
   intensities:[
    {label:'Chill',icon:'fa-moon',bpm:88,energy:3,mood:'melancholy',swing:10,qa:65,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Dreamy synthwave — distant pads, slow arp, mellow bass.',promptHint:'Dreamy midnight synthwave.',progs:{melody:88,chords:89,bass:38,arp:80,extra:0}},
    {label:'Drive',icon:'fa-car',bpm:120,energy:6,mood:'intense',swing:8,qa:72,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Classic driving synthwave — pulsing arp, saw lead, punchy bass.',promptHint:'Classic retrowave — 80s action movie.',progs:{melody:81,chords:88,bass:39,arp:80,extra:82}},
    {label:'Hyper',icon:'fa-bolt',bpm:148,energy:9,mood:'epic',swing:5,qa:80,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'High-energy outrun — fast arp, distorted bass, intense leads.',promptHint:'Outrun/cyberpunk — maximum energy.',progs:{melody:81,chords:89,bass:39,arp:80,extra:87}}]},
  // 8 LOUNGE / JAZZ ─────────────────────────────────
  {id:'lounge',ac:'ac-green',icon:'fa-solid fa-wine-glass',name:'Lounge / Jazz',tag:'Sophisticated ambiance',genre:'jazz',
   intensities:[
    {label:'Mellow',icon:'fa-wind',bpm:68,energy:2,mood:'chill',swing:55,qa:40,i:{melody:1,chords:1,bass:1,arp:0,drums:1,extra:0},extra:'Very mellow — brushed jazz drums, warm piano comping.',promptHint:'Late-night mellow jazz.',progs:{melody:0,chords:88,bass:32,arp:0,extra:0}},
    {label:'Smooth',icon:'fa-glass-water',bpm:88,energy:4,mood:'romantic',swing:60,qa:45,i:{melody:1,chords:1,bass:1,arp:0,drums:1,extra:0},extra:'Smooth jazz — alto sax/vibes, rich piano voicings, walking bass.',promptHint:'Smooth jazz lounge — warm and sophisticated.',progs:{melody:65,chords:48,bass:33,arp:0,extra:11}},
    {label:'Lively',icon:'fa-music',bpm:138,energy:7,mood:'playful',swing:65,qa:50,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Lively jazz — faster swing, energetic melody, driving bass and drums.',promptHint:'Lively jazz club — people on their feet.',progs:{melody:56,chords:48,bass:33,arp:11,extra:65}}]},
  // 9 CHIPTUNE / KEYGEN ─────────────────────────────
  {id:'chiptune',ac:'ac-green',icon:'fa-solid fa-gamepad',name:'Chiptune / Keygen',tag:'Retro 8-bit tracker music',genre:'chiptune',
   intensities:[
    {label:'Minimal',icon:'fa-microchip',bpm:125,energy:5,mood:'playful',swing:0,qa:80,i:{melody:1,chords:0,bass:1,arp:1,drums:0,extra:0},extra:'Sparse chiptune — square lead, simple bass pulse, basic arp, no drums.',promptHint:'Minimal chiptune — classic keygen feel.',progs:{melody:80,chords:0,bass:38,arp:80,extra:0}},
    {label:'Classic',icon:'fa-keyboard',bpm:140,energy:7,mood:'uplifting',swing:5,qa:85,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Tracker chiptune — square/saw lead, chord stabs, walking bass, tight drums.',promptHint:'Classic chiptune — Amiga MOD tracker style.',progs:{melody:80,chords:81,bass:38,arp:82,extra:0}},
    {label:'Banger',icon:'fa-bolt',bpm:160,energy:9,mood:'epic',swing:2,qa:90,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'High-energy chiptune — fast arps, punchy drums, soaring leads.',promptHint:'Banger chiptune — demoscene winning entry.',progs:{melody:81,chords:80,bass:39,arp:82,extra:87}}]},
  // 10 FOLK / ACOUSTIC ──────────────────────────────
  {id:'folk-acoustic',ac:'ac-amber',icon:'fa-solid fa-tree',name:'Folk / Acoustic',tag:'Simple organic warmth',genre:'folk',
   intensities:[
    {label:'Quiet',icon:'fa-feather',bpm:72,energy:2,mood:'melancholy',swing:30,qa:40,i:{melody:1,chords:1,bass:1,arp:1,drums:0,extra:0},extra:'Gentle folk — acoustic guitar, simple warm chords, no drums.',promptHint:'Quiet folk — sitting by a fire with an acoustic guitar.',progs:{melody:24,chords:48,bass:32,arp:46,extra:0}},
    {label:'Brisk',icon:'fa-leaf',bpm:96,energy:4,mood:'uplifting',swing:28,qa:48,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Brisk folk — acoustic guitar, accordion textures, light percussion.',promptHint:'Brisk folk — walking song through a countryside path.',progs:{melody:25,chords:21,bass:33,arp:46,extra:73}},
    {label:'Joyful',icon:'fa-sun',bpm:116,energy:6,mood:'playful',swing:35,qa:52,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Joyful folk — full ensemble, violin/flute, accordion, lively bass.',promptHint:'Joyful folk celebration — village festival.',progs:{melody:40,chords:21,bass:33,arp:46,extra:73}}]},
  // 11 MINIMAL AMBIENT ──────────────────────────────
  {id:'ambient-minimal',ac:'ac-teal',icon:'fa-solid fa-water',name:'Minimal Ambient',tag:'Sparse soundscapes',genre:'ambient',
   intensities:[
    {label:'Drone',icon:'fa-wave-square',bpm:50,energy:1,mood:'melancholy',swing:15,qa:25,i:{melody:1,chords:1,bass:0,arp:1,drums:0,extra:0},extra:'Ultra-minimal — single sustained pad, slow evolution, no rhythm.',promptHint:'Drone ambient — meditative and sparse.',progs:{melody:88,chords:92,bass:0,arp:8,extra:0}},
    {label:'Liquid',icon:'fa-droplet',bpm:65,energy:2,mood:'chill',swing:25,qa:30,i:{melody:1,chords:1,bass:1,arp:1,drums:0,extra:0},extra:'Liquid ambient — gentle piano/celesta, soft pad wash, no percussion.',promptHint:'Liquid ambient — gentle and flowing.',progs:{melody:8,chords:88,bass:32,arp:46,extra:0}},
    {label:'Bloom',icon:'fa-seedling',bpm:78,energy:3,mood:'uplifting',swing:30,qa:35,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Evolving ambient — slow build, warm pads, gentle pulse.',promptHint:'Ambient bloom — soundscape slowly opens up.',progs:{melody:88,chords:89,bass:32,arp:46,extra:0}}]},
  // 12 ORCHESTRAL CLASSICAL ─────────────────────────
  {id:'orchestral-classical',ac:'ac-ind',icon:'fa-solid fa-feather',name:'Orchestral Classical',tag:'Traditional orchestra',genre:'classical',
   intensities:[
    {label:'Adagio',icon:'fa-moon',bpm:60,energy:2,mood:'melancholy',swing:5,qa:45,i:{melody:1,chords:1,bass:1,arp:1,drums:0,extra:0},extra:'Slow adagio — string melody, woodwind harmonies, contrabass, harp.',promptHint:'Classical adagio — slow and graceful.',progs:{melody:40,chords:48,bass:43,arp:46,extra:68}},
    {label:'Andante',icon:'fa-sun',bpm:96,energy:5,mood:'uplifting',swing:8,qa:55,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Walking-tempo classical — full orchestra, brass, strings, timpani.',promptHint:'Andante — elegant, full orchestra.',progs:{melody:40,chords:48,bass:43,arp:46,extra:56}},
    {label:'Allegro',icon:'fa-bolt',bpm:144,energy:8,mood:'epic',swing:3,qa:70,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Fast allegro — rapid strings, brass fanfare, driving timpani.',promptHint:'Allegro — fast and triumphant.',progs:{melody:40,chords:52,bass:43,arp:47,extra:56}}]},
  // 13 HIP-HOP / TRAP ───────────────────────────────
  {id:'hiphop-trap',ac:'ac-rose',icon:'fa-solid fa-fire',name:'Hip-Hop / Trap',tag:'Beats & 808s',genre:'hiphop',
   intensities:[
    {label:'Laidback',icon:'fa-mug-hot',bpm:70,energy:3,mood:'chill',swing:30,qa:50,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Laidback hip-hop — sparse drums, deep 808, simple pad melody.',promptHint:'Laidback hip-hop beat — relaxed.',progs:{melody:0,chords:88,bass:38,arp:80,extra:0}},
    {label:'Bounce',icon:'fa-music',bpm:92,energy:6,mood:'playful',swing:25,qa:65,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:1},extra:'Bouncy hip-hop — punchy kick, crisp snare, hi-hat rolls, synth melody.',promptHint:'Hip-hop bounce — club-ready.',progs:{melody:80,chords:88,bass:38,arp:81,extra:56}},
    {label:'Hard',icon:'fa-skull',bpm:140,energy:9,mood:'intense',swing:15,qa:80,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Hard trap — aggressive 808s, fast hi-hats, dark synth leads.',promptHint:'Hard trap — aggressive, dark.',progs:{melody:81,chords:88,bass:39,arp:80,extra:0}}]},
  // 14 EDM ──────────────────────────────────────────
  {id:'edm',ac:'ac-blue',icon:'fa-solid fa-bolt',name:'EDM',tag:'Electronic dance music',genre:'edm',
   intensities:[
    {label:'Deep',icon:'fa-water',bpm:120,energy:4,mood:'dark',swing:5,qa:70,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Deep house/techno — four-on-the-floor, deep bass, atmospheric pads.',promptHint:'Deep EDM — dark warehouse vibe.',progs:{melody:88,chords:89,bass:39,arp:80,extra:0}},
    {label:'Peak',icon:'fa-star',bpm:128,energy:7,mood:'uplifting',swing:3,qa:78,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Peak-time EDM — big builds, synth stabs, driving energy.',promptHint:'Peak-time EDM — festival main stage.',progs:{melody:81,chords:88,bass:38,arp:80,extra:82}},
    {label:'Drop',icon:'fa-fire',bpm:150,energy:10,mood:'epic',swing:2,qa:85,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Hard EDM drop — distorted bass, rapid synths, maximum impact.',promptHint:'EDM drop — the peak of the night.',progs:{melody:81,chords:89,bass:39,arp:80,extra:87}}]},
  // 15 REGGAE / DUB ─────────────────────────────────
  {id:'reggae-dub',ac:'ac-green',icon:'fa-solid fa-sun',name:'Reggae / Dub',tag:'Offbeat rhythms',genre:'reggae',
   intensities:[
    {label:'OneDrop',icon:'fa-leaf',bpm:72,energy:3,mood:'chill',swing:40,qa:40,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Classic reggae — offbeat guitar/synth chords, deep bass, relaxed drums.',promptHint:'One-drop reggae — relaxed island feel.',progs:{melody:24,chords:26,bass:33,arp:11,extra:0}},
    {label:'Steppers',icon:'fa-shoe-prints',bpm:85,energy:5,mood:'uplifting',swing:35,qa:45,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Reggae steppers — driving kick, offbeat chords, melodic bass.',promptHint:'Steppers reggae — uplifting and steady.',progs:{melody:25,chords:26,bass:33,arp:46,extra:0}},
    {label:'Dub',icon:'fa-wand-sparkles',bpm:68,energy:3,mood:'dark',swing:45,qa:38,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Dub — heavy reverb/delay, sparse, deep bass, spacey FX, echo drums.',promptHint:'Dub reggae — heavy reverb and delay.',progs:{melody:88,chords:89,bass:35,arp:92,extra:0}}]},
  // 16 METAL ────────────────────────────────────────
  {id:'metal',ac:'ac-red',icon:'fa-solid fa-skull',name:'Metal',tag:'Heavy guitar riffs',genre:'metal',
   intensities:[
    {label:'Doom',icon:'fa-cloud',bpm:60,energy:4,mood:'dark',swing:5,qa:55,i:{melody:1,chords:1,bass:1,arp:0,drums:1,extra:0},extra:'Doom metal — slow, heavy, low-tuned guitar, massive drums.',promptHint:'Doom metal — slow and crushing.',progs:{melody:28,chords:26,bass:35,arp:0,extra:0}},
    {label:'Thrash',icon:'fa-bolt',bpm:170,energy:8,mood:'intense',swing:3,qa:75,i:{melody:1,chords:1,bass:1,arp:0,drums:1,extra:0},extra:'Thrash metal — fast palm-muted riffs, double bass, shredding leads.',promptHint:'Thrash metal — fast and aggressive.',progs:{melody:29,chords:31,bass:34,arp:0,extra:0}},
    {label:'Death',icon:'fa-fire',bpm:200,energy:10,mood:'intense',swing:2,qa:85,i:{melody:1,chords:1,bass:1,arp:0,drums:1,extra:0},extra:'Death metal — extreme speed, blast beats, low-tuned guitars.',promptHint:'Death metal — extreme intensity.',progs:{melody:30,chords:31,bass:34,arp:0,extra:0}}]},
  // 17 FUNK & DISCO ─────────────────────────────────
  {id:'funk',ac:'ac-amber',icon:'fa-solid fa-music',name:'Funk & Disco',tag:'Groove-based rhythms',genre:'funk',
   intensities:[
    {label:'Groove',icon:'fa-compact-disc',bpm:80,energy:5,mood:'playful',swing:35,qa:45,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Deep funk groove — syncopated bass, tight drums, wah-guitar, horn stabs.',promptHint:'Deep funk groove — get in the pocket.',progs:{melody:26,chords:21,bass:33,arp:80,extra:56}},
    {label:'Slap',icon:'fa-hand-back-fist',bpm:105,energy:7,mood:'playful',swing:30,qa:55,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:1},extra:'Slap funk — slap bass, rhythmic guitar, punchy horns, party feel.',promptHint:'Slap funk — getting the party started.',progs:{melody:56,chords:26,bass:34,arp:46,extra:57}},
    {label:'Party',icon:'fa-champagne-glasses',bpm:120,energy:8,mood:'uplifting',swing:25,qa:60,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:1},extra:'Disco party — four-on-the-floor, strings, brass stabs, funky bass.',promptHint:'Disco party — peak nightclub energy.',progs:{melody:60,chords:48,bass:36,arp:46,extra:56}}]},
  // 18 LATIN ────────────────────────────────────────
  {id:'latin',ac:'ac-pink',icon:'fa-solid fa-music',name:'Latin',tag:'Latin American rhythms',genre:'latin',
   intensities:[
    {label:'Bossanova',icon:'fa-martini-glass',bpm:88,energy:3,mood:'romantic',swing:40,qa:42,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Bossanova — nylon guitar, soft samba, gentle bass, warm and romantic.',promptHint:'Bossanova — beach sunset.',progs:{melody:24,chords:48,bass:32,arp:11,extra:0}},
    {label:'Salsa',icon:'fa-fire',bpm:100,energy:7,mood:'uplifting',swing:50,qa:50,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:1},extra:'Salsa — piano montuno, Latin percussion, brass section, driving bass.',promptHint:'Salsa — people dancing.',progs:{melody:0,chords:26,bass:33,arp:46,extra:56}},
    {label:'Mariachi',icon:'fa-guitar',bpm:126,energy:6,mood:'playful',swing:35,qa:55,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:1},extra:'Mariachi — trumpets, guitars, violin, lively, festive.',promptHint:'Mariachi — festive and celebratory.',progs:{melody:56,chords:25,bass:32,arp:46,extra:40}}]},
  // 19 BLUES ────────────────────────────────────────
  {id:'blues',ac:'ac-blue',icon:'fa-solid fa-guitar',name:'Blues',tag:'Soulful guitar traditions',genre:'blues',
   intensities:[
    {label:'Delta',icon:'fa-water',bpm:60,energy:3,mood:'melancholy',swing:55,qa:35,i:{melody:1,chords:1,bass:1,arp:1,drums:0,extra:0},extra:'Delta blues — solo acoustic, slide feel, raw and emotional, no drums.',promptHint:'Delta blues — alone on a porch.',progs:{melody:25,chords:24,bass:32,arp:46,extra:0}},
    {label:'Chicago',icon:'fa-city',bpm:85,energy:5,mood:'playful',swing:50,qa:45,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Chicago blues — electric guitar, harmonica, piano, shuffle drums.',promptHint:'Chicago blues — smoky club shuffle.',progs:{melody:26,chords:16,bass:33,arp:17,extra:0}},
    {label:'Rock',icon:'fa-bolt',bpm:120,energy:7,mood:'uplifting',swing:40,qa:55,i:{melody:1,chords:1,bass:1,arp:1,drums:1,extra:0},extra:'Blues rock — overdriven guitar, powerful drums, driving bass.',promptHint:'Blues rock — overdriven guitar, gritty.',progs:{melody:29,chords:28,bass:33,arp:16,extra:0}}]}
];
Object.freeze(window.PRESETS);