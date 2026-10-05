#!/usr/bin/env python3
"""Stillness Journey v7 build (violin music loop, brand-look 16:9 stills, 13 different transitions). Usage: build_v6.py [overlays|clips|master|small|sheet|all] [chapter ...]

Inputs: video/v7/stills/*.jpg (1376x768, text-free), video/v7/music/violin-stillness-instrumental.mp3.
Steps: overlays | music | clips | master | small | sheet | all
Work dir: $WORK (default /tmp/sg_v6). Chapters can be rebuilt one at a time:
  build_v6.py overlays 5 ; build_v6.py clips 5 ; build_v6.py master ; build_v6.py small
"""
import os, subprocess, sys, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.environ.get("WORK", "/tmp/sg_v7b")
FONT = os.path.expanduser("~/.fonts/EBGaramond.ttf")
W, H, FPS, T = 1920, 1080, 24, 4.0   # frame, fps, transition length (s)
CREAM, GOLD = "#F5F0E8", "#C9A84C"
MAXW = int(W * 0.70)                  # text block never wider than 70% of frame
TOTAL = 1948.5                        # = v5 audio length

# join start times (s), from v5: intro->ch1, ch1->ch2 ... ch12->outro
JOINS = [17.3, 175.3, 334.3, 493.2, 652.5, 811.4, 970.5, 1129.7, 1288.7, 1447.9, 1607.1, 1766.0, 1925.1]
# one transition per join (intro->ch1, ch1->ch2 ... ch12->outro); no two neighbours alike
XF = ["fade", "fadeblack", "wipeleft", "smoothleft", "fadegrays", "wiperight", "smoothright", "fadeblack", "radial", "circleopen", "smoothup", "wipedown", "fade"]
ZOOM_OUT = set()   # unused in v7
ZOOM_IN = set()
ZOOM = 0.10

CHAPTERS = {
 1: ("Be still, and know that I am God:\nI will be exalted among the heathen,\nI will be exalted in the earth.", "PSALM 46:10"),
 2: ("Come unto me, all ye that labour\nand are heavy laden,\nand I will give you rest.", "MATTHEW 11:28"),
 3: ("Thou wilt keep him in perfect peace,\nwhose mind is stayed on thee:\nbecause he trusteth in thee.", "ISAIAH 26:3"),
 4: ("Keep thy heart with all diligence;\nfor out of it are the issues of life.", "PROVERBS 4:23"),
 5: ("But seek ye first the kingdom of God,\nand his righteousness;\nand all these things shall be added unto you.", "MATTHEW 6:33"),
 6: ("Wait on the LORD: be of good courage,\nand he shall strengthen thine heart:\nwait, I say, on the LORD.", "PSALM 27:14"),
 7: ("But they that wait upon the LORD shall renew their strength;\nthey shall mount up with wings as eagles;\nthey shall run, and not be weary;\nand they shall walk, and not faint.", "ISAIAH 40:31"),
 8: ("Fear thou not; for I am with thee: be not dismayed;\nfor I am thy God: I will strengthen thee; yea, I will help thee;\nyea, I will uphold thee with the right hand of my righteousness.", "ISAIAH 41:10"),
 9: ("The LORD thy God in the midst of thee is mighty; he will save,\nhe will rejoice over thee with joy; he will rest in his love,\nhe will joy over thee with singing.", "ZEPHANIAH 3:17"),
 10: ("Peace I leave with you, my peace I give unto you:\nnot as the world giveth, give I unto you.\nLet not your heart be troubled, neither let it be afraid.", "JOHN 14:27"),
 11: ("Let the words of my mouth, and the meditation of my heart,\nbe acceptable in thy sight,\nO LORD, my strength, and my redeemer.", "PSALM 19:14"),
 12: ("He that dwelleth in the secret place of the most High\nshall abide under the shadow of the Almighty.", "PSALM 91:1"),
}
INTRO = ["Sanctuary Grace Ministry presents", "A Stillness Journey", "Twelve scriptures.", "Thirty-two minutes of rest for the soul."]
# outro lines: (text, colour, appear time in clip, point size)
OUTRO = [("Be still, and know that I am God.", CREAM, 6.0, 46), ("PSALM 46:10", GOLD, 7.0, 32),
         ("Carry this peace with you.", CREAM, 10.5, 46), ("Sanctuary Grace Ministry", CREAM, 14.0, 40)]


