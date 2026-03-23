# NwcKit

⚡ Lightning payments in the browser via Nostr Wallet Connect (NIP-47)

NwcKit is a browser-first TypeScript toolkit that enables web applications to interact with Lightning wallets using Nostr — completely non-custodial.

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

NwcKit acts as a bridge between your frontend and a user's Lightning wallet, using Nostr relays as the communication layer (NIP-47).

* The user keeps full control of their funds
* The app gets permission to request payments
* All communication is encrypted and relay-based

---

## ✨ Features

⚡ Lightning payments via Nostr Wallet Connect (NIP-47)
🔐 Encrypted request/response flow (NIP-04 compatible)
🌐 Browser-first architecture (no Node-only dependencies)
🧠 Fully typed TypeScript API
🔌 Simple connection model (URI-based)
⏱ Built-in timeout and error handling
🧱 Modular foundation for future extensions

---

## 🚧 Status

**Alpha (functional, evolving)**

### ✅ Currently implemented

* NWC URI parsing
* Relay connection handling
* Encrypted request/response flow

Full NIP-47 method support:

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

// 3. Connect to relay
await client.connect();

// 4. Get wallet info
const info = await client.getInfo();
console.log("Wallet info:", info);

// 5. Get balance
const balance = await client.getBalance();
console.log("Balance:", balance.balance);

// 6. Create invoice
const invoice = await client.makeInvoice({
  amount: 21000,
  description: "Test payment",
});

// 7. Pay invoice
const payment = await client.payInvoice({
  invoice: invoice.invoice,
});

// 8. Lookup invoice
const lookup = await client.lookupInvoice({
  payment_hash: invoice.payment_hash,
});

// 9. List transactions
const txs = await client.listTransactions({
  limit: 10,
});

// 10. Disconnect
await client.disconnect();
```

---

## 🧠 API Overview

### `parseNwcUri(uri: string): NwcConnection`

Parses a Nostr Wallet Connect URI:

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

* Users never expose their private keys
* Apps operate via scoped permissions (NWC)
* All communication is encrypted over Nostr relays
* No custody, no fund transfers to third parties

---

## 🛣️ Roadmap

* Improve cross-wallet compatibility
* Add NIP-44 encryption support
* Add signer abstraction (browser / extension / ephemeral)
* Improve relay management (multi-relay, fallback)
* Create browser demo app
* Publish stable v1

---

## 🧩 Vision

NwcKit aims to become the **standard browser SDK for Lightning over Nostr**.

Planned future modules:

* Identity resolution layer (Nostr + Lightning)
* Browser UI components
* Lightning UX abstractions
* React integration

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
