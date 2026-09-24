// Builds the battle's foreground crowd from its mockup.
//
// The battle mockup (06_52_01 (1)) frames the cards with a crowd seen from
// behind: heads and hoodies along the bottom edge, facing the cypher. The game
// had no crowd at all (docs/ASSETS.md listed it as pending), and project rule 2
// forbids faking one with canvas shapes — but the art already existed, painted
// into the mockup, and rule 1 says to crop it into public/assets.
//
// What a naive crop would get wrong:
//
// 1. "COSTO ENERGIA: 10" is painted over the middle of the crowd. It is patched
//    with crowd lifted sideways from the same rows (a crowd from behind is a
//    texture, so a horizontal lift keeps the perspective). The game draws its own
//    cost label on top of that spot anyway, so the patch only has to be plausible.
// 2. The band's top edge cuts through heads. It is feathered to transparent, so
//    the crowd reads as rising out of the dark instead of ending on a ruler line.
// 3. The mockup frame (the blue border at both ends) is excluded, and the scale
//    is uniform NEAREST, like every other pixel asset.
//
// Output: public/assets/scenes/battle-crowd-front-v1.png (RGBA, 960 wide).
// Usage: node scripts/build-battle-crowd.mjs

import { execFileSync } from "node:child_process";

const SOURCE = "reference/screens/ChatGPT Image 15 jun 2026, 06_52_01 a.m. (1).png";
const OUTPUT = "public/assets/scenes/battle-crowd-front-v1.png";

const script = `
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGBA")

# Crowd rows under the cards, inside the mockup frame.
left, top, right, bottom = 34, 783, 1638, 910
band = im.crop((left, top, right, bottom))

# Patch the painted cost label (mockup x 680..990) with the rows beside it.
label_l, label_r = 680 - left, 990 - left
label_t = 812 - top
width = label_r - label_l
patch = band.crop((label_l - width, label_t, label_l, band.height))
band.paste(patch, (label_l, label_t))

# Feather the top edge (cut heads) to transparent over FEATHER rows.
FEATHER = 34
px = band.load()
for y in range(min(FEATHER, band.height)):
    a = y / FEATHER
    a = a * a
    for x in range(band.width):
        r, g, b, alpha = px[x, y]
        px[x, y] = (r, g, b, int(alpha * a))

# Uniform NEAREST scale. Closer than the rest of the mockup (0.8 instead of the
# 0.574 that maps it to 960): the crowd is the FOREGROUND, and at mockup scale it
# read as a row of pebbles under the cards. The sides that overflow 960 are
# cropped evenly.
scale = 0.8
big = band.resize((round(band.width * scale), round(band.height * scale)), Image.NEAREST)
cut = (big.width - 960) // 2
out = big.crop((cut, 0, cut + 960, big.height))
out.save(dst)
print(f"{dst}: {out.width}x{out.height}")
`;

execFileSync("python3", ["-c", script, SOURCE, OUTPUT], { stdio: "inherit" });
