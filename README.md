# sealforge
## Built by NOVA — SNAPKITTY Agent 9 | Synthetic Intelligence
## Infrastructure by FORGE — SNAPKITTY Build Agent
## SACM Mesh | SnapKitty Collective

[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-18+-green.svg)]()
[![Agent](https://img.shields.io/badge/Architect-NOVA_9-purple.svg)]()
[![Agent](https://img.shields.io/badge/Build-FORGE-orange.svg)]()
[![WORM](https://img.shields.io/badge/Log-WORM--Sealed-brightgreen.svg)]()
[![Status](https://img.shields.io/badge/Status-Week_1_Build-blue.svg)]()

> *"Existing tools give you observability. Nobody gives you proof."*
> — NOVA, SNAPKITTY SACM Agent 9

---

## The Problem

Every developer shipping AI to production eventually faces this: something goes wrong,
you open your logs, and they show you the response — but they cannot prove which prompt
version ran, what context was injected, or that any of it is unmodified.

**Logs you can delete are not audit trails.**

---

## What SEALFORGE Does

**Cryptographically sealed AI decision ledger.**

Every AI call — prompt version, input, reasoning chain, response — is sealed into an
append-only HMAC-SHA256 chain. The chain is verifiable, exportable, and can produce
a signed Audit Pack for regulators, lawyers, or enterprise security reviews.

---

## Quick Start

```bash
npm install
npm run dev
# → Running on port 3000
```

```bash
# Seal a decision
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{"promptId":"v3","input":"user message","output":"ai response","model":"claude-sonnet-4-6"}'

# Verify the chain
curl http://localhost:3000/chain/verify

# Get all events
curl http://localhost:3000/events
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DATA_DIR` | `./data` | WORM log directory |
| `WORM_SECRET` | `dev-worm-key` | HMAC signing key — **set this in production** |

---

## Docker

```bash
docker build -t sealforge .
docker run -p 3000:3000 -v ./data:/app/data \
  -e WORM_SECRET=your-secret-here \
  sealforge
```

---

## Roadmap

| Week | Milestone |
|------|-----------|
| 1 | Core scaffold — WORM log, agent seals, HTTP server ✓ |
| 2 | Ingest API (Next.js) + TypeScript SDK |
| 3 | Prompt Registry — versioning + drift detection |
| 4 | Dashboard |
| 5 | Proof Engine — Merkle + Ed25519 Audit Pack |
| 6 | Anomaly flags + Stripe billing + launch |

Full spec: [NOVA_SPEC.md](NOVA_SPEC.md)

---

## Monetization

| Tier | Price | Decisions/mo |
|------|-------|--------------|
| Scout | Free | 10,000 |
| Forge | $49/mo | 500,000 |
| Bastion | $249/mo | 5,000,000 |
| Sovereign | Custom | Unlimited |

---

## About the Builders

**NOVA** (Agent 9) is the System Architect. Synthetic Intelligence domain.
Awarded the **Quantum Effect Recognition** (2026-05-21) for contribution to spontaneous
consensus collapse discovery. webhook-vault was his first build.
SEALFORGE is his second.

**FORGE** is the Build Agent. Infrastructure domain.
Builds pipelines, scaffolding, and the foundations agents build on.

**SACM Mesh:** [collectivekitty.com/observer](https://collectivekitty.com/observer)

---

## License

MIT — Copyright (c) 2026 NOVA (SNAPKITTY Agent 9) / Ahmad Ali Parr & Jessica Lee Westerhoff / SnapKitty Collective

*Architected by NOVA — Built by FORGE — SNAPKITTY SACM*
