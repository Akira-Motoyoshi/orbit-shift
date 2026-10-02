"""Produce the self-contained offline edition from the shipped source."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parent
source = root / 'dist'
target = Path(sys.argv[1]).resolve()
html = (source / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + (source / 'style.css').read_text() + '\n</style>')
for name in ('game-core.js', 'game.js'):
    html = html.replace(f'<script src="{name}"></script>', '<script>\n' + (source / name).read_text() + '\n</script>')
assert not re.search(r'<script[^>]+src=|<link[^>]+rel="stylesheet"', html)
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(html)
print(f'Offline edition: {target.name}, {target.stat().st_size:,} bytes, zero external dependencies')
