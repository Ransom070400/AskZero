// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AskZero ReceiptRegistry
/// @notice Public notary for AskZero inference receipt batches. Each posted
///         root commits to a Merkle tree of receipt hashes; verification
///         happens off-chain against `roots[root] != 0`.
contract ReceiptRegistry {
    address public owner;
    mapping(address => bool) public posters;
    mapping(bytes32 => uint256) public roots;

    event RootPosted(
        bytes32 indexed root,
        uint64 leafCount,
        uint64 fromTs,
        uint64 toTs,
        address indexed poster
    );
    event PosterSet(address indexed poster, bool allowed);
    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error NotPoster();
    error RootExists();
    error ZeroAddress();

    constructor(address initialPoster) {
        if (initialPoster == address(0)) revert ZeroAddress();
        owner = msg.sender;
        posters[initialPoster] = true;
        emit PosterSet(initialPoster, true);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setPoster(address poster, bool allowed) external onlyOwner {
        if (poster == address(0)) revert ZeroAddress();
        posters[poster] = allowed;
        emit PosterSet(poster, allowed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    function postRoot(
        bytes32 root,
        uint64 leafCount,
        uint64 fromTs,
        uint64 toTs
    ) external {
        if (!posters[msg.sender]) revert NotPoster();
        if (roots[root] != 0) revert RootExists();
        roots[root] = block.timestamp;
        emit RootPosted(root, leafCount, fromTs, toTs, msg.sender);
    }

    function isAnchored(bytes32 root) external view returns (bool) {
        return roots[root] != 0;
    }
}
