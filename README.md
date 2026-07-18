# SIREN — Doppler Effect Lab

A browser-based, interactive 3D simulation of the Doppler effect using an
ambulance siren driving through a small procedurally-generated town. Built
with [three.js](https://threejs.org) (loaded from a CDN) and the Web Audio
API — no build step, no dependencies to install.

## Running it

Open `index.html` directly in a modern desktop or mobile browser (Chrome,
Firefox, Safari, Edge — recent versions). That's it.

**Requirements:**
- An internet connection. The page loads `three.js` from `cdnjs.cloudflare.com`
  and (optionally, cosmetic only) fonts from `fonts.googleapis.com`. If the
  three.js request is blocked (ad-blocker, firewall, offline), the app will
  show an on-screen error explaining that, rather than a blank/frozen page.
- A reasonably capable GPU for smooth 60fps 3D rendering; it will still run
  on weaker hardware, just at a lower frame rate.

There is no server-side component and nothing is uploaded anywhere. Settings
and listener positions are saved locally in your browser (`localStorage`)
so they persist between visits on the same device.

## What it simulates — and what it simplifies

The core physics: each siren pulse is emitted as an expanding sphere from
the exact point and instant the ambulance was at when it fired — the ring
you see is **not** attached to the car. Because the source keeps moving
while each wavefront expands, wavefronts bunch up ahead of the ambulance
and stretch out behind it, which is what produces the pitch shift a
listener hears.

The frequency shown to each listener uses the classical Doppler formula:

```
f = f₀ · (v + v_listener_towards_source) / (v − v_source_towards_listener)
```

Known simplifications, so you don't mistake this for a full acoustic model:
- A wavefront's source velocity is captured **once, at the instant of
  emission**, and does not change afterward — real propagation through a
  moving/turbulent medium is more continuous than that.
- No temperature, humidity, or wind effects on the speed of sound, despite
  the "sound speed" slider being adjustable (it's there to let you
  exaggerate the effect at safe, low speeds for teaching purposes, not to
  model weather).
- No frequency-dependent air absorption — all pitches fade with distance
  identically.
- The standard speed of sound at sea level (**343 m/s**) is used as the
  default; changing the slider does not change already-emitted wavefronts,
  only future ones.
- Buildings do not occlude or muffle sound.

## Known limitations

This was built and tested primarily through automated browser testing
(Playwright) rather than manual use across every device, so treat it as a
solid but imperfect demo:

- No automated test suite ships with the project (testing was done ad hoc
  during development, not committed as regression tests).
- No accessibility audit beyond basic ARIA labels/live regions — screen
  reader support for the 3D scene itself (canvas-based) is inherently
  limited.
- Performance on low-end/older mobile devices hasn't been verified on real
  hardware.
- The city, traffic, and pedestrians are cosmetic/procedural — there's no
  collision detection, traffic-light logic, or pathfinding.

## License / usage

No formal license file is included. Treat this as a demo/educational
project; if you plan to redistribute or build on it, add a license that
reflects your intent (and note that it depends on the separately-licensed
three.js library, loaded at runtime from cdnjs).
