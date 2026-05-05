import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SolanaWalletProvider } from "@/components/WalletProvider";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Vigil — Your crypto. Their future.",
  description: "On-chain crypto inheritance without custody.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-[#0a0a0a] text-white`}>
        <SolanaWalletProvider>
          {children}
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
