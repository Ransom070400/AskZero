/**
 * Top up a 0G compute provider sub-account from your ledger.
 *
 * Usage:
 *   npx tsx scripts/topup-provider.ts <providerAddress> <amount0G>
 *
 * Example (image gen provider, +0.5 0G):
 *   npx tsx scripts/topup-provider.ts 0xE29a72c7629815Eb480aE5b1F2dfA06f06cdF974 0.5
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";

const RPC_URL =
  process.env.NEXT_PUBLIC_ZERO_G_RPC_URL ??
  process.env.ZERO_G_CHAIN_RPC_URL ??
  "https://evmrpc.0g.ai";
const PRIVATE_KEY = process.env.ZERO_G_PRIVATE_KEY;

async function main() {
  const [provider, amountStr] = process.argv.slice(2);
  if (!provider || !amountStr) {
    console.error("Usage: npx tsx scripts/topup-provider.ts <providerAddress> <amount0G>");
    process.exit(1);
  }
  if (!PRIVATE_KEY) {
    console.error("ZERO_G_PRIVATE_KEY not set in .env.local");
    process.exit(1);
  }

  let amountNeuron: bigint;
  try {
    amountNeuron = ethers.parseEther(amountStr); // 0.5 -> 500000000000000000n
  } catch {
    console.error(`Invalid amount: ${amountStr}`);
    process.exit(1);
  }
  if (amountNeuron <= BigInt(0)) {
    console.error(`Amount must be positive: ${amountStr}`);
    process.exit(1);
  }

  const wallet = new ethers.Wallet(
    PRIVATE_KEY,
    new ethers.JsonRpcProvider(RPC_URL)
  );
  console.log(`Wallet: ${await wallet.getAddress()}`);
  console.log(`Provider: ${provider}`);
  console.log(`Amount: ${amountStr} 0G (${amountNeuron} neuron)`);

  const broker = await createZGComputeNetworkBroker(wallet);

  console.log("Transferring from ledger to provider sub-account...");
  await broker.ledger.transferFund(provider, "inference", amountNeuron);
  console.log("Done.");

  try {
    const acct = await broker.inference.getAccount(provider);
    console.log("Provider sub-account:", acct);
  } catch {
    // getAccount may not exist on all SDK versions — ignore.
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
