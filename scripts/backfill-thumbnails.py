"""Create missing JPEG previews on macOS; never overwrite originals or existing previews."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import re
import subprocess
import statistics

root = Path(__file__).resolve().parents[1]
paths = sorted({match for car in (root / '_cars').glob('*.md')
                for match in re.findall(r'images/uploads/[^\s"\']+\.jpe?g', car.read_text())})

def create(path):
    source = root / path
    target = source.parent / 'thumbs' / source.name
    if not source.is_file():
        raise RuntimeError(f'Missing source: {path}')
    target.parent.mkdir(exist_ok=True)
    if target.exists():
        return (False, source.stat().st_size, target.stat().st_size)
    temporary = target.with_suffix('.tmp.jpg')
    try:
        for edge, quality in [(640, 65), (480, 60), (360, 50)]:
            subprocess.run(['sips', '-Z', str(edge), '-s', 'format', 'jpeg', '-s', 'formatOptions', str(quality), str(source), '--out', str(temporary)], check=True, capture_output=True)
            if temporary.stat().st_size <= 80 * 1024:
                temporary.rename(target)
                return (True, source.stat().st_size, target.stat().st_size)
        raise RuntimeError(f'Preview still too large: {path}')
    finally:
        temporary.unlink(missing_ok=True)

if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(create, paths))
    print('Referenced photos:', len(results), 'new previews:', sum(r[0] for r in results))
    print('Total original bytes:', sum(r[1] for r in results), 'preview bytes:', sum(r[2] for r in results))
    print('Median original KiB:', round(statistics.median(r[1] for r in results) / 1024),
          'median preview KiB:', round(statistics.median(r[2] for r in results) / 1024))
