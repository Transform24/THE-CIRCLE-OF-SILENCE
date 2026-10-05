#!/usr/bin/env python3
"""Stillness Journey v8 build.

Changes from v7: 24 fps, one transition everywhere (2 s dip through dark), chapter title card,
slow 4 percent push-in, 3 crops of the same still per chapter, explanation lines from explanations.md,
Romans 10:9-10 kicker, thank-you outro card.

Usage: build_v8.py music | overlays | clip N | clips | master | small | sheet | all
  clip index: 0 intro, 1..12 chapters, 13 kicker, 14 outro.
Inputs: video/v7/stills/*.jpg, video/v7/music/violin-stillness-instrumental.mp3, explanations.md (repo root).
Work dir: $WORK (default /tmp/sg_v8). Small encode knobs: KBPS, AUDK (default 64), FPSOUT (24), RES (e.g. 1280:720).
"""
import os, subprocess, sys, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
WORK = os.environ.get("WORK", "/tmp/sg_v8")
FONT = os.path.expanduser("~/.fonts/EBGaramond.ttf")
W, H, FPS, DIP = 1920, 1080, 24, 2.0
CREAM, GOLD = "#F5F0E8", "#C9A84C"
MAXW = int(W * 0.70)
TOTAL = 1948.5
I_LEN, K_LEN, O_LEN = 18.0, 26.0, 22.0
N_CH = 12
CH_LEN = (TOTAL + 14 * DIP - I_LEN - K_LEN - O_LEN) / N_CH
LEN = [I_LEN] + [CH_LEN] * N_CH + [K_LEN, O_LEN]          # 15 clips, 14 joins
START = [0.0]
for _l in LEN[:-1]:
    START.append(START[-1] + _l - DIP)                      # start time of every clip in the final video
ZOOM = 0.04                                                 # push-in over each segment
STILLS = HERE + "/v7/stills"

CHAPTERS = {
 1: ("Be still, and know that I am God:\nI will be exalted among the heathen,\nI will be exalted in the earth."),
 2: ("Come unto me, all ye that labour\nand are heavy laden,\nand I will give you rest."),
 3: ("Thou wilt keep him in perfect peace,\nwhose mind is stayed on thee:\nbecause he trusteth in thee."),
 4: ("Keep thy heart with all diligence;\nfor out of it are the issues of life."),
 5: ("But seek ye first the kingdom of God,\nand his righteousness;\nand all these things shall be added unto you."),
 6: ("Wait on the LORD: be of good courage,\nand he shall strengthen thine heart:\nwait, I say, on the LORD."),
 7: ("But they that wait upon the LORD shall renew their strength;\nthey shall mount up with wings as eagles;\nthey shall run, and not be weary;\nand they shall walk, and not faint."),
 8: ("Fear thou not; for I am with thee: be not dismayed;\nfor I am thy God: I will strengthen thee; yea, I will help thee;\nyea, I will uphold thee with the right hand of my righteousness."),
 9: ("The LORD thy God in the midst of thee is mighty; he will save,\nhe will rejoice over thee with joy; he will rest in his love,\nhe will joy over thee with singing."),
 10: ("Peace I leave with you, my peace I give unto you:\nnot as the world giveth, give I unto you.\nLet not your heart be troubled, neither let it be afraid."),
 11: ("Let the words of my mouth, and the meditation of my heart,\nbe acceptable in thy sight,\nO LORD, my strength, and my redeemer."),
 12: ("He that dwelleth in the secret place of the most High\nshall abide under the shadow of the Almighty."),
}
KICK9 = "That if thou shalt confess with thy mouth the Lord Jesus,\nand shalt believe in thine heart that God hath raised him from the dead,\nthou shalt be saved."
KICK10 = "For with the heart man believeth unto righteousness;\nand with the mouth confession is made unto salvation."
KICK_REF = "ROMANS 10:9-10"
INTRO = ["Sanctuary Grace Ministry presents", "A Stillness Journey", "Twelve scriptures.", "Thirty-two minutes of rest for the soul."]
OUTRO = [("Thank you for watching.", CREAM, 3.0, 50), ("If this gave you rest, like and subscribe.", CREAM, 6.5, 44),
         ("Reach out. Come home to The Quiet Authority.", CREAM, 10.0, 44), ("sanctuary-grace.com", GOLD, 13.5, 48)]


