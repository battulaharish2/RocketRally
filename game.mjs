import { randomInt, randomUUID } from 'node:crypto';
export const COLORS=['#ff776b','#58d4f5','#b2e76b','#b497ff'];
export const FACTIONS=['Solar','Tidal','Verdant','Nebula'];
export const defaults={size:5,direction:'reference',launch:false,quick:false,timer:45,blocking:false};
const eq=(a,b)=>a[0]===b[0]&&a[1]===b[1];
export function layout(n=5,direction='reference',seat=0){
 const m=(n-1)/2,outer=[];
 for(let c=m;c<n;c++)outer.push([n-1,c]);
 for(let r=n-2;r>=0;r--)outer.push([r,n-1]);
 for(let c=n-2;c>=0;c--)outer.push([0,c]);
 for(let r=1;r<n;r++)outer.push([r,0]);
 for(let c=1;c<m;c++)outer.push([n-1,c]);
 const tail=[];
 // Connect the end of the longer outer ring to the inward lane without diagonal jumps.
 for(let c=m-2;c>=1;c--)tail.push([n-1,c]);
 const gate=outer.length+tail.length;
 for(let k=1;k<m;k++){
  for(let r=n-1-k;r>=k;r--)tail.push([r,k]);
  for(let c=k+1;c<=n-1-k;c++)tail.push([k,c]);
  for(let r=k+1;r<=n-1-k;r++)tail.push([r,n-1-k]);
  for(let c=n-2-k;c>=k+1;c--)tail.push([n-1-k,c]);
 }
 tail.push([m,m]);
 const transform=([r,c])=>{if(direction==='mirror')c=n-1-c;for(let i=0;i<seat;i++)[r,c]=[c,n-1-r];return[r,c]};
 const safe=n===5?[[0,0],[0,2],[0,4],[1,1],[1,3],[2,0],[2,2],[2,4],[3,1],[3,3],[4,0],[4,2],[4,4]]:[[0,3],[1,1],[1,5],[3,0],[3,3],[3,6],[5,1],[5,5],[6,3]];
 return{path:[...outer,...tail].map(transform),outer:outer.map(transform),gate,safe};
}
export function cell(g,p,i){return p.rockets[i]<0?null:layout(g.settings.size,g.settings.direction,p.seat).path[p.rockets[i]]}
export function safe(g,c){return c&&layout(g.settings.size).safe.some(x=>eq(x,c))}
export function inner(g,p,i){return p.rockets[i]>=layout(g.settings.size,g.settings.direction,p.seat).gate}
export function docked(g,p,i){return p.rockets[i]===layout(g.settings.size).path.length-1}
export function createPlayer(name,seat){return{id:randomUUID(),name,seat,ready:false,rockets:[0,0,0,0],missiles:0,captured:false,stats:{captures:0,fired:0,crashed:0},left:false}}
export function createGame(code,name){const p=createPlayer(name,0);return{code,players:[p],host:p.id,settings:{...defaults},phase:'lobby',version:0,events:[],turn:0,step:'cast',score:null,shells:[],bonus:false,bonusCount:0,deadline:null,winner:null,updated:Date.now()}}
export function log(g,text,kind='info'){g.events.push({id:randomUUID(),text,kind,time:Date.now()});g.events=g.events.slice(-40)}
export function special(g,c){
 const n=g.settings.size;if(!c||safe(g,c))return null;
 const key=c.join(',');const map=n===5?{'0,1':'supply','4,3':'supply','1,0':'boost','3,4':'asteroid','0,3':'wormhole','4,1':'wormhole'}:{'0,1':'supply','6,5':'supply','1,6':'supply','5,0':'supply','0,2':'boost','6,4':'boost','2,0':'asteroid','4,6':'asteroid','0,5':'wormhole','6,1':'wormhole'};
 return map[key]||null;
}
function targetStep(g,p,idx,amount){
 const l=layout(g.settings.size,g.settings.direction,p.seat),v=p.rockets[idx];
 if(v<0)return [4,8].includes(amount)?0:null;
 const last=l.path.length-1;
 if(v===last)return null;
 const to=v+amount;
 if(amount>0&&to>last)return null;
 return Math.max(0,to);
}
function ownCollision(g,p,i,to){const l=layout(g.settings.size,g.settings.direction,p.seat),c=l.path[to];return !safe(g,c)&&p.rockets.some((v,j)=>j!==i&&v>=0&&eq(l.path[v],c))}
function landingGate(g,p,i){const l=layout(g.settings.size,g.settings.direction,p.seat);return p.rockets[i]===l.gate-1}
export function legalMoves(g){
 if(g.phase!=='playing'||g.step!=='move')return[];const p=g.players[g.turn];
 return p.rockets.flatMap((v,i)=>{const to=targetStep(g,p,i,g.score);if(to===null||ownCollision(g,p,i,to))return[];
  if(g.settings.blocking&&v>=0){const l=layout(g.settings.size,g.settings.direction,p.seat);for(let s=1;s<g.score;s++){const mid=targetStep(g,p,i,s);if(mid!==null&&!safe(g,l.path[mid])&&p.rockets.some((x,j)=>i!==j&&x>=0&&eq(l.path[x],l.path[mid])))return[]}}
  return[i];});
}
function captureAt(g,p,i){const c=cell(g,p,i);if(safe(g,c))return;
 for(const q of g.players){if(q.id===p.id||q.left)continue;for(let j=0;j<4;j++){if(q.rockets[j]>=0&&!inner(g,q,j)&&eq(cell(g,q,j),c)){q.rockets[j]=0;q.stats.crashed++;p.captured=true;p.stats.captures++;g.bonus=true;log(g,`${p.name} captured ${q.name}'s rocket ${j+1}. Landing spiral unlocked!`,'crash')}}}
}
export function missileTargets(g){
 if(g.phase!=='playing'||g.step!=='attack')return[];const p=g.players[g.turn];if(!p.missiles)return[];
 const perimeter=layout(g.settings.size).outer,range=g.settings.size===5?4:6;
 const positions=p.rockets.flatMap((v,i)=>v>=0&&!inner(g,p,i)?[cell(g,p,i)]:[]);
 return g.players.flatMap(q=>q.id===p.id||q.left?[]:q.rockets.flatMap((v,j)=>{
  const c=cell(g,q,j);if(v<0||inner(g,q,j)||safe(g,c))return[];
  const b=perimeter.findIndex(x=>eq(x,c));if(b<0)return[];
  return positions.some(a=>{const ai=perimeter.findIndex(x=>eq(x,a));const d=Math.abs(ai-b);return ai>=0&&Math.min(d,perimeter.length-d)<=range})?[{player:q.id,rocket:j}]:[];
 }));
}
export function deadline(g){g.deadline=g.settings.timer?Date.now()+g.settings.timer*1000:null}
export function next(g){
 if(g.phase!=='playing')return;
 if(g.bonus&&(!g.settings.quick||g.bonusCount<2)&&!g.players[g.turn].left)g.bonusCount++;
 else {g.bonusCount=0;let loops=0;do{g.turn=(g.turn+1)%g.players.length}while(g.players[g.turn].left&&++loops<g.players.length)}
 g.bonus=false;g.step='cast';g.score=null;deadline(g);
}
export function start(g){
 if(g.players.filter(p=>!p.left).length<2)throw Error('At least two players are needed.');
 g.players=g.players.filter(p=>!p.left).sort((a,b)=>a.seat-b.seat);for(const p of g.players){p.rockets=Array(4).fill(g.settings.launch?-1:0);p.captured=false;p.missiles=0;p.stats={captures:0,fired:0,crashed:0}}
 g.phase='playing';g.winner=null;g.started=Date.now();g.turn=randomInt(g.players.length);g.bonus=false;g.bonusCount=0;g.score=null;g.shells=[];g.step='cast';log(g,'Launch sequence complete. Race for the planet!','start');deadline(g);
}
export function perform(g,actor,a,random=()=>randomInt(2)){
 const p=g.players.find(p=>p.id===actor&&!p.left);if(!p)throw Error('Your seat is no longer in this room.');
 if(a.type==='ready'&&g.phase==='lobby'){p.ready=!p.ready;return}
 if(a.type==='color'&&g.phase==='lobby'){if(!Number.isInteger(a.seat)||a.seat<0||a.seat>3||g.players.some(q=>q.seat===a.seat&&q.id!==p.id&&!q.left))throw Error('That color is taken.');p.seat=a.seat;return}
 if(a.type==='settings'&&g.phase==='lobby'){
  if(actor!==g.host)throw Error('Only the host can change the settings.');const s=a.settings||{};
  g.settings={size:s.size===7?7:5,direction:s.direction==='mirror'?'mirror':'reference',launch:!!s.launch,quick:!!s.quick,blocking:!!s.blocking,timer:[0,30,45].includes(s.timer)?s.timer:45};return;
 }
 if(a.type==='start'){if(actor!==g.host||g.phase!=='lobby')throw Error('Only the lobby host can start.');if(g.players.some(q=>q.id!==actor&&!q.ready))throw Error('Wait for everyone to be ready.');start(g);return}
 if(a.type==='rematch'){if(actor!==g.host||g.phase!=='finished')throw Error('Only the host can return to the lobby after a match.');g.players=g.players.filter(p=>!p.left);g.phase='lobby';g.winner=null;g.deadline=null;for(const q of g.players)q.ready=false;return}
 if(g.phase!=='playing'||g.players[g.turn].id!==actor)throw Error('It is not your turn.');
 if(a.type==='cast'&&g.step==='cast'){
  g.shells=Array.from({length:4},random);g.score=g.shells.reduce((x,y)=>x+y,0)||8;g.bonus=[4,8].includes(g.score);g.step='move';log(g,`${p.name} cast ${g.score}${g.bonus?' — bonus cast':''}.`,'cast');
  if(!legalMoves(g).length){log(g,'No legal move; advancing the turn.');next(g)}return;
 }
 if(a.type==='move'&&g.step==='move'){
  if(!legalMoves(g).includes(a.rocket))throw Error('Choose a highlighted rocket.');
  const i=a.rocket;p.rockets[i]=targetStep(g,p,i,g.score);captureAt(g,p,i);
  const effect=landingGate(g,p,i)?null:special(g,cell(g,p,i));
  if(effect==='supply'){p.missiles=Math.min(2,p.missiles+1);log(g,`${p.name} collected a missile cache.`,'supply')}
  if(effect==='boost'||effect==='asteroid'){
   const to=targetStep(g,p,i,effect==='boost'?2:-2);if(to!==null&&!ownCollision(g,p,i,to)){p.rockets[i]=to;captureAt(g,p,i);log(g,`${p.name} ${effect==='boost'?'boosted two cells':'hit an asteroid and drifted back two cells'}.`,effect)}
  }
  if(effect==='wormhole'&&!inner(g,p,i)){
   const l=layout(g.settings.size,g.settings.direction,p.seat);const other=l.outer.findIndex(c=>special(g,c)==='wormhole'&&!eq(c,cell(g,p,i)));
   if(other>=0&&!ownCollision(g,p,i,other)){p.rockets[i]=other;captureAt(g,p,i);log(g,`${p.name} warped through a wormhole.`,'warp')}
  }
  log(g,`${p.name} moved rocket ${i+1}${docked(g,p,i)?' into Planet Core':''}.`,'move');
  if(p.rockets.every((_,j)=>docked(g,p,j))){g.phase='finished';g.winner=p.id;g.finished=Date.now();g.deadline=null;log(g,`${p.name} claimed the planet!`,'win');return}
  g.step='attack';if(!missileTargets(g).length)next(g);return;
 }
 if(a.type==='fire'&&g.step==='attack'){
  if(!missileTargets(g).some(t=>t.player===a.player&&t.rocket===a.rocket))throw Error('That rocket cannot be targeted.');
  const q=g.players.find(q=>q.id===a.player);q.rockets[a.rocket]=0;q.stats.crashed++;p.missiles--;p.stats.fired++;log(g,`${p.name}'s missile sent ${q.name}'s rocket ${a.rocket+1} back to Safe Start.`,'missile');next(g);return;
 }
 if(a.type==='end'&&g.step==='attack'){next(g);return}
 throw Error('That action is not available now.');
}
export function snapshot(g){const s=structuredClone(g);s.paths=Object.fromEntries(g.players.map(p=>[p.id,layout(g.settings.size,g.settings.direction,p.seat)]));s.legal=legalMoves(g);s.targets=missileTargets(g);s.tiles=Array.from({length:g.settings.size},(_,r)=>Array.from({length:g.settings.size},(_,c)=>special(g,[r,c])));return s}
