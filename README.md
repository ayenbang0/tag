# TAG

Turn-based chase on a 25x25 hex board, drawn as pixel art on one canvas. No build step.

- **Chaser** wins by stepping on the runner.
- **Runner** wins by lighting all four beacons (random each game, one per quadrant).
- Tie: same position 3 times, nobody can act, or 600 turns.

One action per turn: move (2 steps), place a rune, change a rune's type, upgrade a rune (max 3 times), or remove the rune on your left.
Click your piece to open the action ring. Walls: up to 3 per placement and they can never seal off a beacon.
Push: you choose the direction. Grab: placed 4+ hexes away; whoever steps on it slows the *other* player next turn.

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

- `game.js` rules engine and bot (no DOM, also runs in node)
- `ui.js` rendering, input, online play
- `vendor/` bundled Trystero
