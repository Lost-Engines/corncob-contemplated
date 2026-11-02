#!/usr/bin/env python3
"""Record small article datasets by executing original Corncob 3.42 routines.

Optional authoring tool: needs Unicorn and sibling research/reconstruction checkouts.
The static site only reads the committed JSON; no executable is published.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cpp', type=Path, default=ROOT.parent / 'corncob-cpp')
parser.add_argument('--analysis', type=Path, default=ROOT.parent / 'corncob-reverse')
args = parser.parse_args()
sys.path.insert(0, str(args.cpp.resolve() / 'tools'))
from generate_native_reference import load, run, LOAD_ADDRESS, DATA_ADDRESS, EXPECTED_SHA256
from generate_flight_reference import put
from generate_control_reference import matrix
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_AX, UC_X86_REG_BX, UC_X86_REG_SI, UC_X86_REG_DI, UC_X86_REG_IP, UC_X86_REG_EFLAGS

exe = (args.analysis / 'installs/deluxe_dnk/3.EXE').read_bytes()
assert hashlib.sha256(exe).hexdigest() == EXPECTED_SHA256

def get(native, offset, fmt):
    return list(struct.unpack('<' + fmt, native.mem_read(DATA_ADDRESS + offset, struct.calcsize('<' + fmt))))

def forces(velocity=(5000, 0, -1000), throttle=200, flaps=False, altitude=0, density=5957, old_density=None):
    native = load(exe)
    for address in (0xcc91, 0xe0e9, 0xe0ce):
        native.mem_write(LOAD_ADDRESS + address - 512, b'\xc3')
    for address in (0x1d36, 0x1d48):
        native.mem_write(DATA_ADDRESS + address, struct.pack('<9h', *(32767 if i in (0, 4, 8) else 0 for i in range(9))))
    native.mem_write(DATA_ADDRESS + 0x1dc2, struct.pack('<3h', *velocity))
    if old_density is None: old_density = density
    for address, value in ((0x1de2, throttle), (0x1ddc, -48), (0x1e1c, density), (0x1e1e, 5957),
                           (0x1e20, old_density), (0x1e34, 0), (0x1e5e, 5), (0x1b7f, 5), (0x1de, 0)):
        put(native, address, value)
    for address, value in ((0xf59, flaps), (0xf77, 0), (0x19f3, 0)):
        put(native, address, int(value), 'B')
    put(native, 0xe93, altitude, 'I')
    native.emu_start(LOAD_ADDRESS + 0x37d0 - 512, LOAD_ADDRESS + 0x3c0c - 512, count=100000)
    assert native.reg_read(UC_X86_REG_IP) == 0x3c0c - 512
    return {'force': get(native, 0x1d90, '3i'), 'velocity': get(native, 0x1dc2, '3h'),
            'density': get(native, 0x1e20, 'H')[0], 'power': get(native, 0x1e24, 'H')[0],
            'alpha': get(native, 0x1e34, 'h')[0], 'stalled': bool(get(native, 0x1df0, 'h')[0])}

def controls(speed=5000, throttle=200, beginner=False, roll_input=0, density=5957):
    native = load(exe)
    for address in (0x1492, 0xcc91):
        native.mem_write(LOAD_ADDRESS + address - 512, b'\xc3')
    native.mem_write(LOAD_ADDRESS + 0x627 - 512, b'\xc3')
    native.hook_add(UC_HOOK_CODE, lambda uc, a, n, _: uc.reg_write(UC_X86_REG_AX, 0),
                    begin=LOAD_ADDRESS + 0x627 - 512, end=LOAD_ADDRESS + 0x627 - 512)
    angles = (0, 0, 0)
    matrix(native, angles, 0x1d24)
    matrix(native, angles, 0x1d36, False)
    native.mem_write(DATA_ADDRESS + 0xb11, struct.pack('<3H', *angles))
    native.mem_write(DATA_ADDRESS + 0xe97, struct.pack('<3H', *angles))
    velocity = (speed, 0, -1000)
    for address in (0x1d9c, 0x1dc2): native.mem_write(DATA_ADDRESS + address, struct.pack('<3h', *velocity))
    native.mem_write(DATA_ADDRESS + 0x1dc8, struct.pack('<3h', *(v >> 4 for v in velocity)))
    native.mem_write(DATA_ADDRESS + 0x1dde, bytes(native.mem_read(DATA_ADDRESS + 0x1d36 + 10, 2)))
    native.mem_write(DATA_ADDRESS + 0x1de0, bytes(native.mem_read(DATA_ADDRESS + 0x1d36 + 16, 2)))
    for address in (0x1dfe, 0x1dfa, 0x1e04): put(native, address, 0, 'I')
    for address, value in ((0x19fb, 0), (0x19fd, 0), (0x19ff, 0), (0x1e20, density),
                           (0x1e34, 0), (0x1e36, 0), (0x1e39, 0), (0x1e16, 2548), (0x1e10, 0),
                           (0x1e12, 2912), (0x1df0, 0), (0x1e5e, 5), (0x1b7f, 5), (0x1de2, throttle)):
        put(native, address, value)
    for address, value in ((0xf77, 0), (0xf53, 1), (0x1e38, 0), (0xf7b, 0), (0xafc, 0), (0xe59, 0), (0xe2e, 0), (0xaed, beginner)):
        put(native, address, int(value), 'B')
    native.reg_write(UC_X86_REG_AX, roll_input & 65535)
    native.reg_write(UC_X86_REG_BX, 0)
    native.emu_start(LOAD_ADDRESS + 0x31a7 - 512, LOAD_ADDRESS + 0x37d0 - 512, count=100000)
    assert native.reg_read(UC_X86_REG_IP) == 0x37d0 - 512
    return {'roll': get(native, 0x1dfe, 'i')[0], 'pitch': get(native, 0x1dfa, 'i')[0],
            'yaw': get(native, 0x1e04, 'i')[0], 'attitude': get(native, 0xb11, '3H')}

def wheels(degrees):
    native = load(exe)
    attitude = (0, 0, round(degrees * 65536 / 360) & 65535)
    matrix(native, attitude, 0x1d48)
    native.mem_write(DATA_ADDRESS + 0xe97, struct.pack('<3H', *attitude))
    run(native, 0x129a)
    assert not native.reg_read(UC_X86_REG_EFLAGS) & 1
    return {'roll': degrees, 'wheels': get(native, 0x1e42, '2h'), 'clearance': get(native, 0x1db0, 'h')[0]}

def braking(heading):
    native = load(exe)
    attitude = (heading, 0, 0)
    matrix(native, attitude, 0x1d48)
    native.mem_write(DATA_ADDRESS + 0xe97, struct.pack('<3H', *attitude))
    run(native, 0x129a)
    clearance = get(native, 0x1db0, 'h')[0]
    native.mem_write(DATA_ADDRESS + 0x1d9c, struct.pack('<3h', 5000, 0, 0))
    native.reg_write(UC_X86_REG_BX, 0x1d48); native.reg_write(UC_X86_REG_SI, 0x1d9c); native.reg_write(UC_X86_REG_DI, 0x1dc2)
    run(native, 0x581d)
    before = get(native, 0x1dc2, '3h')
    for address, value in ((0x2bb, 0), (0xe93, clearance + 90 - 100), (0x1dfe, 0)):
        put(native, address, value, 'I')
    for address, value in ((0x1de2, 20), (0x1e5e, 5), (0x1b7f, 5)): put(native, address, value)
    for address, value in ((0xf53, 1), (0xf77, 1), (0xf7b, 0), (0xf7a, 0)): put(native, address, value, 'B')
    native.mem_write(LOAD_ADDRESS + 0x2cf - 512, b'\xc3')
    native.hook_add(UC_HOOK_CODE, lambda uc, a, n, _: uc.reg_write(UC_X86_REG_AX, int(uc.reg_read(UC_X86_REG_AX) & 255 == 0x34)),
                    begin=LOAD_ADDRESS + 0x2cf - 512, end=LOAD_ADDRESS + 0x2cf - 512)
    native.mem_write(LOAD_ADDRESS + 0x1236 - 512, b'\xc3')
    run(native, 0x1805)
    return {'heading': heading, 'before': before, 'after': get(native, 0x1dc2, '3h')}

result = {'format': 'corncob-flight-article-1', 'reference_sha256': EXPECTED_SHA256,
          'scope': 'Original 3.42 arithmetic; isolated passes with fixed inputs, not complete trajectories. See content/flight-sources.md.'}
base = forces(velocity=(5000, 0, 0))['force'][2]
result['lift'] = []
for i in range(121):
    angle = i / 4
    velocity = (round(5000 * math.cos(math.radians(angle))), 0, -round(5000 * math.sin(math.radians(angle))))
    row = {'degrees': angle}
    for label, flap in [('clean', False), ('flaps', True)]:
        out = forces(velocity=velocity, flaps=flap)
        row[label] = {'force': out['force'][2] - base, 'stalled': out['stalled'], 'alpha': out['alpha']}
    result['lift'].append(row)
result['atmosphere'] = []
for altitude_m in range(0, 15501, 250):
    altitude = altitude_m * 100
    density = 5957 * max(0, 5957 - (altitude >> 8)) // 5957
    out = forces(altitude=altitude, old_density=density)
    result['atmosphere'].append({'metres': altitude_m, 'density': out['density'], 'power': out['power']})
result['control_speed'] = []
for speed in range(0, 9601, 200):
    result['control_speed'].append({'speed': speed,
       'sea': controls(speed=speed, roll_input=128)['roll'],
       'thin': controls(speed=speed, roll_input=128, density=3000)['roll']})
result['thrust_speed'] = []
for speed in range(0, 14001, 200):
    idle = forces(velocity=(speed, 0, 0), throttle=20)['force'][0]
    result['thrust_speed'].append({'speed': speed, 'thrust': forces(velocity=(speed, 0, 0))['force'][0] - idle})
result['engine_torque_probe'] = []
for beginner in (False, True):
    for speed in (1600, 5000, 9600):
        rows = [{'throttle': throttle, 'response': controls(speed=speed, throttle=throttle, beginner=beginner)} for throttle in (20, 100, 200)]
        assert all(row['response'] == rows[0]['response'] for row in rows)
        result['engine_torque_probe'].append({'beginner': beginner, 'speed': speed, 'rows': rows})
result['basic_forces'] = []
for label, options in [('full power', {}), ('idle', {'throttle': 20}), ('flaps', {'flaps': True}), ('high altitude', {'altitude': 1000000})]:
    result['basic_forces'].append({'label': label, **forces(**options)})
result['wheels'] = [wheels(angle) for angle in range(-50, 51)]
result['brakes'] = [braking(heading) for heading in (0, 16384)]
path = ROOT / 'public/data/flight-samples.json'
path.write_text(json.dumps(result, separators=(',', ':')) + '\n')
print(json.dumps({'output': str(path), 'bytes': path.stat().st_size,
 'lift_boundary_degrees': {key: next(r['degrees'] for r in result['lift'] if r[key]['stalled']) for key in ['clean', 'flaps']},
 'power_peak': max(result['atmosphere'], key=lambda v: v['power']), 'torque_comparisons': len(result['engine_torque_probe']),
 'baseline_velocities': {v['label']: v['velocity'] for v in result['basic_forces']}, 'brakes': result['brakes']}, indent=2))
