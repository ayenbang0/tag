# TAG

Turn-based chase on a 25x25 hex board, drawn as pixel art on one canvas. No build step.

- **Chaser** wins by stepping on the runner.
- **Runner** wins by lighting all four beacons (random each game, one per quadrant).
- Tie: same position 3 times, nobody can act, or 600 turns.

One action per turn: move (2 steps), place a rune, upgrade a rune (max 3 times), or remove any rune within 1.
Click your piece to open the action ring.

- Boulders are scattered at random and block movement. Only a bomb going off can destroy them.
- Walls: up to 3 per placement, and they can never seal off a beacon.
- Push: place up to 2 per action, each with its own direction. Base push distance 2; each upgrade adds 2.
- Dash: each upgrade adds 2 strength. Every other rune adds 1 per upgrade.
- Grab: placed 4+ hexes away. Whoever steps on it makes the *other* player move 1 less for `strength` turns.

## The bot learns

`brain.js` is a small neural network (30 inputs, 24 and 12 hidden units) that scores positions from one side's point of view.
After every game against you it trains on the result: positions from games the bot lost count extra for its last few moves,
and your own moves are included and weighted up. It is blended into the hand-written bot scoring, a little more as it gains experience.
"Train the bot" on the menu runs bot-vs-bot games to speed that up. Everything is stored in your browser's `localStorage`,
so each player's bot learns separately and nothing is sent anywhere.

## Play

Open `index.html` through any web server (`python3 -m http.server`), or on GitHub Pages.
Menu: **Play vs bot**, **Host online game** (gives a 5-letter code and a link), **Join online game** (type the code or open the link).

Online play is peer to peer over WebRTC using [Trystero](https://github.com/dmotz/trystero) (BitTorrent-tracker signaling), so there is no game server.
The host's browser runs the rules and the guest sends its moves to it. Bomb zones are never sent to the other side.
Trystero is bundled in `vendor/trystero-torrent.js` (MIT, see `vendor/TRYSTERO-LICENSE`). Players behind very strict NATs may fail to connect because no TURN relay is configured.

## Publish on GitHub Pages

Settings -> Pages -> Deploy from a branch -> pick the branch and `/ (root)`. Everything is static files.
Online play needs the page served over http(s); it cannot work from a `file://` URL.

## Files

- `game.js` rules engine and hand-written bot (no DOM, also runs in node)
- `brain.js` the learned model
- `ui.js` rendering, input, online play
- `vendor/` bundled Trystero
