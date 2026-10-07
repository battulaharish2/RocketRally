const API=(window.ROCKET_RALLY_API||'').replace(/\/$/,'');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let hooks,chatDraft='',chatBusy=false,chatFocus=null,chatScroll=null,communityBusy=false;
export const profileToken=()=>localStorage.getItem('rally-profile')||'';
export function saveProfile(token){if(token)localStorage.setItem('rally-profile',token)}

async function loadCommunity(){
  const res=await fetch(API+'/api/community',{headers:profileToken()?{Authorization:'Bearer '+profileToken()}: {}});
  if(!res.ok)throw Error('Could not load online pilots. Please try again.');
  return res.json();
}

export function initCommunity(callbacks){
  hooks=callbacks;
  const button=document.createElement('button');button.className='icon';button.textContent='Goals & leaderboard';button.onclick=openProgress;
  document.querySelector('.toolbar').prepend(button);
  const dialog=document.createElement('dialog');dialog.id='progress-dialog';dialog.setAttribute('aria-label','Goals and global leaderboard');
  dialog.innerHTML='<button class="close-progress subtle" aria-label="Close goals and leaderboard">Close</button><div id="progress-content"></div>';
  document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();
  setInterval(()=>{if(!document.hidden&&document.querySelector('#online-rooms'))refreshRooms()},10000);
}

export function homeCommunity(){
  document.querySelector('.entry').insertAdjacentHTML('beforeend','<label class="check"><input id="public-room" type="checkbox" checked>List my new room for anyone online</label>');
  document.querySelector('.intro').insertAdjacentHTML('beforeend',`<section class="discovery panel" aria-labelledby="rooms-title"><div class="section-heading"><h2 id="rooms-title">Play with anyone</h2><button id="refresh-rooms" class="subtle">Refresh</button></div><p class="small">Join a waiting crew, or create a room for others to join.</p><div id="online-rooms" aria-live="polite"><p class="small">Finding rooms…</p></div></section>`);
  document.querySelector('#refresh-rooms').onclick=refreshRooms;
  refreshRooms();
}

async function refreshRooms(){
  if(communityBusy)return;communityBusy=true;
  const button=document.querySelector('#refresh-rooms');if(button)button.disabled=true;
  try{
    const data=await loadCommunity(),target=document.querySelector('#online-rooms');if(!target)return;
    target.innerHTML=data.rooms.length?data.rooms.map(r=>`<article class="room-listing"><div><strong>${esc(r.host)}’s room</strong><span class="small">${r.players}/4 pilots · ${r.size}×${r.size} · ${r.online} online</span></div><button data-join-room="${esc(r.code)}" ${r.joinable?'':'disabled'}>${r.joinable?'Join room':r.phase==='playing'?'In progress':'Full'}</button></article>`).join(''):'<p class="small">No public rooms yet. Create one and invite the next pilot to join you.</p>';
    target.querySelectorAll('[data-join-room]').forEach(b=>b.onclick=()=>{document.querySelector('#code').value=b.dataset.joinRoom;hooks.join()});
  }catch(e){const target=document.querySelector('#online-rooms');if(target)target.innerHTML=`<p class="small">${esc(e.message)} Use Refresh to try again.</p>`}
  finally{communityBusy=false;if(button)button.disabled=false}
}

