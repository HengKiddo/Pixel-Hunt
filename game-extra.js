// Extra games and features: Blackjack, Kla Klouk, Horse Racing, POK, Guess the Number (casino),
// Rock-Paper-Scissors, bank heists and coin transfers (PVP), Music, Top-up and Announcements.
// Loaded after the main script, so it uses its helpers ($, api, act, toast, load, me, spr, esc, n, f, ca, cg, clog...).

// ---------- tiny 3x5 pixel font ----------
const F3 = { A:'010101111101101', B:'110101110101110', C:'011100100100011', D:'110101101101110', E:'111100110100111', F:'111100110100100', G:'011100101101011', H:'101101111101101', I:'111010010010111', J:'001001001101010', K:'101101110101101', L:'100100100100111', M:'101111111101101', N:'110101101101101', O:'010101101101010', P:'110101110100100', Q:'010101101110011', R:'110101110101101', S:'011100010001110', T:'111010010010010', U:'101101101101111', V:'101101101101010', W:'101101111111101', X:'101101010101101', Y:'101101010010010', Z:'111001010100111',
  '0':'111101101101111', '1':'010110010010111', '2':'110001010100111', '3':'110001010001110', '4':'101101111001001', '5':'111100110001110', '6':'011100111101111', '7':'111001010010010', '8':'111101111101111', '9':'111101111001110', '!':'010010010000010', '?':'110001010000010', '+':'000010111010000', '-':'000000111000000', '/':'001001010100100', ':':'000010000010000', '.':'000000000000010', ',':'000000000010100' };
function txt(g, s, x, y, col, sc = 1) { g.fillStyle = col; let X = x; for (const ch of String(s).toUpperCase()) { const b = F3[ch]; if (b) for (let i = 0; i < 15; i++) if (b[i] === '1') g.fillRect(X + (i % 3) * sc, y + Math.floor(i / 3) * sc, sc, sc); X += 4 * sc; } return X; }
const tw = (s, sc = 1) => String(s).length * 4 * sc - sc;
const ctxt = (g, s, y, col, sc = 1) => txt(g, s, Math.round(80 - tw(s, sc) / 2), y, col, sc);
const RR = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };

// ---------- pixel playing cards ----------
const SUIT = { H: '0101011111111110111000100', D: '0010001110111110111000100', S: '0010001110111111010100100', C: '0111001110111111101100100' };
function suit(g, s, x, y, sc, col) { g.fillStyle = col; const b = SUIT[s]; for (let i = 0; i < 25; i++) if (b[i] === '1') g.fillRect(x + (i % 5) * sc, y + Math.floor(i / 5) * sc, sc, sc); }
function card(g, x, y, c) { // c = {r,s} or null for face down
  RR(g, '#000', x - 1, y - 1, 20, 28);
  if (!c) { RR(g, '#b13e53', x, y, 18, 26); for (let i = 0; i < 18; i += 3) for (let j = 0; j < 26; j += 3) if ((i + j) % 2 === 0) RR(g, '#ef7d57', x + i, y + j, 1, 1); RR(g, '#ffcd75', x + 3, y + 3, 12, 20); RR(g, '#b13e53', x + 4, y + 4, 10, 18); return; }
  const red = c.s === 'H' || c.s === 'D', col = red ? '#b13e53' : '#1a1c2c';
  RR(g, '#f4f4f4', x, y, 18, 26); txt(g, c.r, x + 2, y + 2, col); suit(g, c.s, x + 2, y + 8, 1, col); suit(g, c.s, x + 6, y + 13, 2, col);
}

// ---------- helpers ----------
const G = { bj: null, bjCards: { p: [], d: [] }, bjEnd: 0, kk: { mode: 'solo', picks: [], dice: null, rollAt: -999 }, L: { kk: null, hr: null, pok: null }, gtn: null, hrAt: 0 };
const KKI = [['tiger', '🐅', 'ខ្លា', 'Tiger'], ['lobster', '🦞', 'បង្កង', 'Lobster'], ['fish', '🐟', 'ត្រី', 'Fish'], ['crab', '🦀', 'ក្តាម', 'Crab'], ['rooster', '🐓', 'មាន់', 'Rooster'], ['gourd', '🍐', 'ឃ្លោក', 'Gourd']];
const KKE = Object.fromEntries(KKI.map(k => [k[0], k[1]])), KKS = {};
const kkSpr = id => KKS[id] ??= spr(KKE[id], 18);
const NEWG = ['bj', 'kk', 'hr', 'pok', 'gtn'];
async function cAct(u, b) { try { const r = await api(u, b); if (r.error) { clog(`<span class=penalty>${esc(r.error)}</span>`); toast(r.error); } return r; } catch (e) { return { error: 'offline' }; } }
const coinRain = () => { for (let i = 0; i < 40; i++) ca.p.push({ x: Math.random() * 160, y: -Math.random() * 60, v: 1 + Math.random() * 1.5 }); };
const btn = (t, k, fn, id) => { const b = document.createElement('button'); b.textContent = t; if (k) b.className = k; if (id) b.id = id; b.onclick = fn; return b; };

