importScripts('hub-composite-symmetry.js?v=182');
onmessage=({data:{key,rows,geometry,options}})=>postMessage({key,result:HubCompositeSymmetry.compute(rows,geometry,options)});
