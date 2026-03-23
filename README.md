# NwcKit

**NwcKit** is a browser-first TypeScript toolkit for Lightning payments via  
**Nostr Wallet Connect (NIP-47)**.

It provides a clean and strongly-typed API to interact with Lightning wallets over Nostr, designed for modern web applications.

---

## ✨ Features

- ⚡ Lightning payments via Nostr Wallet Connect (NIP-47)
- 🔐 Encrypted request/response flow (NIP-04 compatible)
- 🌐 Browser-first architecture (no Node-only dependencies)
- 🧠 Fully typed TypeScript API
- 🔌 Simple connection model (URI-based)
- ⏱ Built-in timeout and error handling
- 🧱 Modular foundation for future extensions

---

## 🚧 Status

**Alpha (functional, evolving)**

Currently implemented:

- ✅ NWC URI parsing
- ✅ Relay connection handling
- ✅ Encrypted request/response flow
- ✅ Full NIP-47 method support:
  - `get_info`
  - `get_balance`
  - `make_invoice`
  - `pay_invoice`
  - `lookup_invoice`
  - `list_transactions`

⚠️ Still in active development:
- API surface may change
- Not yet production hardened
- Limited cross-wallet testing

---

## 📦 Installation

```bash
npm install nwckit

🔗 NWC URI format

nostr+walletconnect://<wallet_pubkey>?relay=<relay_url>&secret=<secret>

Example:

nostr+walletconnect://abcdef1234567890abcdef...?relay=wss%3A%2F%2Frelay.example.com&secret=0123456789abcdef...

🚀 Quick Start (Complete Example)

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

🧠 API Overview

parseNwcUri(uri: string): NwcConnection

Parses a Nostr Wallet Connect URI:

{
  walletPubkey: string;
  relayUrl: string;
  secret: string;
  lud16?: string;
}
new NwcKit(options)
{
  connection: NwcConnection;
  timeoutMs?: number;
}

🔧 Client Methods

connect(): Promise<void>
disconnect(): Promise<void>

getInfo(): Promise<NwcWalletInfo>
getBalance(): Promise<NwcBalanceResponse>

makeInvoice(params): Promise<MakeInvoiceResponse>
payInvoice(params): Promise<PayInvoiceResponse>

lookupInvoice(params): Promise<InvoiceLookupResponse>
listTransactions(params?): Promise<ListTransactionsResponse>

⚠️ Important Notes

This library is alpha software
Requires a real NWC-compatible wallet
Wallet compatibility may vary depending on implementation
Not recommended for production use yet

🛣️ Roadmap

Improve cross-wallet compatibility
Add NIP-44 encryption support
Add signer abstraction (browser / extension / ephemeral)
Improve relay management (multi-relay, fallback)
Create browser demo app
Publish stable v1

🧩 Future Vision

NwcKit is designed as a modular ecosystem for Lightning + Nostr apps.

Planned future modules:

identity resolution layer (Nostr + Lightning)
browser UI components
Lightning UX abstractions
React integration

🛠️ Development

git clone https://github.com/nmassari/NwcKit.git
cd NwcKit
npm install
npm run build

📄 License

MIT