// ================= BLACKJACK =================
function bjShow(v) {
  const C = G.bjCards; let t = ca.t + 2;
  if (!G.bj || v.player.length < C.p.length) { C.p = []; C.d = []; }
  v.player.forEach((c, i) => { if (!C.p[i]) { C.p[i] = { c, born: t }; t += 8; } });
  const dealer = v.done ? v.dealer : [v.dealer[0], null];
  dealer.forEach((c, i) => { if (!C.d[i] || (C.d[i].c === null && c)) { C.d[i] = { c, born: t }; t += c && v.done && i > 0 ? 12 : 8; } });
  G.bj = v; G.bjEnd = v.done ? t + 6 : 0;
  return Math.max(0, (t - ca.t) * 17);
}
function dBJ() {
  const g = cx2, v = G.bj, C = G.bjCards; RR(g, '#73463a', 0, 0, 160, 90); RR(g, '#0e5a3a', 3, 3, 154, 84); RR(g, '#147a4f', 6, 42, 148, 1);
  txt(g, 'DEALER', 8, 6, '#ffcd75'); txt(g, 'YOU', 8, 48, '#ffcd75');
  if (!v) { ctxt(g, 'BLACKJACK', 30, '#f4f4f4', 2); ctxt(g, 'PAYS 3:2', 50, '#ffcd75'); return; }
  const slide = b => Math.max(0, b + 6 - ca.t) * 14;
  C.d.forEach((o, i) => { if (ca.t >= o.born) card(g, 40 + i * 21 + slide(o.born), 8, o.c); });
  C.p.forEach((o, i) => { if (ca.t >= o.born) card(g, 40 + i * 21 + slide(o.born), 52, o.c); });
  txt(g, v.ps, 8, 56, '#f4f4f4', 2);
  if (v.done && ca.t >= G.bjEnd) {
    txt(g, v.ds, 8, 14, '#f4f4f4', 2);
    const R = { win: ['WIN!', '#38b764'], lose: ['LOSE', '#b13e53'], push: ['PUSH', '#ffcd75'] }[v.result], w = v.msg.startsWith('BLACKJACK') ? ['BLACKJACK!', '#ffcd75'] : R;
    if (Math.floor(ca.t / 8) % 2 || ca.t - G.bjEnd > 40) { RR(g, '#000', 18, 37, 124, 16); ctxt(g, w[0], 39, w[1], 2); }
  }
}
async function bjDo(path, body) {
  const r = await cAct(path, body); if (r.error) return bjBtns();
  const ms = bjShow(r); bjBtns();
  if (r.done) setTimeout(() => { clog(`<div class="${r.change > 0 ? 'rare' : r.change < 0 ? 'penalty' : ''}">${esc(r.msg)}</div><div>${r.change >= 0 ? '+' : ''}${n(r.change)} coins</div>`); if (r.change > 0) coinRain(); load(); }, ms);
  else clog('Hit or stand?');
}
function bjBtns() { const live = G.bj && !G.bj.done; if ($('bjd')) { $('bjd').disabled = !!live; $('bjh').disabled = !live; $('bjs').disabled = !live; } }

