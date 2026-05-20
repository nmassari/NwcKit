# NwcKit

[![npm](https://img.shields.io/npm/v/nwckit)](https://www.npmjs.com/package/nwckit)
[![license](https://img.shields.io/npm/l/nwckit)](https://github.com/nmassari/nwckit/blob/main/LICENSE)

Browser-first TypeScript toolkit for Nostr Wallet Connect, Lightning payments and NWC-based Bitcoin swap flows.

**NwcKit** lets web apps connect to a user's NWC wallet, inspect wallet state, create invoices, pay invoices and call supported Lightning/on-chain swap methods over the same encrypted Nostr session.

No custody. No wallet switching. No node management in your frontend.

> Think: a Nostr-native wallet action layer for Bitcoin apps.

---

## 30-second example

```ts
import { NwcKit, parseNwcUri } from "nwckit";

const connection = parseNwcUri("nostr+walletconnect://...");

const client = new NwcKit({ connection });

await client.connect();

await client.payInvoice("lnbc...");

const invoice = await client.makeInvoice({
  amount: 2100,
  description: "Premium access",
});

const swap = await client.createLightningToOnchainSwap({
  amountSats: 2100,
  destinationAddress: "bc1q...",
});

await client.disconnect();
```

---

## What it does

NwcKit acts as a bridge between a browser app and a user's wallet service using **Nostr Wallet Connect** (NIP-47).

It supports standard wallet actions:

* Connect to an NWC wallet
* Read wallet info and balance
* Create Lightning invoices
* Pay Lightning invoices
* Look up invoices
* List transactions

It also supports NWC custom swap extensions, when the connected wallet service advertises them:

* Create on-chain to Lightning swaps
* Create Lightning to on-chain swaps
* Read swap status
* Refresh swap status from the swap provider

The swap flow is exposed through the NWC session, so the browser app keeps using one client for wallet actions and supported swaps.

---

## Architecture

NwcKit is the browser SDK used by your app. The connected wallet service remains responsible for wallet operations and, when supported, server-side coordination with services such as OnchainBridge and Boltz.

Typical flow:

```text
User wallet
   ^
   | encrypted NWC requests over Nostr
   v
Web app -> NwcKit -> Nostr relay -> wallet service
                                  -> optional swap backend -> Boltz
```

This keeps the app non-custodial while still giving it a compact API for Lightning and supported swap operations.

---

## Features

* Nostr Wallet Connect URI parsing
* Relay connection handling
* Encrypted request/response flow
* Browser-first TypeScript API
* Standard NWC Lightning methods
* Custom NWC swap methods
* Sats-based public amounts with msat normalization internally
* Built-in timeout and typed error handling
* Debug logging option

---

## Status

**Alpha: functional and evolving.**

Implemented:

* `get_info`
* `get_balance`
* `make_invoice`
* `pay_invoice`
* `lookup_invoice`
* `list_transactions`
* `create_onchain_to_lightning_swap`
* `create_lightning_to_onchain_swap`
* `get_swap_status`
* `refresh_swap_status`

Notes:

* API surface may change before v1
* Swap methods require a compatible wallet service
* Cross-wallet compatibility is still being expanded
* NIP-04 compatible encryption is currently used

---

## Installation

```bash
npm install nwckit
```

---

## NWC URI format

```text
nostr+walletconnect://<wallet_pubkey>?relay=<relay_url>&secret=<secret>
```

Example:

```text
nostr+walletconnect://abcdef123456...?relay=wss%3A%2F%2Frelay.example.com&secret=0123456789abcdef...
```

---

## Quick start

```ts
import { NwcKit, parseNwcUri } from "nwckit";

const connection = parseNwcUri(
  "nostr+walletconnect://abcdef1234...?relay=wss%3A%2F%2Frelay.example.com&secret=012345..."
);

const client = new NwcKit({
  connection,
  timeoutMs: 15000,
  debug: false,
});

await client.connect();

const info = await client.getInfo();
const balance = await client.getBalance();

const invoice = await client.makeInvoice({
  amount: 21000,
  description: "Test payment",
});

await client.payInvoice({
  invoice: invoice.invoice,
});

await client.lookupInvoice({
  payment_hash: invoice.payment_hash,
});

await client.listTransactions({ limit: 10 });

await client.disconnect();
```

---

## API overview

### `parseNwcUri(uri: string): NwcConnection`

```ts
{
  walletPubkey: string;
  relayUrl: string;
  secret: string;
  lud16?: string;
}
```

### `new NwcKit(options)`

```ts
{
  connection: NwcConnection;
  timeoutMs?: number;
  debug?: boolean;
}
```

### Connection lifecycle

```ts
await client.connect();
await client.disconnect();
client.destroy();
```

### Wallet methods

```ts
await client.getInfo();
await client.getBalance();

await client.makeInvoice({
  amount: 2100,
  description: "Premium access",
});

await client.payInvoice("lnbc...");

await client.lookupInvoice({
  payment_hash: "...",
});

await client.listTransactions({
  limit: 10,
  type: "incoming",
});
```

### Swap methods

Swap methods are custom NWC extensions. They work only when the connected wallet service supports and advertises them in `get_info`.

```ts
const onchainToLightning = await client.createOnchainToLightningSwap({
  amountSats: 50000,
  invoice: "lnbc...",
});

const lightningToOnchain = await client.createLightningToOnchainSwap({
  amountSats: 50000,
  destinationAddress: "bc1q...",
});

const status = await client.getSwapStatus({
  swapId: lightningToOnchain.swapId,
});

const refreshed = await client.refreshSwapStatus({
  swapId: lightningToOnchain.swapId,
});
```

Underlying NWC method names:

```text
create_onchain_to_lightning_swap
create_lightning_to_onchain_swap
get_swap_status
refresh_swap_status
```

---

## Amount units

NwcKit exposes public amounts in sats where possible:

* `makeInvoice({ amount })` accepts sats and sends msats over NWC
* `getBalance()` returns sats
* invoice and transaction amounts are normalized to sats
* swap methods use explicit `amountSats`

This keeps app code ergonomic while matching NWC wallet expectations internally.

---

## Security model

* Users never expose wallet private keys to the app
* Apps operate through NWC permissions
* Requests and responses are encrypted over Nostr
* NwcKit does not custody funds
* Swap execution depends on the connected wallet service and its backend policy

---

## Roadmap

* Improve cross-wallet compatibility
* Add NIP-44 encryption support
* Add multi-relay support and fallback
* Harden swap-status recovery flows
* Add optional UI helpers for common wallet flows
* Stabilize v1 API

---

## Vision

NwcKit aims to become a compact browser SDK for Bitcoin apps that need more than a checkout button:

* Lightning-native web payments
* Nostr Wallet Connect app authorization
* Wallet-powered billing and paywalls
* Lightning/on-chain bridge flows via supported wallet services
* Plug-and-play Bitcoin money movement for web products

---

## Development

```bash
git clone https://github.com/nmassari/NwcKit.git
cd NwcKit/NwcKit
npm install
npm run build
```

---

## License

MIT

---

## Author

Nicola Massari - easycryptosend.it
