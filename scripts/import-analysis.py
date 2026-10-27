#!/usr/bin/env python3
"""Refresh the public, standalone display snapshot from a complete analysis checkout."""
import hashlib,json,shutil,sys
from pathlib import Path
site=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]).resolve()
raw=source/'analysis/resources/index.json';data=json.loads(raw.read_text())
out=site/'public/data';out.mkdir(parents=True,exist_ok=True)
def write(name,value):
 (out/name).write_text(json.dumps(value,separators=(',',':'),ensure_ascii=False)+'\n')
labels={'deluxe_dnk':'Earth · retail 3.42','other_worlds_download':'Other Worlds · 3.42','shareware_1_20':'Early shareware · 1.20','source_variants':'Source experiments'}
banks=[]
for bank in data['models']:
 if bank['edition'] not in labels:continue
 bank=json.loads(json.dumps(bank))
 if bank['edition']=='source_variants':
  native=next(m['data'] for m in data['models'] if m['edition']=='deluxe_dnk')
  bank['data']['models']={**native['models'],**bank['data']['models']}
  bank['data']['primitives']={**native['primitives'],**bank['data']['primitives']}
 file='models-'+bank['edition']+'.json';write(file,bank['data'])
 banks.append({'id':bank['edition'],'name':labels[bank['edition']],'file':file})
map_names={'MORNING':'Atkinsville','DUSK':'Dusk','WASTELND':'Wasteland','WHTSANDS':'White Sands','EXP':'Arrakis','FLATLAND':'Flatland','ICEWORLD':'Ice World','MIDNIGHT':'Midnight','MILKRUN':'Milk Runs','MTUNIV':'Empty universe','NEWATKIN':'New Atkinsville','QUARI':'Quari','THIN':'Breathless','TUNDRA':'Tundra','DEMO1':'Recorded-demo world','DEFAULT':'Builder default'}
rules=json.loads((source/'analysis/gameplay/theatres.json').read_text())['worlds']
worlds=[]
for asset in data['assets']:
 if asset['category']!='worlds' or asset['metadata'].get('saved_campaign'):continue
 editions={s['edition'] for s in asset['sources']};name=asset['name'];stem=Path(name).stem.upper()
 if name=='Generated training — default':group='Training';bank='deluxe_dnk';id='training';title='Training ground'
 elif asset['id']=='training-slalom':group='Source experiment';bank='source_variants';id='slalom';title='The slalom course'
 elif name.endswith('.CCT') and 'deluxe_dnk' in editions:group='Earth';bank='deluxe_dnk';id=stem.lower();title=map_names[stem]
 elif name.endswith('.DEF') and 'other_worlds_download' in editions:group='Other Worlds & examples';bank='other_worlds_download';id='other-'+stem.lower();title=map_names[stem]
 else:continue
 m=asset['metadata'];brief=m.get('briefing') or {};sections=brief.get('sections',[])
 world={k:m[k] for k in ['origin_cm','tile_size_cm','tiles','slalom','source_only','type_names'] if k in m}
 world.update(id=id,name=title,group=group,bank=bank,source_name=name,briefing=brief,objects=[])
 anchors={a['object_index']:a for r in rules if r['sha256']==asset.get('sha256') for a in r['objective_anchors']}
 for obj in m['objects']:
  clean={k:obj[k] for k in ['index','type','name','position_cm','angles_u8','angles_u16','flags','model_id'] if k in obj}
  if 'model_id' not in clean:clean['model_id']=str(clean['type'])
  if obj['index'] in anchors:clean['objective']=anchors[obj['index']]
  world['objects'].append(clean)
 world['starts']=[s for section in sections for s in section.get('starts',[])]
 lines=sections[0]['text'].splitlines() if sections else []
 if lines and lines[0].startswith('X '):lines=lines[1:]
 world['introduction']=' '.join(line.strip() for line in lines[1:] if line.strip())
 file='world-'+id+'.json';write(file,world)
 worlds.append({'id':id,'name':title,'group':group,'bank':bank,'file':file,'objects':len(world['objects']),'starts':len(world['starts'])})
worlds.sort(key=lambda w:({'Earth':0,'Other Worlds & examples':1,'Training':2,'Source experiment':3}[w['group']],w['name']))
write('catalog.json',{'format':'corncob-public-1','types':data['types'],'banks':banks,'worlds':worlds})
provenance={'source':'https://github.com/Lost-Engines/corncob-reverse','analysis_index_sha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'scope':'Selected original world definitions and training/source experiments; three executable model banks and source-only appearances. Saved pilots and installations are not part of this public snapshot.','banks':banks,'worlds':worlds}
(site/'content/data-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
print(f'Imported {len(banks)} model collections and {len(worlds)} worlds')
