Corncob’s manual cheerfully explains that the aircraft has four times the engine thrust it ought to have. This makes it possible to climb quickly, loop soon after takeoff and get on with fighting aliens. It is a useful introduction to the priorities of the flight model.

There is quite a lot of simulation under that generous engine. The aeroplane has momentum independent of where its nose points. Air density changes its lift, drag and control response. Wheels touch down at different heights when it is banked. Damage can leave it pulling to one side. Then there are the concessions: automatic help with turns, an unusually powerful rocket, and an experimental aircraft whose principal advantage is a change to a bit shift.

We wanted to know what these things actually do, especially the difference between Beginner and Advanced aerodynamics. This account follows the normal retail 3.42 flight code, checked against the preserved assembly and measurements made by running routines from the original executable. The interactive graphs use those measurements. The larger screenshots are from our Redux reconstruction and are labelled as such.

<figure><img src="../images/flight/banked.webp" width="1280" height="720" alt="The blue-winged Corncob aircraft banking over a runway, with alien installations ahead."><figcaption>Our Redux external camera makes the aircraft’s attitude easier to see. The original game puts us in the cockpit; the physics discussed here comes from its DOS executable.</figcaption></figure>

## One step through the air

The aircraft carries several descriptions of itself: its position in the world, its velocity, its orientation, and accumulated rotation around its three axes. Each has a different job. Turning the nose changes the orientation immediately; changing the direction of travel requires forces to change the velocity.

The force calculation is easiest in the aircraft’s own coordinates. Corncob uses body X for forward motion, Y for sideways motion and Z for up. A rotation matrix converts world velocity into these axes. Gravity is converted too, so that it still pulls down through the world when the aircraft is upside down.

A flight update broadly follows this sequence:

<ol class="graphics-pipeline">
<li><strong>Read the controls.</strong><span>Combine stick and rudder input with airflow, rotational inertia, damping, damage and the selected flight aids.</span></li>
<li><strong>Update the attitude.</strong><span>Apply the resulting pitch, roll and yaw changes, and construct the transforms needed by the force calculation.</span></li>
<li><strong>Work in aircraft axes.</strong><span>Transform velocity and gravity. Work out angle of attack, density, engine power, drag and the vertical aerodynamic force.</span></li>
<li><strong>Change the velocity.</strong><span>Scale force increments by the current time step, then rotate the result back into world coordinates.</span></li>
<li><strong>Deal with the ground.</strong><span>Find wheel clearance, apply suspension and braking, and decide whether contact is survivable.</span></li>
<li><strong>Move.</strong><span>Integrate the world velocity into the position, retaining a contribution from the acceleration during the step.</span></li>
</ol>

The actual program is less tidy than this outline. Collision and support-height work shares machinery with the scene traversal. Some control inputs to the maths, and the density used for engine power, come from the preceding pass. These details matter when reproducing it, particularly around a sudden collision or change of state.

Everything here is integer arithmetic. Angles wrap at 65,536 units per turn; world positions are centimetres. Products often use a wider intermediate result before rounding or shifting back down. The force and velocity variables have their own scaling conventions. We keep the graphs relative where a label in newtons or metres per second would imply a calibration we have not established.

## What Advanced actually changes

The two menu choices share the same main force calculation. Selecting Advanced does not introduce a second, more elaborate set of wing equations.

Beginner mode adds a gentle pitch aid through a routine called **PITCHLOCK**, also used by the autopilot. It looks at speed and pitch, chooses a target from a small table, limits the error and feeds a correction into the pitch response. The target changes with speed: slower flight calls for a more nose-up attitude.

It also checks vertical motion. If the climb or descent is already small enough, it leaves the pitch alone. At insufficient speed it cannot perform its normal correction. Beginner’s version is deliberately gentle, applying a quarter of the correction strength used by the autopilot’s corresponding pitch path.

Advanced removes that unsolicited pitch assistance. The aircraft is consequently more willing to keep the attitude and flight path that the controls and forces have produced. It still has the same lift, drag, stall and engine calculations.

Some help remains in both modes. The automatic turn contribution still exists, as does a predictive stall-protection calculation. “Advanced” therefore means less assistance within Corncob’s model. It does not mean every rotation must emerge solely from independently simulated aerodynamic surfaces.

