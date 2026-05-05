import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { readFileSync } from "fs";
import { findExpiredVaults, findExpiringVaults } from "./monitor.js";
import { executeDistribution } from "./execute.js";
import { sendBeneficiaryEmail, sendWarningEmail } from "./notify.js";
import idl from "../../target/idl/vigil.json" assert { type: "json" };

const HELIUS_RPC = process.env.HELIUS_RPC_URL!;
const KEEPER_KEYPAIR_PATH = process.env.KEEPER_KEYPAIR_PATH ?? `${process.env.HOME}/.config/solana/id.json`;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

if (!HELIUS_RPC) throw new Error("HELIUS_RPC_URL required");
if (!process.env.VIGIL_PROGRAM_ID) throw new Error("VIGIL_PROGRAM_ID required");

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function runCycle() {
  const connection = new Connection(HELIUS_RPC, "confirmed");
  const keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(KEEPER_KEYPAIR_PATH, "utf-8")))
  );
  const provider = new AnchorProvider(connection, new Wallet(keypair), {});
  const program = new Program(idl as any, provider);

  log("Cycle start");

  // Warnings
  const expiring = await findExpiringVaults(program);
  log(`${expiring.length} vaults expiring soon`);
  for (const vault of expiring) {
    const deadline = vault.expiredSince;
    const daysLeft = Math.ceil(deadline / 86_400);
    log(`  WARNING: ${vault.owner.toBase58()} ~${daysLeft}d left`);
    // sendWarningEmail(ownerEmail, vault.owner.toBase58(), daysLeft);
  }

  // Ejecutar expirados
  const expired = await findExpiredVaults(program);
  log(`${expired.length} expired vaults`);

  for (const vault of expired) {
    try {
      const txSig = await executeDistribution(connection, program, vault, keypair);
      log(`✓ Distributed ${vault.owner.toBase58()} → ${txSig}`);

      // Notificar a cada beneficiario
      for (const ben of vault.beneficiaries) {
        const claimUrl = `${APP_URL}/claim/${vault.owner.toBase58()}`;
        log(`  → Beneficiary ${ben.wallet.toBase58()} (${ben.shareBps / 100}%) — ${claimUrl}`);
        // sendBeneficiaryEmail(email, vault.owner.toBase58(), ben.shareBps / 100, claimUrl);
      }
    } catch (e) {
      log(`✗ Failed for ${vault.owner.toBase58()}: ${e}`);
    }
  }

  log("Cycle done");
}

runCycle().catch(console.error);
setInterval(() => runCycle().catch(console.error), POLL_INTERVAL_MS);
