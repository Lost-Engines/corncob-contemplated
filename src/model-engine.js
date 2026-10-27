// Adapted from our Corncob research viewer. Original geometry, painter lists and colour rules are retained.
const corncobEgaPalette = [[0,0,0],[0,0,170],[0,170,0],[0,170,170],[170,0,0],[170,0,170],
    [170,85,0],[170,170,170],[85,85,85],[85,85,255],[85,255,85],[85,255,255],
    [255,85,85],[255,85,255],[255,255,85],[255,255,255]];

function corncobModelColourValues(profile, seconds, quality, object) {
    const frame = Math.max(0, Math.floor(seconds * profile.preview_frames_per_second));
    const ticks = Math.floor(seconds * profile.clock_hz / profile.timer_divisor) & 65535;
    // Jump directly to this preview frame in the original multiplicative PRNG.
    // This makes the shared random colour independent of gallery draw order.
    let seed = profile.random.seed, factor = profile.random.multiplier;
    for (let power = frame + 1; power; power = Math.floor(power / 2)) {
        if (power % 2) seed = Math.imul(seed, factor) >>> 0;
        factor = Math.imul(factor, factor) >>> 0;
    }
    const random = (seed >>> 16) % 15, values = new Map();
    for (const rule of profile.rules) {
        if (rule.types && !rule.types.includes(object.type)) continue;
        let value;
        switch (rule.kind) {
        case 'random': value = random; break;
        case 'alternate': value = rule.values[frame % 2]; break;
        case 'radar': value = rule.values[object.radar_active !== false && (ticks & rule.mask) ? 1 : 0]; break;
        case 'flag_blink': value = rule.values[(object.flags & rule.flag_mask) && (ticks & rule.mask) ? 1 : 0]; break;
        case 'quality':
        case 'quality_random':
            value = rule.values[quality];
            if ((rule.kind === 'quality_random' && value >= 32768) || rule.random_types?.includes(object.type)) value = random;
            break;
        default: throw Error('Unknown model colour rule: ' + rule.kind);
        }
        values.set(rule.address, value);
    }
    return values;
}

function corncobModelHasColourVariants(profile, geometry, object) {
    if (!profile) return false;
    const addresses = new Set(geometry.colourBindings.map(binding => binding.address));
    return profile.rules.some(rule => addresses.has(rule.address) &&
        rule.kind.startsWith('quality') &&
        (!rule.types || rule.types.includes(object.type)) &&
        !rule.random_types?.includes(object.type) &&
        new Set(rule.values.map(value => rule.kind === 'quality_random' && value >= 32768
            ? 'random' : value & 15)).size > 1);
}

// Source-only appearances have separate bindings; native runtime metadata stays
// usable by the executable asset importer without preview-only object types.
function corncobColourProfile(modelData, object) {
    return object.source_only ? modelData.source_colours || modelData.runtime_colours
        : modelData.runtime_colours;
}

// A thumbnail advertises the object's available choices, even when the
// current pose/detail or neutral shading hides those choices in the preview.
function corncobModelHasAvailableColourVariants(modelData, object) {
    const profile = corncobColourProfile(modelData, object);
    if (!profile) return false;
    const states = object.states?.length ? object.states : [object];
    return states.some(state => {
        const appearance = {...object, ...state};
        const primitiveIds = new Set(appearance.model_variants.flatMap(key =>
            modelData.models[key].octants.flat().map(command => command.primitive)));
        const colourBindings = [...primitiveIds].flatMap(key => {
            const primitive = modelData.primitives[key];
            return [primitive.colour, ...(primitive.points || []).map(p => p.colour),
                ...(primitive.lines || []).map(line => line.colour)]
                .filter(colour => colour?.indirect)
                .map(colour => ({address: colour.word}));
        });
        return corncobModelHasColourVariants(profile,
            {colourBindings}, appearance);
    });
}

function corncobApplyModelColours(geometry, values) {
    let changed = false;
    for (const {vertices, offset, address} of geometry.colourBindings) {
        if (!values.has(address)) continue;
        const rgb = corncobEgaPalette[values.get(address) & 15];
        for (let i = 0; i < 3; i++) {
            const value = Math.fround(rgb[i] / 255);
            if (vertices[offset + i] !== value) {
                vertices[offset + i] = value;
                changed = true;
            }
        }
    }
    if (changed) geometry.colourRevision = (geometry.colourRevision || 0) + 1;
}

