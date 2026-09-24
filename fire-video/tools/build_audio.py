#!/usr/bin/env python3
"""Build the voiceover, music bed, final mix and timing data for the fire explainer.

Outputs:
  assets/audio/voice.wav   narration only
  assets/audio/music.wav   hand percussion + drone bed
  assets/audio/mix.wav     ducked final mix used by the composition
  assets/timing.js         scene (storyboard row) + caption timings for index.html

Usage: python3 tools/build_audio.py --model <kokoro.onnx> --voices <voices.bin>
"""
import argparse
import hashlib
import json
import os
import re

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 24000

# Words that get the ember-orange caption highlight; the longest match in a caption wins.
KEYWORDS = [
    "Fire.", "invented", "INVENTED", "stages", "overcoming fear", "keeping it alive", "hungry",
    "ember", "rainstorm", "evidence", "patterns", "Wonderwerk Cave", "2012", "1.1 to 1.8 million",
    "ignite", "790,000", "controlled hearths", "780,000", "newest major clue", "Barnham",
    "400,000", "iron pyrite", "Pyrite", "sparks", "2025", "deliberate fire-making",
    "50,000", "Neanderthal", "microscopic wear", "survival", "warmth", "light", "smoke",
    "predators", "Cooking", "digest", "transformed", "circle", "shared", "repaired", "Plans",
    "Knowledge", "first story", "who invented fire?", "No one person", "No single species",
    "No single day", "relationship", "spark", "the flame", "what to do with it",
    "lightning", "terrifying", "command", "sticks", "ablaze", "remains", "roasted", "burning branch",
    "smouldering", "directly", "similar", "Gesher Benot Ya’aqov", "Israel", "flint", "fish", "rare",
    "carried", "clearer", "France", "pathogens", "generation", "genius", "I’ve got it!",
    "on demand", "fire", "flame", "hearth", "chaos", "glow", "run", "sky",
]


def synth(kokoro, text, voice, speed, cache_dir):
    key = hashlib.sha1(f"{voice}|{speed}|{text}".encode()).hexdigest()[:16]
    path = os.path.join(cache_dir, key + ".wav")
    if not os.path.exists(path):
        samples, sr = kokoro.create(text, voice=voice, speed=speed, lang="en-us")
        assert sr == SR
        sf.write(path, samples, SR)
    audio, _ = sf.read(path, dtype="float32")
    return trim(audio)


def trim(a, thresh=0.012, pad=0.03):
    env = np.abs(a)
    idx = np.where(env > thresh)[0]
    if len(idx) == 0:
        return a
    s = max(0, idx[0] - int(pad * SR))
    e = min(len(a), idx[-1] + int(pad * 2 * SR))
    out = a[s:e].copy()
    f = int(0.01 * SR)
    out[:f] *= np.linspace(0, 1, f)
    out[-f:] *= np.linspace(1, 0, f)
    return out


def speech_weight(text):
    """Rough proportional-time weights for each character (letters/digits speak, punctuation pauses)."""
    w = []
    for ch in text:
        if ch.isalnum():
            w.append(1.0)
        elif ch in ",:;—":
            w.append(3.0)
        elif ch == " ":
            w.append(0.4)
        else:
            w.append(0.2)
    return np.array(w)


def char_time(sent, pos):
    w = speech_weight(sent["text"])
    frac = w[:pos].sum() / w.sum()
    return sent["start"] + frac * (sent["end"] - sent["start"])


def balanced_wrap(text, limit):
    """Word-wrap into the fewest chunks <= limit, with chunk lengths as even as possible."""
    words = text.split(" ")
    n = 1
    while True:
        target = len(text) / n
        chunks, cur = [], ""
        for w in words:
            cand = (cur + " " + w).strip()
            if cur and (len(cand) > limit or (len(cand) > target + 6 and len(chunks) < n - 1)):
                chunks.append(cur)
                cur = w
            else:
                cur = cand
        chunks.append(cur)
        if all(len(c) <= limit for c in chunks) and len(chunks) <= n:
            return chunks
        n += 1


def smart_chunks(text, limit=78):
    """Prefer splitting at clause punctuation, then fall back to balanced word wrapping."""
    if len(text) <= limit:
        return [text]
    parts = [p for p in re.split(r"(?<=[,:;])\s+|(?<=—)", text) if p]
    chunks, cur = [], ""
    for p in parts:
        joiner = "" if (not cur or cur.endswith("—")) else " "
        cand = cur + joiner + p
        if len(cand) <= limit:
            cur = cand
        else:
            if cur:
                chunks.append(cur)
            cur = p
    if cur:
        chunks.append(cur)
    final = []
    for c in chunks:
        final.extend(balanced_wrap(c, limit) if len(c) > limit else [c])
    # fold very short fragments into the previous chunk when that still fits
    merged = []
    for c in final:
        joiner = "" if merged and merged[-1].endswith("—") else " "
        if merged and len(c) < 24 and len(merged[-1]) + len(c) + 1 <= limit + 8:
            merged[-1] = merged[-1] + joiner + c
        else:
            merged.append(c)
    return merged


