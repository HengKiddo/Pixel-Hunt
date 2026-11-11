# Pixel Hunt

## Run on your own computer
1. Install Node.js 18+ (https://nodejs.org)
2. `npm install` then `npm start`
3. Open http://localhost:3000 - type a name + password. A new name creates a new account.

Admin: http://localhost:3000/admin (not linked in the game). Password = ADMIN_PASSWORD in `.env`
(copy `.env.example` to `.env`; without it the password is admin123 - change it!). Optional ADMIN_PATH=/secret-path.

## Put it online for free (so friends can play together)
The game is already multiplayer: every player logs in to the same website and shares one database
(leaderboard, shop, admin tools). You need two free things: a database and a web host.

### 1. Free database - MongoDB Atlas (M0)
1. Sign up at https://cloud.mongodb.com -> Build a Database -> choose the FREE (M0) plan.
2. Database Access -> add a user (username + password). Remember them.
3. Network Access -> Add IP Address -> "Allow access from anywhere" (0.0.0.0/0). Free hosts have no fixed IP.
4. Connect -> Drivers -> copy the connection string `mongodb+srv://user:pass@cluster.../`
   and add a database name before the `?`, e.g. `...mongodb.net/pixelhunt?retryWrites=true...`
   (If this is the same database your old Discord bot used, your old data is there too. Web accounts are
   stored as `web:yourname`, Discord players keep their Discord IDs.)

### 2. Free web host - Render
1. Put this folder on GitHub (a private repo is fine). `.env` and `node_modules` are already ignored.
2. https://render.com -> New -> Web Service -> pick your repo. Runtime Node, Build `npm install`, Start `npm start`, plan Free.
   (Or New -> Blueprint, it reads `render.yaml`.)
3. Environment variables:
   - `MONGODB_SRV` = your Atlas connection string
   - `ADMIN_PASSWORD` = a strong password (admin page is at `https://YOUR-APP.onrender.com/admin`)
   - `SESSION_SECRET` = any long random text
4. Deploy. Share the `https://....onrender.com` link with your friends.

Notes for the free plan: the site goes to sleep after ~15 minutes with nobody on it and takes about a minute
to wake up on the next visit. A free pinger such as cron-job.org visiting your URL every 10 minutes keeps it awake.

## Notes on PvP
- Battles are turn-based and live on the server's memory. If the server restarts or (on the free host) goes to sleep during a
  fight, that fight is cancelled (nobody loses coins). Both players need to keep the page open; a player who waits more than
  90 seconds on their turn forfeits.
- Battle gear stats in `data/gear.js` are a starter set. If your database already has GearItem documents from the old bot, those are used instead.

## Extra games and features (from the rest of the old bot)
- CASINO: Blackjack, Kla Klouk (solo, or a shared lobby anyone can join), Horse Racing (shared race), POK (2-10 players), Guess the Number.
- PVP: Rock-Paper-Scissors, bank heists (gear in SHOP > ROB GEAR), send coins (10M/day send, 50M/day receive).
- MUSIC: paste YouTube links; plays in a mini player for that player only.
- TOP UP: shows the price list and a contact button. Set `TOPUP_CONTACT` to your own contact link. Requests appear on the admin page.
- Admin page: post announcements (yellow banner for all players) and see top-up requests.
- Shared tables (races, lobbies, POK, RPS, battles) live in server memory; a restart or sleep cancels the round in progress.
