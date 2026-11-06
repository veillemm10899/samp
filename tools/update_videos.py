"""
HOT Creation — update the website from the VIDEOS folder.

  1. Put videos in the matching category folder inside VIDEOS (any format, HEVC is fine).
  2. Double-click "Update Website.bat".
  3. Refresh the website (Ctrl+F5).

What it does:
  - Makes a small web copy of each new video (H.264 720p, plays in every browser) -> website/media/videos
  - Makes a thumbnail -> website/media/posters
  - Adds it to website/media/library.js (edit titles / "featured" there)
  - Video deleted from VIDEOS  -> removed from the website
  - Video moved to another folder -> moves to that category (title is kept)
"""
import glob, json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "VIDEOS")
SITE = os.path.join(ROOT, "website")
OUT_V = os.path.join(SITE, "media", "videos")
OUT_P = os.path.join(SITE, "media", "posters")
LIB = os.path.join(SITE, "media", "library.js")
EXTS = (".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi")

# Category folders (created automatically if missing). Order = order on the website.
CATEGORIES = [
    ("cinematic", "01 Realistic & Cinematic", "Realistic"),
    ("animation", "02 3D & Pixar-Style Animation", "3D Animation"),
    ("cgi", "03 CGI & Product Visuals", "CGI"),
    ("explainer", "04 Explainers", "Explainer"),
    ("music", "05 Music & Song Videos", "Song Video"),
    ("social", "06 Social Content", "Creator Style"),
    ("brand", "07 Brand & Promo Films", "Brand Film"),
]
CAT_ORDER = [c[0] for c in CATEGORIES]
DEFAULT_STYLE = {c[0]: c[2] for c in CATEGORIES}
# words that identify a folder's category (checked in this order)
KEYWORDS = [
    ("cgi", ("cgi", "product")), ("explainer", ("explainer", "vsl")), ("music", ("music", "song")),
    ("social", ("social", "ugc")), ("brand", ("brand", "promo", "bof")),
    ("animation", ("animation", "pixar", "3d")), ("cinematic", ("cinematic", "realistic")),
]

HEADER = """/* VIDEO LIBRARY — the website reads this list.
   Updated automatically by "Update Website.bat". You can safely edit:
     title    : name shown on the card
     style    : first label under the title (e.g. Realistic, 3D Animation)
     featured : true = also plays in the top phone carousel
   Don't edit "source" or "file". */
window.LIBRARY = """


def folder_category(name):
    n = name.lower()
    for cat, words in KEYWORDS:
        if any(w in n for w in words):
            return cat
    return None


