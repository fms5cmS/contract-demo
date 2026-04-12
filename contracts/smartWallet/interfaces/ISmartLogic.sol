// SPDX-License-Identifier: UXUY
pragma solidity ^0.8.22;

interface ISmartLogic {
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

    function initialize(address owner_, address admin_) external;

    function pause() external;

    function unpause() external;

    function changeAdmin(address newAdmin) external;

    function setAdminAuthorization(uint256 daysDuration) external;

    function adminAuthorizedUntil() external view returns (uint256);

    function getNonce() external view returns (uint256);

    function owner() external view returns (address);

    function admin() external view returns (address);

    function executeBatch(
        address[] calldata dest,
        uint256[] calldata value,
        bytes[] calldata func
    ) external;

    function executeBatchByAdmin(ExecuteParams calldata params) external;
}
