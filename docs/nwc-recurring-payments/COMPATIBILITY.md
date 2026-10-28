# Compatibility review: NWC-XX vs NWC-08 and NWC-13

This review accompanies the pre-proposal in [`XX.md`](XX.md). It separates
features already standardized by NWC from the minimum new behavior needed for
merchant-bound recurring payments.

## Executive result

The proposed extension should **not** define another connection string,
permission store, generic recurring budget or balance endpoint.

- NWC-08 already standardizes client-generated connection keys, requested
  methods, expiry and renewable cumulative spending limits.
- NWC-13 already standardizes querying the current connection's budget.
- NWC-XX only needs to add a merchant-signed invoice authorization and durable
  replay/idempotency rules for one subscription billing period.

## Requirement matrix

| Requirement | NWC-08 | NWC-13 | NWC-XX responsibility |
| --- | --- | --- | --- |
| Client keeps its connection secret local | Yes | No | Reuse NWC-08 |
| Request only selected methods | Yes, `request_methods` | No | Request `pay_subscription_invoice` |
| Connection expiry | Yes, `expires_at` | No | Enforce existing expiry |
| Renewable cumulative budget | Yes, `max_amount` and `renewal_period` | Reports it | Do not redefine it |
| Atomic budget enforcement | Yes | No | Preserve it while reserving a payment |
| Query budget without exposing wallet balance | No | Yes, `get_budget` | Reuse when authorized |
| Bind connection to one merchant | No standard semantic binding | No | Define merchant pubkey binding |
| Bind connection to one subscription | No standard semantic binding | No | Define subscription-id binding |
| Prove invoice was authorized by merchant | No | No | Define signed merchant proof |
| Prevent duplicate billing-period payment | No | No | Define durable idempotency rule |
| Reconcile ambiguous Lightning result | No recurring-specific rule | No | Define no-retry-before-reconciliation |
| User-controlled revocation | Wallet-service concern, not standardized as a method | No | Require wallet-side enforcement; no new method in v1 |
| Subscription offer/invoice delivery | No | No | Explicitly out of scope |
| Non-Bitcoin assets and swaps | No | No | Explicitly out of scope |

## NWC-08 integration

### Reused unchanged

- Nostr authorization URI or HTTP confirmation flow;
- locally generated client secret;
- `state` correlation and verification;
- `request_methods` and `optional_request_methods`;
- `expires_at`;
- `max_amount` in millisatoshis;
- `renewal_period` values `never`, `daily`, `weekly`, `monthly`, `yearly`;
- user confirmation and atomic budget enforcement;
- `get_info` discovery of the granted methods.

### Extension-specific profile

NWC-XX proposes a small metadata object containing `subscription.id`,
`merchant_pubkey` and a display-only `merchant_name`. Granting
`pay_subscription_invoice` in the presence of that metadata creates a required
server-side binding.

This does not change NWC-08's rule that optional metadata may otherwise be
ignored. A wallet that cannot enforce the NWC-XX fields must decline the
extension method instead of silently weakening the authorization.

### Gaps intentionally left to wallet policy

NWC-08 defines cumulative period budgets, not every commercial billing model.
The proposal therefore treats `billing_period` as opaque and leaves exact
calendar scheduling, fixed-price, metered and installment terms outside the
wallet command protocol.

A wallet may enforce additional approved limits, such as a single-payment
ceiling, but those limits are not standardized in this first draft.

## NWC-13 integration

`get_budget` reports `used_budget`, `total_budget`, `renews_at` and
`renewal_period` for the requesting connection. It does not identify a
merchant, validate an invoice or authorize a payment.

The scheduler should request `get_budget` as an optional method. Failure to
receive that permission must not cause a fallback to `get_balance`, because
that would reveal more wallet information than required.

No change to the NWC-13 response schema is needed.

## Comparison with the current EasyCryptoSend implementation

