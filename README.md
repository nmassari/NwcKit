# NwcKit

[![npm](https://img.shields.io/npm/v/nwckit)](https://www.npmjs.com/package/nwckit)
[![license](https://img.shields.io/npm/l/nwckit)](https://github.com/nmassari/nwckit/blob/main/LICENSE)

⚡ Lightning payments in the browser via Nostr Wallet Connect (NIP-47)

**NwcKit** is a browser-first TypeScript toolkit that enables web applications to interact with Lightning wallets using Nostr — completely non-custodial.

No QR codes. No wallet switching. No backend required.

> Think: **Stripe for Lightning — but non-custodial and Nostr-native**

---

## ⚡ 30-second example

```ts
import { NwcKit, parseNwcUri } from "nwckit";

const connection = parseNwcUri("nostr+walletconnect://...");

const client = new NwcKit({ connection });

await client.connect();

await client.payInvoice({
  invoice: "lnbc..."
});
```

That's it.

---

## 🧠 What it does

NwcKit acts as a bridge between your frontend and a user's Lightning wallet using **Nostr relays** as the communication layer (NIP-47).

* The user keeps full control of their funds
* The app gets permission to request payments
* All communication is encrypted and relay-based

---

## 🧩 Architecture

NwcKit is designed to be part of a modular Lightning stack:

* **NwcKit** → Lightning payments (this library)
* **OcbKit** → on-chain ↔ Lightning swaps
* **OnchainBridge** → backend swap service

Typical flow:

```text
User → NwcKit (wallet connection)
     → Lightning payment
     → (optional) OcbKit → on-chain swap
```

---

## ✨ Features

* ⚡ Lightning payments via Nostr Wallet Connect (NIP-47)
* 🔐 Encrypted request/response flow (NIP-04 compatible)
* 🌐 Browser-first (no Node-only dependencies)
* 🧠 Fully typed TypeScript API
* 🔌 Simple connection model (URI-based)
* ⏱ Built-in timeout & error handling
* 🧱 Modular & extensible

---

## 🚧 Status

**Alpha (functional, evolving)**

### ✅ Implemented

* NWC URI parsing
* Relay connection handling
* Encrypted request/response flow

Supported methods:

* `get_info`
* `get_balance`
* `make_invoice`
* `pay_invoice`
* `lookup_invoice`
* `list_transactions`

### ⚠️ Work in progress

* API surface may change
* Not yet production hardened
* Limited cross-wallet testing

---

## 📦 Installation

```bash
npm install nwckit
```

---

## 🔗 NWC URI format

```
nostr+walletconnect://<wallet_pubkey>?relay=<relay_url>&secret=<secret>
```

Example:

```
nostr+walletconnect://abcdef123456...?relay=wss%3A%2F%2Frelay.example.com&secret=0123456789abcdef...
```

---

## 🚀 Quick Start (Complete Example)

```ts
import { NwcKit, parseNwcUri } from "nwckit";

// 1. Parse connection URI
const connection = parseNwcUri(
  "nostr+walletconnect://abcdef1234...?relay=wss%3A%2F%2Frelay.example.com&secret=012345..."
);

// 2. Create client
const client = new NwcKit({
  connection,
  timeoutMs: 15000,
});

// 3. Connect
await client.connect();

// 4. Wallet info
const info = await client.getInfo();

// 5. Balance
const balance = await client.getBalance();

// 6. Create invoice
const invoice = await client.makeInvoice({
  amount: 21000,
  description: "Test payment",
});

// 7. Pay invoice
await client.payInvoice({
  invoice: invoice.invoice,
});

// 8. Lookup
await client.lookupInvoice({
  payment_hash: invoice.payment_hash,
});

// 9. Transactions
await client.listTransactions({ limit: 10 });

// 10. Disconnect
await client.disconnect();
```

---

## 🧠 API Overview

### `parseNwcUri(uri: string): NwcConnection`

```ts
{
  walletPubkey: string;
  relayUrl: string;
  secret: string;
  lud16?: string;
}
```

---

### `new NwcKit(options)`

```ts
{
  connection: NwcConnection;
  timeoutMs?: number;
}
```

---

## 🔧 Client Methods

```ts
connect(): Promise<void>
disconnect(): Promise<void>

getInfo(): Promise<NwcWalletInfo>
getBalance(): Promise<NwcBalanceResponse>

makeInvoice(params): Promise<MakeInvoiceResponse>
payInvoice(params): Promise<PayInvoiceResponse>

lookupInvoice(params): Promise<InvoiceLookupResponse>
listTransactions(params?): Promise<ListTransactionsResponse>
```

---

## ⚠️ Security Model

* Users never expose private keys
* Apps operate via scoped permissions (NWC)
* All communication is encrypted via Nostr
* No custody, no third-party fund control

---

## 🛣️ Roadmap

* Improve cross-wallet compatibility
* Add NIP-44 encryption
* Signer abstraction (browser / extension / ephemeral)
* Multi-relay support & fallback
* UI components (React / Web)
* Stable v1 release

---

## 🧩 Vision

NwcKit aims to become the **standard browser SDK for Lightning over Nostr**.

Future direction:

* Lightning-native web payments
* Identity layer (Nostr + Lightning)
* Plug-and-play checkout experiences
* Seamless wallet connectivity for any web app

---

## 🛠️ Development

```bash
git clone https://github.com/nmassari/NwcKit.git
cd NwcKit
npm install
npm run build
```

---

## 📄 License

MIT

---

## 👨‍💻 Author

Nicola Massari
