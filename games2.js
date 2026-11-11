// Games and features ported from the rest of the Discord bot:
// blackjack, kla klouk (solo + lobby), horse racing, pok, rock-paper-scissors,
// rob bank, transfer coins, top-up info and announcements.
// Every result is decided here on the server so players can't cheat by editing the page.
module.exports = function games2({ app, auth, adm, wrap, Profile, get, crypto, mongoose }) {
  const rid = () => crypto.randomBytes(6).toString('hex');
  const rnd = n => Math.floor(Math.random() * n);
  const fmt = n => Number(n).toLocaleString();
  const bad = (s, m, c = 400) => void s.status(c).json({ error: m });
  const nameOf = p => p.username || String(p.userId).replace(/^web:/, '');

  // take coins only if the player has them (safe against double clicks)
  const take = async (id, n) => !!(await Profile.findOneAndUpdate({ userId: id, balance: { $gte: n } }, { $inc: { balance: -n } }));
  const give = (id, n) => n ? Profile.updateOne({ userId: id }, { $inc: { balance: n } }) : null;
  const betOf = async (q, s) => {
    const p = await get(q.u), a = q.body.bet === 'all' ? p.balance : parseInt(q.body.bet);
    if (!(a > 0)) return bad(s, 'Enter a positive bet.');
    if (a > p.balance) return bad(s, "You don't have enough coins.");
    return a;
  };

  // ---------- cards ----------
  const SUITS = ['S', 'H', 'D', 'C'], RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = () => { const d = []; for (const s of SUITS) for (const r of RANKS) d.push({ r, s }); for (let i = d.length - 1; i > 0; i--) { const j = rnd(i + 1); [d[i], d[j]] = [d[j], d[i]]; } return d; };

  // ================= BLACKJACK (blackjack.js) =================
  const BJ = {};
  const bjVal = c => c.r === 'A' ? 11 : ['J', 'Q', 'K'].includes(c.r) ? 10 : parseInt(c.r);
  const bjScore = h => { let s = h.reduce((a, c) => a + bjVal(c), 0), a = h.filter(c => c.r === 'A').length; while (s > 21 && a) { s -= 10; a--; } return s; };
  const bjView = (g, done) => ({ player: g.ph, ps: bjScore(g.ph), dealer: done ? g.dh : [g.dh[0]], ds: done ? bjScore(g.dh) : null, bet: g.bet, done: !!done });
  async function bjEnd(uid, g, natural) {
    delete BJ[uid];
    const ps = bjScore(g.ph); let res, back = 0, msg;
    if (natural) { res = 'win'; back = g.bet + Math.ceil(g.bet * 1.5); msg = `BLACKJACK! You won ${fmt(back - g.bet)} coins!`; }
    else if (ps > 21) { res = 'lose'; msg = `Bust! You lost ${fmt(g.bet)} coins.`; }
    else {
      while (bjScore(g.dh) < 17) g.dh.push(g.d.pop());
      const ds = bjScore(g.dh);
      if (ds > 21 || ps > ds) { res = 'win'; back = g.bet * 2; msg = `You win ${fmt(g.bet)} coins!`; }
      else if (ds > ps) { res = 'lose'; msg = `Dealer wins. You lost ${fmt(g.bet)} coins.`; }
      else { res = 'push'; back = g.bet; msg = "Push! Your bet is returned."; }
    }
    await give(uid, back);
    return { ...bjView(g, true), result: res, change: back - g.bet, msg };
  }
  app.post('/api/bj/start', auth, wrap(async (q, s) => {
    if (BJ[q.u.id]) return bad(s, 'Finish your current hand first.');
    const bet = await betOf(q, s); if (!bet) return;
    if (!await take(q.u.id, bet)) return bad(s, "You don't have enough coins.");
    const d = deck(), g = { d, bet, ph: [d.pop(), d.pop()], dh: [d.pop(), d.pop()], t: Date.now() };
    BJ[q.u.id] = g;
    if (bjScore(g.ph) === 21) return s.json(await bjEnd(q.u.id, g, true));
    s.json(bjView(g, false));
  }));
  app.post('/api/bj/act', auth, wrap(async (q, s) => {
    const g = BJ[q.u.id]; if (!g) return bad(s, 'No hand in progress. Press DEAL.');
    g.t = Date.now();
    if (q.body.action === 'hit') { g.ph.push(g.d.pop()); if (bjScore(g.ph) >= 21) return s.json(await bjEnd(q.u.id, g)); return s.json(bjView(g, false)); }
    if (q.body.action === 'stand') return s.json(await bjEnd(q.u.id, g));
    bad(s, 'Unknown action.');
  }));

  // ================= KLA KLOUK (klaklouk.js + myklaklouk.js) =================
  const KK = { tiger: ['🐅', 'ខ្លា'], lobster: ['🦞', 'បង្កង'], fish: ['🐟', 'ត្រី'], crab: ['🦀', 'ក្តាម'], rooster: ['🐓', 'មាន់'], gourd: ['🍐', 'ឃ្លោក'] };
  const KKIDS = Object.keys(KK), roll3 = () => [0, 1, 2].map(() => KKIDS[rnd(6)]);
  const kkNet = (picks, dice, bet) => picks.reduce((n, p) => { const o = dice.filter(d => d === p).length; return n + (o ? bet * o : -bet); }, 0);
  app.post('/api/kk/solo', auth, wrap(async (q, s) => {
    const bet = parseInt(q.body.bet); if (!(bet > 0)) return bad(s, 'Enter a positive bet per item.');
    const max = bet >= 5000 ? 3 : bet >= 1000 ? 2 : 1, picks = [...new Set((q.body.picks || []).filter(p => KK[p]))];
    if (!picks.length) return bad(s, 'Pick at least one item.');
    if (picks.length > max) return bad(s, `With ${fmt(bet)} per item you can pick up to ${max}. (1,000+ = 2 items, 5,000+ = 3 items)`);
    const total = bet * picks.length; if (!await take(q.u.id, total)) return bad(s, `You need ${fmt(total)} coins.`);
    const dice = roll3(), net = kkNet(picks, dice, bet); await give(q.u.id, total + net);
    s.json({ dice, picks, change: net, msg: net > 0 ? `You won ${fmt(net)} coins!` : net < 0 ? `You lost ${fmt(-net)} coins.` : 'You broke even.' });
  }));
  let KL = null; // one shared lobby
  const klView = uid => KL && ({ id: KL.id, status: KL.status, bet: KL.bet, host: KL.host, left: Math.max(0, KL.end - Date.now()), dice: KL.status === 'done' ? KL.dice : null,
    players: Object.values(KL.bets).map(b => ({ name: b.name, picks: b.picks, net: b.net, dq: b.dq })), mine: (KL.bets[uid] || {}).picks || [] });
  async function klClose() {
    KL.status = 'done'; KL.dice = roll3(); KL.doneAt = Date.now();
    for (const [uid, b] of Object.entries(KL.bets)) {
      if (!b.picks.length) continue; const total = KL.bet * b.picks.length, net = kkNet(b.picks, KL.dice, KL.bet);
      if (await Profile.findOneAndUpdate({ userId: uid, balance: { $gte: total } }, { $inc: { balance: net } })) b.net = net; else b.dq = true;
    }
  }
  app.get('/api/kk/lobby', auth, (q, s) => s.json({ lobby: klView(q.u.id) }));
  app.post('/api/kk/lobby/start', auth, wrap(async (q, s) => {
    if (KL && KL.status === 'open') return bad(s, 'A lobby is already open. Join it!');
    const bet = parseInt(q.body.bet); if (!(bet > 0)) return bad(s, 'Enter a positive bet per spot.');
    KL = { id: rid(), status: 'open', bet, host: q.u.name, end: Date.now() + 20000, bets: {} };
    s.json({ msg: `Lobby opened at ${fmt(bet)} coins per spot. 20 seconds to pick!` });
  }));
  app.post('/api/kk/lobby/pick', auth, wrap(async (q, s) => {
    if (!KL || KL.status !== 'open') return bad(s, 'No open lobby.');
    const it = q.body.item; if (!KK[it]) return bad(s, 'Unknown item.');
    const b = KL.bets[q.u.id] ??= { name: q.u.name, picks: [] }, i = b.picks.indexOf(it);
    if (i >= 0) b.picks.splice(i, 1); else if (b.picks.length >= 3) return bad(s, 'You can pick up to 3 items.'); else b.picks.push(it);
    s.json({ ok: 1 });
  }));

  // ================= HORSE RACING (horseracing.js) =================
  const HORSES = [{ n: 1, name: 'Comet', odds: 2 }, { n: 2, name: 'Thunderbolt', odds: 3 }, { n: 3, name: 'Mystic', odds: 4 }, { n: 4, name: 'Nightmare', odds: 5 }];
  const pickHorse = () => { const tot = HORSES.reduce((a, h) => a + h.odds, 0), w = HORSES.map(h => tot / h.odds); let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < 4; i++) { r -= w[i]; if (r <= 0) return HORSES[i]; } return HORSES[0]; };
  let HR = null;
  const hrView = uid => HR && ({ id: HR.id, status: HR.status, left: Math.max(0, HR.end - Date.now()), raceLeft: HR.raceEnd ? Math.max(0, HR.raceEnd - Date.now()) : 0, horses: HORSES,
    winner: HR.status !== 'open' ? HR.winner : null, bets: Object.values(HR.bets).map(b => ({ name: b.name, horse: b.horse, amount: b.amount, won: HR.status === 'done' ? b.won : null })), mine: HR.bets[uid] || null, msg: HR.msg || '' });
  async function hrClose() {
    if (!Object.keys(HR.bets).length) { HR.status = 'done'; HR.msg = 'No one bet, so the horses went back to the stables.'; HR.doneAt = Date.now(); return; }
    HR.winner = pickHorse().n; HR.status = 'racing'; HR.raceEnd = Date.now() + 7000;
    const w = HORSES[HR.winner - 1];
    for (const [uid, b] of Object.entries(HR.bets)) { b.won = b.horse === w.n ? b.amount * w.odds : 0; if (b.won) await give(uid, b.won); }
  }
  app.get('/api/hr', auth, (q, s) => s.json({ race: hrView(q.u.id) }));
  app.post('/api/hr/start', auth, wrap(async (q, s) => {
    if (HR && HR.status !== 'done') return bad(s, 'A race is already running. Place your bet on it!');
    HR = { id: rid(), status: 'open', end: Date.now() + 45000, bets: {}, host: q.u.name };
    s.json({ msg: 'A new race is open! 45 seconds to bet.' });
  }));
  app.post('/api/hr/bet', auth, wrap(async (q, s) => {
    if (!HR || HR.status !== 'open') return bad(s, 'Betting is closed. Start a new race.');
    if (HR.bets[q.u.id]) return bad(s, 'You already bet on this race.');
    const h = HORSES.find(x => x.n === parseInt(q.body.horse)); if (!h) return bad(s, 'Pick a horse.');
    const bet = await betOf(q, s); if (!bet) return;
    if (!await take(q.u.id, bet)) return bad(s, "You don't have enough coins.");
    HR.bets[q.u.id] = { name: q.u.name, horse: h.n, amount: bet };
    s.json({ msg: `Bet ${fmt(bet)} coins on ${h.name} (x${h.odds})!` });
  }));

  // ================= POK (Pok.js) =================
  const pokVal = c => ['10', 'J', 'Q', 'K'].includes(c.r) ? 0 : c.r === 'A' ? 1 : parseInt(c.r);
  const pokTot = h => h.reduce((a, c) => a + pokVal(c), 0) % 10;
  let PK = null;
  const pkView = uid => {
    if (!PK) return null; const done = PK.status === 'done', me = PK.players.find(p => p.id === uid);
    return { id: PK.id, status: PK.status, bet: PK.bet, pot: PK.pot, left: Math.max(0, PK.end - Date.now()), host: PK.host, log: PK.log.slice(-8),
      players: PK.players.map((p, i) => ({ name: p.name, boss: i === PK.boss, done: p.done, total: done ? p.total : null, hand: done ? p.hand : null, res: p.res || null, cards: p.hand.length })),
      me: me ? { hand: me.hand, total: me.hand.length ? pokTot(me.hand) : null, done: me.done, boss: PK.players.indexOf(me) === PK.boss } : null };
  };
  async function pkDeal() {
    if (PK.players.length < 2) { for (const p of PK.players) await give(p.id, PK.bet); PK.status = 'done'; PK.doneAt = Date.now(); PK.log.push('Not enough players joined. Buy-ins were returned.'); return; }
    PK.boss = rnd(PK.players.length); PK.deck = deck(); const B = PK.players[PK.boss];
    PK.players.forEach(p => { p.hand = [PK.deck.pop(), PK.deck.pop()]; p.total = pokTot(p.hand); });
    PK.log.push(`${B.name} is the Boss! Cards are dealt.`);
    if (B.total === 9) { await give(B.id, PK.pot); PK.players.forEach((p, i) => p.res = i === PK.boss ? `POK 9! Won the pot (${fmt(PK.pot)})` : 'Boss had POK 9'); PK.log.push(`💀 The Boss got POK 9 and takes the whole pot of ${fmt(PK.pot)}!`); PK.status = 'done'; PK.doneAt = Date.now(); return; }
    PK.players.forEach((p, i) => { if (i !== PK.boss && p.total === 9) { p.done = true; p.pok = true; PK.log.push(`🎉 ${p.name} got POK 9!`); } });
    PK.status = 'play'; PK.end = Date.now() + 30000;
  }
  async function pkFinish() {
    if (PK.status === 'done') return; PK.status = 'done'; PK.doneAt = Date.now();
    const B = PK.players[PK.boss], bossP = await Profile.findOne({ userId: B.id });
    let fund = (bossP ? bossP.balance : 0) + PK.bet; // boss's money available to pay winners (incl. own buy-in back)
    const pay = [], keep = [];
    PK.players.forEach((p, i) => {
      if (i === PK.boss) return; const pair = p.hand[0].r === p.hand[1].r;
      if (p.pok) { pay.push([p, 1, 'POK 9 - wins x1']); }
      else if (pair) pay.push([p, 2, 'Pair - wins x2']);
      else if (p.total > B.total) pay.push([p, 1, 'Beat the Boss - wins x1']);
      else if (p.total < B.total) { keep.push(p); p.res = 'Lost to the Boss'; }
      else { p.res = 'Tie - buy-in returned'; give(p.id, PK.bet); }
    });
    keep.forEach(() => fund += PK.bet);
    let bossDelta = PK.bet + keep.length * PK.bet; // buy-in back + losers' buy-ins
    for (const [p, mult, label] of pay) { const owe = Math.min(PK.bet * mult, Math.max(0, fund)); fund -= owe; bossDelta -= owe; await give(p.id, PK.bet + owe); p.res = `${label} (+${fmt(owe)})`; }
    await Profile.updateOne({ userId: B.id }, { $inc: { balance: bossDelta } });
    B.res = `Boss: ${bossDelta - PK.bet >= 0 ? '+' : ''}${fmt(bossDelta - PK.bet)}`;
    PK.log.push('Round over! Hands revealed.');
  }
  app.get('/api/pok', auth, (q, s) => s.json({ game: pkView(q.u.id) }));
  app.post('/api/pok/start', auth, wrap(async (q, s) => {
    if (PK && PK.status !== 'done') return bad(s, 'A POK game is already running.');
    const bet = parseInt(q.body.bet); if (!(bet > 0)) return bad(s, 'Enter a positive buy-in.');
    if (!await take(q.u.id, bet)) return bad(s, "You don't have enough coins.");
    PK = { id: rid(), status: 'join', bet, pot: bet, host: q.u.name, end: Date.now() + 25000, players: [{ id: q.u.id, name: q.u.name, hand: [] }], log: [`${q.u.name} started POK with a ${fmt(bet)} buy-in.`] };
    s.json({ msg: 'POK table opened! Others have 25 seconds to join.' });
  }));
  app.post('/api/pok/join', auth, wrap(async (q, s) => {
    if (!PK || PK.status !== 'join') return bad(s, 'No table is taking players.');
    if (PK.players.some(p => p.id === q.u.id)) return bad(s, 'You already joined.');
    if (PK.players.length >= 10) return bad(s, 'The table is full (10 players).');
    if (!await take(q.u.id, PK.bet)) return bad(s, `You need ${fmt(PK.bet)} coins to join.`);
    PK.players.push({ id: q.u.id, name: q.u.name, hand: [] }); PK.pot += PK.bet; PK.log.push(`${q.u.name} joined.`);
    s.json({ msg: 'You joined the table!' });
  }));
  app.post('/api/pok/act', auth, wrap(async (q, s) => {
    if (!PK || PK.status !== 'play') return bad(s, 'Not your turn right now.');
    const p = PK.players.find(x => x.id === q.u.id); if (!p) return bad(s, 'You are not at this table.'); if (p.done) return bad(s, 'You already played.');
    if (q.body.action === 'hit') { p.hand.push(PK.deck.pop()); p.total = pokTot(p.hand); PK.log.push(`${p.name} took another card.`); }
    else PK.log.push(`${p.name} stands.`);
    p.done = true; if (PK.players.every(x => x.done)) await pkFinish();
    s.json({ ok: 1 });
  }));

  // ================= ROCK PAPER SCISSORS (rps.js) =================
  const RPS = {}, URP = {};
  const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  const rpView = (m, uid) => { const i = m.p[0].id === uid ? 0 : 1; return { id: m.id, status: m.status, bet: m.bet, opp: m.p[1 - i].name, you: m.p[i].name, mine: m.p[i].c || null, oppChose: !!m.p[1 - i].c, reveal: m.status === 'done' ? { you: m.p[i].c, opp: m.p[1 - i].c } : null, msg: m.msg || '', win: m.winner == null ? null : m.winner === i }; };
  async function rpFinish(m) {
    m.status = 'done'; m.doneAt = Date.now(); const [a, b] = m.p;
    if (!a.c || !b.c) { m.msg = 'Someone did not choose in time. No coins changed hands.'; return; }
    if (a.c === b.c) { m.msg = "It's a tie! Bets returned."; return; }
    const w = beats[a.c] === b.c ? 0 : 1, W = m.p[w], L = m.p[1 - w], lp = await Profile.findOne({ userId: L.id }), amt = Math.min(m.bet, lp ? lp.balance : 0);
    await give(L.id, -amt); await give(W.id, amt); m.winner = w; m.msg = `${W.name} wins ${fmt(amt)} coins!`;
  }
  app.get('/api/rps', auth, (q, s) => { const m = RPS[URP[q.u.id]]; s.json({ match: m ? rpView(m, q.u.id) : null, incoming: Object.values(RPS).filter(x => x.status === 'pending' && x.p[1].id === q.u.id).map(x => ({ id: x.id, from: x.p[0].name, bet: x.bet })) }); });
  app.post('/api/rps/challenge', auth, wrap(async (q, s) => {
    const bet = parseInt(q.body.bet), tid = String(q.body.targetId || '');
    if (!(bet > 0)) return bad(s, 'Type a positive bet first.'); if (tid === q.u.id) return bad(s, "You can't play yourself.");
    const cur = RPS[URP[q.u.id]]; if (cur && cur.status !== 'done') return bad(s, 'Finish your current RPS game first.');
    const [a, b] = await Promise.all([get(q.u), Profile.findOne({ userId: tid })]); if (!b) return bad(s, "That player doesn't exist.");
    if (a.balance < bet) return bad(s, "You don't have enough coins."); if (b.balance < bet) return bad(s, `${nameOf(b)} can't afford that bet.`);
    const id = rid(); RPS[id] = { id, status: 'pending', bet, t: Date.now(), p: [{ id: q.u.id, name: q.u.name }, { id: tid, name: nameOf(b) }] }; URP[q.u.id] = id;
    s.json({ msg: `RPS challenge sent to ${nameOf(b)}!` });
  }));
  app.post('/api/rps/respond', auth, wrap(async (q, s) => {
    const m = RPS[q.body.id]; if (!m || m.status !== 'pending' || m.p[1].id !== q.u.id) return bad(s, 'That challenge is gone.');
    if (!q.body.accept) { m.status = 'done'; m.doneAt = Date.now(); m.msg = `${m.p[1].name} declined.`; return s.json({ msg: 'Declined.' }); }
    m.status = 'choose'; m.t = Date.now(); URP[q.u.id] = m.id; s.json({ msg: 'Accepted! Pick rock, paper or scissors.' });
  }));
  app.post('/api/rps/choose', auth, wrap(async (q, s) => {
    const m = RPS[q.body.id]; if (!m || m.status !== 'choose') return bad(s, 'No game to play.'); const me = m.p.find(x => x.id === q.u.id);
    if (!me) return bad(s, 'Not your game.'); if (!beats[q.body.choice]) return bad(s, 'Pick rock, paper or scissors.'); if (me.c) return bad(s, 'You already chose.');
    me.c = q.body.choice; if (m.p.every(x => x.c)) await rpFinish(m); s.json({ ok: 1 });
  }));

  // ================= ROB BANK (robshop.js + robbank.js) =================
  const RB = { 'bank robber kit': [100000000, 0.01, 'Allows you to rob player banks (+1%).'], backpack: [500000000, 0.05, '+5% bank rob success.'], 'big backpack': [1000000000, 0.08, '+8% bank rob success.'], 'mega backpack': [5000000000, 0.16, '+16% bank rob success.'], 'giga backpack': [10000000000, 0.20, '+20% bank rob success.'] };
  const title = k => k.replace(/\b\w/g, c => c.toUpperCase());
  app.get('/api/robbank/shop', auth, wrap(async (q, s) => { const p = await get(q.u), inv = p.inventoryrob || {}; s.json(Object.entries(RB).map(([k, v]) => ({ id: k, name: title(k), price: v[0], desc: v[2] + ' Used up on each heist.', qty: inv[k] || 0 }))); }));
  app.post('/api/robbank/buy', auth, wrap(async (q, s) => {
    const it = RB[q.body.id]; if (!it) return bad(s, 'Unknown item.');
    if (!await take(q.u.id, it[0])) return bad(s, `You need ${fmt(it[0])} coins.`);
    await Profile.updateOne({ userId: q.u.id }, { $inc: { ['inventoryrob.' + q.body.id]: 1 } }); s.json({ msg: `Bought a ${title(q.body.id)}!` });
  }));
  app.post('/api/robbank', auth, wrap(async (q, s) => {
    const it = RB[q.body.item], tid = String(q.body.targetId || ''); if (!it) return bad(s, 'Choose an item to use for the heist.');
    if (tid === q.u.id) return bad(s, "You can't rob yourself.");
    const t = await Profile.findOne({ userId: tid }); if (!t || !(t.bank > 0)) return bad(s, "That player's bank is empty!");
    if (!await Profile.findOneAndUpdate({ userId: q.u.id, ['inventoryrob.' + q.body.item]: { $gte: 1 } }, { $inc: { ['inventoryrob.' + q.body.item]: -1 } })) return bad(s, `You don't have a ${title(q.body.item)}. Buy one in SHOP > ROB GEAR.`);
    if (Math.random() < 0.01 + it[1]) {
      const amt = Math.floor(t.bank * (Math.random() * 0.2 + 0.1));
      if (await Profile.findOneAndUpdate({ userId: tid, bank: { $gte: amt } }, { $inc: { bank: -amt } })) { await Profile.updateOne({ userId: q.u.id }, { $inc: { bank: amt } }); return s.json({ success: true, msg: `HEIST SUCCESS! You stole ${fmt(amt)} coins from ${nameOf(t)}'s bank into yours!` }); }
    }
    s.json({ success: false, msg: `You were caught at ${nameOf(t)}'s bank, but escaped without a penalty. Your ${title(q.body.item)} was used up.` });
  }));

  // ================= TRANSFER COINS (transfercoin.js) =================
  const DAY = 864e5, SEND_LIMIT = 10000000, RECV_LIMIT = 50000000;
  const used = (amt, ts) => Date.now() - (ts || 0) > DAY ? 0 : (amt || 0);
  app.get('/api/transfer/limits', auth, wrap(async (q, s) => { const p = await get(q.u); s.json({ sent: used(p.dailyTransferSent, p.lastTransferTimestamp), sendLimit: SEND_LIMIT, got: used(p.dailyReceiveGot, p.lastReceiveTimestamp), recvLimit: RECV_LIMIT }); }));
  app.post('/api/transfer', auth, wrap(async (q, s) => {
    const amt = parseInt(q.body.amount), tid = String(q.body.targetId || ''); if (!(amt > 0)) return bad(s, 'Enter a positive amount.');
    if (tid === q.u.id) return bad(s, "You can't send coins to yourself.");
    const [a, b] = await Promise.all([get(q.u), Profile.findOne({ userId: tid })]); if (!b) return bad(s, "That player doesn't exist.");
    const sent = used(a.dailyTransferSent, a.lastTransferTimestamp), got = used(b.dailyReceiveGot, b.lastReceiveTimestamp), now = Date.now();
    if (sent + amt > SEND_LIMIT) return bad(s, `Daily send limit is ${fmt(SEND_LIMIT)}. You can send ${fmt(SEND_LIMIT - sent)} more today.`);
    if (got + amt > RECV_LIMIT) return bad(s, `${nameOf(b)} can only receive ${fmt(RECV_LIMIT - got)} more today.`);
    if (!await Profile.findOneAndUpdate({ userId: q.u.id, balance: { $gte: amt } }, { $inc: { balance: -amt }, $set: { dailyTransferSent: sent + amt, lastTransferTimestamp: now } })) return bad(s, "You don't have enough coins.");
    await Profile.updateOne({ userId: tid }, { $inc: { balance: amt }, $set: { dailyReceiveGot: got + amt, lastReceiveTimestamp: now } });
    s.json({ msg: `Sent ${fmt(amt)} coins to ${nameOf(b)}!` });
  }));

  // ================= TOP-UP INFO + ANNOUNCEMENTS =================
  const Topup = mongoose.models.TopupRequest || mongoose.model('TopupRequest', new mongoose.Schema({ userId: String, name: String, at: Number }));
  const Ann = mongoose.models.Announcement || mongoose.model('Announcement', new mongoose.Schema({ text: String, at: Number }));
  const lastTop = {};
  app.get('/api/topup', auth, (q, s) => s.json({ prices: require('./data/topup'), contact: process.env.TOPUP_CONTACT || 'https://discordapp.com/users/842776245590818886' }));
  app.post('/api/topup/request', auth, wrap(async (q, s) => {
    if (Date.now() - (lastTop[q.u.id] || 0) < 6e5) return bad(s, 'Request already sent. The admin will contact you.');
    lastTop[q.u.id] = Date.now(); await Topup.create({ userId: q.u.id, name: q.u.name, at: Date.now() });
    s.json({ msg: 'Request sent! Contact the admin with the link to finish your top-up.' });
  }));
  app.get('/api/announcements', auth, wrap(async (q, s) => s.json((await Ann.find({ at: { $gt: Date.now() - 7 * DAY } }).sort({ at: -1 }).limit(3)).map(a => ({ id: String(a._id), text: a.text, at: a.at })))));
  app.get('/api/admin/topups', adm, wrap(async (q, s) => s.json((await Topup.find({}).sort({ at: -1 }).limit(50)).map(t => ({ name: t.name, userId: t.userId, at: t.at })))));
  app.post('/api/admin/announce', adm, wrap(async (q, s) => {
    const text = String(q.body.text || '').trim().slice(0, 500); if (!text) return bad(s, 'Write a message first.');
    await Ann.create({ text, at: Date.now() }); console.log('[admin] announcement:', text); s.json({ msg: 'Announcement posted! Players will see it within 30 seconds.' });
  }));
  app.post('/api/admin/announce/clear', adm, wrap(async (q, s) => { await Ann.deleteMany({}); s.json({ msg: 'All announcements removed.' }); }));

  // one call for the page to watch all shared tables
  app.get('/api/live', auth, (q, s) => s.json({ kk: klView(q.u.id), hr: hrView(q.u.id), pok: pkView(q.u.id) }));

  // ---------- timers: close lobbies, time out turns, clean up ----------
  setInterval(async () => {
    const now = Date.now();
    try {
      for (const [u, g] of Object.entries(BJ)) if (now - g.t > 120000) { delete BJ[u]; await give(u, g.bet); } // abandoned hand: bet returned
      if (KL && KL.status === 'open' && now > KL.end) await klClose();
      if (KL && KL.status === 'done' && now - KL.doneAt > 60000) KL = null;
      if (HR && HR.status === 'open' && now > HR.end) await hrClose();
      if (HR && HR.status === 'racing' && now > HR.raceEnd) { HR.status = 'done'; HR.doneAt = now; HR.msg = `${HORSES[HR.winner - 1].name} wins the race!`; }
      if (HR && HR.status === 'done' && now - HR.doneAt > 60000) HR = null;
      if (PK && PK.status === 'join' && now > PK.end) await pkDeal();
      if (PK && PK.status === 'play' && now > PK.end) { PK.players.forEach(p => { if (!p.done) { p.done = true; PK.log.push(`${p.name} ran out of time and stands.`); } }); await pkFinish(); }
      if (PK && PK.status === 'done' && now - PK.doneAt > 90000) PK = null;
      for (const [id, m] of Object.entries(RPS)) {
        if (m.status === 'pending' && now - m.t > 30000) { m.status = 'done'; m.doneAt = now; m.msg = 'Challenge expired.'; }
        if (m.status === 'choose' && now - m.t > 30000) await rpFinish(m);
        if (m.status === 'done' && now - m.doneAt > 60000) { m.p.forEach(x => { if (URP[x.id] === id) delete URP[x.id]; }); delete RPS[id]; }
      }
    } catch (e) { console.error('game timer error', e); }
  }, 1000);
};
