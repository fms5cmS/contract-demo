# SmartWallet Sepolia 日志

这里只记录 `test/smartWallet` 目录下与 `smartWallet` 合约相关的链上交易。

## 2026-04-12T02:28:48.000Z
- 合约: SmartWallet
- 测试文件: type4-delegate-init-execute.test.js
- 交易哈希: `0xc9d3da377ce058056b93d5859e3d37675226fed6bc2b372c99188c1801189128`
- 区块号: 10641119
- 钱包 EOA: `0xEf2005ACF7D7d1472890c2068039037300618aD6`
- 说明: 这是单入口 SmartWallet type-4 流程的首次 Sepolia 手工冒烟验证。赞助地址 `0x9B3390F251A28f3b9EF82621270B4b7c0dE6cC4a` 将新的 EOA 委托到实现合约 `0xE39B180DD6c0Fb6662dC1Ee78b2953C47032A53D`，触发了 `Initialized(owner=0xEf2005ACF7D7d1472890c2068039037300618aD6)`，随后向 spender `0xDB115FB6b4a3b74346eaA747a9d45DfBBB8e2B4C` 完成了 3 笔 ERC20 授权，额度分别为 `1`、`2`、`3`。

## 2026-04-12T02:42:24.000Z
- 合约: SmartWallet
- 测试文件: type4-delegate-init-execute.test.js
- 交易哈希: `0x6e9ec9aa38a2e8e5f166b96ed27c14ebba73f9c8dfed0baab3f61a5b16a277b3`
- 区块号: 10641187
- 钱包 EOA: `0xaB07E45Ceeb53691e91FF815C38FE7f4f5E5B7d0`
- 说明: 这是同一条 SmartWallet type-4 委托 + 初始化 + 执行链路的后续 Sepolia 验证。赞助地址 `0x9B3390F251A28f3b9EF82621270B4b7c0dE6cC4a` 将新的 EOA 委托到实现合约 `0xE39B180DD6c0Fb6662dC1Ee78b2953C47032A53D`，触发了 `Initialized(owner=0xaB07E45Ceeb53691e91FF815C38FE7f4f5E5B7d0)`，随后向 spender `0xDB115FB6b4a3b74346eaA747a9d45DfBBB8e2B4C` 完成了同样的 3 笔 ERC20 授权，额度分别为 `1`、`2`、`3`。

## 2026-04-12T02:55:36.000Z
- 合约: SmartWallet
- 测试文件: type4-delegate-init-execute.test.js
- 交易哈希: `0x9872ed297cd30d1ea3ee975d1a6224d3664c03695799a655e0211cff3eb71c06`
- 区块号: 10641250
- 钱包 EOA: `0x28493f8996d1917DEd4Ff39B7E2Ae599dF3b9F9e`
- 说明: 这是测试文件移动到 `test/smartWallet/` 目录之后的一次 Sepolia 验证。赞助地址 `0x9B3390F251A28f3b9EF82621270B4b7c0dE6cC4a` 将新的 EOA 委托到实现合约 `0xE39B180DD6c0Fb6662dC1Ee78b2953C47032A53D`，触发了 `Initialized(owner=0x28493f8996d1917DEd4Ff39B7E2Ae599dF3b9F9e)`，随后向 spender `0xDB115FB6b4a3b74346eaA747a9d45DfBBB8e2B4C` 完成了同样的 3 笔 ERC20 授权，额度分别为 `1`、`2`、`3`。

## 2026-04-12T03:39:04.356Z
- 合约: SmartWallet
- 测试文件: type4-delegate-init-execute.test.js
- 交易哈希: `0x5956ef4b9ba540898d054be9a624a1d4cf524ff39df2ddcf83dea842dd1deef5`
- 区块号: 10641463
- 钱包 EOA: `0x959FADa6c5439f2E8dc2cFd6830EbC51C55f606f`
- 说明: 赞助地址 0x9B3390F251A28f3b9EF82621270B4b7c0dE6cC4a 发起了一笔 type-4 交易，将配置文件中的 EOA 0x959FADa6c5439f2E8dc2cFd6830EbC51C55f606f 委托到实现合约 0xE39B180DD6c0Fb6662dC1Ee78b2953C47032A53D，在同一笔交易中完成初始化并向 spender 0xDB115FB6b4a3b74346eaA747a9d45DfBBB8e2B4C 批量授权 3 个 ERC20，额度分别为 1、2、3。

## 2026-04-12T05:09:05.411Z
- 合约: SmartWallet
- 测试文件: direct-execute-batch-revoke.test.js
- 交易哈希: `0xa24ea1a4ea4c423e22f8e54084a22506d56402909f1836e29a4262a6fa243004`
- 区块号: 10641896
- 钱包 EOA: `0x959FADa6c5439f2E8dc2cFd6830EbC51C55f606f`
- 说明: 配置文件中的 EOA 0x959FADa6c5439f2E8dc2cFd6830EbC51C55f606f 直接发起了一笔普通交易（非 type-4），在已经完成委托和初始化的 SmartWallet 上执行批量取消授权，将 spender 0xDB115FB6b4a3b74346eaA747a9d45DfBBB8e2B4C 对 3 个 ERC20 的授权额度统一撤销为 0。
