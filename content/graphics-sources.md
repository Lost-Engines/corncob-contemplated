# Evidence for the graphics article

The article at `graphics/` describes the ordinary retail 3.42 flight renderer.
It separates the original algorithms from our explanatory diagrams, the site's
modern inspection viewers and deliberate changes in Corncob Redux. This is an
account of our investigation, not a claim that these techniques were unique to
Corncob or first discovered by us.

## Reference material

- Preserved original source: [foone/Corncob3D, Initial Import,
  2759414da1e6e645c3640288577d1e0cc8c32be4](https://github.com/foone/Corncob3D/tree/2759414da1e6e645c3640288577d1e0cc8c32be4).
  The analysis checkout keeps the content in `analysis/original_source/` and its
  per-file provenance in `analysis/original_source.provenance.json`.
  This source contains build switches and experiments; its presence alone does
  not establish that a feature shipped.
- Retail executable: `installs/deluxe_dnk/3.EXE` in the analysis archive,
  SHA-256 `c411dde7d18e1dc19d718327b70d1e69321448520344d3baa4a0c8e68a71e81e`.
- Readable reconstruction: [corncob-cpp at
  11cd25359cf470d0a87e2409d0ab39c6874a3f54](https://github.com/Lost-Engines/corncob-cpp/tree/11cd25359cf470d0a87e2409d0ab39c6874a3f54).
  Its `src/graphics/scene.cpp`, `raster.cpp`, `ground_detail.cpp`,
  `instruments.cpp`, `disc_tables.h` and `src/maths/fixed.cpp` are useful companions
  to the assembly. They are our translations, not original C++ source.
- The published [resource-format notes](https://lostengines.com/corncob/analysis/resource-formats.md)
  and [resource browser](https://lostengines.com/corncob/analysis/resources/index.html)
  record the extraction and native routine comparisons.

Assembly line numbers below refer to that pinned Initial Import, not later
assembler-compatibility revisions. Procedure names are the more durable locators.

## Claims and procedures

| Article subject | Evidence and scope |
| --- | --- |
| Overall drawing loop | `3.ASM`, ordinary main-loop drawing around lines 7320–7976: `EPAGE`, `MODHR`, ground points, `DRAWMEMSEG`, `DRAWNEAR`, instruments and `FLIPAGE`. `DRAWNEAR` also performs simulation work. The six-step overview is a conceptual grouping, not a claim to six independent modules. |
| Model records and five opcodes | `F3DVEC.ASM`, `DRROBJ` around line 2711 and its `cmpjtbl` dispatch; `analysis/resource-formats.md`, embedded model section; `tools/corncob_models.py`. Code 0 is empty; 2/4/6/8 are lines/points/discs/polygons. Retail model-bank extraction identifies 61 object templates. |
| World grid and units | `analysis/resource-formats.md`, CCT/DEF layout and placement expansion. Tile width is 32 × 65536 cm; eight tiles span each axis. The object/model translation divides world centimetres by two before adding ordinary model coordinates. |
| Relative coordinates and distance bands | `F3DVEC.ASM`, `REL3D` line 4935, `DISTEVAL` line 5155, `D3DOBJ` line 5248. Range classification uses the OR of the absolute coordinate high bits, hence the largest-coordinate interpretation. The three ordinary squared-distance scales shift coordinates by 0, 4 or 8; object-specific breakpoints then select detail. |
| Fixed-point rotations | `F3DVEC.ASM`, `CALCMAT` line 2877, `NCALCMAT` line 2926, `RELROT` line 5006 and `PRIMDOT` line 1700, together with the sine-table/multiply helpers. `src/maths/fixed.cpp` keeps the separate rounding paths, including the high-word/rotate-left fast vertex operation. |
| Camera axes and perspective | `VIEWPOLY`, `VIEWPT`, `VIEWDSC` around lines 2168–2238 and the front/rear window definitions. Camera-vector component 0 is depth despite occasional assembly comments calling it z. Normal front projection uses centre (319,101), focal lengths (300,200); the rear uses (320,299), (150,100). |
| Near and window clipping | `F3DVEC.ASM`, `POLYHELL` line 755, `F3DPOLY` line 872, `CHOPLIN` line 1015, and the line/window clipping helpers. The near test uses the current window's focal depth in the reduced coordinate system. `CHOPLIN` interpolates to the plane, then increments depth. |
| Object order and runway exception | `TBSORT` line 5505, `CHECKFORRUNWAY` line 6429, `DRAWNEAR` line 6450. Sorting uses repeated adjacent swaps of maintained object entries. The special early runway pass requires ground height; floating runways remain in the ordinary ordering. |
| Eight per-model lists | `DRROBJ` transforms displacement into model axes and accumulates three sign bits. Each octant has a fixed-length list of commands, including empty slots and intentional repeated primitive references. The diagrams preserve those lists. |
| Polygon scan conversion | `DRAWPOLY` line 4004: two descending edge chains, fixed-point X accumulation, viewport bounds, horizontal spans and a twenty-vertex limit. The interactive diagram demonstrates the principle with different, explicitly documented sampling rules. |
| Line optimisation | `KLINE.ASM`; ordinary line and span helpers in `F3DVEC.ASM`. Long shallow wirework uses horizontal runs, while short/steep cases take the ordinary error-stepping path. |
| Discs | `F3DDSC`, `VIEWDSC` and `DRAWDISC` line 4309. The record supplies diameter, not radius. Small projected sizes use masks; larger sizes use the `CSQRT` table and spans. `src/graphics/disc_tables.h` records byte-verified retail masks and lookup values. |
| Planar memory and VGA requirement | `3.ASM` graphics/startup checks; `F3DVEC.ASM` raster routines set graphics-controller write mode 3 (`0305h` register/value pair). The article's storage totals are arithmetic: 80 bytes × 350 rows × four planes. EGA-style resolution is distinguished from the VGA operations used by the colour raster paths. |
| Mutable model colours | Primitive dispatch colour resolution and original runtime assignments; extracted retail colour profile in `models-deluxe_dnk.json`, with `tools/corncob_colours.py` and the site's `src/model-engine.js` supplying the traced preview behaviour. |
| World sky/ground palette | `F3DVEC.ASM`, `SETSKYGND` line 3074 and `READCOLORS` line 3093; packed five-byte CCT/DEF tile field. The site's `src/world-colours.js` decodes it and applies entries 2 and 11. |
| Stippled fills | `DRAWPOLY`, especially the colour-above-15 branch and scanline mask update around line 4154. Random masks are ANDed with `55h`; retained pixels come from the previous contents, not RGB alpha blending. The article avoids substituting a generic checkerboard for this code. |
| Horizon, ground dots, stars and sun | `3.ASM` main-loop background code and original point-bank helpers; `F3DVEC.ASM` `MODHR` line 5372 and horizon-specific fill branches. Eighty ground points, offscreen/random replacement and width 64 × observer height are retained in `src/graphics/ground_detail.cpp`. Early sun-face evidence is in `analysis/remaining-assets.md`, not inferred from the 3.42 screenshot. |
| Cockpit and font paths | `RIMG.EXE` decompression, `analysis/resource-formats.md`, `analysis/help-screens.md`; `INST.ASM` gauge drawing and update schedule; `3.ASM` `GRMODE` line 2333 explicitly selects the BIOS 8×14 font (`AX=1122h`). Custom medal glyphs and bitmap labels are separate resources. |
| Rear camera | `XVECT` line 2018 negates forward and lateral coordinates for ordinary rear-view geometry. Horizon handling has additional special cases. Redux's later horizontal reflection is a deliberate divergence. |
| Page flipping and shake | `FLIPAGE` line 3245, `STRTADR` line 3194, `RFWAIT` line 2979. Ordinary colour pages alternate draw offsets 0 and `7e00h`; the display start address can include a shake offset. The adjacent refresh-wait call is commented out in this source. |

The tower-door, disc-diameter, projection-proportion and ground-dot stories refer
to comparisons made during our reconstruction work. They are not arguments that
a modern viewer screenshot proves every pixel of the original algorithm.

## Interactive examples and static figures

`src/graphics-diagrams.mjs` is shared by browser controls and
`scripts/make-graphics-diagrams.mjs`. All seven illustrations have committed
820-pixel and compact 360-pixel SVG layouts. The four interactive examples are:

- **Near clipping:** endpoint A = (variable depth, −180), B = (1600, 220),
  near plane = 300. The example truncates the edge interpolation toward zero and
  places the accepted endpoint at depth 301. It is a side-on diagram, not a native
  scene. It omits overflow and all the other native clipping branches.
- **Drawing lists:** actual retail near models for type 7 (crew, `6ea9`),
  type 2 (aircraft, `4aa9`) and type 6 (tower, `4256`), with all eight original
  command lists and referenced primitives. Colour variables are resolved at
  preview time zero, quality row zero. A modern orthographic projection and solid
  SVG drawing expose command order without claiming native scan conversion,
  native pixel aspect, perspective or frame timing. A command can draw a group
  of several marks; the counter counts commands, not polygons.
- **Scan conversion:** illustrative ring (3,4), (23,2), (29,14), (8,18).
  Row intersections are evaluated at y + 0.5 and pixels selected by their centres.
  This explains the two-edge fill, rather than reproducing the original's exact
  rounding and span-end rules.
- **Bit planes:** eight selected colour indices split into four bit rows and
  recombined. The colours use the site's default sixteen-entry palette. This
  illustrates storage, not the full VGA latch/write-mode state machine.

The three other illustrations show the primitive vocabulary, coordinate journey
and actual small-disc masks. `content/graphics-disc-masks.json` contains the
17 patterns / 103 row records transcribed from the byte-verified reconstruction
header. The illustration enlarges selected masks without smoothing; it does not
replace them with resampled mathematical circles. The diagrams include no
photographs, generated artwork or third-party web screenshots.

Model snapshot SHA-256:

- Full site bank `public/data/models-deluxe_dnk.json`:
  `abca47277dde0f3c8bffc5f5358e8a24bfb5ae2d36fb6e1b88ec8063f8d5f907`.
- Generated subset `public/data/graphics-models.json`:
  `e86ce2ca5d77c1e33b4c45bae57b5472923999144d95177822c3d647911ea849`.
- Disc masks `content/graphics-disc-masks.json`:
  `92a9f015654ea91fbf23ed2ef66a197736a56fdb65b8bef0c21b25e6af8a3a02`.

## Screenshot provenance

All four PNGs are under `public/images/graphics/`.

| File | Origin and treatment |
| --- | --- |
| `native-cockpit.png` | Unmodified copy of `corncob-reverse/analysis/direct-launch-tests-fresh/engine-standalone-k.png`, 640×350. Original retail 3.42 in DOSBox 0.74-3, launched as `3 -s -k` in an isolated fresh-state copy; the original test record is beside the capture in `results.json`. It is not Redux output. |
| `cockpit-mask.png` | Unmodified copy of `corncob-reverse/analysis/resources/cockpits/3d-f49deb0e.png`, 640×350, decoded one-bit original cockpit artwork. The diagonal is present in the source data. The corresponding compressed asset SHA-256 is `f49deb0ee9e2278a545f7e22b961819cb7f9fc47d6d7cebee8b190069adace94`. |
| `world-white-sands.png` | Atlas `?world=whtsands`, default 3D airfield framing, recovered world palette and models, colour cycling paused. A modern Three.js inspection rendering, not a DOS screenshot. |
| `world-quari.png` | Atlas `?world=other-quari`, with the same capture method. Quari is Other Worlds expansion content. |

The atlas captures use a 1440×1200 Chromium viewport at device scale 1. Only the
map region is captured (1039×741); its zoom controls are hidden. Reproduce with
`scripts/capture-graphics.py` against a served build. Browser/GPU versions can
alter edge pixels; the claim is about the world colours and models, not an exact
native framebuffer match.

PNG SHA-256 values for this edition:

- `native-cockpit.png`: `6869bca37e5030ecfa221fe3449c7de52538541e20e097d302fc64fe2b5c3793`
- `cockpit-mask.png`: `c5c01a1e11d758ccd213a44a301658f92b8eff749cc305cec1ee3d1bbe781a04`
- `world-white-sands.png`: `fd052a89d23282ef378e56605588ec6b4601a7f3b87da9222af2e509468fa8dc`
- `world-quari.png`: `454afc5797d8155e62b9bc133385288a622ef44134de67d93286f39f70a6749f`

Original assets remain the work of their creators; see [RIGHTS.md](../RIGHTS.md).
