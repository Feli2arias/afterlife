"use client";
import { Component, ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

interface BoundaryProps {
  children: ReactNode;
  onCrash: (msg: string) => void;
}

class PrivyErrorBoundary extends Component<BoundaryProps, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch(e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Privy] crash:", msg);
    this.props.onCrash(msg);
  }
  render() { return this.state.crashed ? null : this.props.children; }
}

interface Props {
  children: ReactNode;
  onCrash: (msg: string) => void;
}

export default function PrivyClaimProvider({ children, onCrash }: Props) {
  if (!APP_ID) {
    setTimeout(() => onCrash("NEXT_PUBLIC_PRIVY_APP_ID not set"), 0);
    return null;
  }
  return (
    <PrivyErrorBoundary onCrash={onCrash}>
      <PrivyProvider
        appId={APP_ID}
        config={{
          appearance: { theme: "dark", accentColor: "#ffffff" },
          loginMethods: ["email"],
          embeddedWallets: { solana: { createOnLogin: "users-without-wallets" } },
        }}
      >
        {children}
      </PrivyProvider>
    </PrivyErrorBoundary>
  );
}