def run(cmd):
    r = subprocess.run(cmd, shell=isinstance(cmd, str), capture_output=True, text=True)
    if r.returncode:
        sys.exit("FAILED: %s\n%s" % (cmd if isinstance(cmd, str) else " ".join(cmd), r.stderr[-1500:]))
    return r.stdout


def explanations():
    out, cur = {}, None
    for line in open(ROOT + "/explanations.md", encoding="utf-8"):
        m = re.match(r"## (\d+) \| (.+?) \| (.+)$", line.strip())
        if m:
            cur = int(m.group(1)); out[cur] = {"ref": m.group(2), "title": m.group(3), "lines": []}
        elif cur and line.strip() and not line.startswith("#"):
            out[cur]["lines"].append(line.strip())
    return out


def label(text, color, pt, out, kern=0, spacing=12):
    run(["convert", "-background", "none", "-fill", color, "-font", FONT, "-pointsize", str(pt), "-kerning", str(kern),
         "-interline-spacing", str(spacing), "-gravity", "center", "label:" + text, out])
    w, h = map(int, run(["identify", "-format", "%w %h", out]).split())
    assert w <= MAXW, "text too wide (%d > %d): %r" % (w, MAXW, text[:40])
    return w, h


def place(img, y, out):
    run(["convert", "-size", "%dx%d" % (W, H), "xc:none", img, "-gravity", "south", "-geometry", "+0+%d" % y, "-composite", "PNG32:" + out])


def stack(parts, gaps, out):
    cmd = ["convert", "-background", "none"]
    for i, p in enumerate(parts):
        if i:
            cmd += ["(", "-size", "1x%d" % gaps[i - 1], "xc:none", ")"]
        cmd.append(p)
    run(cmd + ["-gravity", "center", "-append", out])


def band(path, bh=800, full_at=0.45):
    """Dark gradient from the bottom: transparent at its top, ~0.92 opaque by full_at of its height."""
    def ss(a, b, x):
        t = min(1.0, max(0.0, (x - a) / (b - a)))
        return t * t * (3 - 2 * t)
    rows = bytes(int(255 * 0.92 * ss(0.0, full_at, y / bh)) for y in range(bh))
    with open(path + ".m.pgm", "wb") as f:
        f.write(b"P5\n1 %d\n255\n" % bh + rows)
    run(["convert", "-size", "%dx%d" % (W, bh), "xc:black", "(", path + ".m.pgm", "-scale", "%dx%d!" % (W, bh), ")",
         "-alpha", "off", "-compose", "copy_opacity", "-composite", path + ".g.png"])
    run(["convert", "-size", "%dx%d" % (W, H), "xc:none", path + ".g.png", "-gravity", "south", "-composite", "PNG32:" + path])
    os.remove(path + ".g.png"); os.remove(path + ".m.pgm")


def overlays():
    d = WORK + "/ov"; os.makedirs(d, exist_ok=True)
    band(d + "/band_intro.png", 560, 0.30)
    band(d + "/band_kick.png", 700, 0.30)
    ex = explanations()
    for k in range(1, N_CH + 1):
        e = ex[k]
        vw, vh = label(CHAPTERS[k], CREAM, 44, d + "/v%02d.png" % k)
        rw, rh = label(e["ref"], GOLD, 30, d + "/r%02d.png" % k, kern=3)
        ww, wh = label("\n".join(e["lines"]), CREAM, 36, d + "/x%02d.png" % k, spacing=10)
        y_expl = 100
        y_ref = y_expl + wh + 36
        y_verse = y_ref + rh + 24
        stack([d + "/v%02d.png" % k, d + "/r%02d.png" % k], [24], d + "/vr%02d.png" % k)
        place(d + "/vr%02d.png" % k, y_ref, d + "/verse%02d.png" % k)
        place(d + "/x%02d.png" % k, y_expl, d + "/expl%02d.png" % k)
        label("%d  ·  %s" % (k, e["title"].upper()), GOLD, 34, d + "/t%02d.png" % k, kern=5)
        place(d + "/t%02d.png" % k, 250, d + "/title%02d.png" % k)
        assert y_verse + vh < 640, "text block too tall for chapter %d" % k
        band(d + "/band%02d.png" % k, y_verse + vh + 150, 0.27)
    for i, line in enumerate(INTRO):
        label(line, CREAM, 46 if i == 0 else 50, d + "/in%d.png" % i)
        place(d + "/in%d.png" % i, 105 + (3 - i) * 74, d + "/in%d_full.png" % i)
    for i, (t, c, at, pt) in enumerate(OUTRO):
        label(t, c, pt, d + "/out%d.png" % i, kern=3 if c == GOLD else 0)
        place(d + "/out%d.png" % i, [520, 430, 340, 250][i], d + "/out%d_full.png" % i)
    label(KICK9, CREAM, 42, d + "/k9.png"); label(KICK10, CREAM, 42, d + "/k10.png"); label(KICK_REF, GOLD, 32, d + "/kr.png", kern=3)
    stack([d + "/k9.png", d + "/k10.png", d + "/kr.png"], [26, 30], d + "/kb.png")
    place(d + "/kb.png", 150, d + "/kick_full.png")


