#!/usr/bin/env python3
"""Make browser listening copies from the documented analysis FLAC exports."""
import concurrent.futures,hashlib,json,subprocess,sys
from pathlib import Path
site=Path(__file__).resolve().parents[1];source=Path(sys.argv[1]).resolve()
D=json.loads((source/'analysis/resources/index.json').read_text())
names=['destiny3','ridingt','dreamso2','voyage3','heavens','daybreak'];selected=[]
for name in names:
 match=next(x for x in D['audio'] if Path(x['song']).stem.lower()==name and ('c95a84ee' in x['file'] if name in names[:3] else True));selected.append((name,match))
def convert(item):
 name,record=item;input=source/'analysis/resources'/record['file'];output=site/'public/audio'/(name+'.mp3')
 output.parent.mkdir(parents=True,exist_ok=True)
 subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(input),'-map_metadata','-1','-codec:a','libmp3lame','-q:a','3',str(output)],check=True)
 return {'name':name,'file':'audio/'+output.name,'input':str(input.relative_to(source)),'input_sha256':hashlib.sha256(input.read_bytes()).hexdigest(),'seconds':record['seconds'],'method':record.get('renderer'),'encoding':'MP3 VBR quality 3, without gain changes'}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:result=list(pool.map(convert,selected))
(site/'content/audio-provenance.json').write_text(json.dumps(result,indent=2)+'\n');print('Prepared six listening copies')
