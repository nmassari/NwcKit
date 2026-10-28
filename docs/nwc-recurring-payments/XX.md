NWC-XX
======

Merchant-Bound Recurring Payments
---------------------------------

`draft` `optional`

> Pre-proposal draft. `XX` and the merchant-proof event kind are placeholders
> to be assigned or agreed during review in the Nostr Wallet Connect
> specifications repository.

## Summary

This specification defines `pay_subscription_invoice`, an optional Nostr
Wallet Connect method for paying a Lightning invoice only when it is bound by
a merchant signature to an authorized subscription and billing period.

The method is intended for a dedicated, narrowly authorized NWC connection
used by an unattended recurring-payment scheduler. The wallet service remains
the enforcement point for merchant identity, subscription identity, expiry,
spending limits, revocation, replay protection and payment reconciliation.

This specification does not define subscription discovery, commercial terms,
invoice delivery, on-chain payments, swaps or non-Bitcoin assets.

## Motivation

NWC core `pay_invoice` authorizes a connection to pay a Lightning invoice.
[NWC-08](https://github.com/nostr-wallet-connect/nwc/blob/main/08.md) can
restrict that connection by methods, expiry and a renewable spending budget.
Those controls do not by themselves prove that a particular invoice was
issued by an authorized merchant for a particular subscription and billing
period, nor do they define a common rule that prevents the same billing period
from being charged twice.

Recurring payments need all of the following properties:

- the user explicitly authorizes a dedicated connection;
- the wallet service binds the connection to one merchant and subscription;
- the merchant signs every invoice authorization;
- the signature covers the invoice, amount, subscription, billing period and
  one-time request identifier;
- the wallet service atomically rejects replays and budget overruns;
- an uncertain payment outcome is reconciled before any retry;
- disabling the dedicated connection immediately stops future payments.

## Terms

- **customer**: the user whose wallet pays the recurring invoices;
- **merchant**: the party issuing a signed invoice authorization;
- **scheduler**: the NWC client that requests invoices and submits payment
  requests at the authorized time;
- **wallet service**: the NIP-47 service that validates policy and executes the
  Lightning payment;
- **subscription id**: an opaque identifier agreed by the customer and
  merchant;
- **billing period**: an opaque identifier for one independently chargeable
  period or installment;
- **request id**: a fresh, unpredictable identifier correlating one invoice
  request with one merchant authorization.

## Relationship to NWC core

This specification uses the NIP-47 request and response event kinds `23194`
and `23195`. Payloads MUST use the encryption mode negotiated by NWC core and
MUST prefer NIP-44 v2.

A wallet service supporting this specification:

- MUST advertise `pay_subscription_invoice` in its NWC info event;
- MUST include `pay_subscription_invoice` in `get_info.methods` only for a
  connection authorized to call it;
- SHOULD include `XX` in the info event `extensions` tag and in
  `get_info.extensions`;
- MUST NOT infer permission to call this method from permission to call
  `pay_invoice`;
- MUST enforce all policy server-side. Request fields never extend the grant.

## Authorization profile

Each subscription SHOULD use a dedicated NWC connection. Implementations
SHOULD use NWC-08 for client-initiated connection creation and SHOULD request:

- `pay_subscription_invoice` and `get_info` in `request_methods`;
- `get_budget` in `optional_request_methods` when NWC-13 is supported;
- an `expires_at` value;
- `max_amount` and `renewal_period` appropriate to the user-approved spending
  policy.

The NWC-08 `metadata` JSON MAY include the following extension request:

```json
{
  "nwc_extension": "XX",
  "subscription": {
    "id": "sub_123",
    "merchant_pubkey": "<32-byte lowercase hex Nostr public key>",
    "merchant_name": "Example merchant"
  }
}
```

When a wallet service accepts a connection containing this metadata and grants
`pay_subscription_invoice`, it MUST:

1. display the merchant identity, subscription id, expiry and spending policy
   to the user before approval;
2. bind the granted connection to exactly that `subscription.id` and
   `merchant_pubkey`;
3. reject a malformed merchant public key or empty subscription id;
4. never treat `merchant_name` as a verified identity.

Wallet services that provision connections by another user-approved flow MUST
enforce an equivalent merchant and subscription binding.

`max_amount` and `renewal_period` retain exactly their NWC-08 meaning. This
specification does not redefine their accounting or concurrency requirements.

## Merchant invoice authorization

Before calling `pay_subscription_invoice`, the scheduler obtains a signed
merchant proof. The proof is a complete, valid Nostr event that is transported
inside the encrypted NWC request and does not need to be published to a relay.

The event has a kind allocated for this specification (`TBD` in this draft).
Its `content` is a compact JSON object:

```json
{
  "subscription_id": "sub_123",
  "billing_period": "2026-11",
  "request_id": "f4c4...at least 128 bits of entropy...",
  "invoice": "lnbc...",
  "amount_msat": 25000000,
  "expires_at": 1793491200
}
```

Fields:

- `subscription_id`: REQUIRED non-empty string, maximum 128 UTF-8 bytes;
- `billing_period`: REQUIRED non-empty opaque string, maximum 128 UTF-8 bytes;
- `request_id`: REQUIRED lowercase hex string containing at least 128 bits of
  cryptographically secure randomness;
- `invoice`: REQUIRED BOLT11 invoice;
- `amount_msat`: REQUIRED positive integer matching the amount encoded in the
  invoice;
- `expires_at`: REQUIRED Unix timestamp in seconds, no later than the invoice
  expiry.

The merchant proof MUST be signed by the merchant public key bound to the NWC
connection. Its event `created_at` MUST NOT be in the future beyond the wallet
service's documented clock-skew tolerance and the proof MUST be rejected after
`expires_at`.

Because the Nostr event signature commits to its exact content, no additional
application-specific hash tag is required. Implementations MUST verify both the
event id and Schnorr signature before parsing the proof as authorized.

## Method: `pay_subscription_invoice`

The request contains the merchant proof:

```json
{
  "method": "pay_subscription_invoice",
  "params": {
    "merchant_proof": {
      "id": "<event id>",
      "pubkey": "<merchant pubkey>",
      "created_at": 1793487000,
      "kind": 0,
      "tags": [],
      "content": "{\"subscription_id\":\"sub_123\",\"billing_period\":\"2026-11\",\"request_id\":\"f4c4...\",\"invoice\":\"lnbc...\",\"amount_msat\":25000000,\"expires_at\":1793491200}",
      "sig": "<merchant signature>"
    }
  }
}
```

The `kind` value above is illustrative and MUST be replaced by the event kind
allocated to this specification.

Before paying, the wallet service MUST atomically verify that:

1. this connection is enabled, unexpired and authorized for the method;
2. the proof event id and signature are valid;
3. the proof author equals the merchant public key bound to the connection;
4. `subscription_id` equals the subscription bound to the connection;
5. the proof and BOLT11 invoice are unexpired;
6. `amount_msat` is positive and equals the BOLT11 amount;
7. the NWC-08 budget and all wallet-local limits allow the payment;
8. neither `request_id`, proof event id nor invoice payment hash has been
   consumed by another payment;
9. the tuple `(connection, subscription_id, billing_period)` has not already
   completed a payment.

The wallet service MUST reserve the replay keys and applicable budget before
initiating payment. Concurrent requests MUST NOT collectively bypass either
the replay rules or the spending budget.

## Response

A successful response is:

```json
{
  "result_type": "pay_subscription_invoice",
  "error": null,
  "result": {
    "subscription_id": "sub_123",
    "billing_period": "2026-11",
    "request_id": "f4c4...",
    "payment_hash": "<32-byte hex payment hash>",
    "preimage": "<32-byte hex preimage>",
    "fees_paid": 1200,
    "settled_at": 1793487060
  }
}
```

`fees_paid` is expressed in millisatoshis, consistently with NWC core.

If an identical request is received after the payment settled, the wallet
service SHOULD return the original successful result. It MUST NOT initiate a
second payment.

## Payment reconciliation

If the Lightning backend times out or returns an ambiguous result after a
payment attempt, the wallet service MUST mark the reservation as uncertain and
MUST reconcile it using the invoice payment hash before retrying.

While the result remains uncertain, subsequent requests for the same billing
period, request id, proof or payment hash MUST NOT trigger another payment.
The wallet service SHOULD return `INTERNAL` with a message indicating that the
outcome is being reconciled. A future revision may define a dedicated error if
interoperability experience demonstrates the need.

## Errors

Implementations MUST use applicable NWC core error codes:

- `RESTRICTED`: the connection is not authorized for the method, merchant or
  subscription;
- `UNAUTHORIZED`: the connection is unknown, disabled or revoked;
- `QUOTA_EXCEEDED`: the approved spending budget would be exceeded;
- `INSUFFICIENT_BALANCE`: the wallet cannot fund the payment;
- `RATE_LIMITED`: the caller is sending requests too quickly;
- `NOT_IMPLEMENTED`: the method is unsupported;
- `INTERNAL`: execution or reconciliation failed;
- `OTHER`: malformed, expired, invalidly signed or replayed requests when no
  more specific core code applies.

Error messages SHOULD explain the failure without disclosing wallet balance,
other subscriptions or unrelated payment activity.

## Revocation

The authoritative revocation mechanism is disabling or deleting the dedicated
NWC connection at the wallet service. Revocation MUST be enforced by the wallet
service even when the scheduler and merchant are offline.

This version deliberately does not define a `revoke_subscription` NWC method.
Self-revocation by the scheduler can be offered as an implementation-specific
convenience, but it is not a substitute for user-controlled wallet-side
revocation.

## Relationship to NWC-08

NWC-08 provides connection creation, method negotiation, expiry and renewable
spending limits. This specification adds merchant/subscription binding and
per-billing-period replay semantics. It neither replaces nor weakens NWC-08.

An implementation MUST NOT silently create an unrestricted `pay_invoice`
connection when the requested `pay_subscription_invoice` method or requested
NWC-08 spending limit cannot be enforced.

## Relationship to NWC-13

NWC-13 `get_budget` is complementary. A scheduler MAY use it to display the
remaining connection allowance, but an available budget does not authorize a
merchant, subscription, billing period or invoice. This method remains subject
to the separate `get_budget` permission.

## Privacy considerations

The merchant proof is carried inside the NIP-47 encrypted request and SHOULD
NOT be published. Relays can still observe event kinds, timestamps, authors and
recipient tags as described by NWC core.

Wallet services SHOULD use a unique wallet-service key per connection where
possible. Schedulers MUST NOT reuse request ids across subscriptions.

## Security considerations

- A compromised scheduler cannot alter a merchant-signed invoice or amount,
  but it can submit any still-valid proof it possesses. Short proof expiry and
  server-side replay protection are therefore mandatory.
- NWC-08 budgets are security boundaries only when enforced atomically by the
  wallet service.
- `merchant_name` is presentation metadata; the Nostr public key is the
  cryptographic merchant identity.
- A billing-period string is opaque. Wallet services compare it byte-for-byte
  and MUST NOT derive authorization from its human-readable appearance.
- Revocation checks and replay reservations MUST happen in the same trusted
  wallet-service boundary as payment execution.
- Implementations SHOULD retain sufficient durable state to preserve replay
  protection across restarts and restore operations.

## Backward compatibility

This is an optional method. Existing NWC clients and wallet services remain
compatible and can ignore the extension. Clients MUST discover support through
the NWC info event and `get_info`; they MUST NOT fall back to unrestricted
`pay_invoice` when recurring-payment authorization is unavailable.

## Out of scope

- how merchants publish subscription offers;
- invoice-request and invoice-response application messages;
- scheduling frequency and calendar interpretation;
- refunds, disputes and chargebacks;
- fiat-denominated or asset-denominated accounting;
- Taproot Assets, swaps and on-chain settlement;
- NIP-59 transport for merchant application messages.

These concerns may be specified independently without changing the wallet
authorization method defined here.