def pick_keyword(chunk):
    for k in sorted(KEYWORDS, key=len, reverse=True):
        i = chunk.find(k)
        if i >= 0:
            # whole-word check for short keywords
            before = chunk[i - 1] if i > 0 else " "
            after = chunk[i + len(k)] if i + len(k) < len(chunk) else " "
            if (before.isalnum() or after.isalnum()) and k[-1].isalnum():
                continue
            return k
    words = [w.strip(",.:;!?“”—") for w in chunk.split()]
    return max(words, key=len)


# ---------------------------------------------------------------- music ---

def adsr_hit(n, attack, decay):
    t = np.arange(n) / SR
    env = np.minimum(1, t / attack) * np.exp(-t / decay)
    return env


def frame_drum(rng, vel):
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    f = 58 + 38 * np.exp(-t / 0.03)
    phase = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(phase) * adsr_hit(n, 0.002, 0.28)
    noise = rng.standard_normal(n) * adsr_hit(n, 0.001, 0.012) * 0.35
    skin = np.sin(2 * np.pi * 142 * t) * adsr_hit(n, 0.002, 0.08) * 0.25
    return (body + noise + skin) * vel


def tek(rng, vel):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # crude band-pass: difference of two one-pole lowpasses
    def lp(x, a):
        y = np.zeros_like(x)
        acc = 0.0
        for i, v in enumerate(x):
            acc += a * (v - acc)
            y[i] = acc
        return y
    bp = lp(noise, 0.55) - lp(noise, 0.12)
    tone = np.sin(2 * np.pi * 420 * t) * 0.4
    return (bp + tone) * adsr_hit(n, 0.001, 0.035) * vel * 0.8


def shaker(rng, vel):
    n = int(0.12 * SR)
    noise = rng.standard_normal(n)
    hp = np.diff(noise, prepend=0)
    env = np.sin(np.linspace(0, np.pi, n)) ** 2
    return hp * env * vel * 0.12


