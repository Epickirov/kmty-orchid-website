# -*- coding: utf-8 -*-
"""
Self-host all webfonts so the site loads with NO dependency on fonts.googleapis.com
(which is blocked in mainland China). Re-runnable.

Strategy:
  * Latin / Cyrillic / Vietnamese families (Fraunces, Playfair Display, Hanken Grotesk,
    Noto Sans): mirror Google's woff2 subsets faithfully (keep unicode-range).
  * CJK families (Noto Sans SC, Noto Serif SC): use Google Fonts' `text=` API to get a
    woff2 subset containing EXACTLY the Chinese glyphs the site uses -> tiny + fast.

All bytes come from the loli.net Google Fonts mirror (reachable from China; identical files).
Outputs: website/fonts/files/*.woff2  and  website/fonts/fonts.css
"""
import os, re, io, hashlib, time, urllib.request, urllib.parse, concurrent.futures as cf

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "fonts")
FILES = os.path.join(FONTS, "files")
os.makedirs(FILES, exist_ok=True)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
MIRROR = "https://fonts.loli.net/css2"

def fetch(url, timeout=40, retries=5):
    # China mirrors drop the occasional concurrent TLS connection; retry with backoff
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            return urllib.request.urlopen(req, timeout=timeout).read()
        except Exception as e:
            last = e
            time.sleep(0.6 * (i + 1))
    raise last

# ---------------------------------------------------------------- 1. glyph inventory
def read_text(path):
    with io.open(path, encoding="utf-8", errors="replace") as f:
        return f.read()

sources = [os.path.join(HERE, "KMTY Orchid v5.dc.html"),
           os.path.join(HERE, "i18n.js"),
           os.path.join(HERE, "image-slot.js")]
blob = "".join(read_text(p) for p in sources if os.path.exists(p))

def is_cjk(ch):
    o = ord(ch)
    return (0x4E00 <= o <= 0x9FFF or   # CJK unified
            0x3400 <= o <= 0x4DBF or   # ext A
            0x3000 <= o <= 0x303F or   # CJK symbols & punctuation （。、《》 etc.）
            0xFF00 <= o <= 0xFFEF)      # fullwidth forms （，！？： etc.）

cjk = sorted({ch for ch in blob if is_cjk(ch)})
# light safety margin: chinese numerals + common units/particles (absorb small copy edits)
margin = "零一二三四五六七八九十百千万亿个只朵株盆枝年月日号第的了和与及或在中为是"
cjk = sorted(set(cjk) | set(margin))
cjk_text = "".join(cjk)
han = [c for c in cjk if 0x4E00 <= ord(c) <= 0x9FFF]
print(f"[inventory] {len(cjk)} CJK glyphs ({len(han)} Han + {len(cjk)-len(han)} punctuation/fullwidth)")

# ---------------------------------------------------------------- 2. parse+localize helper
BLOCK_RE = re.compile(r"(/\*[^*]*\*/\s*)?@font-face\s*\{[^}]*\}", re.S)
URL_RE   = re.compile(r"url\((https?://[^)]+)\)")
FAM_RE   = re.compile(r"font-family:\s*'([^']+)'")

def localize_css(css, tag):
    """Download every woff2 url in `css`, save locally, rewrite src -> files/<name>.
       Returns rewritten css text. Downloads run in parallel."""
    urls = sorted(set(URL_RE.findall(css)))
    mapping = {}
    def dl(u):
        data = fetch(u)
        name = f"{tag}-{hashlib.md5(u.encode()).hexdigest()[:12]}.woff2"
        with open(os.path.join(FILES, name), "wb") as fh:
            fh.write(data)
        return u, name, len(data)
    total = 0
    with cf.ThreadPoolExecutor(max_workers=5) as ex:
        for u, name, n in ex.map(dl, urls):
            mapping[u] = name
            total += n
    for u, name in mapping.items():
        css = css.replace(u, f"files/{name}")
    print(f"[{tag}] {len(urls)} files, {total/1024:.0f} KB")
    return css

# ---------------------------------------------------------------- 3. Latin/Cyrillic/Viet (faithful)
latin_url = (MIRROR + "?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..700,100,1;1,9..144,300..700,100,1"
             "&family=Playfair+Display:ital,wght@0,400..700;1,400..700"
             "&family=Hanken+Grotesk:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400"
             "&family=Noto+Sans:ital,wght@0,300..600;1,300..400&display=swap")
latin_css = fetch(latin_url).decode("utf-8")
latin_css = localize_css(latin_css, "lat")

