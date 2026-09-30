import test from 'node:test';
import assert from 'node:assert/strict';
import {makeServer} from '../server.mjs';
import {randomUUID} from 'node:crypto';
test('two authenticated clients synchronize; stale actions, retries and reconnects are safe',async()=>{
 const {server}=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;const controllers=[];
 const post=async(path,body,seat)=>{const r=await fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(seat?{Authorization:'Bearer '+seat.token}:{})},body:JSON.stringify(body)});return{status:r.status,data:await r.json()}};
 const state=async s=>(await fetch(base+'/api/state?code='+s.code,{headers:{Authorization:'Bearer '+s.token}})).json();
 async function stream(s){const c=new AbortController();controllers.push(c);const r=await fetch(base+'/api/events?code='+s.code+'&token='+s.token,{signal:c.signal});const reader=r.body.getReader();let buffer='';return{abort:()=>c.abort(),async next(){while(true){const end=buffer.indexOf('\n\n');if(end>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);if(block.startsWith('data: '))return JSON.parse(block.slice(6));continue}const {value,done}=await reader.read();if(done)throw Error('Stream ended');buffer+=new TextDecoder().decode(value)}}}}
 try{
  const a=(await post('create',{name:'Ada'})).data,b=(await post('join',{name:'Bo',code:a.code})).data;
  const sa=await stream(a);await sa.next();const sb=await stream(b);const aa=await sa.next(),bb=await sb.next();assert.equal(aa.version,bb.version);assert.deepEqual(aa.players,bb.players);
  const body={code:a.code,version:aa.version,actionId:randomUUID(),action:{type:'ready'}};
  assert.equal((await post('action',body,b)).status,200);const a1=await sa.next(),b1=await sb.next();assert.deepEqual(a1,b1);
  assert.equal((await post('action',body,b)).data.duplicate,true);
  assert.equal((await post('action',{...body,actionId:randomUUID()},a)).status,409);
  assert.equal((await post('action',{code:a.code,version:a1.version,actionId:randomUUID(),action:{type:'start'}},a)).status,200);
  const started=await sa.next();await sb.next();assert.equal(started.phase,'playing');const active=started.players[started.turn].id===a.playerId?a:b;
  await post('action',{code:a.code,version:started.version,actionId:randomUUID(),action:{type:'cast'}},active);assert.deepEqual(await sa.next(),await sb.next());
  sa.abort();await new Promise(r=>setTimeout(r,30));const reconnect=await stream(a);const recovered=await reconnect.next();assert.deepEqual(recovered,await state(a));assert.equal(recovered.host,b.playerId);
  assert.equal((await fetch(base+'/api/state?code='+a.code)).status,401);
 }finally{controllers.forEach(c=>c.abort());server.closeAllConnections();await new Promise(r=>server.close(r))}
});