def build_music(duration, quiet_windows):
    rng = np.random.default_rng(7)
    n = int(duration * SR)
    t = np.arange(n) / SR
    # Low drone: A1 + E2 + A2 with slow breathing and a touch of detune.
    breath = 0.65 + 0.35 * np.sin(2 * np.pi * t / 23.0 - 1.2)
    drone = (
        0.55 * np.sin(2 * np.pi * 55.0 * t)
        + 0.30 * np.sin(2 * np.pi * 55.35 * t + 0.4)
        + 0.22 * np.sin(2 * np.pi * 82.41 * t) * (0.6 + 0.4 * np.sin(2 * np.pi * t / 31.0))
        + 0.12 * np.sin(2 * np.pi * 110.0 * t + 1.1) * (0.5 + 0.5 * np.sin(2 * np.pi * t / 17.0))
    ) * breath
    # soft airy wind: smoothed noise
    wind = rng.standard_normal(n)
    k = int(0.004 * SR)
    wind = np.convolve(wind, np.ones(k) / k, mode="same")
    wind *= 0.5 + 0.5 * np.sin(2 * np.pi * t / 13.0) ** 2
    bed = drone * 0.16 + wind * 0.05

    perc = np.zeros(n)
    bpm = 84
    beat = 60 / bpm
    # sparse two-bar pattern (beats in 8-beat cycle): (beat position, kind, velocity)
    pattern = [(0, "dum", 1.0), (1.5, "tek", 0.5), (3, "dum", 0.6), (4, "dum", 0.85),
               (5.5, "tek", 0.45), (6.5, "tek", 0.3), (7, "shk", 0.6)]
    start = 3.5
    bars = int((duration - start - 6) / (8 * beat))
    for b in range(bars):
        for pos, kind, vel in pattern:
            at = start + (b * 8 + pos) * beat
            if any(a <= at <= e for a, e in quiet_windows):
                continue
            v = vel * (0.8 + 0.4 * rng.random())
            hit = {"dum": frame_drum, "tek": tek, "shk": shaker}[kind](rng, v)
            i = int(at * SR)
            m = min(len(hit), n - i)
            if m > 0:
                perc[i:i + m] += hit[:m]
    music = bed + perc * 0.22
    fade_in = np.minimum(1, t / 3.0)
    fade_out = np.clip((duration - t) / 4.0, 0, 1)
    return (music * fade_in * fade_out).astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--voices", required=True)
    args = ap.parse_args()

    from kokoro_onnx import Kokoro

    cfg = json.load(open(os.path.join(ROOT, "narration.json")))
    kokoro = Kokoro(args.model, args.voices)
    cache = os.path.join(ROOT, ".tts-cache")
    os.makedirs(cache, exist_ok=True)

    sents = cfg["sentences"]
    pieces = [np.zeros(int(cfg["leadIn"] * SR), dtype=np.float32)]
    cursor = cfg["leadIn"]
    row = 0
    rows = {}
    for i, s in enumerate(sents):
        audio = synth(kokoro, s.get("tts", s["text"]), cfg["voice"], cfg["speed"], cache)
        if "row" in s:
            row = s["row"]
        s["_row"] = row
        s["start"] = cursor
        s["end"] = cursor + len(audio) / SR
        pieces.append(audio)
        cursor = s["end"]
        nxt = sents[i + 1] if i + 1 < len(sents) else None
        pause = s.get("pause", cfg["rowPause"] if nxt and "row" in nxt else cfg["defaultPause"])
        if nxt is None:
            pause = cfg["tail"]
        pieces.append(np.zeros(int(pause * SR), dtype=np.float32))
        cursor += pause

    voice = np.concatenate(pieces)
    duration = round(len(voice) / SR, 2)
    voice = voice[: int(duration * SR)]
    voice = voice / (np.abs(voice).max() + 1e-9) * 0.89

    # Storyboard row boundaries.
    for s in sents:
        if "row" in s:
            rows.setdefault(s["row"], max(0.0, s["start"] - 0.35))
        if "splitRow" in s:
            pos = s["text"].find(s["splitRow"]["at"])
            rows[s["splitRow"]["row"]] = char_time(s, pos) - 0.15
    rows[1] = 0.0
    order = sorted(rows)
    scenes = []
    for j, r in enumerate(order):
        start = rows[r]
        end = rows[order[j + 1]] if j + 1 < len(order) else duration
        scenes.append({"row": r, "start": round(start, 3), "end": round(end, 3)})

    # Captions.
    caps = []
    for s in sents:
        chunks = smart_chunks(s["text"])
        pos = 0
        for c in chunks:
            idx = s["text"].find(c, pos)
            c_start = char_time(s, idx)
            c_end = char_time(s, idx + len(c))
            pos = idx + len(c)
            caps.append({"start": round(c_start, 3), "end": round(c_end, 3), "text": c,
                         "key": pick_keyword(c)})
    # Hold each caption until the next begins (or 0.5s after it ends), never overlapping.
    for i, c in enumerate(caps):
        nxt = caps[i + 1]["start"] if i + 1 < len(caps) else duration
        c["end"] = round(min(nxt - 0.02, max(c["end"] + 0.5, c["start"] + 1.2)), 3)

    # Keep the drums out of the dramatic beats (the "Fire." reveal and the closing).
    fire_word = next(s for s in sents if s["text"] == "Fire.")
    closing = scenes[-1]["start"]
    quiet = [(fire_word["start"] - 1.2, fire_word["end"] + 1.6), (closing, duration)]
    music = build_music(duration, quiet)
    music = np.pad(music, (0, max(0, len(voice) - len(music))))[: len(voice)]

    # Duck the music under speech.
    env = np.abs(voice)
    win = int(0.25 * SR)
    env = np.convolve(env, np.ones(win) / win, mode="same")
    active = np.clip(env / 0.03, 0, 1)
    k = int(0.4 * SR)
    active = np.convolve(active, np.ones(k) / k, mode="same")
    gain = 1.0 - 0.45 * active
    mix = voice + music * gain * 0.9
    peak = np.abs(mix).max()
    if peak > 0.97:
        mix *= 0.97 / peak

    out = os.path.join(ROOT, "assets", "audio")
    os.makedirs(out, exist_ok=True)
    sf.write(os.path.join(out, "voice.wav"), voice, SR)
    sf.write(os.path.join(out, "music.wav"), music, SR)
    sf.write(os.path.join(out, "mix.wav"), mix.astype(np.float32), SR)

    timing = {"duration": duration, "scenes": scenes, "captions": caps,
              "sentences": [{"start": round(s["start"], 3), "end": round(s["end"], 3),
                             "text": s["text"]} for s in sents]}
    with open(os.path.join(ROOT, "assets", "timing.js"), "w") as f:
        f.write("// Generated by tools/build_audio.py — do not edit by hand.\n")
        f.write("window.FIRE_TIMING = " + json.dumps(timing, ensure_ascii=False, indent=1) + ";\n")
    print(f"duration {duration:.2f}s ({int(duration // 60)}:{duration % 60:05.2f})")
    for sc in scenes:
        print(f"  row {sc['row']:2d}: {sc['start']:7.2f} → {sc['end']:7.2f}  ({sc['end'] - sc['start']:.1f}s)")
    print(f"{len(caps)} captions; longest {max(len(c['text']) for c in caps)} chars")


if __name__ == "__main__":
    main()
