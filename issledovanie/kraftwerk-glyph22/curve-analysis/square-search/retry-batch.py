"""Bounded retry of unknown variants, preserving already validated witnesses."""
import argparse
import concurrent.futures
import importlib.util
import json
from pathlib import Path
import time

HERE=Path(__file__).resolve().parent

def load_solver():
    spec=importlib.util.spec_from_file_location('route_solver',HERE/'find-routes.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module

def worker(job):
    frame,slot,graph,seconds=job;solver=load_solver()
    result=solver.solve(graph,seconds=seconds,seed=106+frame*17+slot)
    result.update(frame=frame,slot=slot)
    return result

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);parser.add_argument('--out-dir',type=Path,required=True);parser.add_argument('--seconds',type=float,default=8);parser.add_argument('--workers',type=int,default=4)
    args=parser.parse_args();data=json.loads(args.source.read_text(encoding='utf-8'));jobs=[];existing={};solver=load_solver()
    for i,frame in enumerate(data['frames'],1):
        for slot,graph in enumerate(frame['glyphs'],1):
            filename=args.out_dir/f'frame-{i:02d}-glyph-{slot}.json'
            prior=json.loads(filename.read_text(encoding='utf-8')) if filename.exists() else {'status':'missing'}
            if prior['status']=='found':
                prior['componentCount']=1;existing[i,slot]=prior
            elif prior['status'] in ('disconnected_paint_graph','proven_disconnected'):
                prior=solver.solve(graph,seconds=.1);prior.update(frame=i,slot=slot);existing[i,slot]=prior
                filename.write_text(json.dumps(prior,ensure_ascii=False,indent=2),encoding='utf-8')
            else:jobs.append((i,slot,graph,args.seconds))
    started=time.monotonic()
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as pool:
        for result in pool.map(worker,jobs):
            i,slot=result['frame'],result['slot'];existing[i,slot]=result
            filename=args.out_dir/f'frame-{i:02d}-glyph-{slot}.json';filename.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
            print(f'{i:02d}/{slot}: {result["status"]}',flush=True)
    statuses=[r['status'] for r in existing.values()]
    report={'schemaVersion':1,'sourceFile':args.source.name,'secondsPerRetriedVariant':args.seconds,'retryWallSeconds':time.monotonic()-started,
      'model':'Filled square cells at active edge endpoints scaled2 plus edge midpoints. Paint even route positions only. Blank visits do not erase. Eight-neighbour moves. No direct H/V class change; oriented angle may be 0/45/90/135 degrees. Every target cell painted once; geometric segments do not repeat. Point intersections allowed.',
      'counts':{s:statuses.count(s) for s in sorted(set(statuses))},
      'frames':[{'index':i,'glyphs':[existing[i,slot] for slot in range(1,5)]} for i in range(1,len(data['frames'])+1)]}
    (args.out_dir/'batch.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report['counts']),flush=True)

if __name__=='__main__':main()
