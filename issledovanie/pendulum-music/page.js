/* One audible source at a time, preserving each player's position. */
(()=>{
  'use strict';
  const media=[...document.querySelectorAll('audio,video')];
  for(const item of media)item.addEventListener('play',()=>{for(const other of media)if(other!==item)other.pause();});
  addEventListener('pagehide',()=>{for(const item of media)item.pause();});
})();
