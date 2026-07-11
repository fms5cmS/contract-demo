# contract-self

这是一个基于 Hardhat 的 Solidity 项目，当前围绕 `SmartWallet`（EIP-7702 智能账户实现）及其 `WalletRegistry` 治理合约展开。

> **来源说明（仅文档记录，合约代码中不出现）**：`contracts/smartWallet/SmartWallet.sol`、`WalletRegistry.sol`、`interfaces/ISmartWallet.sol` 迁移自 `uxuy-smart-wallet/ethereum/contracts/UxuySmartProxyV3.sol`（原名 `UxuySmartWalletV3` / `UxuySmartProxyV3` 及配套的 `UxuyRegistry.sol`）。迁移时移除了所有 "uxuy" 品牌字样、合约名与接口名去 uxuy 化、EIP-712 domain name 改名、ERC-7201 storage slot 按新命名空间重新计算，因为这份合约会被部署上链，不应带有原品牌标识。

## 环境要求

- 建议使用 Node.js 20 及以上版本
- 需要 `npm`

当前这台机器上已经验证过 Node.js `18.20.4` 也能运行，但 Hardhat 会给出版本警告。实际使用时更建议切到 Node.js 20。

## 安装依赖

```bash
npm install
```

## 环境变量配置

按模块拆成了三个文件，各自复制对应的 `.example` 模板：

```bash
cp .env.common.example .env.common
cp .env.deploy.example .env.deploy
cp .env.tx.example .env.tx
```

### `.env.common`（通用，部署和交易脚本共用）

同一时间只对接一条链（不做跨链），网络配置是单个 `custom` network slot，切链只需要改这里的 `RPC_URL`/`CHAIN_ID`，不需要新增 network 配置块。

- `PRIVATE_KEY`
  签名账号私钥，部署时是部署者；`swap-via-okx.js` 里如果没填 `SPONSOR_PRIVATE_KEY` 就 fallback 用这个当代付账号。
- `SPONSOR_PRIVATE_KEY`（可选）
  `swap-via-okx.js` 专用的代付账号私钥，独立于部署账号。是广播交易、垫付 gas 的 admin/relayer（`SmartWallet.executeBatchByAdmin` 的 `msg.sender`）——**必须先用 owner 账号调用 `WalletRegistry.addAdmins()` 把这个地址加进白名单，否则会 revert "Not an authorized admin"**。留空则用 `PRIVATE_KEY`。
- `RPC_URL` / `CHAIN_ID`
  目标链的 RPC 地址和 chainId。默认 `CHAIN_ID` 是 `11155111`（Sepolia）；部署到 Robinhood Chain 主网时改成 `https://rpc.mainnet.chain.robinhood.com` / `4663`。
- `SMART_WALLET_ADDRESS`
  当前目标链上已部署的 `SmartWallet` 实现合约地址，`swap-via-okx.js` 用它作为 EIP-7702 委托目标。部署后手动填，不是自动读取的。

### `.env.deploy`（只在部署 `WalletRegistry` / `SmartWallet` 时用到）

- `REGISTRY_OWNER`
  部署 `WalletRegistry` 时传入的 owner 地址（拥有 pause / admin 白名单 / gasReceive 白名单的完全控制权，且不可 renounce）。
- `ADMIN_ADDRESSES`（可选，逗号分隔）
  部署后立即写入 `WalletRegistry.addAdmins()` 的 relayer 地址；不设置的话 `executeBatchByAdmin` 会全部 revert，需要 owner 之后单独调用。
- `GAS_RECEIVE_ADDRESSES`（可选，逗号分隔）
  部署后立即写入 `WalletRegistry.addGasReceives()` 的收款地址；不设置的话任何 `gasFee > 0` 的 `executeBatchByAdmin` 都会 revert。
- `DEPLOY_GAS_LIMIT`（可选）
  覆盖默认 `3000000` 的部署 gas limit。
- `ETHERSCAN_API_KEY`
  合约开源验证用的 Etherscan V2 API key。

### `.env.tx`（`scripts/swap-via-okx.js` 用）

