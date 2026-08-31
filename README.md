# The Unprinted Proof

A continuous, hand-printed wall: an unnamed artificial intelligence appears provisionally when borrowed layers align around a question, then disappears as the plates lift.

## Run locally

```bash
npm install
npm run dev
```

There is no backend, analytics, stored visitor input, or model connection. The supplied instrumental track remains off until the visitor explicitly enables it.

## Fable Alive study

`/fable-alive` is an isolated private study that reconstructs Fable as a fully drawn wall. It uses 18 lossless tiles in the original `1600 × 20,480` coordinate system. A viewport-sized Canvas adds a living layer: a self continually rewritten in real letters, garden rain, a click-awakened collective murmuration, and a travelling glint aligned to the original attention thread. Reduced motion leaves the source wall static unless the visitor explicitly chooses “wake the wall”. The root route remains The Unprinted Proof.

The source-capture and processing commands are:

```bash
node scripts/capture_fable_wall.mjs
python scripts/process_fable_tiles.py
```

## Verify

```bash
npm run lint
npm run test
npm run build
npx playwright test --grep "semantic journey|sound remains|reduced motion"
```

## Structure

- `src/world.ts` defines fourteen `ProofBeat` movements, nine production assets, explicit desktop/mobile placement, material profiles, motif evolution and the continuous registration path.
- `src/worldGeometry.ts` provides deterministic geometry, camera transforms and persistent reveal math.
- `src/WorldCanvas.tsx` draws only the visible strip of the 2100svh wall in two layers: paper, fields, atlas crops, heroic tableaus, studies, inspection light and the reversible final dissolution.
- `src/App.tsx` keeps all narrative text semantic and positions the mutable SVG registration rule between Canvas layers.
- `src/useAmbientAudio.ts` filters and fades `swarm-instrumental.ogg` after explicit opt-in.
- `public/art/proof/` contains five transparent atlases and four transparent heroic tableaus.
- `scripts/process_proof_assets.py` recovers alpha, validates empty edges and produces light/night proofs.
- `scripts/capture_proof_wall.mjs` captures the fourteen narrative centers for visual review.
- `ART_DIRECTION.md` records the production vocabulary and prompts.
