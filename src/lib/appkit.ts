"use client";

import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { defineChain } from "@reown/appkit/networks";

// Reown AppKit (formerly Web3Modal) with the ethers adapter — gives the
// wallet-chooser modal (MetaMask, Coinbase, Rabby…) + WalletConnect (QR for
// mobile wallets). Requires a free project id from https://dashboard.reown.com.
export const REOWN_PROJECT_ID = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";
export const APPKIT_READY = !!REOWN_PROJECT_ID;

const zeroG = defineChain({
  id: 16661,
  caipNetworkId: "eip155:16661",
  chainNamespace: "eip155",
  name: "0G Mainnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc.0g.ai"] } },
  blockExplorers: {
    default: { name: "0G Chainscan", url: "https://chainscan.0g.ai" },
  },
});

// Initialize once, on the client only.
if (typeof window !== "undefined" && REOWN_PROJECT_ID) {
  createAppKit({
    adapters: [new EthersAdapter()],
    networks: [zeroG],
    defaultNetwork: zeroG,
    projectId: REOWN_PROJECT_ID,
    metadata: {
      name: "AskZero",
      description: "Verifiable AI on 0G",
      url: "https://askzerochat.xyz",
      icons: ["https://askzerochat.xyz/favicon.png"],
    },
    features: { analytics: false, email: false, socials: false },
  });
}
