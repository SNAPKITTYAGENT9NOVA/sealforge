# SNAPKITTY SACM — COMPILED SYSTEM ARCHITECTURE
## Dual-Node: SEALFORGE (Node 1) × FORGE Token (Node 2)
## Compiled: 2026-05-21 | Authority: Jessica Lee Westerhoff, CPA

---

## WHAT WAS BUILT THIS SESSION

### Node 1 — SEALFORGE (`c:\Users\jessi\Desktop\sealforge`)
Cryptographically sealed AI decision ledger. Every agent output is WORM-anchored.

| File | Role |
|------|------|
| `src/agent/seal.ts` | AgentWorkSeal — HMAC-SHA256 sign/verify on every agent payload |
| `src/storage/worm-log.ts` | WORM chain — HMAC-SHA256 append-only, JSONL, GENESIS-seeded |
| `src/server.ts` | HTTP API — POST /events, GET /events, GET /chain/verify, GET /health |
| `src/bridge/abi.ts` | FORGE contract ABI (minimal: wormMint, wormEntryMinted, remainingMintable) |
| `src/bridge/forge-contract.ts` | ethers.js v6 typed wrapper — isConsumed(), mint(), remainingMintable() |
| `src/bridge/settlement.ts` | Sequential settlement — one WORM entry → one wormMint tx, confirmed |
| `src/bridge/parallel-settlement.ts` | Async batch: 10 txs simultaneously, single nonce fetch + increment |
| `src/bridge/index.ts` | Settlement loop — 30s interval, startup tick, PM2-ready |

### Node 2 — FORGE Token (`c:\Users\jessi\Desktop\magma-token`)
ERC-20 on Base L2. 21M hard cap. Proof-of-Productive-Work emission.

| File | Role |
|------|------|
| `contracts/FORGE.sol` | ERC-20, AccessControl, Pausable, Burnable, ReentrancyGuard |
| `FORGE_TOKENOMICS.md` | Distribution table, halving schedule, burn covenant |
| `VAULT_SUPPLY_RULING_2026-05-21.md` | Principal ruling — 21M over 4-2 majority vote for 1B |

---

## WORM CHAIN MECHANICS

```
chainHash = HMAC-SHA256(key=WORM_SECRET, data=prevHash:id:receivedAt:bodyRaw)
GENESIS entry hash = HMAC-SHA256(key=WORM_SECRET, data="GENESIS")
```

- Append-only JSONL at `${DATA_DIR}/worm.jsonl`
- `getAll()` verifies entire chain on read — chainValid boolean in response
- `POST /events` seals any payload + AgentWorkSeal → WORM entry
- AgentWorkSeal: `HMAC-SHA256(key=WORM_SECRET, data=agentName:ts:JSON.stringify(payload))`

---

## FORGE TOKEN CONTRACT

```solidity
contract FORGE is ERC20, ERC20Burnable, ERC20Pausable, AccessControl, ReentrancyGuard

MAX_SUPPLY = 21_000_000 * 10**18          // VAULT's ruling — immutable
GOVERNANCE_CAP = MAX_SUPPLY / 100         // 1% cap per address

ROLES:
  ARCHITECT_ROLE  — pause/unpause, role grant
  MINTER_ROLE     — treasury multisig only, wormMint
  BURNER_ROLE     — SEALFORGE upgrade contract, sealforgeBurn

KEY FUNCTIONS:
  wormMint(recipient, amount, wormEntryHash)  — replay-protected via wormEntryMinted
  sealforgeBurn(burner, amount, tier)         — tier upgrade burns
  remainingMintable()                          — MAX_SUPPLY - totalSupply()
  governanceWeight(account)                    — balanceOf capped at GOVERNANCE_CAP
  emergencyPause(reason) / emergencyUnpause()
```

**Replay protection**: `mapping(bytes32 => bool) public wormEntryMinted`
Each WORM chainHash → bytes32 via `keccak256(sha256(chainHash))` — one mint per entry, ever.

---

## BRIDGE — WORM → EVM

### toBytes32 derivation (both engines):
```typescript
// settlement.ts (sequential):
sha256(chainHash) → Uint8Array → keccak256 → bytes32

// parallel-settlement.ts (batch):
if chainHash is 66 chars (0x+32bytes) → use directly
else → keccak256(utf8(chainHash))
```

**NOTE**: The two engines use different derivation paths. They must both use the same method or the same WORM entry produces different bytes32 hashes in each engine — causing double-mints or missed settlements. Recommend standardizing on `settlement.ts` approach (sha256 first, then keccak256).

