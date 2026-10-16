/* Hub v0.205: independent geometry locks, shared by pointer, wheel and animation. */
(() => {
  'use strict';
  const key='zerk_hub_locks',names=['zoom','turn','zero','one','pan','axis','depth'];
  let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(_){}
  const state=Object.fromEntries(names.map(n=>[n,saved[n]===true]));
  function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch(_){}window.dispatchEvent(new Event('hublocks'));}
  window.HubLocks={names,has:name=>state[name]===true,get all(){return names.every(n=>state[n]);},get any(){return names.some(n=>state[n]);},toggle(name){if(names.includes(name)){state[name]=!state[name];save();}},toggleAll(){const on=!this.all;for(const n of names)state[n]=on;save();}};
})();
