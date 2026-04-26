const { ethers, network } = require("hardhat");

/* ── cUSD addresses ───────────────────────────────────── */
const CUSD = {
  42220: "0x765DE816845861e75A25fCA122bb6898B8B1282a", // Celo Mainnet
  44787: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1", // Celo Alfajores
};

/* ── Pricing ──────────────────────────────────────────── */
// cUSD: $0.01 per page  →  0.01 * 1e18 = 1e16
const PRICE_CUSD = ethers.parseUnits("0.01", 18);

// CELO: ~$0.01 per page, assuming 1 CELO ≈ $0.45
// $0.01 / $0.45 ≈ 0.0222 CELO  →  owner can update via setPrices()
const PRICE_CELO = ethers.parseEther("0.0222");

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId    = Number((await ethers.provider.getNetwork()).chainId);
  const isMainnet  = chainId === 42220;
  const netName    = isMainnet ? "Celo Mainnet" : "Celo Alfajores";
  const cUSDAddr   = CUSD[chainId];

  if (!cUSDAddr) {
    throw new Error(`Unknown chainId ${chainId}. Use --network celo or --network alfajores`);
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("═══════════════════════════════════════════════");
  console.log(`  NGL Paper — Deploying to ${netName}`);
  console.log("═══════════════════════════════════════════════");
  console.log(`  Deployer : ${deployer.address}`);
  console.log(`  Balance  : ${ethers.formatEther(balance)} CELO`);
  console.log(`  cUSD     : ${cUSDAddr}`);
  console.log(`  Price/pg : ${ethers.formatEther(PRICE_CELO)} CELO | ${ethers.formatEther(PRICE_CUSD)} cUSD`);
  console.log("───────────────────────────────────────────────");

  if (balance === 0n) {
    throw new Error("Deployer has 0 CELO balance — fund your wallet first!");
  }

  console.log("\nDeploying NGLPaperPayment...");
  const Factory  = await ethers.getContractFactory("NGLPaperPayment");
  const contract = await Factory.deploy(cUSDAddr, PRICE_CELO, PRICE_CUSD);
  await contract.waitForDeployment();

  const addr = await contract.getAddress();
  const verifyCmd = `npx hardhat verify --network ${isMainnet ? "celo" : "alfajores"} ${addr} ${cUSDAddr} ${PRICE_CELO.toString()} ${PRICE_CUSD.toString()}`;

  console.log("\n✅  NGLPaperPayment deployed!");
  console.log(`    Address  : ${addr}`);
  console.log(`    Explorer : ${isMainnet ? "https://celoscan.io" : "https://alfajores.celoscan.io"}/address/${addr}`);
  console.log("\n─── Add to backend/.env ────────────────────────");
  if (isMainnet) {
    console.log(`CONTRACT_ADDRESS_MAINNET=${addr}`);
    console.log(`CUSD_ADDRESS_MAINNET=${cUSDAddr}`);
  } else {
    console.log(`CONTRACT_ADDRESS_ALFAJORES=${addr}`);
    console.log(`CUSD_ADDRESS_ALFAJORES=${cUSDAddr}`);
  }
  console.log("\n─── Verify on Celoscan ─────────────────────────");
  console.log(verifyCmd);
  console.log("═══════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
