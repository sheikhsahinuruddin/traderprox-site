# EarthVision

A continuously rotating, interactive 3D Earth (Three.js) with calculated day/night, city lights, search anywhere, and progressive map-tile zoom. Pure static files: no backend, no build step.

## Run / deploy
- **Local:** serve the folder (ES modules need http): `python3 -m pip` not needed – just `python3 -m http.server` and open `http://localhost:8000`.
- **GitHub Pages:** push `index.html` (and this README) to a repo, enable Pages. All paths are relative/CDN; nothing is localhost-specific.
- **Self-host assets (optional):** download the four textures from `three.js/examples/textures/planets/` (`earth_atmos_2048.jpg`, `earth_lights_2048.png`, `earth_specular_2048.jpg`, `earth_clouds_1024.png`) into `assets/` and change the `TEX` constant in `index.html` to `'./assets/'`.

## How coverage works
| Zoom level | Source | Notes |
|---|---|---|
| Global / continent | Natural Earth 110m borders, ~7,300 populated places | Labels appear by population/capital rank and are collision-culled |
| Country | Natural Earth 50m state/province boundaries (lazy, large file, loaded only when you zoom in) | Includes Indian states and union territories |
| City → street | OpenStreetMap raster tiles draped on the globe, only the ~9–25 tiles in view, up to z17 | Roads, rivers, towns, villages, neighbourhoods as rendered by OSM |
| Search | Nominatim (OSM) | Countries, states, districts, cities, towns, villages, local places; shows type and parent region to tell duplicates apart |

Complete coverage depends on the availability and accuracy of OpenStreetMap and Natural Earth data. Labels on the globe come from Natural Earth's populated-places list; smaller settlements (including most Indian villages and districts) are reached through search and the OSM tiles rather than as 3D labels, so nothing is downloaded wholesale.

## Honest data handling
- **Calculated live:** UTC clock, sun position, terminator, sunrise/sunset (low-precision astronomical formulas, ~1 min accuracy).
- **Static imagery (not live):** surface texture, night lights (satellite-derived, **not** current electricity use), clouds (visual simulation).
- **Live external:** USGS earthquakes (optional layer, shows feed timestamp); Nominatim search.
- **Local time:** uses `tz-lookup` (IANA timezone from coordinates) when it loads; otherwise shows approximate mean solar time and says so.
- **Weather / live cloud imagery:** not enabled. Both need a provider and usually an API key – add one through a small proxy (e.g. a Cloudflare Worker) that holds the key, never in frontend code.

## Usage policies
- OSM tile servers: fine for light personal use with the attribution shown in the app. For a busy public site use a commercial tile provider (MapTiler, Stadia, etc.) or your own tiles: https://operations.osmfoundation.org/policies/tiles/
- Nominatim: max 1 request/second, no autocomplete-spam; the app debounces (700 ms), requires 3+ characters, caches and cancels stale requests: https://operations.osmfoundation.org/policies/nominatim/
- Map data © OpenStreetMap contributors (ODbL). Natural Earth is public domain. Textures are NASA-derived, from the three.js examples repository.
- Geolocation runs only when you press **My Location**; coordinates never leave your device.

## Controls
Drag to rotate, wheel/pinch to zoom, ＋/－ buttons, ⌂ reset, ⏸/▶ pause rotation, ⛶ fullscreen, ☰ layers and settings (rotation speed, quality). Time slider ±24 h; LIVE returns to now. Rotation slows as you zoom in so a selected place stays in view.
