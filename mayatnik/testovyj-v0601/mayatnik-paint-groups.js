/* Independent paint colours. Legacy work inherits its old fill colour once. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikPaintGroups=api;})(globalThis,function(){
  'use strict';
  const FIELDS=Object.freeze(['verticalFillColour','stolbFillColour','axesFillColour','autoFillColour','growFillColour','meetFillColour','axisFillColour']);
  const GROUPS=Object.freeze({fill:['fillColour'],vertical:['verticalFillColour'],pass:['stolbFillColour'],centre:['midOneColour','midZeroColour'],axes:['axesFillColour'],auto:['autoFillColour'],grow:['growFillColour'],meet:['meetFillColour'],pointAxis:['axisFillColour']});
  const valid=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
  const colour=(value,fallback='#ff7f27')=>valid(value)?value.toLowerCase():valid(fallback)?fallback.toLowerCase():'#ff7f27';
  function initialise(state,legacy){const inherited=colour(legacy);for(const key of FIELDS)state[key]=colour(state[key],inherited);return state;}
  function palette(state,base){const first=colour(state.autoFillColour);if(state.autoFillPalette===false)return [first];const list=[...new Set(base.map(c=>colour(c)))],at=list.indexOf(first);return at<0?[first,...list]:[...list.slice(at),...list.slice(0,at)];}
  function grow(state,source,encode){return state.growOwnColour?encode(colour(state.growFillColour)):source;}
  function defaults(group){const values={};for(const key of GROUPS[group]||[])values[key]=key==='midZeroColour'?'#4f9bff':'#ff7f27';if(group==='auto')values.autoFillPalette=true;if(group==='grow')values.growOwnColour=false;return values;}
  return Object.freeze({FIELDS,GROUPS,colour,initialise,palette,grow,defaults});
});