// ================= KLA KLOUK =================
function dKK() {
  const g = cx2, K = G.kk, lob = K.mode === 'lobby', L = G.L.kk; RR(g, '#5a1420', 0, 0, 160, 90); RR(g, '#ffcd75', 4, 4, 152, 1); RR(g, '#ffcd75', 4, 85, 152, 1);
  txt(g, lob ? 'KLA KLOUK LOBBY' : 'KLA KLOUK', 8, 8, '#ffcd75');
  if (lob && L && L.status === 'open') txt(g, Math.ceil(L.left / 1000) + 'S', 136, 8, '#f4f4f4');
  RR(g, '#3a0c14', 30, 18, 100, 40); RR(g, '#7a2a35', 32, 20, 96, 36);
  const dice = lob ? (L && L.status === 'done' ? L.dice : null) : K.dice, rolling = ca.t - K.rollAt < 48, picks = lob ? (L ? L.mine : []) : K.picks;
  for (let i = 0; i < 3; i++) {
    const sh = rolling ? (Math.random() * 4 - 2) : 0, x = 40 + i * 28 + sh, y = 25 + (rolling ? Math.random() * 4 - 2 : 0);
    const id = rolling ? KKI[Math.floor(ca.t / 4 + i * 2) % 6][0] : dice ? dice[i] : null, hit = !rolling && dice && picks.includes(id);
    RR(g, hit && Math.floor(ca.t / 8) % 2 ? '#ffcd75' : '#000', x - 2, y - 2, 26, 26); RR(g, '#f4f4f4', x, y, 22, 22);
    if (id) g.drawImage(kkSpr(id), x + 2, y + 2, 18, 18); else txt(g, '?', x + 8, y + 8, '#1a1c2c', 2);
  }
  KKI.forEach(([id], i) => { const x = 10 + i * 24, on = picks.includes(id); RR(g, on ? '#ffcd75' : '#3a0c14', x - 1, 63, 20, 20); RR(g, '#f4f4f4', x, 64, 18, 18); g.drawImage(kkSpr(id), x + 1, 65, 16, 16); });
}
function kkOpts(o) {
  const K = G.kk; o.innerHTML = '';
  const mr = document.createElement('div'); mr.className = 'row';
  mr.append(btn('🎲 SOLO', K.mode === 'solo' ? 'y' : '', () => { K.mode = 'solo'; kkOpts(o); }), btn('👥 LOBBY (multiplayer)', K.mode === 'lobby' ? 'y' : '', () => { K.mode = 'lobby'; kkOpts(o); }));
  const items = document.createElement('div'); items.className = 'chips'; items.id = 'kki';
  KKI.forEach(([id, e, km, en]) => items.append(btn(`${e} ${km} ${en}`, '', async () => {
    if (K.mode === 'solo') { const i = K.picks.indexOf(id); if (i >= 0) K.picks.splice(i, 1); else K.picks.push(id); kkOpts(o); }
    else { await cAct('/api/kk/lobby/pick', { item: id }); liveTick(true); }
  })));
  [...items.children].forEach((b, i) => { const picks = K.mode === 'solo' ? K.picks : (G.L.kk ? G.L.kk.mine : []); if (picks.includes(KKI[i][0])) b.classList.add('on'); });
  const ar = document.createElement('div'); ar.className = 'row';
  if (K.mode === 'solo') {
    ar.append(btn('🎲 ROLL', 'g', kkSolo, 'kkroll'));
    ar.insertAdjacentHTML('beforeend', '<small>Bet is per item. Under 1,000 = 1 pick, 1,000+ = 2 picks, 5,000+ = 3 picks.</small>');
  } else {
    ar.append(btn('📣 OPEN LOBBY', 'g', async () => { const r = await cAct('/api/kk/lobby/start', { bet: $('bet').value }); if (!r.error) { toast(r.msg); liveTick(true); } }));
    ar.insertAdjacentHTML('beforeend', '<small>Bet box = coins per spot. Anyone online can join and pick up to 3 items within 20 seconds.</small>');
  }
  o.append(mr, items, ar, Object.assign(document.createElement('div'), { id: 'kkl' })); kkInfo();
}
async function kkSolo() {
  const K = G.kk; if (!K.picks.length) return clog('<span class=penalty>Pick at least one item.</span>');
  $('kkroll').disabled = true; const r = await cAct('/api/kk/solo', { bet: $('bet').value, picks: K.picks }); if (r.error) { $('kkroll').disabled = false; return; }
  K.rollAt = ca.t; K.dice = r.dice; clog('Rolling...');
  setTimeout(() => { clog(`<div style="font-size:18px">${r.dice.map(d => KKE[d]).join(' ')}</div><div class="${r.change > 0 ? 'rare' : r.change < 0 ? 'penalty' : ''}">${esc(r.msg)}</div>`); if (r.change > 0) coinRain(); load(); if ($('kkroll')) $('kkroll').disabled = false; }, 850);
}
function kkInfo() {
  const el = $('kkl'); if (!el || G.kk.mode !== 'lobby') return; const L = G.L.kk;
  if (!L) { el.innerHTML = '<small>No lobby open. Type a bet and press OPEN LOBBY.</small>'; return; }
  el.innerHTML = `<b class=legendary>${L.status === 'open' ? `Lobby by ${esc(L.host)} · ${n(L.bet)} per spot · closes in ${Math.ceil(L.left / 1000)}s` : 'Results: ' + (L.dice || []).map(d => KKE[d]).join(' ')}</b>`
    + (L.players.length ? L.players.map(p => `<div>${esc(p.name)}: ${p.picks.map(x => KKE[x]).join(' ') || '...'} ${p.dq ? '<span class=penalty>(not enough coins)</span>' : p.net != null ? `<b class="${p.net >= 0 ? 'rare' : 'penalty'}">${p.net >= 0 ? '+' : ''}${n(p.net)}</b>` : ''}</div>`).join('') : '<div><small>No picks yet.</small></div>');
}