# ---------------------------------------------------------------- 4. CJK (subset the REAL full fonts)
# The loli mirror does NOT correctly proxy Google's dynamic text= subset endpoint (it returns a
# generic 218-glyph file). So we fetch the genuine full static TTFs (expo-google-fonts on jsDelivr,
# China-reachable) and subset them locally with fontTools -> verifiable, tiny, correct per-weight.
from fontTools.ttLib import TTFont
from fontTools import subset as ftsubset

EXPO = "https://cdn.jsdelivr.net/npm/@expo-google-fonts/"
CJK_FACES = [
    ("Noto Sans SC",  "noto-sans-sc",  "400", "400Regular/NotoSansSC_400Regular.ttf"),
    ("Noto Sans SC",  "noto-sans-sc",  "500", "500Medium/NotoSansSC_500Medium.ttf"),
    ("Noto Sans SC",  "noto-sans-sc",  "700", "700Bold/NotoSansSC_700Bold.ttf"),
    ("Noto Serif SC", "noto-serif-sc", "500", "500Medium/NotoSerifSC_500Medium.ttf"),
    ("Noto Serif SC", "noto-serif-sc", "600", "600SemiBold/NotoSerifSC_600SemiBold.ttf"),
    ("Noto Serif SC", "noto-serif-sc", "700", "700Bold/NotoSerifSC_700Bold.ttf"),
]
need_cps = sorted({ord(c) for c in cjk_text})

def unicode_range(cps):
    cps = sorted(cps); out = []; i = 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1:
            j += 1
        out.append(f"U+{cps[i]:04X}" if i == j else f"U+{cps[i]:04X}-{cps[j]:04X}")
        i = j + 1
    return ", ".join(out)

def build_cjk_face(family, pkg, weight, relpath):
    raw = fetch(EXPO + pkg + "/" + relpath, timeout=120)
    tmp = os.path.join(FILES, f"_full_{pkg}_{weight}.ttf")
    open(tmp, "wb").write(raw)
    f = TTFont(tmp)
    opts = ftsubset.Options(flavor="woff2", layout_features=[], hinting=False,
                            notdef_outline=True, name_IDs=[], recalc_bounds=True)
    ss = ftsubset.Subsetter(opts); ss.populate(unicodes=need_cps); ss.subset(f)
    name = f"cjk-{pkg}-{weight}.woff2"
    f.save(os.path.join(FILES, name)); f.close()
    os.remove(tmp)
    g = TTFont(os.path.join(FILES, name))
    covered = sorted(set(need_cps) & set(g.getBestCmap().keys()))
    miss = set(need_cps) - set(covered)
    sz = os.path.getsize(os.path.join(FILES, name)) / 1024
    print(f"[cjk] {family} {weight}: {sz:.0f} KB, {g['maxp'].numGlyphs} glyphs, "
          f"covers {len(covered)}/{len(need_cps)}" + (f"  MISSING {len(miss)}!" if miss else ""))
    g.close()
    return (f"@font-face {{\n  font-family: '{family}';\n  font-style: normal;\n"
            f"  font-weight: {weight};\n  font-display: swap;\n"
            f"  src: url(files/{name}) format('woff2');\n"
            f"  unicode-range: {unicode_range(covered)};\n}}\n")

cjk_css = "".join(build_cjk_face(*face) for face in CJK_FACES)

# ---------------------------------------------------------------- 5. assemble fonts.css
header = ("/* KMTY self-hosted webfonts — generated by build_fonts.py.\n"
          "   No external CDN: works even where fonts.googleapis.com is blocked (China).\n"
          "   CJK = subset to the site's used glyphs; Latin/Cyrillic/Vietnamese = faithful mirror. */\n\n")
out = header + "/* ===== Latin / Cyrillic / Vietnamese ===== */\n" + latin_css + \
      "\n/* ===== Simplified Chinese (subset) ===== */\n" + cjk_css
with io.open(os.path.join(FONTS, "fonts.css"), "w", encoding="utf-8") as f:
    f.write(out)

# report
nfiles = len([n for n in os.listdir(FILES) if n.endswith(".woff2")])
size = sum(os.path.getsize(os.path.join(FILES, n)) for n in os.listdir(FILES)) / 1024
print(f"[done] fonts/fonts.css written; {nfiles} woff2 files, {size:.0f} KB total on disk")
# expose the CJK codepoints covered for the verifier
with io.open(os.path.join(FONTS, "_cjk_covered.txt"), "w", encoding="utf-8") as f:
    f.write(cjk_text)