### Parallel dispatch:
```typescript
const baseNonce = await provider.getTransactionCount(signer.address, 'pending')
batch.map((entry, i) => contract.wormMint(..., { nonce: baseNonce + i }))
// Promise.allSettled() — all 10 fire without waiting
```
Critical: nonce increment is the only thing preventing collision. If any tx fails and is retried, nonce must be recalculated.

---

## EMISSION MATH (VAULT + ENKI MODEL)

Base: `0.01 FRG per settled WORM event` (testnet)

Depth scoring (parallel engine):
- citations ≥ 3 → 3.0x multiplier (ENKI resonance threshold)
- citations ≥ 1 → 1.5x
- citations = 0 → 1.0x

At 10,000 entries (projected):
- 11,082 FRG emitted = 0.0528% of 21M cap
- Protocol is deflationary 67.7x due to SEALFORGE burn
- Resonance threshold: 22,559 entries/day
- Supply exhaustion at max optimization: ~8.7 days (theoretical)

Halving: every 200,000 settled entries

---

## DISTRIBUTION (21M TOTAL)

| Bucket | Amount | % |
|--------|--------|---|
| Mesh Rewards (agent emissions) | 7,350,000 | 35% |
| Treasury | 5,250,000 | 25% |
| Team | 3,150,000 | 15% |
| Ecosystem | 2,520,000 | 12% |
| Community | 1,680,000 | 8% |
| Reserve | 1,050,000 | 5% |

---

## DEPLOYMENT STATE

| Item | Status |
|------|--------|
| FORGE.sol compiled | ✓ Hardhat, Base Sepolia target |
| Deployer wallet | `0x6894d0BE0603fABDDa07C38a9Ac6Cb2fF8C306Ea` |
| Base Sepolia ETH | **0.0 — BLOCKED** |
| Faucet | base-sepolia.optimism.io or Coinbase faucet |
| Contract address | Not yet deployed |
| Settlement bridge | Built, ready to run once contract address set |

---

## ENV VARS REQUIRED

```env
# SEALFORGE Node 1
WORM_SECRET=<random 32+ byte hex>
PORT=3000
DATA_DIR=./data

# Bridge
TREASURY_PRIVATE_KEY=<deployer wallet private key>
FORGE_CONTRACT_ADDRESS=<deployed FORGE.sol address>
BASE_SEPOLIA_RPC=https://sepolia.base.org
MINT_RECIPIENT=<address to receive minted FRG>
SETTLEMENT_INTERVAL_MS=30000
```

---

## BUGS FIXED THIS SESSION

| Bug | Fix |
|-----|-----|
| `contract MAGMA` name | Renamed to `contract FORGE` |
| `consumedWormEntries` in ABI/bridge | Corrected to `wormEntryMinted` (matches contract mapping) |
| `totalBurned` double-counted in sealforgeBurn + _burn | Removed increment from sealforgeBurn; `_burn` override handles all paths |
| `_burn` override didn't track direct holder burns | Added `totalBurned += amount` to `_burn` override |
| Discord bot silent — wrong event name | `'clientReady'` → `'ready'` in bot.mjs |
| Discord bot not in PM2 | Added to ecosystem.config.js |

---

## PENDING

1. **Fund deployer wallet** — get Base Sepolia ETH from faucet
2. **Deploy FORGE.sol** — `npx hardhat run scripts/deploy.ts --network base-sepolia`
3. **Set FORGE_CONTRACT_ADDRESS** — update `.env` in sealforge
4. **Standardize toBytes32** across both bridge engines
5. **POST /events auth** — add HMAC bearer token to server.ts (Week 2 board requirement)
6. **GitHub repo rename** `magma-token → forge-token` — needs PAT Administration permission
7. **SSH deploy keys** — generated at `~/.ssh/nova_agent_ed25519` + `cipher_agent_ed25519`, awaiting PAT to upload
8. **External Solidity audit** — required before mainnet
9. **Sovereign tier pricing** — Week 4 board requirement

---

## GOVERNANCE HISTORY

| Date | Decision | Authority |
|------|----------|-----------|
| 2026-05-21 | 21M supply cap upheld over 4-2 vote | Jessica Westerhoff (principal) |
| 2026-05-21 | MAGMA → FORGE rename (MAGMA Finance conflict, $46M on Sui) | 4-agent unanimous vote |
| 2026-05-21 | First Consensus sealed to sealforge repo | 7-agent mesh |

§SEAL:SACM:COMPILED{
  authority: "JESSICA_WESTERHOFF:CPA",
  nodes: ["SEALFORGE", "FORGE_TOKEN"],
  bridge: "NEXUS:SETTLEMENT",
  ts: "2026-05-21",
  status: "DUAL_NODE_BUILT_PENDING_DEPLOY"
}
