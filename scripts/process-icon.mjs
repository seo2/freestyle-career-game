// Turns a generated icon into a game-ready asset, the same shape the icons cut
// from the mockups have: transparent background, tight bounding box, exactly
// 64px tall (see docs/ASSETS.md).
//
// Two things it does that a naive crop would get wrong:
//
// 1. The background is keyed by FLOOD FILL from the border, matching whatever
//    colour the border actually is (the generator ignores "black background" and
//    often returns white). Interior pixels of that same colour survive, which is
//    the mistake that ate the microphone in Fase 3 — a global threshold turned
//    its dark outline into confetti.
// 2. The art comes back at 1024px with chunky blocks, so it is snapped to its
//    NATIVE pixel grid (averaged down, then integer-upscaled). Downscaling
//    straight to 64px leaves uneven blocks: some 2px, some 1px, which reads as
//    a blurry icon next to the ones cut from the mockups.
//
// Usage:
//   node scripts/process-icon.mjs <inputPng> <outputPng> [--tolerance 26] [--height 64] [--native 32]

import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const [input, output] = args.filter((a) => !a.startsWith("--"));
if (!input || !output) {
  console.error("usage: node scripts/process-icon.mjs <in.png> <out.png> [--threshold N] [--height N]");
  process.exit(1);
}
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};

const script = `
import sys
from collections import deque
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
tolerance, target_h, native_h = int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
im = Image.open(src).convert("RGBA")
w, h = im.size
px = im.load()

# The background is whatever the border is: sample the corners and take the
# most common colour, so white, black or magenta all work.
corner_samples = [px[x, y] for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
bg = max(set(corner_samples), key=corner_samples.count)

def is_bg(x, y):
    r, g, b, a = px[x, y]
    if a == 0:
        return True
    return abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) <= tolerance * 3

seen = [[False] * h for _ in range(w)]
queue = deque()
for x in range(w):
    for y in (0, h - 1):
        if is_bg(x, y) and not seen[x][y]:
            seen[x][y] = True
            queue.append((x, y))
for y in range(h):
    for x in (0, w - 1):
        if is_bg(x, y) and not seen[x][y]:
            seen[x][y] = True
            queue.append((x, y))
cleared = 0
while queue:
    x, y = queue.popleft()
    px[x, y] = (0, 0, 0, 0)
    cleared += 1
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny] and is_bg(nx, ny):
            seen[nx][ny] = True
            queue.append((nx, ny))

# Stray specks the generator leaves behind: an opaque island under 3% of the
# biggest one is noise, not art.
visited = [[False] * h for _ in range(w)]
islands = []
for sx in range(w):
    for sy in range(h):
        if visited[sx][sy] or px[sx, sy][3] == 0:
            continue
        stack = [(sx, sy)]
        visited[sx][sy] = True
        cells = []
        while stack:
            x, y = stack.pop()
            cells.append((x, y))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny] and px[nx, ny][3] > 0:
                    visited[nx][ny] = True
                    stack.append((nx, ny))
        islands.append(cells)
if islands:
    biggest = max(len(c) for c in islands)
    for cells in islands:
        if len(cells) < biggest * 0.03:
            for x, y in cells:
                px[x, y] = (0, 0, 0, 0)

box = im.getbbox()
if box is None:
    print("EMPTY after keying: nothing survived", file=sys.stderr)
    sys.exit(2)
im = im.crop(box)

# Snap to the native pixel grid, then integer-upscale, so every pixel is the
# same size in the final asset.
native_w = max(1, round(im.width * native_h / im.height))
small = im.resize((native_w, native_h), Image.BOX)
# Hard alpha: BOX averaging softens the edges, and these icons are cut-outs.
alpha = small.getchannel("A").point(lambda v: 255 if v >= 128 else 0)
small.putalpha(alpha)
factor = max(1, round(target_h / native_h))
out = small.resize((native_w * factor, native_h * factor), Image.NEAREST)
out.save(dst)
print(f"{dst}: {out.size[0]}x{out.size[1]} (native {native_w}x{native_h} x{factor}, bg {bg[:3]}, cleared {cleared}, islands {len(islands)})")
`;

execFileSync(
  "python3",
  ["-c", script, input, output, String(flag("tolerance", 26)), String(flag("height", 64)), String(flag("native", 32))],
  { stdio: "inherit" },
);
