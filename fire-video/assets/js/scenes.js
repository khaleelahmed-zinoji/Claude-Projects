/* Scene choreography for "How Humans 'Invented' Fire".
 * One scene per storyboard row; each visual state is keyed to the word the narrator
 * is saying (cue()), so the doodles land on the voiceover rather than on a fixed grid. */
(function () {
  const D = window.Doodle;
  const { C, R, G, el, draw, show, hide, pop, move, slideIn, flicker, pulse, blink, write, glow } = D;
  const T = window.FIRE_TIMING;
  let tl;

  // ------------------------------------------------------------- cues ---
  function weights(text) {
    return Array.from(text).map((ch) =>
      /[\p{L}\p{N}]/u.test(ch) ? 1 : ",:;—".includes(ch) ? 3 : ch === " " ? 0.4 : 0.2,
    );
  }
  function charTime(s, pos) {
    const w = weights(s.text);
    const total = w.reduce((a, b) => a + b, 0);
    const part = w.slice(0, pos).reduce((a, b) => a + b, 0);
    return s.start + (part / total) * (s.end - s.start);
  }
  /** Time at which `phrase` starts being spoken (first occurrence at or after `after`). */
  let sceneFloor = 0;
  function cue(phrase, after = 0) {
    after = Math.max(after, sceneFloor);
    for (const s of T.sentences) {
      if (s.end < after) continue;
      let idx = s.text.indexOf(phrase);
      while (idx >= 0) {
        const t = charTime(s, idx);
        if (t >= after - 0.01) return t;
        idx = s.text.indexOf(phrase, idx + 1);
      }
    }
    throw new Error("cue not found: " + phrase);
  }
  function cueEnd(phrase, after = 0) {
    after = Math.max(after, sceneFloor);
    for (const s of T.sentences) {
      if (s.end < after) continue;
      const idx = s.text.indexOf(phrase);
      if (idx >= 0) {
        const t = charTime(s, idx + phrase.length);
        if (t >= after - 0.01) return t;
      }
    }
    throw new Error("cue not found: " + phrase);
  }

  const LAST_ROW = T.scenes[T.scenes.length - 1].row;
  function scene(row) {
    const sc = T.scenes.find((s) => s.row === row);
    const svg = document.querySelector(`#scene-${row} svg`);
    const root = el("g", { class: "cam" }, svg);
    const { start, end } = sc;
    sceneFloor = start - 0.5;
    tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: row === 1 ? 1.0 : 0.5, ease: "power1.out" }, start);
    if (row === LAST_ROW) tl.to(root, { opacity: 0, duration: 1.6, ease: "power1.inOut" }, end - 1.8);
    else tl.to(root, { opacity: 0, duration: 0.55, ease: "power1.in" }, end);
    tl.fromTo(root, { scale: 1 }, { scale: 1.035, svgOrigin: "960 460", duration: end - start + 0.6, ease: "none" }, start);
    return { root, start, end, until: end + 0.6 };
  }

  function flash(parent, t, strength = 0.75) {
    const f = el("rect", { x: -100, y: -100, width: 2120, height: 1280, fill: "#fff7e2", opacity: 0 }, parent);
    tl.to(f, { opacity: strength, duration: 0.06, ease: "none" }, t);
    tl.to(f, { opacity: 0, duration: 0.5, ease: "power2.out" }, t + 0.08);
    return f;
  }
  function burning(parent, x, y, s, t, until) {
    const f = D.flame(parent, x, y, s);
    pop(f.g, t, 0.5, "50% 100%");
    flicker(f.flame, t, until);
    if (f.glow) pulse(f.glow, t + 0.5, until, 0.4, 0.7);
    return f;
  }
  function vignette(parent, cx, cy, strength = 0.85) {
    const id = D.nextId("vig");
    const defs = el("defs", null, parent);
    const rg = el("radialGradient", { id, cx, cy, r: 900, gradientUnits: "userSpaceOnUse" }, defs);
    el("stop", { offset: "0%", "stop-color": C.char, "stop-opacity": 0 }, rg);
    el("stop", { offset: "22%", "stop-color": C.char, "stop-opacity": 0.15 }, rg);
    el("stop", { offset: "70%", "stop-color": C.char, "stop-opacity": strength }, rg);
    el("stop", { offset: "100%", "stop-color": C.char, "stop-opacity": strength }, rg);
    return el("rect", { x: -100, y: -100, width: 2120, height: 1280, fill: `url(#${id})` }, parent);
  }
  function smallLabel(parent, text, x, y, t, o = {}) {
    const w = write(parent, text, x, y, Object.assign({ size: 44, font: "Kalam", color: C.charSoft }, o));
    w.reveal(t, o.dur || 0.6);
    return w;
  }

  // ---------------------------------------------------------- scenes ---
  function row1() {
    const s = scene(1);
    const r = s.root;
    const sky = R.rect(r, -60, -60, 2040, 860, { stroke: "none", fill: C.ash, fillStyle: "cross-hatch", hachureGap: 17, fillWeight: 1.3, roughness: 1.6 });
    show(sky, s.start, 1.4, 0.5);
    const ground = R.line(r, -20, 772, 1940, 764, { strokeWidth: 4 });
    const trees = [
      D.pine(r, 150, 772, 1.2), D.pine(r, 330, 776, 0.9), D.pine(r, 1560, 770, 1.1), D.pine(r, 1740, 772, 1.35), D.pine(r, 850, 776, 0.7),
    ];
    const big = D.tree(r, 1160, 770, 1.3, { leafFill: C.charSoft });
    draw([ground, ...trees], s.start + 0.2, 2.2);
    draw(big, s.start + 0.6, 2.2);

    const tBolt = cue("lightning");
    const b = D.bolt(r, 1060, -40, 1150, 300);
    draw(b, tBolt - 0.05, 0.22, "none");
    flash(r, tBolt);
    tl.to(b, { opacity: 0, duration: 0.8 }, tBolt + 1.6);
    const tCrack = cue("The sky cracks");
    const b2 = D.bolt(r, 1420, -40, 1330, 250, { w: 7 });
    draw(b2, tCrack, 0.2, "none");
    flash(r, tCrack + 0.05, 0.55);
    tl.to(b2, { opacity: 0, duration: 0.6 }, tCrack + 0.9);

    const tGlow = cue("The branches glow");
    burning(r, 1080, 470, 0.55, tGlow, s.until);
    burning(r, 1250, 420, 0.7, tGlow + 0.3, s.until);
    burning(r, 1160, 340, 0.85, tGlow + 0.6, s.until);

    const tRun = cue("Animals run");
    const d1 = D.deer(r, 820, 770, 0.9);
    const d2 = D.deer(r, 620, 778, 0.7);
    draw([d1, d2], tRun - 0.2, 0.7);
    move(d1, tRun + 0.4, { x: -1100 }, 3.2, "power2.in");
    move(d2, tRun + 0.6, { x: -1100 }, 3.0, "power2.in");
    const birds = [D.bird(r, 1120, 260, 1.1), D.bird(r, 1190, 230, 0.8), D.bird(r, 1060, 220, 0.9)];
    draw(birds, tRun, 0.4);
    move(birds, tRun + 0.2, { x: -700, y: -260 }, 3.4, "power1.in");

    const tMid = cue("And in the middle");
    const hero = D.person(r, 360, 772, 1.55, { wide: true, mouth: "o", tunic: C.ochre });
    draw(hero.g, tMid, 1.2);
    blink(hero.eyes, cue("but useful"));
    blink(hero.eyes, cue("quite like us"));
    const tFire = cue("Fire.");
    const title = write(r, "FIRE", 620, 300, { size: 190, color: C.ember, underline: C.char });
    title.reveal(tFire - 0.1, 0.8);
  }

  function row2() {
    const s = scene(2);
    const r = s.root;
    const head = el("g", null, r);
    const inv = write(head, "INVENTED?", 960, 400, { size: 170, color: C.char, underline: C.ember });
    inv.reveal(s.start + 0.3, 1.0);
    const tGenius = cue("prehistoric genius");
    move(head, tGenius - 0.4, { y: -230, scale: 0.55, svgOrigin: "960 400" }, 0.9);

    const cliche = el("g", null, r);
    const caveman = D.person(cliche, 820, 790, 1.5, { pose: "rub", mouth: "smile" });
    const board = R.poly(cliche, [[840, 790], [1100, 780], [1104, 800], [842, 808]], { fill: C.ochre, fillStyle: "solid", strokeWidth: 3 });
    const stick = el("g", null, cliche);
    R.line(stick, 905, 660, 990, 792, { strokeWidth: 7, stroke: C.charSoft });
    draw([caveman.g, board, stick], tGenius, 1.1);
    const tRub = cue("rubbed");
    tl.to(stick, { x: 16, duration: 0.12, yoyo: true, repeat: 11, ease: "sine.inOut" }, tRub);
    const puffs = [D.smokePuff(cliche, 1010, 760, 0.5), D.smokePuff(cliche, 1060, 720, 0.4)];
    puffs.forEach((p, i) => show(p, tRub + 0.3 + i * 0.3, 0.4));
    const tShout = cue("“I’ve got it!”");
    const bubble = D.speechBubble(cliche, 1260, 520, "I've got it!", { w: 340 });
    pop(bubble, tShout - 0.1, 0.4, "0% 100%");
    const x = D.xMark(r, 960, 620, 1.35);
    const tX = cue("Instead") - 0.55;
    draw(x, tX, 0.45, "power2.out");

    const tStages = cue("developed in stages");
    hide([cliche, x, head], tStages - 0.2, 0.5);
    const line = R.line(r, 170, 560, 1740, 560, { strokeWidth: 5 });
    const arrow = R.lines(r, [[1710, 536], [1752, 560], [1710, 584]], { strokeWidth: 5 });
    draw([line, arrow], tStages + 0.1, 1.1);
    [390, 770, 1150, 1530].forEach((tx) => draw(R.line(r, tx, 544, tx, 576, { strokeWidth: 4 }), tStages + 0.6, 0.3));

    // four stage icons
    const icons = [];
    const eye = el("g", null, r);
    R.path(eye, "M270,440 C320,380 460,380 510,440 C460,500 320,500 270,440 Z", { strokeWidth: 3.6, fill: C.parch, fillStyle: "solid" });
    R.circle(eye, 390, 440, 70, { strokeWidth: 3 });
    const eyeFlame = D.flame(eye, 390, 462, 0.32, { glow: false });
    icons.push(eye);
    const carry = D.branch(r, 650, 500, 0.9, { fire: 0.5, len: 220 });
    icons.push(carry.g);
    const control = D.campfire(r, 1150, 500, 0.62, { stones: true, flame: 0.9 });
    icons.push(control.g);
    const make = el("g", null, r);
    D.flint(make, 1470, 470, 0.9);
    D.pyrite(make, 1600, 470, 0.9);
    const sparks = el("g", null, make);
    [[-40, -50], [-10, -70], [30, -60], [50, -30]].forEach(([dx, dy]) => R.line(sparks, 1535, 440, 1535 + dx, 440 + dy, { stroke: C.ember, strokeWidth: 4 }));
    icons.push(make);
    const words = ["FIND", "CARRY", "CONTROL", "MAKE"];
    const cues = [cue("finding"), cue("carrying"), cue("controlling"), cue("making it on demand")];
    icons.forEach((ic, i) => {
      draw(ic, cues[i] - 0.1, 0.8);
      write(r, words[i], [390, 770, 1150, 1530][i], 650, { size: 60, color: i === 3 ? C.ember : C.char }).reveal(cues[i] + 0.2, 0.5);
    });
    flicker(eyeFlame.flame, cues[0], s.until);
    flicker(carry.fire.flame, cues[1], s.until);
    flicker(control.fire.flame, cues[2], s.until);
    tl.fromTo(sparks, { opacity: 0 }, { opacity: 1, duration: 0.1, yoyo: true, repeat: 7, ease: "none" }, cues[3] + 0.6);
  }

  function row3() {
    const s = scene(3);
    const r = s.root;
    const land = D.hills(r, 700);
    const tufts = [[240, 738], [470, 742], [1010, 736], [1210, 740], [1720, 732]].map(([x, y]) => D.grass(r, x, y, 1));
    draw([land, ...tufts], s.start + 0.1, 1.6);

    const tV = cue("volcanoes");
    const v = D.volcano(r, 1530, 712, 1.1);
    draw(v, tV - 0.2, 1.0);
    [0, 0.5, 1.0].forEach((d, i) => {
      const p = D.smokePuff(r, 1530 + i * 30, 440 - i * 10, 0.9 + i * 0.25);
      show(p, tV + 0.6 + d, 0.5);
      move(p, tV + 0.6 + d, { y: -180 - i * 40, x: 60 }, 5, "power1.out");
      hide(p, tV + 4 + d, 1.2);
    });

    const tW = cue("wildfires");
    const b = D.bolt(r, 780, -40, 760, 660);
    draw(b, tW, 0.22, "none");
    flash(r, tW, 0.6);
    tl.to(b, { opacity: 0, duration: 0.6 }, tW + 1.0);
    [[700, 732, 0.5], [770, 736, 0.75], [850, 734, 0.55], [920, 738, 0.4]].forEach(([x, y, sc], i) => burning(r, x, y, sc, tW + 0.2 + i * 0.18, s.until));
    const br = D.branch(r, 960, 738, 0.75, { fire: 0.45, len: 200 });
    draw(br.g, tW + 0.9, 0.6);
    flicker(br.fire.flame, tW + 0.9, s.until);

    const tA = cue("Early human ancestors");
    const walker = D.person(r, 190, 740, 1.2, { pose: "walk" });
    slideIn(walker.g, tA, -240, 0, 1.6);
    const tCook = cue("gathering cooked plants");
    const ash = R.path(r, "M250,742 C270,700 390,690 440,742 Z", { fill: C.ash, hachureGap: 5, strokeWidth: 3 });
    const tub = D.tuber(r, 350, 712, 0.8);
    draw([ash, tub.g], tCook - 0.2, 0.8);
    tl.fromTo(tub.steam, { y: 0 }, { y: -18, duration: 1.2, yoyo: true, repeat: 3, ease: "sine.inOut" }, tCook + 0.6);
    const tBranch = cue("collecting a burning branch");
    hide(walker.g, tBranch - 0.3, 0.4);
    const h = D.hand(r, 800, 620, 0.8);
    slideIn(h, tBranch - 0.1, -500, 0, 1.3);
    move(h, tBranch + 1.3, { x: 90, y: 30 }, 0.8);
  }

  function row4() {
    const s = scene(4);
    const r = s.root;
    const f = D.face(r, 960, 420, 1.35);
    pop(f.g, s.start + 0.1, 0.5);
    tl.to(f.pupils, { x: 6, duration: 0.12, yoyo: true, repeat: 5, ease: "none" }, s.start + 0.6);
    tl.fromTo(f.sweat, { y: 0 }, { y: 30, duration: 0.9, ease: "power1.in" }, s.start + 0.8);
    const tStep = cue("did not require");
    hide(f.g, tStep - 0.1, 0.35);
    const p = D.person(r, 700, 780, 1.6, { pose: "wary", wide: true, mouth: "worry" });
    draw(p.g, tStep, 0.7);
    const prints = [[560, 800], [640, 790]].map(([x, y]) => R.ellipse(r, x, y, 40, 16, { fill: C.charSoft, hachureGap: 4, strokeWidth: 2 }));
    draw(prints, tStep + 0.3, 0.4);
    const tHold = cue("making fire");
    const br = D.branch(r, 845, 548, 1, { len: 240, fire: 0.42 });
    draw(br.g, tHold - 0.25, 0.5);
    flicker(br.fire.flame, tHold, s.until);
    const tDark = cue("It required");
    const vig = vignette(r, 1085, 440, 0.88);
    show(vig, tDark - 0.3, 0.6);
    const lab = write(r, "FIRST: APPROACH IT", 960, 190, { size: 96, color: C.emberHi });
    lab.text.setAttribute("stroke", C.char);
    lab.text.setAttribute("stroke-width", "5");
    lab.text.setAttribute("paint-order", "stroke");
    lab.reveal(cue("overcoming fear") - 0.1, 0.8);
    blink(p.eyes, tDark + 0.4);
  }

  function row5() {
    const s = scene(5);
    const r = s.root;
    const cf = D.campfire(r, 960, 700, 1.2, { flame: 0.7 });
    draw(cf.g, s.start + 0.1, 0.9);
    flicker(cf.fire.flame, s.start, s.until);
    const tH = cue("A flame is hungry");
    const faceG = el("g", null, cf.fire.flame);
    el("circle", { cx: -14, cy: -52, r: 5, fill: C.char }, faceG);
    el("circle", { cx: 14, cy: -52, r: 5, fill: C.char }, faceG);
    const mouth = R.ellipse(faceG, 0, -26, 30, 18, { fill: C.char, fillStyle: "solid", strokeWidth: 2 });
    show(faceG, tH, 0.3);
    gsap.set(mouth, { transformOrigin: "50% 50%" });
    tl.to(mouth, { scaleY: 0.2, duration: 0.18, yoyo: true, repeat: 5, ease: "sine.inOut" }, tH + 0.4);
    move(cf.fire.g, tH, { scale: 1.25, transformOrigin: "50% 100%" }, 0.6);

    const tGrass = cue("dry grass");
    const hay = el("g", null, r);
    [[0, 0], [30, -10], [-20, -6]].forEach(([dx, dy]) => D.grass(hay, 520 + dx, 700 + dy, 1.4, C.ochre));
    R.line(hay, 480, 702, 600, 698, { strokeWidth: 5, stroke: C.ochre });
    slideIn(hay, tGrass - 0.2, -300, 0, 0.8);
    move(hay, tGrass + 0.8, { x: 380, opacity: 0 }, 0.9, "power1.in");
    move(cf.fire.g, tGrass + 1.5, { scale: 1.6 }, 0.6, "back.out(1.4)");

    const tO = cue("oxygen");
    const wind = [440, 520, 600].map((y, i) => D.wavy(r, 200, y - 60, 480 - i * 60, { color: C.ash, amp: 12, w: 3.4 }));
    draw(wind, tO - 0.2, 0.7);
    move(wind, tO + 0.5, { x: 260, opacity: 0 }, 1.6, "power1.in");
    move(cf.fire.g, tO + 0.2, { skewX: 16, transformOrigin: "50% 100%" }, 0.5);
    move(cf.fire.g, tO + 1.6, { skewX: 0 }, 0.6);

    const tAtt = cue("constant attention");
    const p1 = D.person(r, 640, 790, 1.35, { pose: "shield", mouth: "worry" });
    const p2 = D.person(r, 1290, 790, 1.35, { pose: "shield", flip: true, mouth: "worry" });
    const p3 = D.person(r, 1480, 790, 1.1, { pose: "sit", flip: true, mouth: "worry" });
    draw([p1.g, p2.g], tAtt - 0.3, 0.8);
    draw(p3.g, tAtt + 0.3, 0.6);
    blink([p1.eyes, p2.eyes], tAtt + 1.2);
  }

  function row6() {
    const s = scene(6);
    const r = s.root;
    const cf = D.campfire(r, 960, 720, 1.1, { flame: 1.1 });
    draw(cf.g, s.start, 0.6);
    flicker(cf.fire.flame, s.start, s.until);
    const cl = D.cloud(r, 980, 210, 1.3);
    slideIn(cl, s.start + 0.2, 700, 0, 1.6);
    const tRain = cue("one rainstorm");
    const rn = D.rain(r, 760, 280, 440, 280, 26, 5);
    show(rn, tRain - 0.1, 0.3);
    tl.fromTo(rn, { y: -30 }, { y: 30, duration: 0.35, repeat: 8, ease: "none" }, tRain - 0.1);
    const tLose = cue("could lose it");
    move(cf.fire.g, tLose - 0.5, { scale: 0.18, transformOrigin: "50% 100%" }, 1.0, "power2.in");
    const coal = glow(r, 960, 700, 60, C.ember, 0);
    tl.to(coal, { opacity: 0.9, duration: 0.6 }, tLose + 0.2);

    const tCarry = cue("carrying a smouldering branch");
    hide([cl, rn, cf.g, coal], tCarry - 0.4, 0.5);
    const campL = el("g", null, r);
    R.poly(campL, [[160, 760], [260, 600], [360, 760]], { fill: C.ochre, hachureGap: 8, strokeWidth: 3.4 });
    const campR = el("g", null, r);
    R.poly(campR, [[1560, 760], [1660, 600], [1760, 760]], { fill: C.ochre, hachureGap: 8, strokeWidth: 3.4 });
    const path = R.curve(r, [[360, 790], [700, 810], [1100, 780], [1540, 790]], { strokeWidth: 3, stroke: C.ash });
    draw([campL, campR, path], tCarry - 0.2, 1.0);
    const walker = D.person(r, 420, 780, 1.1, { pose: "carry" });
    const br = D.branch(walker.g, 66, -150, 0.7, { ember: true, len: 120 });
    show(walker.g, tCarry + 0.1, 0.4);
    move(walker.g, tCarry + 0.1, { x: 1000 }, 4.0, "none");
    tl.to(walker.g, { y: -8, duration: 0.25, yoyo: true, repeat: 15, ease: "sine.inOut" }, tCarry + 0.1);

    const tWrap = cue("wrapping an ember");
    const bun = D.bundle(r, 960, 400, 1.2);
    const peek = glow(r, 960, 380, 70, C.ember, 0.8);
    draw(bun, tWrap - 0.1, 0.8);
    show(peek, tWrap + 0.5, 0.6, 0.85);
    pulse(peek, tWrap + 1.1, s.until, 0.5, 0.9, 0.7);

    const tFeed = cue("feeding a precious hearth");
    hide(walker.g, tFeed - 0.6, 0.4);
    const nh = D.flame(r, 1660, 800, 0.9);
    pop(nh.g, tFeed, 0.9, "50% 100%");
    flicker(nh.flame, tFeed, s.until);
    const sitters = [D.person(r, 1470, 810, 0.95, { pose: "sitReach", mouth: "smile" }), D.person(r, 1840, 810, 0.95, { pose: "sitReach", flip: true, mouth: "smile" })];
    draw(sitters.map((p) => p.g), tFeed + 0.3, 0.7);
  }

  function row7() {
    const s = scene(7);
    const r = s.root;
    const soil = [
      R.rect(r, 260, 700, 1400, 50, { fill: C.ochreLight, hachureGap: 12, strokeWidth: 3 }),
      R.rect(r, 260, 750, 1400, 40, { fill: C.ash, hachureGap: 8, strokeWidth: 3 }),
      R.rect(r, 260, 790, 1400, 50, { fill: C.ochre, hachureGap: 10, strokeWidth: 3, hachureAngle: 30 }),
    ];
    draw(soil, s.start, 0.9);
    const arch = D.person(r, 560, 700, 1.4, { pose: "crouch" });
    const hat = el("g", null, arch.g);
    R.path(hat, "M-10,-148 C-8,-176 34,-178 38,-148 Z", { fill: C.ochre, fillStyle: "solid", strokeWidth: 3 });
    R.line(hat, -24, -148, 54, -148, { strokeWidth: 4 });
    const brush = R.rect(arch.armR, 58, -78, 44, 12, { fill: C.charSoft, fillStyle: "solid", strokeWidth: 2 });
    draw(arch.g, s.start + 0.2, 1.0);
    gsap.set(arch.armR, { transformOrigin: "12px -102px" });
    tl.to(arch.armR, { rotation: -8, duration: 0.2, yoyo: true, repeat: 9, ease: "sine.inOut" }, s.start + 1.0);

    const tAsh = cue("Fire destroys");
    const flakes = D.particles(r, 22, [720, 650, 180, 60], 21, (g, x, y, rnd) => R.ellipse(g, x, y, 8 + rnd() * 10, 5 + rnd() * 5, { fill: C.ash, fillStyle: "solid", stroke: "none" }));
    show(flakes.g, tAsh - 0.2, 0.3);
    flakes.items.forEach((f, i) => {
      move(f, tAsh + (i % 6) * 0.08, { x: 300 + flakes.rnd() * 500, y: -150 - flakes.rnd() * 300, opacity: 0 }, 2.0, "power1.out");
    });

    const tSplit = cue("natural burning");
    hide([arch.g, ...soil], tSplit - 0.3, 0.45);
    const div = R.line(r, 960, 150, 960, 820, { strokeWidth: 4, stroke: C.charSoft });
    draw(div, tSplit, 0.5);
    const left = el("g", null, r);
    [D.pine(left, 340, 760, 0.9), D.pine(left, 560, 770, 1.1), D.tree(left, 460, 770, 0.8, { leaves: false })];
    draw(left, tSplit + 0.1, 0.9);
    [[330, 640, 0.6], [470, 560, 0.8], [580, 620, 0.7]].forEach(([x, y, sc], i) => burning(r, x, y, sc, tSplit + 0.5 + i * 0.12, s.until));
    const hearth = D.campfire(r, 1440, 740, 1.1, { stones: true, flame: 1 });
    draw(hearth.g, tSplit + 0.3, 0.9);
    flicker(hearth.fire.flame, tSplit + 0.3, s.until);
    smallLabel(r, "wildfire?", 480, 220, tSplit + 0.8);
    smallLabel(r, "hearth?", 1440, 220, tSplit + 1.0);

    const tQ = cue("surprisingly similar");
    const q1 = write(r, "?", 480, 470, { size: 240, color: C.ember });
    const q2 = write(r, "?", 1440, 470, { size: 240, color: C.ember });
    q1.reveal(tQ, 0.4);
    q2.reveal(tQ + 0.25, 0.4);
    const tMag = cue("human-made hearth");
    const mg = D.magnifier(r, 1120, 560, 1.3);
    slideIn(mg, tMag, 500, 300, 1.0);
    move(mg, tMag + 1.0, { x: -40, y: -20 }, 1.4, "sine.inOut");
  }

  function row8() {
    const s = scene(8);
    const r = s.root;
    const X0 = 300, W = 1320;
    const bands = [
      [210, 110, C.ochreLight, 12, -30],
      [320, 90, C.ash, 6, -45],
      [410, 130, C.ochre, 10, 30],
      [540, 120, C.ashLight, 8, -60],
      [660, 150, C.ochre, 9, 45],
    ];
    const layers = bands.map(([y, h, fill, gap, ang]) => R.rect(r, X0, y, W, h, { fill, hachureGap: gap, hachureAngle: ang, strokeWidth: 3 }));
    draw(layers, s.start + 0.1, 1.5);
    const tAsh = cue("ash deep inside caves");
    const ashTag = smallLabel(r, "ASH", 1690, 380, tAsh, { color: C.ember, size: 46 });
    const ashRing = R.rect(r, X0 - 8, 314, W + 16, 102, { stroke: C.ember, strokeWidth: 5, roughness: 1.5 });
    draw(ashRing, tAsh, 0.6);
    hide(ashRing, tAsh + 2.2, 0.5);

    const tBone = cue("burned bones");
    const bn = D.bone(r, 560, 480, 0.75, { burnt: true });
    pop(bn, tBone - 0.1, 0.5);
    const tTool = cue("stone tools");
    const ax = D.handaxe(r, 820, 470, 0.75);
    pop(ax, tTool - 0.1, 0.5);
    const tCl = cue("clusters of heated objects");
    const cl = D.particles(r, 9, [1030, 440, 160, 70], 8, (g, x, y) => R.ellipse(g, x, y, 34, 24, { fill: C.ember, hachureGap: 5, strokeWidth: 2.6 }));
    draw(cl.g, tCl - 0.1, 0.8);
    const ring = R.ellipse(r, 1110, 478, 260, 150, { stroke: C.char, strokeWidth: 3, roughness: 2 });
    draw(ring, tCl + 0.5, 0.6);
    const tRep = cue("burned repeatedly");
    [260, 470, 730].forEach((y, i) => {
      const lens = R.ellipse(r, 1440, y, 190, 40, { fill: C.ember, hachureGap: 5, strokeWidth: 3 });
      draw(lens, tRep - 0.4 + i * 0.35, 0.5);
    });
    const arr = R.curve(r, [[1580, 730], [1620, 500], [1580, 260]], { strokeWidth: 4 });
    const head = R.lines(r, [[1560, 290], [1580, 255], [1605, 288]], { strokeWidth: 4 });
    draw([arr, head], tRep + 0.8, 0.7);
    hide(ashTag.g, tRep - 0.6, 0.3);
    smallLabel(r, "again & again", 1720, 520, tRep + 1.1, { color: C.char, size: 40 });
  }

  // ------------------------------------------------ evidence timeline ---
  function evidenceTimeline() {
    const g = el("g", null, document.querySelector("#timeline-band svg"));
    const a = T.scenes.find((s) => s.row === 9).start;
    const b = T.scenes.find((s) => s.row === 17).start;
    sceneFloor = a - 0.5;
    const X = (mya) => 260 + ((2.0 - mya) / 2.0) * 1400;
    const Y = 118;
    tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: 0.6 }, a);
    tl.to(g, { opacity: 0, duration: 0.6 }, b - 0.2);
    const base = R.line(g, X(2.0), Y, X(0) + 10, Y, { strokeWidth: 4 });
    const ticks = [2.0, 1.5, 1.0, 0.5, 0].map((m) => R.line(g, X(m), Y - 12, X(m), Y + 12, { strokeWidth: 3 }));
    draw([base, ...ticks], a + 0.2, 1.0);
    const labs = [
      ["2 million yrs ago", 2.0, "start"], ["1.5M", 1.5, "middle"], ["1M", 1.0, "middle"], ["500K", 0.5, "middle"], ["today", 0, "end"],
    ];
    labs.forEach(([t, m, anc]) => {
      const w = write(g, t, X(m), Y + 44, { size: 26, font: "Kalam", color: C.charSoft, anchor: anc });
      w.reveal(a + 0.6, 0.5);
    });
    const cursor = el("g", null, g);
    R.poly(cursor, [[-14, -34], [14, -34], [0, -12]], { fill: C.ember, fillStyle: "solid", strokeWidth: 2.4 });
    gsap.set(cursor, { x: X(2.0), y: Y });
    show(cursor, a + 0.8, 0.4);
    function mark(mya, t, label, dx = 0) {
      move(cursor, t - 0.3, { x: X(mya) }, 0.8);
      const dot = R.circle(g, X(mya), Y, 18, { fill: C.ember, fillStyle: "solid", strokeWidth: 2.4 });
      pop(dot, t + 0.3, 0.4);
      if (label) write(g, label, X(mya) + dx, Y - 44, { size: 30, color: C.ember }).reveal(t + 0.4, 0.5);
    }
    const tRange = cue("recurrent fire use");
    move(cursor, tRange - 0.4, { x: X(1.8) }, 0.7);
    const bar = R.rect(g, X(1.8), Y - 10, X(1.1) - X(1.8), 20, { fill: C.ember, hachureGap: 5, stroke: C.ember, strokeWidth: 2 });
    draw(bar, tRange + 0.2, 1.4);
    write(g, "1.8–1.1 MYA", (X(1.8) + X(1.1)) / 2, Y - 44, { size: 30, color: C.ember }).reveal(tRange + 0.8, 0.5);
    mark(1.0, cue("one million"), "~1M", 0);
    mark(0.79, T.scenes.find((s) => s.row === 12).start + 0.3, "790K", 22);
    const tRace = T.scenes.find((s) => s.row === 14).start;
    mark(0.4, tRace + 0.2, "400K");
    mark(0.05, cue("Around 50,000"), "50K", -10);
  }

  function row9() {
    const s = scene(9);
    const r = s.root;
    const P = D.proj(17, 1, 8.3, 560, 520);
    const af = D.land(r, D.MAPS.AFRICA, P);
    const md = D.land(r, D.MAPS.MADAGASCAR, P);
    draw([af, md], s.start + 0.05, 1.3);
    const tSA = cue("South Africa");
    const [px, py] = P(23.6, -27.8);
    const pn = D.pin(r, px, py, 0.9);
    pop(pn, tSA - 0.1, 0.4, "50% 100%");
    const tFound = cue("researchers found");
    const trav = D.travel(r, [[px + 20, py - 60], [900, 560], [1080, 520]]);
    draw(trav, tFound - 0.4, 0.6);
    const cave = el("g", null, r);
    R.path(cave, "M1060,800 C1060,560 1180,330 1400,300 C1600,280 1760,420 1790,800 Z", { fill: C.ash, hachureGap: 9, strokeWidth: 4 });
    R.path(cave, "M1080,700 C1110,610 1170,600 1250,620 C1380,650 1500,680 1640,690 L1650,760 C1500,770 1380,760 1250,760 C1170,760 1110,760 1080,760 Z", {
      fill: "#e9d7ae",
      fillStyle: "solid",
      strokeWidth: 3.4,
    });
    draw(cave, tFound, 0.9);
    const tIn = cue("well inside");
    burning(r, 1590, 750, 0.45, tIn, s.until);
    const arr = R.curve(r, [[1150, 650], [1350, 640], [1530, 690]], { stroke: C.ember, strokeWidth: 4 });
    draw(arr, tIn + 0.2, 0.6);
    write(r, "WONDERWERK CAVE", 1420, 250, { size: 74, color: C.char, underline: C.ember }).reveal(cue("the cave", tIn) - 0.4, 0.8);
  }

  function row10() {
    const s = scene(10);
    const r = s.root;
    const tBone = cue("burned bone");
    const bn = D.bone(r, 620, 420, 1.7, { burnt: true });
    draw(bn, Math.max(s.start + 0.1, tBone - 0.4), 0.9);
    const zoom = R.circle(r, 620, 420, 520, { stroke: C.charSoft, strokeWidth: 3, roughness: 1.4 });
    draw(zoom, s.start + 0.2, 0.8);
    const tAsh = cue("plant ash");
    const ashF = D.particles(r, 30, [1120, 280, 360, 240], 42, (g, x, y, rnd) =>
      R.ellipse(g, x, y, 10 + rnd() * 16, 6 + rnd() * 8, { fill: rnd() > 0.7 ? C.charSoft : C.ash, fillStyle: "solid", stroke: "none" }),
    );
    ashF.items.forEach((f, i) => show(f, tAsh + (i % 10) * 0.05, 0.3));
    smallLabel(r, "plant ash", 1300, 580, tAsh + 0.6);
    const tMil = cue("one million");
    const l1 = write(r, "~1 MILLION YEARS", 960, 760, { size: 96, color: C.ember });
    l1.reveal(tMil - 0.1, 0.8);
    const tNew = cue("Newer work");
    hide(l1.g, tNew + 0.2, 0.4);
    const deeper = [R.rect(r, 1120, 620, 380, 34, { fill: C.ash, hachureGap: 6, strokeWidth: 2.6 }), R.rect(r, 1120, 654, 380, 34, { fill: C.ochre, hachureGap: 8, strokeWidth: 2.6 })];
    const tOld = cue("even older layers");
    draw(deeper, tOld - 0.2, 0.7);
    const tR = cue("1.1 to 1.8");
    write(r, "1.1–1.8 MILLION YEARS", 960, 790, { size: 84, color: C.ember }).reveal(tR - 0.1, 0.9);
    const tag = el("g", null, r);
    R.rect(tag, 1530, 330, 330, 96, { stroke: C.char, strokeWidth: 3.4, fill: "#f5ead0", fillStyle: "solid", roughness: 1.6 });
    const tw = write(tag, "FIRE USE", 1695, 398, { size: 64, color: C.char });
    tw.fullShow();
    pop(tag, tR + 1.6, 0.5);
  }

  function row11() {
    const s = scene(11);
    const r = s.root;
    const grd = R.line(r, 100, 780, 1840, 776, { strokeWidth: 3.4 });
    const trees = [D.pine(r, 220, 780, 1.0), D.pine(r, 400, 784, 0.8)];
    draw([grd, ...trees], s.start, 0.8);
    [[210, 640, 0.7], [330, 700, 0.55], [410, 660, 0.6]].forEach(([x, y, sc], i) => burning(r, x, y, sc, s.start + 0.3 + i * 0.12, s.until));
    const tB = cue("bringing naturally lit fire");
    const w = D.person(r, 560, 780, 1.1, { pose: "carry" });
    const br = D.branch(w.g, 66, -150, 0.65, { fire: 0.4, len: 120 });
    show(w.g, tB - 0.2, 0.4);
    flicker(br.fire.flame, tB, s.until);
    move(w.g, tB, { x: 640 }, 3.4, "none");
    tl.to(w.g, { y: -8, duration: 0.25, yoyo: true, repeat: 11, ease: "sine.inOut" }, tB);
    const tC = cue("into the cave");
    const cave = R.path(r, "M1160,780 C1180,560 1300,470 1480,460 C1680,450 1820,560 1840,780 L1760,780 C1740,640 1640,580 1500,580 C1360,580 1260,660 1250,780 Z", {
      fill: C.ash,
      hachureGap: 9,
      strokeWidth: 3.6,
    });
    draw(cave, tC - 0.6, 0.8);
    const hc = D.campfire(r, 1500, 776, 0.6, { stones: true, flame: 0.9 });
    draw(hc.g, tC + 0.1, 0.6);
    flicker(hc.fire.flame, tC + 0.1, s.until);
    hide(w.g, tC + 0.6, 0.5);
    const tP = cue("does not prove");
    const sp = el("g", null, r);
    D.flint(sp, 880, 290, 0.8);
    D.pyrite(sp, 1030, 300, 0.8);
    [[-30, -40], [0, -60], [36, -44]].forEach(([dx, dy]) => R.line(sp, 955, 270, 955 + dx, 270 + dy, { stroke: C.ember, strokeWidth: 4 }));
    draw(sp, tP - 0.5, 0.6);
    write(r, "?", 960, 380, { size: 300, color: C.ember }).reveal(tP + 0.1, 0.4);
    const st = D.stamp(r, "NOT PROOF OF IGNITION", 960, 520, { w: 760, size: 58 });
    pop(st, cue("ignite it themselves") - 0.2, 0.35);
  }

  function row12() {
    const s = scene(12);
    const r = s.root;
    const P = D.proj(24, 4, 6.4, 520, 470);
    const lands = [D.land(r, D.MAPS.AFRICA, P), D.land(r, D.MAPS.ARABIA, P), D.land(r, D.MAPS.MADAGASCAR, P)];
    draw(lands, s.start, 1.1);
    const [sx, sy] = P(23.6, -27.8);
    const [ix, iy] = P(35.6, 33.0);
    const p0 = D.pin(r, sx, sy, 0.6, C.ash);
    show(p0, s.start + 0.3, 0.3);
    const trv = D.travel(r, [[sx, sy - 40], [sx + 150, sy - 250], [ix + 60, iy + 150], [ix, iy - 30]]);
    draw(trv, s.start + 0.6, 1.3);
    const p1 = D.pin(r, ix, iy, 0.8);
    pop(p1, s.start + 1.8, 0.4, "50% 100%");
    const tG = cue("Gesher Benot");
    const lake = el("g", null, r);
    [470, 505, 540].forEach((y, i) => D.wavy(lake, 1040 + i * 30, y, 640 - i * 60, { color: C.ash, amp: 8 }));
    const reeds = [1060, 1100, 1660, 1700].map((x) => D.grass(lake, x, 580, 1.3));
    const shore = R.line(lake, 1000, 790, 1800, 786, { strokeWidth: 3.4 });
    draw(lake, tG - 0.3, 1.0);
    write(r, "GESHER BENOT YA’AQOV", 1400, 370, { size: 54, font: "Kalam", color: C.charSoft }).reveal(tG + 0.2, 0.9);
    const tS = cue("burned seeds");
    const spots = [[1240, 720], [1540, 720]];
    const items = [];
    const rnd = D.mulberry32(77);
    for (let i = 0; i < 12; i++) {
      const x = 1060 + rnd() * 680;
      const y = 620 + rnd() * 140;
      const kind = i % 3;
      const it = kind === 0 ? D.seedPod(r, x, y, 1.1) : kind === 1 ? D.twig(r, x, y, 0.9, rnd() * 120) : D.flint(r, x, y, 0.4);
      items.push(it);
      pop(it, tS + (i % 6) * 0.1 + (kind === 1 ? cue("wood") - tS : 0) + (kind === 2 ? cue("and flint") - tS : 0), 0.35);
    }
    const tCl = cue("distinct clusters");
    items.forEach((it, i) => {
      const [cx, cy] = spots[i % 2];
      const a = (i / 12) * Math.PI * 2;
      const m = it.parentNode.transform.baseVal.consolidate().matrix;
      move(it, tCl - 0.3, { x: (cx + Math.cos(a) * 70 - m.e) / m.a, y: (cy + Math.sin(a) * 34 - m.f) / m.d }, 1.0);
    });
    spots.forEach(([cx, cy], i) => {
      const f = D.flame(r, cx, cy + 10, 0.45);
      pop(f.g, tCl + 0.6 + i * 0.2, 0.5, "50% 100%");
      flicker(f.flame, tCl + 0.6, s.until);
    });
    write(r, "~790,000 YEARS", 1400, 270, { size: 88, color: C.ember }).reveal(cue("790,000") + 0.2, 0.8);
  }

  function row13() {
    const s = scene(13);
    const r = s.root;
    const hearths = [[380, 640], [700, 720], [1000, 630]].map(([x, y], i) => {
      const h = D.campfire(r, x, y, 0.62, { stones: true, flame: 0.9 });
      draw(h.g, s.start + 0.1 + i * 0.35, 0.8);
      flicker(h.fire.flame, s.start + 0.2, s.until);
      return h;
    });
    const tC = cue("controlled hearths");
    const rings = hearths.map((h, i) => R.ellipse(r, [380, 700, 1000][i], [630, 710, 620][i], 250, 110, { stroke: C.ember, strokeWidth: 4, roughness: 1.8 }));
    draw(rings, tC - 0.1, 0.8);
    const tF = cue("fish");
    const f = D.fish(r, 1470, 400, 1.1);
    draw(f, tF - 0.2, 0.8);
    const tCook = cue("were cooked");
    const low = D.campfire(r, 1470, 760, 0.8, { stones: true, flame: 0.55 });
    draw(low.g, tCook - 0.3, 0.6);
    flicker(low.fire.flame, tCook, s.until);
    move(f, tCook, { y: 200, scale: 0.8, transformOrigin: "50% 50%" }, 1.0);
    const steam = [1420, 1500].map((x) => R.curve(r, [[x, 520], [x - 14, 470], [x + 8, 420], [x - 6, 380]], { stroke: C.ash, strokeWidth: 3 }));
    draw(steam, tCook + 1.0, 0.8);
    write(r, "COOKED ~780,000 YEARS AGO", 960, 280, { size: 80, color: C.ember, underline: C.char }).reveal(cue("780,000") - 0.1, 1.0);
    const tFam = cue("years ago", cue("780,000")) + 0.3;
    rings.forEach((rg) => hide(rg, tFam - 0.2, 0.3));
    const fam = [D.person(r, 1250, 800, 0.85, { pose: "sitReach", mouth: "smile" }), D.person(r, 1690, 800, 0.85, { pose: "sitReach", flip: true, mouth: "smile" }), D.person(r, 1580, 810, 0.6, { pose: "sit", flip: true, mouth: "smile" })];
    draw(fam.map((p) => p.g), tFam, 0.6);
  }

  function row14() {
    const s = scene(14);
    const r = s.root;
    const streaks = [300, 380, 460, 540, 620].map((y, i) => R.line(r, 200 + i * 40, y, 1500 + i * 30, y, { stroke: i % 2 ? C.ash : C.ember, strokeWidth: 4 }));
    draw(streaks, s.start + 0.1, 0.6, "power2.in");
    const big = write(r, "FAST-FORWARD", 960, 470, { size: 120, color: C.char });
    big.reveal(s.start + 0.2, 0.6);
    move(streaks, s.start + 0.8, { x: 900, opacity: 0 }, 1.2, "power2.in");
    const tB = cue("At Barnham");
    hide(big.g, tB - 0.4, 0.3);
    const P = D.proj(-3, 54.3, 46, 560, 480);
    const gb = D.land(r, D.MAPS.BRITAIN, P);
    const ir = D.land(r, D.MAPS.IRELAND, P, { fill: C.ashLight });
    draw([gb, ir], tB - 0.3, 1.0);
    const [bx, by] = P(0.75, 52.37);
    const pn = D.pin(r, bx, by, 0.8);
    pop(pn, cue("England") + 0.1, 0.4, "50% 100%");
    smallLabel(r, "Barnham", bx + 20, by + 50, cue("England") + 0.3, { anchor: "start" });
    const tA = cue("archaeologists found");
    const box = el("g", null, r);
    const layers = [
      R.rect(box, 1060, 320, 640, 120, { fill: C.ochreLight, hachureGap: 12, strokeWidth: 3 }),
      R.rect(box, 1060, 440, 640, 140, { fill: C.ochre, hachureGap: 9, strokeWidth: 3, hachureAngle: 35 }),
      R.rect(box, 1060, 580, 640, 200, { fill: C.ash, hachureGap: 8, strokeWidth: 3 }),
    ];
    const cut = D.travel(r, [[bx + 30, by - 20], [900, 380], [1050, 380]]);
    draw(cut, tA - 0.4, 0.5);
    draw(box, tA - 0.1, 0.9);
    const tHot = cue("intensely heated ground");
    const hot = el("g", null, r);
    glow(hot, 1380, 520, 190, C.ember, 0.75);
    R.ellipse(hot, 1380, 520, 300, 80, { fill: C.ember, fillStyle: "solid", stroke: C.char, strokeWidth: 3 });
    R.ellipse(hot, 1380, 520, 180, 40, { fill: C.emberHi, fillStyle: "solid", stroke: "none" });
    show(hot, tHot - 0.1, 0.9);
    pulse(hot, tHot + 1, s.until, 0.8, 1, 0.8);
  }

  function row15() {
    const s = scene(15);
    const r = s.root;
    const fl = D.flint(r, 560, 470, 2.0, { cracked: true });
    draw(fl, s.start + 0.1, 1.0);
    smallLabel(r, "fire-cracked flint", 560, 640, s.start + 0.7);
    const tP = cue("iron pyrite");
    const py1 = D.pyrite(r, 1250, 460, 1.4);
    const py2 = D.pyrite(r, 1440, 520, 1.1);
    draw([py1, py2], tP - 0.1, 0.8);
    smallLabel(r, "iron pyrite", 1340, 640, tP + 0.5);
    write(r, "~400,000 YEARS", 960, 230, { size: 92, color: C.ember, underline: C.char }).reveal(cue("400,000") - 0.1, 0.8);
    const tS = cue("Pyrite can throw");
    move(fl, tS, { x: 470, rotation: 20, transformOrigin: "50% 50%" }, 0.5, "power2.in");
    move(fl, tS + 0.55, { x: 380, rotation: 10 }, 0.35, "power1.out");
    move(fl, tS + 0.95, { x: 470, rotation: 20 }, 0.3, "power2.in");
    move(fl, tS + 1.35, { x: 300, rotation: 0 }, 0.6, "power1.out");
    const tSp = cue("sparks");
    const nest = D.bundle(r, 1190, 760, 0.8);
    draw(nest, tSp - 0.6, 0.6);
    const sparks = D.particles(r, 10, [1150, 430, 60, 60], 3, (g, x, y, rnd) => {
      const a = rnd() * Math.PI * 2;
      const holder = G(g, x, y, 1);
      R.line(holder, 0, 0, Math.cos(a) * 26, Math.sin(a) * 26, { stroke: C.ember, strokeWidth: 4, roughness: 0.4 });
      return holder;
    });
    sparks.items.forEach((sp, i) => {
      const t = tSp + 0.05 * i;
      tl.fromTo(sp, { opacity: 0, x: 0, y: 0 }, { opacity: 1, duration: 0.05 }, t);
      move(sp, t + 0.05, { x: -80 + sparks.rnd() * 120, y: 250 + sparks.rnd() * 60 }, 0.8, "power2.in");
      hide(sp, t + 0.8, 0.2);
    });
    const smoke = D.smokePuff(r, 1190, 690, 0.6);
    show(smoke, tSp + 1.0, 0.5);
    move(smoke, tSp + 1.0, { y: -80 }, 2.0, "power1.out");
    const nf = D.flame(r, 1190, 736, 0.4);
    pop(nf.g, tSp + 1.4, 0.5, "50% 100%");
    flicker(nf.flame, tSp + 1.4, s.until);
    smallLabel(r, "rare here", 1440, 330, cue("rare around") + 0.1, { color: C.ember, size: 42 });
  }

  function row16() {
    const s = scene(16);
    const r = s.root;
    const src = el("g", null, r);
    R.path(src, "M160,760 C220,560 420,520 560,760 Z", { fill: C.ash, hachureGap: 9, strokeWidth: 3.4 });
    D.pyrite(src, 360, 700, 0.8);
    const site = el("g", null, r);
    R.line(site, 1380, 764, 1760, 760, { strokeWidth: 3.4 });
    D.campfire(site, 1570, 760, 0.6, { stones: true, flame: 0.8 });
    draw([src, site], s.start + 0.1, 1.0);
    smallLabel(r, "pyrite source", 360, 820, s.start + 0.6);
    smallLabel(r, "Barnham", 1570, 820, s.start + 0.8);
    const arrow = R.curve(r, [[560, 640], [960, 520], [1380, 640]], { strokeWidth: 4, stroke: C.charSoft });
    const ah = R.lines(r, [[1350, 610], [1386, 644], [1340, 652]], { strokeWidth: 4 });
    draw([arrow, ah], s.start + 0.9, 0.9);
    smallLabel(r, "far away", 960, 500, s.start + 1.6);

    const tC = cue("carried it there");
    const carrier = el("g", null, r);
    D.hand(carrier, 0, 0, 0.55, { grip: true });
    D.pyrite(carrier, 36, -8, 0.55);
    gsap.set(carrier, { x: 380, y: 420 });
    show(carrier, tC - 0.3, 0.3);
    move(carrier, tC - 0.3, { x: 1420, y: 440 }, 2.4, "sine.inOut");
    const tD = cue("deliberate fire-making");
    const q = write(r, "DELIBERATE FIRE-MAKING?", 960, 260, { size: 92, color: C.ember, underline: C.char });
    q.reveal(tD - 0.2, 1.0);
    const tNM = cue("not merely fire use");
    smallLabel(r, "not just fire use", 960, 340, tNM, { size: 44 });

    const tL = cue("Later evidence");
    hide([src, site, arrow, ah, carrier, q.g], tL - 0.4, 0.5);
    r.querySelectorAll(".label").forEach((n) => {
      if (n !== q.g) hide(n, tL - 0.4, 0.5);
    });
    const P = D.proj(2.5, 46.5, 38, 470, 470);
    const fr = D.land(r, D.MAPS.FRANCE, P);
    draw(fr, tL, 1.0);
    write(r, "FRANCE", 470, 740, { size: 58, font: "Kalam", color: C.charSoft }).reveal(cue("France") - 0.1, 0.6);
    write(r, "~50,000 YEARS", 1300, 230, { size: 80, color: C.ember }).reveal(cue("Around 50,000"), 0.8);
    const tN = cue("Neanderthal");
    const n = D.person(r, 880, 790, 1.35, { species: "neanderthal", pose: "reach", mouth: "smile" });
    draw(n.g, tN - 0.2, 0.9);
    const tW = cue("microscopic wear");
    const ax = D.handaxe(r, 1330, 520, 1.7);
    draw(ax, tW - 0.6, 0.8);
    const lens = el("g", null, r);
    R.circle(lens, 1560, 420, 230, { strokeWidth: 5, fill: "#fff6de", fillStyle: "solid" });
    R.line(lens, 1440, 470, 1395, 500, { strokeWidth: 3, stroke: C.charSoft });
    for (let i = 0; i < 7; i++) R.line(lens, 1500 + i * 16, 360 + i * 4, 1540 + i * 16, 460 + i * 4, { strokeWidth: 2.2, roughness: 0.5, stroke: C.charSoft });
    pop(lens, tW + 0.1, 0.5);
    const tSp = cue("produce sparks");
    [[-60, -80], [-20, -110], [30, -96], [60, -60]].forEach(([dx, dy], i) => {
      const l = R.line(r, 1250, 360, 1250 + dx, 360 + dy, { stroke: C.ember, strokeWidth: 5 });
      draw(l, tSp + i * 0.05, 0.2);
      hide(l, tSp + 1.2, 0.4);
    });
  }

  function row17() {
    const s = scene(17);
    const r = s.root;
    const cf = D.campfire(r, 960, 620, 1.2, { stones: true, flame: 1.1 });
    draw(cf.g, s.start, 0.9);
    flicker(cf.fire.flame, s.start, s.until);
    const tW = cue("warmth");
    const waves = [620, 700, 1220, 1300].map((x, i) => R.curve(r, [[x, 520], [x - 16, 470], [x + 10, 420], [x - 8, 370]], { stroke: C.ember, strokeWidth: 4 }));
    draw(waves, tW - 0.1, 0.7);
    const sitter = D.person(r, 560, 800, 1.1, { pose: "sitReach", mouth: "smile" });
    draw(sitter.g, tW + 0.2, 0.6);
    const tL = cue("light after sunset");
    const night = el("g", null, r);
    const m = D.moon(night, 1560, 200, 1.1);
    [[1380, 160], [1720, 300], [1440, 300], [1780, 150]].forEach(([x, y]) => D.star(night, x, y, 1));
    draw(night, tL - 0.2, 0.8);
    const halo = glow(r, 960, 520, 520, C.emberHi, 0);
    tl.to(halo, { opacity: 0.55, duration: 1.2 }, tL + 0.4);
    const tS = cue("smoke against insects");
    const bugs = [D.insect(r, 1180, 380, 1.1), D.insect(r, 1260, 330, 0.9)];
    show(bugs, tS - 0.3, 0.3);
    move(bugs, tS + 0.7, { x: 520, y: -260 }, 1.6, "power2.in");
    [0, 0.3].forEach((d, i) => {
      const p = D.smokePuff(r, 1000 + i * 60, 380, 0.7);
      show(p, tS + d, 0.4);
      move(p, tS + d, { x: 120, y: -120 }, 2.0, "power1.out");
      hide(p, tS + 1.8 + d, 0.6);
    });
    const tP = cue("protection from predators");
    const cat = D.bigCat(r, 1640, 800, 1.0, true);
    draw(cat, tP - 0.3, 0.8);
    move(cf.fire.g, tP + 0.6, { scale: 1.3, transformOrigin: "50% 100%" }, 0.4, "power2.out");
    move(cat, tP + 0.8, { x: 280 }, 1.2, "power2.in");
    move(cf.fire.g, tP + 1.6, { scale: 1 }, 0.8);
    const tCk = cue("Cooking");
    const pt = D.pot(r, 960, 470, 0.9);
    draw(pt, tCk - 0.2, 0.7);
    const root = el("g", null, r);
    R.path(root, "M-60,0 L-40,-24 L-10,-10 L10,-30 L40,-14 L60,-26 L56,6 L-56,10 Z", { fill: C.ochre, hachureGap: 5, strokeWidth: 3 });
    gsap.set(root, { x: 960, y: 250 });
    show(root, tCk + 0.4, 0.3);
    move(root, cue("soften tough food"), { y: 360, scaleY: 0.5 }, 1.0, "power2.in");
    hide(root, cue("soften tough food") + 0.9, 0.3);
    const st = [930, 990].map((x) => R.curve(r, [[x, 360], [x - 14, 310], [x + 8, 260], [x - 6, 220]], { stroke: C.ash, strokeWidth: 3 }));
    draw(st, cue("easier to digest") - 0.4, 0.8);
  }

  function row18() {
    const s = scene(18);
    const r = s.root;
    const items = el("g", null, r);
    const tWood = cue("wood");
    const sp = D.spear(items, 400, 360, 0.7);
    const tip = glow(items, 600, 334, 50, C.ember, 0);
    draw(sp, tWood - 0.2, 0.7);
    tl.to(tip, { opacity: 0.9, duration: 0.5 }, tWood + 0.4);
    const tStone = cue("stone,");
    const stn = D.flint(items, 810, 350, 1.1, { cracked: true });
    draw(stn, tStone - 0.1, 0.5);
    const tPig = cue("pigments");
    const bowl = el("g", null, items);
    D.pot(bowl, 1180, 380, 0.5);
    R.ellipse(bowl, 1180, 330, 100, 16, { fill: C.ember, fillStyle: "solid", strokeWidth: 2 });
    draw(bowl, tPig - 0.2, 0.6);
    const tMet = cue("eventually metals");
    const ing = el("g", null, items);
    R.poly(ing, [[1440, 400], [1480, 330], [1640, 330], [1680, 400]], { fill: C.ember, hachureGap: 6, strokeWidth: 3, stroke: C.charSoft });
    const ig = glow(ing, 1560, 370, 140, C.emberHi, 0.5);
    draw(ing, tMet - 0.1, 0.7);
    tl.to(ing, { opacity: 0.5, duration: 0.8 }, tMet + 1.0);
    const labs = [["wood", 400], ["stone", 810], ["pigment", 1180], ["metal, later", 1560]];
    const lt = [tWood, tStone, tPig, tMet];
    labs.forEach(([t, x], i) => smallLabel(items, t, x, 480, lt[i] + 0.3));

    const tCir = cue("the circle it created");
    move(items, tCir - 0.5, { y: -80, opacity: 0 }, 0.8);
    const hearth = D.campfire(r, 960, 690, 0.9, { stones: true, flame: 1.0 });
    draw(hearth.g, tCir - 0.3, 0.7);
    flicker(hearth.fire.flame, tCir, s.until);
    const seats = [
      [620, 700, 0.8, false], [760, 600, 0.62, false], [1160, 600, 0.62, true], [1300, 700, 0.8, true], [470, 800, 1.0, false], [1450, 800, 1.0, true],
    ];
    const ppl = seats.map(([x, y, sc, flip], i) => {
      const p = D.person(r, x, y, sc, { pose: "sit", flip, mouth: "smile", tunic: i % 2 ? C.ochreLight : C.ochre });
      draw(p.g, tCir + i * 0.18, 0.6);
      return p;
    });
    const tShare = cue("food could be shared");
    const food = D.fish(r, 0, 0, 0.35, { fill: C.ochre });
    gsap.set(food, { x: 540, y: 640 });
    show(food, tShare - 0.2, 0.3);
    move(food, tShare + 0.2, { x: 1380, y: 640 }, 1.6, "sine.inOut");
    hide(food, tShare + 1.8, 0.3);
    const tRep = cue("Tools could be repaired");
    const tool = D.handaxe(r, 760, 460, 0.45);
    pop(tool, tRep, 0.4);
    tl.to(tool, { rotation: 12, duration: 0.12, yoyo: true, repeat: 5, transformOrigin: "50% 50%" }, tRep + 0.4);
    const tPl = cue("Plans could be made");
    const plan = el("g", null, r);
    R.curve(plan, [[760, 820], [880, 800], [1000, 830], [1140, 810]], { strokeWidth: 3, stroke: C.charSoft });
    R.line(plan, 1130, 794, 1160, 826, { strokeWidth: 4, stroke: C.ember });
    R.line(plan, 1160, 794, 1130, 826, { strokeWidth: 4, stroke: C.ember });
    draw(plan, tPl - 0.1, 0.8);
    const tK = cue("Knowledge could pass");
    const kn = R.curve(r, [[620, 560], [700, 470], [780, 510]], { stroke: C.ember, strokeWidth: 4 });
    const kh = R.lines(r, [[760, 490], [784, 512], [754, 522]], { stroke: C.ember, strokeWidth: 4 });
    draw([kn, kh], tK + 0.2, 0.7);
    const tStory = cue("first story");
    for (let i = 0; i < 3; i++) {
      const q = el("text", { x: 960 + (i - 1) * 50, y: 470, "font-family": "Caveat Brush", "font-size": 130, fill: i === 1 ? C.ember : C.charSoft, "text-anchor": "middle" }, r);
      q.textContent = i % 2 ? "”" : "“";
      const t0 = tStory + i * 0.9;
      tl.fromTo(q, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: "power1.out" }, t0);
      move(q, t0 + 0.6, { y: -300, x: (i - 1) * 60, opacity: 0 }, 3.2, "power1.in");
    }
    blink(ppl.map((p) => p.eyes), cue("burning beside it"));
  }

  function row19() {
    const s = scene(19);
    const r = s.root;
    const title = write(r, "WHO INVENTED FIRE?", 960, 300, { size: 128, color: C.char, underline: C.ember });
    title.reveal(s.start + 0.2, 1.0);
    const tOne = cue("No one person");
    const one = D.person(r, 960, 760, 1.4, { mouth: "smile" });
    draw(one.g, tOne - 0.2, 0.6);
    const tSp = cue("No single species");
    move(one.g, tSp - 0.2, { scale: 0.7, transformOrigin: "50% 100%" }, 0.5);
    const crowd = [];
    [320, 480, 640, 800, 1120, 1280, 1440, 1600].forEach((x, i) => {
      const p = D.person(r, x, 760, 0.7 + (i % 3) * 0.1, { species: i < 3 ? "neanderthal" : undefined, mouth: "smile", tunic: i % 2 ? C.ochreLight : C.ochre });
      draw(p.g, tSp + Math.abs(i - 3.5) * 0.12, 0.5);
      crowd.push(p.g);
    });
    const tDay = cue("No single day");
    const sun = el("g", null, r);
    D.sunIcon(sun, 0, 0, 0.6);
    gsap.set(sun, { x: 240, y: 520 });
    show(sun, tDay - 0.1, 0.3);
    tl.to(sun, { x: 1680, duration: 1.8, ease: "none" }, tDay);
    tl.to(sun, { y: 430, duration: 0.9, ease: "sine.out", yoyo: true, repeat: 1 }, tDay);
    hide(sun, tDay + 1.6, 0.3);

    const tNat = cue("stolen from nature");
    hide([title.g, one.g, ...crowd], tNat - 0.4, 0.5);
    const tr = D.tree(r, 400, 780, 1.1, { leafFill: C.charSoft });
    draw(tr, tNat - 0.2, 0.8);
    const nf = D.flame(r, 470, 420, 0.7);
    pop(nf.g, tNat + 0.2, 0.4, "50% 100%");
    flicker(nf.flame, tNat, s.until);
    const hd = D.hand(r, 1020, 520, 0.7, { flip: true });
    slideIn(hd, tNat + 0.3, 400, 0, 1.0);
    const tKeep = cue("kept alive by patience");
    move(nf.g, tKeep - 0.2, { x: 440, y: 100 }, 1.4, "sine.inOut");
    const tTool = cue("shaped into a tool");
    const ring = D.stones(r, 1300, 760, 0.9);
    draw(ring, tTool - 0.2, 0.7);
    const tSpark = cue("summoned with a spark");
    const burst = el("g", null, r);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      R.line(burst, 1300 + Math.cos(a) * 30, 640 + Math.sin(a) * 30, 1300 + Math.cos(a) * 80, 640 + Math.sin(a) * 80, { stroke: C.ember, strokeWidth: 5 });
    }
    draw(burst, tSpark + 0.2, 0.3);
    hide(burst, tSpark + 0.9, 0.3);
    const hf = D.flame(r, 1300, 760, 1.1);
    pop(hf.g, tSpark + 0.8, 0.9, "50% 100%");
    flicker(hf.flame, tSpark + 0.8, s.until);

    const tFl = cue("Humans did not invent the flame");
    hide([tr, nf.g, hd], tFl - 0.3, 0.6);
    move(ring, tFl - 0.1, { x: -340 / 0.9 }, 1.2, "sine.inOut");
    move(hf.g, tFl - 0.1, { x: -340 / 1.1 }, 1.2, "sine.inOut");
    const theFlame = write(r, "the flame", 960, 360, { size: 100, color: C.charSoft });
    theFlame.reveal(cue("the flame") - 0.1, 0.6);
    const strike = R.line(r, 760, 334, 1160, 344, { stroke: C.ember, strokeWidth: 8 });
    draw(strike, cueEnd("the flame") + 0.1, 0.4);
    const tWe = cue("We invented what to do with it");
    const circle = [[740, 800, 0.8, false], [1180, 800, 0.8, true], [850, 700, 0.6, false], [1070, 700, 0.6, true]].map(([x, y, sc, flip]) => {
      const p = D.person(r, x, y, sc, { pose: "sitReach", flip, mouth: "smile" });
      draw(p.g, tWe + 0.2, 0.7);
      return p;
    });
    hide(theFlame.g, tWe - 0.2, 0.4);
    hide(strike, tWe - 0.2, 0.4);
    const fin = write(r, "WE INVENTED", 960, 230, { size: 110, color: C.char });
    const fin2 = write(r, "WHAT TO DO WITH IT.", 960, 360, { size: 110, color: C.ember, underline: C.char });
    fin.reveal(tWe - 0.1, 0.8);
    fin2.reveal(tWe + 0.8, 1.0);
    blink(circle.map((p) => p.eyes), tWe + 2.4);
  }

  // -------------------------------------------------------- captions ---
  function captions() {
    const host = document.getElementById("captions");
    T.captions.forEach((c, i) => {
      const d = document.createElement("div");
      d.className = "cap";
      d.id = `cap-${i}`;
      const k = c.text.indexOf(c.key);
      if (k >= 0) {
        d.append(document.createTextNode(c.text.slice(0, k)));
        const em = document.createElement("span");
        em.className = "key";
        em.textContent = c.key;
        d.append(em, document.createTextNode(c.text.slice(k + c.key.length)));
      } else d.textContent = c.text;
      host.appendChild(d);
      tl.fromTo(d, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "none" }, c.start);
      tl.to(d, { opacity: 0, duration: 0.1, ease: "none" }, c.end - 0.1);
    });
  }

  window.buildFire = function (timeline) {
    tl = timeline;
    D.setTimeline(tl);
    D.init();
    [row1, row2, row3, row4, row5, row6, row7, row8, evidenceTimeline, row9, row10, row11, row12, row13, row14, row15, row16, row17, row18, row19, captions].forEach(
      (fn) => fn(),
    );
  };
})();
