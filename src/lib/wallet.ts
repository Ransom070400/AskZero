import { ethers } from "ethers";
import { zerogChain } from "./zerog-chains";
import { depositMessage } from "./og-token";

// Lightweight injected-wallet helpers (MetaMask / any EIP-1193 wallet). No extra
// deps — uses ethers' BrowserProvider. Wallet-native features only run client-side.
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_ZERO_G_CHAIN_ID ?? "16661");

interface Eip1193 {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

function injected(): Eip1193 {
  const eth =
    typeof window !== "undefined"
      ? (window as unknown as { ethereum?: Eip1193 }).ethereum
      : undefined;
  if (!eth) {
    throw new Error(
      "No wallet found. Install MetaMask (or another 0G-compatible wallet) to pay with 0G."
    );
  }
  return eth;
}

export async function connectWallet(): Promise<{
  provider: ethers.BrowserProvider;
  signer: ethers.Signer;
  address: string;
}> {
  const provider = new ethers.BrowserProvider(injected());
  await provider.send("eth_requestAccounts", []);
  await ensureZeroGChain(provider);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address };
}

async function ensureZeroGChain(provider: ethers.BrowserProvider): Promise<void> {
  const net = await provider.getNetwork();
  if (Number(net.chainId) === CHAIN_ID) return;

  const chain = zerogChain(CHAIN_ID);
  const hexId = "0x" + CHAIN_ID.toString(16);
  try {
    await provider.send("wallet_switchEthereumChain", [{ chainId: hexId }]);
  } catch (err) {
    const e = err as { code?: number; message?: string };
    const notAdded = e?.code === 4902 || /Unrecognized chain|not.*added/i.test(e?.message ?? "");
    if (!notAdded) throw err;
    await provider.send("wallet_addEthereumChain", [
      {
        chainId: hexId,
        chainName: chain.name,
        nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
        rpcUrls: [chain.rpc],
        blockExplorerUrls: [chain.explorer],
      },
    ]);
  }
}

// Send `amountOg` 0G to `to`, wait until it's mined, return the tx hash.
export async function sendOG(
  signer: ethers.Signer,
  to: string,
  amountOg: string
): Promise<string> {
  const tx = await signer.sendTransaction({
    to,
    value: ethers.parseEther(amountOg),
  });
  await tx.wait(1);
  return tx.hash;
}

// Sign the ownership proof the server verifies against tx.from.
export async function signDepositProof(
  signer: ethers.Signer,
  txHash: string
): Promise<string> {
  return signer.signMessage(depositMessage(txHash));
}
