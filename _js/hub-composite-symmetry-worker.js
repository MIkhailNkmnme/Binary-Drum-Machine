importScripts('hub-composite-symmetry.js?v=180');
onmessage=({data:{key,rows,geometry,options}})=>postMessage({key,result:HubCompositeSymmetry.compute(rows,geometry,options)});
