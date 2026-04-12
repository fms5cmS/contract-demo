# contract-self

A Hardhat-based Solidity workspace centered on the `SmartWallet` contract and its Sepolia integration flow.

## Prerequisites

- Node.js 20+ recommended
- npm

The template was verified on this machine with Node.js `18.20.4`, but Hardhat emits a warning on that runtime. Using Node.js 20+ avoids that warning and is the recommended setup.

## Install

```bash
npm install
```

## Environment Setup

Copy the example environment file and fill in values as needed:

```bash
cp .env.example .env
```

Environment variables:

- `RPC_URL`: Sepolia RPC endpoint
- `EOA_PRIVATE_KEY`: EOA private key used for EIP-7702 authorization tests
- `SPONSOR_PRIVATE_KEY`: sponsor private key used to send sponsored transactions
- `CHAIN_ID`: target chain id, currently `11155111`
- `ETHERSCAN_API_KEY`: Etherscan API key for contract verification
- `SMART_WALLET_ADDRESS`: deployed SmartWallet implementation address

## Compile

```bash
npm run compile
```

## Test

```bash
npm test
```

## Local Node

Start a local Hardhat node:

```bash
npm run node
```

## Deployment

Deploy the SmartWallet contract to the default network:

```bash
npm run deploy:smart-wallet
```

Deploy to Sepolia:

```bash
npm run deploy:smart-wallet:sepolia
```

The deploy script prints the deployed contract address after confirmation.

## Sepolia Type-4 Integration Test

The real-chain integration test is skipped by default so it does not spend gas during normal test runs.

Run it explicitly with:

```bash
npm run test:sepolia:type4
```

Test file:

- `test/smartWallet/type4-delegate-init-execute.test.js`

Related on-chain transaction log:

- `test/smartWallet/sepolia.md`

## Notes

- Local compile and test do not require external RPC credentials.
- The Sepolia type-4 integration test requires both `EOA_PRIVATE_KEY` and `SPONSOR_PRIVATE_KEY`.
- Sepolia deployment requires `RPC_URL` and a funded deployer key through the current Hardhat account configuration.
- Etherscan verification credentials are wired through `ETHERSCAN_API_KEY`.

## 中文操作说明

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

先复制示例文件：

```bash
cp .env.example .env
```

然后按实际情况填写：

- `RPC_URL`：Sepolia RPC 地址
- `EOA_PRIVATE_KEY`：用于 EIP-7702 委托和钱包直连测试的 EOA 私钥
- `SPONSOR_PRIVATE_KEY`：用于代付 gas 的 sponsor 私钥
- `CHAIN_ID`：当前使用 `11155111`
- `ETHERSCAN_API_KEY`：Etherscan 开源验证所需的 API key
- `SMART_WALLET_ADDRESS`：已部署的 SmartWallet 实现合约地址

### 3. 编译合约

```bash
npm run compile
```

### 4. 运行默认测试

```bash
npm test
```

说明：

- 默认测试不会主动发送真实 Sepolia 交易
- 真实链测试默认是 `skip` 状态，避免日常执行时误消耗 gas

### 5. 执行 Sepolia type-4 真实链测试

```bash
npm run test:sepolia:type4
```

这条测试会在 Sepolia 上验证：

- EOA 通过 type-4 交易委托到 SmartWallet 实现合约
- 在同一笔交易中完成初始化
- 在同一笔交易中完成批量授权执行

对应测试文件：

- `test/smartWallet/type4-delegate-init-execute.test.js`

对应链上日志文件：

- `test/smartWallet/sepolia.md`

### 6. 部署 SmartWallet

默认网络部署：

```bash
npm run deploy:smart-wallet
```

部署到 Sepolia：

```bash
npm run deploy:smart-wallet:sepolia
```
