## A flight game you can walk away from

Corncob 3D has a fairly loose understanding of what belongs in a flight simulator. You can land almost anywhere, leave the aircraft and continue on foot. You have a pistol, a charge you can plant and detonate remotely, and a key to hurry things along when the walk turns out to be several miles. You can also stay on the ground and fly the aircraft by remote control.

There are other aircraft to find and climb into. There are rescue vans, strange alien installations, portals and a floating airstrip. The setting is an alternate 1949, following an alien invasion in 1938. Its explanation for why the Second World War never happened involves a thrown beer bottle. That sets the tone reasonably well.

We remembered enough of this to want a closer look. After working through Darker, we expected Corncob to be a smaller investigation: a small installation, very simple graphics and relatively little obvious artwork to extract. Most of the interest seemed likely to be in the rules.

That was broadly right. We had underestimated how much personality could fit into the models.

<figure><img class="pixel-art" src="../images/cockpit.webp" alt="Corncob's bright cyan sky, flat green ground and original instrument panel, shown in our native reconstruction." width="1200" height="750"><figcaption>White Sands in our native reconstruction. The cockpit and world models come from the original game; the screenshot is not a DOS capture.</figcaption></figure>

## Which Corncob did we actually have?

The first job was sorting out the installations. We had an old copy, several shareware downloads, retail floppy material and the Other Worlds expansion. The names on the downloads were not especially helpful.

“Deluxe” did mean something at the time. Contemporary shareware documentation describes a commercial Corncob Deluxe, and the Personal Companion retail installers use that name. But one modern download labelled Deluxe turned out to contain Other Worlds. Apart from distributor text, it was the same package as the explicitly named expansion download.

Version numbers were not enough either. The retail and shareware 3.42 copies share their flight executable and four Earth world files, while their menu programs and documentation differ. Conversely, two copies labelled 3.40 have differences in both code and resources.

We compared the files, retained the distinct builds and chose retail 3.42 as our normal-game reference. Other Worlds needed its own reference: it is a self-contained package with different executables and music, rather than a handful of extra maps that must be copied over an existing install.

That distinction matters later, when a piece of code or a model appears in one build but not another. A filename on an archive is a useful starting point. It is not a release history.

## The artwork was in the flight executable

Corncob's installation is a collection of programs. The main menu, the flight engine and the tower's intelligence reader are separate executables. Batch files and temporary files carry information between them. Getting out and walking into the tower really does hand control to another program.

The flight executable, `3.EXE`, also contains most of the 3D artwork. We found 61 object templates pointing to models assembled from polygons, lines and discs. A single template can select different detail levels, change its appearance or be replaced during play. Sixty-one templates does not mean sixty-one completely separate shapes.

The world files do a different job. They place objects, with positions, orientation, flags and parameters, across a grid of tiles. Companion briefing files describe the local conditions and mission starting positions. The [atlas](../atlas/) brings those placements and starts together; selecting a dot opens the corresponding model.

<figure><img src="../images/pipeline.svg" alt="World files supply placements and mission starts. The flight executable supplies model templates, drawing lists and behaviour. Our atlas and gallery assemble those recovered definitions for inspection." width="1100" height="430"><figcaption>The useful separation: world files tell us where things are; the executable tells us what they look like and how they behave.</figcaption></figure>

There are no elaborate texture sets hiding behind the blocky scenery. Much of what looks like a recognisable object is a few carefully placed flat shapes. The ground crew's face is particularly economical.

## The ground crew have an opinion

At White Sands we walked up to a member of the ground crew and remembered what happens next.

He gives you the finger.

The ordinary standing pose and the gesture are separate arrangements. Approaching on foot to within 20 metres switches the model pointers; there are no intermediate frames to recover. Once raised, the finger stays raised even if you move away. Corncob has made its position clear.

<figure><div class="paired"><img src="../images/crew-standing.webp" alt="The ground crew's ordinary standing pose, built from flat shapes and a circular head." width="912" height="702"><img src="../images/crew.webp" alt="The same ground crew member with one finger raised." width="912" height="702"></div><figcaption>Two stored poses. <a href="../models/?model=7&amp;state=gesture">Turn him around in the gallery →</a></figcaption></figure>

Our first preview made his head much too large. The wheels on a ground vehicle looked suspiciously generous too. We had treated stored disc diameters as radii. Halving them made both the people and the vehicles considerably more convincing, within Corncob's fairly generous definition of convincing.

There is also a bloodied pose. White Sands does not give the pilot a pistol, which is probably for the best. During reconstruction we briefly allowed one there; checking how the original initializes its carried equipment put that right.

## Eight lists instead of a depth buffer

Getting the shapes out was only half the job. Corncob was designed to draw them in a particular order.

A model has eight ordered drawing lists, selected according to which side of it the camera occupies. They can omit a surface, repeat a surface or interleave different kinds of primitive. The lists are part of the artwork. Combining everything into one convenient mesh loses information.

