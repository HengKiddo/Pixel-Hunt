# Pixel Hunt

## Run on your own computer
1. Install Node.js 18+ (https://nodejs.org)
2. `npm install` then `npm start`
3. Open http://localhost:3000 - type a name + password. A new name creates a new account.

Admin: http://localhost:3000/admin (not linked in the game). Password = ADMIN_PASSWORD in `.env`
(copy `.env.example` to `.env`; without it the password is admin123 - change it!). Optional ADMIN_PATH=/secret-path.

## Put it online for free (MongoDB Atlas + Render)

### 1. Database: MongoDB Atlas (free M0)
Already used Atlas for your Discord bot? Reuse that same connection string (from the bot's `.env`, `MONGODB_SRV=...`)
and skip to step 2 - old players, coins and items carry over.
1. https://cloud.mongodb.com -> sign in -> Create a cluster -> choose **M0 / Free**.
2. **Database Access** -> Add New Database User -> username + password (letters and numbers only is easiest).
3. **Network Access** -> Add IP Address -> **Allow access from anywhere** (`0.0.0.0/0`). Render has no fixed IP.
4. **Connect** -> Drivers -> copy the link. It looks like
   `mongodb+srv://USER:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
   Replace `<db_password>` with the real password (remove the `< >`). Optionally put a database name before the `?`:
   `...mongodb.net/pixelhunt?retryWrites=...`

### 2. Put the code on GitHub
All files are in ONE folder (no subfolders), so GitHub's normal upload works.
1. https://github.com/new -> name `pixel-hunt` -> Create (or open your existing repo).
2. **Add file** -> **Upload files** -> **choose your files** -> open the `pixel-bot-web` folder -> press `Ctrl + A` to select
   every file -> Open. (Leave out `.env` if you made one - that is your password file. `node_modules` is not needed.)
3. Check the list shows about 20 files (server.js, index.html, game-extra.js, profileSchema.js, ...) -> **Commit changes**.

### 3. Web host: Render (free)
1. https://render.com -> sign in with GitHub -> **New +** -> **Blueprint** -> pick the `pixel-hunt` repo.
   Render reads `render.yaml` and creates the service.
2. It asks for the secret values:
   - `MONGODB_SRV` = your Atlas link from step 1
   - `ADMIN_PASSWORD` = a strong password for `/admin`
   - `TOPUP_CONTACT` = your contact link for top-ups (optional)
3. **Apply / Deploy**. In the Logs you should see `DB connected: ...` then `Pixel Hunt running`.
4. Your site is `https://pixel-hunt-XXXX.onrender.com`. Log in to claim your name first, then share the link.
   Admin page: `https://pixel-hunt-XXXX.onrender.com/admin`

### If something goes wrong (check Render > Logs)
- `MONGODB_SRV is not set` -> add it in Render > your service > Environment, then Manual Deploy.
- `bad auth` / `Authentication failed` -> wrong user or password in the link, or `< >` left in.
- `querySrv ENOTFOUND` or timeouts -> link copied wrong, or Atlas Network Access is missing `0.0.0.0/0`.
- Changes to the code: upload the changed files to GitHub again; Render redeploys automatically.

Free plan notes: the site sleeps after ~15 minutes with nobody on it and takes about a minute to wake up.
A free pinger such as cron-job.org opening `https://YOUR-APP.onrender.com/healthz` every 10 minutes keeps it awake.
Free Atlas M0 has 512 MB of storage and no backups.

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