// The original list index packs the signs of (object - viewer), expressed in
// the model's axes: negative X/Y/Z contribute bits 4/2/1. Invert the preview's
// camera and pose rotations to obtain that direction in the same coordinates.
function corncobModelOctant(yaw, pitch, posePitch = 0, poseHeading = 0, poseRoll = 0) {
    const a = Math.cos(pitch), b = Math.sin(pitch);
    const relative = [a * Math.sin(yaw), a * Math.cos(yaw), -b];
    const angle = posePitch * 2 * Math.PI / 65536;
    const c = Math.cos(angle), s = Math.sin(angle);
    let local = [relative[0] * c - relative[2] * s, relative[1],
                 relative[0] * s + relative[2] * c];
    const roll=poseRoll*Math.PI/32768, heading=poseHeading*Math.PI/32768;
    local=[local[0],local[1]*Math.cos(roll)+local[2]*Math.sin(roll),
           local[2]*Math.cos(roll)-local[1]*Math.sin(roll)];
    local=[local[0]*Math.cos(heading)+local[1]*Math.sin(heading),
           local[1]*Math.cos(heading)-local[0]*Math.sin(heading),local[2]];
    // Exact axis views must not pick a side from floating-point sine residue.
    return (local[0] < -1e-9 ? 4 : 0) | (local[1] < -1e-9 ? 2 : 0) |
           (local[2] < -1e-9 ? 1 : 0);
}

function corncobModelRenderer(canvas) {
    const gl = canvas.getContext('webgl', {antialias: false});
    if (!gl) return null;

    const vertexSource = `
        attribute vec3 position;
        attribute vec3 colour;
        attribute float diameter;
        attribute vec3 lineEnd;
        attribute vec2 lineCorner;
        uniform mat3 rotation;
        uniform bool thickLines;
        uniform vec2 viewport;
        uniform float lineWidth;

        uniform float scale;
        uniform float aspect;
        uniform float height;
        varying vec3 vColour;
        void main() {
            vec3 p = rotation * position;
            gl_Position = vec4(p.x * scale / aspect, p.y * scale, -p.z * .45, 1.);
            if (thickLines) {
                vec3 end = rotation * lineEnd;
                vec4 endClip = vec4(end.x * scale / aspect, end.y * scale, -end.z * .45, 1.);
                vec2 delta = (endClip.xy - gl_Position.xy) * viewport * .5;
                float distance = length(delta);
                vec2 along = distance > .0001 ? delta / distance : vec2(1., 0.);
                vec2 across = vec2(-along.y, along.x);
                // Square caps overlap at connected endpoints, avoiding gaps.
                vec2 offset = (across * lineCorner.y + along * (lineCorner.x * 2. - 1.)) * lineWidth * .5;
                gl_Position = mix(gl_Position, endClip, lineCorner.x);
                gl_Position.xy += offset * 2. / viewport;
            }
            // Clip-space Y spans two units; the stored size is a diameter.
            gl_PointSize = max(2., diameter * scale * height * .5);
            vColour = colour;
        }
    `;
    const fragmentSource = `
        precision mediump float;
        varying vec3 vColour;
        uniform bool discs;
        void main() {
            if (discs && length(gl_PointCoord - vec2(.5)) > .5) discard;
            gl_FragColor = vec4(vColour, 1.);
        }
    `;
    function shader(type, source) {
        const result = gl.createShader(type);
        gl.shaderSource(result, source);
        gl.compileShader(result);
        if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
            throw Error(gl.getShaderInfoLog(result));
        }
        return result;
    }
    const vertexShader = shader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = shader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw Error(gl.getProgramInfoLog(program));
    }
    gl.useProgram(program);
    const attrs = ['position', 'colour', 'diameter', 'lineEnd', 'lineCorner'].map(n => gl.getAttribLocation(program, n));
    const uniforms = Object.fromEntries(['rotation', 'scale', 'aspect', 'height', 'discs', 'thickLines', 'viewport', 'lineWidth']
        .map(n => [n, gl.getUniformLocation(program, n)]));
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const referenceViewportWidth = 320;
    const vertexFields = [
        {size: 3, offset: 0},   // Position / line start.
        {size: 3, offset: 12},  // Colour.
        {size: 1, offset: 24},  // Disc diameter.
        {size: 3, offset: 28},  // Line end.
        {size: 2, offset: 40},  // Along/across corner of the line quad.
    ];
    // These assets were authored for a painter renderer, including repeated
    // surfaces and coplanar details. Their original command order resolves
    // visibility; depth testing would reintroduce flicker and hide overlays.
    gl.disable(gl.DEPTH_TEST);
    // Normal grass/ground colour: EGA index 2.
    gl.clearColor(...corncobEgaPalette[2].map(v => v / 255), 1);

    return {
        draw(geometry, width, height, yaw, pitch, zoom) {
            if (canvas.width !== width) canvas.width = width;
            if (canvas.height !== height) canvas.height = height;
            gl.viewport(0, 0, width, height);
            gl.clear(gl.COLOR_BUFFER_BIT);
            const c = Math.cos(yaw), s = Math.sin(yaw);
            const a = Math.cos(pitch), b = Math.sin(pitch);
            gl.uniformMatrix3fv(uniforms.rotation, false,
                new Float32Array([c, b*s, -a*s, 0, a, b, s, -b*c, a*c]));
            gl.uniform1f(uniforms.scale, zoom);
            gl.uniform1f(uniforms.aspect, width / height);
            gl.uniform1f(uniforms.height, height);
            gl.uniform2f(uniforms.viewport, width, height);
            // One pixel at a 320px reference width, with a one-CSS-pixel
            // minimum so thumbnails stay legible on high-density displays.
            gl.uniform1f(uniforms.lineWidth,
                Math.max(window.devicePixelRatio || 1, width / referenceViewportWidth));
            const octant = corncobModelOctant(yaw, pitch, geometry.pitch_u16 || 0, geometry.heading_u16 || 0, geometry.roll_u16 || 0);
            const batches = geometry.octants ? geometry.octants[octant] : geometry.batches;
            for (const [mode, vertices, discs] of batches) {
                const lines = mode === 'LINES';
                const stride = lines ? 12 : 7;
                gl.uniform1i(uniforms.discs, discs ? 1 : 0);
                gl.uniform1i(uniforms.thickLines, lines ? 1 : 0);
                gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
                for (let i = 0; i < attrs.length; i++) {
                    if (i >= 3 && !lines) {
                        gl.disableVertexAttribArray(attrs[i]);
                        continue;
                    }
                    const field = vertexFields[i];
                    gl.enableVertexAttribArray(attrs[i]);
                    gl.vertexAttribPointer(attrs[i], field.size, gl.FLOAT, false,
                        stride * Float32Array.BYTES_PER_ELEMENT, field.offset);
                }
                // WebGL implementations often clamp native lines to one pixel.
                // Draw expanded segments as triangles in their original order.
                gl.drawArrays(lines ? gl.TRIANGLES : gl[mode], 0, vertices.length / stride);
            }
        },
        dispose() {
            gl.deleteBuffer(buffer);
            gl.deleteProgram(program);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            gl.getExtension('WEBGL_lose_context')?.loseContext();
        },
    };
}

