import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {makeServer} from '../server.mjs';
import {createGame,createPlayer,layout,start} from '../game.mjs';
import {createProfile,settleRewards,chatMessage,roomDirectory} from '../community.mjs';

function match(){
  const a=createProfile('Ada'),b=createProfile('Bo'),profiles=new Map([[a.token,a],[b.token,b]]);
  const g=createGame('ABCDEF','Ada');g.players.push(createPlayer('Bo',1));g.players[0].profileId=a.id;g.players[1].profileId=b.id;
  start(g);g.phase='finished';g.winner=g.players[0].id;g.players[0].rockets.fill(layout().path.length-1);
  g.players[0].stats={moves:8,captures:2};g.players[1].stats={moves:5,captures:0};
  return {g,a,b,profiles};
}

test('match points and goal bonuses settle once, accumulate across rematches, and exclude forfeits',()=>{
  const {g,a,b,profiles}=match();settleRewards(g,profiles);
  assert.equal(a.points,205);assert.equal(b.points,45);assert.equal(a.matches,1);assert.equal(a.wins,1);
  settleRewards(g,profiles);assert.equal(a.points,205);
  for(let i=0;i<4;i++){start(g);g.phase='finished';g.winner=g.players[0].id;g.players[0].rockets.fill(24);for(const p of g.players)p.stats={moves:10,captures:2};settleRewards(g,profiles)}
  assert.equal(a.matches,5);assert.equal(a.achievements.length,5);assert.equal(new Set(a.achievements).size,5);
  const previous=a.points;start(g);g.phase='finished';g.winner=g.players[0].id;settleRewards(g,profiles);
  assert.equal(a.points,previous);assert.equal(g.rewards.length,0);assert.match(g.rewardNote,/Forfeit/);
});

test('leaving and never moving earn neither match rewards nor goals',()=>{
  for(const condition of ['left','idle']){const {g,b,profiles}=match();if(condition==='left')g.players[1].left=true;else g.players[1].stats.moves=0;settleRewards(g,profiles);assert.equal(b.points,0);assert.equal(b.matches,0)}
});

test('chat validates messages, limits reminders and restricts them to non-host lobby players',()=>{
  const g=createGame('ABCDEF','Ada'),p=createPlayer('Bo',1);g.players.push(p);
  assert.throws(()=>chatMessage(g,p,{message:' '}),/1–300/);
  assert.throws(()=>chatMessage(g,p,{message:'x'.repeat(301)}),/1–300/);
  chatMessage(g,p,{message:'/help'});assert.equal(g.chat.length,2);assert.equal(g.chat[1].bot,true);
  assert.throws(()=>chatMessage(g,p,{message:'spam'}),/wait/);
  chatMessage(g,p,{kind:'remind'});assert.match(g.chat.at(-1).text,/Bo is asking Ada/);
  assert.throws(()=>chatMessage(g,p,{kind:'remind'}),/30 seconds/);
  assert.throws(()=>chatMessage(g,g.players[0],{kind:'remind'}),/host/);
  g.phase='playing';assert.throws(()=>chatMessage(g,p,{kind:'remind'}),/already started/);
});

test('directory hides private and abandoned rooms and labels full and started rooms',()=>{
  const g=createGame('ABCDEF','Ada');g.public=true;g.players[0].connected=true;
  const rooms=new Map([[g.code,{g}]]);assert.equal(roomDirectory(rooms)[0].joinable,true);
  g.public=false;assert.equal(roomDirectory(rooms).length,0);g.public=true;
  g.players[0].connected=false;g.players[0].offlineAt=Date.now()-100000;assert.equal(roomDirectory(rooms).length,0);
  g.players[0].connected=true;for(let i=1;i<4;i++)g.players.push(createPlayer('Pilot',i));assert.equal(roomDirectory(rooms)[0].joinable,false);
  g.phase='playing';assert.equal(roomDirectory(rooms)[0].phase,'playing');g.phase='finished';assert.equal(roomDirectory(rooms).length,0);
});