def run(cmd, **kw):
    r = subprocess.run(cmd, shell=isinstance(cmd, str), capture_output=True, text=True, **kw)
    if r.returncode:
        sys.exit("FAILED: %s\n%s" % (cmd if isinstance(cmd, str) else " ".join(cmd), r.stderr[-1500:]))
    return r.stdout


def label(text, color, pt, out, kern=0, spacing=14):
    run(["convert", "-background", "none", "-fill", color, "-font", FONT, "-pointsize", str(pt),
         "-kerning", str(kern), "-interline-spacing", str(spacing), "-gravity", "center", "label:" + text, out])
    w = int(run(["identify", "-format", "%w", out]))
    assert w <= MAXW, "text too wide (%d > %d): %r" % (w, MAXW, text[:40])
    return w


def band(path):
    # dark gradient over the bottom 750 px: transparent at the top, ~0.93 opaque where the text sits
    bh = 750
    def ss(a, b, x):
        t = min(1.0, max(0.0, (x - a) / (b - a)))
        return t * t * (3 - 2 * t)
    rows = bytes(int(255 * 0.93 * ss(0.05, 0.62, y / bh)) for y in range(bh))
    with open(path + ".m.pgm", "wb") as f:
        f.write(b"P5\n1 %d\n255\n" % bh + rows)
    run(["convert", "-size", "%dx%d" % (W, bh), "xc:black", "(", path + ".m.pgm", "-scale", "%dx%d!" % (W, bh), ")",
         "-alpha", "off", "-compose", "copy_opacity", "-composite", path + ".g.png"])
    run(["convert", "-size", "%dx%d" % (W, H), "xc:none", path + ".g.png", "-gravity", "south", "-composite", "PNG32:" + path])
    os.remove(path + ".g.png"); os.remove(path + ".m.pgm")


def overlays(only=None):
    os.makedirs(WORK + "/ov", exist_ok=True)
    bp = WORK + "/ov/band.png"
    band(bp)
    for k, (verse, ref) in CHAPTERS.items():
        if only and k not in only:
            continue
        v, r, blk = (WORK + "/ov/v%02d.png" % k, WORK + "/ov/r%02d.png" % k, WORK + "/ov/b%02d.png" % k)
        label(verse, CREAM, 46, v)
        label(ref, GOLD, 32, r, kern=3)
        # stack verse + gap + reference, centered
        run(["convert", "-background", "none", v, "(", "-size", "1x30", "xc:none", ")", r, "-gravity", "center", "-append", blk])
        run(["convert", "-size", "%dx%d" % (W, H), "xc:none", bp, "-composite", blk, "-gravity", "south",
             "-geometry", "+0+105", "-composite", "PNG32:" + WORK + "/ov/ch%02d.png" % k])
    if not only or 0 in only:
        for i, line in enumerate(INTRO):
            p = WORK + "/ov/in%d.png" % i
            label(line, CREAM, 46 if i == 0 else 50, p)
            y = 105 + (3 - i) * 74
            run(["convert", "-size", "%dx%d" % (W, H), "xc:none", p, "-gravity", "south", "-geometry", "+0+%d" % y, "-composite", "PNG32:" + WORK + "/ov/in%d_full.png" % i])
    if not only or 13 in only:
        for i, (t, c, at, pt) in enumerate(OUTRO):
            p = WORK + "/ov/out%d.png" % i
            label(t, c, pt, p, kern=3 if c == GOLD else 0)
        # fixed y positions (from bottom): verse 330, ref 262, carry 190, sign-off 105
        for i, y in enumerate([330, 265, 190, 105]):
            run(["convert", "-size", "%dx%d" % (W, H), "xc:none", WORK + "/ov/out%d.png" % i, "-gravity", "south",
                 "-geometry", "+0+%d" % y, "-composite", "PNG32:" + WORK + "/ov/out%d_full.png" % i])


