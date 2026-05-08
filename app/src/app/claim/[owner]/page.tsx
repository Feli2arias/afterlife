"use client";
import dynamic from "next/dynamic";

const ClaimInner = dynamic(() => import("./ClaimInner"), { ssr: false });

export default function ClaimPage({ params }: { params: Promise<{ owner: string }> }) {
  return <ClaimInner params={params} />;
}
