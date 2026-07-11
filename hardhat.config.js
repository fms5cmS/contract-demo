require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: [".env.common", ".env.deploy", ".env.tx"] });

const rawPrivateKey =
  process.env.SPONSOR_PRIVATE_KEY ||
  process.env.PRIVATE_KEY ||
  "";
const PRIVATE_KEY = rawPrivateKey
  ? (rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`)
  : "";
const RPC_URL = process.env.RPC_URL || "";
const CHAIN_ID = Number(process.env.CHAIN_ID || "11155111");
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
    // 单一目标链 slot：同一时间只对接一条链，切链只需要改 .env.common 里的
    // RPC_URL / CHAIN_ID，不需要新增 network 配置块。
    custom: {
      url: RPC_URL,
      chainId: CHAIN_ID,
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      custom: ETHERSCAN_API_KEY || "no-api-key-needed",
    },
    // Robinhood Chain 用 Blockscout（不是 Etherscan），customChains 把
    // "custom" network 指到它的 Blockscout API。切到别的链验证时需要改这里。
    customChains: [
      {
        network: "custom",
        chainId: 4663,
        urls: {
          apiURL: "https://robinhoodchain.blockscout.com/api",
          browserURL: "https://robinhoodchain.blockscout.com",
        },
      },
    ],
  },
};
