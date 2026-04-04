/**
 * 0G Compute Setup Script
 *
 * Run with: npx tsx scripts/setup-0g.ts
 *
 * This script:
 * 1. Connects to 0G chain with your wallet
 * 2. Creates a ledger account
 * 3. Deposits A0GI tokens to the ledger
 * 4. Lists available models/providers
 * 5. Acknowledges provider signers (creates sub-accounts)
 *
 * Prerequisites:
 * - ZERO_G_PRIVATE_KEY set in .env.local
 * - Wallet has A0GI tokens (get from faucet for testnet)
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { ethers } from "ethers";
import {
  createZGComputeNetworkBroker,
  createZGComputeNetworkReadOnlyBroker,
} from "@0glabs/0g-serving-broker";

const RPC_URL =
  process.env.ZERO_G_CHAIN_RPC_URL || "https://evmrpc-testnet.0g.ai";
const PRIVATE_KEY = process.env.ZERO_G_PRIVATE_KEY;
const DEPOSIT_AMOUNT = 3; // A0GI tokens to deposit into ledger (minimum 3 required)

async function main() {
  if (!PRIVATE_KEY) {
    console.error("❌ ZERO_G_PRIVATE_KEY not set in .env.local");
    process.exit(1);
  }

  console.log("🔗 Connecting to 0G chain...");
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const address = await wallet.getAddress();
  console.log(`   Wallet: ${address}`);

  const balance = await provider.getBalance(address);
  console.log(
    `   Balance: ${ethers.formatEther(balance)} A0GI`
  );

  if (balance < ethers.parseEther(String(DEPOSIT_AMOUNT))) {
    console.error(
      `❌ Wallet needs at least ${DEPOSIT_AMOUNT} A0GI. Get testnet tokens from https://faucet.0g.ai`
    );
    process.exit(1);
  }

  console.log("\n📦 Initializing broker...");
  const broker = await createZGComputeNetworkBroker(wallet);

  // Step 1: Deposit funds (this also creates the ledger account)
  console.log(`\n2️⃣  Depositing ${DEPOSIT_AMOUNT} A0GI to ledger...`);
  try {
    await broker.ledger.depositFund(DEPOSIT_AMOUNT);
    console.log(`   ✅ Deposited ${DEPOSIT_AMOUNT} A0GI`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("   ❌ Failed:", msg);
  }

  // Step 3: List available providers
  console.log("\n3️⃣  Fetching available models...");
  const readOnlyBroker = await createZGComputeNetworkReadOnlyBroker(RPC_URL);
  const services = await readOnlyBroker.inference.listService();

  const chatServices = services.filter(
    (s: { serviceType: string }) =>
      s.serviceType === "chatbot" || s.serviceType === "chat"
  );

  if (chatServices.length === 0) {
    console.log("   ⚠️  No chat models found on the network");
    console.log("\n✅ Setup complete (no providers to acknowledge)");
    return;
  }

  console.log(`   Found ${chatServices.length} chat model(s):\n`);
  chatServices.forEach(
    (
      s: { provider: string; model: string; url: string },
      i: number
    ) => {
      console.log(`   [${i}] Model: ${s.model}`);
      console.log(`       Provider: ${s.provider}`);
      console.log(`       URL: ${s.url}\n`);
    }
  );

  // Step 4: Acknowledge provider signers
  console.log("4️⃣  Acknowledging provider signers...");
  for (const service of chatServices) {
    const addr = (service as { provider: string }).provider;
    try {
      await broker.inference.acknowledgeProviderSigner(addr);
      console.log(
        `   ✅ Acknowledged: ${addr.slice(0, 10)}...`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already") || msg.includes("acknowledged")) {
        console.log(
          `   ℹ️  Already acknowledged: ${addr.slice(0, 10)}...`
        );
      } else {
        console.error(
          `   ❌ Failed for ${addr.slice(0, 10)}...: ${msg}`
        );
      }
    }
  }

  console.log("\n✅ Setup complete! 0G Compute is ready to use.");
  console.log(
    "\n   Add a provider address to your chat to start using real AI inference."
  );
}

main().catch(console.error);
