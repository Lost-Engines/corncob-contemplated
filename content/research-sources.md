# Evidence behind the article

The article is an account of our own investigation, not a claim to have first
discovered every known cheat or open-world feature. These paths refer to the
separately published `corncob-reverse` repository / analysis archive.

| Topic | Primary evidence in the investigation |
| --- | --- |
| Version names, duplicate Deluxe download, shared 3.42 flight binary | `analysis/versions.md`, `versions.json`, `source-media.json` |
| 61 templates, embedded geometry, source names, eight painter lists | `analysis/resource-formats.md`, `resources/models/*.json`, `tools/corncob_models.py` |
| Crew gesture distance and persistent pose, diameter correction | `analysis/resource-formats.md`, model pose metadata, `resources/previews/disc-size-check.json` |
| White Sands carried equipment | Native startup/ejection code and `corncob-cpp` commit efe964a; Redux 5a00122 |
| Tower doorway occlusion | Original drawing lists and original-game comparison; `corncob-redux/docs/redux.md` describes the intentional fix |
| Sun face trigger in 1.20/2.00; retained geometry in later builds | `analysis/remaining-assets.md#sun-and-an-early-visual-joke` and referenced native assignments |
| Experimental aircraft movement | `analysis/flight-dynamics.md#aircraft-variants` (fourfold position integration, shared cockpit/propeller) |
| Suspended animation, T, production and craters | Other Worlds hints; `analysis/gameplay.md`, `analysis/enemy-behaviour.md`; Redux behaviour notes |
| Initial Import source snapshot | `analysis/original_source.provenance.json`, upstream commit 2759414da1e6e645c3640288577d1e0cc8c32be4 |
| Slalom, trees, farm wreck, survey markers, traffic and pond interpretation | `analysis/gameplay.md#compile-time-variants-in-the-preserved-source`, `resources/training/slalom.json`, source KA.INC / FARM.INC / DEFOBJS.ASM |
| Palette persistence and protection trap | `analysis/gameplay.md#undocumented-controls-confirmed-in-the-shipped-342-engines`, `gameplay/protection-checks.json` |
| Music reconstruction and Jim Collymore credit | `analysis/audio-rendering.md`, original CORNCOB.DOC credit, original-driver capture records |
| Rainmaker timestamp and limits | `analysis/state-formats.md#rainmaker-surviving-historical-date` and the original MOAG time conversion checks |

Screenshots are either taken from our viewers, from the native reconstruction,
or retained original-program captures. Captions distinguish them. No online
screenshots are needed for this edition of the site.
