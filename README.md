# NwcKit

[![npm](https://img.shields.io/npm/v/nwckit)](https://www.npmjs.com/package/nwckit)
[![license](https://img.shields.io/npm/l/nwckit)](https://github.com/nmassari/nwckit/blob/main/LICENSE)

Browser-first TypeScript toolkit for Nostr Wallet Connect, Lightning payments and NWC-based Bitcoin swap flows.

**NwcKit** lets web apps connect to a user's NWC wallet, inspect wallet state, create invoices, pay invoices and call supported Lightning/on-chain swap methods over the same encrypted Nostr session.

No custody. No wallet switching. No node management in your frontend.

> Think: a Nostr-native wallet action layer for Bitcoin apps.

**Try the live wallet demo:** [EasyCryptoSend](https://easycryptosend.it)

---

## 30-second example

```ts
import {
  BTC_MAINNET_LIGHTNING,
  BTC_MAINNET_ONCHAIN,
  NwcKit,
  parseNwcUri,
} from "nwckit";

const connection = parseNwcUri("nostr+walletconnect://...");

const client = new NwcKit({ connection });

await client.connect();

await client.payInvoice("lnbc...");

const invoice = await client.makeInvoice({
  amount: 2100,
  description: "Premium access",
});

if (await client.supportsSwaps()) {
  const swap = await client.createSwap({
    direction: "lightning_to_onchain",
    sendAsset: BTC_MAINNET_LIGHTNING,
    receiveAsset: BTC_MAINNET_ONCHAIN,
    amount: { value: "2100", unit: "sat" },
    receiveAddress: "bc1q...",
  });
}

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

It also supports experimental NWC swap extensions, when the connected wallet service advertises them:

* Create on-chain to Lightning swaps
* Create Lightning to on-chain swaps
* Read swap status
* Refresh swap status from the swap provider

The swap flow is exposed through the NWC session, so the browser app keeps using one client for wallet actions and supported swaps.

NwcKit also includes an experimental encrypted Nostr app-message layer for EasyCryptoSend-style payment notifications and subscription scheduling. This layer is separate from NWC wallet commands and is designed for wallet-to-wallet business messages such as subscription offers, invoice requests and invoice responses.

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
* NWC URI validation helper
* Relay connection handling
* Encrypted request/response flow
* Browser-first TypeScript API
* Standard NWC Lightning methods
* Experimental NWC swap methods with explicit asset metadata
* Wallet capability detection
* BTC mainnet asset presets for swap requests
* Sats-based public amounts with msat normalization internally
* Built-in timeout and typed error handling
* Debug logging option
* Experimental encrypted Nostr app messages for subscription scheduling
* Pull-invoice validation helpers using one-time request codes

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
* `create_swap`
* `get_swap`
* `refresh_swap`
* `NostrPaymentMessages`
* subscription app-message types and invoice-response validation helpers

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

## Experimental subscription messages

The app-message layer uses encrypted Nostr events with:

```text
kind: 31947
protocol: ecs-subscriptions
version: 0.1
```

It is intended for flows where two wallets coordinate a recurring payment without giving a server custody of customer payment authority.

MVP message types:

* `subscription.offer`
* `subscription.accepted`
* `subscription.invoice_request`
* `subscription.invoice_response`
* `subscription.payment_sent`
* `subscription.payment_failed`
* `subscription.cancel`

The key safety rule is:

```text
Autopay only pays an invoice_response that answers a local, fresh, unconsumed invoice_request.
```

Example:

```ts
import {
  NostrPaymentMessages,
  generateInvoiceRequestCode,
  validateSubscriptionInvoiceResponse,
} from "nwckit";

const messages = new NostrPaymentMessages({
  privateKey: "customer_private_key_hex",
  relays: ["wss://relay.easycryptosend.it/api/relay"],
});

messages.subscribe();

const requestCode = generateInvoiceRequestCode();

await messages.send({
  recipientPubkey: merchantPubkey,
  type: "subscription.invoice_request",
  payload: {
    subscriptionId: "sub_123",
    merchantPubkey,
    customerPubkey: messages.pubkey,
    billingPeriod: "2026-07",
    requestCode,
    amountSatsExpected: 10000,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  },
});
```

When an invoice response arrives, validate it before paying:

```ts
const validation = validateSubscriptionInvoiceResponse({
  response: invoiceResponsePayload,
  pendingRequest,
});

if (validation.ok) {
  await nwc.payInvoice(invoiceResponsePayload.invoice);
}
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

### `isNwcUri(value: string): boolean`

```ts
import { isNwcUri } from "nwckit";

if (!isNwcUri(input)) {
  throw new Error("Paste a valid NWC string");
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

### Capability helpers

Use wallet-advertised methods from `get_info` before enabling optional UI actions.

```ts
const info = await client.getInfo();

await client.supports("pay_invoice", info);
await client.supports("create_swap", info);
await client.supportsSwaps(info);

const capabilities = await client.getCapabilities(info);

if (capabilities.canSwap) {
  // Show swap UI
}
```

### Swap methods

Swap methods are experimental NWC extensions intended to be NIP-ready. They work only when the connected wallet service supports and advertises them in `get_info`.

```ts
import {
  BTC_MAINNET_LIGHTNING,
  BTC_MAINNET_ONCHAIN,
} from "nwckit";

const onchainToLightning = await client.createSwap({
  direction: "onchain_to_lightning",
  sendAsset: BTC_MAINNET_ONCHAIN,
  receiveAsset: BTC_MAINNET_LIGHTNING,
  amount: { value: "50000", unit: "sat" },
  receiveInvoice: "lnbc...",
});

const lightningToOnchain = await client.createSwap({
  direction: "lightning_to_onchain",
  sendAsset: BTC_MAINNET_LIGHTNING,
  receiveAsset: BTC_MAINNET_ONCHAIN,
  amount: { value: "50000", unit: "sat" },
  receiveAddress: "bc1q...",
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
create_swap
get_swap
refresh_swap
```

---

## Amount units

NwcKit exposes public amounts in sats where possible:

* `makeInvoice({ amount })` accepts sats and sends msats over NWC
* `getBalance()` returns sats
* invoice and transaction amounts are normalized to sats
* swap methods use explicit `{ value, unit }` amounts

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