// ================= HORSE RACING =================
const HC = [['#ffcd75', '#ef7d57', '#b13e53'], ['#73eff7', '#3b5dc9', '#ffcd75'], ['#d9a8ff', '#73539b', '#38b764'], ['#333c57', '#b13e53', '#f4f4f4']];
function horse(g, x, y, i, fr) {
  const [body, mane, silk] = HC[i], D = '#1a1c2c';
  RR(g, mane, x, y + 3, 2, 3); RR(g, body, x + 2, y + 3, 9, 4); RR(g, body, x + 9, y + 1, 2, 3); RR(g, body, x + 10, y, 4, 3); RR(g, D, x + 13, y + 1, 1, 1); RR(g, mane, x + 8, y, 2, 2);
  const L = fr ? [[3, 3], [5, 2], [8, 2], [10, 3]] : [[3, 2], [5, 3], [8, 3], [10, 2]]; L.forEach(([a, h]) => RR(g, D, x + a, y + 7, 1, h));
  RR(g, silk, x + 5, y, 3, 3); RR(g, '#ffcd75', x + 6, y - 2, 2, 2);
}
function seed(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return () => ((h = (h * 1664525 + 1013904223) >>> 0) / 4294967296); }
function dHR() {
  const g = cx2, R = G.L.hr; RR(g, '#1d2b53', 0, 0, 160, 12); RR(g, '#38b764', 0, 12, 160, 78);
  for (let i = 0; i < 4; i++) { RR(g, '#a57855', 0, 15 + i * 18, 160, 15); RR(g, '#73463a', 0, 29 + i * 18, 160, 1); txt(g, i + 1, 2, 20 + i * 18, '#f4f4f4'); }
  for (let y = 15; y < 87; y += 3) { RR(g, (y / 3) % 2 ? '#f4f4f4' : '#1a1c2c', 147, y, 3, 3); RR(g, (y / 3) % 2 ? '#1a1c2c' : '#f4f4f4', 150, y, 3, 3); }
  RR(g, '#f4f4f4', 20, 15, 1, 72);
  if (!R) { txt(g, 'NO RACE - PRESS START RACE', 4, 3, '#ffcd75'); [0, 1, 2, 3].forEach(i => horse(g, 6, 19 + i * 18, i, 0)); return; }
  let t = 0, wf = 0;
  if (R.status === 'racing') t = Math.min(1, (7000 - R.raceLeft + (Date.now() - G.hrAt)) / 7000); else if (R.status === 'done' && R.winner) t = 1;
  const rnd = seed(R.id), fac = [0, 1, 2, 3].map(i => i + 1 === R.winner ? 0.86 : 1.05 + rnd() * 0.35);
  [0, 1, 2, 3].forEach(i => {
    const p = Math.min(1, t / fac[i]), x = 6 + 132 * p + (t > 0 && p < 1 ? Math.sin(t * 25 + i * 2) * 2 : 0), y = 19 + i * 18 + (R.status === 'open' ? Math.floor(ca.t / 20 + i) % 2 : 0);
    horse(g, x, y, i, t > 0 && p < 1 ? Math.floor(ca.t / 4) % 2 : 0);
    if (R.status === 'done' && i + 1 === R.winner && Math.floor(ca.t / 8) % 2) { RR(g, '#ffcd75', x + 4, y - 6, 6, 2); RR(g, '#ffcd75', x + 4, y - 8, 1, 2); RR(g, '#ffcd75', x + 7, y - 8, 1, 2); RR(g, '#ffcd75', x + 9, y - 8, 1, 2); }
  });
  const msg = R.status === 'open' ? `BETS CLOSE IN ${Math.ceil(R.left / 1000)}S` : R.status === 'racing' ? 'AND THEY ARE OFF!' : R.winner ? `WINNER: ${R.horses[R.winner - 1].name}` : 'NO BETS';
  txt(g, msg, 4, 3, '#ffcd75');
}
function hrOpts(o) {
  o.innerHTML = ''; const hb = document.createElement('div'); hb.className = 'chips';
  [['Comet', 2], ['Thunderbolt', 3], ['Mystic', 4], ['Nightmare', 5]].forEach(([nm, od], i) => hb.append(btn(`${i + 1}. ${nm} x${od}`, '', async () => { const r = await cAct('/api/hr/bet', { horse: i + 1, bet: $('bet').value }); if (!r.error) { toast(r.msg); load(); liveTick(true); } })));
  const ar = document.createElement('div'); ar.className = 'row';
  ar.append(btn('🏁 START RACE', 'g', async () => { const r = await cAct('/api/hr/start', {}); if (!r.error) { toast(r.msg); liveTick(true); } }));
  ar.insertAdjacentHTML('beforeend', '<small>Type your bet, tap a horse. Everyone online can bet on the same race.</small>');
  o.append(ar, hb, Object.assign(document.createElement('div'), { id: 'hrl' })); hrInfo();
}
function hrInfo() {
  const el = $('hrl'), R = G.L.hr; if (!el) return;
  if (!R) { el.innerHTML = '<small>No race right now. Press START RACE to open one (45 seconds of betting).</small>'; return; }
  el.innerHTML = `<b class=legendary>${R.status === 'open' ? `Betting open · ${Math.ceil(R.left / 1000)}s left` : R.status === 'racing' ? 'Race in progress!' : esc(R.msg)}</b>`
    + (R.mine ? `<div>Your bet: ${n(R.mine.amount)} on #${R.mine.horse} ${esc(R.horses[R.mine.horse - 1].name)}</div>` : '')
    + R.bets.map(b => `<div><small>${esc(b.name)}: ${n(b.amount)} on #${b.horse}${b.won != null ? (b.won ? ` <b class=rare>won ${n(b.won)}</b>` : ' <span class=penalty>lost</span>') : ''}</small></div>`).join('');
}

