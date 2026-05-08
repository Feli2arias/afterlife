import { Connection, PublicKey, Transaction, Keypair } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  NATIVE_MINT,
} from "@solana/spl-token";

const RPC_URL =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ??
  "https://api.devnet.solana.com";
const DECIMALS = 9;

function getKeeper(): Keypair {
  const raw = process.env.KEEPER_PRIVATE_KEY;
  if (!raw) throw new Error("KEEPER_PRIVATE_KEY not set");
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)));
}

export async function POST(req: Request) {
  try {
    const { ownerAddress, heirAddress, shareBps } = await req.json() as {
      ownerAddress: string;
      heirAddress: string;
      shareBps: number;
    };

    if (!ownerAddress || !heirAddress || !shareBps) {
      return Response.json({ error: "Missing fields" }, { status: 400 });
    }

    const keeper = getKeeper();
    const connection = new Connection(RPC_URL, "confirmed");
    const owner = new PublicKey(ownerAddress);
    const heir = new PublicKey(heirAddress);

    // Read owner's wSOL ATA
    const ownerAta = await getAssociatedTokenAddress(NATIVE_MINT, owner);
    let ownerAcc;
    try {
      ownerAcc = await getAccount(connection, ownerAta);
    } catch {
      return Response.json({ error: "Owner has no wSOL — vault not set up" }, { status: 400 });
    }

    if (ownerAcc.amount === 0n) {
      return Response.json({ error: "Owner wSOL balance is zero" }, { status: 400 });
    }

    // Verify keeper is the approved delegate
    if (!ownerAcc.delegate || ownerAcc.delegate.toBase58() !== keeper.publicKey.toBase58()) {
      return Response.json(
        { error: `Vault not delegated to keeper. Delegate: ${ownerAcc.delegate?.toBase58() ?? "none"}` },
        { status: 400 }
      );
    }

    // Calculate heir's share (integer math to avoid float errors)
    const amount = (ownerAcc.amount * BigInt(shareBps)) / 10_000n;
    if (amount === 0n) {
      return Response.json({ error: "Computed amount is zero" }, { status: 400 });
    }

    const heirAta = await getAssociatedTokenAddress(NATIVE_MINT, heir);
    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = keeper.publicKey;

    // Create heir's wSOL ATA if it doesn't exist
    try {
      await getAccount(connection, heirAta);
    } catch {
      tx.add(
        createAssociatedTokenAccountInstruction(
          keeper.publicKey,
          heirAta,
          heir,
          NATIVE_MINT
        )
      );
    }

    // Transfer wSOL from owner to heir using keeper as delegate
    tx.add(
      createTransferCheckedInstruction(
        ownerAta,
        NATIVE_MINT,
        heirAta,
        keeper.publicKey,
        amount,
        DECIMALS
      )
    );

    tx.sign(keeper);
    const sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
    });
    await connection.confirmTransaction(sig, "confirmed");

    return Response.json({ signature: sig, amount: amount.toString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/claim]", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
