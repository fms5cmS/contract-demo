// SPDX-License-Identifier: UXUY
pragma solidity ^0.8.24;

interface ISmartWallet {
    struct ExecuteParams {
        address[] dest;
        uint256[] value;
        bytes[] func;
        address gasToken;
        uint256 gasFee;
        address gasReceive;
        bool gasDeductBefore;
        uint256 userNonce;
        bytes ownerSignature;
    }

    function executeBatch(ExecuteParams calldata params) external;

    function owner() external view returns (address);

    function getNonce() external view returns (uint256);

    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4);
}
