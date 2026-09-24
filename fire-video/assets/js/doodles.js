/* Hand-drawn doodle engine for the fire explainer.
 * Everything is deterministic: rough.js shapes take an incrementing seed, and
 * scattered particles use a seeded PRNG, so every render produces identical frames. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const C = {
    char: "#2a231d",
    charSoft: "#4a4038",
    ash: "#8c857a",
    ashLight: "#b9b09f",
    ember: "#dd5a22",
    emberHi: "#f39a35",
    yolk: "#f6c453",
    ochre: "#c08a3e",
    ochreLight: "#d9ae6a",
    parch: "#efe2c4",
    parchDark: "#e2cfa6",
  };

  let seedCounter = 1;
  let uid = 0;
  const nextId = (p) => `${p}-${++uid}`;

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  // ------------------------------------------------------------ rough ---
  let gen = null;
  const DEF = {
    stroke: C.char,
    strokeWidth: 3.2,
    roughness: 1.3,
    bowing: 1.1,
    fillStyle: "hachure",
    hachureGap: 9,
    hachureAngle: -41,
    fillWeight: 1.8,
  };

  function toGroup(parent, drawable, o) {
    const g = el("g", { class: "rough" }, parent);
    const paths = gen.toPaths(drawable);
    for (const p of paths) {
      const isStroke = p.stroke === (o.stroke || DEF.stroke) && p.fill === "none" && drawable.sets;
      const node = el("path", { d: p.d }, g);
      node.setAttribute("stroke", p.stroke);
      node.setAttribute("stroke-width", p.strokeWidth);
      node.setAttribute("fill", p.fill || "none");
      node.setAttribute("stroke-linecap", "round");
      node.setAttribute("stroke-linejoin", "round");
      node.classList.add(p.fill && p.fill !== "none" ? "fl" : isStroke ? "st" : "hx");
    }
    // rough emits fills first and the outline last; tag the outline paths explicitly
    const sets = drawable.sets;
    const kids = Array.from(g.children);
    sets.forEach((s, i) => {
      if (!kids[i]) return;
      kids[i].classList.remove("st", "hx", "fl");
      kids[i].classList.add(s.type === "path" ? "st" : s.type === "fillSketch" ? "hx" : "fl");
    });
    return g;
  }

  function opts(o) {
    const r = Object.assign({}, DEF, o || {});
    r.seed = seedCounter++;
    return r;
  }

  const R = {
    path(p, d, o) {
      const q = opts(o);
      return toGroup(p, gen.path(d, q), q);
    },
    curve(p, pts, o) {
      const q = opts(o);
      return toGroup(p, gen.curve(pts, q), q);
    },
    line(p, x1, y1, x2, y2, o) {
      const q = opts(o);
      return toGroup(p, gen.line(x1, y1, x2, y2, q), q);
    },
    lines(p, pts, o) {
      const q = opts(o);
      return toGroup(p, gen.linearPath(pts, q), q);
    },
    poly(p, pts, o) {
      const q = opts(o);
      return toGroup(p, gen.polygon(pts, q), q);
    },
    ellipse(p, cx, cy, w, h, o) {
      const q = opts(o);
      return toGroup(p, gen.ellipse(cx, cy, w, h, q), q);
    },
    circle(p, cx, cy, d, o) {
      const q = opts(o);
      return toGroup(p, gen.circle(cx, cy, d, q), q);
    },
    rect(p, x, y, w, h, o) {
      const q = opts(o);
      return toGroup(p, gen.rectangle(x, y, w, h, q), q);
    },
  };

  // ------------------------------------------------------ placement ---
  /** Place a local drawing at (x, y) with scale s. Returns the inner group, which is safe to animate. */
  function G(parent, x = 0, y = 0, s = 1, flip = false, cls) {
    const outer = el("g", { transform: `translate(${x} ${y}) scale(${flip ? -s : s} ${s})` }, parent);
    const inner = el("g", cls ? { class: cls } : null, outer);
    return inner;
  }

  // ---------------------------------------------------- timeline API ---
  let tl = null;
  function setTimeline(t) {
    tl = t;
  }

  function strokesOf(target) {
    const list = [];
    const push = (n) => n.querySelectorAll("path.st, path.hx").forEach((p) => list.push(p));
    (Array.isArray(target) ? target : [target]).forEach(push);
    return list;
  }
  function fillsOf(target) {
    const list = [];
    (Array.isArray(target) ? target : [target]).forEach((n) =>
      n.querySelectorAll("path.fl").forEach((p) => list.push(p)),
    );
    return list;
  }

  /** Draw-on reveal: outline strokes sweep in, hatching follows, solid fills fade in. */
  function draw(target, t, dur = 1.2, ease = "power1.inOut") {
    const strokes = strokesOf(target);
    const fills = fillsOf(target);
    strokes.forEach((p) => {
      p.setAttribute("pathLength", "1");
      p.style.strokeDasharray = "1 2";
      p.style.strokeDashoffset = "1";
    });
    fills.forEach((p) => (p.style.opacity = "0"));
    // loose (non-rough) circles and text — glows, eye dots — fade in with the fills
    const loose = [];
    (Array.isArray(target) ? target : [target]).forEach((n) =>
      n.querySelectorAll("circle, text").forEach((c) => {
        if (c.closest("clipPath")) return;
        loose.push(c);
        c.style.opacity = "0";
      }),
    );
    const outline = strokes.filter((p) => p.classList.contains("st"));
    const hatch = strokes.filter((p) => p.classList.contains("hx"));
    const n = Math.max(1, outline.length);
    const each = Math.min(dur, Math.max(0.25, (dur * 1.6) / n));
    const step = n > 1 ? (dur - each) / (n - 1) : 0;
    outline.forEach((p, i) => tl.to(p, { strokeDashoffset: 0, duration: each, ease }, t + i * step));
    if (hatch.length)
      tl.to(hatch, { strokeDashoffset: 0, duration: Math.max(0.4, dur * 0.6), ease: "power1.out", stagger: Math.min(0.08, (dur * 0.4) / hatch.length) }, t + dur * 0.35);
    if (fills.length) tl.to(fills, { opacity: 1, duration: Math.max(0.3, dur * 0.5), ease: "power1.out" }, t + dur * 0.45);
    loose.forEach((c) => tl.to(c, { opacity: parseFloat(c.getAttribute("opacity") || "1"), duration: Math.max(0.3, dur * 0.5), ease: "power1.out" }, t + dur * 0.5));
    return t + dur;
  }

  function show(target, t, dur = 0.6, to = 1) {
    gsap.set(target, { opacity: 0 });
    tl.to(target, { opacity: to, duration: dur, ease: "power1.out" }, t);
  }
  function hide(target, t, dur = 0.6) {
    tl.to(target, { opacity: 0, duration: dur, ease: "power1.in" }, t);
  }
  function pop(target, t, dur = 0.6, origin = "50% 50%") {
    gsap.set(target, { opacity: 0 });
    tl.fromTo(target, { scale: 0.82, transformOrigin: origin }, { scale: 1, duration: dur, ease: "power2.out" }, t);
    tl.to(target, { opacity: 1, duration: dur * 0.6, ease: "power1.out" }, t);
  }
  function move(target, t, vars, dur = 1, ease = "power2.inOut") {
    tl.to(target, Object.assign({ duration: dur, ease }, vars), t);
  }
  function slideIn(target, t, dx, dy, dur = 1) {
    gsap.set(target, { opacity: 0 });
    tl.fromTo(target, { x: dx, y: dy }, { x: 0, y: 0, duration: dur, ease: "power2.out" }, t);
    tl.to(target, { opacity: 1, duration: dur * 0.5 }, t);
  }

  /** Finite, deterministic flame flicker between t0 and t1. */
  function flicker(target, t0, t1, amp = 1) {
    const rnd = mulberry32(seedCounter++ * 97);
    let t = t0;
    gsap.set(target, { transformOrigin: "50% 100%" });
    while (t < t1 - 0.12) {
      const d = 0.14 + rnd() * 0.14;
      tl.to(
        target,
        {
          scaleY: 1 + (rnd() * 0.12 - 0.03) * amp,
          scaleX: 1 - (rnd() * 0.07 - 0.02) * amp,
          skewX: (rnd() * 6 - 3) * amp,
          duration: d,
          ease: "sine.inOut",
        },
        t,
      );
      t += d;
    }
  }
  function pulse(target, t0, t1, lo = 0.55, hi = 0.9, period = 0.9) {
    const rnd = mulberry32(seedCounter++ * 31);
    let t = t0;
    let up = true;
    while (t < t1 - 0.1) {
      const d = period * (0.7 + rnd() * 0.6);
      tl.to(target, { opacity: up ? hi : lo, duration: d, ease: "sine.inOut" }, t);
      t += d;
      up = !up;
    }
  }
  function blink(eyes, t) {
    if (!eyes) return;
    gsap.set(eyes, { transformOrigin: "50% 50%" });
    tl.to(eyes, { scaleY: 0.1, duration: 0.07, ease: "power1.in" }, t);
    tl.to(eyes, { scaleY: 1, duration: 0.1, ease: "power1.out" }, t + 0.08);
  }

  // -------------------------------------------------------------- text ---
  const mctx = document.createElement("canvas").getContext("2d");
  function measure(text, size, font, spacing, x, y, anchor) {
    mctx.font = `${size}px "${font}"`;
    const w = mctx.measureText(text).width + spacing * text.length;
    const left = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
    return { x: left, y: y - size * 0.82, width: w, height: size * 1.05 };
  }
  /** Hand-lettered label; call .reveal(t, dur) for a left-to-right pen wipe. */
  function write(parent, text, x, y, o = {}) {
    const size = o.size || 64;
    const g = el("g", { class: "label" }, parent);
    const t = el(
      "text",
      {
        x,
        y,
        "font-family": o.font || "Caveat Brush",
        "font-size": size,
        fill: o.color || C.char,
        "text-anchor": o.anchor || "middle",
        "letter-spacing": o.spacing || 1,
      },
      g,
    );
    t.textContent = text;
    if (o.rotate) g.setAttribute("transform", `rotate(${o.rotate} ${x} ${y})`);
    const bb = measure(text, size, o.font || "Caveat Brush", o.spacing || 1, x, y, o.anchor || "middle");
    const id = nextId("wipe");
    const cp = el("clipPath", { id }, g);
    const r = el("rect", { x: bb.x - 20, y: bb.y - 20, width: 0, height: bb.height + 40 }, cp);
    t.setAttribute("clip-path", `url(#${id})`);
    let underline = null;
    if (o.underline) {
      underline = R.curve(
        g,
        [
          [bb.x + 4, bb.y + bb.height + 6],
          [bb.x + bb.width * 0.5, bb.y + bb.height + 12],
          [bb.x + bb.width - 2, bb.y + bb.height + 4],
        ],
        { stroke: o.underline, strokeWidth: 5, roughness: 1.6 },
      );
    }
    return {
      g,
      text: t,
      bb,
      reveal(at, dur = 0.9) {
        tl.to(r, { attr: { width: bb.width + 40 }, duration: dur, ease: "power1.inOut" }, at);
        if (underline) draw(underline, at + dur * 0.8, 0.5);
        return at + dur;
      },
      fullShow() {
        r.setAttribute("width", bb.width + 40);
      },
    };
  }

  // ------------------------------------------------------------ shapes ---
  function glow(parent, cx, cy, r, color = C.emberHi, opacity = 0.6) {
    const id = nextId("glow");
    const defs = el("defs", null, parent);
    const rg = el("radialGradient", { id }, defs);
    el("stop", { offset: "0%", "stop-color": color, "stop-opacity": 0.85 }, rg);
    el("stop", { offset: "45%", "stop-color": color, "stop-opacity": 0.35 }, rg);
    el("stop", { offset: "100%", "stop-color": color, "stop-opacity": 0 }, rg);
    return el("circle", { cx, cy, r, fill: `url(#${id})`, opacity }, parent);
  }

  const FLAME_D =
    "M0,0 C-40,0 -50,-30 -36,-56 C-28,-70 -30,-86 -16,-104 C-14,-84 -4,-74 4,-82 C10,-92 6,-110 14,-126 C34,-100 50,-70 44,-38 C40,-12 26,0 0,0 Z";
  const FLAME_IN =
    "M0,0 C-20,0 -26,-18 -18,-34 C-12,-44 -10,-52 -4,-62 C0,-50 6,-46 10,-54 C20,-40 24,-24 20,-12 C16,-2 10,0 0,0 Z";

  /** A flame whose base sits on (0,0). Returns {g, flame, glow}. */
  function flame(parent, x, y, s = 1, o = {}) {
    const outer = G(parent, x, y, s);
    const halo = o.glow === false ? null : glow(outer, 0, -50, 150, C.emberHi, 0.55);
    const f = el("g", { class: "flame" }, outer);
    R.path(f, FLAME_D, { fill: C.ember, fillStyle: "solid", stroke: C.char, strokeWidth: 3 / Math.max(s, 0.4), roughness: 0.9 });
    R.path(f, FLAME_IN, { fill: C.yolk, fillStyle: "solid", stroke: "none", roughness: 0.6 });
    return { g: outer, flame: f, glow: halo };
  }

  function logs(parent, x, y, s = 1) {
    const g = G(parent, x, y, s);
    R.path(g, "M-80,-6 L70,-34 L78,-18 L-72,10 Z", { fill: C.ochre, hachureGap: 7, strokeWidth: 3 });
    R.path(g, "M-70,-34 L80,-4 L72,12 L-78,-18 Z", { fill: C.ochreLight, hachureGap: 7, hachureAngle: 40, strokeWidth: 3 });
    return g;
  }
  function stones(parent, x, y, s = 1, n = 7) {
    const g = G(parent, x, y, s);
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (i / (n - 1));
      R.ellipse(g, Math.cos(a) * -110, 8 - Math.sin(a) * 18 + 10, 42, 26, { fill: C.ash, hachureGap: 6, strokeWidth: 2.6 });
    }
    return g;
  }
  /** Campfire: logs + flame. Returns {g, fire}. */
  function campfire(parent, x, y, s = 1, o = {}) {
    const g = G(parent, x, y, s);
    if (o.stones) stones(g, 0, 0, 1);
    logs(g, 0, 0, 1);
    const fire = flame(g, 0, -10, o.flame || 1);
    return { g, fire };
  }

  function tree(parent, x, y, s = 1, o = {}) {
    const g = G(parent, x, y, s);
    R.path(g, "M-14,0 C-10,-80 -12,-160 -6,-240 L8,-240 C12,-160 12,-80 18,0 Z", { fill: o.trunk || C.charSoft, hachureGap: 5, strokeWidth: 3 });
    R.curve(g, [[0, -150], [-50, -190], [-90, -230]], { strokeWidth: 4 });
    R.curve(g, [[4, -180], [50, -220], [84, -270]], { strokeWidth: 4 });
    R.curve(g, [[0, -230], [-20, -290], [-10, -330]], { strokeWidth: 3.5 });
    if (o.leaves !== false)
      R.path(
        g,
        "M-120,-230 C-150,-290 -100,-350 -40,-340 C-20,-400 60,-400 80,-340 C140,-340 150,-270 110,-240 C80,-200 -80,-200 -120,-230 Z",
        { fill: o.leafFill || C.ash, hachureGap: o.gap || 11, hachureAngle: 60, strokeWidth: 3 },
      );
    return g;
  }
  function pine(parent, x, y, s = 1, fill = C.charSoft) {
    const g = G(parent, x, y, s);
    R.line(g, 0, 0, 0, -40, { strokeWidth: 4 });
    R.poly(g, [[-70, -30], [0, -150], [70, -30]], { fill, hachureGap: 8 });
    R.poly(g, [[-55, -110], [0, -220], [55, -110]], { fill, hachureGap: 8 });
    return g;
  }

  function bolt(parent, x1, y1, x2, y2, o = {}) {
    const rnd = mulberry32(seedCounter++ * 13);
    const pts = [[x1, y1]];
    const n = 7;
    for (let i = 1; i < n; i++) {
      const f = i / n;
      pts.push([x1 + (x2 - x1) * f + (rnd() - 0.5) * 90, y1 + (y2 - y1) * f]);
    }
    pts.push([x2, y2]);
    const g = el("g", { class: "bolt" }, parent);
    R.lines(g, pts, { stroke: o.color || C.emberHi, strokeWidth: o.w || 9, roughness: 0.6 });
    R.lines(g, pts, { stroke: C.char, strokeWidth: 3, roughness: 0.8 });
    return g;
  }

  function hills(parent, y, o = {}) {
    const g = el("g", null, parent);
    R.curve(g, [[-40, y + 10], [300, y - 60], [620, y - 20], [900, y - 90], [1250, y - 30], [1600, y - 80], [1960, y - 10]], {
      strokeWidth: 3,
      stroke: o.stroke || C.ash,
    });
    R.line(g, -20, y + 40, 1940, y + 30, { strokeWidth: 3.4 });
    return g;
  }
  function grass(parent, x, y, s = 1, color) {
    const g = G(parent, x, y, s);
    R.curve(g, [[0, 0], [-6, -20], [-16, -38]], { strokeWidth: 2.6, stroke: color || C.char });
    R.curve(g, [[4, 0], [4, -26], [8, -46]], { strokeWidth: 2.6, stroke: color || C.char });
    R.curve(g, [[8, 0], [16, -18], [28, -30]], { strokeWidth: 2.6, stroke: color || C.char });
    return g;
  }
  function volcano(parent, x, y, s = 1) {
    const g = G(parent, x, y, s);
    R.poly(g, [[-200, 0], [-50, -230], [40, -230], [210, 0]], { fill: C.ash, hachureGap: 10, strokeWidth: 3.4 });
    R.path(g, "M-50,-230 C-30,-200 10,-210 40,-230", { stroke: C.ember, strokeWidth: 5 });
    R.path(g, "M-20,-228 C-30,-170 -60,-120 -70,-60", { stroke: C.ember, strokeWidth: 4 });
    R.path(g, "M20,-226 C30,-180 60,-140 70,-90", { stroke: C.ember, strokeWidth: 4 });
    return g;
  }
  function smokePuff(parent, x, y, s = 1) {
    const g = G(parent, x, y, s);
    R.path(g, "M-40,0 C-70,-10 -60,-50 -30,-46 C-24,-80 30,-80 34,-46 C70,-50 76,-6 40,0 Z", { stroke: C.ash, strokeWidth: 3, fill: C.ashLight, hachureGap: 12 });
    return g;
  }
  function cloud(parent, x, y, s = 1, fill = C.ash) {
    const g = G(parent, x, y, s);
    R.path(g, "M-150,20 C-200,20 -200,-50 -140,-50 C-140,-110 -50,-120 -30,-70 C0,-130 100,-120 100,-60 C170,-70 190,20 130,20 Z", {
      fill,
      hachureGap: 8,
      strokeWidth: 3.4,
    });
    return g;
  }
  function rain(parent, x, y, w, h, n, seed = 5) {
    const rnd = mulberry32(seed);
    const g = el("g", null, parent);
    for (let i = 0; i < n; i++) {
      const px = x + rnd() * w;
      const py = y + rnd() * h;
      R.line(g, px, py, px - 10, py + 34, { stroke: C.charSoft, strokeWidth: 2.4, roughness: 0.6 });
    }
    return g;
  }

  function tuber(parent, x, y, s = 1) {
    const g = G(parent, x, y, s);
    R.path(g, "M-70,0 C-80,-40 -20,-60 30,-50 C80,-44 90,-6 60,6 C20,20 -60,20 -70,0 Z", { fill: C.ochre, hachureGap: 7, strokeWidth: 3 });
    R.curve(g, [[-40, -20], [-30, -30], [-10, -28]], { strokeWidth: 2 });
    R.curve(g, [[10, -10], [24, -16], [40, -14]], { strokeWidth: 2 });
    // steam
    const st = el("g", { class: "steam" }, g);
    R.curve(st, [[-20, -70], [-34, -100], [-16, -130], [-28, -160]], { stroke: C.ash, strokeWidth: 3 });
    R.curve(st, [[20, -70], [8, -100], [26, -130], [14, -160]], { stroke: C.ash, strokeWidth: 3 });
    return { g, steam: st };
  }

  function branch(parent, x, y, s = 1, o = {}) {
    // stick from (0,0) to (len, -len*tilt), optional flame at the tip
    const len = o.len || 220;
    const g = G(parent, x, y, s);
    R.path(g, `M0,6 L${len},-${len * 0.36 - 6} L${len + 4},-${len * 0.36 + 6} L0,-6 Z`, { fill: C.ochre, fillStyle: "solid", strokeWidth: 3 });
    R.line(g, len * 0.5, -len * 0.18, len * 0.62, -len * 0.36, { strokeWidth: 3 });
    let fire = null;
    if (o.fire) fire = flame(g, len + 4, -len * 0.36 + 4, o.fire);
    if (o.ember) {
      glow(g, len + 2, -len * 0.36, 40, C.ember, 0.8);
      R.circle(g, len + 2, -len * 0.36, 16, { fill: C.ember, fillStyle: "solid", stroke: C.char, strokeWidth: 2 });
    }
    return { g, fire };
  }

  // -------------------------------------------------------- people ---
  const POSES = {
    stand: {
      head: [0, -172], neck: [0, -150], hip: [0, -84],
      armL: [[-14, -142], [-26, -112], [-30, -82]], armR: [[14, -142], [26, -112], [30, -82]],
      legL: [[-8, -84], [-12, -42], [-16, 0]], legR: [[8, -84], [12, -42], [16, 0]],
    },
    reach: {
      head: [2, -172], neck: [0, -150], hip: [0, -84],
      armL: [[-14, -142], [-26, -112], [-30, -82]], armR: [[14, -142], [50, -134], [88, -128]],
      legL: [[-8, -84], [-16, -42], [-26, 0]], legR: [[8, -84], [14, -42], [24, 0]],
    },
    wary: {
      head: [-8, -170], neck: [-4, -148], hip: [0, -84],
      armL: [[-16, -140], [-34, -122], [-40, -140]], armR: [[12, -140], [52, -138], [92, -144]],
      legL: [[-8, -84], [-22, -44], [-36, 0]], legR: [[8, -84], [14, -42], [22, 0]],
    },
    raise: {
      head: [0, -172], neck: [0, -150], hip: [0, -84],
      armL: [[-14, -142], [-26, -112], [-30, -82]], armR: [[14, -142], [36, -164], [42, -198]],
      legL: [[-8, -84], [-12, -42], [-16, 0]], legR: [[8, -84], [12, -42], [16, 0]],
    },
    walk: {
      head: [4, -172], neck: [2, -150], hip: [0, -84],
      armL: [[-14, -142], [-32, -116], [-26, -88]], armR: [[14, -142], [30, -118], [46, -100]],
      legL: [[-6, -84], [-22, -44], [-36, -2]], legR: [[6, -84], [12, -44], [30, 0]],
    },
    carry: {
      head: [4, -172], neck: [2, -150], hip: [0, -84],
      armL: [[-14, -142], [-32, -116], [-26, -88]], armR: [[14, -142], [46, -132], [66, -150]],
      legL: [[-6, -84], [-22, -44], [-36, -2]], legR: [[6, -84], [12, -44], [30, 0]],
    },
    sit: {
      head: [0, -130], neck: [0, -108], hip: [0, -40],
      armL: [[-14, -100], [-36, -74], [-20, -52]], armR: [[14, -100], [36, -74], [22, -52]],
      legL: [[-8, -40], [-44, -18], [10, -6]], legR: [[8, -40], [44, -18], [-10, -6]],
    },
    sitReach: {
      head: [4, -130], neck: [0, -108], hip: [0, -40],
      armL: [[-14, -100], [-36, -74], [-20, -52]], armR: [[14, -100], [46, -90], [76, -84]],
      legL: [[-8, -40], [-44, -18], [10, -6]], legR: [[8, -40], [44, -18], [-10, -6]],
    },
    shield: {
      head: [8, -148], neck: [4, -126], hip: [0, -62],
      armL: [[-10, -118], [22, -100], [52, -94]], armR: [[16, -118], [48, -112], [70, -98]],
      legL: [[-8, -62], [-32, -30], [-26, 0]], legR: [[8, -62], [30, -30], [28, 0]],
    },
    rub: {
      head: [4, -150], neck: [2, -128], hip: [0, -62],
      armL: [[-10, -120], [16, -96], [44, -84]], armR: [[16, -120], [40, -104], [58, -88]],
      legL: [[-8, -62], [-32, -30], [-26, 0]], legR: [[8, -62], [30, -30], [28, 0]],
    },
    cheer: {
      head: [0, -172], neck: [0, -150], hip: [0, -84],
      armL: [[-14, -142], [-36, -170], [-46, -204]], armR: [[14, -142], [36, -170], [46, -204]],
      legL: [[-8, -84], [-14, -42], [-22, 0]], legR: [[8, -84], [14, -42], [22, 0]],
    },
    crouch: {
      head: [14, -128], neck: [8, -108], hip: [-6, -56],
      armL: [[-4, -102], [18, -80], [40, -62]], armR: [[12, -102], [40, -86], [62, -70]],
      legL: [[-12, -56], [-34, -26], [-30, 0]], legR: [[-2, -56], [26, -30], [24, 0]],
    },
  };

  /** A doodle person standing on (0,0). Returns {g, eyes, armR}. */
  function person(parent, x, y, s = 1, o = {}) {
    const g = G(parent, x, y, s, o.flip);
    const P = POSES[o.pose || "stand"];
    const sw = 3.4;
    R.curve(g, P.legL, { strokeWidth: sw + 0.6 });
    R.curve(g, P.legR, { strokeWidth: sw + 0.6 });
    const [nx, ny] = P.neck;
    const [hx, hy] = P.hip;
    R.poly(g, [[nx - 17, ny + 4], [nx + 17, ny + 4], [hx + 24, hy + 2], [hx - 24, hy + 2]], {
      fill: o.tunic || C.ochre,
      hachureGap: 6,
      strokeWidth: 3,
      roughness: 1.1,
    });
    R.curve(g, P.armL, { strokeWidth: sw });
    const armR = el("g", null, g);
    R.curve(armR, P.armR, { strokeWidth: sw });
    const [cx, cy] = P.head;
    R.circle(g, cx, cy, 48, { fill: C.parch, fillStyle: "solid", strokeWidth: 3.2, roughness: 1 });
    // hair tuft
    R.curve(g, [[cx - 20, cy - 10], [cx - 8, cy - 28], [cx + 6, cy - 24], [cx + 20, cy - 12]], { strokeWidth: 3, roughness: 1.6 });
    if (o.species === "neanderthal") R.curve(g, [[cx - 16, cy - 10], [cx + 2, cy - 14], [cx + 22, cy - 8]], { strokeWidth: 4 });
    const eyes = el("g", { class: "eyes" }, g);
    if (o.wide) {
      R.circle(eyes, cx - 8, cy - 2, 14, { fill: "#fff8ea", fillStyle: "solid", strokeWidth: 2 });
      R.circle(eyes, cx + 10, cy - 2, 14, { fill: "#fff8ea", fillStyle: "solid", strokeWidth: 2 });
      el("circle", { cx: cx - 6, cy: cy - 1, r: 3, fill: C.char }, eyes);
      el("circle", { cx: cx + 12, cy: cy - 1, r: 3, fill: C.char }, eyes);
    } else {
      el("circle", { cx: cx - 6, cy: cy - 2, r: 3, fill: C.char }, eyes);
      el("circle", { cx: cx + 10, cy: cy - 2, r: 3, fill: C.char }, eyes);
    }
    if (o.mouth === "o") R.circle(g, cx + 3, cy + 12, 8, { strokeWidth: 2.4 });
    else if (o.mouth === "smile") R.curve(g, [[cx - 4, cy + 10], [cx + 3, cy + 15], [cx + 12, cy + 9]], { strokeWidth: 2.4 });
    else if (o.mouth === "worry") R.curve(g, [[cx - 4, cy + 14], [cx + 3, cy + 10], [cx + 12, cy + 14]], { strokeWidth: 2.4 });
    return { g, eyes, armR };
  }

  /** Big close-up face for emotional beats. */
  function face(parent, x, y, s = 1, o = {}) {
    const g = G(parent, x, y, s);
    R.path(g, "M-120,-10 C-130,-120 -60,-170 10,-165 C90,-160 130,-100 120,0 C115,90 60,140 0,140 C-70,140 -115,90 -120,-10 Z", {
      fill: C.parch,
      fillStyle: "solid",
      strokeWidth: 4,
    });
    R.curve(g, [[-100, -110], [-60, -170], [20, -175], [80, -150], [110, -110]], { strokeWidth: 4, roughness: 1.8 });
    R.curve(g, [[-80, -60], [-50, -76], [-20, -64]], { strokeWidth: 4 }); // brows raised
    R.curve(g, [[20, -64], [50, -78], [80, -62]], { strokeWidth: 4 });
    const eyes = el("g", null, g);
    R.circle(eyes, -48, -28, 50, { fill: "#fff8ea", fillStyle: "solid", strokeWidth: 3 });
    R.circle(eyes, 48, -28, 50, { fill: "#fff8ea", fillStyle: "solid", strokeWidth: 3 });
    const pupils = el("g", null, eyes);
    el("circle", { cx: -40, cy: -26, r: 8, fill: C.char }, pupils);
    el("circle", { cx: 56, cy: -26, r: 8, fill: C.char }, pupils);
    R.curve(g, [[-6, 0], [-14, 36], [6, 42]], { strokeWidth: 3.4 });
    R.ellipse(g, 0, 86, 46, 34, { fill: C.char, fillStyle: "solid", strokeWidth: 3 });
    const sweat = R.path(g, "M126,-80 C120,-60 112,-50 120,-40 C128,-34 138,-44 134,-58 Z", { fill: "#9fb4c0", fillStyle: "solid", strokeWidth: 2.4 });
    return { g, eyes, pupils, sweat };
  }

  const SKIN = "#e8c69c";
  function finger(g, d) {
    el("path", { d, stroke: C.char, "stroke-width": 17, "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" }, g);
    el("path", { d, stroke: SKIN, "stroke-width": 10, "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" }, g);
  }
  /** Forearm entering from the left with a hand at (0,0); flip to enter from the right. */
  function hand(parent, x, y, s = 1, o = {}) {
    const g = G(parent, x, y, s, o.flip);
    R.path(g, "M-330,-34 C-220,-36 -120,-30 -40,-24 L-38,26 C-120,30 -220,40 -330,42 Z", { fill: SKIN, fillStyle: "solid", strokeWidth: 3.6, roughness: 0.9 });
    R.poly(g, [[-340, -40], [-250, -38], [-248, 46], [-340, 48]], { fill: C.ochre, hachureGap: 6, strokeWidth: 3.4 });
    const fingers = o.grip
      ? ["M24,-26 C52,-30 58,-8 38,-4", "M28,-6 C56,-8 60,14 38,16", "M22,14 C48,16 50,34 30,34"]
      : ["M26,-26 C54,-44 80,-50 104,-50", "M34,-10 C66,-18 96,-18 118,-14", "M34,6 C66,6 96,10 114,16", "M24,22 C52,30 76,38 94,46"];
    const fg = el("g", null, g);
    fingers.forEach((d) => finger(fg, d));
    R.path(g, "M-44,-28 C-20,-42 18,-40 34,-26 C46,-12 46,16 30,28 C10,38 -24,36 -42,26 Z", { fill: SKIN, fillStyle: "solid", strokeWidth: 3.4, roughness: 0.8 });
    finger(fg.parentNode, o.grip ? "M-10,-30 C8,-50 30,-44 34,-30" : "M-12,-30 C2,-60 20,-74 40,-82");
    return g;
  }

  // ------------------------------------------------------- animals ---
  function deer(parent, x, y, s = 1, flip = false) {
    const g = G(parent, x, y, s, flip);
    R.ellipse(g, 0, -80, 130, 50, { fill: C.ochre, hachureGap: 7, strokeWidth: 3 });
    R.curve(g, [[-50, -92], [-74, -120], [-86, -150]], { strokeWidth: 4 });
    R.ellipse(g, -98, -154, 44, 22, { fill: C.ochreLight, hachureGap: 6, strokeWidth: 3 });
    R.curve(g, [[-88, -166], [-80, -196], [-60, -210]], { strokeWidth: 2.6 });
    R.curve(g, [[-82, -190], [-100, -206]], { strokeWidth: 2.6 });
    R.curve(g, [[-36, -64], [-70, -40], [-104, -30]], { strokeWidth: 3.4 });
    R.curve(g, [[-24, -62], [-40, -30], [-30, 0]], { strokeWidth: 3.4 });
    R.curve(g, [[40, -66], [70, -40], [100, -40]], { strokeWidth: 3.4 });
    R.curve(g, [[50, -64], [44, -30], [60, 0]], { strokeWidth: 3.4 });
    R.curve(g, [[62, -96], [80, -110], [84, -100]], { strokeWidth: 2.6 });
    el("circle", { cx: -104, cy: -158, r: 3, fill: C.char }, g);
    return g;
  }
  function bird(parent, x, y, s = 1) {
    const g = G(parent, x, y, s);
    R.curve(g, [[-30, 0], [-14, -14], [0, 0]], { strokeWidth: 3 });
    R.curve(g, [[0, 0], [14, -14], [30, 0]], { strokeWidth: 3 });
    return g;
  }
  function bigCat(parent, x, y, s = 1, flip = false) {
    const g = G(parent, x, y, s, flip);
    R.path(g, "M-120,-40 C-120,-90 60,-100 90,-70 C110,-50 100,-20 90,-10 L-110,-10 C-120,-20 -122,-30 -120,-40 Z", { fill: C.ochre, hachureGap: 7, strokeWidth: 3.2 });
    R.circle(g, 110, -80, 70, { fill: C.ochreLight, hachureGap: 6, strokeWidth: 3.2 });
    R.poly(g, [[86, -106], [92, -128], [104, -110]], { strokeWidth: 2.6 });
    R.poly(g, [[116, -112], [128, -130], [134, -108]], { strokeWidth: 2.6 });
    el("circle", { cx: 124, cy: -86, r: 3.4, fill: C.char }, g);
    R.curve(g, [[128, -64], [138, -60], [144, -66]], { strokeWidth: 2.4 });
    R.curve(g, [[-120, -50], [-170, -60], [-190, -100]], { strokeWidth: 3.4 });
    [[-90, -10], [-60, -10], [40, -10], [70, -10]].forEach(([lx]) => R.line(g, lx, -14, lx - 6, 16, { strokeWidth: 4 }));
    return g;
  }
  function insect(parent, x, y, s = 1) {
    const g = G(parent, x, y, s);
    R.ellipse(g, 0, 0, 30, 16, { fill: C.char, fillStyle: "solid", strokeWidth: 2 });
    R.ellipse(g, -6, -14, 22, 14, { strokeWidth: 2 });
    R.ellipse(g, 8, -14, 22, 14, { strokeWidth: 2 });
    return g;
  }
  function fish(parent, x, y, s = 1, o = {}) {
    const g = G(parent, x, y, s);
    R.path(g, "M-110,0 C-60,-50 40,-50 80,0 C40,50 -60,50 -110,0 Z", { fill: o.fill || C.ashLight, hachureGap: 8, strokeWidth: 3.4 });
    R.poly(g, [[80, 0], [130, -36], [124, 0], [130, 36]], { fill: o.fill || C.ashLight, hachureGap: 8, strokeWidth: 3.4 });
    el("circle", { cx: -76, cy: -8, r: 4, fill: C.char }, g);
    R.curve(g, [[-40, -24], [-30, 0], [-40, 24]], { strokeWidth: 2.4 });
    return g;
  }

  // --------------------------------------------------------- objects ---
  function bone(parent, x, y, s = 1, o = {}) {
    const g = G(parent, x, y, s);
    const fill = o.fill || C.parch;
    R.path(g, "M-90,-10 L90,-10 L90,10 L-90,10 Z", { fill, fillStyle: "solid", strokeWidth: 3 });
    [[-100, -14], [-100, 14], [100, -14], [100, 14]].forEach(([cx, cy]) => R.circle(g, cx, cy, 32, { fill, fillStyle: "solid", strokeWidth: 3 }));
    if (o.burnt) {
      R.rect(g, -110, -30, 220, 60, { stroke: "none", fill: C.char, hachureGap: 6, fillWeight: 2.4 });
    }
    return g;
  }
  function handaxe(parent, x, y, s = 1, o = {}) {
    const g = G(parent, x, y, s);
    R.path(g, "M0,-90 C40,-70 56,-10 44,40 C34,70 -34,70 -44,40 C-56,-10 -40,-70 0,-90 Z", { fill: o.fill || C.ash, hachureGap: 7, strokeWidth: 3.4 });
    R.lines(g, [[0, -80], [-12, -40], [4, 0], [-8, 40]], { strokeWidth: 2 });
    R.lines(g, [[-30, -20], [-10, -8], [-26, 20]], { strokeWidth: 2 });
    R.lines(g, [[30, -30], [14, 0], [30, 30]], { strokeWidth: 2 });
    return g;
  }
  function flint(parent, x, y, s = 1, o = {}) {
    const g = G(parent, x, y, s);
    R.poly(g, [[-60, 10], [-40, -36], [10, -50], [56, -20], [50, 24], [0, 36]], { fill: o.fill || C.ashLight, hachureGap: 7, strokeWidth: 3.2 });
    if (o.cracked) {
      R.lines(g, [[-30, -30], [-6, -6], [-16, 20], [4, 34]], { stroke: C.ember, strokeWidth: 3.2 });
      R.lines(g, [[-6, -6], [24, -10], [44, 6]], { stroke: C.ember, strokeWidth: 3 });
    }
    return g;
  }
  function pyrite(parent, x, y, s = 1) {
    const g = G(parent, x, y, s);
    R.poly(g, [[-40, 20], [-44, -20], [-6, -44], [38, -30], [44, 14], [8, 38]], { fill: C.yolk, hachureGap: 6, strokeWidth: 3.2, hachureAngle: 20 });
    R.lines(g, [[-44, -20], [-4, -4], [38, -30]], { strokeWidth: 2.2 });
    R.line(g, -4, -4, 8, 38, { strokeWidth: 2.2 });
    return g;
  }
  function seedPod(parent, x, y, s = 1) {
    const g = G(parent, x, y, s);
    R.ellipse(g, 0, 0, 30, 18, { fill: C.char, hachureGap: 4, strokeWidth: 2.4 });
    return g;
  }
  function twig(parent, x, y, s = 1, rot = 0) {
    const g = G(parent, x, y, s);
    g.setAttribute("transform", `rotate(${rot})`);
    R.line(g, -40, 0, 40, 0, { strokeWidth: 6, stroke: C.charSoft });
    R.line(g, 10, 0, 26, -14, { strokeWidth: 3 });
    return g;
  }
  function magnifier(parent, x, y, s = 1) {
    const g = G(parent, x, y, s);
    R.circle(g, 0, 0, 170, { strokeWidth: 6, fill: "#fff6de", fillStyle: "solid" });
    R.line(g, 60, 60, 150, 150, { strokeWidth: 16, stroke: C.charSoft });
    R.curve(g, [[-50, -30], [-40, -50], [-20, -60]], { strokeWidth: 3, stroke: C.ash });
    return g;
  }
  function pin(parent, x, y, s = 1, color = C.ember) {
    const g = G(parent, x, y, s);
    R.path(g, "M0,0 C-10,-24 -30,-40 -30,-62 C-30,-82 -16,-94 0,-94 C16,-94 30,-82 30,-62 C30,-40 10,-24 0,0 Z", { fill: color, fillStyle: "solid", strokeWidth: 3 });
    R.circle(g, 0, -62, 20, { fill: C.parch, fillStyle: "solid", strokeWidth: 2.4 });
    return g;
  }
  function xMark(parent, x, y, s = 1, color = C.ember) {
    const g = G(parent, x, y, s);
    R.line(g, -120, -110, 120, 110, { stroke: color, strokeWidth: 16, roughness: 1.2 });
    R.line(g, 120, -110, -120, 110, { stroke: color, strokeWidth: 16, roughness: 1.2 });
    return g;
  }
  function stamp(parent, text, x, y, o = {}) {
    const g = G(parent, x, y, 1);
    g.setAttribute("transform", `rotate(${o.rotate ?? -7})`);
    const w = o.w || 640;
    R.rect(g, -w / 2, -60, w, 120, { stroke: o.color || C.ember, strokeWidth: 7, roughness: 1.8 });
    R.rect(g, -w / 2 + 14, -46, w - 28, 92, { stroke: o.color || C.ember, strokeWidth: 3, roughness: 1.4 });
    const t = el("text", { x: 0, y: 18, "font-family": "Caveat Brush", "font-size": o.size || 54, fill: o.color || C.ember, "text-anchor": "middle", "letter-spacing": 2 }, g);
    t.textContent = text;
    return g;
  }
  function speechBubble(parent, x, y, text, o = {}) {
    const g = G(parent, x, y, 1);
    const w = o.w || 300;
    R.path(g, `M${-w / 2},-50 C${-w / 2},-100 ${w / 2},-100 ${w / 2},-50 C${w / 2},0 ${-w / 4},10 -30,0 L-70,40 L-60,-4 C${-w / 2},-10 ${-w / 2},-30 ${-w / 2},-50 Z`, {
      fill: "#fff6de",
      fillStyle: "solid",
      strokeWidth: 3.4,
    });
    const t = el("text", { x: 0, y: -38, "font-family": "Caveat Brush", "font-size": o.size || 46, fill: C.char, "text-anchor": "middle" }, g);
    t.textContent = text;
    return g;
  }
  function bundle(parent, x, y, s = 1) {
    const g = G(parent, x, y, s);
    R.path(g, "M-90,0 C-100,-60 -30,-80 0,-70 C40,-80 100,-60 90,0 C80,40 -80,40 -90,0 Z", { fill: C.ochre, hachureGap: 6, strokeWidth: 3.2 });
    R.curve(g, [[-80, -20], [-20, -50], [60, -40]], { strokeWidth: 2.4 });
    R.curve(g, [[-70, 10], [0, -14], [80, 0]], { strokeWidth: 2.4 });
    R.line(g, -10, -70, 10, 32, { strokeWidth: 4, stroke: C.charSoft });
    return g;
  }
  function pot(parent, x, y, s = 1) {
    const g = G(parent, x, y, s);
    R.path(g, "M-110,-100 L110,-100 C120,-20 80,40 0,40 C-80,40 -120,-20 -110,-100 Z", { fill: C.ochre, hachureGap: 8, strokeWidth: 3.6 });
    R.ellipse(g, 0, -100, 230, 34, { fill: C.charSoft, hachureGap: 5, strokeWidth: 3.4 });
    return g;
  }
  function spear(parent, x, y, s = 1) {
    const g = G(parent, x, y, s);
    R.line(g, -260, 30, 220, -30, { strokeWidth: 8, stroke: C.ochre, roughness: 0.8 });
    R.line(g, -260, 30, 220, -30, { strokeWidth: 3, roughness: 0.8 });
    R.poly(g, [[220, -30], [290, -44], [226, -14]], { fill: C.char, fillStyle: "solid", strokeWidth: 3 });
    return g;
  }
  function moon(parent, x, y, s = 1) {
    const g = G(parent, x, y, s);
    R.path(g, "M20,-60 C-40,-60 -60,0 -40,36 C-20,70 40,74 70,40 C20,50 -10,10 20,-60 Z", { fill: C.ashLight, hachureGap: 7, strokeWidth: 3.2 });
    return g;
  }
  function star(parent, x, y, s = 1) {
    const g = G(parent, x, y, s);
    R.line(g, -12, 0, 12, 0, { strokeWidth: 2.6 });
    R.line(g, 0, -12, 0, 12, { strokeWidth: 2.6 });
    return g;
  }
  function sunIcon(parent, x, y, s = 1) {
    const g = G(parent, x, y, s);
    R.circle(g, 0, 0, 90, { fill: C.yolk, hachureGap: 7, strokeWidth: 3.4 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      R.line(g, Math.cos(a) * 62, Math.sin(a) * 62, Math.cos(a) * 92, Math.sin(a) * 92, { strokeWidth: 3.4 });
    }
    return g;
  }
  function wavy(parent, x, y, w, o = {}) {
    const pts = [];
    for (let i = 0; i <= 8; i++) pts.push([x + (w * i) / 8, y + (i % 2 ? -(o.amp || 10) : o.amp || 10)]);
    return R.curve(parent, pts, { strokeWidth: o.w || 3, stroke: o.color || C.char });
  }

  // ------------------------------------------------------------ maps ---
  const AFRICA = [
    [-6, 36], [10, 37.2], [11, 33.5], [20, 31], [25, 32], [32, 31.3], [34.2, 28], [38.5, 18], [43, 12.5], [51, 11.8], [48, 5], [41, -2],
    [40, -10], [40.5, -15], [35.3, -23], [32.6, -28.5], [27, -34], [20, -34.8], [18.3, -34], [15, -27], [11.8, -17], [13.2, -9], [9, -1],
    [9.4, 4], [4, 6.3], [-4, 5.2], [-8, 4.4], [-13, 8], [-17, 14.5], [-16, 20], [-17, 21], [-13, 27.5], [-10, 30], [-9.2, 33], [-6, 36],
  ];
  const MADAGASCAR = [[49.3, -12], [50.4, -15.5], [47.2, -25], [44, -24.5], [44, -17], [49.3, -12]];
  const ARABIA = [[34.2, 28], [35, 28.5], [36.2, 33.8], [35.9, 35.9], [36.2, 36.9], [42, 37.1], [48, 30], [51, 26], [56.4, 26.2], [59.8, 22.5], [52, 16.5], [45, 12.8], [43.3, 13], [39, 21.5], [34.2, 28]];
  const LEVANT_COAST = [[32.2, 31.2], [34.3, 31.3], [34.9, 32.6], [35.1, 33.1], [35.5, 33.9], [35.9, 35.3], [35.9, 36.2], [36.2, 36.8], [34.2, 36.6], [32, 36.1], [29.6, 36.2]];
  const BRITAIN = [
    [-5.7, 50.05], [-4.2, 50.35], [-3.4, 50.6], [-1.2, 50.75], [1.4, 51.15], [1.45, 51.4], [0.9, 51.8], [1.75, 52.5], [1.6, 52.9], [0.3, 52.9],
    [0.3, 53.5], [-0.1, 53.6], [-0.6, 54.5], [-1.4, 54.9], [-1.6, 55.6], [-2.2, 56.0], [-2.9, 56.3], [-2.0, 57.2], [-1.8, 57.6], [-3.3, 57.7],
    [-3.1, 58.6], [-5.0, 58.6], [-5.6, 57.6], [-5.8, 56.6], [-5.4, 55.7], [-4.9, 54.8], [-3.5, 54.9], [-3.2, 54.1], [-2.9, 53.4], [-4.6, 53.3],
    [-4.1, 52.9], [-4.1, 52.3], [-5.2, 51.75], [-3.2, 51.45], [-4.2, 51.2], [-5.7, 50.05],
  ];
  const IRELAND = [[-6.0, 52.2], [-6.1, 53.9], [-5.6, 54.6], [-7.3, 55.3], [-8.5, 54.9], [-10.0, 54.0], [-9.9, 52.1], [-9.5, 51.6], [-8.2, 51.7], [-6.0, 52.2]];
  const FRANCE = [
    [1.6, 50.95], [0.2, 49.6], [-1.2, 49.3], [-1.9, 49.7], [-1.6, 48.7], [-4.7, 48.5], [-4.3, 47.8], [-2.2, 47.2], [-1.2, 46.1], [-1.4, 44.5], [-1.6, 43.4],
    [0.7, 42.8], [3.1, 42.45], [3.3, 43.3], [4.7, 43.4], [6.2, 43.1], [7.5, 43.8], [6.9, 45.2], [7.0, 45.9], [6.1, 46.2], [6.9, 47.5], [7.6, 47.6], [8.2, 48.9],
    [6.4, 49.5], [4.8, 50.1], [4.2, 49.95], [2.5, 51.1], [1.6, 50.95],
  ];

  /** Equirectangular projection helper: map {lon0, lat0, k} → function(lon,lat) → [x,y]. */
  function proj(lon0, lat0, k, ox, oy) {
    const c = Math.cos((lat0 * Math.PI) / 180);
    return (lon, lat) => [ox + (lon - lon0) * k * c, oy - (lat - lat0) * k];
  }
  function land(parent, pts, P, o = {}) {
    return R.poly(
      parent,
      pts.map(([a, b]) => P(a, b)),
      { fill: o.fill || C.ochreLight, hachureGap: o.gap || 10, hachureAngle: o.angle || -30, strokeWidth: o.w || 3.4, roughness: o.roughness || 1.1, fillWeight: 1.5 },
    );
  }

  /** Dashed hand-drawn travel line along a curve. */
  function travel(parent, pts, color = C.ember) {
    const g = R.curve(parent, pts, { stroke: color, strokeWidth: 5, roughness: 0.8 });
    return g;
  }

  function particles(parent, n, box, seed, fn) {
    const rnd = mulberry32(seed);
    const g = el("g", null, parent);
    const items = [];
    for (let i = 0; i < n; i++) {
      const x = box[0] + rnd() * box[2];
      const y = box[1] + rnd() * box[3];
      items.push(fn(g, x, y, rnd, i));
    }
    return { g, items, rnd };
  }

  window.Doodle = {
    C, R, G, el, NS, mulberry32, setTimeline, init() { gen = rough.generator(); },
    draw, show, hide, pop, move, slideIn, flicker, pulse, blink, write, glow,
    flame, logs, stones, campfire, tree, pine, bolt, hills, grass, volcano, smokePuff, cloud, rain, tuber, branch,
    person, face, hand, deer, bird, bigCat, insect, fish, bone, handaxe, flint, pyrite, seedPod, twig, magnifier, pin,
    xMark, stamp, speechBubble, bundle, pot, spear, moon, star, sunIcon, wavy, proj, land, travel, particles,
    MAPS: { AFRICA, MADAGASCAR, ARABIA, LEVANT_COAST, BRITAIN, IRELAND, FRANCE },
    nextId,
  };
})();
