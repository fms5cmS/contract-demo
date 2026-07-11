// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "./interfaces/ISmartWallet.sol";
import "./WalletRegistry.sol";

/**
 * @title SmartWallet
 * @notice EIP-7702 smart-account implementation, replacing the V1/V2
 *         ERC1967 Proxy + UUPS architecture.
 */
contract SmartWallet is ISmartWallet, IERC1271, IERC721Receiver, IERC1155Receiver {
    using SafeERC20 for IERC20;

    address private immutable SELF;
    WalletRegistry private immutable REGISTRY;

    bytes32 private constant STORAGE_SLOT =
        0xdb1f696f7be77297cfa5f4fff9ec073b5983081335f10965ca614553c1c19900;

    struct SmartWalletStorage {
        uint64 nonce;
        uint8 status;   // reentrancy guard: 0 or 1 = not entered, 2 = entered
        bool paused;
    }

    function _s() private pure returns (SmartWalletStorage storage $) {
        assembly {
            $.slot := STORAGE_SLOT
        }
    }

    uint8 private constant _NOT_ENTERED = 1;
    uint8 private constant _ENTERED = 2;

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant EIP712_NAME = keccak256("SmartWallet");
    bytes32 private constant EIP712_VERSION = keccak256("3");

    bytes32 private constant EXECUTE_TYPEHASH =
        keccak256(
            "Execute(address[] dest,uint256[] value,bytes[] func,address gasToken,uint256 gasFee,address gasReceive,bool gasDeductBefore,uint256 nonce,uint256 deadline)"
        );

    event Executed(address[] target, uint256[] value, bytes[] data);
    event ExecutedByAdmin(
        address indexed admin,
        uint256 indexed nonce,
        address[] target,
        uint256[] value,
        bytes[] data
    );
    event EthTransferred(address indexed target, uint256 value);
    event GasReceived(address indexed from, address indexed to, address indexed token, uint256 amount);
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    constructor(address registry) {
        require(registry != address(0), "Invalid registry");
        SELF = address(this);
        REGISTRY = WalletRegistry(registry);
    }

    modifier notSelf() {
        require(address(this) != SELF, "Direct call to implementation forbidden");
        _;
    }

    modifier onlyOwner() {
        require(
            msg.sender == address(this) && tx.origin == address(this),
            "Not the owner"
        );
        _;
    }

    modifier onlyPlatformAdmin() {
        require(REGISTRY.adminAllowed(msg.sender), "Not an authorized admin");
        _;
    }

    modifier whenNotPaused() {
        require(!_s().paused, "Locally paused");
        require(!REGISTRY.paused(), "Globally paused");
        _;
    }

    modifier nonReentrant() {
        SmartWalletStorage storage $ = _s();
        require($.status != _ENTERED, "Reentrant call");
        $.status = _ENTERED;
        _;
        $.status = _NOT_ENTERED;
    }

    // ───── EIP-712 ─────
    function _domainSeparator() internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    EIP712_DOMAIN_TYPEHASH,
                    EIP712_NAME,
                    EIP712_VERSION,
                    block.chainid,
                    address(this)
                )
            );
    }

    function _hashTypedData(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
    }

    function _verifyOwnerSig(bytes32 digest, bytes calldata sig) internal view {
        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(digest, sig);
        require(err == ECDSA.RecoverError.NoError, "Bad signature");
        require(recovered == address(this), "Invalid owner signature");
    }

    function _executeStructHash(ExecuteParams calldata p) internal pure returns (bytes32) {
        uint256 n = p.dest.length;
        bytes32[] memory destPadded = new bytes32[](n);
        bytes32[] memory funcHashes = new bytes32[](n);
        for (uint256 i = 0; i < n;) {
            destPadded[i] = bytes32(uint256(uint160(p.dest[i])));
            funcHashes[i] = keccak256(p.func[i]);
            unchecked { ++i; }
        }
        return
            keccak256(
                abi.encode(
                    EXECUTE_TYPEHASH,
                    keccak256(abi.encodePacked(destPadded)),
                    keccak256(abi.encodePacked(p.value)),
                    keccak256(abi.encodePacked(funcHashes)),
                    p.gasToken,
                    p.gasFee,
                    p.gasReceive,
                    p.gasDeductBefore,
                    p.nonce,
                    p.deadline
                )
            );
    }

    // ───── Pause (local, owner-only) ─────
    function pause() external notSelf onlyOwner {
        _s().paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external notSelf onlyOwner {
        _s().paused = false;
        emit Unpaused(msg.sender);
    }

    // ───── Execution ─────
    function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external notSelf whenNotPaused onlyOwner nonReentrant {
        uint256 n = dest.length;
        require(n > 0, "Empty batch");
        require(
            n == func.length && value.length == func.length,
            "Array length mismatch"
        );
        for (uint256 i = 0; i < n;) {
            _call(dest[i], value[i], func[i]);
            unchecked { ++i; }
        }
        emit Executed(dest, value, func);
    }

    /// @dev Always requires an owner EIP-712 signature. The admin only relays.
    function executeBatchByAdmin(ExecuteParams calldata params) external notSelf whenNotPaused onlyPlatformAdmin nonReentrant {
        uint256 n = params.dest.length;
        require(n > 0, "Empty batch");
        require(
            n == params.func.length && params.value.length == params.func.length,
            "Array length mismatch"
        );

        require(block.timestamp <= params.deadline, "Signature expired");

        SmartWalletStorage storage $ = _s();
        require(params.nonce == $.nonce, "Invalid nonce");

        _verifyOwnerSig(_hashTypedData(_executeStructHash(params)), params.ownerSignature);

        unchecked { $.nonce += 1; }

        if (params.gasDeductBefore) {
            _deductGasFee(params.gasToken, params.gasFee, params.gasReceive);
        }

        for (uint256 i = 0; i < n;) {
            _call(params.dest[i], params.value[i], params.func[i]);
            unchecked { ++i; }
        }

        if (!params.gasDeductBefore) {
            _deductGasFee(params.gasToken, params.gasFee, params.gasReceive);
        }

        emit ExecutedByAdmin(msg.sender, params.nonce, params.dest, params.value, params.func);
    }

    // ───── Internal ─────
    function _deductGasFee(address gasToken, uint256 gasFee, address gasReceive) internal {
        if (gasFee == 0) return;
        require(REGISTRY.gasReceiveAllowed(gasReceive), "gasReceive not whitelisted");
        if (gasToken == address(0)) {
            require(address(this).balance >= gasFee, "Insufficient ETH for gas");
            (bool ok, ) = gasReceive.call{value: gasFee}("");
            require(ok, "ETH gas fee transfer failed");
        } else {
            require(
                IERC20(gasToken).balanceOf(address(this)) >= gasFee,
                "Insufficient token for gas"
            );
            IERC20(gasToken).safeTransfer(gasReceive, gasFee);
        }
        emit GasReceived(address(this), gasReceive, gasToken, gasFee);
    }

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        if (value > 0) {
            emit EthTransferred(target, value);
        }
    }

    // ───── Views ─────
    function getNonce() external view returns (uint256) {
        return _s().nonce;
    }

    function isLocallyPaused() external view returns (bool) {
        return _s().paused;
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparator();
    }

    // ───── EIP-1271 / ERC-721 / ERC-1155 / EIP-165 ─────
    function isValidSignature(bytes32 hash, bytes memory signature) external view override returns (bytes4) {
        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(hash, signature);
        if (err == ECDSA.RecoverError.NoError && recovered == address(this)) {
            return IERC1271.isValidSignature.selector;
        }
        return 0xffffffff;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4){
        return IERC721Receiver.onERC721Received.selector;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure override returns (bytes4){
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC1271).interfaceId ||
            interfaceId == type(IERC721Receiver).interfaceId ||
            interfaceId == type(IERC1155Receiver).interfaceId;
    }

    receive() external payable {
        require(address(this) != SELF, "Implementation cannot receive ETH");
    }
}
