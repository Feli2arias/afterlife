# Afterlife Protocol

**Dead man's switch on Solana.** Set a timer, add heirs, and if you stop checking in, your SOL is automatically distributed to them — no lawyers, no intermediaries, no trust required.

**Live demo:** https://afterlife-sol.vercel.app  
**Smart contract (devnet):** `4pKCmz43y8apgNqoAZVhYba11r5MyW6fiDnH3WGb16Uu`

---

## How it works

1. **Setup** — Connect your Phantom wallet, choose a check-in interval (30 days, 60 days, or 90 days), lock SOL into the vault, and add heir wallet addresses with their percentage splits.
2. **Check in** — Visit the dashboard periodically and click "Check In" to reset the countdown. Small SOL fee per check-in.
3. **Distribution** — If the countdown reaches zero and you haven't checked in, a keeper bot triggers `execute_distribution` on-chain and your SOL is sent directly to each heir's wallet.
4. **Claim** — Heirs receive an email notification and can view their allocation at `afterlife-sol.vercel.app/claim/[your-wallet]`.

No one can steal the funds. The smart contract enforces the rules. Only the owner can cancel or modify the vault.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contract | Rust · Anchor framework · Solana devnet |
| Frontend | Next.js 14 · TypeScript · Tailwind CSS · Framer Motion |
| Wallet auth | Phantom / Solflare via `@solana/wallet-adapter` |
| Heir login | Privy (email + Google OAuth) |
| Email | Resend API |
| Hosting | Vercel |
| Token handling | wSOL wrapping + SPL token delegation |

---

## Local Development

### Prerequisites

- Node.js 18+, Yarn
- Rust + Anchor CLI (`anchor --version`)
- Solana CLI (`solana --version`)
- A funded devnet wallet at `~/.config/solana/id.json`

### 1. Clone

```bash
git clone https://github.com/Feli2arias/afterlife.git
cd afterlife
```

### 2. Install frontend deps

```bash
cd app
yarn install
```

### 3. Environment variables

Create `app/.env.local`:

```env
NEXT_PUBLIC_PROGRAM_ID=4pKCmz43y8apgNqoAZVhYba11r5MyW6fiDnH3WGb16Uu
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_KEEPER_PUBKEY=<keeper-wallet-pubkey>
KEEPER_PRIVATE_KEY=<keeper-wallet-private-key-base58>
RESEND_API_KEY=<your-resend-api-key>
NEXT_PUBLIC_PRIVY_APP_ID=<your-privy-app-id>
```

### 4. Run the frontend

```bash
cd app
yarn dev
```

Open http://localhost:3000

### 5. Build the smart contract (optional)

```bash
anchor build
anchor deploy --provider.cluster devnet
```

---

## Smart Contract

Located in `programs/afterlife/src/lib.rs`. Key instructions:

| Instruction | Description |
|---|---|
| `register_vault` | Create vault, set interval, add beneficiaries |
| `checkin` | Reset the countdown clock |
| `execute_distribution` | Keeper-triggered SOL distribution when expired |
| `cancel_vault` | Owner closes the vault and reclaims SOL |
| `force_expire` | Dev/demo: instantly expire the timer |

PDAs use seed `b"vigil"` + owner pubkey. The program is deployed and verified on Solana devnet.

---

## Project Structure

```
afterlife/
├── programs/afterlife/     # Anchor smart contract (Rust)
│   └── src/lib.rs
├── app/                    # Next.js frontend
│   └── src/
│       ├── app/
│       │   ├── dashboard/  # Owner dashboard + countdown
│       │   ├── setup/      # Vault creation flow
│       │   └── claim/      # Heir claim page
│       └── lib/
│           ├── afterlife.ts        # Anchor client helpers
│           ├── afterlife.idl.json  # Generated IDL
│           └── delegate.ts         # wSOL wrap + approve
└── Anchor.toml
```

---

Built at a Solana hackathon. MIT License.
