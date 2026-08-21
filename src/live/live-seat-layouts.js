(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PokerPilotLiveSeatLayouts=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function freezeLayout(id,slots){
    return Object.freeze({
      id,
      seatCount:slots.length,
      slots:Object.freeze(slots.map(slot=>Object.freeze({...slot})))
    });
  }

  const sixMaxLayout=freezeLayout('six-max',[
    {id:'hero',x:50,y:100},
    {id:'lower-left',x:17,y:75},
    {id:'upper-left',x:17,y:28},
    {id:'top',x:50,y:5},
    {id:'upper-right',x:83,y:28},
    {id:'lower-right',x:83,y:75}
  ]);

  const nineMaxLayout=freezeLayout('nine-max',[
    {id:'hero',x:50,y:100},
    {id:'lower-left',x:27,y:86},
    {id:'middle-left',x:18,y:63},
    {id:'upper-left',x:18,y:34},
    {id:'top-left',x:34,y:6},
    {id:'top-right',x:66,y:6},
    {id:'upper-right',x:82,y:34},
    {id:'middle-right',x:82,y:63},
    {id:'lower-right',x:73,y:86}
  ]);

  function getLayout(seatCount){
    const count=Number(seatCount);
    if(count===6)return sixMaxLayout;
    if(count===9)return nineMaxLayout;
    throw new RangeError(`Unsupported Live seat count: ${seatCount}`);
  }

  return Object.freeze({sixMaxLayout,nineMaxLayout,getLayout});
});
