/**
 * Deploy ReceiptRegistry to 0G chain.
 *
 * Run with: npx tsx scripts/deploy-receipt-registry.ts [--poster=0x...]
 *
 * Prerequisites:
 * - ZERO_G_PRIVATE_KEY in .env.local (deployer; needs 0G for gas)
 * - NEXT_PUBLIC_ZERO_G_RPC_URL or ZERO_G_CHAIN_RPC_URL set
 *
 * If --poster is omitted, the deployer also becomes the initial poster.
 * Pass --poster=0x... to use a separate batcher wallet (recommended for prod).
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import fs from "node:fs";
import path from "node:path";
import {
  ContractFactory,
  JsonRpcProvider,
  Wallet,
  formatEther,
  getAddress,
  isAddress,
  type InterfaceAbi,
} from "ethers";
// solc has no type defs; require keeps tsx happy without @types/solc.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const solc = require("solc");

interface SolcOutput {
  errors?: { severity: string; formattedMessage: string }[];
  contracts: Record<
    string,
    Record<string, { abi: InterfaceAbi; evm: { bytecode: { object: string } } }>
  >;
}

async function main() {
  const rpc =
    process.env.NEXT_PUBLIC_ZERO_G_RPC_URL ?? process.env.ZERO_G_CHAIN_RPC_URL;
  const deployerKey = process.env.ZERO_G_PRIVATE_KEY;
  const posterArg = process.argv
    .find((a) => a.startsWith("--poster="))
    ?.slice("--poster=".length);

  if (!rpc) throw new Error("NEXT_PUBLIC_ZERO_G_RPC_URL not set");
  if (!deployerKey || deployerKey.includes("your_private_key")) {
    throw new Error("ZERO_G_PRIVATE_KEY not set in .env.local");
  }
  if (posterArg && !isAddress(posterArg)) {
    throw new Error(
      `--poster must be a valid 0x address, got '${posterArg}'. Omit --poster to use the deployer.`
    );
  }

  const sourcePath = path.resolve("contracts/ReceiptRegistry.sol");
  const source = fs.readFileSync(sourcePath, "utf8");

  console.log("Compiling ReceiptRegistry.sol ...");
  const input = {
    language: "Solidity",
    sources: { "ReceiptRegistry.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object"] },
      },
    },
  };
  const output: SolcOutput = JSON.parse(solc.compile(JSON.stringify(input)));
  const fatal = (output.errors ?? []).filter((e) => e.severity === "error");
  if (fatal.length) {
    for (const e of fatal) console.error(e.formattedMessage);
    throw new Error("Solidity compile failed");
  }
  const compiled = output.contracts["ReceiptRegistry.sol"]["ReceiptRegistry"];
  const abi = compiled.abi;
  const bytecode = "0x" + compiled.evm.bytecode.object;

  const provider = new JsonRpcProvider(rpc);
  const wallet = new Wallet(deployerKey, provider);
  const network = await provider.getNetwork();
  const balance = await provider.getBalance(wallet.address);
  const initialPoster = posterArg ? getAddress(posterArg) : wallet.address;

  console.log("");
  console.log("RPC:           ", rpc);
  console.log("Chain ID:      ", network.chainId.toString());
  console.log("Deployer:      ", wallet.address);
  console.log("Balance:       ", formatEther(balance), "0G");
  console.log("Initial poster:", initialPoster);
  console.log("");

  if (balance === BigInt(0)) {
    throw new Error(
      "Deployer balance is 0 — fund this wallet from the 0G faucet first"
    );
  }

  const factory = new ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy(initialPoster);
  const deployTx = contract.deploymentTransaction();
  console.log("Deploy tx:     ", deployTx?.hash);

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("");
  console.log("Deployed at:   ", address);
  console.log("");
  console.log("Add to .env.local:");
  console.log(`RECEIPT_REGISTRY_ADDRESS=${address}`);
  if (initialPoster.toLowerCase() === wallet.address.toLowerCase()) {
    console.log("RECEIPT_BATCHER_PRIVATE_KEY=<same as ZERO_G_PRIVATE_KEY>");
  } else {
    console.log(`RECEIPT_BATCHER_PRIVATE_KEY=<private key for ${initialPoster}>`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
