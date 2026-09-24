// Builds the props the pieza earns over a career (Fase 12 C) from the mockup of
// the advanced room (reference/screens "06_34_34 a.m. (5)": gold disc, home
// studio, 100.000 plaque).
//
// The owner asked for a room that changes with what the player buys and
// achieves. The mockup already paints where the room is headed, so its pieces
// are cut from it instead of drawn (project rules 1 and 2):
//
// 1. FRAMED pieces (gold disc, poster, plaque) are rectangles on the wall: they
//    are cropped as-is, frame included, because a frame is what makes them
//    read as hung on OUR wall rather than pasted onto it.
// 2. The NEON sign is lit text on a dark wall. It keeps its dark background and
//    the game draws it with ADD blending, so the dark drops out and only the
//    light lands on the wall — how a neon actually looks.
// 3. FREE-STANDING pieces (the trophies) need their background
//    keyed out: flood fill from the crop border by colour distance, the method
//    of scripts/process-icon.mjs. The first try keyed "anything dark" and ate the
//    black mic and the sneakers' outlines; distance to the sampled background
//    stops at an outline even when the outline is dark too. The mockup's mic
//    stand and sneaker row were tried and dropped: black on a dark wall/floor,
//    no tolerance separates them cleanly (pending art, docs/ASSETS.md).
//
// Scale: the mockup is the same 1672px canvas as the pieza backdrop, which the
// game draws at 960/1672, so every prop is cut at that scale too (NEAREST) and
// lands at the same pixel density as the room around it.
//
// Output: public/assets/room/<id>.png. Usage: node scripts/build-room-props.mjs

import { execFileSync } from "node:child_process";

const SOURCE = "reference/screens/ChatGPT Image 15 jun 2026, 06_34_34 a.m. (5).png";

// id: [left, top, right, bottom, mode, tolerance]
const PROPS = {
  "disco-oro": [190, 188, 340, 365, "frame", 0],
  "rap-to-win": [390, 205, 520, 372, "frame", 0],
  "placa-100k": [1392, 300, 1502, 435, "frame", 0],
  "neon-foco": [395, 385, 540, 480, "frame", 0],
  trofeos: [1478, 176, 1602, 270, "key", 14],
};

const script = `
import sys, json, os
from collections import deque
from PIL import Image

src = sys.argv[1]
props = json.loads(sys.argv[2])
os.makedirs("public/assets/room", exist_ok=True)
im = Image.open(src).convert("RGBA")
scale = 960 / 1672

def key_out(tile, tolerance):
    # Background colour = median of the crop border; flood fill from the border
    # through every pixel within \`tolerance\` (Euclidean RGB) of the pixel it came
    # from AND of that median, so the fill follows a gradient wall but stops at
    # the prop's outline even where the outline is dark too.
    px = tile.load()
    w, h = tile.size
    border = [px[x, 0] for x in range(w)] + [px[x, h - 1] for x in range(w)] + [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)]
    med = tuple(sorted(c[i] for c in border)[len(border) // 2] for i in range(3))
    def dist(a, b):
        return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5
    seen = set()
    queue = deque()
    for x in range(w):
        queue.append(((x, 0), px[x, 0])); queue.append(((x, h - 1), px[x, h - 1]))
    for y in range(h):
        queue.append(((0, y), px[0, y])); queue.append(((w - 1, y), px[w - 1, y]))
    while queue:
        (x, y), came = queue.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or (x, y) in seen:
            continue
        c = px[x, y]
        if dist(c, came) > tolerance or dist(c, med) > tolerance * 2.2:
            continue
        seen.add((x, y))
        px[x, y] = (c[0], c[1], c[2], 0)
        for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            queue.append((n, c))
    bbox = tile.getbbox()
    return tile.crop(bbox) if bbox else tile

for name, (l, t, r, b, mode, tol) in props.items():
    tile = im.crop((l, t, r, b))
    if mode == "key":
        tile = key_out(tile, tol)
    out = tile.resize((max(1, round(tile.width * scale)), max(1, round(tile.height * scale))), Image.NEAREST)
    dst = f"public/assets/room/{name}.png"
    out.save(dst)
    print(f"{dst}: {out.width}x{out.height}")
`;

execFileSync("python3", ["-c", script, SOURCE, JSON.stringify(PROPS)], { stdio: "inherit" });