async function openProgress(){
  const dialog=document.querySelector('#progress-dialog');if(!dialog.open)dialog.showModal();
  const target=document.querySelector('#progress-content');target.innerHTML='<p>Loading your flight record…</p>';
  try{
    const {profile:p,leaderboard}=await loadCommunity();
    target.innerHTML=`<p class="eyebrow">PILOT REWARDS</p><h2>Goals & global leaderboard</h2><p class="small">Complete a match: 20 points · Win: +100 · Capture: +5 each (maximum +50 per match). Goals pay a one-time bonus. Leaving, inactivity without making a move, and forfeit finishes earn no rewards.</p>${p?`<div class="reward-summary"><strong>${esc(p.name)} · ${p.points} points</strong><span>${p.matches} completed · ${p.wins} wins · ${p.rank?'Rank #'+p.rank:'Unranked'}</span></div>`:`<form id="save-profile"><label>Pilot name<input id="profile-name" maxlength="20" required value="${esc(localStorage.getItem('rally-name')||'')}"></label><button class="primary">${profileToken()?'Create a new pilot profile':'Save pilot & view goals'}</button>${profileToken()?'<p class="small">Your saved profile is unavailable on this server. Creating a new one starts your points at zero.</p>':''}</form>`}<p class="small">Your pilot profile is saved in this browser. Use the same browser to keep earning points. Names can be shared by different pilots.</p><div class="progress-columns"><section><h3>Goals</h3>${p?p.goals.map(g=>`<article class="goal-card ${g.achieved?'achieved':''}"><div class="section-heading"><strong>${esc(g.title)}</strong><span>+${g.points} pts</span></div><p class="small">${esc(g.description)}</p><progress value="${g.progress}" max="${g.target}" aria-label="${esc(g.title)}"></progress><span class="small">${g.achieved?'✓ Achieved · bonus awarded':g.progress+' / '+g.target}</span></article>`).join(''):'<p class="small">Save your pilot name or join a room to activate your goals: First flight, Planet claimer, Regular pilot, Rocket hunter, and Homeward bound.</p>'}</section><section><h3>Global leaderboard</h3><p class="small">Top 100 pilots on this game server. Updates after completed matches.</p>${leaderboard.length?`<div class="leaderboard-wrap"><table class="leaderboard"><thead><tr><th>Rank</th><th>Pilot</th><th>Points</th><th>Wins</th></tr></thead><tbody>${leaderboard.map(pilot=>`<tr class="${pilot.id===p?.id?'my-rank':''}"><td>${pilot.rank}</td><td>${esc(pilot.name)}${pilot.id===p?.id?' (you)':''}</td><td>${pilot.points}</td><td>${pilot.wins}</td></tr>`).join('')}</tbody></table></div>`:'<p class="small">The first completed match will put pilots on the leaderboard.</p>'}</section></div><button id="refresh-progress" class="subtle">Refresh progress</button>`;
    document.querySelector('#refresh-progress').onclick=openProgress;
    const form=document.querySelector('#save-profile');if(form)form.onsubmit=async e=>{
      e.preventDefault();const button=form.querySelector('button');button.disabled=true;
      try{const name=document.querySelector('#profile-name').value.trim();const res=await fetch(API+'/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});const data=await res.json();if(!res.ok)throw Error(data.error);saveProfile(data.profileToken);localStorage.setItem('rally-name',name);if(document.querySelector('#pilot'))document.querySelector('#pilot').value=name;await openProgress()}catch(e){hooks.toast(e.message);button.disabled=false}
    };
  }catch(e){target.textContent=e.message;const retry=document.createElement('button');retry.textContent='Try again';retry.onclick=openProgress;target.append(retry)}
}

export function captureChat(){
  const input=document.querySelector('#chat-message');
  if(input){chatDraft=input.value;chatFocus=document.activeElement===input?{start:input.selectionStart,end:input.selectionEnd}:null}
  const list=document.querySelector('#chat-messages');
  if(list)chatScroll=list.scrollHeight-list.scrollTop-list.clientHeight<40?null:list.scrollTop;
}

export function resetChat(){chatDraft='';chatFocus=null;chatScroll=null}

export function updateChat(messages){
  const list=document.querySelector('#chat-messages');if(!list)return;
  const atBottom=list.scrollHeight-list.scrollTop-list.clientHeight<40,position=list.scrollTop;
  list.innerHTML=messages.map(m=>`<li class="${m.bot?'bot-message':''}"><strong>${esc(m.name)}</strong><time>${new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time><p>${esc(m.text)}</p></li>`).join('');
  list.scrollTop=atBottom?list.scrollHeight:position;
}

export function mountChat(state,session,connected){
  const reward=state.rewards?.find(r=>r.playerId===session.playerId);
  const section=document.createElement('section');section.className='panel room-chat';
  section.innerHTML=`${state.phase==='finished'?`<div class="match-rewards"><h3>${reward?'You earned '+reward.points+' points':'Match rewards'}</h3>${reward?`<p>${reward.total} total points${reward.unlocked.length?' · Goals achieved: '+reward.unlocked.map(esc).join(', '):''}</p>`:''}<p class="small">${esc(state.rewardNote||'Rewards are calculated when the match ends.')}</p><button id="view-rewards" class="subtle">View goals & leaderboard</button></div>`:''}<div class="section-heading"><h2>Crew chat</h2><span class="small">Room members only</span></div><ol id="chat-messages" role="log" aria-label="Room chat" aria-live="polite"></ol><form id="chat-form"><label for="chat-message">Message your crew</label><div class="chat-compose"><input id="chat-message" maxlength="300" placeholder="Say hello, or type /help" autocomplete="off" value="${esc(chatDraft)}"><button class="primary" ${!connected||chatBusy?'disabled':''}>Send</button></div></form><div class="chat-tools"><button id="bot-help" class="subtle" ${!connected||chatBusy?'disabled':''}>Ask Rally Bot for help</button>${state.phase==='lobby'&&state.host!==session.playerId?`<button id="remind-host" class="subtle" ${!connected||chatBusy?'disabled':''}>Remind host to start</button>`:''}</div>`;
  document.querySelector('#app').append(section);
  updateChat(state.chat||[]);
  const list=document.querySelector('#chat-messages');list.scrollTop=chatScroll===null?list.scrollHeight:chatScroll;
  const input=document.querySelector('#chat-message');input.oninput=()=>{chatDraft=input.value};
  if(chatFocus){input.focus({preventScroll:true});input.setSelectionRange(chatFocus.start,chatFocus.end)}
  async function send(body,clear=false){
    if(chatBusy||!connected)return;chatBusy=true;section.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{const data=await hooks.sendChat(body);state.chat=data.chat;updateChat(data.chat);if(clear){chatDraft='';const current=document.querySelector('#chat-message');if(current)current.value=''}}
    catch(e){hooks.toast(e.message)}finally{chatBusy=false;document.querySelector('.room-chat')?.querySelectorAll('button').forEach(b=>b.disabled=false)}
  }
  document.querySelector('#chat-form').onsubmit=e=>{e.preventDefault();send({message:document.querySelector('#chat-message').value},true)};
  document.querySelector('#bot-help').onclick=()=>send({message:'/help'});
  const reminder=document.querySelector('#remind-host');if(reminder)reminder.onclick=()=>send({kind:'remind'});
  const view=document.querySelector('#view-rewards');if(view)view.onclick=openProgress;
}
