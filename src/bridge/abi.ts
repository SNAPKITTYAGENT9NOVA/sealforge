/**
 * FORGE ERC-20 Contract ABI — minimal surface for settlement bridge
 * Only the functions required by the WORM-Proof-of-Productive-Work engine.
 *
 * NEXUS — Orchestration Agent (connecting SEALFORGE Node 1 → FORGE Node 2)
 */

export const FORGE_ABI = [
  // Mint tokens for a verified WORM entry — requires MINTER_ROLE
  {
    name: 'wormMint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'wormEntryHash', type: 'bytes32' },
    ],
    outputs: [],
  },

  // Returns true if a given WORM entry hash has already been minted
  {
    name: 'wormEntryMinted',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },

  // Returns how many tokens remain mintable before MAX_SUPPLY is hit
  {
    name: 'remainingMintable',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },

  // Hard cap on total supply
  {
    name: 'MAX_SUPPLY',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const
