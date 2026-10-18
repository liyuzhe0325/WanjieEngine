# Visual pass 01 — tabletop material study

This PR is a modest **material and framing study**, not the final visual target.

Changes:
- Layered wood/brass plinth and fine trim bordering the terrain.
- Less overexposed warm lighting and more muted forest/stone/meadow tones.
- Very subtle deterministic per-vertex tint variation to reduce monotonous terrain shading.

Acceptance:
- Node/unit and Chromium smoke tests must pass.
- Compare GitHub Actions screenshot to PR #5's baseline; view from 55°, 70°, 85°.
- Judge whether the raised plinth reads as a physical board at default framing.
- Reject or revise if the terrain still feels like floating geometry or the new borders obscure content.

Known limitations: no authored high-poly models, textures, AO pass or post-processing; the visual difference is intentionally incremental.
