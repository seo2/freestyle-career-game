#!/usr/bin/env node
// Cut the MC sprite into recolourable layers.
//
// Why this exists: the MC used to be one fixed PNG, so nothing about him could
// change — not his skin, not his clothes, and the barbershop had nothing to
// sell. Three earlier attempts drew him procedurally (rect lists, hand-authored
// string art, generated profiles) and all three read as cheap next to the
// original sprite, because they were: geometry does not reproduce a drawing.
//
// So instead of imitating the art, this splits it. Every layer is made of the
// ORIGINAL pixels, and the modularity comes from two places:
//
//   1. Layers toggle. Cap on or off, shades or open eyes.
//   2. Layers recolour by remapping luminance onto a target ramp, which keeps
//      the artist's shading and only moves the hue. See src/ui/characterDraw.ts.
//
// Two pieces the MC sprite simply does not contain — hair (he wears a cap) and
// open eyes (he wears shades) — are transplanted from rival-idle.png, which is
// the same artist in the same style, scaled to the MC's face width. That is why
// the hair looks drawn: it IS drawn.
//
// Reads only from public/assets/characters/ (never reference/, per project rule
// 1) and writes public/assets/characters/layers/*.png plus the layer metadata
// consumed by src/data/characterLayers.ts.
//
// Usage: node scripts/build-character-layers.mjs
// Requires python3 with Pillow, like scripts/build-map-city.mjs.

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "public/assets/characters/layers");
mkdirSync(outDir, { recursive: true });

