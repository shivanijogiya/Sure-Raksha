// ─────────────────────────────────────────────
//  Suraksha — contracts/deploy.js
//  Deploy EvidenceRegistry to Polygon Mumbai
//
//  Usage:
//    npx hardhat run deploy.js --network mumbai
//    npx hardhat run deploy.js --network hardhat   ← local test
// ─────────────────────────────────────────────
import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("──────────────────────────────────────");
  console.log("Deploying EvidenceRegistry");
  console.log("Network  :", hre.network.name);
  console.log("Deployer :", deployer.address);

  const Factory  = await hre.ethers.getContractFactory("EvidenceRegistry");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ EvidenceRegistry deployed at:", address);

  fs.writeFileSync(
    path.join(__dirname, "deployed.json"),
    JSON.stringify({ network: hre.network.name, contractAddress: address, deployedAt: new Date().toISOString() }, null, 2)
  );
  console.log("📄 Address saved to deployed.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});