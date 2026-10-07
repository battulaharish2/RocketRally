import {randomBytes, randomUUID} from 'node:crypto';
import {layout} from './game.mjs';

export const goals = [
  {id:'first-flight', title:'First flight', description:'Complete your first match.', stat:'matches', target:1, points:25},
  {id:'planet-claimer', title:'Planet claimer', description:'Win your first match.', stat:'wins', target:1, points:50},
  {id:'regular-pilot', title:'Regular pilot', description:'Complete 5 matches.', stat:'matches', target:5, points:100},
  {id:'rocket-hunter', title:'Rocket hunter', description:'Capture 5 rockets in completed matches.', stat:'captures', target:5, points:75},
  {id:'homeward-bound', title:'Homeward bound', description:'Land 10 rockets in completed matches.', stat:'landed', target:10, points:100},
];

export function createProfile(name) {
  return {id:randomUUID(), token:randomBytes(32).toString('hex'), name, points:0,
    matches:0, wins:0, captures:0, landed:0, achievements:[], created:Date.now()};
}

export function profileView(p) {
  return {id:p.id, name:p.name, points:p.points, matches:p.matches, wins:p.wins,
    goals:goals.map(g=>({...g, progress:Math.min(p[g.stat],g.target), achieved:p.achievements.includes(g.id)}))};
}

// Settlement lives on the server. A persisted match marker makes reconnects,
// duplicate actions and restarts unable to credit the same match twice.
export function settleRewards(g, profiles) {
  if(g.phase!=='finished'||g.rewardsSettled)return;
  g.rewardsSettled=true;
  g.rewards=[];
  const last=layout(g.settings.size).path.length-1;
  const winner=g.players.find(p=>p.id===g.winner);
  if(!winner||!winner.rockets.every(v=>v===last)||new Set(g.players.map(p=>p.profileId).filter(Boolean)).size<2) {
    g.rewardNote='Forfeit matches do not award points or goal progress.';
    return;
  }
  g.rewardNote='20 points for completing a match, 100 extra for winning, and 5 per capture (up to 50). Goal bonuses are awarded once.';
  const byId=new Map([...profiles.values()].map(p=>[p.id,p]));
  for(const player of g.players) {
    const p=byId.get(player.profileId);
    if(!p||player.left||!player.stats.moves)continue;
    const win=player.id===g.winner, captures=player.stats.captures;
    p.matches++; p.wins+=Number(win); p.captures+=captures;
    p.landed+=player.rockets.filter(v=>v===last).length;
    let points=20+(win?100:0)+Math.min(captures,10)*5;
    const unlocked=[];
    for(const goal of goals)if(p[goal.stat]>=goal.target&&!p.achievements.includes(goal.id)) {
      p.achievements.push(goal.id); points+=goal.points; unlocked.push(goal.title);
    }
    p.points+=points;
    g.rewards.push({playerId:player.id, points, total:p.points, unlocked});
  }
}

export function roomDirectory(rooms, now=Date.now()) {
  return [...rooms.values()].filter(({g})=>g.public===true&&g.phase!=='finished'&&
    g.players.some(p=>!p.left&&(p.connected||now-(p.offlineAt||0)<90000)))
    .map(({g})=>({code:g.code, host:g.players.find(p=>p.id===g.host)?.name||'Pilot',
      phase:g.phase, players:g.players.filter(p=>!p.left).length,
      online:g.players.filter(p=>!p.left&&p.connected).length, size:g.settings.size,
      joinable:g.phase==='lobby'&&g.players.length<4}))
    .sort((a,b)=>Number(b.joinable)-Number(a.joinable)||b.players-a.players);
}

export function addChat(g, name, text, bot=false) {
  g.chat??=[];
  g.chat.push({id:randomUUID(), name, text, bot, time:Date.now()});
  g.chat=g.chat.slice(-60);
}

export function chatMessage(g,p,body,now=Date.now()) {
  const message=String(body.message||'').trim();
  const remind=body.kind==='remind'||message.toLowerCase()==='/remind';
  if(remind) {
    if(g.phase!=='lobby')throw Error('The match has already started.');
    if(g.host===p.id)throw Error('You are the host. Use Launch match when your crew is ready.');
    if(now-(g.lastReminderAt||0)<30000)throw Error('A reminder was sent recently. Please wait 30 seconds.');
    g.lastReminderAt=now;
    const host=g.players.find(q=>q.id===g.host);
    addChat(g,'Rally Bot',`${p.name} is asking ${host?.name||'the host'} to start. Everyone, mark yourself ready; the host can then launch the match.`,true);
    return;
  }
  if(!message||message.length>300)throw Error('Write a message of 1–300 characters.');
  if(now-(p.lastChatAt||0)<1500)throw Error('Please wait a moment before sending another message.');
  p.lastChatAt=now;
  addChat(g,p.name,message);
  if(message.toLowerCase()==='/help')addChat(g,'Rally Bot','Mark yourself ready in the lobby. Only the host can launch. Use /remind to ask the host to start. Finish matches to earn points; open Goals & leaderboard to see your progress.',true);
  if(message.toLowerCase()==='/points')addChat(g,'Rally Bot','Complete a match: 20 points. Win: +100. Capture: +5 each, up to +50 per match. Goals award extra points once. Leaving or winning by forfeit earns no rewards.',true);
}