test('public joining, private rooms, authenticated chat, finish rewards and restart persistence',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'rally-community-')),persistFile=path.join(dir,'rooms.json');
  const instance=makeServer({persistFile});const {server,rooms}=instance;
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  const post=async(endpoint,body,token)=>{const res=await fetch(base+'/api/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return{status:res.status,data:await res.json()}};
  const community=async token=>(await fetch(base+'/api/community',{headers:token?{Authorization:'Bearer '+token}:{}})).json();
  try{
    const a=(await post('create',{name:'Ada',public:true})).data;
    const privateRoom=(await post('create',{name:'Private',public:false})).data;
    let directory=await community();assert.equal(directory.rooms.length,1);assert.equal(directory.rooms[0].code,a.code);
    assert.ok(!JSON.stringify(directory).includes(a.token));assert.ok(!JSON.stringify(directory).includes(a.profileToken));
    assert.equal((await post('join',{name:'Imposter',code:a.code,profileToken:'invalid'})).status,400);
    assert.equal((await post('join',{name:'Ada',code:a.code,profileToken:a.profileToken})).status,400);
    const b=(await post('join',{name:'Bo',code:a.code})).data;
    assert.equal((await post('chat',{code:a.code,message:'hello'})).status,401);
    assert.equal((await post('chat',{code:privateRoom.code,message:'hello'},b.token)).status,401);
    const g=rooms.get(a.code).g,version=g.version;
    assert.equal((await post('chat',{code:a.code,message:'Hello <script>alert(1)</script>'},b.token)).status,200);
    assert.equal(g.version,version,'Chat must not invalidate a pending game action');
    assert.equal((await post('chat',{code:a.code,kind:'remind'},b.token)).status,200);
    assert.equal((await post('chat',{code:a.code,kind:'remind'},b.token)).status,400);
    const act=async(seat,action,id=randomUUID())=>post('action',{code:a.code,version:g.version,actionId:id,action},seat.token);
    assert.equal((await act(b,{type:'ready'})).status,200);assert.equal((await act(a,{type:'start'})).status,200);
    directory=await community();assert.equal(directory.rooms[0].phase,'playing');assert.equal(directory.rooms[0].joinable,false);
    assert.equal((await post('join',{name:'Late',code:a.code})).status,409);
    assert.equal((await act(a,{type:'claim',points:99999})).status,400);
    // Arrange the last legal move, then finish through the actual HTTP action.
    const winner=g.players.find(p=>p.id===a.playerId),other=g.players.find(p=>p.id===b.playerId);
    g.turn=g.players.indexOf(winner);g.step='move';g.score=1;winner.rockets=[24,24,24,23];other.stats.moves=2;
    const actionId=randomUUID();assert.equal((await act(a,{type:'move',rocket:3},actionId)).status,200);
    let result=await community(a.profileToken);assert.equal(result.profile.points,195);assert.equal(result.leaderboard[0].name,'Ada');
    assert.equal((await act(a,{type:'move',rocket:3},actionId)).data.duplicate,true);
    assert.equal((await community(a.profileToken)).profile.points,195);
    await instance.flushPersistence();const stored=JSON.parse(await readFile(persistFile,'utf8'));assert.equal(stored.version,2);
    const recovered=makeServer({persistFile});await recovered.ready;
    assert.equal(recovered.profiles.get(a.profileToken).points,195);
    assert.equal(recovered.rooms.get(a.code).g.rewardsSettled,true);
    settleRewards(recovered.rooms.get(a.code).g,recovered.profiles);assert.equal(recovered.profiles.get(a.profileToken).points,195);
    recovered.server.emit('close');
  }finally{await instance.flushPersistence();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
});

test('legacy room saves remain readable',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'rally-legacy-')),persistFile=path.join(dir,'rooms.json');
  try{const g=createGame('ABCDEF','Old pilot');await writeFile(persistFile,JSON.stringify([[g.code,{g,tokens:[]}]]));const recovered=makeServer({persistFile});await recovered.ready;assert.equal(recovered.rooms.size,1);assert.equal(recovered.profiles.size,0);recovered.server.emit('close')}finally{await rm(dir,{recursive:true,force:true})}
});