This showed up in small details: windows on the rescue van, markings on runway pieces, and facial features sitting over the ground crew's circular head. Treating the data as an unordered bag of triangles made those layers unreliable. A depth buffer did not automatically solve it; some surfaces are deliberately coplanar.

The public model gallery retains the recovered painter lists. It uses modern projection, but keeps those authored omissions and overlaps. The optional neutral shading is an inspection aid, not Corncob's lighting.

One apparent mistake survived every correction: the tower doorway could show through the back and sides of the tower. We went back to the original game. It does it there too.

That one belongs to Corncob. The faithful reconstruction keeps it; Redux fixes the occlusion.

## Even the sun gets involved

We initially thought of the sun as something the renderer would draw for itself: two circles, nothing much to extract. It turns out to have stored model geometry outside the ordinary object-template table.

It also has a face.

<figure><img src="../images/sun.webp" alt="The recovered sun with a simple linework face and rays, displayed face-on." width="1200" height="750"><figcaption>The face-and-rays appearance. <a href="../models/?bank=shareware_1_20&amp;model=sun&amp;state=face">Inspect the early sun model →</a></figcaption></figure>

In the early 1.20 and 2.00 engines, the same proximity code that selects the rude ground-crew pose also installs the face-and-rays sun as its near-detail model. The connection is in the code; it is not just a resemblance we imagined while looking at the shapes.

The later engines still contain the face geometry, but we have not identified a selection trigger in those builds. The gallery therefore labels it as stored geometry there. It would be easy to turn “we found a model” into “this definitely happens in the retail game”. They are different findings.

## The experimental aircraft is admirably direct

The black aircraft parked at White Sands looks like a small, angular attempt at a stealth aircraft. There is very little model to inspect. It still manages to be one of the more distinctive things on the airfield.

Its flight model has a shortcut to match. The experimental variant changes the position integration so that it travels **four times as far at the same internal velocity**. The airspeed display makes the corresponding adjustment. It is not an entirely separate set of jet aerodynamics.

The cockpit remains shared, including the propeller that appears at low throttle. We had noticed the propeller before finding the arithmetic, and it was pleasing to discover that the implementation was just as straightforward as it looked.

<figure><img src="../images/aircraft.webp" alt="The black flying-wing model used for the experimental aircraft at White Sands." width="1200" height="750"><figcaption>The experimental aircraft. The extra speed is in the movement calculation. <a href="../models/?model=experimental-aircraft">Inspect the model →</a></figcaption></figure>

## Waiting changes the odds

Holding T is essential when you can walk across a large world. It also exposes some very Corncob-like interactions between time, visibility and simulation.

The original has an active neighbourhood around the player. Objects outside it can stop receiving their normal updates. The Other Worlds hints describe the resulting suspended animation and explain how to use it. A distant installation is not necessarily carrying on with its business while you are elsewhere.

Enemy production also has frame-based machinery. Accelerating the player's movement does not simply multiply every part of the game by the same factor. The hints openly discuss exploiting time advance to reduce the number of KLAs produced. Those timing details make more sense after following the update loop than they do from watching an individual enemy.

Then there are the craters. A bomb can leave a crater with a damaging volume that remains after the initial explosion. The shape looks like the aftermath; the collision system can still treat it as part of the attack. The hints warn about these too.

These are useful examples of why a faithful reconstruction and an enhanced version are different projects. We reproduced the original mechanisms first. In Redux, distant objects remain active, T accelerates the whole simulation, and lingering craters no longer kill the pilot or aircraft. The blast and flying debris still matter.

## A source-code detour

During the investigation we found that Corncob's original assembly source had already been recovered and [preserved by foone](https://github.com/foone/Corncob3D). That changed the job substantially.

We kept a local snapshot of the repository's [Initial Import](https://github.com/foone/Corncob3D/tree/2759414da1e6e645c3640288577d1e0cc8c32be4), before later changes intended to make it compile with MASM. The snapshot has its own file hashes and provenance record. Preserving that first version lets us distinguish the recovered material from subsequent compatibility work.

Source did not make the shipped executables redundant. The preserved configuration is not the ordinary retail game, and some branches are historical experiments. We still needed to compare it with the binaries, run original routines with controlled inputs and check results in DOSBox. A symbol name is helpful evidence, but it is not a guarantee that a particular release takes that path.

It did give us much better names. The palette-twisting routine is called `takedrugs`. There is a `saucey` switch. These are not names we would have wanted to tidy away.

## Slalom, a barn and a suspicious pond

The source configuration includes a no-player-guns slalom experiment. It replaces some familiar object slots with trees, a farm building and other scenery, and adds a sequence of six alternating crossings. The markers occupy two rows at different heights.

We have not established that a slalom edition was commercially released. The [course in the atlas](../atlas/?world=slalom&amp;view=3d) is a reconstruction from the preserved source, kept apart from the shipped world definitions.

