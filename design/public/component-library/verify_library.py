#!/usr/bin/env python3
"""Basic offline validation without installing Python dependencies."""
import json, pathlib
here=pathlib.Path(__file__).resolve().parent
lib=json.loads((here/'components.json').read_text('utf-8'))
assert lib['units']=='millimeters'
assert lib['component_count']==len(lib['components'])==8
ids=[part['id'] for part in lib['components']]
assert len(set(ids))==len(ids)
dxfs=[]
for part in lib['components']:
    assert part['mounting']['physical_fit_tested'] is False
    assert part['sources']
    dxf=part['mounting']['cutout_dxf_file']
    if dxf:
        assert part['mounting']['cutout'] is not None
        assert (here/dxf).is_file(), dxf
        dxfs.append(dxf)
    else:
        assert part['mounting']['cutout'] is None
    if part['mounting']['mounting_holes'] is not None:
        holes=part['mounting']['mounting_holes']
        if not holes.get('alignment_verified', False):
            assert holes.get('centers_xy_mm') is None
assert len(dxfs)==2
print('OK: 8 entries, 2 nominal DXFs, 6 geometry-pending entries, no fit-tested claims')
