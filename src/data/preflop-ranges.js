'use strict';

(function (root, factory) {
  const ranges = factory();
  if (typeof module === 'object' && module.exports) module.exports = ranges;
  else Object.assign(root, ranges);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const OPEN_RANGES = {
    UTG: '77+,AJs+,KQs,AQo+',
    'UTG+1': '66+,ATs+,KQs,AJo+,KQo',
    MP: '55+,A9s+,KTs+,QTs+,JTs,T9s,AJo+,KQo',
    LJ: '44+,A8s+,KTs+,QTs+,J9s+,T9s,98s,ATo+,KQo',
    HJ: '33+,A5s+,A8s+,K9s+,Q9s+,J9s+,T8s+,98s,87s,ATo+,KJo+,QJo',
    CO: '22+,A2s+,K7s+,Q8s+,J8s+,T8s+,97s+,86s+,76s,65s,A8o+,KTo+,QTo+,JTo',
    BTN: '22+,A2s+,K2s+,Q5s+,J7s+,T7s+,96s+,85s+,75s+,64s+,54s,A7o+,K9o+,Q9o+,J9o+,T9o',
    SB: '22+,A2s+,K5s+,Q8s+,J8s+,T8s+,97s+,86s+,76s,A8o+,KTo+,QTo+,JTo'
  };
  const ISO_RANGES = {
    UTG: '88+,AJs+,KQs,AQo+', MP: '66+,ATs+,KQs,AJo+,KQo', HJ: '55+,A8s+,KTs+,QTs+,JTs,T9s,AJo+,KQo',
    CO: '44+,A5s+,A8s+,K9s+,Q9s+,J9s+,T8s+,98s,87s,ATo+,KJo+,QJo',
    BTN: '22+,A2s+,K7s+,Q8s+,J8s+,T8s+,97s+,86s+,76s,65s,A8o+,KTo+,QTo+,JTo',
    SB: '66+,A8s+,KTs+,QTs+,JTs,AJo+,KQo'
  };
  const DEFEND_VS_EARLY = { raise: 'QQ+,AKs,AKo', call: '22-JJ,AQs,AJs,KQs,AQo' };
  const DEFEND_VS_LATE = { raise: 'TT+,AQs+,AJo+,KQs', call: '22-99,A2s+,K9s+,QTs+,JTs,T9s,98s,AJo,KQo' };
  const VS_3BET = { raise: 'QQ+,AKs,AKo', call: 'JJ-TT,AQs,AJs,KQs,AQo' };

  return {
    OPEN_RANGES,
    ISO_RANGES,
    DEFEND_VS_EARLY,
    DEFEND_VS_LATE,
    VS_3BET
  };
});