<div class="table-scroll" tabindex="0" role="region" aria-label="Beginner and Advanced flight modes">
<table><thead><tr><th>Behaviour</th><th>Beginner</th><th>Advanced</th></tr></thead><tbody>
<tr><td>Body-relative lift, drag and thrust</td><td>Yes</td><td>Same calculation</td></tr>
<tr><td>Density and altitude effects</td><td>Yes</td><td>Same calculation</td></tr>
<tr><td>Gentle automatic pitch aid</td><td>Yes, outside a stall</td><td>No</td></tr>
<tr><td>Predictive stall protection</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Automatic contribution to turning</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Wheel contact and crash thresholds</td><td>Yes</td><td>Same calculation</td></tr>
</tbody></table>
</div>

## The nose and the flight path

Angle of attack is the angle between the aircraft’s forward axis and its motion through the air. It is not simply the pitch shown by the artificial horizon.

Pull the nose up while the aircraft is still travelling approximately horizontally and the angle of attack increases. Climb along the direction the nose already points and it need not. A steeply pitched aircraft can therefore be happily flying, while one much closer to level can be stalled.

<figure><picture><source media="(max-width:600px)" srcset="../images/flight/airflow-compact.svg"><img src="../images/flight/airflow.svg" width="820" height="283" alt="The aircraft's nose points above its velocity vector. The angle between them is the angle of attack." loading="lazy"></picture><figcaption>A geometric illustration. Corncob obtains this relationship from the velocity transformed into aircraft axes. Its stored angle uses the opposite sign to the positive angle drawn here.</figcaption></figure>

The separation of attitude from velocity is one reason Corncob can feel like a flight simulator despite the extremely sparse view. Pulling back does not simply move the aircraft upwards. It changes the conditions under which the aerodynamic calculation acts. Momentum survives the turn.

Sideways velocity survives too. The model has lateral drag and a tendency to turn into the airflow, along with a small dead band which removes very slow residual sideslip. It also has explicit limits on its sideways and vertical body-velocity components. These are practical bounds in a small integer simulation, rather than the consequences of an unlimited physical model.

## A very generous engine

The ordinary throttle variable runs from 20 to 200, in steps of 20. Although some names in the source suggest RPM, the main calculation treats this as a power setting. It subtracts the idle value of 20 before computing thrust, so idle produces no ordinary engine thrust.

For the standard aircraft, the next coefficient is 450. The result is multiplied by an altitude-dependent engine factor, divided by a measure of forward airspeed, and scaled into the force accumulator. Omitting the intermediate rounding, the shape is:

<div class="graphics-equation">power request ∝ (throttle − 20) × engine coefficient<br>forward thrust ∝ power request × altitude factor<br>　　　　　　　　÷ max(forward speed, divisor floor)</div>

Dividing by speed is the familiar broad idea that the same power produces less thrust at higher speed. The floor keeps the result finite at rest. It gives Corncob a low-speed plateau, followed by falling thrust as speed increases. This is a compact power approximation; there is no detailed propeller efficiency map.

<figure><picture><source media="(max-width:600px)" srcset="../images/flight/thrust-compact.svg"><img src="../images/flight/thrust.svg" width="820" height="385" alt="Measured engine thrust stays constant at low speed and then falls as forward speed rises." loading="lazy"></picture><figcaption>One native force pass at full throttle, at the default sea-level density. We subtract a matching idle pass to remove drag. The horizontal scale is relative to the denominator’s minimum speed; it is not a fraction of the aircraft’s maximum speed.</figcaption></figure>

Reducing power therefore allows drag to slow the aircraft; it does not set a new speed immediately. Cutting back to idle while airborne leaves a glider with the same wing calculation and accumulated momentum. There is no separate ignition, mixture or propeller-pitch simulation in this path.

Two gauges are also less literal than their variable names suggest. The internal oil-pressure value follows throttle multiplied by the engine’s altitude factor. The temperature value follows throttle alone, much more slowly. The help screen describes the former as an engine-power gauge, which is a better account of its purpose. Neither gauge feeds an overheating or lubrication failure back into the force calculation.

### And the engine torque?

We expected to find propeller reaction torque, especially in Advanced mode. In the normal 3.42 flight path, we have not found a torque term driven by engine power or RPM.

