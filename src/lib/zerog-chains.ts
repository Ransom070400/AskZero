// 0G chain metadata. Receipts store the chain_id they were anchored on, so the
// explorer link and on-chain read must be derived from THAT chain — not a single
// hardcoded default (historically some batches were anchored on Galileo testnet).
export interface ZeroGChain {
  id: number;
  name: string;
  rpc: string;
  explorer: string;
}

export const ZEROG_CHAINS: Record<number, ZeroGChain> = {
  16661: {
    id: 16661,
    name: "0G Mainnet",
    rpc: "https://evmrpc.0g.ai",
    explorer: "https://chainscan.0g.ai",
  },
  16602: {
    id: 16602,
    name: "0G Galileo Testnet",
    rpc: "https://evmrpc-testnet.0g.ai",
    explorer: "https://chainscan-galileo.0g.ai",
  },
};

export function zerogChain(chainId?: number | null): ZeroGChain {
  return (chainId != null && ZEROG_CHAINS[chainId]) || ZEROG_CHAINS[16661];
}

export function txUrl(chainId: number | null | undefined, hash: string): string {
  return `${zerogChain(chainId).explorer}/tx/${hash}`;
}

export function addressUrl(chainId: number | null | undefined, addr: string): string {
  return `${zerogChain(chainId).explorer}/address/${addr}`;
}
