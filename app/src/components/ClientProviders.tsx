"use client";
import dynamic from "next/dynamic";
import { ReactNode } from "react";

const SolanaWalletProvider = dynamic(
  () => import("./WalletProvider").then(m => ({ default: m.SolanaWalletProvider })),
  { ssr: false }
);

export default function ClientProviders({ children }: { children: ReactNode }) {
  return <SolanaWalletProvider>{children}</SolanaWalletProvider>;
}