<figure><img src="../images/slalom.webp" alt="The reconstructed slalom scenery, including a farm building and simple trees." width="1200" height="750"><figcaption>The source experiment assembled for inspection. This is our viewer, not evidence of a released slalom executable.</figcaption></figure>

Our first attempt brought along the normal combat-training defaults. That was rather less peaceful than expected. The standalone source initializes those enemy-site counts to zero, so inheriting the ordinary menu's defaults was wrong.

Other oddities genuinely remain. Three aircraft fly overhead; their handler moves them along fixed attitudes instead of launching enemies. Yellow pads with black crosses appear at distant survey points. They look important, but the code does not make them generator sites or course objectives.

The blue ground polygon initially looked like an unusually large crater, because it reuses the crater geometry and symbol. Enlarged and fixed to blue, it makes much more sense as a pond. That is an interpretation of the appearance, rather than a recovered label saying “pond”.

The barn has another reuse trick. Destroying it selects the ordinary fuel-dump wreck and throws off fragments. What looked like a barn tipping onto its side was not a hidden barn-collapse animation. It had become somebody else's wreck.

## The shortcuts go beyond invulnerability

Alt-I is the straightforward invulnerability shortcut. Other handlers are more interesting to trace than a conventional infinite-ammunition code.

Hold H with R, G or B in the cockpit and the palette counters change. H+1 and H+2 can commit altered sky or ground colours into the live world header. The normal save path can then preserve them in the working world, `3UNIV.DAT`, and a pilot's saved theatre can carry that world onward. The shortcuts do not immediately rewrite every distributed map, and they are not a global graphics preference.

There is also a developer world-copy operation behind a command-line flag, an Other Worlds flight recorder, and F10's congratulations message. F10 does not actually complete an objective. It just says the nice thing.

The older protection machinery has a less friendly sense of humour. A source branch for a player doing too well during the trial heads to `hosehim`, with the comment “hose this guy, he's too good!”. It writes a deliberately negative collision radius into a survey object. The consumer treats that value as a protection signal and leaves through a critical-error path instead of saving normally.

We checked the trap prefixes in the original binaries. The older 1.20 build contains both producers; normal 3.42 retains the consumer without those producers. That is not evidence that retail 3.42 secretly punishes good flying. It is a particularly odd piece of history left in the code.

The [technical notes](https://lostengines.com/corncob/analysis/gameplay.html) keep the exact inputs, versions and limits of those checks. We are not claiming that every shortcut here was previously unknown; the interesting part was following what each one actually changes.

## Music, menus and a Friday afternoon

The music was not a set of recordings waiting to be copied. Corncob supplies AdLib note sequences and instrument banks. The same sequence with a different bank can sound different, and a replacement sequencer need not reproduce the original driver's timing.

For the Earth game's three pieces, we captured the bundled driver's register writes and synthesised them through Nuked OPL, keeping the native repeat boundaries. The [listening room](../music/) also has the three Other Worlds pieces rendered from their recovered sequences and bank through AdPlug. The page explains that difference; a pleasant-sounding export is not by itself proof that two playback methods agree.

The original manual credits Jim Collymore, also identified as James L. Collymore. Hearing the complete pieces while working through such a small game was a welcome reminder of how much of its atmosphere lives outside the polygons.

One other file was rather more personal. A surviving pilot was called Rainmaker. That was ours.

Its record retains a last-use / clock-check value. Running the original runtime's conversion against it corresponds to a DOS clock reading of **Friday, 28 June 2002, at 14:17:19**. That does not date the creation of the pilot or prove when a particular mission was finished. The individual theatre records do not preserve an equivalent date. But it was enough to turn an old directory into a recognisable afternoon.

Of course it was a Friday.

## Back in the cockpit

The investigation became a [native C++ reconstruction](https://github.com/Lost-Engines/corncob-cpp), bringing the original game and Other Worlds into one executable. A separate [Redux version](https://github.com/Lost-Engines/corncob-redux) gives it a larger view, configurable controls, smoother live movement and a few changes to the less forgiving original rules.

The source made this a much quicker reconstruction than we expected. It did not make the comparison work disappear. The moments when we could not get back into an aircraft, found the wrong weapon in White Sands, or thought a tower wall should hide its door were exactly the moments when the original game was most useful to have running beside us.

There is no need to read assembly to enjoy the results. [Look around an airfield](../atlas/?world=training&amp;view=3d), [meet the ground crew](../models/?model=7&amp;state=gesture), or [visit the slalom barn](../models/?bank=source_variants&amp;model=source-farm). The shapes are tiny. They have quite a lot to say.

<div class="aside"><strong>About this account.</strong> The executable comparisons, decoded resources, source references and controlled checks are collected in the <a href="https://lostengines.com/corncob/">full research archive</a>. The viewers here are adapted displays, not emulations of the whole game. We have kept uncertain interpretations—such as the pond and the role of the slalom traffic—separate from things confirmed by code or original execution.</div>
