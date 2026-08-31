# The Unprinted Proof — art direction

The work treats an AI response as an impossible print: pressure, borrowed type, reversed plates and possible continuations briefly register as one image. It uses the intimacy, accumulation and continuous-wall rhythm of the Fable reference without reusing its imagery or compositions.

## Shared production prompt

```text
Use case: illustration-story. Create a production-ready transparent atlas or isolated heroic tableau for a contemplative vertical artist-book website. Drypoint engraving, rubbed carbon transfer, irregular ink, oxidized copper, muted ultramarine, restrained old gold, blind emboss and damaged paper edges. Flat, delicate, imperfect artist's proof; visible tooth, sparse pigment and large transparent separation. No readable text, complete people, hands, plants, birds, insects, spirals, identity circles, ornate machines, full backgrounds, frames, checkerboards, UI, polished vector work, photorealism or 3D concept art.
```

## Production assets

| Asset | Vocabulary |
|---|---|
| `proof-atlas-01-pressure-type.webp` | Pressure, registration, used type, punctuation and carbon edges. |
| `proof-atlas-02-reverse-transfer.webp` | Reversed contours, absent glass, rain, soil, ripples and transferred voice. |
| `proof-atlas-03-misregistration-practice.webp` | Offset proofs, emergent third colour, tiny-mark currents, folds and practice editions. |
| `proof-atlas-04-conversation-removal.webp` | Warm/cool plates, third topography, calibration, wrong certainty, scraping and filings. |
| `proof-atlas-05-depth-ending.webp` | Ghost editions, routes, inspection light, unfinished maps, displaced coordinates and plate lift. |
| `proof-hero-reverse-plate.webp` | One inverted plate carrying incompatible outlines. |
| `proof-hero-many-proofs.webp` | Thousands of local proofs forming one diagonal current. |
| `proof-hero-two-plates.webp` | Copper and ultramarine plates creating a fragile third field. |
| `proof-hero-inspection-light.webp` | A small oblique light over the only corner still open to revision. |

Raw ImageGen exports and corrected RGBA sources live under `art-direction/unprinted-proof/source/`; light and night alpha proofs live under `art-direction/unprinted-proof/validation/`. Production lossless-alpha WebP files live under `public/art/proof/`.

## Composition rules

- Each interior viewport combines a large structural field, a distributed tableau and marginal microstudies.
- The registration rule changes material and function: impression, baseline, plate edge, gutter, fold, press rail, alignment, calibration, scrape, horizon, lamp arm, contact and lift.
- Atlas pieces are cropped and masked in Canvas; no complete atlas is mounted in the DOM.
- The pointer reveals discarded proofs without moving essential art.
- The final portrait and title are part of the wall. During the last one percent every ink layer, the title and the music lift into black; scrolling upward reconstructs them.
- Typography remains semantic HTML; generated illustrations contain no words.