const py = String.raw`
import json, os
from PIL import Image

ROOT = os.environ["ROOT"]
CH = os.path.join(ROOT, "public/assets/characters")
OUT = os.path.join(CH, "layers")

lum = lambda c: 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]

def sat(r, g, b):
    mx = max(r, g, b)
    return 0.0 if mx == 0 else (mx - min(r, g, b)) / mx

def hue(r, g, b):
    mx, mn = max(r, g, b), min(r, g, b)
    d = mx - mn
    if d == 0: return 0.0
    if mx == r: return (60*((g-b)/d)) % 360
    if mx == g: return 60*((b-r)/d) + 120
    return 60*((r-g)/d) + 240

# Material families. Measured, not guessed: the outline of this sprite is dark
# NAVY, and without the first test it classifies as blue and lands in the shorts
# layer as a full-body ghost.
def fam(r, g, b):
    v = max(r, g, b)/255.0
    s, h = sat(r, g, b), hue(r, g, b)
    if v < 0.30 and s < 0.75: return "K"
    if s < 0.16: return "W" if v > 0.62 else "G"
    if 12 <= h <= 45: return "S"
    if h < 12 or h > 340: return "R"
    if 180 <= h <= 275: return "B"
    return "S" if h < 90 else "K"

mc = Image.open(os.path.join(CH, "mc-idle.png")).convert("RGBA")
W, H = mc.size
px = mc.load()

# The lens x-extent, measured so that hiding the shades does not take the ears
# and the jaw outline with them.
lx0, lx1 = W, 0
for y in range(59, 69):
    for x in range(W):
        r, g, b, a = px[x, y]
        if a >= 40 and fam(r, g, b) in ("W", "G"):
            lx0, lx1 = min(lx0, x), max(lx1, x)

# Anatomy bands, read off a per-row family histogram of this very sprite:
# crown 6-38, visor 34-58, shades 57-70, face 71-95, shoulders 96-102,
# tee 103-160 (print 113-141, arms alongside), shorts 161-190, legs 191-201,
# sneakers 202-237. Written down because the next person cannot re-derive them
# by looking.
def layer_of(x, y, f):
    if y <= 58 and f == "K" and y >= 34: return "brim"
    if y <= 38: return "cap"
    if y <= 58: return "skin" if f == "S" else "cap"
    if y <= 70:
        if lx0-1 <= x <= lx1+1 and f in ("W", "G", "K"): return "shades"
        return "skin"
    if y <= 95: return "skin"
    if y <= 102: return "top" if f == "K" else "skin"
    if y <= 160:
        if f == "S": return "skin"
        if f in ("W", "G"): return "print"
        return "top"
    if y <= 190: return "bottom"
    if y <= 201: return "skin"
    return "shoes"

masks, total = {}, 0
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        if a < 40: continue
        total += 1
        masks.setdefault(layer_of(x, y, fam(r, g, b)), []).append([x, y, (r, g, b), a])

# The eyes are painted ON the lenses, so hiding the shades as one layer left a
# face with no eyes. The frame is the mask's border; strip it and the lens (with
# its painted eye) is what remains.
lens_set = {(p[0], p[1]) for p in masks["shades"]}
rim = {p for p in lens_set
       if any((p[0]+dx, p[1]+dy) not in lens_set
              for dx in (-2,-1,0,1,2) for dy in (-2,-1,0,1,2))}
masks["frame"] = [p for p in masks["shades"] if (p[0], p[1]) in rim]
masks["lens"] = [p for p in masks["shades"] if (p[0], p[1]) not in rim]
del masks["shades"]

# The head's skin has two holes, and both only show once something is taken off:
#
#   * Under the shades there is no skin at all — that whole band is glass in the
#     source — so hiding them left a transparent stripe across the face.
#   * Under the visor, the pixels the brim SHADED went to the cap layer, so taking
#     the cap off left a dark gap between the hairline and the eyebrows. That is
#     the "espacio raro en la frente".
#
# Both are the same fix: across the head's rows, fill every gap that lies between
# the skin's own leftmost and rightmost pixel on that row, sampling the nearest
# skin pixel in the row. Inside the silhouette by construction, so it cannot spill
# past the head, and the tones are the sprite's own.
skin_at = {(p[0], p[1]): (p[2], p[3]) for p in masks["skin"]}
patch = []
for y in range(40, 100):
    row = sorted(x for (x, ry) in skin_at if ry == y)
    if len(row) < 2: continue
    # Sample from FLESH, not from the outline. Taking the nearest pixel of any kind
    # filled the eye sockets with the dark rim that borders them, which then showed
    # as a black bar behind the open eyes.
    lit = sorted(rx for rx in row if lum(skin_at[(rx, y)][0]) > 40)
    source = lit if len(lit) >= 2 else row
    for x in range(row[0], row[-1] + 1):
        if (x, y) in skin_at: continue
        near = min(source, key=lambda rx: abs(rx - x))
        src = skin_at[(near, y)]
        patch.append([x, y, src[0], src[1]])
masks["skin"].extend(patch)
PATCHED = len(patch)

# ---------------------------------------------------------------------------
# Transplants from the rival, who is the same artist in the same style and who
# has the two things the MC sprite cannot give us: hair and open eyes.
rival = Image.open(os.path.join(CH, "rival-idle.png")).convert("RGBA")
rp = rival.load()
RW, RH = rival.size

def cheek_span(load, w, y, lo, hi):
    xs = [x for x in range(w) if load[x, y][3] >= 40 and lo <= lum(load[x, y][:3]) <= hi]
    return (min(xs), max(xs)) if xs else None

# Face width at each sprite's cheek line measures 0.75, but at 0.75 the MC's
# skull pokes out past the fringe at the temples: the rival's cheek line is his
# widest row and the MC's is not. 0.80 is the measurement plus that correction.
rface = cheek_span(rp, RW, 70, 150, 255)
mface = cheek_span(px, W, 80, 40, 200)
MEASURED = round((mface[1]-mface[0]) / (rface[1]-rface[0]), 3)
SCALE = 0.80

def place(pix, cx_src, cx_dst, y_src, y_dst, xscale=None):
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    op = out.load()
    acc = {}
    sx = SCALE if xscale is None else xscale
    for (x, y), v in pix.items():
        nx = round(cx_dst + (x-cx_src)*sx)
        ny = round(y_dst + (y-y_src)*SCALE)
        if 0 <= nx < W and 0 <= ny < H:
            acc.setdefault((nx, ny), []).append(v)
    for (x, y), vs in acc.items():
        op[x, y] = tuple(round(sum(q[k] for q in vs)/len(vs)) for k in range(4))
    # Downscaling leaves single-pixel holes; fill only the ones surrounded.
    for _ in range(2):
        holes = [(x, y) for y in range(H) for x in range(W)
                 if op[x, y][3] == 0
                 and sum(1 for dx in (-1,0,1) for dy in (-1,0,1)
                         if 0 <= x+dx < W and 0 <= y+dy < H and op[x+dx, y+dy][3] > 0) >= 6]
        for x, y in holes:
            ns = [op[x+dx, y+dy] for dx in (-1,0,1) for dy in (-1,0,1)
                  if 0 <= x+dx < W and 0 <= y+dy < H and op[x+dx, y+dy][3] > 0]
            op[x, y] = tuple(round(sum(q[k] for q in ns)/len(ns)) for k in range(4))
    return out

# Hair: warm hue at mid luminance is the brown; the rival's pale skin sits far
# above it on the histogram (two clean humps at lum 36-47 and 204-215).
#
# Two traps, both found by looking at the mask on magenta. His EYEBROWS and the
# bridge of his nose are the same brown as his hair, so a hue+luminance test alone
# pulled them in; keeping only the largest connected blob drops them, because they
# do not touch the hair. And the crown must be taken whole — an earlier version
# extruded each column downward to close a gap at the brow, which smeared those
# stolen eyebrows into black bars down the middle of the head.
brown = {(x, y) for y in range(48) for x in range(RW)
         if rp[x, y][3] >= 40 and 18 <= lum(rp[x, y][:3]) <= 155
         and sat(*rp[x, y][:3]) > 0.25 and 10 <= hue(*rp[x, y][:3]) <= 50}
seen, blobs = set(), []
for seed in brown:
    if seed in seen: continue
    stack, blob = [seed], []
    seen.add(seed)
    while stack:
        cx, cy = stack.pop()
        blob.append((cx, cy))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                n = (cx+dx, cy+dy)
                if n in brown and n not in seen:
                    seen.add(n)
                    stack.append(n)
    blobs.append(blob)
crown = set(max(blobs, key=len))
hair = {}
for x, y in crown:
    hair[(x, y)] = rp[x, y]
# The outline that belongs to the crown, and only where it borders it.
for y in range(50):
    for x in range(RW):
        r, g, b, a = rp[x, y]
        if a < 40 or (x, y) in hair: continue
        if lum((r, g, b)) < 22 and any((x+dx, y+dy) in crown
                                       for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
            hair[(x, y)] = (r, g, b, a)
hair_bottom = max(y for _, y in hair)
# Centre on the crown's MEASURED middle, not an assumed 85: guessing left a strip
# of bare skull showing past the hair on one temple. And a touch wider than tall
# (0.88 against 0.80), because the rival's quiff is swept and this head needs the
# crown covered on both sides.
hair_cx = (min(x for x, _ in hair) + max(x for x, _ in hair)) / 2
# Bottom at 55: the shades start at 57, so the fringe lands ON the brow without
# hanging into the eyes. Nothing is synthesized — every pixel here was drawn.
masks["hair"] = [[x, y, c[:3], c[3]]
                 for (x, y), c in _dict(
                     place(hair, hair_cx, 48.0, hair_bottom, 55, xscale=0.88)).items()]

# Open eyes. Two earlier cuts failed for reasons worth writing down: including the
# rival's eyebrows put a second pair of brows on a face that already has its own,
# and a plain x/y box dragged his temple and hair in as a brown clump beside the
# eye. So: find the sclera blobs by connectivity, keep the two biggest, and take
# only what sits inside their own bounds.
sclera = {(x, y) for y in range(52, 70) for x in range(40, min(136, RW))
          if rp[x, y][3] >= 40 and lum(rp[x, y][:3]) > 170 and sat(*rp[x, y][:3]) < 0.25}
blobs = []
seen = set()
for seed in sclera:
    if seed in seen: continue
    stack, blob = [seed], []
    seen.add(seed)
    while stack:
        cx, cy = stack.pop()
        blob.append((cx, cy))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                n = (cx+dx, cy+dy)
                if n in sclera and n not in seen:
                    seen.add(n)
                    stack.append(n)
    blobs.append(blob)
blobs.sort(key=len, reverse=True)
eyes = {}
for blob in blobs[:2]:
    bx0 = max(0, min(x for x, _ in blob) - 2)
    bx1 = min(RW-1, max(x for x, _ in blob) + 2)
    by0 = max(0, min(y for _, y in blob) - 2)
    by1 = min(RH-1, max(y for _, y in blob) + 2)
    for y in range(by0, by1+1):
        for x in range(bx0, bx1+1):
            r, g, b, a = rp[x, y]
            if a < 40: continue
            L, sv, h = lum((r, g, b)), sat(r, g, b), hue(r, g, b)
            # White of the eye, green iris, dark lash. Nothing warm: warm here is
            # his skin or his hair, and both belong to other layers.
            if (L > 170 and sv < 0.25) or (70 <= h <= 200 and sv > 0.2) or (L < 40 and sv < 0.4):
                eyes[(x, y)] = (r, g, b, a)
exs = [k[0] for k in eyes]
eyes_bottom = max(y for _, y in eyes)
masks["eyesOpen"] = [[x, y, c[:3], c[3]]
                     for (x, y), c in
                     _dict(place(eyes, (min(exs)+max(exs))/2, 44.5, eyes_bottom, 67)).items()]

# ---------------------------------------------------------------------------
# Ramp stops sit at luminance PERCENTILES, not equal bins. With equal bins the
# cap's darkest anchor came out dark red (its shadow outnumbers its outline) and
# every recolour grew a red halo around the hat.
STOPS = [0, 18, 44, 72, 100]
meta = {}
for name, pixels in sorted(masks.items()):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    lp = img.load()
    for x, y, c, a in pixels: lp[x, y] = (c[0], c[1], c[2], a)
    img.save(os.path.join(OUT, name + ".png"), optimize=True)
    ls = sorted(lum(c) for _, _, c, _ in pixels)
    at = lambda pc: ls[min(len(ls)-1, int(len(ls)*pc/100))]
    stops = [at(pc) for pc in STOPS]
    ramp = []
    for i, s in enumerate(stops):
        lo = stops[i-1] if i else s
        hi = stops[i+1] if i+1 < len(stops) else s
        sel = [c for _, _, c, _ in pixels if (lo+s)/2 <= lum(c) <= (s+hi)/2]
        if not sel:
            sel = [min((c for _, _, c, _ in pixels), key=lambda c: abs(lum(c)-s))]
        ramp.append(tuple(round(sum(c[k] for c in sel)/len(sel)) for k in range(3)))
    meta[name] = {"stops": [round(s, 1) for s in stops],
                  "ramp": ["#%02x%02x%02x" % c for c in ramp],
                  "pixels": len(pixels)}

covered = sum(len(m) for k, m in masks.items() if k not in ("hair", "eyesOpen"))
meta["_source"] = {"width": W, "height": H, "scale": SCALE, "measured": MEASURED, "patched": PATCHED,
                   "covered": covered, "total": total, "lens": [lx0, lx1]}
print(json.dumps(meta, indent=1, sort_keys=True))
`;

