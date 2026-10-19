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

## v7: tap a country, weather & air quality, Live satellite, smoother globe
- **Tap a country** (zoomed out) → the globe flies to it. **Tap the ground when zoomed in** → the exact place is named (Nominatim reverse lookup, ≤1 request/second) and its info opens. Tapping a label selects that place; state/region names appear at country zoom (after the state boundaries load).
- **Info panel (any selected place):** local time (real IANA timezone from Open-Meteo), day length, sunrise/sunset, live weather, air quality (US AQI, PM2.5), UV index, time difference vs you, distance from you (after ◎ My Location), and a **Share** button (link opens straight on that place).
- **Live map type:** yesterday's NASA GIBS MODIS Terra true-colour mosaic (real clouds/weather as seen from space), date shown in the credits. Native detail stops at zoom 9 – switch to Satellite for buildings. The static cloud overlay is hidden in this mode.
- **Smoother:** dragging now glides to the finger position (no inertia), pinch/zoom smoothed, taps never nudge the globe.
- **Privacy/data:** selecting a place sends its coordinates rounded to ~1 km to Open-Meteo (weather/air quality); tapping near the ground sends that point to Nominatim. Nothing is sent until you select/tap. Open-Meteo is free for non-commercial use (a licence is needed for commercial traffic).
- **Honest limits:** places come from Natural Earth + OpenStreetMap, so small-village coverage varies by area; districts are searchable but not drawn; weather/AQI are model data for a ~1 km point, not a station reading.

## v8: fixes after real-device feedback
- **Weather / air quality were blank:** the forecast request asked Open-Meteo for a variable it does not offer as "current" (UV), so the whole request failed. Now only valid variables are used; weather, air quality and UV load independently, show the real error if one fails, and time out after 10 s.
- **Taps stopped working after the first selection:** the info card covered half the screen. It is now a compact bottom sheet (name + weather + AQI; "Details" expands it) and the globe is shifted up so the selected place stays visible.
- **Place names vanished when zoomed in:** the horizon test rejected every label closer than ~76 km altitude. Fixed, so town / village / colony / neighbourhood names appear while zooming in (OpenStreetMap, loaded around your view). Satellite mode now also gets place-name label tiles (CARTO, from OpenStreetMap) near the ground, since satellite photos have no names.
- **Zoom buttons now accumulate** when tapped repeatedly (each tap used to cancel the previous one).
- **Blue dot:** ◎ My Location starts live tracking (accuracy circle, pulsing dot like Google Maps). Untick "My location" in ☰ to stop. The position stays on the device; it is only sent (rounded to ~1 km) to Open-Meteo if you select "My location" to see weather.
- **Two-finger twist** rotates the whole globe (heading); pinch still zooms; a compass ▲ appears and resets north. Desktop: Shift + drag rotates.
- **Tested in headless Chromium** with mocked network (Three.js replaced by a small maths-accurate stand-in, so layout/logic is tested, not GPU rendering): tap country, tap city label, tap ground (reverse name), weather/AQI/UV panel, blue dot, twist gesture, compass, satellite label requests, colony labels while zooming, search suggestions – all passing, no console errors.

## v0.5 (clean baseline – version numbers restart here)
- **Popup shows everything by default** (lat/lon, local time, sun, sunrise/sunset, day length, weather, air quality, UV, time difference, distance); "Hide details" collapses it. It is limited to 46 % of the screen and scrolls.
- **Place names that never loaded:** the town/village loader stopped for good after 3 failures. It now retries forever with back-off, falls back through backup Overpass servers, and keeps fetched areas on the device for 30 days (instant next time). Village cells are smaller (0.25°), nearest first. A small "Place names: server busy, retrying…" pill shows when the server is slow.
- **Area chip** (📍 under the search bar): the neighbourhood / city / state under the centre of the screen while you pan (Nominatim, ≤1 request per 2.5 s, cached) – works even when the name server above is busy.
- **Rotate view slider** in ☰ (plus compass ▲), so rotation works even if the two-finger twist feels awkward; lost "finger up" events can no longer jam the gestures.
- **Connection check** in ☰: tests tiles, satellite, labels, NASA photo, Overpass, weather, air quality, search, earthquakes and borders on the device and shows ✓/✗ with the reason – send a screenshot of this if anything is blank.
- Tested in headless Chromium with mocked network (including a failing primary Overpass server). Real-network behaviour on your phone still needs your confirmation.

## v0.6
- **CARTO API key:** the only CARTO service used is the raster PNG place-name label tiles drawn over Satellite imagery (`dark_only_labels`). The key is now sent as `?key=` on every such tile (set in `CFG.cartoKey`; empty = no key parameter). No other provider or URL was changed (Voyager/vector styles are not used). The key is a public browser key, so it is visible in the page source – restrict it to your domain in the CARTO dashboard. ☰ → Connection check now tests the CARTO tile with the key and reports "key rejected / domain not allowed" if CARTO refuses it.
- **Blue dot / pin drifting:** markers were placed 2.5–13 km above the ground, so they slid away from the real spot when you zoomed in. They are now placed exactly on the map surface; GPS fixes are smoothed, and a much worse fix (cell/IP guess) is ignored for 3 minutes so the dot does not jump.
- **Zoom:** closest altitude ≈ 190 m (was ≈ 1 km); Default and Terrain tiles go to level 19 (Satellite level 18, then smoothly over-zooms).
- **Sea / ocean names** (Natural Earth marine areas) appear on the globe at continent zoom, are searchable and tappable.
- **Smoothness:** state boundaries are parsed in a Web Worker (no freeze), DOM lookups are cached, resolution adapts automatically on slower phones, and the time slider / LIVE glides instead of jumping. Sun position and day/night shading are unchanged.
- **Bug fixed during testing:** a trailing comment had swallowed the camera declarations (page would not start) – caught by the browser test, not by a syntax check.
- Browser test (headless Chromium, mocked network): 38 checks pass, including API key on all 37 CARTO requests, sea names, worker-loaded states, dot-to-ground offset, GPS filter and smooth time.
