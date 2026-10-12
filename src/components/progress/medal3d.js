// ── MedalStage: a medal reveal in hand-written WebGL1, no library ─────
//
// Loaded on demand (import()) by MedalReveal.jsx — only when a medal is
// actually shown, so a summary without one never fetches a byte of it.
//
//   const stage = MedalStage(host, { font, date, reduced, labels, onLand, onFallback })
//   stage.webgl          false → no WebGL here: the host draws its flat medal
//   stage.prepare(list)  build the geometry + bake the relief ahead of time
//   stage.play(list)     list: [{ title, word, rarity, art, glyph, n }]
//                        art = image URL from the pack, or null → a composed face
//                        glyph = an SVG path (256 box), n = the engraved number
//   stage.skip()         land everything now, facing front, labels shown
//   stage.resize()       after the host changes size
//   stage.pause()/resume()  stop drawing while off screen
//   stage.destroy()      free every GPU object and the context
//
//   onLand(i, item)      each medal as it lands (sound, haptic) — not on skip()
//   onFallback()         the context was lost and never came back: the GPU
//                        side is already freed, the host shows its flat medal
//
// The art is a flat 512² badge. It becomes a coin:
//   • the rim is real geometry: a strip extruded along the alpha contour
//     (marching squares → Douglas–Peucker), rounded across its thickness,
//     reeded along it, coloured from the art just inside the edge;
//   • the front is relit per pixel from a normal map baked once on the GPU
//     (blurred alpha → bevel, luminance → carving, central differences);
//     painted fire and enamel are masked out of the metal so they keep
//     their colour, and highlights roll off without changing hue;
//   • the back is a metal plate in the same silhouette, engraved with
//     «مران», the title and the date.
// The host owns layout: the canvas and the labels sit inside it, so the
// effects are clipped to the stage and never cover the heading above.
const TAU = Math.PI * 2, H = .1, FLOOR = -1.3, DIST = Math.hypot(.6, 8)
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v
const ease = (u) => 1 - Math.pow(1 - clamp(u), 3)
const RAR = {
  common:    { w: 'عادي',   turns: 2, heavy: 0,   flare: 0, sparks: 0,  rays: 0,   met: .5,  gs: .45, tint: [1, 1, 1] },
  rare:      { w: 'نادر',   turns: 2, heavy: 0,   flare: 1, sparks: 0,  rays: 0,   met: .9,  gs: 1.1, tint: [.72, .88, 1.3] },
  epic:      { w: 'ملحمي',  turns: 3, heavy: 1,   flare: 1, sparks: 44, rays: .5,  met: 1,   gs: 1,   tint: [1.25, 1, .66] },
  legendary: { w: 'أسطوري', turns: 3, heavy: 1.6, flare: 1, sparks: 90, rays: .85, met: 1,   gs: 1,   tint: [1.3, .95, .58] },
}
const FLAME = 'M173.79,51.48a221.25,221.25,0,0,0-41.67-34.34,8,8,0,0,0-8.24,0A221.25,221.25,0,0,0,82.21,51.48C54.59,80.48,40,112.47,40,144a88,88,0,0,0,176,0C216,112.47,201.41,80.48,173.79,51.48ZM96,184c0-27.67,22.53-47.28,32-54.3,9.48,7,32,26.63,32,54.3a32,32,0,0,1-64,0Z'
const SLOT = [[1, -.16, .64], [-1, -.16, .64]]   // a pair: first on the right (RTL), second on the left

// ── image analysis (CPU, once per medal, shared by every stage) ─────
function contours(A, n, th) {
  const W = n + 2, G = new Float32Array(W * W), P = new Map(), S = []
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) G[(y + 1) * W + x + 1] = A[y * n + x]
  const pt = (id) => {
    let p = P.get(id); if (p) return p
    const k = id >> 1, x = k % W, y = (k / W) | 0, a = G[k], b = id & 1 ? G[k + W] : G[k + 1], t = (th - a) / (b - a)
    P.set(id, p = id & 1 ? [x, y + t] : [x + t, y]); return p
  }
  for (let y = 0; y < W - 1; y++) for (let x = 0; x < W - 1; x++) {
    const i = y * W + x, a = G[i], b = G[i + 1], c = G[i + W + 1], d = G[i + W]
    const m = (a > th) << 3 | (b > th) << 2 | (c > th) << 1 | (d > th)
    if (!m || m === 15) continue
    const T = i * 2, B = (i + W) * 2, L = i * 2 + 1, R = (i + 1) * 2 + 1, ctr = (a + b + c + d) / 4 > th
    switch (m) {
      case 1: case 14: S.push(L, B); break
      case 2: case 13: S.push(B, R); break
      case 3: case 12: S.push(L, R); break
      case 4: case 11: S.push(T, R); break
      case 6: case 9: S.push(T, B); break
      case 7: case 8: S.push(T, L); break
      case 5: ctr ? S.push(T, L, B, R) : S.push(T, R, L, B); break
      case 10: ctr ? S.push(T, R, L, B) : S.push(T, L, B, R)
    }
  }
  const adj = new Map(), used = new Uint8Array(S.length >> 1), loops = []
  S.forEach((e, j) => { const l = adj.get(e); l ? l.push(j) : adj.set(e, [j]) })
  for (let s = 0; s < used.length; s++) {
    if (used[s]) continue
    const lp = []
    for (let j = 2 * s; ;) {
      used[j >> 1] = 1; lp.push(pt(S[j]))
      const o = j ^ 1, l = adj.get(S[o]), nj = l[0] === o ? l[1] : l[0]
      if (nj === undefined || used[nj >> 1]) break
      j = nj
    }
    loops.push(lp)
  }
  return { loops, G, W }
}
function simplify(p, eps) {
  const dp = (q) => {
    const keep = new Uint8Array(q.length), st = [[0, q.length - 1]]; keep[0] = keep[q.length - 1] = 1
    while (st.length) {
      const [a, b] = st.pop(), [ax, ay] = q[a], dx = q[b][0] - ax, dy = q[b][1] - ay, L = Math.hypot(dx, dy) || 1e-9
      let md = 0, mi = -1
      for (let i = a + 1; i < b; i++) { const d = Math.abs((q[i][0] - ax) * dy - (q[i][1] - ay) * dx) / L; if (d > md) { md = d; mi = i } }
      if (md > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]) }
    }
    return q.filter((_, i) => keep[i])
  }
  let k = 0, f = 0
  p.forEach((q, i) => { const d = (q[0] - p[0][0]) ** 2 + (q[1] - p[0][1]) ** 2; if (d > f) { f = d; k = i } })
  return dp(p.slice(0, k + 1)).concat(dp(p.slice(k).concat([p[0]])).slice(1, -1))
}
const area = (p) => p.reduce((s, q, i) => { const r = p[(i + 1) % p.length]; return s + q[0] * r[1] - r[0] * q[1] }, 0) / 2