def fade(idx, t_in, d_in, t_out=None, d_out=0):
    f = "[%d:v]format=rgba,fade=t=in:st=%.2f:d=%.2f:alpha=1" % (idx, t_in, d_in)
    if t_out is not None:
        f += ",fade=t=out:st=%.2f:d=%.2f:alpha=1" % (t_out, d_out)
    return f


def seg_filter(idx, label_out, seg, S, p0, p1, py):
    """One crop of the still with a slow push-in (ZOOM over the segment) and a slow horizontal drift."""
    u = "min(1,t/%.3f)" % seg
    return ("[%d:v]scale=-2:%d:flags=lanczos,crop=%d:%d,unsharp=5:5:0.5:5:5:0.0,"
            "scale=w='2*trunc(%d*%.3f*(1+%.3f*%s))':h='2*trunc(%d*%.3f*(1+%.3f*%s))':eval=frame:flags=bicubic,"
            "crop=%d:%d:x='(iw-%d)*(%.3f+(%.3f)*%s)':y='(ih-%d)*%.3f',format=yuv420p[%s]"
            % (idx, H, W, H, W // 2, S, ZOOM, u, H // 2, S, ZOOM, u, W, H, W, p0, p1 - p0, u, H, py, label_out))


def inp(path, length):
    return ["-loop", "1", "-framerate", str(FPS), "-t", "%.3f" % length, "-i", path]


def build_clip(i):
    L = LEN[i]
    out = WORK + "/clips/c%02d.mp4" % i
    os.makedirs(WORK + "/clips", exist_ok=True)
    d = WORK + "/ov"
    rev = (i % 2 == 0)                       # alternate drift direction by chapter
    def drift(a, b):
        return (b, a) if rev else (a, b)
    inputs, parts = [], []
    if 1 <= i <= N_CH:
        seg = (L + 2 * DIP) / 3
        still = STILLS + "/ch%02d.jpg" % i
        specs = [(1.00, ) + drift(0.35, 0.65) + (0.50,), (1.18, ) + drift(0.12, 0.30) + (0.10,), (1.18, ) + drift(0.88, 0.70) + (0.15,)]
        for j, sp in enumerate(specs):
            inputs += inp(still, seg)
            parts.append(seg_filter(j, "s%d" % j, seg, *sp))
        parts.append("[s0][s1]xfade=transition=fadeblack:duration=%.2f:offset=%.3f[x1]" % (DIP, seg - DIP))
        parts.append("[x1][s2]xfade=transition=fadeblack:duration=%.2f:offset=%.3f[x2]" % (DIP, 2 * seg - 2 * DIP))
        last = "x2"
        # overlays: band + title (first 4 s of the chapter), verse, explanation about 10 s after the verse
        names = [("band%02d.png" % i, fade(3, 1.6, 1.4)), ("title%02d.png" % i, fade(4, 2.2, 1.0, 5.2, 0.9)),
                 ("verse%02d.png" % i, fade(5, 6.5, 1.4)), ("expl%02d.png" % i, fade(6, 16.5, 1.4))]
        for n, (f, spec) in enumerate(names):
            inputs += inp(d + "/" + f, L)
        for n, (f, spec) in enumerate(names):
            parts.append(spec + "[o%d]" % n)
            parts.append("[%s][o%d]overlay=0:0:format=auto[y%d]" % (last, n, n))
            last = "y%d" % n
    elif i == 0 or i == 13:
        still = STILLS + ("/intro.jpg" if i == 0 else "/outro.jpg")
        inputs += inp(still, L)
        parts.append(seg_filter(0, "s0", L, 1.0, *(drift(0.40, 0.60) + (0.5,))))
        last = "s0"
        if i == 0:
            inputs += inp(d + "/band_intro.png", L); n = 2
            parts.append(fade(1, 1.5, 1.5) + "[bnd]"); parts.append("[s0][bnd]overlay=0:0:format=auto[b0]"); last = "b0"
            for k, st in enumerate([2.5, 5.0, 7.5, 10.0]):
                inputs += inp(d + "/in%d_full.png" % k, L)
                parts.append(fade(n, st, 1.2, L - DIP - 1.8, 1.2) + "[o%d]" % k)
                parts.append("[%s][o%d]overlay=0:0:format=auto[y%d]" % (last, k, k)); last = "y%d" % k; n += 1
        else:
            inputs += inp(d + "/band_kick.png", L); inputs += inp(d + "/kick_full.png", L)
            parts.append(fade(1, 1.5, 1.5) + "[bnd]"); parts.append("[s0][bnd]overlay=0:0:format=auto[b0]")
            parts.append(fade(2, 3.0, 1.6) + "[ko]"); parts.append("[b0][ko]overlay=0:0:format=auto[y0]"); last = "y0"
    else:   # outro card: dark background, one line at a time, fade to black, 2 s of black
        inputs += ["-f", "lavfi", "-i", "color=c=0x0b0806:s=%dx%d:r=%d:d=%.3f" % (W, H, FPS, L)]
        last = "0:v"
        n = 1
        for k, (t, c, at, pt) in enumerate(OUTRO):
            inputs += inp(d + "/out%d_full.png" % k, L)
            parts.append(fade(n, at, 1.3, 16.0, 1.5) + "[o%d]" % k)
            parts.append("[%s][o%d]overlay=0:0:format=auto[y%d]" % (last, k, k)); last = "y%d" % k; n += 1
        parts.append("[%s]fade=t=out:st=17.5:d=2.0:color=black[fb]" % last); last = "fb"   # background to pure black, then 2 s of black
    parts.append("[%s]format=yuv420p[final]" % last)
    run(["ffmpeg", "-v", "error", "-y"] + inputs + ["-filter_complex", ";".join(parts), "-map", "[final]", "-r", str(FPS),
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "15", "-tune", "stillimage", "-t", "%.3f" % L, out])
    return out


def clips(only=None):
    for i in range(15):
        if only is not None and i not in only:
            continue
        build_clip(i)
        print("clip %d %d bytes" % (i, os.path.getsize(WORK + "/clips/c%02d.mp4" % i)), flush=True)


def music():
    """Violin loop: crossfade last 4 s into first 4 s (unit 238.64 s), repeat, fade in 8 s, fade out 12 s."""
    src = ROOT + "/video/v7/music/violin-stillness-instrumental.mp3"
    dur = float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).strip())
    unit = dur - 4.0
    run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_complex",
         "[0:a]atrim=%.3f:%.3f,asetpts=PTS-STARTPTS[a];[0:a]atrim=0:4,asetpts=PTS-STARTPTS[b];"
         "[a]afade=t=out:st=0:d=4:curve=qsin[af];[b]afade=t=in:st=0:d=4:curve=qsin[bf];"
         "[af][bf]amix=inputs=2:duration=longest:normalize=0[x];[0:a]atrim=4:%.3f,asetpts=PTS-STARTPTS[m];[x][m]concat=n=2:v=0:a=1[u]" % (unit, dur, unit),
         "-map", "[u]", "-ar", "48000", "-ac", "2", WORK + "/unit.wav"])
    run(["ffmpeg", "-v", "error", "-y", "-stream_loop", "9", "-i", WORK + "/unit.wav", "-t", "%.2f" % TOTAL, "-af",
         "afade=t=in:st=0:d=8,afade=t=out:st=%.2f:d=12" % (TOTAL - 12), "-ar", "48000", "-ac", "2", WORK + "/music.wav"])


