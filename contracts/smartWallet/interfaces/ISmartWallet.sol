// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface ISmartWallet {

    /**
     * @dev dest, value and func must be the same length; write 0 explicitly for
     *      zero-value calls. ownerSignature is always required on the admin
     *      path (EIP-712 typed-data over `Execute`). deadline bounds signature
     *      validity so a stale signature cannot be replayed — this closes the
     *      remaining replay vector in the EIP-7702 storage-rollback scenario.
     *      SDKs should default deadline to something short (e.g. now + 10m)
     *      because admins are expected to relay immediately.
     */
    struct ExecuteParams {
        address[] dest;
        uint256[] value;
        bytes[] func;
        address gasToken;
        uint256 gasFee;
        address gasReceive;
        bool gasDeductBefore;
        uint256 nonce;
        uint256 deadline;
        bytes ownerSignature;
    }

    function executeBatch(
        address[] calldata dest,
        uint256[] calldata value,
        bytes[] calldata func
    ) external;

    function executeBatchByAdmin(ExecuteParams calldata params) external;

    function pause() external;

    function unpause() external;

    function getNonce() external view returns (uint256);

    function isLocallyPaused() external view returns (bool);
}