// the rim: one strip per contour loop, 5 rings across the thickness
function rim(cs, n, px) {
  const { loops, G, W } = cs, V = [], I = [], cols = [0, 0, 0, 0]
  const ring = [[H, 1], [H * .6, .45], [0, 0], [-H * .6, -.45], [-H, -1]]
  let tip = [0, 1], best = -9
  for (let lp of loops) {
    if (Math.abs(area(lp)) < 10) continue
    lp = simplify(lp, .45)
    const m = lp.length; if (m < 4) continue
    let vote = 0   // which side is empty? sample the field just off a few segments
    for (let i = 0; i < m; i += Math.max(1, m >> 3)) {
      const p = lp[i], q = lp[(i + 1) % m], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1
      const sx = Math.round((p[0] + q[0]) / 2 + dy / L * .9), sy = Math.round((p[1] + q[1]) / 2 - dx / L * .9)
      vote += G[clamp(sy, 0, W - 1) * W + clamp(sx, 0, W - 1)] < .5 ? 1 : -1
    }
    const o = vote >= 0 ? 1 : -1
    const P = lp.map(([gx, gy]) => { const u = (gx - .5) / n, v = (gy - .5) / n; return [u * 2 - 1, 1 - v * 2, u, v] })
    const N = P.map((p, i) => { const q = P[(i + 1) % m], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1; return [-dy / L * o, dx / L * o] })
    const sm = (a, b) => { if (a[0] * b[0] + a[1] * b[1] < .8) return a; const x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y); return [x / l, y / l] }
    let s = 0
    for (let i = 0; i < m; i++) {
      const p = P[i], q = P[(i + 1) % m], nn = N[i], na = sm(nn, N[(i + m - 1) % m]), nb = sm(nn, N[(i + 1) % m]), len = Math.hypot(q[0] - p[0], q[1] - p[1]), b = V.length / 9
      for (const [z, a] of ring) for (const [pp, nm, ss] of [[p, na, s], [q, nb, s + len]]) {
        const c = Math.cos(a), sn = Math.sin(a)
        V.push(pp[0], pp[1], z, nm[0] * c, nm[1] * c, sn, pp[2] - nm[0] * .012, pp[3] + nm[1] * .012, ss)
      }
      for (let r = 0; r < 4; r++) { const a = b + r * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
      s += len
      const sc = p[0] * .55 + p[1]; if (sc > best) { best = sc; tip = [p[0], p[1]] }
      const ix = clamp(Math.round((p[2] - nn[0] * .02) * (n - 1)), 0, n - 1), iy = clamp(Math.round((p[3] + nn[1] * .02) * (n - 1)), 0, n - 1), k = (iy * n + ix) * 4
      if (px[k + 3] > 200) { cols[0] += px[k]; cols[1] += px[k + 1]; cols[2] += px[k + 2]; cols[3]++ }
    }
  }
  let c = cols[3] ? cols.slice(0, 3).map(v => v / cols[3] / 255) : [.6, .6, .6]
  const l = c[0] * .3 + c[1] * .59 + c[2] * .11; c = c.map(v => l + (v - l) * .72)   // a plate, not enamel: a little less saturated than the rim
  return { V: new Float32Array(V), I: new Uint16Array(I), tip, back: c }
}

const canvas = (n) => { const c = document.createElement('canvas'); c.width = c.height = n; return c }
// no art pack: the app's composed medal (Medal.jsx + medalFace): lit disc, glyph, engraved number, rarity bezel
function face(it, font) {
  const cv = canvas(512), x = cv.getContext('2d'), r = it.rarity
  const g = (c0, c1, c2) => { const l = x.createLinearGradient(60, 40, 452, 472); l.addColorStop(0, c0); l.addColorStop(.5, c1); l.addColorStop(1, c2); return l }
  const bz = { common: ['#6B747F', '#3A4048', '#22272D'], rare: ['#E8EDF2', '#8D98A5', '#4E5763'], epic: ['#B9C2CC', '#5D6772', '#2A3038'], legendary: ['#D7DEE5', '#6E7884', '#2E343B'] }[r] || ['#6B747F', '#3A4048', '#22272D']
  x.beginPath(); x.arc(256, 256, 246, 0, TAU); x.fillStyle = g(...bz); x.fill()
  const d = x.createRadialGradient(190, 150, 0, 256, 256, 206); d.addColorStop(0, '#3B424B'); d.addColorStop(.52, '#1D2126'); d.addColorStop(1, '#14171B')
  x.beginPath(); x.arc(256, 256, 204, 0, TAU); x.fillStyle = d; x.fill()
  const acc = r === 'epic' || r === 'legendary'
  if (acc) { x.lineWidth = 7; x.strokeStyle = '#5EC32A'; x.beginPath(); x.arc(256, 256, 214, 0, TAU); x.stroke() }
  if (r === 'legendary') { x.lineWidth = 4; x.beginPath(); x.arc(256, 256, 240, 0, TAU); x.stroke() }
  const path = new Path2D(it.glyph === 'F' || !it.glyph ? FLAME : it.glyph)
  x.fillStyle = acc ? '#5EC32A' : '#F4F6F8'
  // no number to engrave (a yes/no badge): the glyph alone, larger, centred — Medal.jsx's md-solo
  if (it.n) { x.save(); x.translate(256 - 66, 92); x.scale(.52, .52); x.fill(path); x.restore() }
  else { x.save(); x.translate(256 - 100, 156); x.scale(.78, .78); x.fill(path); x.restore() }
  if (it.n) {
    x.fillStyle = '#F4F6F8'; x.textAlign = 'center'
    const s = it.n.length > 3 ? 112 : 150
    x.font = `800 ${s}px ${font}`; x.fillText(it.n, 256, 380)
  }
  return cv
}
// the back plate: «مران», the title and the date, mirrored so it reads from behind
function engrave(it, n, font, date) {
  const cv = canvas(n), x = cv.getContext('2d'), s = n / 512
  x.translate(n, 0); x.scale(-s, s); x.fillStyle = x.strokeStyle = '#fff'; x.textAlign = 'center'; x.direction = 'rtl'
  const fit = (t, f, px, y) => { x.font = `${f} ${px}px ${font}`; const w = x.measureText(t).width; if (w > 290) x.font = `${f} ${px * 290 / w}px ${font}`; x.fillText(t, 256, y) }
  fit('مران', 600, 30, 178)
  fit(it.title || '', 800, 58, 278)
  if (date) fit(date, 600, 30, 338)
  x.lineWidth = 3; x.beginPath(); x.moveTo(196, 300); x.lineTo(316, 300); x.stroke()
  x.lineWidth = 4; x.beginPath(); x.arc(256, 256, 168, 0, TAU); x.stroke()
  return cv
}
// The pictures a medal is built from (its face, its 1024px back plate and
// the outline), kept for the few medals seen last so reopening one is
// instant — never all of them: each holds ~5 MB of canvas, and an iOS
// home-screen app lives for days (iOS also refuses new canvases past its
// memory cap). A stage still showing an older one keeps its own copy.
const ASSETS_KEPT = 4
const assets = new Map()
function load(it, font, date) {
  const key = (it.art || `face:${it.rarity}:${it.n}:${it.glyph}`) + '|' + it.title + '|' + date
  if (assets.has(key)) {
    const hit = assets.get(key)
    assets.delete(key); assets.set(key, hit)   // the most recently used goes last
    return hit
  }
  while (assets.size >= ASSETS_KEPT) assets.delete(assets.keys().next().value)
  const p = (async () => {
    let src = null
    if (it.art) { try { src = new Image(); src.src = it.art; await src.decode() } catch (e) { src = null } }
    if (!src) src = face(it, font)   // a broken pack file draws the composed medal, like <Art> does
    const m = 256, cv = canvas(m), cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(src, 0, 0, m, m)
    const px = cx.getImageData(0, 0, m, m).data, A = new Float32Array(m * m)
    for (let i = 0; i < m * m; i++) A[i] = px[i * 4 + 3] / 255
    return { key, src, eng: engrave(it, 1024, font, date), ...rim(contours(A, m, .5), m, px) }
  })()
  assets.set(key, p); p.catch(() => assets.delete(key))
  return p
}