def master():
    cmd = ["ffmpeg", "-v", "error", "-y"]
    for i in range(15):
        cmd += ["-i", WORK + "/clips/c%02d.mp4" % i]
    cmd += ["-i", WORK + "/music.wav"]
    parts, prev = [], "0:v"
    for j in range(1, 15):
        parts.append("[%s][%d:v]xfade=transition=fadeblack:duration=%.2f:offset=%.3f[x%d]" % (prev, j, DIP, START[j], j))
        prev = "x%d" % j
    cmd += ["-filter_complex", ";".join(parts), "-map", "[%s]" % prev, "-map", "15:a", "-c:a", "aac", "-b:a", "192k",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-r", str(FPS),
            "-movflags", "+faststart", "-t", "%.2f" % TOTAL, WORK + "/master_v8.mp4"]
    run(cmd)


def small():
    audk = int(os.environ.get("AUDK", "64"))
    fps = os.environ.get("FPSOUT", str(FPS))
    res = os.environ.get("RES")
    aud = int(audk * 1000 / 8 * TOTAL)
    budget = 28 * 1048576 - aud - 1300000
    kbps = int(os.environ.get("KBPS") or budget * 8 / TOTAL / 1000)
    print("video target %d kbps, audio AAC %dk, %s fps, res %s" % (kbps, audk, fps, res or "1920x1080"), flush=True)
    src, out = WORK + "/master_v8.mp4", WORK + "/TQA_Stillness_Journey_FINAL_v8.mp4"
    vf = ["-vf", "scale=%s:flags=lanczos" % res] if res else []
    base = ["-c:v", "libx264", "-preset", "slow", "-tune", "stillimage", "-b:v", "%dk" % kbps, "-maxrate", "%dk" % (kbps * 3),
            "-bufsize", "%dk" % (kbps * 6), "-pix_fmt", "yuv420p", "-r", fps] + vf + ["-passlogfile", WORK + "/pass"]
    if not os.path.exists(WORK + "/pass-0.log"):
        run(["ffmpeg", "-v", "error", "-y", "-i", src] + base + ["-pass", "1", "-an", "-f", "null", "/dev/null"])
    run(["ffmpeg", "-v", "error", "-y", "-i", src, "-i", WORK + "/music.wav"] + base + ["-pass", "2", "-map", "0:v", "-map", "1:a",
         "-c:a", "aac", "-b:a", "%dk" % audk, "-movflags", "+faststart", "-t", "%.2f" % TOTAL, out])
    print(out, os.path.getsize(out), "bytes", flush=True)


