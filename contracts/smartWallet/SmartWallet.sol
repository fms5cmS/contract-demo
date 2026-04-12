// SPDX-License-Identifier: UXUY
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import {ISmartWallet} from "./interfaces/ISmartWallet.sol";

contract SmartWallet is ISmartWallet {
    using SafeERC20 for IERC20;

    bytes4 private constant EIP1271_MAGIC_VALUE = 0x1626ba7e;
    bytes4 private constant EIP1271_INVALID_VALUE = 0xffffffff;

    address private immutable SELF;

    /// @custom:storage-location erc7201:contract-self.smart-wallet
    struct SmartWalletStorage {
        address owner;
        uint256 nonce;
        bool initialized;
        bool entered;
    }

    bytes32 private constant STORAGE_SLOT =
        bytes32((uint256(keccak256("erc7201:contract-self.smart-wallet")) - 1) & ~uint256(0xff));

    error DirectCallForbidden();
    error InvalidSignature();
    error InvalidNonce();
    error ArrayLengthMismatch();
    error InvalidGasReceiver();
    error InsufficientNativeBalance();
    error InsufficientTokenBalance();
    error NotOwner();
    error ExternalCallFailed(bytes returndata);
    error GasFeeNotAllowedForOwnerCall();

    event Initialized(address indexed owner);
    event Executed(address indexed caller, address[] dest, uint256[] value, bytes[] func);
    event GasPaid(address indexed token, address indexed receiver, uint256 amount);

    constructor() {
        SELF = address(this);
    }

    modifier notSelf() {
        if (address(this) == SELF) {
            revert DirectCallForbidden();
        }
        _;
    }

    modifier nonReentrant() {
        SmartWalletStorage storage $ = _s();
        require(!$.entered, "Reentrant call");
        $.entered = true;
        _;
        $.entered = false;
    }

    function executeBatch(ExecuteParams calldata params) external notSelf nonReentrant {
        _validateArrayLengths(params.dest, params.value, params.func);
        _authorizeExecution(params);

        if (params.gasDeductBefore) {
            _deductGasFee(params.gasToken, params.gasFee, params.gasReceive);
        }

        _executeCalls(params.dest, params.value, params.func);

        if (!params.gasDeductBefore) {
            _deductGasFee(params.gasToken, params.gasFee, params.gasReceive);
        }

        emit Executed(msg.sender, params.dest, params.value, params.func);
    }

    function owner() external view notSelf returns (address) {
        return _s().owner;
    }

    function getNonce() external view notSelf returns (uint256) {
        return _s().nonce;
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view notSelf returns (bytes4) {
        SmartWalletStorage storage $ = _s();
        if (!$.initialized) {
            return EIP1271_INVALID_VALUE;
        }

        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(hash, signature);
        if (err == ECDSA.RecoverError.NoError && recovered == $.owner) {
            return EIP1271_MAGIC_VALUE;
        }

        return EIP1271_INVALID_VALUE;
    }

    function _s() private pure returns (SmartWalletStorage storage $) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            $.slot := slot
        }
    }

    function _validateArrayLengths(
        address[] calldata dest,
        uint256[] calldata value,
        bytes[] calldata func
    ) private pure {
        if (dest.length != func.length || (value.length != 0 && value.length != func.length)) {
            revert ArrayLengthMismatch();
        }
    }

    function _recoverExecuteSigner(ExecuteParams calldata params) private view returns (address) {
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(_executionMessageHash(params));
        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(digest, params.ownerSignature);

        if (err != ECDSA.RecoverError.NoError) {
            revert InvalidSignature();
        }

        return recovered;
    }

    function _executionMessageHash(ExecuteParams calldata params) private view returns (bytes32) {
        address[] memory dest = params.dest;
        uint256[] memory value = params.value;
        bytes[] memory func = params.func;
        address gasToken = params.gasToken;
        uint256 gasFee = params.gasFee;
        address gasReceive = params.gasReceive;
        bool gasDeductBefore = params.gasDeductBefore;
        uint256 userNonce = params.userNonce;

        return keccak256(
            abi.encode(
                dest,
                value,
                func,
                gasToken,
                gasFee,
                gasReceive,
                gasDeductBefore,
                userNonce,
                address(this),
                block.chainid
            )
        );
    }

    function _authorizeExecution(ExecuteParams calldata params) private {
        SmartWalletStorage storage $ = _s();

        if (!$.initialized) {
            _initializeOwner(params, $);
            return;
        }

        if (msg.sender == $.owner) {
            if (params.gasFee != 0) {
                revert GasFeeNotAllowedForOwnerCall();
            }
            return;
        }

        _authorizeRelayer(params, $);
    }

    function _initializeOwner(
        ExecuteParams calldata params,
        SmartWalletStorage storage $
    ) private {
        if (params.userNonce != $.nonce) {
            revert InvalidNonce();
        }

        address recovered = _recoverExecuteSigner(params);
        if (recovered == address(0)) {
            revert InvalidSignature();
        }

        $.owner = recovered;
        $.initialized = true;
        $.nonce += 1;

        emit Initialized(recovered);
    }

    function _authorizeRelayer(
        ExecuteParams calldata params,
        SmartWalletStorage storage $
    ) private {
        if (params.userNonce != $.nonce) {
            revert InvalidNonce();
        }

        if (_recoverExecuteSigner(params) != $.owner) {
            revert InvalidSignature();
        }

        $.nonce += 1;
    }

    function _deductGasFee(address gasToken, uint256 gasFee, address gasReceive) private {
        if (gasFee == 0) {
            return;
        }

        if (gasReceive == address(0)) {
            revert InvalidGasReceiver();
        }

        if (gasToken == address(0)) {
            if (address(this).balance < gasFee) {
                revert InsufficientNativeBalance();
            }

            (bool success, ) = gasReceive.call{value: gasFee}("");
            if (!success) {
                revert ExternalCallFailed("");
            }
        } else {
            IERC20 token = IERC20(gasToken);
            if (token.balanceOf(address(this)) < gasFee) {
                revert InsufficientTokenBalance();
            }

            token.safeTransfer(gasReceive, gasFee);
        }

        emit GasPaid(gasToken, gasReceive, gasFee);
    }

    function _executeCalls(
        address[] calldata dest,
        uint256[] calldata value,
        bytes[] calldata func
    ) private {
        for (uint256 i = 0; i < dest.length; i++) {
            uint256 callValue = value.length == 0 ? 0 : value[i];
            _call(dest[i], callValue, func[i]);
        }
    }

    function _call(address target, uint256 value, bytes calldata data) private {
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(returndata, 32), mload(returndata))
            }
        }
    }
}
