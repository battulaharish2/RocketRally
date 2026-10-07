import http from 'node:http';
import {randomBytes,randomInt} from 'node:crypto';
import {readFile,stat,mkdir,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGame,createPlayer,perform,snapshot,log,next,legalMoves} from './game.mjs';
import {createProfile,profileView,settleRewards,roomDirectory,addChat,chatMessage} from './community.mjs';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
export function makeServer({persistFile=null}={}){
 const rooms=new Map(),limits=new Map(),profiles=new Map();let persistTimer,persistQueue=Promise.resolve();
 const clients=new Map();const now=()=>Date.now();
 const flushPersistence=()=>{clearTimeout(persistTimer);if(!persistFile)return Promise.resolve();const data=JSON.stringify({version:2,profiles:[...profiles],rooms:[...rooms].map(([c,r])=>[c,{g:r.g,tokens:[...r.tokens]}])});persistQueue=persistQueue.catch(()=>{}).then(async()=>{await mkdir(path.dirname(persistFile),{recursive:true});await writeFile(persistFile+'.tmp',data);await rename(persistFile+'.tmp',persistFile)});return persistQueue};
 const save=()=>{if(!persistFile)return;clearTimeout(persistTimer);persistTimer=setTimeout(()=>flushPersistence().catch(e=>console.error('Game save failed:',e.message)),500)};
 const ready=(async()=>{if(persistFile)try{const stored=JSON.parse(await readFile(persistFile,'utf8'));for(const[t,p]of stored.profiles||[])profiles.set(t,p);for(const[c,r]of (Array.isArray(stored)?stored:stored.rooms||[])){if(now()-r.g.updated<21600000){for(const p of r.g.players){p.connected=false;p.offlineAt=now()}r.g.deadline=r.g.settings.timer?now()+r.g.settings.timer*1000:null;rooms.set(c,{g:r.g,tokens:new Map(r.tokens),seen:new Set()})}}}catch(e){if(e.code!=='ENOENT')console.error('Room recovery failed:',e.message)}})();
 const emit=(r,data)=>{for(const[pId,set]of clients)if(r.g.players.some(p=>p.id===pId&&!p.left))for(const stream of set)if(!stream.destroyed&&!stream.writableEnded)stream.write(data)};
 const broadcast=r=>{settleRewards(r.g,profiles);r.g.updated=now();emit(r,'data: '+JSON.stringify(snapshot(r.g))+'\n\n');save()};
 const getProfile=body=>{const name=String(body.name||'').trim().slice(0,20);if(!name)throw Error('Enter your pilot name.');let profile=profiles.get(body.profileToken);if(body.profileToken&&!profile)throw Error('Pilot profile not found. Clear the saved profile in this browser to create a new one.');if(!profile){profile=createProfile(name);profiles.set(profile.token,profile)}profile.name=name;return profile};
 const checkSeat=profile=>{for(const {g}of rooms.values())if(g.phase!=='finished'&&g.players.some(p=>p.profileId===profile.id&&!p.left))throw Error('You already have a seat in a room. Return to that room or leave it first.');};
 const bump=r=>{r.g.version++;broadcast(r)};
 const disconnect=(r,p)=>{if(p.left)return;p.connected=false;p.offlineAt=now();if(r.g.host===p.id){const q=r.g.players.find(q=>q.connected&&!q.left&&q.id!==p.id);if(q){r.g.host=q.id;log(r.g,`${q.name} is now the host.`)}}bump(r)};
 const server=http.createServer(async(req,res)=>{
  await ready;const u=new URL(req.url,'http://localhost');const origin=req.headers.origin;
  const allowed=(process.env.ALLOWED_ORIGINS||'').split(',').filter(Boolean);
  if(origin&&allowed.length&&!allowed.includes(origin)&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`){res.writeHead(403);return res.end('Origin not allowed')}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin')}
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
  const json=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj))};
  try{
   if(u.pathname==='/health')return json(200,{ok:true});
   if(u.pathname.startsWith('/api/')){
    const ip=req.socket.remoteAddress;let limit=limits.get(ip);if(!limit||now()-limit.t>60000){limit={t:now(),n:0};limits.set(ip,limit)}if(++limit.n>600)return json(429,{error:'Too many requests. Please wait a moment.'});
    let body={};if(req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16000)return json(413,{error:'Request too large.'})}try{body=JSON.parse(raw||'{}')}catch{return json(400,{error:'Invalid request.'})}}
    if(u.pathname==='/api/community'&&req.method==='GET'){
     const profile=profiles.get((req.headers.authorization||'').replace(/^Bearer /,''));
     const leaderboard=[...profiles.values()].filter(p=>p.matches>0).sort((a,b)=>b.points-a.points||b.wins-a.wins||a.created-b.created).map((p,i)=>({rank:i+1,id:p.id,name:p.name,points:p.points,wins:p.wins,matches:p.matches}));
     return json(200,{rooms:roomDirectory(rooms),leaderboard:leaderboard.slice(0,100),profile:profile?{...profileView(profile),rank:leaderboard.find(p=>p.id===profile.id)?.rank||null}:null});
    }
    if(u.pathname==='/api/profile'&&req.method==='POST'){const profile=getProfile(body);await flushPersistence();return json(200,{profile:profileView(profile),profileToken:profile.token})}
    if(u.pathname==='/api/create'&&req.method==='POST'){
     if(rooms.size>=200)return json(503,{error:'The server is full. Please try later.'});
     const name=String(body.name||'').trim().slice(0,20);if(!name)return json(400,{error:'Enter your pilot name.'});
     const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code;do{code=Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('')}while(rooms.has(code));
     const profile=getProfile(body);checkSeat(profile);
     const g=createGame(code,name),token=randomBytes(32).toString('hex'),r={g,tokens:new Map([[token,g.host]]),seen:new Set()};g.public=body.public!==false;g.players[0].profileId=profile.id;g.players[0].connected=false;g.players[0].offlineAt=now();addChat(g,'Rally Bot','Welcome aboard! Chat with your crew here. Type /help or /points, or remind the host to start once everyone is ready.',true);rooms.set(code,r);await flushPersistence();return json(201,{code,token,playerId:g.host,profileToken:profile.token});
    }
    const code=String(body.code||u.searchParams.get('code')||'').toUpperCase();const r=rooms.get(code);if(!r)return json(404,{error:'Room not found or expired. Create a new room.'});
    if(u.pathname==='/api/join'&&req.method==='POST'){
     if(r.g.phase!=='lobby')return json(409,{error:'This match has already started.'});if(r.g.players.length>=4)return json(409,{error:'This room is full.'});
     const name=String(body.name||'').trim().slice(0,20);if(!name)return json(400,{error:'Enter your pilot name.'});
     const profile=getProfile(body);checkSeat(profile);
     const seat=[0,1,2,3].find(s=>!r.g.players.some(p=>p.seat===s));const p=createPlayer(name,seat);p.profileId=profile.id;p.connected=false;p.offlineAt=now();r.g.players.push(p);const token=randomBytes(32).toString('hex');r.tokens.set(token,p.id);addChat(r.g,'Rally Bot',`${p.name} joined the crew.`,true);bump(r);await flushPersistence();return json(200,{code,token,playerId:p.id,profileToken:profile.token});
    }
    const token=(req.headers.authorization||'').replace(/^Bearer /,'')||u.searchParams.get('token');const pid=r.tokens.get(token),p=r.g.players.find(x=>x.id===pid&&!x.left);if(!p)return json(401,{error:'Your seat is no longer available. Join a new room.'});
    if(u.pathname==='/api/chat'&&req.method==='POST'){chatMessage(r.g,p,body);emit(r,'event: chat\ndata: '+JSON.stringify(r.g.chat)+'\n\n');save();return json(200,{ok:true,chat:r.g.chat})}
    if(u.pathname==='/api/events'&&req.method==='GET'){
     const previous=clients.get(pid)||new Set();if(previous.size>=3)return json(429,{error:'Too many open tabs for this seat.'});
     res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write('retry: 1500\n\n');previous.add(res);clients.set(pid,previous);p.connected=true;delete p.offlineAt;
     if(!r.g.players.some(q=>q.id===r.g.host&&q.connected&&!q.left))r.g.host=pid;bump(r);
     const heartbeat=setInterval(()=>{if(!res.destroyed&&!res.writableEnded)res.write(': heartbeat\n\n')},15000);
     res.on('close',()=>{clearInterval(heartbeat);previous.delete(res);if(!previous.size){clients.delete(pid);disconnect(r,p)}});return;
    }
    if(u.pathname==='/api/state'&&req.method==='GET')return json(200,snapshot(r.g));
    if(u.pathname==='/api/action'&&req.method==='POST'){
     if(typeof body.actionId!=='string'||body.actionId.length>100)return json(400,{error:'Missing action ID.'});const key=pid+':'+body.actionId;
     if(r.seen.has(key))return json(200,{ok:true,duplicate:true});
     if(body.version!==r.g.version)return json(409,{error:'The room changed. Your board is refreshing.',state:snapshot(r.g)});
     const a=body.action||{};
     if(a.type==='kick'){
      if(pid!==r.g.host)throw Error('Only the host can remove players.');const q=r.g.players.find(q=>q.id===a.player&&q.id!==pid&&!q.left);if(!q)throw Error('Player not found.');
      if(r.g.phase==='playing'&&(q.connected||now()-(q.offlineAt||now())<120000))throw Error('Keep this seat for two minutes after disconnection.');
      remove(r,q);
     }else if(a.type==='leave'){remove(r,p)}else perform(r.g,pid,a);
     r.seen.add(key);if(r.seen.size>2000)r.seen.delete(r.seen.values().next().value);bump(r);if(r.g.phase==='finished')await flushPersistence();return json(200,{ok:true});
    }
    return json(404,{error:'Unknown endpoint.'});
   }
   if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end()}
   const relative=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).replace(/^\/+/,''),file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
   const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp'};
   const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
  }catch(e){if(e.code==='ENOENT')return json(404,{error:'Not found.'});return json(400,{error:e.message})}
 });
 function remove(r,p){p.left=true;p.connected=false;for(const[t,id]of r.tokens)if(id===p.id)r.tokens.delete(t);for(const stream of clients.get(p.id)||[])stream.end();clients.delete(p.id);log(r.g,`${p.name} left the room.`);
  const live=r.g.players.filter(q=>!q.left);if(r.g.host===p.id)r.g.host=(live.find(q=>q.connected)||live[0])?.id;
  if(r.g.phase==='lobby')r.g.players=live;
  else if(r.g.phase==='playing'){if(live.length===1){r.g.phase='finished';r.g.winner=live[0].id;r.g.finished=now();r.g.deadline=null;log(r.g,`${live[0].name} wins by forfeit.`,'win')}else if(r.g.players[r.g.turn].id===p.id){r.g.bonus=false;next(r.g)}}
 }
 const timer=setInterval(()=>{
  for(const[code,r]of rooms){
   if(now()-r.g.updated>21600000){rooms.delete(code);continue}
   if(r.g.phase==='lobby')for(const p of [...r.g.players])if(!p.connected&&now()-(p.offlineAt||now())>120000){remove(r,p);bump(r)}
   if(r.g.phase==='playing'&&r.g.deadline&&now()>r.g.deadline&&r.g.players.some(p=>p.connected&&!p.left)){
    // A timed-out move is deterministic and never spends ammunition.
    const g=r.g;if(g.step==='move'&&legalMoves(g).length)perform(g,g.players[g.turn].id,{type:'move',rocket:legalMoves(g)[0]});else {log(g,`${g.players[g.turn].name}'s turn timed out.`);g.bonus=false;next(g)}bump(r);
   }
  }
  for(const[ip,l]of limits)if(now()-l.t>60000)limits.delete(ip);
 },1000);timer.unref();
 server.on('close',()=>{clearInterval(timer);clearTimeout(persistTimer);for(const set of clients.values())for(const s of set)s.end()});
 return{server,rooms,profiles,ready,flushPersistence};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {server,flushPersistence}=makeServer({persistFile:process.env.ROOM_FILE||path.resolve('data/rooms.json')});server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log(`Rocket Rally ready on port ${process.env.PORT||3000}`));
 const shutdown=async()=>{try{await flushPersistence();server.closeAllConnections();server.close();process.exit(0)}catch(e){console.error('Final save failed:',e.message);process.exit(1)}};process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
}
