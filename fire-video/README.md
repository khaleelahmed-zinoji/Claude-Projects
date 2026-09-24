# How Humans “Invented” Fire: doodle explainer

A 4:38 YouTube voiceover explainer rendered with [HyperFrames](https://github.com/heygen-com/hyperframes). It uses hand-drawn charcoal-and-ochre doodles on warm parchment, burned-in two-line captions with one ember-orange keyword each, and a sparse hand-percussion and drone bed.

Output: `renders/how-humans-invented-fire.mp4` (1920×1080, 30 fps, H.264 + AAC).

## How it's built

| Piece | File |
|---|---|
| Narration script, with a TTS pronunciation where it differs from the caption text, the storyboard row for each sentence, and pauses | `narration.json` |
| Voiceover (Kokoro TTS, voice `af_heart`), procedural music bed, ducked mix, and scene and caption timings | `tools/build_audio.py` → `assets/audio/*.wav`, `assets/timing.js` |
| Parchment texture | `tools/make_paper.py` → `assets/img/paper.jpg` |
| Scene `<section>` clips and the total duration, written into `index.html` | `tools/inject_clips.py` |
| Doodle engine: Rough.js shapes with fixed seeds, draw-on strokes, flame flicker, figures, maps | `assets/js/doodles.js` |
| The 19 storyboard rows, the evidence timeline, and the captions | `assets/js/scenes.js` |

Each storyboard row is one scene clip. Within a scene, every visual state is keyed with `cue("phrase")` to the moment the narrator says that phrase, so the drawings follow the voice rather than a fixed 3-second grid. Scenes cross-fade over 0.6 s, and every scene has a slow 3.5% camera push.

The date claims are kept separate, as the brief asks. A single evidence timeline runs across the top from Wonderwerk to the Neanderthal evidence. It marks **1.8–1.1 MYA** as *fire use*, **790K** as *controlled hearths*, **400K** as *deliberate fire-making?*, and **50K**.

## Rebuild

```bash
npm install
pip install kokoro-onnx soundfile numpy pillow
# Kokoro model files: https://github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0)
python3 tools/build_audio.py --model kokoro-v1.0.onnx --voices voices-v1.0.bin
python3 tools/make_paper.py
python3 tools/inject_clips.py
npx hyperframes lint .
npx hyperframes render . -o renders/how-humans-invented-fire.mp4 -f 30 -q standard
```

To change a line, edit `narration.json` and re-run the three `tools/` scripts. The scene timings, captions and clip lengths all follow automatically.
