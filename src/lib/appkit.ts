"use client";

import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { defineChain } from "@reown/appkit/networks";
import { zerogChain } from "./zerog-chains";

// Reown AppKit (formerly Web3Modal) with the ethers adapter — gives the
// wallet-chooser modal (MetaMask, Coinbase, Rabby…) + WalletConnect (QR for
// mobile wallets). Requires a free project id from https://dashboard.reown.com.
export const REOWN_PROJECT_ID = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";
export const APPKIT_READY = !!REOWN_PROJECT_ID;

// Same chain the deposit route verifies against (both read NEXT_PUBLIC_ZERO_G_CHAIN_ID)
// so the wallet always pays on the chain the server checks.
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_ZERO_G_CHAIN_ID ?? "16661");
const meta = zerogChain(CHAIN_ID);

const zeroG = defineChain({
  id: CHAIN_ID,
  caipNetworkId: `eip155:${CHAIN_ID}`,
  chainNamespace: "eip155",
  name: meta.name,
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: { default: { http: [meta.rpc] } },
  blockExplorers: {
    default: { name: "0G Chainscan", url: meta.explorer },
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