There certainly are angular forces: the controls build up roll, pitch and yaw response, with inertia and damping. Sideslip, banking and damage contribute too. But the engine supplies forward thrust. Its spinning propeller picture does not imply a simulated rotating crankshaft pushing the airframe the other way.

We checked that distinction directly. Holding the aircraft state fixed, we ran the original control routine at three forward speeds, with throttle settings of 20, 100 and 200, in both flight modes. Changing throttle left all three angular accumulators and the resulting attitude identical within each comparison. The force routine, as expected, changed the forward acceleration.

Power will still change handling indirectly: it changes speed, which changes control authority and the flight path. That is enough to produce plenty of interaction without an additional engine reaction-torque model.

## Thin air and a small surprise

Corncob’s atmosphere is a linear ramp. Above world zero, density falls in proportion to height until it reaches zero. For the ordinary Earth settings, the end of that ramp is about 15.25 km.

The engine has a separate power factor. This uses a cosine-table calculation over part of the density range and reaches zero before the air itself does. There is a small surprise at the bottom of the curve: sea-level power is about 92.7% of the maximum. Our samples reach the maximum at roughly 2 km, then fall away to zero a little above 10 km.

So climbing initially improves this particular engine multiplier, even while the air is already getting thinner. It is an easily missed feature of the formula. We do not have evidence that it represents a carefully chosen real engine or supercharger characteristic.

<figure class="graphics-demo" data-demo="atmosphere">
<picture class="graphics-fallback"><source media="(max-width:600px)" srcset="../images/flight/atmosphere-compact.svg"><img src="../images/flight/atmosphere.svg" width="820" height="385" alt="Air density falls linearly to zero around 15.25 kilometres. Engine power rises slightly before falling to zero around 10.2 kilometres." loading="lazy"></picture>
<div class="graphics-live" hidden></div>
<div class="graphics-controls" hidden><label for="air-height">Altitude <input id="air-height" type="range" min="0" max="15500" step="250" value="2000"><output id="air-value" for="air-height">2.00 km</output></label></div>
<p class="graphics-readout" id="air-result" aria-live="polite"></p>
<figcaption>Measured from the original force routine at 250 m intervals. We seed the previous-pass density to match each altitude, so these are settled altitude comparisons, not the first frame after teleporting or a climb-performance prediction.</figcaption>
</figure>

Thinner air affects more than engine output. It reduces the vertical aerodynamic force, changes drag, and weakens the controls. An aircraft can reach an altitude at which it still has aerodynamic interaction but no ordinary engine thrust. Exactly how it arrives there depends on its momentum and the preceding flight.

Other Worlds can change gravity, sea-level density and atmospheric height independently. These values come from a configuration line at the beginning of the world’s tower/briefing text. They are separate from the ground and sky colours stored with the map.

For example, Quari doubles the default gravity and supplies much denser air, with a taller atmosphere. Thin World uses about one sixth of the default sea-level density and a much lower atmospheric ceiling. Ice World has one third of the ordinary gravity and a tall atmosphere. These settings affect the same force machinery; the change of scenery comes with a change of handling.

## How the wing makes lift

The vertical aerodynamic force is one of the more distinctive shortcuts. Corncob does not look up a conventional lift coefficient against angle of attack and multiply it by total airspeed squared. It works directly from the component of velocity along the aircraft’s own vertical axis.

Call that component **W**. The aerodynamic contribution along body Z has this general form:

<div class="graphics-equation">vertical aerodynamic force ∝ −density × W × |W| ÷ divisor</div>

The sign makes it oppose the body-relative vertical motion. If the nose is above the direction of travel, W is negative: the aircraft is moving partly “down” in its own axes. The resulting force is upwards in those axes. Pitching the nose changes W even before the world velocity has had time to change.

At exactly zero W, this contribution is zero. The aircraft needs some angle between its axis and its flight path to support itself. The quadratic term also makes its response to small angles rather different from the near-linear lift-curve slope familiar from elementary aerodynamics.

The divisor supplies the flap and stall behaviour. In normal attached flight it is 2,016. Lowering the flaps halves it to 1,008, doubling this force for the same W and density. Once stalled, the divisor becomes 28,224.

That is a fourteenfold reduction from the clean-wing formula, or a twenty-eightfold reduction from the flaps-down formula. The stalled wing still produces a force opposing its vertical movement. It has become much less effective.