// ── tiny matrix kit (column-major) ──────────────────────────────────
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s } return o }
function pose(m) { // T · Ry · Rx · S
  const a = m.yaw + m.iy, b = m.pitch + m.ip, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), s = m.s
  const R = [ca, 0, -sa, sa * sb, cb, ca * sb, sa * cb, -sb, ca * cb]
  return { R: new Float32Array(R), M: new Float32Array([R[0] * s, R[1] * s, R[2] * s, 0, R[3] * s, R[4] * s, R[5] * s, 0, R[6] * s, R[7] * s, R[8] * s, 0, m.wx, m.wy, m.z, 1]) }
}

// ── shaders ─────────────────────────────────────────────────────────
const VS = `attribute vec3 aP,aN;attribute vec2 aU;attribute float aS;uniform mat4 uVP,uM;uniform mat3 uR;varying vec3 vW,vN,vT,vL;varying vec2 vU;varying float vS;
void main(){vec4 w=uM*vec4(aP,1.);vW=w.xyz;vN=uR*aN;vT=uR*vec3(-aN.y,aN.x,0.);vL=aP;vU=aU;vS=aS;gl_Position=uVP*w;}`
// shade(albedo, normal, metal, ambient, emissive): a studio strip + key + a tinted rim light, the glint
// band, then a soft roll-off: per channel on metal (gold highlights go pale, like gold), hue-preserving
// on painted fire (orange stays orange instead of clipping to yellow-white)
const LIT = `precision highp float;uniform vec3 uEye,uTint;uniform float uOp,uSw,uMet,uGs;uniform mat3 uR;varying vec3 vW,vN,vT,vL;varying vec2 vU;varying float vS;
vec3 env(vec3 r){float az=atan(r.x,r.z);
vec3 c=mix(vec3(.02,.022,.026),vec3(.12,.13,.145),smoothstep(-.3,.45,r.y));
c+=vec3(1.,.97,.92)*1.6*smoothstep(.5,.92,r.y);
c+=vec3(1.3)*exp(-(az-1.)*(az-1.)*16.)*smoothstep(-.35,.15,r.y);
c+=uTint*exp(-(az+1.8)*(az+1.8)*9.)*smoothstep(-.4,.25,r.y);
c+=uTint*.5*exp(-(abs(az)-2.9)*(abs(az)-2.9)*8.);return c;}
vec3 tone(vec3 c,float e){float m=max(c.r,max(c.g,c.b));vec3 pc=mix(c,.8+.2*(1.-exp(-(c-.8)/.2)),step(.8,c));
vec3 hp=m<=.8?c:c*((.8+.2*(1.-exp(-(m-.8)/.2)))/m);return mix(pc,hp,e);}
vec3 shade(vec3 a,vec3 N,float m,float k,float e){
vec3 V=normalize(uEye-vW),L=normalize(vec3(-.5,.75,.55)),H=normalize(L+V),R=reflect(-V,N);
float d=max(dot(N,L),0.),f=pow(1.-abs(dot(N,V)),4.),q=1.-.88*e;
vec3 t=mix(vec3(1.),a/max(max(a.r,max(a.g,a.b)),.04),.75*m);
vec3 c=a*(k+.62*d*q+.26*e)+(t*env(R)*(.1+.8*m)*(1.+2.*f)+t*pow(max(dot(N,H),0.),30.+90.*m)*(.2+1.3*m))*q;
c+=uTint*a*pow(max(dot(N,normalize(vec3(.75,.2,-.6))),0.),2.)*.7*q;
float b=dot(vL.xy,vec2(.83,.55))-uSw;c+=mix(t*uTint,vec3(1.),.4)*(exp(-b*b*90.)*min(.3+3.*(1.-max(dot(N,V),0.)),1.5)+exp(-b*b*8.)*.08)*(.15+m)*uGs*(1.-.6*e);return tone(c,e);}`
// relief, baked once on the GPU: a dome from the blurred alpha (a high mip) + carving from luminance;
// the back: dome − engraving. uLb shifts the art's mip bias when the target is larger than 512.
// The dome comes from a real Gaussian blur of the alpha (two passes, once): the gradient of a
// coarse mip is piecewise constant per texel, which showed as stair-stepped facets on the bevel.
const FS_BLUR = `precision highp float;varying vec2 vQ;uniform sampler2D uT;uniform vec2 uD;uniform float uL;
void main(){float s=0.,w=0.;for(int i=-7;i<=7;i++){float k=exp(-float(i*i)/18.);s+=texture2D(uT,vQ+uD*float(i),uL).a*k;w+=k;}gl_FragColor=vec4(0.,0.,0.,s/w);}`
const FS_BAKE = `precision highp float;varying vec2 vQ;uniform sampler2D uA,uE,uBl;uniform float uB,uPx,uLb;
float h(vec2 u){vec4 c=texture2D(uA,u,.6+uLb);return texture2D(uBl,u).a*3.+(1.-uB)*dot(c.rgb,vec3(.3,.59,.11))*1.1-uB*texture2D(uE,u,1.1).a*.7;}
void main(){vec2 d=vec2(1.5*uPx,0.);float g=4.3/(512.*uPx);vec3 n=normalize(vec3(-(h(vQ+d)-h(vQ-d))*g,(h(vQ+d.yx)-h(vQ-d.yx))*g,1.));
gl_FragColor=vec4(n*.5+.5,uB>.5?texture2D(uE,vQ,.6).a:1.);}`
// painted fire and enamel: bright and saturated → keep the colour, no metal, almost no specular
const FS_FRONT = LIT + `
uniform sampler2D uA,uN;void main(){vec4 c=texture2D(uA,vU);if(c.a<.004)discard;vec3 a=c.rgb/c.a;
float l=dot(a,vec3(.3,.59,.11)),mx=max(a.r,max(a.g,a.b)),st=(mx-min(a.r,min(a.g,a.b)))/max(mx,.001);
float e=smoothstep(.7,.94,mx)*smoothstep(.42,.78,st);
gl_FragColor=vec4(shade(a,normalize(uR*(texture2D(uN,vU).xyz*2.-1.)),uMet*smoothstep(.12,.5,l)*(1.-e),.62,e),1.)*c.a*uOp;}`
const DERIV = (s) => `#extension GL_OES_standard_derivatives : enable\n#define DERIV 1\n` + s
const FS_BACK = LIT + `
uniform sampler2D uA,uN;uniform vec3 uBk;void main(){float al=smoothstep(.3,.6,texture2D(uA,vU).a);if(al<.004)discard;
vec4 b=texture2D(uN,vU);vec3 n=b.xyz*2.-1.;n.z=-n.z;float r=length(vL.xy)*260.,w=.06;
#ifdef DERIV
w*=clamp(1.-fwidth(r)/2.5,0.,1.);
#endif
vec3 a=uBk*.8*(1.-w+w*sin(r))*(1.-b.a*.55);
gl_FragColor=vec4(shade(a,normalize(uR*n),uMet*.8+.15,.42,0.),1.)*al*uOp;}`
const FS_RIM = LIT + `
uniform sampler2D uA;void main(){vec4 c=texture2D(uA,vU,2.);vec3 a=c.rgb/max(c.a,.1);a=mix(vec3(dot(a,vec3(.3,.59,.11))),a,.85)*.92;
float s=vS*110.,w=.1;
#ifdef DERIV
w*=clamp(1.-fwidth(s)/2.,0.,1.);
#endif
vec3 N=normalize(normalize(vN)+normalize(vT)*sin(s)*w);gl_FragColor=vec4(shade(a,N,uMet*.85+.15,.3,0.),1.)*uOp;}`
const VS_Q = `attribute vec3 aP;varying vec2 vQ;void main(){vQ=aP.xy*.5+.5;gl_Position=vec4(aP.xy,0.,1.);}`
const VS_FLOOR = `attribute vec3 aP;uniform mat4 uVP;varying vec2 vP;void main(){vP=aP.xz;gl_Position=uVP*vec4(aP,1.);}`
const FS_FLOOR = `precision mediump float;varying vec2 vP;uniform vec4 uS[2],uK[2],uRg;uniform vec3 uRc;void main(){float sh=0.,pl=0.;
for(int i=0;i<2;i++){vec2 d=vP-uS[i].xy;float al=dot(d,vec2(uS[i].z,-uS[i].w)),ac=dot(d,vec2(uS[i].w,uS[i].z));
sh+=uK[i].z*exp(-al*al/(uK[i].x*uK[i].x)*1.6-ac*ac/(uK[i].y*uK[i].y));pl+=uK[i].w*exp(-dot(d,d)*.42);}
sh=min(sh,.9);float g=length(vP-uRg.xy)-uRg.z,rg=uRg.w*exp(-g*g*40.);float e=smoothstep(-4.,-1.,vP.y)*smoothstep(3.2,2.,abs(vP.x))*smoothstep(1.8,.9,vP.y);pl*=e;
gl_FragColor=vec4(vec3(.16,.18,.21)*pl*(1.-sh)+uRc*rg*e,sh*.75*e);}`
// effects fade out over the top of the stage instead of being cut by its edge
const CLIP = `uniform vec2 uClip;float clip(){return smoothstep(0.,uClip.y,uClip.x-gl_FragCoord.y);}`
const VS_BB = `attribute vec3 aP;uniform mat4 uVP;uniform vec3 uC,uX,uY;varying vec2 vQ;void main(){vQ=aP.xy;gl_Position=uVP*vec4(uC+uX*aP.x+uY*aP.y,1.);}`
const FS_RAYS = `precision mediump float;varying vec2 vQ;uniform float uT,uI;uniform vec3 uCol;${CLIP}void main(){float r=length(vQ),a=atan(vQ.y,vQ.x);
float p=.5+.5*sin(a*9.+uT*.3),q=.5+.5*sin(a*13.-uT*.22+1.3);p*=p;p*=p;q*=q;q*=q;q*=q;float y=p*p+.7*q;
vec3 c=uCol*(y*smoothstep(1.,.3,r)*smoothstep(.22,.5,r)*.8+exp(-r*r*7.)*.45)*uI*clip();gl_FragColor=vec4(c,max(c.r,max(c.g,c.b)));}`
const FS_FLARE = `precision mediump float;varying vec2 vQ;uniform float uI;uniform vec3 uCol;${CLIP}void main(){vec2 q=vQ,d=mat2(.707,.707,-.707,.707)*q;float r=length(q);
float s=exp(-abs(q.x)*30.)*exp(-abs(q.y)*2.6)+exp(-abs(q.y)*30.)*exp(-abs(q.x)*2.6)+.35*(exp(-abs(d.x)*40.)*exp(-abs(d.y)*6.)+exp(-abs(d.y)*40.)*exp(-abs(d.x)*6.))+exp(-r*r*70.)*1.3+exp(-r*r*7.)*.15;
vec3 c=uCol*s*uI*smoothstep(1.,.6,r)*clip();gl_FragColor=vec4(c,max(c.r,max(c.g,c.b)));}`
const VS_PT = `attribute vec3 aP;attribute vec3 aN;uniform mat4 uVP;uniform float uPx;varying vec3 vC;void main(){vec4 p=uVP*vec4(aP,1.);gl_Position=p;gl_PointSize=max(aN.x*uPx/p.w,1.);vC=vec3(aN.y,aN.z,1.);}`
const FS_PT = `precision mediump float;varying vec3 vC;${CLIP}void main(){vec2 q=gl_PointCoord*2.-1.;float d=dot(q,q),a=vC.x*exp(-d*3.)*step(d,1.)*clip();
vec3 c=mix(vec3(1.,.55,.15),vec3(1.,.95,.8),vC.y)*a;gl_FragColor=vec4(c,a);}`

