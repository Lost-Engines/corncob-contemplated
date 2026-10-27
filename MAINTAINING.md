# Maintaining Corncob Contemplated

Requires Node.js 22 or newer. CI uses Node 24.

```sh
npm ci
npm run build
npm run check
npm run preview
```

The complete static site is in `dist/`. Serve it over HTTP: the viewers fetch
small JSON collections as needed. `npm run dev` rebuilds source/content changes;
refresh the browser to see them. `SITE_PREFIX=/corncob-contemplated PORT=4176 npm run preview`
checks the same subpath arrangement used by GitHub Pages.

Normal builds require only this repository. `public/data/` is a committed display
snapshot; it does not fetch a sibling checkout or download game files. The optional
refresh command is:

```sh
python3 scripts/import-analysis.py /path/to/corncob-reverse
```

The importer keeps selected pristine worlds and source experiments, not historical
saved pilots. `content/data-provenance.json` records the originating index hash
and scope. The adapted renderer in `src/model-engine.js` comes from our research
viewer in `corncob-reverse/tools/model_viewer.js`; refresh it deliberately when
fixing model interpretation. Models retain authored painter lists; the optional
3D atlas uses modern depth testing. `src/world-colours.js` unpacks the original
five-byte colour field in each tile header and replaces palette entries 2
(ground) and 11 (sky), including model surfaces using those entries. The camera
position selects the tile; generated layouts and zero colour fields retain the
default palette. Model coordinates
are in two-centimetre units; world placement coordinates are centimetres. The
atlas scales local geometry by two, preserving contiguous runway pieces. Placement
angles are heading, pitch, roll; the renderer applies the original body-to-world
rotation order. Coplanar runway markings and tower doors retain depth testing with a small
bias after logarithmic depth calculation. Doors draw only from their outward
side; both kinds of detail remain hidden behind foreground objects. `scripts/check-map3d.py --url <served-site>/`
checks Training Ground’s runway markings over 216 camera angles/distances,
door visibility from both sides and foreground occlusion (`--world morning`
checks Atkinsville); it uses the same optional Playwright setup as `check-browser.py`.

- `content/investigation.md`: the illustrated article.
- `content/research-sources.md`: claim-to-evidence pointers.
- `src/pages.mjs`: editorial page layouts and labels.
- `src/models.js`, `src/atlas.js`, `src/map3d.js`: viewer interaction.
- `public/images/`: checked-in screenshots and social previews.
- `public/audio/`: browser listening copies, with methods on the music page.
- `site.config.json`: canonical site, archive and repository URLs.

Publishing uses GitHub Actions on `master`. Set the repository's Pages build
source to GitHub Actions. The workflow builds/checks before uploading `dist/`;
relative navigation and lazy-loaded assets work at the repository subpath.
The analysis archive has a separate publisher and deployment destination.

The shared social card uses the general **Corncob** title and project URL.
`python3 scripts/render-social.py` renders `scripts/social-card.html` at 1200×630
using the original aircraft, crew and early sun geometry, alongside our cockpit
and atlas captures. It needs Python Playwright and Chromium; if necessary,
`PLAYWRIGHT_DRIVER_CLI` can point to a matching Playwright Node CLI. Copy the
resulting `public/images/social-preview.jpg` to the research repository’s
`tools/publish/corncob-social.jpg` when updating the shared card.