<figure class="graphics-demo" data-demo="lift">
<picture class="graphics-fallback"><source media="(max-width:600px)" srcset="../images/flight/lift-compact.svg"><img src="../images/flight/lift.svg" width="820" height="385" alt="Measured body-axis lift with flaps up and down. Both rise with angle of attack and drop sharply at their respective stall boundaries." loading="lazy"></picture>
<div class="graphics-live" hidden></div>
<div class="graphics-controls" hidden><label for="lift-angle">Angle of attack <input id="lift-angle" type="range" min="0" max="30" step="0.25" value="12"><output id="lift-value" for="lift-angle">12.00°</output></label></div>
<p class="graphics-readout" id="lift-result" aria-live="polite"></p>
<figcaption>Native force samples at a fixed velocity magnitude, spaced ¼° apart, with gravity removed from the plotted force. Values are relative to the largest clean-wing sample. The lines connect measured points; they do not imply a smooth transition through the stall.</figcaption>
</figure>

## Flaps and the reluctant stall

Flaps have one extended position. In addition to doubling the unstalled vertical force, they approximately quadruple forward drag and widen the permitted angle of attack before a stall.

The clean limit is about 16°. With flaps down it is about 21.3°. Those are angle limits, not hard speed limits. The aircraft can be slow and unstalled, or travelling quickly at a stalled angle to its own motion.

That gives flaps a useful combination for approach: more support at a given body-relative vertical motion, more room before the stall boundary, and substantially more drag. Leaving them out when trying to accelerate makes the engine work against that extra drag.

Corncob also tries to save us from demanding a stall. Before the angle has crossed the limit, a predictive calculation extrapolates it from the current and previous values: twice the current angle minus the old one. When that prediction exceeds a threshold, the code reduces the accumulated pitch response.

At ordinary density the threshold is about 88.5% of the stall angle. It decreases with density, making the protection intervene earlier in thinner air. It is not an absolute clamp on the aircraft’s attitude. The ground state and an existing stall bypass this particular intervention.

Once stalled, another term adds the vertical body velocity into the pitch response. The aircraft’s recovery behaviour therefore involves both the large loss of vertical force and an altered tendency to pitch. Lowering the nose, reducing the angle to the flight path and rebuilding speed have meaningful roles.

The protection is present in Advanced as well as Beginner mode. It helps explain why the advanced aircraft can feel surprisingly forgiving right up to the point where it stops being forgiving.

## Turning, inertia and rudder

Moving a control does not directly assign an angle. Roll, pitch and yaw each have a wider accumulated response, including fractional parts, which is modified and then applied to the orientation. Previous rotation is damped. Letting go of a control therefore has a different result from instantly setting its rotation rate to zero.

Control authority depends on forward airflow. Roll uses a squared airflow term; pitch and rudder use a signed term. Density scales the response as well. The forward-flow value is capped, so increasingly fast flight does not make the controls infinitely powerful.

<figure class="graphics-demo" data-demo="controls">
<picture class="graphics-fallback"><source media="(max-width:600px)" srcset="../images/flight/controls-compact.svg"><img src="../images/flight/controls.svg" width="820" height="385" alt="Roll response increases quadratically with forward airflow up to a cap, then remains constant. Lower density reduces it." loading="lazy"></picture>
<div class="graphics-live" hidden></div>
<div class="graphics-controls" hidden><label for="control-speed">Forward airflow <input id="control-speed" type="range" min="0" max="9600" step="200" value="4800"><output id="control-value" for="control-speed">1.00 × cap</output></label></div>
<p class="graphics-readout" id="control-result" aria-live="polite"></p>
<figcaption>Original control-pass measurements with the same roll input, zero initial rotation and no damage. The second curve uses density 3,000 instead of 5,957. The cap is internal forward velocity 4,800; this graph measures initial angular response, not degrees per second after a long turn.</figcaption>
</figure>

Because forward airflow matters, falling quickly with almost no forward speed does not provide ordinary control authority. Reverse airflow is another revealing case: it can reverse the signed pitch and rudder terms, while the squared roll term keeps its sign.

Banking rotates the body-axis aerodynamic force into the world. Some of the force that supported the aircraft now acts sideways. With unchanged force magnitude, a 45° bank leaves about 71% of its original vertical component.

