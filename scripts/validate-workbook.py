"""Extract reference formulas and create synthetic recalculation fixtures.
Usage: python scripts/validate-workbook.py /path/to/unchanged-source.xlsx /path/to/workdir
Requires openpyxl and LibreOffice. Never modifies the supplied source workbook.
"""
import sys,json,hashlib,subprocess
from pathlib import Path
import openpyxl
source=Path(sys.argv[1]).resolve();work=Path(sys.argv[2]).resolve()
for name in ['input','recalculated']: (work/name).mkdir(parents=True,exist_ok=True)
w=openpyxl.load_workbook(source);s=w.active
sections=[(21,25,26,27,'F6',18),(35,37,38,39,'H6',32),(44,46,47,48,'J6',41)]
fields={'department':'C1','date':'N1','manufacturer':'D2','year':'I2','apparatus':'N2','makeModel':'E3','serial':'N3','engine':'D4','displacement':'J4','bhp':'M4','bhpRpm':'O4','pump':'D5','pumpSerial':'J5','torque':'M5','torqueRpm':'O5','ratio150':'F6','ratio200':'H6','ratio250':'J6','gear150':'F7','gear200':'H7','gear250':'J7','control150':'H8','control90':'K8','control250':'N8','req100':'E9','req70':'E10','req50':'E11','tester':'N9','location':'N10','elevation':'L11','waterTemp':'N11','airTemp':'P11','barometer':'N12','hoseSize':'D13','hoseLength':'G13','lift':'J13','suctionTime':'O13','governedSpecified':'F14','governedRecorded':'I14','vacuumDrop':'O14','speedLocation':'I15','takenWith':'N15','counterRatio':'F16','tankGallons':'K16','tankGpm':'O16','excessGpm':'C29','excessNpp':'E29','excessTime':'B30','excessPitot':'F30','excessActualCounter':'J30','excessApparatusTach':'O30','comments':'C62','signature':'H64','title':'N64'}
paths={'values.'+k:v for k,v in fields.items()};paths['values.source']=['D12 (Draft)','F12 (Hydrant)'];paths['values.counterMode']='A16 (ENGINE or PUMP label only)'
raw={'A':'time','D':'apparatusTach','E':'apparatusPressure','F':'testPressure','G':'suction','H':'pitot','I':'gpm','J':'voltage','K':'transTemp','L':'oilPressure','M':'waterTemp','O':'actualCounter'}
for i,(first,last,total,avg,ratio,layout) in enumerate(sections):
 for key,col in [('layout','D' if i==1 else 'C'),('tip','H'),('nozzle','K'),('targetGpm','M'),('position','O')]:paths[f'tests.{i}.{key}']=col+str(layout)
 for j,row in enumerate(range(first,last+1)):
  for col,key in raw.items():paths[f'tests.{i}.rows.{j}.{key}']=f'{col}{row}'
formulas={c.coordinate:c.value for row in s for c in row if c.data_type=='f'}
ref={'source':{'file':source.name,'sheet':s.title,'sha256':hashlib.sha256(source.read_bytes()).hexdigest()},'formulaCount':len(formulas),'formulas':formulas,'inputCells':paths,'appOnlyFields':['excessNotes','overallResult','resultNotes'],'orientation':s.page_setup.orientation,'printArea':str(s.print_area),'mergedCells':[str(r) for r in s.merged_cells.ranges],'note':'No fixed print area, paper size, fit-to-page setting, or manual page breaks in source. Report preserves source order/tables, paginated for letter-size readability.'}
Path('tests/fixtures/workbook-reference.json').write_text(json.dumps(ref,indent=2)+'\n')
fixtures=[]
for name in ['filled','partial','blank','zeros','blank-ratios','signed-fractional']:
 wb=openpyxl.load_workbook(source);sheet=wb.active;values={'counterRatio':'2.5','ratio150':'1.2','ratio200':'1.35','ratio250':'1.5','excessActualCounter':'978.4'};tests=[]
 for i,(first,last,*_) in enumerate(sections):
  t={'layout':f'Synthetic layout {i+1}','tip':str(2.5-i*.25),'nozzle':str(60+i),'targetGpm':str(1500-i*350),'position':['Single','Parallel','Series'][i],'rows':[]}
  for j,row in enumerate(range(first,last+1)):
   r={k:str(40+17*i+3*j+n/10) for n,k in enumerate(raw.values()) if k!='time'};r['time']=f'08:{10+5*j:02d}';r['actualCounter']=str(800+i*100+j*23.25)
   if name=='partial' and j>0:r={}
   if name=='blank':r={}
   if name=='zeros':r={k:'0' for k in r if k!='time'}
   if name=='signed-fractional':r['suction']=str(-4.75-j/8);r['actualCounter']=str(888.125+j/16)
   t['rows'].append(r)
  tests.append(t)
 if name=='blank':values={}
 if name=='blank-ratios':values.pop('counterRatio');values.pop('ratio200')
 if name=='zeros':values.update({'counterRatio':'0','ratio150':'0','excessActualCounter':'0'})
 record={'id':'fixture-'+name,'created':'2026-06-01T00:00:00Z','calculationVersion':'workbook-june2026-v1','values':values,'tests':tests}
 for path,cell in paths.items():
  if not isinstance(cell,str) or '(' in cell:continue
  obj=record
  for key in path.split('.'):
   obj=obj[int(key)] if isinstance(obj,list) else obj.get(key) if isinstance(obj,dict) else None
   if obj is None:break
  # Blank source defaults in each synthetic fixture, then write only actual input values.
  sheet[cell]=float(obj) if obj is not None and path.split('.')[-1] not in ['time','layout','position','date'] and str(obj).replace('.','',1).replace('-','',1).isdigit() else obj
 path=work/'input'/f'{name}.xlsx';wb.save(path)
 fixtures.append({'name':name,'record':record})
cmd=['soffice','-env:UserInstallation=file:///tmp/pump-workbook-lo','--headless','--convert-to','xlsx','--outdir',str(work/'recalculated')]+[str(p) for p in sorted((work/'input').glob('*.xlsx'))]
subprocess.run(cmd,check=True)
for fixture in fixtures:
 cached=openpyxl.load_workbook(work/'recalculated'/(fixture['name']+'.xlsx'),data_only=True).active
 fixture['expected']={cell:cached[cell].value for cell in formulas}
# The original caches additionally exercise the template's text tip size (2")
# and establish blank/zero behavior without depending on the recalculation engine.
cached_source=openpyxl.load_workbook(source,data_only=True).active
original_tests=[]
for i,(first,last,total,avg,ratio,layout) in enumerate(sections):
 t={key:s[col+str(layout)].value for key,col in [('layout','D' if i==1 else 'C'),('tip','H'),('nozzle','K'),('targetGpm','M'),('position','O')]}
 t['rows']=[{} for _ in range(first,last+1)];original_tests.append(t)
fixtures.append({'name':'source-cached-template','engine':'original uploaded workbook cached values','record':{'id':'fixture-source-template','calculationVersion':'workbook-june2026-v1','values':{},'tests':original_tests},'expected':{cell:cached_source[cell].value for cell in formulas}})
Path('tests/fixtures/workbook-cases.json').write_text(json.dumps({'engine':'LibreOffice recalculation of synthetic copies of source workbook','cases':fixtures},indent=2)+'\n')
print(f'{len(fixtures)} fixtures; {len(formulas)} formulas each; source SHA256 {ref["source"]["sha256"]}')
