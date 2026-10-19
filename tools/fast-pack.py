#!/usr/bin/env python3
# Copyright (c) 2026 LFC Foundry. MIT License.
"""Makes the fast-opening copy of Netflow Map: the page deflated (gzip) and wrapped in the small self-opening loader from JS-modules
tools/single-file-tools/pack.py, which the browser's own unpacker (DecompressionStream) opens in a few milliseconds. The LZMA copy (index.packed.html) is a
tenth smaller but takes about 85 to 100 ms longer to open, so this one is the copy to use unless the file size matters most.
  python3 tools/fast-pack.py index.html index.fast.html "Netflow Map" [pack.py]
Uses Zopfli (smallest gzip) when the module is there, otherwise zlib level 9 (about 1% bigger). The file holds raw bytes and works when opened from the computer; for
a page served by a host that sends charset=utf-8, ask for the base64 form from pack.py itself."""
import sys, os, gzip, importlib.util

def load_pack(path):
    spec = importlib.util.spec_from_file_location('sft_pack', path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

def main(argv):
    if len(argv) < 3:
        raise SystemExit(__doc__)
    src, dst = argv[1], argv[2]
    title = argv[3] if len(argv) > 3 else 'Loading'
    here = os.path.dirname(os.path.abspath(__file__))
    cands = [argv[4] if len(argv) > 4 else None, os.environ.get('NFM_SFT_PACK'), os.path.join(here, '..', '..', 'js-modules', 'tools', 'single-file-tools', 'pack.py'), '/home/claude/js-modules/tools/single-file-tools/pack.py']
    path = next((c for c in cands if c and os.path.exists(c)), None)
    if not path:
        raise SystemExit('fast-pack: tools/single-file-tools/pack.py from JS-modules not found; clone lfcfoundry/JS-modules next to this folder or set NFM_SFT_PACK')
    pk = load_pack(path)
    raw = open(src, 'rb').read()
    try:
        import zopfli.gzip
        gz, how = zopfli.gzip.compress(raw, numiterations=15), 'Zopfli'
    except ImportError:
        gz, how = gzip.compress(raw, 9, mtime=0), 'zlib level 9'
    page = pk.build_page_bytes(gz, title, getattr(pk, 'DEFAULT_BG', '#101018'))
    open(dst, 'wb').write(page)
    print('fast-pack: %d -> %d bytes (%d%%), %s' % (len(raw), len(page), round(100 * len(page) / max(1, len(raw))), how))

main(sys.argv)
