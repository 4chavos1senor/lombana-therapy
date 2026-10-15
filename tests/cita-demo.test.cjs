const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/cita-demo.js'),'utf8');
const draft={
  folio:'DEMO-TEST',terapia:'Terapia de prueba',fecha:'2028-06-15',
  horario:'11:00',therapy_id:'11111111-2222-4333-8444-555555555555'
};
function setup({draftData=draft,occupied=[],sqlError=null,validSession=true}={}){
  const elements=new Map(),handlers={};
  for(const id of ['demo-status','demo-details','btn-agendar-demo','demo-error','demo-estado',
    'demo-folio','demo-terapia','demo-fecha','demo-hora']){
    elements.set(id,{
      textContent:id==='demo-estado'?'Pendiente de agendar':'',
      hidden:['demo-details','btn-agendar-demo','demo-error'].includes(id),
      disabled:false,addEventListener:(_,fn)=>{handlers[id]=fn}
    });
  }
  const calls=[];let destination=null;
  const store=new Map([['lombana_demo_cita',JSON.stringify(draftData)]]);
  vm.runInNewContext(source,{
    document:{getElementById:id=>elements.get(id)},
    sessionStorage:{getItem:k=>store.get(k),removeItem:k=>store.delete(k)},
    supabaseClient:{
      auth:{getUser:async()=>validSession?{data:{user:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}}}:{error:{message:'expired'}}},
      rpc:async()=>({data:occupied,error:null}),
      from:()=>({insert:o=>{calls.push(o);return{
        select:()=>({single:async()=>sqlError?{error:sqlError}:{data:{id:'33333333-3333-4333-8333-333333333333'}}})
      }}})
    },
    window:{location:{assign:url=>{destination=url}}},
    Intl,Date,console
  });
  return {elements,handlers,calls,store,redirect:()=>destination};
}
test('Una demostración todavía no reserva',()=>{
  const x=setup();
  assert.equal(x.calls.length,0);
  assert.equal(x.elements.get('btn-agendar-demo').hidden,false);
});
test('Agendar terapia crea una sola cita sin cargo',async()=>{
  const x=setup();
  await x.handlers['btn-agendar-demo']();
  assert.equal(x.calls.length,1);
  assert.equal(x.calls[0].status,'confirmada');
  assert.equal(x.calls[0].hora_fin,'12:00:00');
  assert.equal(x.calls[0].user_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.match(x.redirect(),/cita-confirmada.html\?id=/);
  assert.equal(x.store.has('lombana_demo_cita'),false);
});
test('Una sesión expirada no crea cita',async()=>{
  const x=setup({validSession:false});
  await x.handlers['btn-agendar-demo']();
  assert.equal(x.calls.length,0);
  assert.equal(x.redirect(),null);
});
test('Rechaza horarios ocupados',async()=>{
  const x=setup({occupied:[{hora_inicio:'10:30:00',hora_fin:'11:30:00'}]});
  await x.handlers['btn-agendar-demo']();
  assert.equal(x.calls.length,0);
  assert.match(x.elements.get('demo-error').textContent,/ocupado/i);
});
test('Rechazo por trigger no muestra cita confirmada',async()=>{
  const x=setup({sqlError:{code:'23P01',message:'Horario ocupado'}});
  await x.handlers['btn-agendar-demo']();
  assert.equal(x.redirect(),null);
});
test('Un borrador de simulación inválido no habilita reserva',()=>{
  const x=setup({draftData:{...draft,therapy_id:'NO-UUID'}});
  assert.equal(x.elements.get('btn-agendar-demo').hidden,true);
});