| Current implementation | Pre-proposal decision | Required convergence work |
| --- | --- | --- |
| `pay_subscription_invoice` method | Retain | Advertise it with extension `XX` and NIP-44 v2 |
| Dedicated `subscription_scheduler` connection | Retain concept | Provision through or align with NWC-08 |
| Server-side merchant/subscription/expiry/limit policy | Retain | Map shared fields to NWC-08 semantics |
| `merchant_event` using EasyCryptoSend kind `31947` | Replace in the standard | Use a purpose-specific, unpublished signed merchant-proof event with an allocated kind |
| `payment_commitment` SHA-256 tag | Not required in the standard proof | Sign the plaintext proof content inside the encrypted NWC request; retain commitment only for legacy app messages |
| `asset`, `unit`, decimal `amount` | Exclude from initial proposal | Initial spec uses BOLT11 and integer `amount_msat`; keep multi-asset methods experimental |
| `request_code` | Retain semantics | Rename to `request_id`, require at least 128 bits of entropy |
| `(connection, subscription, billing period)` reservation | Retain | Document atomicity and persistence as normative requirements |
| Return success for an already settled identical request | Retain | Return the original result without paying twice |
| `PAYMENT_UNKNOWN` custom error | Simplify initially | Use core `INTERNAL` plus an explanatory message until a shared error is justified |
| `REVOKED`, `EXPIRED`, `INVALID_REQUEST`, `UNSUPPORTED_ASSET` custom errors | Map to core errors | Prefer `UNAUTHORIZED`, `RESTRICTED` or `OTHER` as applicable |
| `revoke_subscription` called by scheduler | Defer from v1 | Wallet-side connection revocation remains authoritative |
| Provider advertises `nip44_v2 nip04` and replies with the request's negotiated mode | Implemented | Completed in NwcProvider commit [`71fb5ff`](https://github.com/nmassari/NwcProvider.LNbits/commit/71fb5ff) with official NIP-44 vector, round-trip and tamper tests |
| Provider implements `get_budget` | Implemented | Completed in commit [`71fb5ff`](https://github.com/nmassari/NwcProvider.LNbits/commit/71fb5ff); it returns the NWC-13 empty result until a true NWC-08 cumulative budget is configured |
| Provider info event has no NWC extension identifier | Gap | Add `XX` after an identifier is assigned |

## Why ordinary `pay_invoice` plus a budget is insufficient

NWC-08 can limit how much a dedicated connection spends per period, but a
compromised scheduler holding that connection could still submit a different
invoice within the same budget. NWC-XX requires a signature from the bound
merchant covering the exact invoice, amount, subscription, billing period and
one-time request id.

The budget and merchant proof solve different problems:

```text
NWC-08 budget       limits how much the connection may spend
NWC-XX proof        limits what merchant obligation it may pay
NWC-XX replay state limits how many times that obligation may be paid
```

All three checks are required before unattended recurring payments are safe.

## Scope decision for the first public discussion

The first discussion should contain only:

1. the `pay_subscription_invoice` NWC method;
2. the signed merchant proof;
3. NWC-08 authorization guidance;
4. NWC-13 budget-query guidance;
5. replay, idempotency, reconciliation and wallet-side revocation rules.

It should not include EasyCryptoSend subscription application messages,
NIP-59, Taproot Assets, LNUSDT, swaps, merchant hosting or subscription
scheduling. Those features can evolve separately and would obscure the narrow
interoperability problem addressed by the NWC extension.

## Open questions for maintainers

1. Should the merchant proof receive a dedicated Nostr event kind, or should
   the signed proof use an existing generic authorization mechanism?
2. Is NWC-08 `metadata` the preferred place to request merchant and
   subscription binding, or should a future NWC-08 revision define namespaced
   extension parameters?
3. Should an uncertain payment result continue using core `INTERNAL`, or is a
   common `PAYMENT_PENDING`/`PAYMENT_UNKNOWN` error warranted?
4. Should an idempotent self-revocation method be standardized later, or remain
   entirely a wallet-service UI/API concern?
5. Should duplicate settled requests return the original success response or a
   dedicated already-paid result?