<figure><picture><source media="(max-width:600px)" srcset="../images/flight/bank-compact.svg"><img src="../images/flight/bank.svg" width="820" height="300" alt="Front views with wings level and at 45 degrees: banking redirects some lift sideways and reduces the vertical component." loading="lazy"></picture><figcaption>The geometry of rotating a force, illustrated at equal magnitudes. The game’s actual force also changes with airflow, angle of attack and density.</figcaption></figure>

There is extra turn assistance in the code. A bank-dependent term contributes to yaw, alongside the rudder and sideslip response. It involves both bank orientation and forward airflow, so the aircraft’s turn is not solely the emergent result of the sideways force shown in the diagram.

Lateral motion has its own drag, and lateral force contributes a weathercock-like correction to yaw. At very small sideways speeds, a dead-band rule removes the remainder when the computed lateral increment has already rounded to zero. Otherwise the integer aircraft could retain a tiny sideways drift indefinitely.

Forward and lateral drag use signed quadratic velocity terms. At a sufficiently large positive component, the code switches to much stronger drag coefficients; the source describes this as transonic behaviour. It is a threshold approximation, not a calculation of Mach number or shock waves. The signed comparison also means sufficiently fast backwards motion does not encounter an identical threshold.

## Getting off the runway

At rest the aircraft is held in a modest nose-up attitude, about 8.2°. This is why a parked Corncob plane should not look like a perfectly level model hanging just above the ground.

Ground handling adds its own pitch-restoring behaviour and a speed-dependent contribution as the aircraft accelerates. Steering is through the rudder. At low forward speed on the ground, its contribution is multiplied by four, giving us a practical way to taxi without waiting for flight-speed airflow.

The takeoff instructions recommend roughly 150 mph before pulling back. That is advice to the pilot, rather than a single “speed reached: now flying” switch. The force calculation, attitude and contact height decide whether the gear remains loaded and whether the aircraft rises clear.

The surface makes a difference. Grass introduces random pitch and roll disturbances during ground travel. A runway gives a cleaner roll and more forgiving contact thresholds. The same simple aircraft that loops with absurd enthusiasm can still have a thoroughly unpleasant time being dragged across the landscape.

Once airborne, that deliberately excessive engine power comes into its own. The manual’s four-times-thrust explanation makes the rapid climb less mysterious. The developers wanted us near the interesting things, which are often in quite unreasonable places.

## Two wheels and a spring

There is no landing-gear key to forget. The manual says the gear comes down automatically, explaining that punishing absent-mindedness would add little to the fun. The contact calculation nevertheless takes the wheels seriously.

Landing is unusually concrete for such a small game. The code defines two wheel-contact points, transforms them by the aircraft’s attitude, and finds how far below the aircraft origin each one sits. The lower wheel sets the first-contact clearance.

The contacts are at body coordinates (0, +1,560, −720) and (0, −1,560, −720), in centimetres. These are generous dimensions. They belong to the collision model, not a measurement we should take from the tiny wheels in a drawing.

The aircraft’s height is then compared with the supporting surface. That can be the ordinary ground or an elevated runway. Corncob has to support the latter because, of course, one of its missions asks us to land on an airstrip suspended in the sky.

The compression used for the landing decision is:

<div class="graphics-equation">compression = lower-wheel clearance + 90 cm<br>　　　　　　　− aircraft height above support</div>

Negative compression means the wheels have not made contact. Positive compression produces a spring impulse upwards. Uneven wheel heights also contribute a roll correction, and ground handling removes sideways body velocity.

There are two escalating failure thresholds. On a runway, compression of 540 cm starts a crash landing and 1,080 cm is fatal. Grass halves both. Separate checks reject sufficiently extreme pitch or roll near contact, and the general collision system can kill the aircraft before these wheel rules get the final say.

