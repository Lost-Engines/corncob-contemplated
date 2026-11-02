# Evidence for the flight-physics article

The article at `flight/` describes the normal retail Corncob 3D 3.42 flight path.
It distinguishes shipped instructions, preserved source experiments, our readable
reconstruction and modern Redux screenshots. It does not claim that these
observations were previously unknown.

## Reference identity

- [Preserved source, Initial Import
  2759414da1e6e645c3640288577d1e0cc8c32be4](https://github.com/foone/Corncob3D/tree/2759414da1e6e645c3640288577d1e0cc8c32be4).
  Local preservation: `corncob-reverse/analysis/original_source/`, before the
  uploader's later MASM compatibility changes.
- Retail reference: `corncob-reverse/installs/deluxe_dnk/3.EXE`.
  SHA-256: `c411dde7d18e1dc19d718327b70d1e69321448520344d3baa4a0c8e68a71e81e`.
- [Readable reconstruction at
  11cd25359cf470d0a87e2409d0ab39c6874a3f54](https://github.com/Lost-Engines/corncob-cpp/tree/11cd25359cf470d0a87e2409d0ab39c6874a3f54).
  Main companions: `src/flight/aircraft.cpp`, `landing.cpp`, their headers,
  `src/maths/fixed.cpp` and `src/graphics/instruments.cpp`.
  These are our translations, not original C++ source.
- Original documentation and decoded help screens in the research archive,
  including `analysis/help-screens.md` and `installs/deluxe_dnk/CORNCOB.DOC`
  (takeoff/landing, inflight keys and the gear/thrust FAQ). The manual's four-times-thrust explanation
  concerns the ordinary aircraft. The experimental plane's fourfold position
  integration is a separate mechanism.
- Research notes: `analysis/flight-dynamics.md`, `analysis/gameplay.md`,
  `analysis/resource-formats.md`. The article adds native probes and qualifies
  earlier shorthand: the rocket replaces the ordinary numerator in its active
  branch; physics environment settings are in the tower text, not the tile palette.

Offsets below are offsets in the retail EXE file, including its 512-byte header.
The emulation helpers load the image without that header, so subtract 512 when
forming a code address. Data offsets are relative to the native data segment.
Assembly line locators refer to the pinned import; named procedures are preferred.

## Claim-to-code map

| Subject | Evidence and limits |
| --- | --- |
| Forces and position | `3.ASM` main flight update around lines 8310–9230; native force pass `0x37d0..0x3c0c`. World velocity is transformed into aircraft axes, gravity projected, force increments applied and transformed back. Position integration uses retained increments. Some inputs are from the preceding pass. |
| Beginner / Advanced | `aeroflag`/`simpflag`, call near source line 8504; native `0x34c4..0x3545`. Beginner calls PITCHLOCK outside a stall. Both modes reach the same force, stall-protection and landing code. Full autopilot is separately controlled. |
| Pitch assistance | PITCHLOCK, source line 3896, native `0x1327`; speed-table values `[-2109,-1507,-1005,-772,-671,-571,-500,-450]`, speed clamp 3901..15500, error clamp −2000..3200. Divisor 280 for the beginner-only correction, 70 for the full autopilot path. Vertical-speed dead band 150, minimum speed 3900. |
| Altitude lock | DOHLOCK, source line 3961, native `0x13bc`. Capture computes absolute AX but compares the original vertical-speed word unsigned; small negative values fail. The separate F2 relocate branch assigns a mission start and forward speed and refuses sufficiently damaged aircraft. |
| Torque and controls | Native controls `0x31a7..0x37d0`; `src/flight/aircraft.cpp` control response. Forward airflow is body X shifted right four, clamped to ±300. Roll uses its square and density; pitch/rudder use its signed value. Damping and inertia operate on accumulated angular responses. No throttle/RPM term feeds engine reaction torque in this normal path; no claim about every experimental build. |
| Bank and sideslip | Same pass: bank-dependent yaw uses matrix components and forward airflow; lateral velocity and prior side force give additional correction. Tiny lateral residual is zeroed when the computed side increment has rounded to zero. Body Y/Z have bounds ±9500/±9600. |
| Engine | Source around line 8869: throttle minus 20, coefficient 450 (reserve 350), divide by 200; multiply by `thrtmult`, divide by max(body X >> 4, 300), scale force. Native measurement retains signed/unsigned operations and rounded division. `rpm` is a throttle setting, not evidence of engine angular momentum. |
| Altitude factor | Before thrust: previous `rhotop`, `rho0`, transition `rho02`, phase scale 20383 minus 4000 and cosine helper. Sea-level factor 60775/65535; sampled peak 65535 at 2000 m; first zero in 250 m samples at 10250 m. Sample boundaries are not exact continuous thresholds. |
| Density | Following thrust: altitude word from position bits 8..23; nonnegative ordinary-range height; `rho0 * max(rho0z − height_word, 0) / rho0z`. Default `rho0=rho0z=5957`; height scale 256 cm, hence nominal 15,249.92 m ramp height, with integer altitude steps. No claim of exponential density or arbitrary-height validity. |
| Other Worlds | READUNIVPARAMS, source line 4915, leading `X` line in tower/briefing entry in `3UNIV.DAT`. Gravity clamps −100..−15, density 1000..10000, atmospheric height at least 256. Transition becomes two thirds of density. Site `world-other-*.json` retains this under `briefing.environment`; palette bytes in CCT/DEF are separate. |
| Lift | Native force pass: signed quadratic body Z with fixed-point scaling/rounding; divisor 2016 clean or 1008 flaps, stalled divisor 28224; density and time scaling. Prose omits common scales and rounding, describing body-axis aerodynamic force, not world-vertical net force. |
| Stall | Native angle-from-velocity, threshold 2912 clean /3882 flaps (≈15.996° /21.325°). Positive explanatory angle is the negative of the usual native angle. Integer components and arctangent rounding put first stalled graph samples at 16.25° and 21.5°. Joining ¼° samples does not imply a continuous transition. |
| Stall protection | Shared control pass: `2*alpha − oldalpha` prediction, density-scaled threshold using 58000/65536 of stall limit; adjusts accumulated pitch, tracks prior contribution. Bypassed on ground / already stalled; stalled response adds body Z ×128. |
| Drag | Forward/lateral signed quadratic uses reduced velocity and density. Divisor 13734 normally, 1368 forward /136 lateral beyond positive reduced-component threshold 1390. Flaps quarter forward divisor via shifts. Signed threshold is not an absolute-speed comparison. |
| Instruments | `INST.ASM` gauge routines: `opres` target depends on throttle and `thrtmult` with 1/40 relaxation; `etemp` follows throttle with 1/180 relaxation. Neither feeds overheating or oil-pressure failure into this path. Propeller animation follows timer/throttle. |
| Takeoff | Ground pitch correction and low-speed rudder multiplication in controls; parked pitch −1500 (~−8.24°, nose-up sign). No single 150 mph lift-off switch. Random taxi disturbance around `0x379c..0x37c4`; help-screen takeoff advice at 150 mph. |
| Wheels | FINDHEIGHT, source line 3835, native `0x129a`: `(0, ±1560, −720)` cm, inverse attitude matrix, clearance is max of negated vertical transforms. Rejects absolute pitch/roll over 10000. Native level result is 719 cm because of fixed-point rounding. |
| Landing | DOLANDINGGEAR, native `0x1805`. Support-relative height, clearance +90 minus height. Runway crash/fatal compression 540/1080 cm; grass 270/540. Contact adds compression ×266/1000 in unscaled vertical speed and wheel-difference roll ×compression×32, eliminates body sideways velocity. Prior collisions/crash and global guards are outside the diagram's classifier. |
| Disabled damping | Preserved `dampflag equ 0`; retail reference covers undamped landing routine. Source presence does not prove a damping branch shipped. |
| Brakes | Strength 15 for brakes /6 at low throttle, time-scaled and distributed along world velocity. Helper applies Y, then caller adds Y again. Chosen state: 4998→4983 on X vs 4998→4968 on Y. Same input, dt=normal=5, compression=100 cm, throttle=20. Spring adds vertical velocity 26 in both. |
| Recovery | RESETPLANE, BOUNCEVERT and crash-landing branches; `landing_recovery` fixtures. Distinguish surviving crash landing, fatal contact and invulnerable-training bounce. |
| Rocket | `qrocket` active branch replaces AX with drain result +3×450, then shares altitude/speed factors. Drain is flight-time scaled; recharge uses timer bookkeeping. Manual burn/recharge times are approximate. |
| Damage | Hit dispatch around source line 3450 onward; engine ceiling ×950/1000, wing roll bias, rudder bias, control jitter. Repairs reset effects. `wingloss` is increased but has no reader in preserved source; article does not infer a lift penalty from its name or the manual. |
| Alternate aircraft | Coefficients in `F3DEQU.INC`/runtime selection; position integration >>2 experimental vs >>4 ordinary. `INST.ASM` aspcrd1 multiplies indicated experimental speed by four. All position components share integration scaling. |
| Clock and observer | Ordinary timer-derived correction bounded 2..35, T override 50; separate per-pass relaxation. Ejected/walking person state and remote routing are separate from aircraft state; not every game system advances with an identical clock. |

## Native article measurements

`scripts/sample-flight.py` uses Unicorn to run copied instructions in memory.
It verifies the executable hash before running. The executable on disk is never
patched. It imports loading, matrix and register helpers from the C++ checkout's
reference generators; it does **not** call their entry points or overwrite fixtures.

Typical authoring command, with Unicorn installed:

```sh
python3 scripts/sample-flight.py --analysis ../corncob-reverse --cpp ../corncob-cpp
node scripts/make-flight-diagrams.mjs
```

The output is committed `public/data/flight-samples.json`. Normal builds require
neither Unicorn nor the game nor sibling repositories.

- **Lift:** velocity magnitude 5000 in native units, 0°..30° in ¼° increments;
  rounded cos/sin X/Z components, Y zero. Identity matrices diagonal 32767;
  gravity −48, density 5957, time correction 5. Subtract zero-angle vertical
  result to remove gravity. Clean peak 5,623,408; flaps peak 19,348,336. These
  accumulator units normalize the graph and are not newtons.
- **Atmosphere:** 0..15500 m by 250 m. Seed previous density to that height,
  since thrust precedes density refresh. Settled comparison, not the transient
  first pass after moving, nor a maximum-altitude trajectory.
- **Roll:** forward velocity 0..9600 by 200, roll input 128, others zero,
  vertical velocity −1000, initially zero rotation. Advanced, undamaged,
  no autopilot, airborne. Densities 5957 and 3000. Normalize accumulator to
  2,880,000; not a sustained roll rate.
- **Thrust:** forward velocity 0..14000 by 200, zero Y/Z; subtract throttle
  20 from 200 at identical inputs, isolating thrust from matching drag.
- **Torque probe:** both modes, speeds 1600/5000/9600, throttle 20/100/200,
  body Z −1000, zero rates/attitude/input/damage. Three outputs match exactly
  within each of six groups: roll, pitch, yaw and attitude. This complements
  inspection of the throttle-independent angular terms.
- **Wheels:** native inverse matrix and FINDHEIGHT at level pitch, roll
  −50°..50° by 1°. Diagram uses measured heights and documented compression
  comparisons; the aircraft drawing is schematic.
- **Braking:** native wheel routine, compression 100 cm, body velocity 5000
  forward, brake held, time correction 5, throttle 20. Headings 0 and 16384;
  store before/after world velocities.

Only irrelevant HUD/audio calls and controlled keyboard/home-base queries are
stubbed. Arithmetic executes in the original binary. The snapshot also retains
four `basic_forces` cases; its high-altitude case starts with default previous
density and is not the settled-altitude comparison used by the graph.

Broader C++ fixtures include 8228 angle cases, 256 force passes, 128 position
integrations, 512 matrix/control comparisons each, 512 autopilot cases, 256
wheel-height and 512 contact cases, 512 recovery cases and 1024 rocket recharge
cases. Equivalence on covered inputs is not proof of every whole-flight outcome.

## Illustrations and screenshots

`src/flight-diagrams.mjs` generates wide/narrow static SVGs and the interactive
views. Graphs connect samples. Airflow and bank-force drawings explain geometry.
Landing is restricted to level pitch, admissible bank angles and nonnegative
local height; it excludes earlier collisions/prior crash state and integrates
no motion. The 0.90 m contact margin is intentional.

Controls are keyboard-operable with no autoplay. Missing data leaves static
figures intact; printing also uses static figures. This is not a general
flight-performance calculator.

Screenshots come from previous Redux captures: `banked.png`, `experimental.png`
in `/tmp/corncob-chase/`, and `corncob-redux-12-overnight-express-approach.png` in
`/tmp/corncob-proportions/`. The latter is from the corrected-proportion set.
The external camera is a Redux addition, identified in captions.

`content/flight-image-provenance.json` records input/output SHA-256, dimensions
and conversion. Approach is resized proportionally to 1600×900 with Lanczos;
the two 1280×720 chase images keep their dimensions. All are lossless WebP.
They illustrate setting and aircraft, not measured native force output.

Original game material remains the work of Kevin Stokes, George Welch and
Pie in the Sky Software. See [RIGHTS.md](../RIGHTS.md).