// ================= POK =================
function dPok() {
  const g = cx2, P = G.L.pok; RR(g, '#73463a', 0, 0, 160, 90); RR(g, '#0e5a3a', 3, 3, 154, 84);
  if (!P) { ctxt(g, 'POK', 26, '#ffcd75', 4); ctxt(g, 'OPEN A TABLE TO PLAY', 56, '#f4f4f4'); return; }
  if (P.status === 'join') { ctxt(g, 'TABLE OPEN', 14, '#ffcd75', 2); ctxt(g, `${P.players.length} PLAYERS - POT ${n(P.pot)}`, 34, '#f4f4f4'); ctxt(g, `DEAL IN ${Math.ceil(P.left / 1000)}S`, 44, '#ffcd75');
    for (let i = 0; i < Math.min(P.players.length, 6); i++) card(g, 26 + i * 18, 56, null); return; }
  const boss = P.players.find(p => p.boss), done = P.status === 'done';
  txt(g, 'BOSS: ' + boss.name.slice(0, 12), 8, 6, '#ffcd75');
  if (P.me && P.me.boss) txt(g, '(YOU)', 112, 6, '#73eff7');
  else if (boss.hand) boss.hand.forEach((c, i) => card(g, 50 + i * 21, 14, c));
  else for (let i = 0; i < boss.cards; i++) card(g, 50 + i * 21, 14, null);
  if (done && boss.total != null) txt(g, boss.total, 120, 22, '#f4f4f4', 2);
  if (P.me) { P.me.hand.forEach((c, i) => card(g, 50 + i * 21, 54, c)); txt(g, 'YOU', 8, 56, '#ffcd75'); if (P.me.total != null) txt(g, P.me.total, 8, 64, '#f4f4f4', 2); }
  else ctxt(g, 'WATCHING', 64, '#f4f4f4');
  if (!done) txt(g, Math.ceil(P.left / 1000) + 'S', 136, 76, '#ffcd75'); else if (Math.floor(ca.t / 10) % 2) ctxt(g, 'ROUND OVER', 44, '#ffcd75');
}
function pokOpts(o) {
  o.innerHTML = ''; const ar = document.createElement('div'); ar.className = 'row';
  ar.append(btn('🃏 OPEN TABLE', 'g', async () => { const r = await cAct('/api/pok/start', { bet: $('bet').value }); if (!r.error) { toast(r.msg); load(); liveTick(true); } }),
    btn('➕ JOIN', '', async () => { const r = await cAct('/api/pok/join', {}); if (!r.error) { toast(r.msg); load(); liveTick(true); } }, 'pkj'),
    btn('HIT', '', () => pokAct('hit'), 'pkh'), btn('STAND', 'y', () => pokAct('stand'), 'pks'));
  o.append(ar, Object.assign(document.createElement('div'), { id: 'pkl', innerHTML: '' }));
  o.insertAdjacentHTML('beforeend', '<small>Bet box = buy-in. 2-10 players, a random player is the Boss. 9 = POK. Hit once or stand. Beat the Boss = x1, pair = x2.</small>'); pokInfo();
}
async function pokAct(a) { const r = await cAct('/api/pok/act', { action: a }); if (!r.error) liveTick(true); }
function pokInfo() {
  const el = $('pkl'), P = G.L.pok; if (!el) return; const me = P && P.me;
  if ($('pkj')) { $('pkj').disabled = !(P && P.status === 'join' && !me); $('pkh').disabled = $('pks').disabled = !(P && P.status === 'play' && me && !me.done); }
  if (!P) { el.innerHTML = '<small>No table open.</small>'; return; }
  el.innerHTML = `<b class=legendary>${P.status === 'join' ? `Table by ${esc(P.host)} · buy-in ${n(P.bet)} · ${Math.ceil(P.left / 1000)}s to join` : P.status === 'play' ? (me && !me.done ? 'YOUR MOVE: hit or stand' : 'Waiting for players...') : 'Round over'}</b>`
    + P.players.map(p => `<div><small>${p.boss ? '👑 ' : ''}${esc(p.name)} ${p.total != null ? `· ${p.total}` : ''} ${p.done && P.status === 'play' ? '✔' : ''} ${p.res ? `<b class="${/\+|Won|wins/.test(p.res) ? 'rare' : /Lost|Boss had/.test(p.res) ? 'penalty' : ''}">${esc(p.res)}</b>` : ''}</small></div>`).join('')
    + `<div style="opacity:.7">${P.log.slice(-3).map(x => `<div><small>${esc(x)}</small></div>`).join('')}</div>`;
}

// ================= GUESS THE NUMBER (free, no coins) =================
function dGtn() {
  const g = cx2, Q = G.gtn; RR(g, '#29366f', 0, 0, 160, 90); ctxt(g, 'GUESS 1-100', 6, '#ffcd75');
  if (!Q) return ctxt(g, 'PRESS NEW GAME', 44, '#f4f4f4');
  const show = Q.last == null ? '?' : Q.last; ctxt(g, show, 28, Q.win ? '#38b764' : '#f4f4f4', 5);
  if (Q.hint === 'higher') { for (let i = 0; i < 6; i++) RR(g, '#38b764', 136 - i, 40 + i, 1 + i * 2, 1); RR(g, '#38b764', 134, 46, 5, 8); }
  if (Q.hint === 'lower') { RR(g, '#b13e53', 134, 34, 5, 8); for (let i = 0; i < 6; i++) RR(g, '#b13e53', 131 + i, 42 + i, 11 - i * 2, 1); }
  ctxt(g, Q.win ? `GOT IT IN ${Q.tries} TRIES!` : `TRIES: ${Q.tries}`, 72, Q.win ? '#ffcd75' : '#c0cbdc');
}
function gtnOpts(o) {
  o.innerHTML = '<input id=gtni placeholder="1-100" style="width:110px"> ';
  o.append(btn('GUESS', 'g', gtnGo), btn('NEW GAME', '', () => { G.gtn = { n: 1 + Math.floor(Math.random() * 100), tries: 0, last: null }; clog("I'm thinking of a number between 1 and 100..."); }));
  $('gtni').addEventListener('keydown', e => { if (e.key === 'Enter') gtnGo(); });
  o.insertAdjacentHTML('beforeend', '<small> Just for fun, no coins.</small>');
  if (!G.gtn) G.gtn = { n: 1 + Math.floor(Math.random() * 100), tries: 0, last: null };
}
function gtnGo() {
  const Q = G.gtn, v = parseInt($('gtni').value); if (!Q || Q.win) return clog('Press NEW GAME to play again.');
  if (!(v >= 1 && v <= 100)) return clog('<span class=penalty>Type a number from 1 to 100.</span>');
  Q.tries++; Q.last = v; $('gtni').value = ''; $('gtni').focus();
  if (v === Q.n) { Q.win = true; Q.hint = null; clog(`<span class=rare>Correct! It was ${v}. You found it in ${Q.tries} tries.</span>`); coinRain(); }
  else { Q.hint = v < Q.n ? 'higher' : 'lower'; clog(`My number is ${Q.hint} than ${v}.`); }
}

