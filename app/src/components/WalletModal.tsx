"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";

export function WalletModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  const handleConnect = (isNew: boolean) => {
    onClose();
    router.push(isNew ? "/setup?demo=1" : "/dashboard?demo=1");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl"
        >
          <div className="flex items-center justify-between p-6 border-b border-white/5">
            <h3 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#888]" />
              Connect Wallet
            </h3>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-[#888] hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-sm text-[#888] font-medium tracking-wide">Simulate connection for the demo:</p>

            <button
              onClick={() => handleConnect(false)}
              className="w-full flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:border-white/20 group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <h4 className="text-white font-medium">Phantom (Returning)</h4>
                  <p className="text-xs text-[#888]">Has configured inheritance</p>
                </div>
              </div>
              <div className="text-xs font-mono text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">Demo</div>
            </button>

            <button
              onClick={() => handleConnect(true)}
              className="w-full flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all hover:border-white/20 group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-yellow-500 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <h4 className="text-white font-medium">Solflare (New)</h4>
                  <p className="text-xs text-[#888]">No legacy configured yet</p>
                </div>
              </div>
              <div className="text-xs font-mono text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity">Demo</div>
            </button>
          </div>

          <div className="p-6 bg-white/[0.02] border-t border-white/5">
            <p className="text-xs text-center text-[#666]">
              By connecting your wallet, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
