// ─────────────────────────────────────────────
//  Suraksha — hardhat.config.js
// ─────────────────────────────────────────────
import "@nomicfoundation/hardhat-ethers";
import * as dotenv from "dotenv";
dotenv.config();

export default {
  solidity: "0.8.19",
  networks: {
    hardhat: {},
    mumbai: {
      url: process.env.POLYGON_RPC_URL || "https://rpc-mumbai.maticvigil.com",
      accounts: [`0x${(process.env.DEPLOYER_PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000001").replace(/^0x/, "")}`],
      chainId: 80001,
    },
  },
};