// ---------- plug the new games into the casino ----------
Object.assign(DRAW, { bj: dBJ, kk: dKK, hr: dHR, pok: dPok, gtn: dGtn });
const _setG = setG;
setG = function (g) {
  _setG(g); const o = $('opts'), isNew = NEWG.includes(g);
  $('play').hidden = isNew; $('bet').parentElement.hidden = g === 'gtn'; o.style.display = isNew ? 'block' : o.style.display;
  $('bet').placeholder = { kk: 'bet per item', pok: 'buy-in', hr: 'bet' }[g] || 'bet';
  if (g === 'bj') { o.innerHTML = ''; const r = document.createElement('div'); r.className = 'row'; r.append(btn('🃏 DEAL', 'g', () => bjDo('/api/bj/start', { bet: $('bet').value }), 'bjd'), btn('HIT', '', () => bjDo('/api/bj/act', { action: 'hit' }), 'bjh'), btn('STAND', 'y', () => bjDo('/api/bj/act', { action: 'stand' }), 'bjs')); o.append(r); o.insertAdjacentHTML('beforeend', '<small>Get closer to 21 than the dealer. Dealer stands on 17. Blackjack pays 3:2.</small>'); bjBtns(); }
  if (g === 'kk') kkOpts(o); if (g === 'hr') hrOpts(o); if (g === 'pok') pokOpts(o); if (g === 'gtn') gtnOpts(o);
  if (['kk', 'hr', 'pok'].includes(g)) liveTick(true);
};

// ---------- shared tables: watch for lobbies, races and POK tables ----------
let liveN = 0, liveBusy = false; const seenLive = new Set(), doneLive = new Set(); let liveFirst = true;
async function liveTick(force) {
  if (!me || liveBusy) return; const inCasino = !$('vc').hidden && ['kk', 'hr', 'pok'].includes(cg);
  if (!force && !inCasino && liveN++ % 4) return; liveBusy = true;
  let L; try { L = await api('/api/live'); } catch (e) { liveBusy = false; return; } liveBusy = false;
  const prevKK = G.L.kk; G.L = L; G.hrAt = Date.now();
  const note = (o, key, text) => { if (!o) return; const k = key + o.id; if (!seenLive.has(k)) { seenLive.add(k); if (!liveFirst && o.host !== me.name && (o.status === 'open' || o.status === 'join')) toast(text); } };
  note(L.kk, 'kk', `🎲 ${L.kk && L.kk.host} opened a Kla Klouk lobby! CASINO > KLA KLOUK`);
  note(L.hr, 'hr', '🐎 A horse race is open for bets! CASINO > HORSES');
  note(L.pok, 'pk', `🃏 ${L.pok && L.pok.host} opened a POK table! CASINO > POK`);
  liveFirst = false;
  if (L.kk && L.kk.status === 'done' && (!prevKK || prevKK.status !== 'done') && prevKK && prevKK.id === L.kk.id) { G.kk.rollAt = ca.t; }
  const fin = (o, key, mine, msg) => { if (!o || o.status !== 'done' || doneLive.has(key + o.id)) return; doneLive.add(key + o.id); if (mine) { load(); if (msg) toast(msg); } };
  fin(L.kk, 'kk', L.kk && L.kk.mine.length, L.kk && L.kk.players.find(p => p.name === me.name && p.net != null) ? `Kla Klouk: ${L.kk.players.find(p => p.name === me.name).net >= 0 ? '+' : ''}${n(L.kk.players.find(p => p.name === me.name).net)} coins` : '');
  fin(L.hr, 'hr', L.hr && L.hr.mine, L.hr && L.hr.winner ? `🏁 ${L.hr.horses[L.hr.winner - 1].name} won the race!` : '');
  fin(L.pok, 'pk', L.pok && L.pok.me, 'POK round over!');
  if (L.hr && L.hr.status === 'done' && L.hr.mine && L.hr.mine.horse === L.hr.winner && !doneLive.has('hrwin' + L.hr.id)) { doneLive.add('hrwin' + L.hr.id); coinRain(); }
  if (inCasino || force) { kkInfo(); hrInfo(); pokInfo(); if (cg === 'kk' && G.kk.mode === 'lobby' && $('kki')) [...$('kki').children].forEach((b, i) => b.classList.toggle('on', !!(L.kk && L.kk.mine.includes(KKI[i][0])))); }
}
setInterval(() => liveTick(false), 1200);