// ── one stage ───────────────────────────────────────────────────────
export default function MedalStage(host, o = {}) {
  const font = o.font || 'sans-serif', DATE = o.date || ''
  const reduced = typeof o.reduced === 'function' ? o.reduced : () => !!o.reduced
  const MANUAL = !!o.manual, FIXED = !!o.fixedQuality
  const cv = document.createElement('canvas'), labs = document.createElement('div')
  cv.setAttribute('aria-hidden', 'true')
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y'
  labs.style.cssText = 'position:absolute;inset:0;pointer-events:none'
  host.append(cv, labs)

  // stage geometry: U px per world unit, medal centre at CY, the projection shifted to put it there
  let W = 390, SH = 340, U = 98, CY = 140, kScale = 1
  function measure() {
    W = host.clientWidth || 390; SH = host.clientHeight || 340
    U = o.unit || Math.min(98, W * .25, SH * .29); CY = o.cy || SH * .41
    const r = host.getBoundingClientRect(); kScale = r.width ? r.width / W : 1
  }
  measure()
  function camera(sx, sy) {
    const e = [sx, .6 + sy, 8], t = [sx * .6, sy * .6, 0]
    let z = e.map((v, i) => v - t[i]), l = Math.hypot(...z); z = z.map(v => v / l)
    let x = [z[2], 0, -z[0]]; l = Math.hypot(...x); x = x.map(v => v / l)
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]
    const d = (a) => -(a[0] * e[0] + a[1] * e[1] + a[2] * e[2])
    const V = new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, d(x), d(y), d(z), 1])
    const f = U * DIST / (SH / 2), n = .1, fr = 60, P = new Float32Array(16)
    P[0] = f * SH / W; P[5] = f; P[9] = -(SH / 2 - CY) / (SH / 2); P[10] = (fr + n) / (n - fr); P[11] = -1; P[14] = 2 * fr * n / (n - fr)
    return { VP: mul(P, V), e, x, y, f }
  }
  const project = (VP, p) => {
    const w = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15]
    return [((VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12]) / w + 1) * W / 2, (1 - (VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13]) / w) * SH / 2, w]
  }

  // ── WebGL plumbing ──
  let gl = null, ext = {}, progs = {}, bufs = {}, lost = false, dead = false, restoreT = 0
  const gpuMap = new Map()
  if (!o.noGL) {
    try { gl = cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: MANUAL }) } catch (e) { gl = null }
  }
  function prog(vs, fs) {
    const p = gl.createProgram(), shs = []
    for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(sh))
      gl.attachShader(p, sh); shs.push(sh)
    }
    ;['aP', 'aN', 'aU', 'aS'].forEach((a, i) => gl.bindAttribLocation(p, i, a))
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(p))
    shs.forEach(sh => { gl.detachShader(p, sh); gl.deleteShader(sh) })
    p.u = {}; return p
  }
  function use(p, u) {
    gl.useProgram(p)
    for (const k in u) {
      const l = p.u[k] !== undefined ? p.u[k] : (p.u[k] = gl.getUniformLocation(p, k)), v = u[k]
      if (l === null) continue
      if (typeof v === 'number') gl.uniform1f(l, v)
      else if (v.tex !== undefined) { gl.activeTexture(gl.TEXTURE0 + v.unit); gl.bindTexture(gl.TEXTURE_2D, v.tex); gl.uniform1i(l, v.unit) }
      else if (v.length === 2) gl.uniform2fv(l, v)
      else if (v.length === 3) gl.uniform3fv(l, v)
      else if (v.length === 9) gl.uniformMatrix3fv(l, false, v)
      else if (v.length === 16) gl.uniformMatrix4fv(l, false, v)
      else gl.uniform4fv(l, v)
    }
  }
  function buf(data, idx) { const b = gl.createBuffer(), t = idx ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER; gl.bindBuffer(t, b); gl.bufferData(t, data, gl.STATIC_DRAW); return b }
  function tex(src, premul, n) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !!premul)
    if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    if (ext.aniso) gl.texParameterf(gl.TEXTURE_2D, ext.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, ext.anisoMax))
    return t
  }
  function attribs(stride, list) { for (let i = 0; i < 4; i++) gl[i < list.length ? 'enableVertexAttribArray' : 'disableVertexAttribArray'](i); list.forEach(([n, off], i) => gl.vertexAttribPointer(i, n, gl.FLOAT, false, stride * 4, off * 4)) }
  function glInit() {
    ext.aniso = gl.getExtension('EXT_texture_filter_anisotropic'); ext.anisoMax = ext.aniso ? gl.getParameter(ext.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1
    const dv = gl.getExtension('OES_standard_derivatives') ? DERIV : (s) => s
    progs = {
      rim: prog(VS, dv(FS_RIM)), front: prog(VS, FS_FRONT), back: prog(VS, dv(FS_BACK)),
      bake: prog(VS_Q, FS_BAKE), blur: prog(VS_Q, FS_BLUR),
      floor: prog(VS_FLOOR, FS_FLOOR), rays: prog(VS_BB, FS_RAYS), flare: prog(VS_BB, FS_FLARE), pt: prog(VS_PT, FS_PT),
    }
    const q = (z, nz) => new Float32Array([-1, -1, z, 0, 0, nz, 0, 1, 0, 1, -1, z, 0, 0, nz, 1, 1, 0, 1, 1, z, 0, 0, nz, 1, 0, 0, -1, 1, z, 0, 0, nz, 0, 0, 0])
    bufs = {
      qf: buf(q(H, 1)), qb: buf(q(-H, -1)), qif: buf(new Uint16Array([0, 1, 2, 0, 2, 3]), 1), qib: buf(new Uint16Array([0, 2, 1, 0, 3, 2]), 1),
      floor: buf(new Float32Array([-3.2, FLOOR, -4, 3.2, FLOOR, -4, -3.2, FLOOR, 1.8, 3.2, FLOOR, 1.8])),
      bb: buf(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0])), pt: gl.createBuffer(),
    }
  }
  function gpu(a) {
    let g = gpuMap.get(a.key); if (g) return g
    const art = tex(a.src, true), eng = tex(a.eng, false), fb = gl.createFramebuffer()
    const pass = (n, p, u) => {
      const t = tex(null, false, n); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0)
      gl.viewport(0, 0, n, n); gl.disable(gl.BLEND)
      use(p, u); gl.bindBuffer(gl.ARRAY_BUFFER, bufs.bb); attribs(3, [[3, 0]]); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindTexture(gl.TEXTURE_2D, t); gl.generateMipmap(gl.TEXTURE_2D); return t
    }
    const b1 = pass(512, progs.blur, { uT: { tex: art, unit: 0 }, uD: [2 / 512, 0], uL: 1 })
    const bl = pass(512, progs.blur, { uT: { tex: b1, unit: 0 }, uD: [0, 2 / 512], uL: 0 })
    const bake = (B, n) => pass(n, progs.bake, { uA: { tex: art, unit: 0 }, uE: { tex: eng, unit: 1 }, uBl: { tex: bl, unit: 2 }, uB: B, uPx: 1 / n, uLb: Math.log2(n / 512) })
    g = { art, nf: bake(0, 512), nb: bake(1, 1024), vb: buf(a.V), ib: buf(a.I, 1), n: a.I.length }
    ;[eng, b1, bl].forEach(t => gl.deleteTexture(t)); gl.deleteFramebuffer(fb); gl.enable(gl.BLEND)
    gpuMap.set(a.key, g); return g
  }
  function freeGL() {
    if (!gl || gl.isContextLost()) return
    for (const g of gpuMap.values()) { gl.deleteTexture(g.art); gl.deleteTexture(g.nf); gl.deleteTexture(g.nb); gl.deleteBuffer(g.vb); gl.deleteBuffer(g.ib) }
    for (const k in progs) gl.deleteProgram(progs[k])
    for (const k in bufs) gl.deleteBuffer(bufs[k])
  }
  // iOS drops WebGL contexts when a home-screen app is backgrounded or memory runs short:
  // keep the state, throw away every GPU object, rebuild on restore; no restore in 3 s → flat art
  const onLost = (e) => { e.preventDefault(); lost = true; gpuMap.clear(); progs = {}; bufs = {}; stop(); clearTimeout(restoreT); restoreT = setTimeout(() => { if (lost) toFlat() }, 3000) }
  const onRestored = () => { clearTimeout(restoreT); if (dead || !lost) return; lost = false; try { glInit(); render(); wake() } catch (e) { toFlat() } }
  if (gl) {
    cv.addEventListener('webglcontextlost', onLost); cv.addEventListener('webglcontextrestored', onRestored)
    try { glInit() } catch (e) { console.error(e); gl = null }
  }

  // ── state ──
  let medals = [], clock = 0, timers = [], sparks = [], shake = { t: -9, a: 0 }, dust = { t: -9, x: 0, z: 0, a: 0 }, RM = false, token = 0
  const at = (dt, f) => timers.push([clock + dt, f])
  class Medal {
    constructor(it, a, i) {
      Object.assign(this, { it, r: it.rarity, R: RAR[it.rarity] || RAR.common, a, i, x: 0, y: 0, z: 0, s: 1, wx: 0, wy: 0, yo: 0, fy: 0, iy: 0, ip: 0, yaw: 0, yv: 0, yT: 0, pitch: 0, pv: 0, op: 0, on: false, landed: false, th: null, by: 0, bv: 0, ia: 0, lab: null, labT: 1e9, gl0: -9, next: 1e9, tc: 2, idle0: 0 })
      this.L = { x: 0, y: 0, s: 1, vx: 0, vy: 0, vs: 0, tx: 0, ty: 0, ts: 1 }
    }
    layout(x, y, s, now) { Object.assign(this.L, { tx: x, ty: y, ts: s }); if (now) Object.assign(this.L, { x, y, s, vx: 0, vy: 0, vs: 0 }) }
    start() {
      this.on = true; this.t0 = clock
      if (RM) return
      this.tc = this.R.heavy ? 2.25 : 2
      this.th = { t0: clock, tc: this.tc, from: 0, to: this.R.turns * TAU, p: 2, vc: 1.7 }
    }
    land() {
      const R = this.R
      this.landed = true; this.tl = clock; this.labT = clock + (R.heavy && !RM ? .5 : .08)   // heavy: the title waits for the ring to pass
      if (!RM) {
        if (R.heavy) { shake = { t: clock, a: .04 * R.heavy }; dust = { t: clock, x: this.wx, z: this.z, a: .3 * R.heavy }; this.bv = -1.2 * R.heavy }
        if (R.sparks) burst(this, R.sparks)
      }
      this.glint(clock + (RM ? .25 : .12))
      this.onLand && this.onLand()
      try { o.onLand && o.onLand(this.i, this.it) } catch (e) { /* a sound must never stop the medal */ }
    }
    finish() { // skip(): landed, facing front, label up, no effects
      Object.assign(this, { on: true, landed: true, t0: clock - 9, tl: clock - 9, th: null, yv: 0, pitch: 0, pv: 0, z: 0, yo: 0, by: 0, bv: 0, op: 1, labT: clock - 1, idle0: clock, drag: false, onLand: null })
      this.yaw = this.yT = Math.round(this.yaw / TAU) * TAU
      this.gl0 = -9; this.next = clock + 2.5
    }
    glint(t) { this.gl0 = t; this.next = t + 4.6 + Math.random() }
    spin(turns) {
      const k = Math.round(this.yaw / TAU)
      this.th = { t0: clock, tc: 1.35, from: this.yaw, to: (k + turns) * TAU, p: 2.4, vc: 1.5, again: 1 }
      this.idle0 = clock + 1.6
    }
    update(dt) {
      const L = this.L
      for (const k of ['x', 'y', 's']) { const a = 90 * (L['t' + k] - L[k]) - 17 * L['v' + k]; L['v' + k] += a * dt; L[k] += L['v' + k] * dt }
      this.x = L.x; this.y = L.y; this.s = L.s
      if (this.on) {
        const t = clock - this.t0, R = this.R
        if (RM) {
          this.op = clamp(t / .6); this.z = 0; this.yo = 0
          if (!this.landed && t > .35) this.land()
        } else {
          if (!this.landed) {
            // from depth along the line of sight, so it grows in place: near full size by 0.6 s,
            // most of the turning happens big. Heavy ones hover a little and drop onto the floor.
            const a = ease(t / .8), v = clamp(t / this.tc)
            this.op = clamp(t / .25)
            this.z = -26 * (1 - a)
            this.yo = R.heavy ? .24 * (1 - v * v) : -.25 * (1 - a) * (1 - a)
            this.pitch = .45 * (1 - a) * (1 - a)
          } else {
            this.z = 0
            const a = -150 * this.by - 10 * this.bv; this.bv += a * dt; this.by += this.bv * dt; this.yo = this.by * .25
          }
          if (this.drag) { /* the finger turns it */ } else if (this.th) {
            const { t0, tc, from, to, p, vc } = this.th, D = to - from, w = Math.min(vc * tc / Math.abs(D || 1), .6), v = clamp((clock - t0) / tc)
            this.yaw = from + D * ((1 - w) * (1 - Math.pow(1 - v, p)) + w * v)
            if (v >= 1) {
              this.yv = Math.sign(D) * vc; this.yT = to; const again = this.th.again; this.th = null
              if (!this.landed) this.land()
              else if (again) { this.glint(clock + .05); if (R.sparks) burst(this, R.sparks / 3 | 0); this.rayKick = clock }
            }
          } else { const a = -64 * (this.yaw - this.yT) - 6 * this.yv; this.yv += a * dt; this.yaw += this.yv * dt }
          if (this.landed && !this.drag) { const a = -40 * this.pitch - 11 * this.pv; this.pv += a * dt; this.pitch += this.pv * dt }
          // idle: a slow tilt and float with a glint every ~5 s, eased out after ~20 s, then the loop stops
          const ti = this.landed ? clock - (this.idle0 || this.tl + .9) : 0
          this.ia = this.landed ? clamp(ti / 1.4) * clamp((20 - ti) / 3) : 0
          this.iy = .1 * Math.sin(ti * .55) * this.ia; this.ip = .05 * Math.sin(ti * .41 + 1) * this.ia; this.fy = .035 * Math.sin(ti * .9) * this.ia
          if (this.landed && this.ia > .5 && clock > this.next) this.glint(clock)
        }
      }
      const k = -this.z / 8   // stay on the ray from the eye through the slot
      this.wx = this.x * (1 + k); this.wy = this.y + this.yo + this.fy + (this.y - .6) * k
    }
    sweep() { const g = clock - this.gl0; return g < 0 || g > (RM ? 1.1 : .8) ? 9 : -1.9 + 3.8 * (RM ? ease(g / 1.1) : g / .8) }
    busy() { return !this.on || !this.landed || this.th || this.drag || Math.abs(this.yv) > .01 || Math.abs(this.bv) > .01 || this.ia > 0 || (this.landed && clock < this.labT + .6) || this.sweep() < 9 }
  }
  function burst(m, n) {
    const P = m.a.V, cnt = P.length / 9, R = Math.cos(m.yaw), S = Math.sin(m.yaw)
    for (let i = 0; i < n; i++) {
      const k = (Math.random() * cnt | 0) * 9, nx = P[k + 3], ny = P[k + 4], sp = 2.2 + Math.random() * 3.2, lx = P[k] * m.s, ly = P[k + 1] * m.s
      sparks.push({ p: [m.wx + lx * R, m.wy + ly, m.z - lx * S], v: [(nx * R) * sp + (Math.random() - .5), ny * sp + 1.6 + Math.random() * 1.5, (-nx * S) * sp + (Math.random() - .5) * 2], life: 0, max: .6 + Math.random() * .9, sz: .05 + Math.random() * .06 })
    }
  }

  // ── reveal ──
  const fontsReady = () => document.fonts ? Promise.all([document.fonts.load(`800 58px ${font}`, 'مران ٠1'), document.fonts.load(`600 30px ${font}`, 'أكتوبر 2026')]).catch(() => {}) : Promise.resolve()
  async function prepare(list) {
    await fontsReady()
    const as = await Promise.all(list.map(it => load(it, font, DATE)))
    if (gl && !lost && !dead) as.forEach(gpu)
    return as
  }
  async function play(list) {
    const my = ++token
    if (!gl || flat) return
    const as = await prepare(list)
    if (my !== token || dead || flat) return
    RM = reduced()
    medals = as.map((a, i) => new Medal(list[i], a, i)); timers = []; sparks = []; clock = 0
    shake = { t: -9, a: 0 }; dust = { t: -9, x: 0, z: 0, a: 0 }
    labs.textContent = ''
    for (const m of medals) {
      if (o.labels === false) continue   // the host names the medal itself (the medal sheet)
      // the labels are seen, not read: the host lists the titles for a screen reader
      m.lab = document.createElement('div'); m.lab.className = `m3-lab m3-${m.r}${list.length > 1 ? ' m3-two' : ''}`
      m.lab.setAttribute('aria-hidden', 'true')
      m.lab.style.cssText = 'position:absolute;left:0;top:0;opacity:0;display:grid;justify-items:center'
      const b = document.createElement('b'), s = document.createElement('small'); b.textContent = m.it.title; s.textContent = m.it.word || m.R.w
      m.lab.append(b, s); labs.appendChild(m.lab)
    }
    const [a, b] = medals
    if (b) {
      if (RM) { a.layout(...SLOT[0], 1); b.layout(...SLOT[1], 1); at(.3 + .15, () => b.start()) }   // reduced: both fade in where they stay
      else { a.layout(0, 0, 1, 1); b.layout(...SLOT[1], 1); a.onLand = () => at(.55, () => { a.layout(...SLOT[0]); b.start() }) }
    }
    at(.3, () => a.start())
    measure(); wake()
  }
  function skip() {
    if (!medals.length) return
    timers = []; sparks = []; shake.a = 0; dust.a = 0
    const [a, b] = medals
    if (b) { a.layout(...SLOT[0], 1); b.layout(...SLOT[1], 1) }
    for (const m of medals) { m.finish(); m.update(0) }
    render(); wake()
  }

  // ── frame ──
  function update(dt) {
    clock += dt
    const due = timers.filter(([t]) => t <= clock); timers = timers.filter(([t]) => t > clock); due.forEach(([, f]) => f())
    for (const m of medals) m.update(dt)
    for (const s of sparks) { s.life += dt; s.v[1] -= 7 * dt; for (let k = 0; k < 3; k++) { s.v[k] *= 1 - 1.4 * dt; s.p[k] += s.v[k] * dt } }
    sparks = sparks.filter(s => s.life < s.max)
  }
  let quality = 1, slow = 0, nFr = 0
  function render() {
    if (dead) return
    const sk = clamp(1 - (clock - shake.t) / .45), sa = shake.a * sk * sk
    const C = camera(sa * Math.sin(clock * 83), sa * Math.sin(clock * 61 + 1))
    if (gl && !lost) draw(C)
    for (const m of medals) {
      if (!m.lab) continue
      const p = project(C.VP, [m.wx, FLOOR, m.z]), l = clamp((clock - m.labT) / .5)
      m.lab.style.opacity = l
      m.lab.style.transform = `translate(${p[0].toFixed(1)}px,${(p[1] + 12 + (RM ? 0 : 10 * (1 - ease(l)))).toFixed(1)}px) translateX(-50%)`
    }
  }
  function draw(C) {
    const want = clamp(Math.min(o.maxDpr || 3, (window.devicePixelRatio || 1) * kScale) * quality, 1, 3)
    const bw = Math.round(W * want), bh = Math.round(SH * want)
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh }
    const clip = [bh, 56 * want]
    gl.viewport(0, 0, bw, bh); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE)
    // floor: the lit pool, the shadow (it stretches and shrinks with the turn), the landing ring
    const S = new Float32Array(8), K = new Float32Array([1, 1, 0, 0, 1, 1, 0, 0])
    medals.slice(0, 2).forEach((m, i) => {
      const a = m.yaw + m.iy, ht = m.wy - m.s - FLOOR
      S.set([m.wx, m.z, Math.cos(a), Math.sin(a)], i * 4)
      K.set([1.05 * m.s + .2 * ht, H * m.s + .3 + .4 * ht, m.op * .95 * clamp((m.z + 9) / 6) / (1 + ht * .7), m.op * clamp((m.z + 12) / 8) * 1.5], i * 4)
    })
    const dt = clock - dust.t
    use(progs.floor, { uVP: C.VP, 'uS[0]': S, 'uK[0]': K, uRg: [dust.x, dust.z, .4 + dt * 3.2, dust.a * clamp(1 - dt / .6) * clamp(dt / .05)], uRc: [1, .7, .28] })
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.floor); attribs(3, [[3, 0]]); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    // rays behind (epic / legendary)
    gl.blendFunc(gl.ONE, gl.ONE)
    for (const m of medals) {
      if (!m.R.rays || !m.landed || RM) continue
      const d = clock - m.tl, k = m.rayKick ? clock - m.rayKick : 9
      const I = m.R.rays * m.op * clamp(d / .08) * (.22 + 1.1 * Math.exp(-d / .5) + .5 * Math.exp(-k / .4)) * (.5 + .5 * Math.max(m.ia, clamp(1 - d)))
      const sz = 1.55 * m.s, c = [m.wx, m.wy, m.z - .4]
      use(progs.rays, { uVP: C.VP, uC: c, uX: C.x.map(v => v * sz), uY: C.y.map(v => v * sz), uT: clock, uI: I, uCol: [1, .72, .3], uClip: clip })
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs.bb); attribs(3, [[3, 0]]); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    // the medals
    gl.enable(gl.DEPTH_TEST)
    for (const m of medals) {
      if (!m.on || m.op <= 0) continue
      const g = gpu(m.a), { R, M } = pose(m), u = { uVP: C.VP, uM: M, uR: R, uEye: C.e, uTint: m.R.tint, uOp: m.op, uSw: m.sweep(), uGs: m.R.gs, uMet: m.R.met, uA: { tex: g.art, unit: 0 } }
      gl.disable(gl.CULL_FACE)
      use(progs.rim, u); gl.bindBuffer(gl.ARRAY_BUFFER, g.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.ib)
      attribs(9, [[3, 0], [3, 3], [2, 6], [1, 8]]); gl.drawElements(gl.TRIANGLES, g.n, gl.UNSIGNED_SHORT, 0)
      gl.enable(gl.CULL_FACE)
      use(progs.front, { ...u, uN: { tex: g.nf, unit: 1 } }); gl.bindBuffer(gl.ARRAY_BUFFER, bufs.qf); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.qif)
      attribs(9, [[3, 0], [3, 3], [2, 6], [1, 8]]); gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
      use(progs.back, { ...u, uN: { tex: g.nb, unit: 1 }, uBk: m.a.back }); gl.bindBuffer(gl.ARRAY_BUFFER, bufs.qb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.qib)
      attribs(9, [[3, 0], [3, 3], [2, 6], [1, 8]]); gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
    }
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.blendFunc(gl.ONE, gl.ONE)
    // sparks: 3 points per spark along its velocity = a short streak
    if (sparks.length) {
      const D = new Float32Array(sparks.length * 18)
      sparks.forEach((s, i) => {
        const f = 1 - s.life / s.max
        for (let j = 0; j < 3; j++) D.set([s.p[0] - s.v[0] * j * .012, s.p[1] - s.v[1] * j * .012, s.p[2] - s.v[2] * j * .012, s.sz * (1 - j * .25), f * (1 - j * .3), f], (i * 3 + j) * 6)
      })
      use(progs.pt, { uVP: C.VP, uPx: bh / 2 * C.f, uClip: clip })
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs.pt); gl.bufferData(gl.ARRAY_BUFFER, D, gl.DYNAMIC_DRAW); attribs(6, [[3, 0], [3, 3]]); gl.drawArrays(gl.POINTS, 0, sparks.length * 3)
    }
    // glint: a star on the tip as the light band crosses it (rare and up)
    for (const m of medals) {
      const sw = m.sweep(); if (!m.R.flare || sw > 8) continue
      const tp = m.a.tip, I = Math.exp(-Math.pow((sw - (tp[0] * .83 + tp[1] * .55)) / .45, 2)) * m.op
      if (I < .01) continue
      const { M } = pose(m), w = [M[0] * tp[0] + M[4] * tp[1] + M[8] * H + M[12], M[1] * tp[0] + M[5] * tp[1] + M[9] * H + M[13], M[2] * tp[0] + M[6] * tp[1] + M[10] * H + M[14] + .05]
      const sz = .75 * m.s * (.6 + .4 * I)
      use(progs.flare, { uVP: C.VP, uC: w, uX: C.x.map(v => v * sz), uY: C.y.map(v => v * sz), uI: I * 1.3, uCol: m.r === 'rare' ? [.75, .88, 1.2] : [1.2, .95, .7], uClip: clip })
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs.bb); attribs(3, [[3, 0]]); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  }

  // ── no WebGL (Lockdown Mode, a lost context that never came back): the host
  // draws the app's own flat medal instead (MedalReveal.jsx), so this stage
  // frees what it holds and steps aside ──
  let flat = false
  function toFlat() {
    if (flat || dead) return
    flat = true; lost = false; stop(); freeGL(); gl = null
    try { o.onFallback && o.onFallback() } catch (e) { /* the host's problem */ }
  }

  // ── loop: full rate while moving, ~30 fps while idling, stopped after ──
  let raf = 0, last = 0, rafIsTimeout = false
  const busy = () => medals.some(m => m.busy()) || sparks.length || timers.length
  const idling = () => medals.every(m => m.landed && !m.th && !m.drag && Math.abs(m.yv) < .05 && Math.abs(m.bv) < .05 && m.sweep() > 8) && !sparks.length && !timers.length
  function stop() { if (raf) { rafIsTimeout ? clearTimeout(raf) : cancelAnimationFrame(raf) } raf = 0 }
  function wake() { if (!raf && !MANUAL && !dead && !lost) { last = 0; rafIsTimeout = false; raf = requestAnimationFrame(tick) } }
  function tick(ts) {
    raf = 0
    if (dead || lost) return
    const dt = last ? Math.min((ts - last) / 1000, .05) : 1 / 60
    // dynamic resolution: a phone that can't hold ~40 fps while it moves renders fewer pixels
    if (last && !FIXED && !idling() && ++nFr > 4) { slow = slow * .85 + (ts - last > 25) * .15; if (slow > .6 && quality > .7) { quality *= .8; slow = 0 } }
    last = ts
    const c0 = performance.now(); update(dt); render(); o.onFrame && o.onFrame(ts, performance.now() - c0)
    if (!busy()) return
    if (idling()) { rafIsTimeout = true; raf = setTimeout(() => { rafIsTimeout = false; raf = requestAnimationFrame(tick) }, 24) }
    else raf = requestAnimationFrame(tick)
  }

  // ── touch: tap → spin again, drag → turn it, fling → it spins on. A press on a medal never
  // reaches the summary's tap-to-skip; a press anywhere else does. ──
  let drag = null, pressHit = false
  const hit = (e) => {
    const r = cv.getBoundingClientRect(), k = W / r.width, x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k
    const C = camera(0, 0)
    return medals.find(m => { if (!m.landed) return false; const p = project(C.VP, [m.wx, m.wy, m.z]), rr = m.s * C.f * SH / 2 / p[2]; return Math.hypot(x - p[0], y - p[1]) < rr * .92 })
  }
  function bindPointer(el) {
    const down = (e) => {
      const m = hit(e); pressHit = !!m; if (!m) return
      e.stopPropagation()
      drag = { m, el, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), v: 0, k: W / el.getBoundingClientRect().width }
      m.drag = true; m.th = null; try { el.setPointerCapture(e.pointerId) } catch (er) { /* synthetic */ }
      wake()
    }
    const move = (e) => {
      if (!drag) return
      const now = performance.now(), dx = (e.clientX - drag.x) * drag.k, dy = (e.clientY - drag.y) * drag.k, d = dx * .0125, m = drag.m
      m.yaw += d; m.pitch = clamp(m.pitch + dy * .006, -.45, .45)
      drag.v = drag.v * .6 + d / Math.max((now - drag.t) / 1000, .008) * .4
      Object.assign(drag, { x: e.clientX, y: e.clientY, t: now }); if (MANUAL) render()
    }
    const up = (e) => {
      if (!drag) return
      const m = drag.m, moved = Math.hypot(drag.x - drag.x0, drag.y - drag.y0); m.drag = false
      // reduced motion: nothing springs back, so it is simply facing front again (no turn back)
      if (RM) { m.yv = 0; m.yT = m.yaw = Math.round(m.yaw / TAU) * TAU; m.pitch = 0; m.pv = 0; m.th = null; m.glint(clock) }
      else if (moved < 6 && e.type === 'pointerup') m.spin(2)
      else { m.yv = drag.v; m.yT = Math[drag.v > 0 ? 'ceil' : 'floor']((m.yaw + drag.v * .3) / TAU - (drag.v > 0 ? .25 : -.25)) * TAU; m.idle0 = clock + .8 }
      drag = null; wake()
    }
    const click = (e) => { if (pressHit) e.stopPropagation(); pressHit = false }
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('click', click)
    el._m3off = () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('click', click) }
  }
  if (gl) bindPointer(cv)

  function destroy() {
    if (dead) return
    dead = true; token++; stop(); clearTimeout(restoreT)
    if (gl) {
      cv.removeEventListener('webglcontextlost', onLost); cv.removeEventListener('webglcontextrestored', onRestored)
      freeGL(); const lc = gl.getExtension('WEBGL_lose_context'); lc && lc.loseContext(); gl = null
    }
    cv.removeEventListener('webglcontextlost', onLost); cv.removeEventListener('webglcontextrestored', onRestored)
    cv._m3off && cv._m3off()
    cv.remove(); labs.remove(); medals = []; gpuMap.clear()
  }
  function resize() { measure(); if (!raf && medals.length) render() }

  return {
    prepare, play, skip, destroy, resize, render,
    pause: stop, resume: wake,   // off screen / hidden: stop drawing; back: carry on from the same frame
    step(dt, quiet) { update(dt); quiet || render() },   // a virtual clock for recordings (manual: true)
    get clock() { return clock }, get quality() { return quality }, get medals() { return medals },
    get webgl() { return !!gl && !lost }, get canvas() { return cv }, get context() { return gl },
  }
}