// `place` returns an Image; the metadata pass wants pixel lists. Small shim so
// the python above reads top-to-bottom instead of interleaving both shapes.
const shim = String.raw`
def _dict(img):
    p = img.load()
    return {(x, y): p[x, y] for y in range(img.height) for x in range(img.width)
            if p[x, y][3] > 0}
`;

const out = execFileSync("python3", ["-c", shim + py], {
  env: { ...process.env, ROOT: root },
  encoding: "utf8",
  maxBuffer: 1 << 26,
});
const meta = JSON.parse(out);
const src = meta._source;
delete meta._source;

// Every source pixel must land in exactly one layer. `patched` is the skin
// synthesized under the shades — it is added, not moved, so it is subtracted here
// or the check reads as 487 pixels of overdraw.
if (src.covered - src.patched !== src.total) {
  console.error(`FALLO: ${src.total - (src.covered - src.patched)} pixeles del sprite sin capa`);
  process.exit(1);
}
console.log(`fuente ${src.width}x${src.height}  escala rival ${src.scale} (medida ${src.measured})  lentes x ${src.lens.join("..")}`);
console.log(`cobertura ${src.covered - src.patched}/${src.total} OK  (+${src.patched}px de piel bajo los lentes)`);
for (const [name, m] of Object.entries(meta)) {
  console.log(`  ${name.padEnd(9)} ${String(m.pixels).padStart(5)}px  ${m.ramp.join(" ")}`);
}
console.log(`\n${outDir}`);
console.log("Pegar en src/data/characterLayers.ts si cambio la segmentacion:");
console.log(JSON.stringify(meta, null, 2));