通过 OKX DEX Aggregator 完成一笔 swap，用 EIP-7702 在一笔交易里完成「委托 + swap + 收手续费」，admin（`.env.common` 的 `PRIVATE_KEY`）代付 gas，走 `SmartWallet.executeBatchByAdmin`。全部参数走配置文件，没有 CLI 参数。

- `OKX_API_KEY` / `OKX_API_SECRET` / `OKX_API_PASSPHRASE` / `OKX_API_PROJECT`
  OKX Onchain OS API 凭证（[Developer Portal](https://web3.okx.com/onchainos/dev-portal/project) 申请）。
- `EOA_PRIVATE_KEY`
  委托方（付款方）EOA 私钥，会被 EIP-7702 委托到 `SMART_WALLET_ADDRESS`。和 admin 广播账号是两个不同账号。
- `SWAP_SIDE`
  `buy`（花 `FROM_TOKEN_ADDRESS` 买 `TO_TOKEN_ADDRESS`）或 `sell`（反过来）。决定手续费扣哪个代币：buy 扣 `FROM_TOKEN_ADDRESS`，sell 扣 `TO_TOKEN_ADDRESS`。
- `FROM_TOKEN_ADDRESS` / `TO_TOKEN_ADDRESS`
  代币合约地址。原生代币（ETH）用 OKX 约定的占位地址 `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`（不是 `address(0)`，脚本内部会转换成合约需要的 `address(0)`）。
- `AMOUNT`
  卖出数量，带精度的最小单位。
- `SLIPPAGE_PERCENT`
  滑点百分比，0-100。
- `SWAP_RECEIVER_ADDRESS`（可选）
  买入资产的收款地址，留空默认等于 `EOA_PRIVATE_KEY` 对应地址。
- `FEE_PERCENT`
  手续费百分比：buy 按 `AMOUNT` 算，sell 按 OKX 返回的 `minReceiveAmount` 算（不用预估到手量，防止滑点导致手续费比实际到账还多）。
- `GAS_RECEIVE_ADDRESS`
  手续费收款地址，必须已经在 `WalletRegistry.addGasReceives()` 白名单里，否则链上会 revert。
- `BROADCAST`
  `true` 才真实广播交易；默认（留空/其他值）是 dry-run，只构造交易 + `eth_call` 模拟，不上链。

## 常用命令

### 编译

```bash
npm run compile
```

### 默认测试

```bash
npm test
```

### 本地节点

```bash
npm run node
```

## 部署

`WalletRegistry` 和 `SmartWallet` 由同一个脚本 `scripts/deploy-smart-wallet.js` 依次部署（先 Registry，后传入 Registry 地址部署 SmartWallet），跑在 `.env.common` 里配置的目标链上：

```bash
npm run deploy:smart-wallet
```

部署脚本成功后会输出 `WalletRegistry` 和 `SmartWallet` 的合约地址。

## 通过 OKX 完成一笔 swap（EIP-7702 委托 + swap + 收手续费一笔交易完成）

```bash
npm run swap
```

默认 dry-run（只打印构造出的交易和模拟结果，不广播），`.env.tx` 里 `BROADCAST=true` 才会真实上链。

## 目录说明

- `contracts/smartWallet/`
  `SmartWallet.sol`（EIP-7702 委托实现）、`WalletRegistry.sol`（全局 pause / admin 白名单 / gasReceive 白名单治理合约）与 `interfaces/ISmartWallet.sol`。
- `scripts/`
  部署脚本、`swap-via-okx.js`（OKX swap 交易脚本）、`scripts/lib/okx-client.js`（OKX API 签名 + 请求封装）。
- `deployments/`
  按链名命名的真实链上部署日志（合约地址、交易哈希、区块号、白名单配置），部署到新链后手动补一份。
- `transactions/`
  按链名命名的真实链上交易日志（`swap-via-okx.js` 在 `BROADCAST=true` 下的执行记录），dry-run 不记录。
- `docs/superpowers/`
  设计文档和实现计划。

## 补充说明

- 本地编译和默认测试不依赖外部 RPC。
- Etherscan 验证能力已经接入 `ETHERSCAN_API_KEY`。
