# EarthVision

Interactive 3D Earth (Three.js): slow continuous rotation, calculated day/night, city lights, clouds, deep-space sky, worldwide search, and progressive map-tile / settlement loading. Static files only – no backend, no build step.

## Files
- `index.html` – markup + styles
- `main.js` – all logic (ES module). Settings at the top (`CFG`) can be overridden with `window.EARTHVISION_CONFIG = {...}` in a `<script>` before `main.js`.

## Deploy (GitHub Pages)
1. Put `index.html`, `main.js`, `README.md` in the repo root (or `/docs`).
2. Settings → Pages → deploy from that branch/folder. Paths are relative; there is nothing localhost-specific.
3. Locally: `python3 -m http.server` and open `http://localhost:8000` (ES modules do not work from `file://`).

## Controls
Drag = rotate (≈55 % of 1:1 finger tracking, 4 px tap slop, no inertia). Wheel / pinch / ＋ － = zoom. **Any touch, drag, pinch, wheel, zoom-button, search selection or reset pauses rotation, and it stays paused until you press ▶ Resume.** Rotation default is 0.4°/s (slider 0–3°/s, eased start, frame-rate independent).

## What changed in this version
- **Rotation:** 4°/s → 0.4°/s; delta-time based; auto-resume removed.
- **Input:** pointer-event handling rewritten (per-pointer tracking, no jump when a finger is added/removed, drag only with one pointer, pinch damped, wheel/pinch sensitivity reduced on touch).
- **Camera:** flights are time-based (ease in/out with a slight rise on long trips) and cancelled by any user input; the camera can never go below ~2 km altitude.
- **Map tiles:** Web Mercator maths checked; each tile's radius is computed from its facet sag so it always sits above the faceted Earth sphere (no z-fighting) and below borders/clouds; tiles don't write depth and are ordered by zoom level; zoom level has hysteresis so it doesn't thrash; coarse imagery stays visible until replacements load (then they fade in); loading queue limited to 4 concurrent requests, nearest-first; LRU cache (260 tiles) with GPU disposal; failed tiles are skipped; a "Loading map…" pill shows progress.
- **Sky:** deterministic (seeded) star field – thousands of stars with varied size, brightness and colour temperature, denser along a galactic band, plus a procedural nebula/dust shader. Sky follows the camera (stars at infinity) and is hidden by the Earth through the depth test.
- **Places:** base list = Natural Earth populated places (~7,300). Below ~950 km altitude, towns/cities (3° cells) and below ~130 km villages/hamlets/suburbs (0.5° cells) stream in from OpenStreetMap via the Overpass API for the 3×3 cells around the view, cached and rate-limited to 1 request/second. Labels are collision-culled and prioritised by population/importance.
- **Search:** Nominatim with `dedupe`, type + parent region on every result, results biased (not restricted) toward the region you're viewing, "Back to global view" button in the info panel.
- **Robustness:** WebGL context loss handled (reload on restore), rendering paused while the tab is hidden, pixel ratio capped (1.5, or 2 with High quality).

## Honest data notes
- **Calculated live:** clock, sun, terminator, sunrise/sunset.
- **Static (not live):** surface and night-light textures (satellite-derived, not current electricity use), clouds.
- **Live/external:** earthquakes (USGS, timestamped); OSM tiles; Nominatim; Overpass; Natural Earth (static, versioned).
- **Coverage claim:** village-level labels appear only where OpenStreetMap has `place=village/hamlet/suburb` nodes with names. Coverage is good in much of India but uneven; it is not guaranteed for every village. Districts are found by search (not drawn as polygons – Natural Earth has states, not districts). Streets and neighbourhood names come from the OSM tile imagery up to zoom 17.
- Weather: not included (needs a provider/API key – put it behind your own proxy, never in frontend code).

## Provider policies / making it production-ready
- **OSM tiles:** fine for light use with the attribution shown. For a busy public site switch to a commercial or self-hosted tile source: set `tileUrl`, `tileAttr` and `tileMaxZoom` in `EARTHVISION_CONFIG` (use a provider that allows browser use; keys on static sites are visible, so use a domain-restricted key). https://operations.osmfoundation.org/policies/tiles/
- **Nominatim:** ≤1 req/s; the app debounces (700 ms), needs 3+ characters, caches and aborts stale requests. https://operations.osmfoundation.org/policies/nominatim/
- **Overpass:** public instance is shared; the app requests small cells, one at a time, and backs off after errors. For heavy traffic run your own instance or pre-generate per-country place files (e.g. from Geofabrik extracts) and set `overpass`/load them from your own hosting.
- Map data © OpenStreetMap contributors (ODbL). Natural Earth is public domain.

## Quality & search update
- **Rendering:** High quality is now ON by default (pixel ratio up to 2.5 desktop / 2 phones, antialiasing, 16× anisotropy). Untick it in ☰ if a phone gets warm.
- **Sharper imagery:** the detailed layer now starts much earlier (below ~3.3 Earth-radii) and uses one extra detail level. Zoom ≤ 8 uses NASA GIBS Blue Marble (public-domain satellite imagery, `CFG.satUrl`); above that OpenStreetMap. If a satellite tile is missing, that tile falls back to OSM. Tiles use the same day/night shading as the Earth; city lights are drawn as an overlay so they stay visible over the imagery.
- **Draw order fixed:** clouds, borders, city lights and earthquake points were being hidden under the map tiles; they now draw on top.
- **Portrait phones:** the default view distance is computed from the screen shape so the whole globe fits.
- **Search:** suggestions appear instantly while typing (countries, states/regions, ~7,300 cities/capitals, plus any towns/villages already loaded). ↑/↓/Enter work, recent searches show when the box is empty. Online (Nominatim) results for villages, streets and other places load when you tap "Search worldwide…" or press Enter with no local match (and automatically only when local suggestions are thin) – this keeps within Nominatim's usage policy.
- The base 2048 px Earth texture (shown only when fully zoomed out) is unchanged; replace the files in `CFG.texBase` with higher-resolution NASA Blue Marble/Black Marble images if you host them yourself.

## v6: map types and true colours
- **Map type button (◧):** Default (OpenStreetMap), Satellite (Esri World Imagery) and Terrain (Esri World Topographic), chosen like Google Maps and remembered on the device. Providers are set in `CFG.layers`.
- **The "white wash" had two causes, both fixed:** the map shader could over-expose (brightness up to 126 %), and the static cloud layer sat on top of the map. Clouds and city lights now appear only when zoomed out; when you zoom in the map shows its own colours (day/night shading fades out below ~1 Earth-radius altitude).
- **Esri tiles:** free for light use with attribution (shown in the app). For a busy/commercial site use an Esri API key or another provider. Satellite detail depends on Esri's coverage; some rural areas stop at lower zoom. Google Maps imagery cannot be used directly (licence), so it isn't included.
- Mobile layout: controls no longer overlap the search bar on narrow screens.
