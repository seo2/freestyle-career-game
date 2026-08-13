// Builds the map's isometric city asset from its mockup.
//
// The city on the map screen used to be a procedural grid of flat boxes. Project
// rule 2 only tolerates that while the real art is missing — and it was not
// missing: it was baked into the map mockup, which rule 1 says to copy/crop/
// optimize into public/assets rather than edit in place.
//
// Three things this does that a naive crop would get wrong:
//
// 1. The mockup has its own UI painted ON the city: six label pills, the MC, two
//    padlock pins and the yellow location pin. Those have to go, or the game
//    would draw a second set on top of them and a padlock would show on a place
//    that is open. Each one is replaced with city texture lifted from elsewhere,
//    feathered at the seam.
// 2. The source patch is searched for, not hardcoded: it must land inside the
//    city and overlap NO other overlay. The first attempt lifted the ESTUDIO
//    pill's replacement from a region containing the red padlock, and pasted the
//    padlock into the hole. Lifts are horizontal wherever possible — this city
//    repeats along its street grid sideways, so a sideways lift keeps the
//    isometric perspective and the light direction, while a vertical one pastes a
//    roof onto a road.
// 3. The dotted paths and platform rings are removed too, by local inpaint: the
//    game draws those itself from real state, and a painted path cannot know that
//    the ESTUDIO is padlocked.
// 4. The scale is uniform and NEAREST. The game's panel is 928x348 while the
//    mockup's is 928x394 (CareerScene keeps the HUD on top), so the extra rows
//    come off the TOP — bay and far skyline, the least load-bearing part of the
//    composition. Squashing instead would bend every roof, and LANCZOS would blur
//    art the rest of the game renders with pixelArt: true.
//
// Usage:
//   node scripts/build-map-city.mjs [--out public/assets/scenes/map-city-v1.png]

import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const SOURCE = "reference/screens/ChatGPT Image 15 jun 2026, 06_23_15 a.m. (5).png";
const OUT = flag("out", "public/assets/scenes/map-city-v1.png");
const COLORS = Number(flag("colors", 128));

