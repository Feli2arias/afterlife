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

const RPC_URL =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "https://api.devnet.solana.com";

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "4pKCmz43y8apgNqoAZVhYba11r5MyW6fiDnH3WGb16Uu"
);

// Anchor discriminator for `execute_distribution`
const EXEC_DISCRIMINATOR = Buffer.from([163, 217, 35, 57, 238, 179, 71, 204]);

function getKeeper(): Keypair {
  const raw = process.env.KEEPER_PRIVATE_KEY?.trim();
  if (!raw) throw new Error("KEEPER_PRIVATE_KEY not set");
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)));
}

export async function POST(req: Request) {
  try {
    const { ownerAddress } = (await req.json()) as { ownerAddress: string };
    if (!ownerAddress) {
      return Response.json({ error: "Missing ownerAddress" }, { status: 400 });
    }

    const keeper = getKeeper();
    const connection = new Connection(RPC_URL, "confirmed");
    const owner = new PublicKey(ownerAddress);

    const [vaultConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("vigil"), owner.toBuffer()],
      PROGRAM_ID
    );
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_auth"), vaultConfig.toBuffer()],
      PROGRAM_ID
    );

    const ownerTokenAccount = await getAssociatedTokenAddress(NATIVE_MINT, owner);
    const vaultTokenAccount = await getAssociatedTokenAddress(NATIVE_MINT, vaultAuthority, true);

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: vaultConfig,        isSigner: false, isWritable: true },
        { pubkey: ownerTokenAccount,  isSigner: false, isWritable: true },
        { pubkey: vaultAuthority,     isSigner: false, isWritable: false },
        { pubkey: vaultTokenAccount,  isSigner: false, isWritable: true },
        { pubkey: NATIVE_MINT,        isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID,   isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: keeper.publicKey,   isSigner: true,  isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: EXEC_DISCRIMINATOR,
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
    console.error("[/api/execute-distribution]", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