function corncobModelGeometry(modelData, object, lod, colourMode, bounds = null) {
    const model = modelData.models[object.model_variants[lod]];
    function primitivesFor(model) {
        return [...new Set(model.octants.flatMap(c => c.map(x => x.primitive)))]
            .map(k => modelData.primitives[k]);
    }
    function posed(position, state) {
        if (state.heading_u16 || state.roll_u16) {
            const heading=(state.heading_u16||0)*Math.PI/32768, roll=(state.roll_u16||0)*Math.PI/32768;
            const [x,y,z]=position, c=Math.cos(heading),s=Math.sin(heading);
            const a=x*c-y*s,b=x*s+y*c;
            position=[a,b*Math.cos(roll)-z*Math.sin(roll),b*Math.sin(roll)+z*Math.cos(roll)];
        }
        if (!state.pitch_u16) return position;
        const angle = state.pitch_u16 * 2 * Math.PI / 65536;
        const c = Math.cos(angle), s = Math.sin(angle);
        return [position[0] * c + position[2] * s, position[1],
                position[2] * c - position[0] * s];
    }
    const primitives = primitivesFor(model);
    const positions = [];
    // Frame all poses together so changing state does not rescale the model.
    for (const state of object.states?.length ? object.states : [object]) {
        const parts = primitivesFor(modelData.models[state.model_variants[lod]]);
        for (const p of parts) {
            positions.push(...(p.vertices || []).map(v => posed(v, state)));
            for (const v of p.points || []) {
                const radius = (v.diameter || 0) / 2;
                const centre = posed(v.position, state);
                positions.push(centre.map(x => x - radius), centre.map(x => x + radius));
            }
            for (const line of p.lines || []) {
                for (const segment of line.segments) positions.push(...segment.map(v => posed(v, state)));
            }
        }
    }
    const centre = bounds?.centre || [0, 1, 2].map(i => positions.length
        ? (Math.min(...positions.map(v => v[i])) + Math.max(...positions.map(v => v[i]))) / 2
        : 0);
    const extent = bounds?.extent || Math.max(1, ...positions.map(v => Math.hypot(...v.map((x, i) => x - centre[i]))));
    const normalise = position => {
        const v = posed(position, object);
        return [(v[0] - centre[0]) / extent, (v[2] - centre[2]) / extent,
                -(v[1] - centre[1]) / extent];
    };
    const colourBindings = [], colourOffsets = new Map();
    const colour = (c, shade = 1) => colourMode === 'neutral'
        ? [.55 * shade, .64 * shade, .59 * shade] : corncobEgaPalette[c.index & 15].map(v => v / 255);
    function vertex(array, position, rgb, diameter = 0, source = null) {
        const offset = array.length + 3;
        array.push(...normalise(position), ...rgb, diameter / extent);
        if (colourMode !== 'neutral' && source?.indirect) {
            if (!colourOffsets.has(array)) colourOffsets.set(array, []);
            colourOffsets.get(array).push({offset, address: source.word});
        }
    }
    function batch(mode, array, discs) {
        const vertices = new Float32Array(array);
        for (const binding of colourOffsets.get(array) || []) colourBindings.push({vertices, ...binding});
        return [mode, vertices, discs];
    }
    function primitiveBatches(p) {
        const triangles = [], lines = [], points = [];
        if (p.kind === 8 && p.vertices.length >= 3) {
            const [a, b, c] = p.vertices;
            const u = b.map((x, i) => x - a[i]), v = c.map((x, i) => x - a[i]);
            const n = [u[1]*v[2] - u[2]*v[1], u[2]*v[0] - u[0]*v[2], u[0]*v[1] - u[1]*v[0]];
            const length = Math.hypot(...n) || 1;
            const shade = .5 + .5 * Math.abs((n[0]*.3 + n[1]*.4 + n[2]*.86) / length);
            const rgb = colour(p.colour, shade);
            for (let i = 1; i + 1 < p.vertices.length; i++) {
                for (const pos of [a, p.vertices[i], p.vertices[i + 1]]) vertex(triangles, pos, rgb, 0, p.colour);
            }
        }
        for (const line of p.lines || []) {
            for (const [start, end] of line.segments) {
                // Each segment has six corners; the shader expands them in
                // screen space after rotation, keeping stroke width constant.
                for (const [along, across] of [[0, -1], [1, -1], [1, 1], [0, -1], [1, 1], [0, 1]]) {
                    vertex(lines, start, colour(line.colour), 0, line.colour);
                    lines.push(...normalise(end), along, across);
                }
            }
        }
        for (const point of p.points || []) {
            vertex(points, point.position, colour(point.colour), point.diameter || extent * .008, point.colour);
        }
        return [
            batch('TRIANGLES', triangles, false),
            batch('LINES', lines, false),
            batch('POINTS', points, true),
        ].filter(([, vertices]) => vertices.length);
    }
    const batches = new Map(primitives.map(p => [p, primitiveBatches(p)]));
    return {
        model,
        primitiveCount: primitives.length,
        colourBindings,
        pitch_u16: object.pitch_u16 || 0,
        heading_u16: object.heading_u16 || 0,
        roll_u16: object.roll_u16 || 0,
        centre, extent,
        // Preserve omissions, repeats and interleaved primitive kinds. A union
        // or one global batch per kind changes the model's authored layering.
        octants: model.octants.map(commands => commands.flatMap(command =>
            batches.get(modelData.primitives[command.primitive]))),
    };
}