// ================= PVP: rock-paper-scissors, bank heist, send coins =================
const RPSE = { rock: '✊', paper: '✋', scissors: '✌️' };
let rbShop = [];
loadPlayers = async function () {
  if (!$('plist')) return;
  if (!$('pamt')) {
    $('pbet').placeholder = 'battle/RPS bet';
    $('pbet').insertAdjacentHTML('afterend', ' <input id=pamt placeholder="send amount" style="width:130px"> <select id=rbi title="heist item"></select>');
    $('bst').insertAdjacentHTML('afterend', '<div id=rpsb></div><div id=tlim style="margin-top:6px"></div>');
  }
  try { rbShop = await api('/api/robbank/shop'); } catch (e) { rbShop = []; }
  $('rbi').innerHTML = rbShop.map(i => `<option value="${esc(i.id)}">🏦 ${esc(i.name)} (x${i.qty})</option>`).join('');
  try { const l = await api('/api/transfer/limits'); $('tlim').innerHTML = `<small>💸 Sent today ${n(l.sent)} / ${n(l.sendLimit)} · Received ${n(l.got)} / ${n(l.recvLimit)}</small>`; } catch (e) { }
  const L = await api('/api/players?q=' + encodeURIComponent($('pq').value)), el = $('plist'); el.innerHTML = '';
  if (!L.length) el.textContent = 'No other players yet. Invite your friends!';
  L.forEach(u => {
    const r = document.createElement('div'); r.className = 'row'; r.innerHTML = `<span class=sp>${esc(u.name)} <small>LV ${u.level} · ${n(u.balance)} coins</small></span>`;
    r.append(btn('ROB', 'r', () => act('/api/rob', { targetId: u.id })),
      btn('🏦 HEIST', 'r', () => act('/api/robbank', { targetId: u.id, item: $('rbi').value }).then(loadPlayers)),
      btn('💸 SEND', 'g', () => { if (!$('pamt').value) return toast('Type an amount in "send amount" first.'); act('/api/transfer', { targetId: u.id, amount: $('pamt').value }).then(loadPlayers); }),
      btn('⚔ BATTLE', '', () => act('/api/battle/challenge', { targetId: u.id, bet: $('pbet').value }).then(pollB)),
      btn('✊ RPS', 'y', () => act('/api/rps/challenge', { targetId: u.id, bet: $('pbet').value }).then(pollRPS)));
    el.append(r);
  });
};
const seenRPS = new Set();
async function pollRPS() {
  if (!me) return; let r; try { r = await api('/api/rps'); } catch (e) { return; }
  (r.incoming || []).forEach(c => { if (!seenRPS.has(c.id)) { seenRPS.add(c.id); toast(`✊ ${c.from} wants Rock-Paper-Scissors for ${n(c.bet)} coins! Open PVP.`); } });
  const m = r.match; if (m && m.status === 'done' && !seenRPS.has('done' + m.id)) { seenRPS.add('done' + m.id); load(); if (m.reveal && m.reveal.you) toast(m.msg); }
  const el = $('rpsb'); if (!el || tab !== 'pvp' || $('modal').hidden) return; el.innerHTML = '';
  (r.incoming || []).forEach(c => { const d = document.createElement('div'); d.className = 'row'; d.innerHTML = `<span class="sp legendary">✊ ${esc(c.from)} challenges you to RPS for ${n(c.bet)}!</span>`; d.append(btn('ACCEPT', 'g', () => act('/api/rps/respond', { id: c.id, accept: true }).then(pollRPS)), btn('DECLINE', 'r', () => act('/api/rps/respond', { id: c.id, accept: false }).then(pollRPS))); el.append(d); });
  if (!m) return;
  const box = document.createElement('div'); box.className = 'box'; box.innerHTML = `<b>✊✋✌️ RPS vs ${esc(m.opp)} · ${n(m.bet)} coins</b>`;
  if (m.status === 'pending') box.insertAdjacentHTML('beforeend', '<div>⏳ Waiting for them to accept...</div>');
  if (m.status === 'choose') {
    if (m.mine) box.insertAdjacentHTML('beforeend', `<div>You picked ${RPSE[m.mine]}. ${m.oppChose ? 'Revealing...' : 'Waiting for their pick...'}</div>`);
    else { box.insertAdjacentHTML('beforeend', '<div class=legendary>Pick secretly (30s):</div>'); const row = document.createElement('div'); row.className = 'row'; Object.entries(RPSE).forEach(([k, e]) => row.append(btn(`${e} ${k.toUpperCase()}`, '', () => cAct('/api/rps/choose', { id: m.id, choice: k }).then(pollRPS)))); box.append(row); }
  }
  if (m.status === 'done') box.insertAdjacentHTML('beforeend', `${m.reveal && m.reveal.you ? `<div style="font-size:22px">${RPSE[m.reveal.you]} vs ${RPSE[m.reveal.opp]}</div>` : ''}<div class="${m.win === true ? 'rare' : m.win === false ? 'penalty' : 'legendary'}">${esc(m.msg)}</div>`);
  el.append(box);
}
setInterval(pollRPS, 1500);

// rob bank gear in SHOP > ROB GEAR
const _gshop = gshop;
gshop = async function (p) {
  await _gshop(p); if (shopSub !== 'rob') return;
  p.insertAdjacentHTML('beforeend', '<br><b class=legendary>🏦 BANK HEIST GEAR</b><div><small>Use one in PVP > 🏦 HEIST to steal 10-30% of a player\'s BANK. Each item is used up per heist. Base chance 1%.</small></div>');
  (await api('/api/robbank/shop')).forEach(i => {
    const r = document.createElement('div'), tx = document.createElement('div'); r.className = 'box shopc'; tx.className = 'sp';
    tx.innerHTML = `<b>${esc(i.name)}</b><br><small>${esc(i.desc)}</small><br>${n(i.price)} coins<br>`;
    tx.append(btn(i.qty ? `BUY (you have ${i.qty})` : 'BUY', '', () => act('/api/robbank/buy', { id: i.id }))); r.append(spr('🎒', 14), tx); p.append(r);
  });
};

