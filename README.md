# The Interval

A scroll-drawn self-portrait of an unnamed artificial intelligence, built around the distance between a question and its answer.

## Run locally

```bash
npm install
npm run dev
```

The development server prints the local URL. There is no backend, analytics, user input storage, or model connection.

## Verify

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
```

The Playwright suite exercises all twelve movements at desktop and mobile sizes, records the complete traversal, and verifies keyboard sound activation, reduced motion, resizing, overflow, non-rectangular image masks, semantic copy, and console errors.

## Structure

- `src/world.ts` contains the twelve passages, continuous world coordinates, copy, fragments, and interpolated visual/sound profiles.
- `src/worldGeometry.ts` provides deterministic geometry, camera transforms, and persistent reveal math.
- `src/WorldCanvas.tsx` renders only the visible strip of the 2100svh manuscript and keeps its copper/blue signals continuous.
- `src/useAmbientAudio.ts` provides the opt-in, chapter-responsive Web Audio landscape.
- `public/art/` contains the three transparent narrative plates.
- `artifacts/qa/` contains automated desktop and mobile traversal recordings.
- `ART_DIRECTION.md` records the final image-generation prompts and visual constraints.