function corncobRuntimeFrame(models, seconds) {
    const profile=models.runtime_animation;
    if(!profile)return {data:models,changed:new Set()};
    const phase=Math.floor(seconds*profile.preview_frames_per_second)&65535;
    const values=new Map(), wave=profile.cosine_quarter_wave;
    function cosine(angle){let a=(angle+16384)&65535;const negative=!!(a&32768);if(!(a&32767))return 0;if(negative)a=(-a)&65535;if(a&16384)a=32768-a;const index=a>>6,fraction=a&63;const v=(wave[index]+Math.floor((wave[index+1]-wave[index])*fraction/64))>>>1;return negative?-v:v}
    for(const recipe of profile.forcefields){let value=Math.floor(cosine(phase*recipe.multiplier)*recipe.amplitude/32768)+recipe.offset;value=value===0?1:value<0?recipe.upper:value;for(const dest of recipe.destinations)values.set(dest.address,value*dest.sign*dest.scale)}
    const swing=Math.floor(cosine(phase*3111)*333/32768);
    profile.saucer_pulse_addresses.forEach((a,i)=>values.set(a,999+(i?-swing:swing)));
    const particles=profile.particle_frames[phase%profile.particle_frames.length];
    profile.particle_addresses.forEach((address,i)=>values.set(address,particles[i]));
    const primitives={...models.primitives},changed=new Set();
    for(const [address,value] of values){for(const [key,...path] of profile.bindings[address]||[]){if(!changed.has(key)){primitives[key]=structuredClone(primitives[key]);changed.add(key)}let target=primitives[key];for(const field of path.slice(0,-1))target=target[field];target[path.at(-1)]=value}}
    return {data:{...models,primitives},changed};
}

export { corncobEgaPalette, corncobModelRenderer, corncobModelGeometry, corncobRuntimeFrame, corncobModelColourValues, corncobApplyModelColours, corncobColourProfile, corncobModelHasAvailableColourVariants };
