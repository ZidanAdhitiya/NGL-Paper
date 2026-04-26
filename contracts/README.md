# NGLPaper Smart Contract

**NGLPaperPayment.sol** — Payment contract on Celo for the MiniPay mini-apps competition.

Accepts **CELO** (native) and **cUSD** (ERC-20) per page of document explained.

---

## Quick Deploy

### 1. Install dependencies
```bash
cd contracts
npm install
```

### 2. Create your .env
```bash
cp .env.example .env
# Fill in PRIVATE_KEY and CELOSCAN_API_KEY
```

> Get a free Celoscan API key at https://celoscan.io/myapikey

### 3. Deploy to Alfajores (testnet first)
```bash
npm run deploy:alfajores
```
Copy the output lines into `backend/.env`:
```
CONTRACT_ADDRESS_ALFAJORES=0x...
CUSD_ADDRESS_ALFAJORES=0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1
```

### 4. Test everything on Alfajores, then deploy to mainnet
```bash
npm run deploy:mainnet
```
Copy the output lines into `backend/.env`:
```
CONTRACT_ADDRESS_MAINNET=0x...
CUSD_ADDRESS_MAINNET=0x765DE816845861e75A25fCA122bb6898B8B1282a
```

### 5. Verify on Celoscan (copy the command from deploy output)
```bash
npx hardhat verify --network celo <CONTRACT_ADDRESS> <CUSD_ADDRESS> <PRICE_CELO_WEI> <PRICE_CUSD_WEI>
```

---

## Contract Functions

| Function | Description |
|---|---|
| `explainWithCELO(pages)` | Pay with native CELO. Send `pricePerPageCELO * pages` wei as `msg.value`. |
| `explainWithCUSD(pages)` | Pay with cUSD. Caller must `approve` first. |
| `withdraw()` | Owner: withdraw all CELO. |
| `withdrawCUSD()` | Owner: withdraw all cUSD. |
| `setPrices(celoWei, cusdWei)` | Owner: update prices per page. |
| `transferOwnership(newOwner)` | Owner: transfer contract ownership. |

---

## Addresses

| Token | Celo Mainnet | Celo Alfajores |
|---|---|---|
| cUSD | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | `0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1` |

---

## backend/.env keys required

```env
CONTRACT_ADDRESS_MAINNET=0x...    # after mainnet deploy
CONTRACT_ADDRESS_ALFAJORES=0x...  # after testnet deploy
# CUSD addresses are hardcoded in the backend — no need to add them
```
