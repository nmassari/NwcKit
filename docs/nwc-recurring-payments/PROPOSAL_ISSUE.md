### Summary

I would like to propose an optional Nostr Wallet Connect extension for
merchant-bound recurring Lightning payments.

The extension adds a `pay_subscription_invoice` method for unattended payment
schedulers. A wallet service executes the payment only when a signed merchant
proof binds the exact BOLT11 invoice and amount to a subscription, billing
period and fresh request identifier.

The intent is not to move subscription scheduling or commercial terms into
NWC. The wallet service remains the trusted enforcement boundary for the
connection grant, spending budget, merchant identity, replay protection,
revocation and payment reconciliation.

### Problem

NWC core `pay_invoice` allows an authorized connection to pay an invoice.
NWC-08 can additionally restrict a dedicated connection by method, expiry and
a renewable cumulative spending budget.

Those controls answer **how much the connection may spend**, but they do not
prove **which merchant obligation it may pay**. A compromised unattended
scheduler could still replace an expected invoice with another invoice that
fits within the same budget.

There is also no common recurring-payment rule for:

- binding a connection to one merchant and subscription;
- proving that the merchant authorized the exact invoice and amount;
- preventing two payments for the same billing period;
- reconciling an uncertain Lightning result before retrying.

### Proposed behavior

Each subscription uses a dedicated NWC connection. NWC-08 is the recommended
connection-creation flow and continues to define method authorization, expiry,
`max_amount` and `renewal_period`.

The wallet service additionally binds the connection to:

- a merchant Nostr public key;
- an opaque subscription id.

The scheduler submits a `pay_subscription_invoice` request containing an
unpublished, signed merchant-proof event. Its signed content includes:

```json
{
  "subscription_id": "sub_123",
  "billing_period": "2026-11",
  "request_id": "<at least 128 bits of entropy>",
  "invoice": "lnbc...",
  "amount_msat": 25000000,
  "expires_at": 1793491200
}
```

Before paying, the wallet service verifies atomically that:

1. the dedicated connection is enabled, unexpired and authorized for the
   method;
2. the proof event id and Schnorr signature are valid;
3. the proof author and subscription match the server-side connection grant;
4. the proof and invoice are unexpired;
5. `amount_msat` matches the BOLT11 amount;
6. the NWC-08 budget and wallet-local policy allow the payment;
7. the request id, proof, payment hash and billing period have not already been
   consumed.

The replay keys and applicable budget are reserved before initiating payment.
An identical request received after settlement returns the original successful
result without paying again. An ambiguous Lightning result remains reserved
and must be reconciled by payment hash before any retry.

### Discovery and transport

The extension uses the existing NIP-47 request and response event kinds
`23194` and `23195` and the negotiated encryption mode. NIP-44 v2 is preferred;
NIP-04 remains a compatibility fallback under NWC core rules.

A supporting wallet service advertises:

- `pay_subscription_invoice` as a method;
- the assigned extension identifier in its `extensions` tag and
  `get_info.extensions`.

Permission for ordinary `pay_invoice` does not imply permission for
`pay_subscription_invoice`, and clients must not fall back to unrestricted
`pay_invoice` when the recurring-payment method is unavailable.

NWC-13 `get_budget` is complementary and can expose the dedicated connection's
remaining allowance without revealing the wallet balance. It does not replace
the merchant proof.

### Revocation

The authoritative revocation mechanism in the first version is disabling or
deleting the dedicated NWC connection at the wallet service. This remains
effective even when the scheduler or merchant is offline.

The first draft deliberately does not standardize a scheduler-initiated
`revoke_subscription` method.

### Why a separate optional specification

- The behavior is only needed by wallets supporting unattended recurring
  payments.
- It builds on NWC core, NWC-08 and optionally NWC-13 without changing their
  existing semantics.
- It introduces merchant/subscription binding and replay rules that do not
  belong in the simplified NWC core method set.
- Existing NWC clients and wallet services can ignore the extension.

### Out of scope

The initial proposal intentionally excludes:

- subscription offers and invoice-delivery messages;
- calendar scheduling and commercial billing models;
- refunds and disputes;
- NIP-59 transport for merchant application messages;
- on-chain settlement, swaps and non-Bitcoin assets.

### Implementation status

A working implementation of the security model exists, although its current
experimental payload is not claimed to be conformant with the final proposal:

- [NwcKit pre-proposal and compatibility review](https://github.com/nmassari/NwcKit/tree/main/docs/nwc-recurring-payments)
- [NwcProvider NIP-44 v2 and NWC-13 implementation](https://github.com/nmassari/NwcProvider.LNbits/commit/71fb5ff)

The provider validates signed merchant commitments, persists replay state,
blocks duplicate billing periods, reconciles uncertain payment outcomes and
supports NIP-44 v2 with NIP-04 fallback. The proposal draft narrows and
generalizes that implementation for interoperability.

### Open questions

1. Should the merchant proof use a dedicated Nostr event kind, or is there an
   existing generic signed-authorization mechanism that is preferred?
2. Is NWC-08 `metadata` the appropriate place to request merchant and
   subscription binding, or should extension-specific authorization parameters
   be namespaced elsewhere?
3. Should uncertain results use the existing `INTERNAL` error with an
   explanatory message, or should NWC define a shared
   `PAYMENT_PENDING`/`PAYMENT_UNKNOWN` error?
4. Should an idempotent self-revocation method be considered in a later
   revision, or remain entirely a wallet-service UI/API concern?
5. Should a duplicate request for an already settled billing period return the
   original successful response, or a dedicated already-paid result?

Feedback from wallet-service and NWC client implementers would be especially
helpful before turning this into a numbered specification pull request.