def find_ffmpeg():
    p = shutil.which("ffmpeg")
    if p:
        return p
    hits = glob.glob(os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*\**\bin\ffmpeg.exe"), recursive=True)
    if hits:
        return hits[0]
    sys.exit("FFmpeg not found. Install it once with:  winget install Gyan.FFmpeg")


FULL = os.path.join(ROOT, "tools", "library-full.json")  # every video incl. ones still converting


def load_library():
    # website list first (that's where titles are edited), then add anything only in the full list
    items = []
    if os.path.exists(LIB):
        text = open(LIB, encoding="utf-8").read()
        items = json.loads(text[text.index("["): text.rindex("]") + 1])
    if os.path.exists(FULL):
        have = {i["source"] for i in items}
        items += [i for i in json.load(open(FULL, encoding="utf-8")) if i["source"] not in have]
    return items


def save_full(items):
    with open(FULL, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)


def save_library(items):
    with open(LIB, "w", encoding="utf-8") as f:
        f.write(HEADER + json.dumps(items, indent=2, ensure_ascii=False) + ";\n")


JUNK = re.compile(r"^(brief|fin\d+|luca\d+|sha\d+|tofu|mofu|bofu|usa|ai( .*)?|v\d+|final|edit|export)$", re.I)


def clean_title(stem):
    parts = [p.strip(" -_.,") for p in re.split(r"\s+[—–_,]\s*|\s*[—–]\s+|\s{2,}|,", stem)]
    parts = [p for p in parts if p and not JUNK.match(p)]
    title = max(parts, key=len) if parts else stem
    return re.sub(r"\s+v\d+$", "", title, flags=re.I).strip()


def slugify(text, taken):
    base = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "video"
    slug, n = base, 2
    while slug in taken:
        slug, n = f"{base}-{n}", n + 1
    taken.add(slug)
    return slug


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")


def make_poster(ffmpeg, item):
    dst = os.path.join(OUT_V, item["file"] + ".mp4")
    poster = os.path.join(OUT_P, item["file"] + ".jpg")
    if os.path.exists(poster):
        return
    for t in ("2", "0"):
        run([ffmpeg, "-y", "-v", "error", "-ss", t, "-i", dst, "-frames:v", "1", "-vf", "scale=540:-2", "-q:v", "4", poster])
        if os.path.exists(poster):
            return


def main():
    os.makedirs(SRC, exist_ok=True)
    for _, folder, _ in CATEGORIES:  # make sure every category has a folder
        os.makedirs(os.path.join(SRC, folder), exist_ok=True)
    os.makedirs(OUT_V, exist_ok=True)
    os.makedirs(OUT_P, exist_ok=True)
    ffmpeg = find_ffmpeg()

    # 1. every video in VIDEOS, with the category of its folder
    found = {}  # source -> (cat, stem)
    for folder in sorted(os.listdir(SRC)):
        fpath = os.path.join(SRC, folder)
        if not os.path.isdir(fpath) or folder.startswith(("_", ".")):
            continue
        cat = folder_category(folder)
        files = [n for n in sorted(os.listdir(fpath)) if n.lower().endswith(EXTS)]
        if cat is None:
            if files:
                print(f"! Skipped folder '{folder}': name doesn't match a category.")
            continue
        for name in files:
            found[f"{folder}/{name}"] = (cat, os.path.splitext(name)[0])

    # 2. match existing entries (by path, or by file name if the video was moved)
    library = load_library()
    by_name = {}
    for src in found:
        by_name.setdefault(src.split("/", 1)[1], []).append(src)
    claimed = set()
    kept = []
    for item in library:
        src = item["source"]
        if src not in found:
            moved = [s for s in by_name.get(src.split("/", 1)[-1], []) if s not in claimed]
            if not moved:
                print(f"- removed: {item['title']}")
                for p in (os.path.join(OUT_V, item["file"] + ".mp4"), os.path.join(OUT_P, item["file"] + ".jpg")):
                    if os.path.exists(p):
                        os.remove(p)
                continue
            src = item["source"] = moved[0]
        new_cat = found[src][0]
        if item["cat"] != new_cat:
            print(f"> moved: {item['title']}  ->  {dict((c[0], c[1]) for c in CATEGORIES)[new_cat]}")
            item["cat"] = new_cat
        claimed.add(src)
        kept.append(item)
    library = kept

    # 3. new videos
    taken = {i["file"] for i in library}
    for src, (cat, stem) in found.items():
        if src in claimed:
            continue
        title = clean_title(stem)
        library.append({"title": title, "style": DEFAULT_STYLE[cat], "cat": cat, "featured": False,
                        "file": slugify(title, taken), "source": src})
        print(f"+ new: {title}  ({src})")

    library.sort(key=lambda i: CAT_ORDER.index(i["cat"]))
    ready = lambda i: os.path.exists(os.path.join(OUT_V, i["file"] + ".mp4"))

    def publish():
        # the website only ever lists videos whose web copy exists, so nothing shows as broken
        save_full(library)
        save_library([i for i in library if ready(i)])

    publish()

    # 4. convert anything without a web copy yet (the site updates after each one)
    todo = [i for i in library if not ready(i)]
    for n, item in enumerate(todo, 1):
        src = os.path.join(SRC, item["source"].replace("/", os.sep))
        dst = os.path.join(OUT_V, item["file"] + ".mp4")
        tmp = dst + ".part.mp4"
        print(f"[{n}/{len(todo)}] converting {item['title']} ...", flush=True)
        r = run([ffmpeg, "-y", "-v", "error", "-i", src,
                 "-vf", "scale='min(720,iw)':-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-threads", "0",
                 "-maxrate", "3M", "-bufsize", "6M", "-pix_fmt", "yuv420p", "-profile:v", "high",
                 "-c:a", "aac", "-b:a", "128k", "-ac", "2", "-movflags", "+faststart", tmp])
        if r.returncode != 0:
            print("   FAILED:", r.stderr.strip()[-300:])
            if os.path.exists(tmp):
                os.remove(tmp)
            continue
        os.replace(tmp, dst)
        make_poster(ffmpeg, item)
        publish()
        print(f"   done ({os.path.getsize(dst) / 1e6:.1f} MB) - now on the website")

    # 5. any missing thumbnails
    for item in library:
        if ready(item):
            make_poster(ffmpeg, item)

    publish()
    library = [i for i in library if ready(i)]

    print("\nVideos on the website:")
    for cat, folder, _ in CATEGORIES:
        print(f"  {sum(1 for i in library if i['cat'] == cat):>3}  {folder[3:]}")
    print(f"\nDone. Refresh the website (Ctrl+F5).")


if __name__ == "__main__":
    main()
