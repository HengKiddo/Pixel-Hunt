require('dotenv').config();
const express=require('express'),mongoose=require('mongoose'),crypto=require('crypto');
require('./gearItemSchema'); // registers ShopItem (with itemId)
const Profile=require('./profileSchema'),Item=require('./itemSchema'),Shop=mongoose.model('ShopItem');
const quests=require('./questManager');
const Skill=require('./skillItemSchema'),Gear=mongoose.model('GearItem');
const SS=process.env.SESSION_SECRET||'local-dev-secret';
const SEC=(process.env.RENDER||process.env.NODE_ENV==='production'||String(process.env.BASE_URL||'').startsWith('https'))?'; Secure':'';
const app=express();app.set('trust proxy',1);app.use(express.json());const path=require('path'),page=f=>(q,s)=>s.sendFile(path.join(__dirname,f));
app.get('/',page('index.html'));app.get('/game-extra.js',page('game-extra.js')); // only these two files are public
const sign=v=>v+'.'+crypto.createHmac('sha256',SS).update(v).digest('hex');
const unsign=s=>{if(!s)return;const v=s.slice(0,s.lastIndexOf('.'));return sign(v)===s?v:undefined};
const cookie=r=>Object.fromEntries((r.headers.cookie||'').split('; ').filter(Boolean).map(c=>{const i=c.indexOf('=');return[c.slice(0,i),decodeURIComponent(c.slice(i+1))]}));
const auth=(q,s,n)=>{const v=unsign(cookie(q).s);if(!v)return s.status(401).json({error:'Please log in with Discord.'});q.u=JSON.parse(Buffer.from(v,'base64url'));n()};
const get=async u=>(await Profile.findOne({userId:u.id}))||Profile.create({userId:u.id});
const wrap=f=>(q,s)=>f(q,s).catch(e=>{console.error(e);s.status(500).json({error:'Server error.'})});
const view=(p,u)=>({name:u.name,avatar:u.avatar,balance:p.balance,bank:p.bank,level:p.level,xp:p.xp,need:p.level*1500,
 dailyLeft:Math.max(0,86400000-(Date.now()-(p.dailyLastUsed||0))),huntLeft:Math.max(0,3000-(Date.now()-(p.huntLastUsed||0))),
 shovels:p.shovels,equipped:p.equippedShovel,inventory:p.inventory});
 
