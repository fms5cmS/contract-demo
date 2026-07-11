# Robinhood Chain 部署日志

只记录 `contracts/smartWallet/` 这套合约（`SmartWallet` + `WalletRegistry`）在 Robinhood Chain（chainId 4663，mainnet）上的真实链上部署，其他链的部署记录另建同名文件（如 `sepolia.md`）。

## 2026-07-11T06:32:16Z

- 网络：Robinhood Chain mainnet（chainId 4663），RPC `https://rpc.mainnet.chain.robinhood.com`
- 部署账号：`0x9B3390F251A28f3b9EF82621270B4b7c0dE6cC4a`（同时也是下面的 Registry owner）
- 部署脚本：`scripts/deploy-smart-wallet.js`（`npm run deploy:smart-wallet`）

### WalletRegistry

- 地址：`0x8c38a0715A689466b5dAc3616f9b8B17aE66d4A0`
- 交易哈希：`0x061c3600ce673454fc04e770582f8f9cb21c9e50a5ca3de0b858309f74c69a31`
- 区块号：`6729351`
- 构造参数：`initialOwner = 0x9B3390F251A28f3b9EF82621270B4b7c0dE6cC4a`
- Blockscout：https://robinhoodchain.blockscout.com/address/0x8c38a0715A689466b5dAc3616f9b8B17aE66d4A0#code
- 开源验证：已验证（`npx hardhat verify --network custom`）

### SmartWallet

- 地址：`0xeBC22966e03607913069b5c567CddE91812713e5`
- 交易哈希：`0x592228c7670048119a409fbaa8d95a2122130a17c23b7e48a48a2666f4b2f652`
- 区块号：`6729384`
- 构造参数：`registry = 0x8c38a0715A689466b5dAc3616f9b8B17aE66d4A0`
- Blockscout：https://robinhoodchain.blockscout.com/address/0xeBC22966e03607913069b5c567CddE91812713e5#code
- 开源验证：已验证（`npx hardhat verify --network custom`）

### 部署时写入的 WalletRegistry 白名单

- `addAdmins`: `0x9B3390F251A28f3b9EF82621270B4b7c0dE6cC4a`
- `addGasReceives`: `0xe1c7e50a76d3470f335b55ffe5f008ddb138926c`
