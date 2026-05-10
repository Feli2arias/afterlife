import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Afterlife — Your crypto lives on.",
  description: "Non-custodial crypto inheritance on Solana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-[#0a0a0a] text-white`}>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