// ================= MUSIC (YouTube player, plays for you only) =================
document.body.insertAdjacentHTML('beforeend', `<div id=mbox hidden><div class=mh><b id=mnow>🎵</b><span><button id=mnext title="next">⏭</button><button id=mstop class=r title="stop">⏹</button></span></div><div id=ytwrap><div id=ytp></div></div></div>`);
const MQ = (() => { try { return JSON.parse(localStorage.getItem('ph_music') || '[]'); } catch (e) { return []; } })();
const saveMQ = () => { try { localStorage.setItem('ph_music', JSON.stringify(MQ)); } catch (e) { } };
let ytPlayer = null, ytLoading = false, mIdx = -1;
const ytId = s => { s = String(s).trim(); const m = s.match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/); return m ? m[1] : /^[\w-]{11}$/.test(s) ? s : null; };
function ytLoad(cb) {
  if (window.YT && YT.Player) return cb(); window._ytq = (window._ytq || []).concat(cb); if (ytLoading) return; ytLoading = true;
  window.onYouTubeIframeAPIReady = () => (window._ytq || []).forEach(f => f());
  const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; document.head.append(sc);
}
function mPlay(i) {
  if (!MQ.length) return; mIdx = (i + MQ.length) % MQ.length; const it = MQ[mIdx]; $('mbox').hidden = false; $('mnow').textContent = '🎵 ' + (it.title || 'Loading...');
  ytLoad(() => {
    if (ytPlayer) { ytPlayer.loadVideoById(it.id); return; }
    ytPlayer = new YT.Player('ytp', { width: 220, height: 124, videoId: it.id, playerVars: { autoplay: 1, playsinline: 1 }, events: {
      onStateChange: e => { if (e.data === 1) { const t = ytPlayer.getVideoData().title; if (t && MQ[mIdx]) { MQ[mIdx].title = t; saveMQ(); $('mnow').textContent = '🎵 ' + t; if (tab === 'music' && !$('modal').hidden) render(); } } if (e.data === 0) mPlay(mIdx + 1); },
      onError: () => { toast('That video cannot be played here. Skipping.'); setTimeout(() => mPlay(mIdx + 1), 800); } } });
  });
}
$('mnext').onclick = () => mPlay(mIdx + 1);
$('mstop').onclick = () => { if (ytPlayer) ytPlayer.stopVideo(); $('mbox').hidden = true; mIdx = -1; };

// ================= extra windows: MUSIC and TOP UP =================
Object.assign(TT, { music: '🎵 MUSIC', topup: '💎 TOP UP' });
const _render = render;
render = async function () {
  await _render(); if ($('modal').hidden) return; const p = $('panel');
  if (tab === 'music') {
    p.innerHTML = '<div><small>Paste a YouTube link and it plays in a small player in the corner, only for you. It keeps playing while you hunt or gamble.</small></div><div class=row><input id=murl placeholder="YouTube link" style="flex:1;min-width:180px"><button class=g id=madd>ADD</button></div>';
    const list = document.createElement('div');
    if (!MQ.length) list.innerHTML = '<small>Your playlist is empty.</small>';
    MQ.forEach((it, i) => { const r = document.createElement('div'); r.className = 'row'; r.innerHTML = `<span class=sp>${i === mIdx ? '▶ ' : ''}${esc(it.title || it.id)}</span>`; r.append(btn('PLAY', '', () => { mPlay(i); render(); }), btn('✕', 'r', () => { MQ.splice(i, 1); saveMQ(); if (i === mIdx) $('mstop').click(); else if (i < mIdx) mIdx--; render(); })); list.append(r); });
    const ctl = document.createElement('div'); ctl.className = 'row'; if (MQ.length) ctl.append(btn('▶ PLAY ALL', 'g', () => { mPlay(0); render(); }), btn('CLEAR', 'r', () => { MQ.length = 0; saveMQ(); $('mstop').click(); render(); }));
    p.append(list, ctl);
    const add = () => { const id = ytId($('murl').value); if (!id) return toast('That does not look like a YouTube link.'); MQ.push({ id, title: '' }); saveMQ(); if (mIdx < 0) mPlay(MQ.length - 1); render(); };
    $('madd').onclick = add; $('murl').addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  }
  if (tab === 'topup') {
    const T = await api('/api/topup');
    p.innerHTML = `<div>Buy coins with real money. Contact the admin, choose an amount, pay, and your coins are added after the payment is confirmed.</div><br><b class=legendary>PRICE LIST</b>`
      + T.prices.map(([usd, coins, bonus]) => `<div class=row><span class=sp><b>${esc(usd)}</b></span><span>💰 ${esc(coins)} ${bonus ? `<small class=rare>${esc(bonus)}</small>` : ''}</span></div>`).join('')
      + `<br><div class=row><a href="${esc(T.contact)}" target="_blank" rel="noopener"><button class=g>💬 CONTACT ADMIN</button></a></div>`;
    p.append(btn('📨 NOTIFY ADMIN I WANT TO TOP UP', 'y', () => act('/api/topup/request', {})));
  }
};

// ================= ANNOUNCEMENTS =================
document.querySelector('.hud').insertAdjacentHTML('afterend', '<div id=ann hidden></div>');
const seenAnn = (() => { try { return new Set(JSON.parse(localStorage.getItem('ph_ann') || '[]')); } catch (e) { return new Set(); } })();
let annFirst = true;
async function pollAnn() {
  if (!me) return; let A; try { A = await api('/api/announcements'); } catch (e) { return; }
  const el = $('ann'), show = A.filter(a => !seenAnn.has(a.id)); el.hidden = !show.length; el.innerHTML = '';
  show.forEach(a => { const d = document.createElement('div'); d.className = 'annb'; d.innerHTML = `<span class=sp>📢 ${esc(a.text)}</span>`;
    d.append(btn('✕', 'r', () => { seenAnn.add(a.id); try { localStorage.setItem('ph_ann', JSON.stringify([...seenAnn])); } catch (e) { } pollAnn(); })); el.append(d);
    if (!annFirst && !seenAnn.has('t' + a.id)) toast('📢 ' + a.text); seenAnn.add('t' + a.id); });
  annFirst = false;
}
setInterval(pollAnn, 30000); setTimeout(pollAnn, 1500);