def clip_lengths():
    L = {0: JOINS[0] + T}
    for k in range(1, 13):
        L[k] = JOINS[k] - JOINS[k - 1] + T
    L[13] = TOTAL - JOINS[12]
    return L


def still_chain(name, idx, k=None, L=0.0):
    z = ""
    if k in ZOOM_OUT:
        zf = "min(1,max(0,(t-%.2f)/%.2f))" % (L - T, T)
    elif k in ZOOM_IN:
        zf = "(1-min(1,max(0,t/%.2f)))" % T
    else:
        zf = None
    if zf:
        z = ",scale=w='2*trunc(%d*(1+%.2f*%s))':h='2*trunc(%d*(1+%.2f*%s))':eval=frame:flags=bicubic,crop=%d:%d" % (W // 2, ZOOM, zf, H // 2, ZOOM, zf, W, H)
    return ("[%d:v]scale=-2:%d:flags=lanczos,crop=%d:%d,unsharp=5:5:0.6:5:5:0.0%s,format=rgba[bg%d]" % (idx, H, W, H, z, idx))


def fade_in_out(idx, ov_idx, t_in, d_in, t_out, d_out):
    f = "[%d:v]format=rgba" % ov_idx
    f += ",fade=t=in:st=%.2f:d=%.2f:alpha=1" % (t_in, d_in)
    if t_out is not None:
        f += ",fade=t=out:st=%.2f:d=%.2f:alpha=1" % (t_out, d_out)
    return f


def build_clip(k):
    L = clip_lengths()[k]
    out = WORK + "/clips/c%02d.mp4" % k
    os.makedirs(WORK + "/clips", exist_ok=True)
    still = {0: "intro", 13: "outro"}.get(k, "ch%02d" % k)
    inputs = ["-loop", "1", "-framerate", str(FPS), "-t", "%.2f" % L, "-i", HERE + "/v7/stills/%s.jpg" % still]
    parts = [still_chain(still, 0, k, L)]
    last = "bg0"
    n = 1
    if k == 0:
        starts = [2.5, 5.5, 8.5, 11.5]
        for i, st in enumerate(starts):
            inputs += ["-loop", "1", "-framerate", str(FPS), "-t", "%.2f" % L, "-i", WORK + "/ov/in%d_full.png" % i]
            parts.append(fade_in_out(0, n, st, 1.2, JOINS[0] - 2.0, 1.5) + "[o%d]" % i)
            parts.append("[%s][o%d]overlay=0:0:format=auto[s%d]" % (last, i, i))
            last = "s%d" % i
            n += 1
    elif k == 13:
        ends = L - 4.0  # text fades out, then fade to black, then 2 s of black
        # a black band is also needed: use gradient band with the first text
        inputs += ["-loop", "1", "-framerate", str(FPS), "-t", "%.2f" % L, "-i", WORK + "/ov/band.png"]
        parts.append("[%d:v]format=rgba,fade=t=in:st=5.0:d=1.5:alpha=1[bnd]" % n)
        parts.append("[%s][bnd]overlay=0:0:format=auto[sb]" % last)
        last = "sb"
        n += 1
        for i, (t, c, at, pt) in enumerate(OUTRO):
            inputs += ["-loop", "1", "-framerate", str(FPS), "-t", "%.2f" % L, "-i", WORK + "/ov/out%d_full.png" % i]
            parts.append(fade_in_out(0, n, at, 1.3, L - 6.0, 1.5) + "[o%d]" % i)
            parts.append("[%s][o%d]overlay=0:0:format=auto[s%d]" % (last, i, i))
            last = "s%d" % i
            n += 1
        # picture dips to black at the end, 2 s of black
        parts.append("[%s]fade=t=out:st=%.2f:d=2.0:color=black[vout]" % (last, L - 4.0))
        last = "vout"
    else:
        inputs += ["-loop", "1", "-framerate", str(FPS), "-t", "%.2f" % L, "-i", WORK + "/ov/ch%02d.png" % k]
        # text in after the previous transition has cleared, out as the next one starts
        t_in = 2.2
        t_out = L - T
        parts.append(fade_in_out(0, 1, t_in, 1.4, t_out, 1.2) + "[ov]")
        parts.append("[bg0][ov]overlay=0:0:format=auto[vout]")
        last = "vout"
    parts.append("[%s]format=yuv420p[final]" % last)
    cmd = ["ffmpeg", "-v", "error", "-y"] + inputs + ["-filter_complex", ";".join(parts), "-map", "[final]",
           "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", "-tune", "stillimage", "-t", "%.2f" % L, out]
    run(cmd)
    return out


def clips(only=None):
    for k in range(0, 14):
        if only and k not in only:
            continue
        build_clip(k)


def master():
    L = clip_lengths()
    cmd = ["ffmpeg", "-v", "error", "-y"]
    for k in range(14):
        cmd += ["-i", WORK + "/clips/c%02d.mp4" % k]
    cmd += ["-i", WORK + "/music.wav"]
    parts = []
    prev = "0:v"
    for k in range(1, 14):
        xf = XF[k - 1]
        # xfade offset = start of the transition on the accumulated timeline
        parts.append("[%s][%d:v]xfade=transition=%s:duration=%.2f:offset=%.2f[x%d]" % (prev, k, xf, T, JOINS[k - 1], k))
        prev = "x%d" % k
    cmd += ["-filter_complex", ";".join(parts), "-map", "[%s]" % prev, "-map", "14:a", "-c:a", "aac", "-b:a", "192k",
            "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-tune", "stillimage", "-pix_fmt", "yuv420p",
            "-r", str(FPS), "-movflags", "+faststart", "-t", "%.2f" % TOTAL, WORK + "/master_v7.mp4"]
    run(cmd)


def small():
    aud = int(96000 / 8 * TOTAL)
    budget = 28 * 1048576 - aud - 600000          # container overhead margin
    kbps = int(os.environ.get("KBPS") or budget * 8 / TOTAL / 1000)   # x264 overshoots at this rate: KBPS=16 landed under 28 MiB
    print("video bitrate target: %d kbps (audio AAC 96k)" % kbps)
    src, out = WORK + "/master_v7.mp4", WORK + "/TQA_Stillness_Journey_32min_FINAL_v7.mp4"
    base = ["ffmpeg", "-v", "error", "-y", "-i", src, "-c:v", "libx264", "-preset", "slow", "-tune", "stillimage",
            "-b:v", "%dk" % kbps, "-maxrate", "%dk" % int(kbps * float(os.environ.get("MAXF", "3"))), "-bufsize", "%dk" % int(kbps * float(os.environ.get("BUFF", "6"))), "-pix_fmt", "yuv420p",
            "-r", os.environ.get("FPSOUT", str(FPS)), "-passlogfile", WORK + "/pass"]   # small file: FPSOUT=12 (static stills) keeps AAC 96k under 28 MiB
    if not os.path.exists(WORK + "/pass-0.log"):
        run(base + ["-pass", "1", "-an", "-f", "null", "/dev/null"])
    run(["ffmpeg", "-v", "error", "-y", "-i", src, "-i", WORK + "/music.wav"] + base[6:] + ["-pass", "2", "-map", "0:v", "-map", "1:a",
         "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "-t", "%.2f" % TOTAL, out])
    print(out, os.path.getsize(out), "bytes")


def music():
    """Seamless loop unit: crossfade the last 4 s into the first 4 s (242.64 -> 238.64 s), repeat, fade in/out."""
    src = HERE + "/v7/music/violin-stillness-instrumental.mp3"
    dur = float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).strip())
    unit = dur - 4.0
    run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_complex",
         "[0:a]atrim=%.3f:%.3f,asetpts=PTS-STARTPTS[a];[0:a]atrim=0:4,asetpts=PTS-STARTPTS[b];"
         "[a]afade=t=out:st=0:d=4:curve=qsin[af];[b]afade=t=in:st=0:d=4:curve=qsin[bf];"
         "[af][bf]amix=inputs=2:duration=longest:normalize=0[x];[0:a]atrim=4:%.3f,asetpts=PTS-STARTPTS[m];[x][m]concat=n=2:v=0:a=1[u]" % (unit, dur, unit),
         "-map", "[u]", "-ar", "48000", "-ac", "2", WORK + "/unit.wav"])
    run(["ffmpeg", "-v", "error", "-y", "-stream_loop", "9", "-i", WORK + "/unit.wav", "-t", "%.2f" % TOTAL, "-af",
         "afade=t=in:st=0:d=8,afade=t=out:st=%.2f:d=12" % (TOTAL - 12), "-ar", "48000", "-ac", "2", WORK + "/music.wav"])
    print("unit %.2f s, music %.2f s" % (unit, float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", WORK + "/music.wav"]).strip())))


def clicks():
    """Max sample-to-sample jump within +-20 ms of every loop join vs the loudest ordinary jump elsewhere."""
    import array
    unit = float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", WORK + "/unit.wav"]).strip())
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", WORK + "/music.wav", "-ac", "1", "-f", "s16le", "-"], capture_output=True).stdout
    a = array.array("h"); a.frombytes(raw[:len(raw) // 2 * 2])
    sr = 48000
    def jump(i0, i1):
        return max(abs(a[i] - a[i - 1]) for i in range(max(1, i0), min(len(a), i1)))
    base = max(jump(int((unit * 0.5 + d) * sr), int((unit * 0.5 + d) * sr) + 2000) for d in range(0, 40, 4))
    out = []
    k = 1
    while unit * k < TOTAL - 1:
        c = int(unit * k * sr); out.append((round(unit * k, 2), jump(c - 960, c + 960)))
        k += 1
    print("typical max jump %d; joins: %s" % (base, out))


def sheet():
    out = WORK + "/TQA_Stillness_Journey_32min_FINAL_v7.mp4"
    os.makedirs(WORK + "/frames", exist_ok=True)
    times = [("00_intro", 14.0)]
    for k in range(1, 13):
        s0 = JOINS[k - 1]; e0 = JOINS[k]
        times += [("%02d_a" % k, s0 + 12.0), ("%02d_b" % k, (s0 + e0) / 2), ("%02d_c" % k, e0 - 12.0)]
    times.append(("13_outro", JOINS[12] + 15.0))
    for name, t in times:
        run(["ffmpeg", "-v", "error", "-y", "-ss", "%.2f" % t, "-i", out, "-frames:v", "1", "-vf", "scale=320:180", WORK + "/frames/%s.png" % name])
    files = [WORK + "/frames/%s.png" % n for n, _ in times]
    run(["montage"] + files + ["-tile", "6x", "-geometry", "320x180+3+3", "-background", "#111", WORK + "/contact_sheet.jpg"])
    for name, t in (("full_hands", JOINS[5] + 60.0), ("full_woman", JOINS[0] + 60.0)):   # ch6 hands, ch1 woman
        run(["ffmpeg", "-v", "error", "-y", "-ss", "%.2f" % t, "-i", out, "-frames:v", "1", WORK + "/%s.png" % name])
    # transitions: mid-point of every join
    for k in range(13):
        run(["ffmpeg", "-v", "error", "-y", "-ss", "%.2f" % (JOINS[k] + 2.0), "-i", out, "-frames:v", "1", "-vf", "scale=480:270", WORK + "/frames/t%02d.png" % k])
    run(["montage"] + [WORK + "/frames/t%02d.png" % k for k in range(13)] + ["-tile", "5x", "-geometry", "480x270+3+3", "-background", "#111", WORK + "/transitions.jpg"])


if __name__ == "__main__":
    step = sys.argv[1] if len(sys.argv) > 1 else "all"
    only = [int(a) for a in sys.argv[2:]] or None
    if not os.path.exists(FONT):
        shutil.copy(os.path.expanduser("~/.fonts/EBGaramond[wght].ttf"), FONT)
    os.makedirs(WORK, exist_ok=True)
    if step in ("overlays", "all"): overlays(only)
    if step in ("music", "all"): music()
    if step == "clicks": clicks()
    if step in ("clips", "all"): clips(only)
    if step in ("master", "all"): master()
    if step in ("small", "all"): small()
    if step in ("sheet", "all"): sheet()
