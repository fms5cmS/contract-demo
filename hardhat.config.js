require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const rawPrivateKey =
  process.env.SPONSOR_PRIVATE_KEY ||
  process.env.PRIVATE_KEY ||
  "";
const PRIVATE_KEY = rawPrivateKey
  ? (rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`)
  : "";
const SEPOLIA_RPC_URL =
  process.env.RPC_URL ||
  process.env.SEPOLIA_RPC_URL ||
  "";
const CHAIN_ID = Number(process.env.CHAIN_ID || "11155111");
const ETH_MAINNET_RPC_URL = process.env.ETH_MAINNET_RPC_URL || "";
const ETHERSCAN_API_KEY =
  process.env.ETHERSCAN_API_KEY ||
  process.env.BSCSCAN_API_KEY ||
  "";

const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      chainId: CHAIN_ID,
      accounts,
    },
    bsc: {
      url: SEPOLIA_RPC_URL,
      chainId: CHAIN_ID,
      accounts,
    },
    mainnet: {
      url: ETH_MAINNET_RPC_URL,
      chainId: 1,
      accounts,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
};