<figure class="graphics-demo" data-demo="landing">
<picture class="graphics-fallback"><source media="(max-width:600px)" srcset="../images/flight/landing-compact.svg"><img src="../images/flight/landing.svg" width="820" height="487" alt="Front-view illustration showing how aircraft roll changes the lower wheel's height and the landing-gear compression." loading="lazy"></picture>
<div class="graphics-live" hidden></div>
<div class="graphics-controls" hidden>
<label for="gear-roll">Bank <input id="gear-roll" type="range" min="-50" max="50" step="1" value="10"><output id="gear-roll-value" for="gear-roll">10°</output></label>
<label for="gear-height">Height above support <input id="gear-height" type="range" min="0" max="26" step="0.1" value="10"><output id="gear-height-value" for="gear-height">10.0 m</output></label>
<label for="gear-surface">Surface <select id="gear-surface"><option value="runway">Runway</option><option value="grass">Grass</option></select></label>
</div>
<p class="graphics-readout" id="gear-result" aria-live="polite"></p>
<figcaption>Change bank, origin height and surface to inspect one contact decision at level pitch. Wheel clearances are sampled from the native routine; the drawing is schematic. This does not integrate a descent or predict whether an obstacle would be hit first.</figcaption>
</figure>

The decisive number is penetration, rather than a standalone descent-rate limit. Descent speed matters because it determines how far the aircraft moves into the contact region between updates. Attitude and time-step size matter too. A steeply banked approach can put one wheel far below the other.

The preserved source contains a switch for a damping term in the suspension. That branch is disabled in the normal retail path we measured. The working response is a spring-like impulse, with the rest of the ground-handling logic supplying additional constraints. Some of Corncob’s enthusiasm for bouncing becomes easier to understand.

<figure><img src="../images/flight/suspended-approach.webp" width="1600" height="900" alt="Cockpit approach to the floating runway in Overnight Express, with an alien platform beyond its end." loading="lazy"><figcaption>Overnight Express, seen in our Redux reconstruction. The landing support must be the runway’s own height. Treating every landing as a collision with the world’s ground plane would miss the point rather spectacularly.</figcaption></figure>

## Brakes, skids and a duplicated instruction

The brakes act on the ground. They are not an airborne speed-brake control. With the engine near idle, the game also applies a weaker automatic braking force; sufficiently slow ground motion settles into a stopped state.

A surviving crash landing enters another branch. Power goes to idle, the aircraft is levelled, horizontal movement is damped and its heading can spin as it slows. It is possible to end up with a wrecked aircraft and a living pilot who can leave it. Invulnerable training has an additional bounce/recovery path.

We found a particularly small mistake in the normal braking code. A helper applies the velocity correction along world Y, then its caller applies that Y correction again. World X receives it once.

We tested the original landing routine with the same aircraft state and brake input, first pointing along one world axis and then a quarter-turn around. In the isolated comparison, horizontal speed went from 4,998 to 4,983 in one direction, and from 4,998 to 4,968 in the other. The second heading lost twice as much speed during that pass.

These are internal velocity units, not mph. The useful result is the factor of two. It means braking depends on the compass orientation of the airstrip, for a reason entirely unrelated to tyres, wind or slope.

## Rockets and broken aeroplanes

The rocket gives the forward-force calculation a much larger power request while consuming a stored reserve. In the active branch it replaces the ordinary engine numerator; it does not simply add a fixed push after the rest of the physics.

It still passes through the altitude multiplier and the airspeed divisor. Corncob’s rocket therefore inherits an engine-like dependence on atmosphere. This is convenient code reuse with a fairly noticeable physical consequence: it is not an independent vacuum-capable escape from the engine’s altitude limit.

The manual describes a short burn and a longer recharge, roughly fifteen seconds and two minutes. The implementation drains the reserve using the flight time correction and recharges it through its timer-based bookkeeping. For exact reproduction, those clocks matter more than treating the prose durations as exact constants.

The boost can help recover speed after a bad manoeuvre, but the wing remains subject to its angle and airflow rules. It does not directly clear a stall or reset the flight path.

Damage is divided into engine, wing, control and rudder effects. Engine hits reduce the maximum available throttle multiplicatively, by about five percent per hit, with integer rounding. Repairs restore the ceiling. The other channels disturb angular behaviour: wing damage introduces a roll bias, rudder damage a yaw bias, and control damage adds jitter which depends on airflow.

This can make a damaged aircraft quite demanding even while it retains enough engine power to stay up. The effects accumulate through the same angular machinery used by ordinary control input, so they interact with speed and the pilot’s attempts to correct them.

## The autopilot has its own habits