// --- Accounts: name + password (first login with a new name creates the account) ---
const lf={},hashPw=(p,salt)=>crypto.scryptSync(p,salt,32).toString('hex');
app.post('/api/login',wrap(async(q,s)=>{const name=String(q.body.name||'').trim().slice(0,20),pw=String(q.body.password||''),f=lf[q.ip]||{n:0,until:0};
 if(Date.now()<f.until)return s.status(429).json({error:'Too many wrong tries. Wait 10 minutes.'});
 if(name.length<2||/[<>"'`\\\/]/.test(name))return s.status(400).json({error:'Name must be 2-20 characters (no < > quotes or slashes).'});
 if(pw.length<4)return s.status(400).json({error:'Password must be at least 4 characters.'});
 const id='web:'+name.toLowerCase();let p=await Profile.findOne({userId:id}),made=false;
 if(p&&p.passHash){if(hashPw(pw,p.passSalt)!==p.passHash){f.n++;if(f.n>=8){f.until=Date.now()+6e5;f.n=0}lf[q.ip]=f;return void setTimeout(()=>s.status(400).json({error:'Wrong password for this name.'}),500)}}
 else{const salt=crypto.randomBytes(16).toString('hex');
  if(p)await Profile.updateOne({userId:id},{$set:{passHash:hashPw(pw,salt),passSalt:salt}});else await Profile.create({userId:id,username:name,passHash:hashPw(pw,salt),passSalt:salt});made=true}
 lf[q.ip]={n:0,until:0};
 const v=Buffer.from(JSON.stringify({id,name:(p&&p.username)||name,avatar:null})).toString('base64url');
 s.setHeader('Set-Cookie',`s=${encodeURIComponent(sign(v))}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax${SEC}`);s.json({ok:1,created:made})}));
app.get('/logout',(q,s)=>{s.setHeader('Set-Cookie',`s=; Path=/; Max-Age=0${SEC}`);s.redirect('/')});
 
app.get('/api/me',auth,wrap(async(q,s)=>{const p=await get(q.u);if(p.username!==q.u.name)await Profile.updateOne({userId:q.u.id},{$set:{username:q.u.name}});const sh=p.equippedShovel?await Shop.findOne({itemId:p.equippedShovel}):null,e=p.equippedItems||{},g=p.gear||{},
  GN={thieves_gloves:'Thieves Gloves',police_level_1:'Police Level 1'},nm=x=>x&&x!=='none'?(GN[x]||String(x).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())):null;
 const rn=async(M,id)=>id&&id!=='none'?(((await M.findOne({itemId:id}))||{}).name||nm(id)):null;
 s.json({...view(p,q.u),equip:{shovel:sh&&sh.name,robGear:nm(e.robGear),policeGear:nm(e.policeGear),weapon:await rn(Gear,g.weapon),armor:await rn(Gear,g.armor),helmet:await rn(Gear,g.helmet),skill:await rn(Skill,g.skill)}})}));
 
app.post('/api/daily',auth,wrap(async(q,s)=>{const p=await get(q.u);
 if(Date.now()-(p.dailyLastUsed||0)<864e5)return s.status(400).json({error:'Daily already claimed.'});
 const r=5000+Math.floor(Math.random()*45001);
 await Profile.updateOne({userId:q.u.id},{$inc:{balance:r},$set:{dailyLastUsed:Date.now()}});
 s.json({msg:`Daily reward: +${r.toLocaleString()} coins!`})}));
 
app.post('/api/bank',auth,wrap(async(q,s)=>{const p=await get(q.u),{action,amount}=q.body;
 if(!['deposit','withdraw'].includes(action))return s.status(400).json({error:'Bad action.'});
 const from=action==='deposit'?p.balance:p.bank;
 const n=amount==='all'?from:parseInt(amount);
 if(!(n>0))return s.status(400).json({error:'Enter a positive amount.'});
 if(n>from)return s.status(400).json({error:`Not enough coins to ${action}.`});
 const d=action==='deposit'?n:-n;
 await Profile.updateOne({userId:q.u.id},{$inc:{balance:-d,bank:d}});
 s.json({msg:`${action==='deposit'?'Deposited':'Withdrew'} ${n.toLocaleString()} coins.`})}));
 
// [legendary, epic, uncommon, common, items per hunt]  (same numbers as hunt.js)
const XPB=1.5; // all animal XP is +50%
const SH={'Beginner Shovel':[0,0,2,-2,1],'Wooden Shovel':[0,0,4,-4,0],'Iron Shovel':[0,2,6,-8,2],'Stone Shovel':[0,4,8,-12,3],
 'Golden Shovel':[0,6,10,-16,4],'Highquality Shovel':[2,8,12,-22,5],'Diamond Shovel':[4,10,14,-28,6],'Mythical Shovel':[6,12,16,-34,7],'Divine Shovel':[8,14,18,-40,8]};
app.post('/api/hunt',auth,wrap(async(q,s)=>{const p=await get(q.u),now=Date.now();
 if(now-(p.huntLastUsed||0)<3000)return s.status(400).json({error:'You are tired. Wait a few seconds.'});
 const items=await Item.find({});if(!items.length)return s.status(500).json({error:'No creatures loaded. Restart the server.'});
 const ch={legendary:.3,epic:3.5,rare:15,uncommon:30,common:30,nothing:10,penalty:11.2};let n=1;
 const sh=p.equippedShovel?await Shop.findOne({itemId:p.equippedShovel}):null,b=sh&&SH[sh.name];
 if(b){ch.legendary+=b[0];ch.epic+=b[1];ch.uncommon+=b[2];ch.common+=b[3];n=b[4]||(Math.random()<.5?2:1)}
 const found=[];
 for(let i=0;i<n;i++){const roll=Math.random()*100;let c=0,r;
  for(const[k,v]of Object.entries(ch)){c+=v;if(roll<c){r=k;break}}
  const pool=items.filter(x=>x.rarity===r);if(pool.length)found.push(pool[Math.floor(Math.random()*pool.length)].toObject())}
 const xpA={legendary:500,epic:200,rare:75,uncommon:25,common:10};
 let pay=0,gain=0,add=[];
 for(const f of found){pay+=f.value;gain+=xpA[f.rarity]||0;
  if(f.type==='animal')add.push({name:f.name,emoji:f.emoji,value:f.value,rarity:f.rarity,huntedAt:now+Math.random()})}
 gain=Math.floor(gain*XPB);let lv=p.level,xp=p.xp+gain,up=false;
 while(xp>=lv*1500){xp-=lv*1500;lv++;up=true}
 for(const f of found)if(f.type==='animal')await quests.updateQuestProgress(q.u.id,'hunt',f.rarity);
 const upd={$inc:{balance:pay},$set:{huntLastUsed:now,level:lv,xp}};if(add.length)upd.$push={inventory:{$each:add}};
 await Profile.updateOne({userId:q.u.id},upd);
 s.json({found:found.map(f=>({name:f.name,emoji:f.emoji,rarity:f.rarity,value:f.value,message:f.message})),pay,gain,levelUp:up?lv:null,shovel:sh&&sh.name})}));
 
app.get('/api/shop',auth,wrap(async(q,s)=>s.json(await Shop.find({}).sort({price:1}))));
app.post('/api/buy',auth,wrap(async(q,s)=>{const p=await get(q.u),it=await Shop.findOne({itemId:q.body.itemId});
 if(!it)return s.status(404).json({error:'Unknown item.'});
 if(p.shovels.includes(it.itemId))return s.status(400).json({error:`You already own the ${it.name}.`});
 if(p.level<it.levelRequirement)return s.status(400).json({error:`Need level ${it.levelRequirement}.`});
 if(p.balance<it.price)return s.status(400).json({error:`Need ${it.price.toLocaleString()} coins.`});
 await Profile.updateOne({userId:q.u.id},{$inc:{balance:-it.price},$push:{shovels:it.itemId}});
 s.json({msg:`Bought ${it.name}!`})}));
app.post('/api/equip',auth,wrap(async(q,s)=>{const p=await get(q.u);
 if(!p.shovels.includes(q.body.itemId))return s.status(400).json({error:"You don't own that shovel."});
 await Profile.updateOne({userId:q.u.id},{$set:{equippedShovel:q.body.itemId}});s.json({msg:'Shovel equipped.'})}));
 
app.post('/api/sell',auth,wrap(async(q,s)=>{const p=await get(q.u),{name,qty}=q.body;let keep=[],sold=[];
 for(const i of p.inventory)((!name||i.name===name)&&(qty==='all'||!name||sold.length<(parseInt(qty)||1))?sold:keep).push(i);
 if(!sold.length)return s.status(400).json({error:'Nothing to sell.'});
 const v=sold.reduce((a,i)=>a+i.value,0);
 await Profile.updateOne({userId:q.u.id},{$inc:{balance:v},$set:{inventory:keep}});
 s.json({msg:`Sold ${sold.length} item(s) for ${v.toLocaleString()} coins.`})}));
 
app.get('/api/top',auth,wrap(async(q,s)=>{const f=['balance','level','xp'].includes(q.query.by)?q.query.by:'balance';
 s.json((await Profile.find({}).sort({[f]:-1}).limit(10)).map(u=>({name:u.username||'Player '+u.userId.slice(-4),v:u[f]})))}));
 
 
// ---- casino (rules ported from slots.js, coinflip.js, roulette.js) ----
async function stake(q,s,fixed){const a=fixed??(q.body.bet==='all'?(await get(q.u)).balance:parseInt(q.body.bet));
 if(!(a>0))return void s.status(400).json({error:'Enter a positive bet.'});
 const ok=await Profile.findOneAndUpdate({userId:q.u.id,balance:{$gte:a}},{$inc:{balance:-a}}); // take the stake atomically
 if(!ok)return void s.status(400).json({error:"You don't have enough coins."});
 return{a}}
const settle=async(q,s,g,change,out)=>{await Profile.updateOne({userId:q.u.id},{$inc:{balance:g.a+change}});s.json({...out,bet:g.a,change})};
const SY=[['🍒',2,10,'Cherry'],['🍇',3,9,'Grapes'],['🍊',4,8,'Orange'],['🍋',5,7,'Lemon'],['🔔',10,5,'Bell'],['💰',20,4,'Money Bag'],['💎',50,2,'Diamond'],['7️⃣',100,1,'Jackpot 7']];
const POOL=SY.flatMap(y=>Array(y[2]).fill(y));
app.post('/api/slots',auth,wrap(async(q,s)=>{const g=await stake(q,s);if(!g)return;
 const pick=()=>POOL[Math.floor(Math.random()*POOL.length)],grid=[0,1,2].map(()=>[pick(),pick(),pick()]),st=g.a/3;
 let w=0;const wins=[],msgs=[];
 grid.forEach((r,i)=>{let x=0;
  if(r[0][0]===r[1][0]&&r[1][0]===r[2][0]){x=st*r[0][1];msgs.push(r[0][0]==='7️⃣'?'ROYAL JACKPOT! Three 7s!':`Row ${i+1}: three ${r[0][3]}s!`)}
  else if(r.filter(y=>y[0]==='🍒').length===2){x=st;msgs.push(`Row ${i+1}: two cherries, stake back`)}
  wins.push(x>0);w+=x});
 w=Math.floor(w);
 await settle(q,s,g,w-g.a,{grid:grid.map(r=>r.map(y=>y[0])),wins,msg:msgs.length?msgs.join(' · '):'No winning row... better luck next time!'})}));
app.post('/api/coinflip',auth,wrap(async(q,s)=>{const side=String(q.body.side);
 if(!['heads','tails'].includes(side))return s.status(400).json({error:'Pick heads or tails.'});
 const g=await stake(q,s);if(!g)return;const res=Math.random()<.5?'heads':'tails',won=res===side;
 await settle(q,s,g,won?g.a:-g.a,{result:res,msg:won?`It landed on ${res}. You won!`:`It landed on ${res}. You lost.`})}));
const R=[...Array(37).keys()].map(String).concat('00'),rg=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const RD='1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36'.split(',').map(Number),RB={};
const add=(t,p,v,l,nums)=>(RB[t]??={pay:p,list:[]}).list.push({v,l,nums:nums.map(String)});
R.forEach(n=>add('straight',35,n,n,[n]));
for(let n=1;n<=36;n++){if(n%3)add('split',17,`${n}-${n+1}`,`${n} & ${n+1}`,[n,n+1]);if(n<=33)add('split',17,`${n}-${n+3}`,`${n} & ${n+3}`,[n,n+3])}
[['0','00'],['0','1'],['0','2'],['00','2'],['00','3']].forEach(p=>add('split',17,p.join('-'),p.join(' & '),p));
for(let r=1;r<=12;r++)add('street',11,r,`${3*r-2}-${3*r-1}-${3*r}`,rg(3*r-2,3*r));
for(let n=1;n<=32;n++)if(n%3)add('corner',8,n,`${n}-${n+1}-${n+3}-${n+4}`,[n,n+1,n+3,n+4]);
add('five',6,'five','0-00-1-2-3',['0','00',1,2,3]);
for(let r=1;r<=11;r++)add('line',5,r,`${3*r-2} to ${3*r+3}`,rg(3*r-2,3*r+3));
['1st dozen (1-12)','2nd dozen (13-24)','3rd dozen (25-36)'].forEach((l,i)=>add('dozen',2,i,l,rg(i*12+1,i*12+12)));
['Column 1 (1,4,7...34)','Column 2 (2,5,8...35)','Column 3 (3,6,9...36)'].forEach((l,i)=>add('column',2,i,l,rg(0,11).map(j=>3*j+i+1)));
add('low',1,'low','1 to 18',rg(1,18));add('high',1,'high','19 to 36',rg(19,36));
add('red',1,'red','Red',RD);add('black',1,'black','Black',rg(1,36).filter(n=>!RD.includes(n)));
add('odd',1,'odd','Odd',rg(1,36).filter(n=>n%2));add('even',1,'even','Even',rg(1,36).filter(n=>!(n%2)));
app.get('/api/roulette/bets',auth,(q,s)=>s.json(Object.fromEntries(Object.entries(RB).map(([k,b])=>[k,{pay:b.pay,list:b.list.map(({v,l})=>({v,l}))}]))));
app.post('/api/roulette',auth,wrap(async(q,s)=>{const b=RB[q.body.type],o=b&&b.list.find(x=>String(x.v)===String(q.body.value));
 if(!o)return s.status(400).json({error:'Pick a valid roulette bet.'});
 const g=await stake(q,s);if(!g)return;const w=R[Math.floor(Math.random()*R.length)],won=o.nums.includes(w);
 await settle(q,s,g,won?g.a*b.pay:-g.a,{result:w,msg:won?`${o.l}: the ball landed on ${w}. You win x${b.pay}!`:`The ball landed on ${w}. Your bet on ${o.l} lost.`})}));
 
 
 
// ---- pick-a-prize games: 4 Doors and Lucky Gem (rules from 4door.js / luckygem.js) + daily quests ----
const shuf=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const mk=(id,emoji,label,n=1)=>Array.from({length:n},()=>({id,emoji,label}));
const PK={'4door':{n:4,out:()=>[...mk('x4','💰','Jackpot x4'),...mk('safe','✅','Safe (no loss)'),...mk('half','💸','Unlucky (lose half)'),...mk('bust','💥','Bust (lose all)')]},
 luckygem:{n:9,out:()=>[...mk('x10','👑','Jackpot Gem x10'),...mk('unc','✨','Uncommon Gem x1.5',2),...mk('com','🪙','Common Gem x1',2),...mk('bust','💥','Bust Gem',4)]}};
const MG={x4:'You found the 4x Jackpot! 💰',safe:'You picked the Safe door. Nothing lost. ✅',half:'Unlucky door. You lost half your bet. 💸',bust:'BUST! You lost your bet... 💥',x10:'You found the Jackpot Gem! x10 👑',unc:'Uncommon Gem! x1.5 ✨',com:'Common Gem. You get your bet back. 🪙'};
const SESS={};
app.post('/api/pick/start',auth,wrap(async(q,s)=>{const g=PK[q.body.game];if(!g)return s.status(400).json({error:'Unknown game.'});
 const p=await get(q.u),a=q.body.bet==='all'?p.balance:parseInt(q.body.bet);
 if(!(a>0))return s.status(400).json({error:'Enter a positive bet.'});if(a>p.balance)return s.status(400).json({error:"You don't have enough coins."});
 SESS[q.u.id]={bet:a,out:shuf(g.out()),exp:Date.now()+60000};s.json({n:g.n})}));
app.post('/api/pick/choose',auth,wrap(async(q,s)=>{const se=SESS[q.u.id];delete SESS[q.u.id];
 if(!se||Date.now()>se.exp)return s.status(400).json({error:'That round expired. Press START again.'});
 const i=parseInt(q.body.index);if(!(i>=0&&i<se.out.length))return s.status(400).json({error:'Bad pick.'});
 const g=await stake(q,s,se.bet);if(!g)return;const o=se.out[i],b=se.bet;
 const w=o.id==='half'?b-Math.ceil(b/2):o.id==='unc'?Math.ceil(b*1.5):b*({x4:4,safe:1,x10:10,com:1,bust:0})[o.id];
 await settle(q,s,g,w-b,{outcomes:se.out.map(({emoji,label})=>({emoji,label})),index:i,msg:MG[o.id]})}));
const busyQ=new Set();
app.get('/api/quests',auth,wrap(async(q,s)=>{await get(q.u);s.json(await quests.getQuests(q.u.id))}));
app.post('/api/quests/claim',auth,wrap(async(q,s)=>{if(busyQ.has(q.u.id))return s.status(400).json({error:'Claiming...'});busyQ.add(q.u.id);
 try{await get(q.u);const L=await quests.getQuests(q.u.id);let tot=0;
  for(const x of L)if(x.progress>=x.target&&!x.completed){tot+=x.reward;x.completed=true}
  if(!tot)return s.status(400).json({error:'No new rewards to claim.'});
  await Profile.updateOne({userId:q.u.id},{$inc:{balance:tot},$set:{'quests.daily':L}});s.json({msg:`You claimed ${tot.toLocaleString()} coins!`})}
 finally{busyQ.delete(q.u.id)}}));
 
 
// ---- auto hunt (rules from autohunt.js): fund workers, they hunt once a minute, claim the loot ----
const SK=['worker','workerXP','strategy','radar','duration'],SPC=.25,PER=60000;
const ahInfo=p=>{const a=p.autohunt,now=Date.now(),on=a.startTime>0;
 return{active:on,start:a.startTime,end:a.endTime,now,skills:Object.fromEntries(SK.map(k=>[k,a.skills[k]])),
  ready:on?Math.floor(Math.min(now-a.startTime,a.endTime-a.startTime)/PER):0,total:on?Math.floor((a.endTime-a.startTime)/PER):0}};
app.get('/api/autohunt',auth,wrap(async(q,s)=>s.json(ahInfo(await get(q.u)))));
app.post('/api/autohunt/start',auth,wrap(async(q,s)=>{const p=await get(q.u),c=parseInt(q.body.amount);
 if(p.autohunt.startTime>0)return s.status(400).json({error:'Your workers are already hunting. Claim first.'});
 if(!(c>0))return s.status(400).json({error:'Enter how many coins to fund.'});
 if(p.balance<c)return s.status(400).json({error:`You need ${c.toLocaleString()} coins.`});
 const dur=Math.min(c*SPC*1000,p.autohunt.skills.duration*30*60000);
 if(dur<PER)return s.status(400).json({error:'Fund at least 240 coins (1 minute of hunting).'});
 const cost=Math.floor(dur/1000/SPC),st=Date.now();
 const ok=await Profile.findOneAndUpdate({userId:q.u.id,balance:{$gte:cost},'autohunt.startTime':0},{$inc:{balance:-cost},$set:{'autohunt.startTime':st,'autohunt.endTime':st+dur}});
 if(!ok)return s.status(400).json({error:'Could not start. Check your coins.'});
 s.json({msg:`Paid ${cost.toLocaleString()} coins. Your workers will hunt for ${Math.round(dur/60000)} minutes.`})}));
const RW={legendary:.5,epic:3.5,rare:11,uncommon:30,common:35,nothing:10,penalty:10};
app.post('/api/autohunt/claim',auth,wrap(async(q,s)=>{const p=await get(q.u),a=p.autohunt;
 if(!(a.startTime>0))return s.status(400).json({error:'No active hunt. Start one first.'});
 const done=Math.floor(Math.min(Date.now()-a.startTime,a.endTime-a.startTime)/PER);
 if(done<1)return s.status(400).json({error:'Your workers have not found anything yet. Wait a minute.'});
 if(!await Profile.findOneAndUpdate({userId:q.u.id,'autohunt.startTime':a.startTime},{$set:{'autohunt.startTime':0,'autohunt.endTime':0}}))return s.status(400).json({error:'Already claimed.'});
 const sk=a.skills,by={};(await Item.find({})).forEach(i=>(by[i.rarity]??=[]).push(i));
 const ch={...RW},r=sk.radar-1,g=sk.strategy-1;ch.nothing-=r*2;ch.penalty-=r*2;ch.common+=r*4;ch.legendary+=g*.1;ch.epic+=g*.2;ch.rare+=g*.3;ch.uncommon+=g*.4;ch.common-=g;
 const one=()=>{const x=Math.random()*100;let c=0;for(const[k,v]of Object.entries(ch)){c+=Math.max(0,v);if(x<c){const l=by[k];return l&&l.length?l[Math.floor(Math.random()*l.length)]:null}}return null};
 const xpA={legendary:500,epic:200,rare:75,uncommon:25,common:10},bonus=Math.min(.95,(sk.worker-1)*.15),found=[];let xp=0;
 const take=it=>{if(it&&it.type==='animal'){found.push({name:it.name,emoji:it.emoji,value:it.value,rarity:it.rarity,huntedAt:Date.now()+Math.random()});xp+=xpA[it.rarity]||0}};
 for(let i=0;i<done;i++){take(one());if(Math.random()<bonus)take(one())}
 xp=Math.floor(xp*XPB*(1+(sk.workerXP-1)*.05));let lv=p.level,cx=p.xp+xp,up=false;while(cx>=lv*1500){cx-=lv*1500;lv++;up=true}
 const u={$set:{level:lv,xp:cx}};if(found.length)u.$push={inventory:{$each:found}};await Profile.updateOne({userId:q.u.id},u);
 const tally={};found.forEach(f=>(tally[f.name]??={name:f.name,emoji:f.emoji,rarity:f.rarity,count:0}).count++);
 s.json({hunts:done,xp,levelUp:up?lv:null,loot:Object.values(tally),msg:`Auto hunt done: ${done} hunts, ${found.length} animals, +${xp.toLocaleString()} XP.`})}));
app.post('/api/autohunt/upgrade',auth,wrap(async(q,s)=>{const k=q.body.skill;if(!SK.includes(k))return s.status(400).json({error:'Unknown skill.'});
 const p=await get(q.u),lv=p.autohunt.skills[k],cost=lv*10000,key='autohunt.skills.'+k;
 if(!await Profile.findOneAndUpdate({userId:q.u.id,balance:{$gte:cost},[key]:lv},{$inc:{balance:-cost,[key]:1}}))return s.status(400).json({error:`You need ${cost.toLocaleString()} coins.`});
 s.json({msg:`${k} is now level ${lv+1}! (-${cost.toLocaleString()} coins)`})}));
 
 
// ---- gear bag: shovels, rob gear, police gear, weapon, armor, helmet, skill ----
const slug=n=>String(n).toLowerCase().replace(/ /g,'_');
app.get('/api/gearbag',auth,wrap(async(q,s)=>{const p=await get(q.u),e=p.equippedItems||{},g=p.gear||{},out={shovels:[],robGear:[],policeGear:[],weapon:[],armor:[],helmet:[],skill:[]};
 (await Shop.find({itemId:{$in:p.shovels}})).forEach(i=>out.shovels.push({id:i.itemId,name:i.name,equipped:p.equippedShovel===i.itemId}));
 (p.inventorygearrob||[]).forEach(i=>{const id=slug(i.name),k=id.startsWith('police')?'policeGear':'robGear';out[k].push({id,name:i.name,qty:i.quantity,equipped:e[k]===id})});
 const inv=(g.inventory||[]).map(x=>x.itemId).filter(Boolean);
 (await Gear.find({itemId:{$in:inv}})).forEach(i=>{const k=String(i.type).toLowerCase();if(out[k])out[k].push({id:i.itemId,name:i.name,equipped:g[k]===i.itemId})});
 (await Skill.find({itemId:{$in:inv}})).forEach(i=>out.skill.push({id:i.itemId,name:i.name,desc:i.description,equipped:g.skill===i.itemId}));
 s.json(out)}));
app.post('/api/gearbag/equip',auth,wrap(async(q,s)=>{const{kind,id,action}=q.body,p=await get(q.u),bad=m=>void s.status(400).json({error:m}),un=action==='unequip';let set;
 if(!['shovel','robGear','policeGear','weapon','armor','helmet','skill'].includes(kind))return bad('Bad slot.');
 if(kind==='shovel'){if(!un&&!p.shovels.includes(id))return bad("You don't own that shovel.");set={equippedShovel:un?null:id}}
 else if(kind==='robGear'||kind==='policeGear'){
  if(!un&&!(p.inventorygearrob||[]).some(i=>slug(i.name)===id&&(id.startsWith('police')?'policeGear':'robGear')===kind))return bad("You don't own that gear.");
  set={['equippedItems.'+kind]:un?null:id}}
 else{if(!un&&!(p.gear.inventory||[]).some(x=>x.itemId===id))return bad("You don't own that item.");
  if(!un&&kind!=='skill'){const it=await Gear.findOne({itemId:id});if(!it||String(it.type).toLowerCase()!==kind)return bad('That item does not fit this slot.')}
  set={['gear.'+kind]:un?'none':id}}
 await Profile.updateOne({userId:q.u.id},{$set:set});s.json({msg:un?'Unequipped.':'Equipped!'})}));
 
 
// ---- gear shop: battle gear + skills (buy.js) and rob gear (robgearshop.js) ----
const ROB={loot_bag:{name:'Loot Bag',price:1000000,description:'Grants the ability to rob others.',unique:true},thieves_gloves:{name:'Thieves Gloves',price:2000000,description:'Increases rob success chance by 5%.'},
 police_level_1:{name:'Police Level 1',price:5000000,description:"Decreases a robber's success chance by 10% (when you are robbed)."},time_travel:{name:'Time Travel',price:50000000,description:'Reduces your rob cooldown by 10 seconds.',unique:true}};
app.get('/api/gearshop',auth,wrap(async(q,s)=>{const p=await get(q.u),own=new Set((p.gear.inventory||[]).map(x=>x.itemId)),rob=p.inventorygearrob||[];
 s.json({gear:(await Gear.find({}).sort({price:1})).map(i=>({id:i.itemId,name:i.name,type:i.type,description:i.description,price:i.price,level:i.levelRequirement,owned:own.has(i.itemId),
   stats:{attack:i.attack,defense:i.defense,hp:i.hp,critChance:i.critChance,critDamage:i.critDamage,critDefense:i.critDefense}})),
  skills:(await Skill.find({}).sort({price:1})).map(i=>({id:i.itemId,name:i.name,description:i.description,price:i.price,level:i.levelRequirement,owned:own.has(i.itemId)})),
  rob:Object.entries(ROB).map(([id,i])=>({id,name:i.name,description:i.description,price:i.price,unique:!!i.unique,qty:(rob.find(x=>x.name===i.name)||{}).quantity||0}))})}));
app.post('/api/gearshop/buy',auth,wrap(async(q,s)=>{const{kind,id}=q.body,p=await get(q.u),bad=m=>void s.status(400).json({error:m});
 if(kind==='rob'){const it=ROB[id];if(!it)return bad('Unknown item.');const has=(p.inventorygearrob||[]).some(x=>x.name===it.name);
  if(it.unique&&has)return bad(`You already own the ${it.name}.`);
  if(!await Profile.findOneAndUpdate({userId:q.u.id,balance:{$gte:it.price}},{$inc:{balance:-it.price}}))return bad(`You need ${it.price.toLocaleString()} coins.`);
  if(has)await Profile.updateOne({userId:q.u.id,'inventorygearrob.name':it.name},{$inc:{'inventorygearrob.$.quantity':1}});
  else await Profile.updateOne({userId:q.u.id},{$push:{inventorygearrob:{name:it.name,quantity:1}}});
  return s.json({msg:`Bought ${it.name}!`})}
 const it=kind==='gear'?await Gear.findOne({itemId:id}):kind==='skill'?await Skill.findOne({itemId:id}):null;if(!it)return bad('Unknown item.');
 if((p.gear.inventory||[]).some(x=>x.itemId===id))return bad(`You already own the ${it.name}.`);
 if(p.level<it.levelRequirement)return bad(`You need level ${it.levelRequirement}.`);
 if(!await Profile.findOneAndUpdate({userId:q.u.id,balance:{$gte:it.price}},{$inc:{balance:-it.price}}))return bad(`You need ${it.price.toLocaleString()} coins.`);
 await Profile.updateOne({userId:q.u.id},{$push:{'gear.inventory':{itemId:id}}});s.json({msg:`Bought ${it.name}!`})}));
 
// ---- players + rob (rules from rob.js) ----
app.get('/api/players',auth,wrap(async(q,s)=>{const e=String(q.query.q||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 s.json((await Profile.find({userId:{$ne:q.u.id},...(e?{username:new RegExp(e,'i')}:{})}).sort({balance:-1}).limit(30).select('username userId balance level'))
  .map(u=>({id:u.userId,name:u.username||u.userId.replace(/^web:/,''),level:u.level,balance:u.balance})))}));
const robCd={},hasRob=(pp,n)=>(pp.inventorygearrob||[]).some(i=>String(i.name).toLowerCase()===n);
app.post('/api/rob',auth,wrap(async(q,s)=>{const bad=m=>void s.status(400).json({error:m}),p=await get(q.u),tid=String(q.body.targetId||''),left=(robCd[q.u.id]||0)-Date.now();
 if(left>0)return bad(`Wait ${Math.ceil(left/1000)}s before robbing again.`);if(tid===q.u.id)return bad("You can't rob yourself!");
 const t=await Profile.findOne({userId:tid});if(!t)return bad("That player doesn't exist.");
 if(!hasRob(p,'loot bag'))return bad('You need a Loot Bag to rob. Buy one in SHOP > ROB GEAR.');
 if(p.balance<500000)return bad('You need at least 500,000 coins to attempt a robbery.');
 if(t.balance<1000000)return bad(`${t.username||'That player'} needs at least 1,000,000 coins to be robbed.`);
 let c=.1;if(hasRob(p,'thieves gloves'))c+=.05;if(hasRob(p,"robber's mask"))c+=.05;if(hasRob(t,'police level 1'))c-=.1;c=Math.max(0,Math.min(1,c));
 robCd[q.u.id]=Date.now()+300000-(hasRob(p,'time travel')?10000:0);
 const amt=Math.floor(t.balance*.1),tn=t.username||tid;
 if(Math.random()<c){if(await Profile.findOneAndUpdate({userId:tid,balance:{$gte:amt}},{$inc:{balance:-amt}})){
  await Profile.updateOne({userId:q.u.id},{$inc:{balance:amt}});return s.json({success:true,amount:amt,msg:`You robbed ${tn} and stole ${amt.toLocaleString()} coins!`})}}
 const pen=Math.floor(p.balance*.1);await Profile.updateOne({userId:q.u.id},{$inc:{balance:-pen}});
 s.json({success:false,amount:pen,msg:`${tn} caught you! You lost ${pen.toLocaleString()} coins.`})}));
 
// ---- battle: turn-based PvP (rules from battle.js; the page polls for updates) ----
const BT={},UB={};
async function bside(id,name){const p=await get({id}),st={attack:5,defense:5,hp:0,critChance:5,critDamage:1.5,critDefense:0},
 ids=[p.gear.weapon,p.gear.armor,p.gear.helmet].filter(x=>x&&x!=='none');
 if(ids.length)(await Gear.find({itemId:{$in:ids}})).forEach(i=>{st.attack+=i.attack||0;st.defense+=i.defense||0;st.hp+=i.hp||0;st.critChance+=i.critChance||0;st.critDefense+=i.critDefense||0;if((i.critDamage||0)>st.critDamage)st.critDamage=i.critDamage});
 const sk=p.gear.skill&&p.gear.skill!=='none'?await Skill.findOne({itemId:p.gear.skill}):null;
 return{id,name,st,max:100+st.hp,hp:100+st.hp,cd:0,dmgB:0,dmgM:1,defB:0,defA:0,sk:sk&&{name:sk.name,cd:sk.cooldown,effect:{type:sk.effect.type,amount:sk.effect.amount,multiplier:sk.effect.multiplier,duration:sk.effect.duration}}}}
const bview=(m,uid)=>{const i=m.p[0].id===uid?0:1,a=m.p[i],b=m.p[1-i];
 if(!a.st)return{id:m.id,status:m.status,bet:m.bet,msg:m.msg||'',opp:{name:b.name},n:0};
 return{id:m.id,status:m.status,bet:m.bet,n:m.log.length,turn:m.status==='active'?(m.turn===i?'you':'opp'):null,
  you:{name:a.name,hp:Math.max(0,a.hp),max:a.max,atk:a.st.attack,def:a.st.defense+(a.defB>0?a.defA:0),skill:a.sk&&{name:a.sk.name,cd:a.cd}},
  opp:{name:b.name,hp:Math.max(0,b.hp),max:b.max,atk:b.st.attack,def:b.st.defense+(b.defB>0?b.defA:0)},
  log:m.log.slice(-8),winner:m.winner==null?null:(m.winner===i?'you':'opp'),msg:m.msg||''}};
async function bfinish(m,w,why){if(m.status==='done')return;m.status='done';m.winner=w;m.end=Date.now();const W=m.p[w],L=m.p[1-w],lp=await Profile.findOne({userId:L.id}),pay=Math.min(m.bet,lp?lp.balance:0);
 await Profile.updateOne({userId:L.id},{$inc:{balance:-pay}});await Profile.updateOne({userId:W.id},{$inc:{balance:pay}});
 m.msg=`${W.name} won ${pay.toLocaleString()} coins${why?' ('+why+')':''}!`;m.log.push(m.msg)}
const busyB=u=>UB[u]&&BT[UB[u]]&&BT[UB[u]].status!=='done';
app.get('/api/battle/state',auth,wrap(async(q,s)=>{const now=Date.now(),uid=q.u.id;
 for(const id of Object.keys(BT)){const m=BT[id];
  if(m.status==='pending'&&now-m.t>60000){m.status='done';m.msg='Challenge expired.';m.end=now}
  else if(m.status==='active'&&now-m.t>90000)await bfinish(m,1-m.turn,'ran out of time');
  if(m.status==='done'&&now-m.end>120000){m.p.forEach(x=>{if(UB[x.id]===id)delete UB[x.id]});delete BT[id]}}
 const m=BT[UB[uid]];s.json({match:m?bview(m,uid):null,incoming:Object.values(BT).filter(x=>x.status==='pending'&&x.p[1].id===uid).map(x=>({id:x.id,from:x.p[0].name,bet:x.bet}))})}));
app.post('/api/battle/challenge',auth,wrap(async(q,s)=>{const bad=m=>void s.status(400).json({error:m}),bet=parseInt(q.body.bet),tid=String(q.body.targetId||'');
 if(!(bet>0))return bad('Type a positive battle bet first.');if(tid===q.u.id)return bad("You can't battle yourself.");
 if(busyB(q.u.id))return bad('You are already in a battle or waiting for a reply.');if(busyB(tid)&&BT[UB[tid]].status==='active')return bad('That player is in another battle.');
 const[a,b]=await Promise.all([get(q.u),Profile.findOne({userId:tid})]);if(!b)return bad("That player doesn't exist.");
 if(a.balance<bet)return bad("You don't have enough coins for that bet.");if(b.balance<bet)return bad(`${b.username||'They'} can't afford that bet.`);
 const id=crypto.randomBytes(6).toString('hex');BT[id]={id,status:'pending',bet,t:Date.now(),turn:0,log:[],p:[{id:q.u.id,name:q.u.name},{id:tid,name:b.username||tid}]};UB[q.u.id]=id;
 s.json({msg:`Challenge sent to ${b.username||tid} for ${bet.toLocaleString()} coins!`})}));
app.post('/api/battle/respond',auth,wrap(async(q,s)=>{const m=BT[q.body.id],bad=x=>void s.status(400).json({error:x});
 if(!m||m.status!=='pending'||m.p[1].id!==q.u.id)return bad('That challenge is gone.');
 if(!q.body.accept){m.status='done';m.end=Date.now();m.msg=`${m.p[1].name} declined the battle.`;return s.json({msg:'Declined.'})}
 if(busyB(q.u.id))return bad('Finish your current battle first.');
 const[A,B]=await Promise.all([get({id:m.p[0].id}),get({id:m.p[1].id})]);
 if(A.balance<m.bet||B.balance<m.bet){m.status='done';m.end=Date.now();m.msg='Someone no longer has enough coins.';return bad(m.msg)}
 m.p=[await bside(m.p[0].id,m.p[0].name),await bside(m.p[1].id,m.p[1].name)];m.status='active';m.turn=0;m.t=Date.now();
 m.log=[`${m.p[0].name} vs ${m.p[1].name} - the battle begins!`];UB[q.u.id]=m.id;s.json({msg:'Battle accepted!'})}));
app.post('/api/battle/act',auth,wrap(async(q,s)=>{const m=BT[q.body.id],bad=x=>void s.status(400).json({error:x});if(!m||m.status!=='active')return bad('No active battle.');
 const me=m.p[0].id===q.u.id?0:m.p[1].id===q.u.id?1:-1,act=q.body.action;if(me<0)return bad('This is not your battle.');
 const a=m.p[me],b=m.p[1-me];
 if(act==='forfeit'){m.log.push(`${a.name} forfeited!`);await bfinish(m,1-me);return s.json({ok:1})}
 if(m.turn!==me)return bad("It's not your turn!");
 if(act==='attack'){const crit=Math.random()*100<a.st.critChance,cm=crit?a.st.critDamage:1,red=crit?Math.max(0,(100-b.st.critDefense)/100):1,def=b.st.defense+(b.defB>0?b.defA:0);
  let d=Math.floor(Math.max(1,a.st.attack-def)*cm*red);if(a.dmgB>0){d=Math.floor(d*a.dmgM);a.dmgB--}d=Math.max(1,d+Math.floor(Math.random()*5-2));b.hp-=d;
  m.log.push(crit?`💥 ${a.name} lands a CRITICAL HIT for ${d} damage!`:`${a.name} attacks for ${d} damage.`)}
 else if(act==='skill'){if(!a.sk||a.cd>0)return bad('Your skill is not ready.');const e=a.sk.effect;
  if(e.type==='HEAL'){const h=Math.min(a.max-a.hp,e.amount||0);a.hp+=h;m.log.push(`✨ ${a.name} used ${a.sk.name} and healed ${h} HP!`)}
  else if(e.type==='DAMAGE_BOOST'){a.dmgB=e.duration||1;a.dmgM=e.multiplier||1;m.log.push(`✨ ${a.name} used ${a.sk.name}! The next attack is stronger.`)}
  else if(e.type==='DEFENSE_BOOST'){a.defB=e.duration||1;a.defA=e.amount||0;m.log.push(`✨ ${a.name} used ${a.sk.name}! Defense is up.`)}
  a.cd=a.sk.cd}
 else return bad('Unknown action.');
 if(a.cd>0)a.cd--;if(act!=='skill'&&a.defB>0)a.defB--;
 if(b.hp<=0){await bfinish(m,me);return s.json({ok:1})}
 m.turn=1-me;m.t=Date.now();s.json({ok:1})}));
 
// ---- admin (unlock with ADMIN_PASSWORD from .env) ----
const AP=process.env.ADMIN_PASSWORD||((process.env.RENDER||process.env.NODE_ENV==='production')?crypto.randomBytes(24).toString('hex'):'admin123'); // online without ADMIN_PASSWORD = admin page locked
if(!process.env.ADMIN_PASSWORD)console.log(process.env.RENDER||process.env.NODE_ENV==='production'?'NOTE: ADMIN_PASSWORD is not set, so the admin page is locked. Add it in Render > Environment.':'NOTE: using the default admin password "admin123". Create a .env file with ADMIN_PASSWORD=yourpassword to change it.');
const isAdm=q=>unsign(cookie(q).a)==='admin',AD=process.env.ADMIN_PATH||'/admin',fails={};
app.get(AD,(q,s)=>s.sendFile(require('path').join(__dirname,'admin.html'))); // not linked anywhere in the game
const adm=(q,s,n)=>isAdm(q)?n():s.status(403).json({error:'Admin only. Unlock the admin tab first.'});
app.get('/api/admin/status',(q,s)=>s.json({admin:isAdm(q)}));
app.post('/api/admin/login',(q,s)=>{const f=fails[q.ip]||{n:0,until:0};
 if(Date.now()<f.until)return s.status(429).json({error:'Too many wrong tries. Wait 10 minutes.'});
 if(String(q.body.password)!==AP){f.n++;if(f.n>=5){f.until=Date.now()+6e5;f.n=0}fails[q.ip]=f;return void setTimeout(()=>s.status(400).json({error:'Wrong password.'}),600)}
 fails[q.ip]={n:0,until:0};s.setHeader('Set-Cookie',`a=${encodeURIComponent(sign('admin'))}; HttpOnly; Path=/; Max-Age=43200; SameSite=Lax${SEC}`);s.json({ok:1})});
app.get('/api/admin/players',adm,wrap(async(q,s)=>{const e=String(q.query.q||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),
 f=e?{$or:[{username:new RegExp(e,'i')},{userId:new RegExp(e,'i')}]}:{};
 s.json(await Profile.find(f).sort({balance:-1}).limit(30).select('userId username balance bank level'))}));
app.get('/api/admin/player',adm,wrap(async(q,s)=>{const p=await Profile.findOne({userId:String(q.query.id)});
 if(!p)return s.status(404).json({error:'Player not found.'});
 const sh=await Shop.find({itemId:{$in:p.shovels}}),m={};
 p.inventory.forEach(i=>(m[i.name]??={name:i.name,emoji:i.emoji,rarity:i.rarity,value:i.value,qty:0}).qty++);
 s.json({userId:p.userId,username:p.username,balance:p.balance,bank:p.bank,level:p.level,xp:p.xp,equipped:p.equippedShovel,
  animals:Object.values(m),shovels:sh.map(x=>({itemId:x.itemId,name:x.name}))})}));
app.post('/api/admin/money',adm,wrap(async(q,s)=>{const a=parseInt(q.body.amount),id=String(q.body.userId),m=q.body.mode;
 if(!(a>0))return s.status(400).json({error:'Enter a positive amount.'});
 if(!['give','remove'].includes(m))return s.status(400).json({error:'Bad mode.'});
 const p=await Profile.findOne({userId:id});if(!p)return s.status(404).json({error:'Player not found.'});
 const d=m==='give'?a:-Math.min(a,p.balance);
 const n=await Profile.findOneAndUpdate({userId:id},{$inc:{balance:d}},{new:true});
 console.log(`[admin] ${m} ${a} coins: ${id}`);
 s.json({msg:`${m==='give'?'Gave':'Removed'} ${Math.abs(d).toLocaleString()} coins ${m==='give'?'to':'from'} ${p.username||id}. Wallet now ${n.balance.toLocaleString()}.`})}));
app.get('/api/admin/catalog',adm,wrap(async(q,s)=>s.json({
 animals:(await Item.find({type:'animal'}).sort({value:1})).map(i=>({name:i.name,emoji:i.emoji,value:i.value,rarity:i.rarity})),
 shovels:(await Shop.find({}).sort({price:1})).map(i=>({itemId:i.itemId,name:i.name}))})));
app.post('/api/admin/item',adm,wrap(async(q,s)=>{const id=String(q.body.userId),{action,kind}=q.body,qty=Math.min(1000,Math.max(1,parseInt(q.body.qty)||1)),
 p=await Profile.findOne({userId:id});let msg;const bad=(c,e)=>void s.status(c).json({error:e});
 if(!p)return bad(404,'Player not found.');if(!['give','remove'].includes(action))return bad(400,'Bad action.');
 if(kind==='animal'){const it=await Item.findOne({name:q.body.name,type:'animal'});if(!it)return bad(404,'Unknown animal.');
  if(action==='give'){const add=Array.from({length:qty},()=>({name:it.name,emoji:it.emoji,value:it.value,rarity:it.rarity,huntedAt:Date.now()+Math.random()}));
   await Profile.updateOne({userId:id},{$push:{inventory:{$each:add}}});msg=`Gave ${qty}x ${it.emoji} ${it.name}.`}
  else{let left=qty;const keep=[];for(const i of p.inventory){if(left>0&&i.name===it.name)left--;else keep.push(i)}
   await Profile.updateOne({userId:id},{$set:{inventory:keep}});msg=`Removed ${qty-left}x ${it.emoji} ${it.name}.`}}
 else if(kind==='shovel'){const sh=await Shop.findOne({itemId:q.body.itemId});if(!sh)return bad(404,'Unknown shovel.');const has=p.shovels.includes(sh.itemId);
  if(action==='give'){if(has)return bad(400,'Player already owns it.');await Profile.updateOne({userId:id},{$push:{shovels:sh.itemId}});msg=`Gave ${sh.name}.`}
  else{if(!has)return bad(400,"Player doesn't own it.");const u={$pull:{shovels:sh.itemId}};if(p.equippedShovel===sh.itemId)u.$set={equippedShovel:null};
   await Profile.updateOne({userId:id},u);msg=`Removed ${sh.name}.`}}
 else return bad(400,'Bad item kind.');
 console.log(`[admin] ${action} ${kind} -> ${id}: ${msg}`);s.json({msg})}));
 
require('./games2')({app,auth,adm,wrap,Profile,get,crypto,mongoose});
 
app.get('/healthz',(q,s)=>s.json({ok:mongoose.connection.readyState===1}));
// Cleans up a pasted Atlas link: removes leftover < > around user/password and makes symbols like @ : / # % in them safe.
function fixMongoUrl(u){const m=String(u||'').trim().replace(/^["']|["']$/g,'').match(/^(mongodb(?:\+srv)?:\/\/)(.*)@([^@\/?]+)(.*)$/);if(!m)return String(u||'').trim();
 const[,sch,cred,host,rest]=m,i=cred.indexOf(':'),clean=x=>{x=x.trim().replace(/^<(.*)>$/,'$1');try{x=decodeURIComponent(x)}catch(e){}return encodeURIComponent(x)};
 return sch+(i<0?clean(cred):clean(cred.slice(0,i))+':'+clean(cred.slice(i+1)))+'@'+host+rest}
async function db(){
 const hosted=!!(process.env.RENDER||process.env.NODE_ENV==='production');
 if(hosted&&!process.env.MONGODB_SRV)throw new Error('MONGODB_SRV is not set. On Render: open your service > Environment and add MONGODB_SRV with your MongoDB Atlas connection string.');
 const url=process.env.MONGODB_SRV?fixMongoUrl(process.env.MONGODB_SRV):'mongodb://127.0.0.1:27017/pixelhunt';
 try{await mongoose.connect(url,{serverSelectionTimeoutMS:process.env.MONGODB_SRV?20000:2500});console.log('DB connected:',url.replace(/\/\/.*@/,'//***@').split('?')[0],'| database:',mongoose.connection.name);}
 catch(e){if(process.env.MONGODB_SRV)throw new Error('Cannot connect to MONGODB_SRV ('+e.message+'). Check: 1) the password in the link is right (no < > around it), 2) Atlas > Network Access allows 0.0.0.0/0, 3) the database user exists.');console.log('No MongoDB found - starting built-in database (first run downloads it once)...');
  const{MongoMemoryServer}=require('mongodb-memory-server'),fs=require('fs');fs.mkdirSync('./localdb',{recursive:true});
  const m=await MongoMemoryServer.create({instance:{dbPath:'./localdb',storageEngine:'wiredTiger'}});
  await mongoose.connect(m.getUri('pixelhunt'));console.log('DB: built-in, saved in ./localdb');}
 if(!await Item.countDocuments())await Item.insertMany(require('./items'));
 if(!await Gear.countDocuments())await Gear.insertMany(require('./gear'));
 if(!await Skill.countDocuments())await Skill.insertMany(require('./skills'));
 if(!await Shop.countDocuments())await Shop.insertMany(require('./shop'));}
db().then(()=>{const P=process.env.PORT||3000;app.listen(P,process.env.HOST||(process.env.PORT?'0.0.0.0':'127.0.0.1'),()=>console.log(`\n  Pixel Hunt running -> http://localhost:${P}\n`))}).catch(e=>{console.error('Could not start:',e.message);process.exit(1)});