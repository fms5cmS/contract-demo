# contract-self

这是一个基于 Hardhat 的 Solidity 项目，当前主要围绕 `SmartWallet` 合约及其在 Sepolia 上的真实链测试流程展开。

## 环境要求

- 建议使用 Node.js 20 及以上版本
- 需要 `npm`

当前这台机器上已经验证过 Node.js `18.20.4` 也能运行，但 Hardhat 会给出版本警告。实际使用时更建议切到 Node.js 20。

## 安装依赖

```bash
npm install
```

## 环境变量配置

先复制示例文件：

```bash
cp .env.example .env
```

然后填写下面这些字段：

- `RPC_URL`
  Sepolia RPC 地址。
- `EOA_PRIVATE_KEY`
  用于 EIP-7702 委托和钱包直连测试的 EOA 私钥。
- `SPONSOR_PRIVATE_KEY`
  用于代付 gas 的 sponsor 私钥。
- `CHAIN_ID`
  当前项目默认使用 `11155111`。
- `ETHERSCAN_API_KEY`
  Etherscan 开源验证所需的 API key。
- `SMART_WALLET_ADDRESS`
  已部署的 SmartWallet 实现合约地址。

## 常用命令

### 编译

```bash
npm run compile
```

### 默认测试

```bash
npm test
```

说明：

- 默认测试不会主动发送真实 Sepolia 交易。
- 真实链测试默认都是 `skip`，避免日常执行时误消耗 gas。

### 本地节点

```bash
npm run node
```

## 部署

### 默认网络部署 SmartWallet

```bash
npm run deploy:smart-wallet
```

### 部署到 Sepolia

```bash
npm run deploy:smart-wallet:sepolia
```

部署脚本在成功后会输出合约地址。

## Sepolia 真实链测试

### 1. type-4 委托 + 初始化 + 批量授权

执行命令：

```bash
npm run test:sepolia:type4
```

作用：

- 使用配置文件中的 `EOA_PRIVATE_KEY` 对应 EOA。
- 通过 type-4 交易把该 EOA 委托到 `SMART_WALLET_ADDRESS` 指向的 SmartWallet 实现合约。
- 在同一笔交易里完成初始化。
- 在同一笔交易里完成批量授权执行。

当前测试目标：

- token `0x0B6a0A69B7040b2281730cBaE6060b3b1b2ed3A9` 授权额度 `1`
- token `0xd67215fD6c0890493F34aF3C5E4231cE98871fCb` 授权额度 `2`
- token `0x10279e6333f9d0EE103F4715b8aaEA75BE61464C` 授权额度 `3`
- spender `0xDB115FB6b4a3b74346eaA747a9d45DfBBB8e2B4C`

对应测试文件：

- `test/smartWallet/type4-delegate-init-execute.test.js`

### 2. 普通交易批量取消授权

执行命令：

```bash
npm run test:sepolia:revoke
```

作用：

- 依然使用配置文件中的 `EOA_PRIVATE_KEY` 对应 EOA。
- 不再走 type-4。
- 直接由该 EOA 发起普通交易，调用已经完成委托和初始化的 SmartWallet。
- 批量将上述 3 个 token 对同一个 spender 的授权额度撤销为 `0`。

说明：

- 这条测试要求配置中的 EOA 已经完成过 SmartWallet 的委托和初始化。
- 如果 EOA 主链币余额不足，测试内部会先通过 sponsor 强制补充一小笔 ETH，用于支付普通交易 gas。

对应测试文件：

- `test/smartWallet/direct-execute-batch-revoke.test.js`

## 链上日志记录

`test/smartWallet` 目录下的真实链测试会把 `smartWallet` 相关交易记录到按链名命名的日志文件中。

当前日志文件：

- `test/smartWallet/sepolia.md`

日志内容包括：

- 测试文件名
- 交易哈希
- 区块号
- 钱包 EOA
- 本次链上操作的中文说明

## 目录说明

- `contracts/smartWallet/`
  SmartWallet 合约与接口。
- `scripts/`
  部署脚本。
- `test/smartWallet/`
  SmartWallet 相关测试和对应链上日志。
- `docs/superpowers/`
  设计文档和实现计划。

## 补充说明

- 本地编译和默认测试不依赖外部 RPC。
- `test:sepolia:type4` 需要 `EOA_PRIVATE_KEY` 和 `SPONSOR_PRIVATE_KEY` 都有效。
- `test:sepolia:revoke` 同样依赖这两个私钥，其中 sponsor 主要用于必要时补 gas。
- Etherscan 验证能力已经接入 `ETHERSCAN_API_KEY`。