The full autopilot uses the stronger pitch feedback mentioned earlier and an altitude-holding path called **DOHLOCK**. It has a speed floor and limits on the corrections it can request. It is a flight aid built around this particular aircraft model, rather than a separate navigator planning a route through the world.

One small instruction-level detail affects altitude capture. The code calculates the absolute value of the vertical speed, but the comparison then uses the original stored word as an unsigned value. A small negative descent consequently fails a check that its equally small positive counterpart can pass. It is another case where the apparent intention and the executed instructions differ.

The F2 relocate facility is separate. It can move the aircraft to a mission starting position with an assigned forward speed, subject to its damage restriction. It does not demonstrate that the autopilot can fly an approach to that place by itself.

Beginner’s aid borrows part of this machinery without turning on the whole autopilot. That shared routine is the clearest explanation of what the two aerodynamic modes mean.

## Different aircraft, familiar shortcuts

The spare brown aircraft uses an engine coefficient of 350 instead of the usual 450: about 78% of the normal value before the common throttle, altitude and speed factors. Much of the rest of the flight model is shared. Finding another plane changes the available performance without requiring a complete new aerodynamic definition.

The black experimental aircraft has a more extravagant trick. Its position integration shifts the result right by two bits where the ordinary aircraft shifts by four. That makes the resulting movement four times as large for the same underlying velocity calculation. The airspeed display receives a matching multiplier.

This is separate from the manual’s explanation of the already overpowered ordinary engine. The experimental aircraft’s shortcut scales movement through the world, including vertical movement. It is not a carefully modelled jet engine bolted to a new wing.

<figure><img src="../images/flight/experimental.webp" width="1280" height="720" alt="The black angular experimental aircraft in an external Redux view above the airfield." loading="lazy"><figcaption>The experimental aircraft, shown with Redux’s external camera. Inside, the familiar cockpit still has a propeller. Corncob is very comfortable with leaving that sort of detail alone.</figcaption></figure>

## Time, and leaving the machine behind

The original time correction is derived from the elapsed hardware timer count, with a bounded range for ordinary updates. Holding T supplies a much larger correction. Force and position calculations use that value, while some relaxation and state changes are also tied to how often their routines are called.

Consequently, changing the frame rate or holding time advance is not equivalent to taking an arbitrary number of perfectly identical tiny physical steps. It is a particular collection of scaled increments, integer rounding and per-update operations. Preserving the clocks was part of reproducing the feel, as well as matching the algebra.

There is one final separation of state that gives Corncob much of its character. The aircraft and the observer do not have to remain the same entity. Eject, or get out after landing, and the pilot acquires their own motion while the aircraft continues to exist. Remote control can route commands back to it.

The game has already done the important conceptual work: the plane owns a position, a velocity and an attitude; the camera need not own those same values. That leaves room for parachuting, walking across an airfield, flying from the ground and eventually climbing into another aircraft. A surprisingly substantial flight model is sitting inside a game that is always ready to let us abandon it and do something stranger.

## Following the evidence

Our main references are the preserved [Initial Import assembly source](https://github.com/foone/Corncob3D/tree/2759414da1e6e645c3640288577d1e0cc8c32be4), the retail 3.42 executable, and our [readable C++ reconstruction](https://github.com/Lost-Engines/corncob-cpp/tree/11cd25359cf470d0a87e2409d0ab39c6874a3f54). The source includes experiments and disabled branches, so we use the shipped instructions to settle the behaviour described here.

The reconstruction’s reference comparisons cover force passes, angle calculations, control response, matrix operations, autopilot behaviour, wheel heights, landing contact and recovery. For this article we also sampled the native routines specifically to obtain the plotted curves and to check the throttle/torque and braking observations.

The diagrams are deliberately narrower than a complete browser flight simulator. Each graph fixes a set of inputs and shows what one native calculation returns. That makes a comparison reproducible, while avoiding promises about a whole trajectory that the graph does not simulate.

[Detailed evidence and illustration notes](https://github.com/Lost-Engines/corncob-contemplated/blob/master/content/flight-sources.md) record procedure names, executable offsets, sampling conditions and image provenance. The [small measurement snapshot](../data/flight-samples.json) ships with this page; the browser needs no game files.

For the other half of the machinery, [follow the graphics pipeline](../graphics/). Or take a less numerical tour through the [world atlas](../atlas/) and [model gallery](../models/).