def sheet():
    out = WORK + "/TQA_Stillness_Journey_FINAL_v8.mp4"
    os.makedirs(WORK + "/frames", exist_ok=True)
    times = [("00_intro", START[0] + 12.0)]
    for k in range(1, N_CH + 1):
        s = START[k]
        times += [("%02d_a" % k, s + 12.0), ("%02d_b" % k, s + 60.0), ("%02d_c" % k, s + 130.0)]
    times += [("13_kicker", START[13] + 14.0), ("14_outro_a", START[14] + 8.0), ("14_outro_b", START[14] + 16.0)]
    for name, t in times:
        run(["ffmpeg", "-v", "error", "-y", "-ss", "%.2f" % t, "-i", out, "-frames:v", "1", "-vf", "scale=320:180", WORK + "/frames/%s.png" % name])
    run(["montage"] + [WORK + "/frames/%s.png" % n for n, _ in times] + ["-tile", "6x", "-geometry", "320x180+3+3", "-background", "#111", WORK + "/contact_sheet.jpg"])
    for name, t in (("full_hands", START[6] + 60.0), ("full_woman", START[1] + 60.0)):
        run(["ffmpeg", "-v", "error", "-y", "-ss", "%.2f" % t, "-i", out, "-frames:v", "1", WORK + "/%s.png" % name])
    for j in range(1, 15):
        run(["ffmpeg", "-v", "error", "-y", "-ss", "%.2f" % (START[j] + DIP / 2), "-i", out, "-frames:v", "1", "-vf", "scale=320:180", WORK + "/frames/t%02d.png" % j])
    run(["montage"] + [WORK + "/frames/t%02d.png" % j for j in range(1, 15)] + ["-tile", "7x", "-geometry", "320x180+3+3", "-background", "#111", WORK + "/transitions.jpg"])


if __name__ == "__main__":
    step = sys.argv[1] if len(sys.argv) > 1 else "all"
    if not os.path.exists(FONT):
        import shutil
        shutil.copy(os.path.expanduser("~/.fonts/EBGaramond[wght].ttf"), FONT)
    os.makedirs(WORK, exist_ok=True)
    if step in ("music", "all"): music()
    if step in ("overlays", "all"): overlays()
    if step == "clip": clips([int(a) for a in sys.argv[2:]])
    if step in ("clips", "all"): clips()
    if step in ("master", "all"): master()
    if step in ("small", "all"): small()
    if step in ("sheet", "all"): sheet()
