# Robinhood Chain 交易日志

记录 `scripts/swap-via-okx.js` 在 Robinhood Chain（chainId 4663，mainnet）上真实广播（`BROADCAST=true`）的执行结果。dry-run 不记录。

## 2026-07-11T07:33:21Z

- 交易哈希：`0xdd4d619d539ccfc448efb3927a88abb55265a2636062229460c807c3de3295bf`
- 类型：EIP-7702 type-4（链上确认 `type: "0x4"`，`authorizationList` 长度 1）
- 区块号：`6765726`
- 状态：成功（`status: 0x1`），gasUsed `287908`
- Blockscout：https://robinhoodchain.blockscout.com/tx/0xdd4d619d539ccfc448efb3927a88abb55265a2636062229460c807c3de3295bf

### 参与方

- 委托方 / 付款方 EOA：`0xE1c7E50A76d3470F335B55ffe5F008dDB138926C`（本笔交易通过 EIP-7702 委托到 `SmartWallet` 实现合约 `0xeBC22966e03607913069b5c567CddE91812713e5`）
- 代付 / 广播方（admin）：`0x9B3390F251A28f3b9EF82621270B4b7c0dE6cC4a`

### swap 详情

- 方向：sell
- fromToken：`0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`（原生代币）
- toToken：`0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34`
- minReceiveAmount（OKX 返回）：`178314460890299537`
- swap 路由目标（OKX DEX Router）：`0xE58b3089dF6667fBf99b75595a1671BaF6797D6d`
- `SWAP_RECEIVER_ADDRESS`：`0x9B3390F251A28f3b9EF82621270B4b7c0dE6cC4a`（自定义收款地址，不是 EOA 自己；链上 Transfer 日志实测确认，toToken 直接到了这个地址，没经过 EOA）

### 手续费

- gasToken：`0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34`（toToken，sell 方向按约定从这个代币扣）
- gasFee：`0`（本次 `FEE_PERCENT=0`，验证流程用，未真实收手续费）
- gasReceive：`0xE1c7E50A76d3470F335B55ffe5F008dDB138926C`

### 备注

本次是脚本的首次真实广播验证。过程中发现并修复了两个问题：
1. `.env.tx` 里 `OKX_API_PASSPHRASE` 含 `#` 未加引号，被 dotenv 当注释截断，导致 OKX 认证失败（`OK-ACCESS-PASSPHRASE incorrect`）——配置问题，非代码问题。
2. `sendTransaction` 未显式指定 `gas`，viem 对 eip7702 交易的自动 gas 估算不可靠，导致首次广播因 `intrinsic gas too low` 失败（未上链，未消耗资金）。已加 `TX_GAS_LIMIT` 配置项（默认 `2000000`）修复。

另外，`SWAP_RECEIVER_ADDRESS` 自定义收款地址 + sell 方向从 `toToken` 收手续费的组合仍有已知设计缺口（详见对话记录），本次因为 `FEE_PERCENT=0` 绕开，未修复，后续要真实收手续费前需要处理。

## 2026-07-11T07:48:17Z

- 交易哈希：`0x1d31bd2e6b5fe0ebf8bd095d255593e1e5a352d0797cc43392e1d6ad81b29292`
- 类型：普通交易（链上确认 `type: "0x2"`，无 `authorizationList`）——EOA 已经在上一笔委托过 `SmartWallet`，脚本检测到已委托后自动跳过重复授权，省了约 12,500 gas
- 区块号：`6774760`
- 状态：成功（`status: 0x1`），gasUsed `283241`
- Blockscout：https://robinhoodchain.blockscout.com/tx/0x1d31bd2e6b5fe0ebf8bd095d255593e1e5a352d0797cc43392e1d6ad81b29292

### 参与方

- 委托方 / 付款方 EOA：`0xE1c7E50A76d3470F335B55ffe5F008dDB138926C`
- 代付 / 广播方（admin）：`0x9B3390F251A28f3b9EF82621270B4b7c0dE6cC4a`

### swap 详情

- 方向：buy
- fromToken：`0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34`（上一笔 sell 换出来的代币，本次用作购买资金）
- toToken：`0x5fc5360d0400a0fd4f2af552add042d716f1d168`
- minReceiveAmount（OKX 返回）：`178303`
- swap 路由目标（OKX DEX Router）：`0xE58b3089dF6667fBf99b75595a1671BaF6797D6d`
- `SWAP_RECEIVER_ADDRESS`：未设置，默认等于 EOA 自己（链上 Transfer 日志确认 toToken 到账 EOA，amount `180105`）

### 手续费

- gasToken：`0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34`（fromToken，buy 方向按约定从这个代币扣，`gasDeductBefore=true`，swap 前扣）
- gasFee：`180115617060908`
- gasReceive：`0xE1c7E50A76d3470F335B55ffe5F008dDB138926C`（和 EOA 是同一个地址，链上 Transfer 日志显示是一笔 EOA 到自己的自转账）

### 备注

复现过程中先遇到过一次 `Insufficient token for gas` revert：EOA 当时这个 fromToken 余额是 0（上一笔 sell 换出的代币被 `SWAP_RECEIVER_ADDRESS` 指定发去了 `0x9B3390...`，从没进过 EOA），用户手动转了一笔 `0x5d3a1Ff2...` 到 EOA 后重跑成功。