const script = `
from PIL import Image, ImageFilter
import os, sys

src = Image.open(${JSON.stringify(SOURCE)}).convert("RGB")
im = src.copy()

# The city panel's interior, measured from its frame in the mockup.
X0, X1, YTOP, YBOT = 31, 1638, 80, 764
OUT_W, OUT_H = 928, 348

# The mockup's own UI, painted on the city. Padded outward so each patch also
# takes the pill borders and drop shadows: clipping them left a thin bright
# rectangle behind, which read as a UI ghost.
BOXES = {
    "pill-pieza":     (214, 238, 408, 330),
    "pill-plaza":     (786, 208, 966, 300),
    "pill-estudio":  (1286, 182, 1462, 276),
    "pill-trabajo":   (346, 506, 536, 600),
    "pill-tienda":    (754, 506, 920, 600),
    "pill-gimnasio": (1162, 505, 1366, 599),
    "mc":             (268, 284, 372, 458),
    "pin-plaza":      (836, 136, 918, 232),
    "lock-estudio":  (1060, 218, 1156, 320),
    "lock-ring-est": (1026, 306, 1202, 370),
    "lock-gym":      (1318, 626, 1414, 728),
    "lock-ring-gym": (1322, 706, 1406, 762),
}

def overlaps(a, b):
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])

def find_source(box):
    for dist in range(140, 620, 10):
        for dx in (-dist, dist):
            for dy in (0, -40, 40, -80, 80):
                cand = (box[0] + dx, box[1] + dy, box[2] + dx, box[3] + dy)
                if cand[0] < X0 or cand[2] > X1 or cand[1] < YTOP or cand[3] > YBOT:
                    continue
                if any(overlaps(cand, other) for other in BOXES.values()):
                    continue
                return cand, dx, dy
    return None, None, None

for name, box in BOXES.items():
    cand, dx, dy = find_source(box)
    if cand is None:
        print("FAIL: no clean source for " + name, file=sys.stderr)
        sys.exit(1)
    w, h = box[2] - box[0], box[3] - box[1]
    patch = src.crop(cand)
    mask = Image.new("L", (w, h), 255)
    inset = 8
    for i in range(inset):
        a = int(255 * (i + 1) / (inset + 1))
        for x in range(i, w - i):
            mask.putpixel((x, i), a); mask.putpixel((x, h - 1 - i), a)
        for y in range(i, h - i):
            mask.putpixel((i, y), a); mask.putpixel((w - 1 - i, y), a)
    mask = mask.filter(ImageFilter.GaussianBlur(3))
    im.paste(patch, (box[0], box[1]), mask)
    print("  %-16s %3dx%-3d <- dx=%+5d dy=%+4d" % (name, w, h, dx, dy))

# 5. The dotted paths and platform rings go too: the game draws those from real
#    state, and painted ones cannot know that the ESTUDIO is padlocked. Keeping
#    them looked cheaper than it was — the pills sit ON the paths, so patching a
#    pill cut a hole in the line and left plaza->tienda visibly broken.
#
#    Removed by LOCAL inpaint, not rectangles: each dot is a small near-white blob
#    replaced by the median colour just outside it. A rectangle over a 400px
#    diagonal would smear half a neighbourhood.
#
#    Two things this has to get right, both learned by looking at the result:
#      * The blob is DILATED before filling. The dots are anti-aliased, and their
#        fringe sits below any threshold that does not also eat lit windows, so
#        filling only the core left a ring of ghost outlines along every route.
#      * Only blobs inside a PATH CORRIDOR are touched. A plain "remove near-white
#        blobs" pass also ate the white stripes of the SHOP's awning, which are
#        art. The corridors are the routes the mockup actually draws.
# A path dot is identified by SHAPE, not by a route traced by hand. Hand-traced
# corridors missed half the dots (the real path curves higher than it looks), and
# a plain "remove near-white blobs" pass ate the white stripes of the SHOP's
# awning. A dot is small, solidly filled and roughly as wide as it is tall; the
# awning stripes are elongated quads, and the street lamps are warm yellow, which
# never passes a near-white test that needs blue.
RINGS = [(320, 437, 62), (875, 393, 132), (846, 730, 62), (1108, 336, 92), (1365, 730, 62)]

def near_white(p):
    return p[0] > 208 and p[1] > 212 and p[2] > 214

def is_dot(blob):
    xs = [q[0] for q in blob]; ys = [q[1] for q in blob]
    w = max(xs) - min(xs) + 1; h = max(ys) - min(ys) + 1
    if not (16 <= len(blob) <= 520):
        return False
    if w == 0 or h == 0:
        return False
    aspect = w / h
    fill = len(blob) / (w * h)
    return 0.55 <= aspect <= 1.8 and fill >= 0.55

def in_ring(cx, cy):
    return any(((cx - x) ** 2 + (cy - y) ** 2) ** 0.5 <= r for x, y, r in RINGS)

px = im.load()
seen = set()
blobs = []
for y in range(YTOP, YBOT):
    for x in range(X0, X1):
        if (x, y) in seen or not near_white(px[x, y]):
            continue
        stack = [(x, y)]; blob = []
        seen.add((x, y))
        while stack:
            cx, cy = stack.pop()
            blob.append((cx, cy))
            for nx, ny in ((cx+1,cy), (cx-1,cy), (cx,cy+1), (cx,cy-1)):
                if X0 <= nx < X1 and YTOP <= ny < YBOT and (nx, ny) not in seen and near_white(px[nx, ny]):
                    seen.add((nx, ny)); stack.append((nx, ny))
        blobs.append(blob)

removed = 0
for blob in blobs:
    if len(blob) < 5:
        continue
    cx = sum(q[0] for q in blob) / len(blob)
    cy = sum(q[1] for q in blob) / len(blob)
    if not (is_dot(blob) or in_ring(cx, cy)):
        continue
    fill = set(blob)
    # Dilate by 2px: the dots are anti-aliased, and their fringe sits below any
    # threshold that does not also eat lit windows. Filling only the core left a
    # ring of ghost outlines along every route.
    for _ in range(2):
        ring = set()
        for (x, y) in fill:
            for nx, ny in ((x+1,y), (x-1,y), (x,y+1), (x,y-1), (x+1,y+1), (x-1,y-1), (x+1,y-1), (x-1,y+1)):
                if X0 <= nx < X1 and YTOP <= ny < YBOT and (nx, ny) not in fill:
                    ring.add((nx, ny))
        fill |= ring
    xs = [q[0] for q in fill]; ys = [q[1] for q in fill]
    src_ring = []
    for yy in range(max(YTOP, min(ys) - 5), min(YBOT, max(ys) + 6)):
        for xx in range(max(X0, min(xs) - 5), min(X1, max(xs) + 6)):
            if (xx, yy) in fill:
                continue
            src_ring.append(px[xx, yy])
    if not src_ring:
        continue
    src_ring.sort(key=lambda c: c[0] + c[1] + c[2])
    med = src_ring[len(src_ring) // 2]
    for (xx, yy) in fill:
        px[xx, yy] = med
    removed += 1
print("  inpainted %d path/ring blobs (of %d near-white blobs)" % (removed, len(blobs)))

need = round(OUT_H / (OUT_W / (X1 - X0)))
Y0 = YBOT - need
city = im.crop((X0, Y0, X1, YBOT)).resize((OUT_W, OUT_H), Image.NEAREST)
city.quantize(colors=${COLORS}, method=Image.MEDIANCUT, dither=Image.NONE).save(${JSON.stringify(OUT)}, optimize=True)
print("crop rows %d..%d (dropped %d from the top)" % (Y0, YBOT, Y0 - YTOP))
print("wrote ${OUT}: %dx%d, %d KB" % (OUT_W, OUT_H, os.path.getsize(${JSON.stringify(OUT)}) // 1024))
# The node coordinates in mapView are derived from this mapping, not eyeballed.
scale = OUT_W / (X1 - X0)
print("mapView mapping: game = (mockup - (%d, %d)) * %.5f + (16, 92)" % (X0, Y0, scale))
`;

execFileSync("python3", ["-c", script], { stdio: "inherit" });
