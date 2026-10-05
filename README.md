# Afterlife

**A dead man's switch on Solana.** Set a check-in timer, name your heirs, and if you stop checking in, your assets are released to them on-chain, with no lawyers or intermediaries.

**Live demo:** https://afterlife-sol.vercel.app
**Program (devnet):** `4pKCmz43y8apgNqoAZVhYba11r5MyW6fiDnH3WGb16Uu`

---

## How it works

1. **Setup.** Connect a Solana wallet, choose a check-in interval (30, 60 or 90 days) and an optional grace period, add up to 5 heirs by email with percentage splits, and pick a legacy strategy. SOL is wrapped to wSOL and the vault program is approved as delegate over it, so funds stay in your wallet until the switch fires.
2. **Check in.** Open the dashboard and check in to reset the countdown. Each check-in carries a small protocol fee (0.005 SOL).
3. **Distribution.** Once the timer and grace period run out, `execute_distribution` can be called by anyone. A keeper does it automatically, moving the delegated tokens into a vault PDA and fixing each heir's allocation.
4. **Claim.** Each heir gets an email with a link to `/claim/[owner]`, proves control of that email through Privy (email or Google), and the backend authority submits the claim so the heir's share lands in their wallet. Heirs never pay gas.

Heirs are stored on-chain only as a SHA-256 hash of their email, so no personal data is written to the ledger.

### Legacy strategies

Besides an instant transfer, the setup flow lets the owner describe how the inheritance should be released: **Protected Inheritance** (vesting over several years, monthly or quarterly unlocks), **Generational Vault** (principal stays locked while yield is paid out) and **Custom Strategy** (free-form rules). These are modeled in the app (`app/src/lib/legacy.ts`) and shown on the heir claim page.

---

## Tech stack

| Layer | Technology |
|---|---|
| Smart contract | Rust, Anchor, Solana devnet |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Framer Motion |
| Wallets | Solana wallet adapter (Phantom, Solflare and others) |
| Heir identity | Privy (email and Google login) |
| Email | Nodemailer (Gmail SMTP) in the app, Resend in the keeper |
| Keeper | Bun + `@coral-xyz/anchor` polling service |
| Tokens | wSOL wrapping and SPL token delegation |
| Hosting | Vercel |

---

## Local development

### Prerequisites

- Node.js 20+ (or Bun)
- Rust and Anchor CLI (only to build the program)
- Solana CLI and a funded devnet wallet at `~/.config/solana/id.json`

### Run the frontend

```bash
git clone https://github.com/Feli2arias/afterlife.git
cd afterlife/app
npm install
npm run dev
```

Open http://localhost:3000.

### Build the program (optional)

```bash
anchor build
anchor deploy --provider.cluster devnet
```

### Run the keeper (optional)

The keeper polls for expired vaults, executes the distribution and notifies heirs. It reads the IDL from `target/idl`, so build the program first.

```bash
cd keeper
bun install
bun run start
```

---

## Environment variables

Only names are listed. Frontend variables go in `app/.env.local`; every `NEXT_PUBLIC_*` variable is exposed to the browser.

**Frontend (`app/`)**

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_PROGRAM_ID` | Deployed program ID (defaults to the devnet deployment) |
| `NEXT_PUBLIC_HELIUS_RPC_URL` | Solana RPC endpoint (defaults to public devnet) |
| `NEXT_PUBLIC_KEEPER_PUBKEY` | Public key of the backend authority / keeper |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app ID for heir login |
| `KEEPER_PRIVATE_KEY` | Server-only. Keeper keypair used by the `claim` and `execute-distribution` API routes |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Server-only. SMTP credentials for heir notification emails |

**Keeper (`keeper/`)**

| Variable | Purpose |
|---|---|
| `HELIUS_RPC_URL` | Solana RPC endpoint (required) |
| `VIGIL_PROGRAM_ID` | Program ID (required) |
| `KEEPER_KEYPAIR_PATH` | Path to the keeper keypair (defaults to `~/.config/solana/id.json`) |
| `APP_URL` | Base URL used in notification links |
| `RESEND_API_KEY` | Resend API key for keeper emails |

---

## Smart contract

Located in `programs/afterlife/`. Instructions:

| Instruction | Description |
|---|---|
| `register` | Create the vault: heirs (email hashes and basis-point shares), interval, grace period and backend authority |
| `checkin` | Reset the countdown and pay the protocol fee |
| `execute_distribution` | Permissionless once expired; moves delegated tokens into the vault PDA |
| `claim` | Called by the backend authority after verifying the heir's email; transfers that heir's share |
| `cancel` | Owner closes the vault and recovers rent |
| `force_expire` | Demo only: backdates the last check-in to expire the timer |
| `force_close` | Migration helper to close a vault from an older schema |

The program was renamed from `vigil` to `afterlife`, so the on-chain module, the IDL and the PDA seed (`b"vigil"` plus the owner's public key) still use the old name.

---

## Project structure

```
afterlife/
├── programs/afterlife/   # Anchor program (Rust)
│   └── src/instructions/ # register, checkin, execute, claim, cancel, ...
├── app/                  # Next.js frontend
│   └── src/
│       ├── app/          # dashboard, setup, claim pages and API routes
│       ├── components/   # wallet, Privy, setup steps, timer
│       └── lib/          # Anchor client, IDL, wSOL delegation, legacy strategies
├── keeper/               # Bun service: monitor, execute, notify
└── Anchor.toml
```

---

## Status

Built for a Solana hackathon (Dev3pack). The program is deployed on devnet and the full flow works end to end: setup, check-in, distribution, claim. It has not been audited and is not intended for mainnet funds. The app includes a short demo timer for presentations.

## License

[MIT](LICENSE)
