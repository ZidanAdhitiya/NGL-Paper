require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY    = process.env.PRIVATE_KEY    || "0x0000000000000000000000000000000000000000000000000000000000000001";
const CELOSCAN_KEY   = process.env.CELOSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },

  networks: {
    /* ── Celo Mainnet ───────────────────────────────── */
    celo: {
      url:     "https://forno.celo.org",
      chainId: 42220,
      accounts: [PRIVATE_KEY],
    },
    /* ── Celo Alfajores (testnet) ───────────────────── */
    alfajores: {
      url:     "https://alfajores-forno.celo-testnet.org",
      chainId: 44787,
      accounts: [PRIVATE_KEY],
    },
  },

  /* ── Etherscan V2 verification (covers Celo + Alfajores) ── */
  etherscan: {
    apiKey: CELOSCAN_KEY,   // Single Etherscan V2 key works for all chains
    customChains: [
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL:     "https://api.etherscan.io/v2/api?chainid=42220",
          browserURL: "https://celoscan.io",
        },
      },
      {
        network: "alfajores",
        chainId: 44787,
        urls: {
          apiURL:     "https://api.etherscan.io/v2/api?chainid=44787",
          browserURL: "https://alfajores.celoscan.io",
        },
      },
    ],
  },

  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
