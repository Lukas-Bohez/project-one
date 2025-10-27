#!/usr/bin/env bash
set -euo pipefail

# Create target directories
mkdir -p frontend/images frontend/images/icons icons

# Download existing favicon.ico from the live site into the repo workspace
echo "Downloading favicon.ico from quizthespire.com..."
curl -fsS -o frontend/images/icons/source_favicon.ico https://quizthespire.com/favicon.ico

# Use Python to generate PNG sizes using Pillow; install Pillow if missing
python3 - <<'PY'
import sys, subprocess
try:
    from PIL import Image
except Exception:
    print('Pillow not found, installing...')
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--user', 'Pillow'])
    from PIL import Image

src = 'frontend/images/icons/source_favicon.ico'
print('Opening', src)
im = Image.open(src)
# If ICO has multiple frames choose the largest available
try:
    # For multi-frame ICO, pick the biggest frame
    frames = []
    for frame in range(0, getattr(im, 'n_frames', 1)):
        im.seek(frame)
        frames.append(im.copy())
    # pick the frame with largest size
    best = max(frames, key=lambda f: f.size[0])
    base = best
except Exception:
    base = im.copy()

sizes = [16,32,48,192]
for s in sizes:
    img = base.convert('RGBA')
    img = img.resize((s,s), Image.LANCZOS)
    out1 = f'frontend/images/favicon-{s}x{s}.png'
    out2 = f'icons/favicon-{s}x{s}.png'
    img.save(out1, format='PNG', optimize=True)
    img.save(out2, format='PNG', optimize=True)
    print('Wrote', out1, 'and', out2)

# Optionally generate a new favicon.ico combining the pngs
pngs = [f'frontend/images/favicon-{s}x{s}.png' for s in [16,32,48]]
try:
    ico_out = 'favicon.ico'
    imgs = [Image.open(p).convert('RGBA') for p in pngs]
    imgs[0].save(ico_out, format='ICO', sizes=[(16,16),(32,32),(48,48)])
    print('Wrote', ico_out)
except Exception as e:
    print('Could not write combined favicon.ico:', e)

PY

echo 'Done. Generated PNG favicons in frontend/images/ and icons/, and created favicon.ico at repo root (if possible).'
