# ToDo Matrix

Eisenhower matrix todos that follow you between devices, stored on your own
server as a single encrypted blob.

There are no accounts and no database. Your todos live in the browser; when
sync is on they are encrypted in the browser and pushed as one opaque value.
The server stores that value and a version number, and can never read it.

## Features

- Four quadrants: urgent/important, important/not urgent, urgent/not important,
  neither
- Drag to reorder within a quadrant or move between quadrants, by mouse or
  keyboard
- Time tracking per task, statistics, JSON export and import
- Optional end-to-end encrypted sync across browsers and devices
- Installable to a phone home screen

## Running it

### Docker

```bash
cp .env.example .env
openssl rand -hex 32   # put the result in SYNC_TOKEN
docker compose up -d --build
```

The app listens on `127.0.0.1:3000`. The encrypted blob is kept in the
`todo-data` volume, which survives rebuilds.

### Node

```bash
npm install
npm run build
SYNC_TOKEN=$(openssl rand -hex 32) DATA_DIR=/var/lib/todo npm start
```

Node 18 or newer. Without `SYNC_TOKEN` the app still works as a local todo
list; only sync is disabled.

### Development

```bash
npm install
npm run dev
```

`npm test` runs the suite, `npm run lint` and `npm run typecheck` the rest.

## Putting it on the internet

The app binds to loopback on purpose. The sync token is sent in an
`Authorization` header on every request, so **terminate TLS in front of it** --
over plain HTTP that token is handed to anyone on the path. Any reverse proxy
will do; `nginx.conf` in this repo is the one behind the author's deployment,
kept as a worked example rather than something to use unedited.

If your proxy runs on the same host, the Express server is already set up to
read `X-Forwarded-For` from a loopback proxy, so rate limiting buckets per
client rather than counting every request as one caller.

Two things worth knowing before exposing it:

- **The token is the only access control.** There are no users, roles or
  sessions. Anyone holding it can read and overwrite your ciphertext -- they
  cannot decrypt it, but they can destroy it. Generate it with `openssl rand`,
  not by hand.
- **Rate limiting is per process and in memory.** It resets when the server
  restarts and is not shared between replicas. It is a brake, not a defence.

## How sync works

Turn it on from the menu, paste the token, and choose a passphrase. The
passphrase never leaves the browser.

- A key is derived from your passphrase with PBKDF2-SHA256, 600,000 iterations,
  and the whole state is encrypted with AES-GCM-256 under a fresh IV per write.
- The first device to sync generates the salt and stores it alongside the
  ciphertext, so the next device only needs the same passphrase.
- Writes use the version number as an `If-Match`. If another device got there
  first the server returns 412 with the winning blob, and the loser merges and
  retries.
- Merging is per todo, last write wins on `updatedAt`, with deletes kept as
  tombstones for 90 days so an offline device cannot resurrect them. A tie is
  broken by content so that both devices reach the same answer.

### What this protects you from, and what it doesn't

The server, your host and anyone on the network see ciphertext only. That is
the point of the design.

It does not protect against someone with access to your browser profile. So
that you only type the passphrase once, the derived key is cached in
`localStorage`, which means anything that can run script on the page can read
it. The todos are in `localStorage` in plaintext anyway, so this adds no
exposure locally -- but it does mean a cross-site scripting bug would cost you
the key as well as the data, which is why the server sends a script policy with
no `unsafe-inline` and no `unsafe-eval`.

**Lose the passphrase and the remote copy is gone.** Nothing on the server can
recover it. Use the JSON export in the menu as a plaintext escape hatch.

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | Port the server listens on |
| `DATA_DIR` | `./data` | Where the encrypted blob is written |
| `SYNC_TOKEN` | unset | Shared secret for the sync API; unset disables sync (503) |

Keep `DATA_DIR` outside the checkout. Inside it, a `git clean` takes your blob
with it.

## Stack

React 18, TypeScript, Tailwind, dnd-kit, Vite, Express.

## License

MIT
