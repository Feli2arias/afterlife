import {
  Connection, PublicKey, Keypair, SystemProgram,
  Transaction, TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createHash } from "crypto";

const RPC_URL =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "https://api.devnet.solana.com";

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "4pKCmz43y8apgNqoAZVhYba11r5MyW6fiDnH3WGb16Uu"
);

// Anchor discriminator for `claim` instruction (sha256("global:claim")[0..8])
const CLAIM_DISCRIMINATOR = Buffer.from([62, 198, 214, 193, 213, 159, 108, 210]);

function getKeeper(): Keypair {
  const raw = process.env.KEEPER_PRIVATE_KEY?.trim();
  if (!raw) throw new Error("KEEPER_PRIVATE_KEY not set");
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)));
}

export async function POST(req: Request) {
  try {
    const { ownerAddress, heirAddress, heirEmail } = (await req.json()) as {
      ownerAddress: string;
      heirAddress: string;
      heirEmail: string;
    };

    if (!ownerAddress || !heirAddress || !heirEmail) {
      return Response.json({ error: "Missing fields: ownerAddress, heirAddress, heirEmail" }, { status: 400 });
    }

    const keeper = getKeeper();
    const connection = new Connection(RPC_URL, "confirmed");
    const owner = new PublicKey(ownerAddress);
    const heir = new PublicKey(heirAddress);

    const [vaultConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vigil"), owner.toBuffer()],
      PROGRAM_ID
    );
    const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_auth"), vaultConfigPda.toBuffer()],
      PROGRAM_ID
    );

    const vaultTokenAccount = await getAssociatedTokenAddress(NATIVE_MINT, vaultAuthorityPda, true);
    const heirTokenAccount = await getAssociatedTokenAddress(NATIVE_MINT, heir);

    // Hash heir email — must match the hash stored at register time
    const emailHashBytes = createHash("sha256")
      .update(heirEmail.trim().toLowerCase())
      .digest();

    // Build `claim` instruction manually using Anchor's discriminator + Borsh args
    const instructionData = Buffer.concat([CLAIM_DISCRIMINATOR, emailHashBytes]);

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: vaultConfigPda, isSigner: false, isWritable: true },
        { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false },
        { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: heir, isSigner: false, isWritable: false },
        { pubkey: heirTokenAccount, isSigner: false, isWritable: true },
        { pubkey: NATIVE_MINT, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: keeper.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = keeper.publicKey;
    tx.add(ix);
    tx.sign(keeper);

    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await connection.confirmTransaction(sig, "confirmed");

    return Response.json({ signature: sig });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/claim]", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
