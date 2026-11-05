"""Make a logo's solid black background transparent and save it as PNG.

    python scripts/logo-remove-black.py <input image> <output.png>

Alpha comes from each pixel's brightness (black → transparent, bright → opaque, soft ramp in between),
and edge colours are "un-mixed" from the black so anti-aliased edges don't keep a dark halo.
Only use on logos whose artwork has no black of its own.
"""
import sys
from PIL import Image

LOW, HIGH = 24, 110   # brightness (max channel) at which a pixel becomes fully transparent / fully opaque

src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert('RGB')
out = Image.new('RGBA', img.size)
px, opx = img.load(), out.load()
for y in range(img.height):
    for x in range(img.width):
        r, g, b = px[x, y]
        m = max(r, g, b)
        a = 0.0 if m <= LOW else 1.0 if m >= HIGH else (m - LOW) / (HIGH - LOW)
        if a == 0:
            opx[x, y] = (0, 0, 0, 0)
        else:
            # pixel = colour * a + black * (1 - a)  →  colour = pixel / a
            opx[x, y] = (min(255, round(r / a)), min(255, round(g / a)), min(255, round(b / a)), round(a * 255))
bbox = out.getbbox()
if bbox:
    out = out.crop(bbox)   # trim the now-empty border
out.save(dst, optimize=True)
print(f'{dst}: {out.width}x{out.height}')
