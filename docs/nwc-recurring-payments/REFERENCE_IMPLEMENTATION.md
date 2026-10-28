# Reference implementation notes

This document summarizes the working wallet-service implementation that
informed the merchant-bound recurring payments pre-proposal. The production
provider repository is private; these notes expose the relevant protocol and
security behavior without publishing deployment configuration, credentials or
wallet infrastructure details.

The implementation is experimental. It demonstrates feasibility and provides
testable behavior, but it must not be treated as the final interoperable wire
format until the proposal has been reviewed and assigned an extension number.

## NWC transport and discovery

- Requests and responses use the existing NIP-47 event kinds `23194` and
  `23195`.
- NIP-44 version 2 encryption is supported and preferred.
- NIP-04 remains available as a compatibility fallback for existing clients.
- `get_info` advertises the methods granted to the individual connection.
- NWC-13 `get_budget` reports the dedicated connection's allowance without
  exposing the wallet's complete balance.
- The recurring method is advertised separately as
  `pay_subscription_invoice`; ordinary `pay_invoice` permission does not grant
  it implicitly.

The NIP-44 implementation validates the payload version, length, padding and
MAC before accepting plaintext. Automated tests cover round trips, Unicode
payloads and tamper rejection.

## Dedicated authorization

Each recurring subscription is associated with a dedicated NWC connection.
The wallet service persists the connection grant and binds it to:

- the authorized method set;
- expiry and spending policy;
- one merchant Nostr public key;
- one opaque subscription identifier.

Revocation is enforced at the wallet service by disabling or deleting that
connection. It therefore remains effective even if the merchant or scheduler
is unavailable.

## Merchant proof validation

For every payment, the scheduler supplies an unpublished Nostr event signed by
the bound merchant. The current implementation validates:

- the event id and Schnorr signature;
- the expected merchant public key;
- the subscription identifier and billing period;
- the accepted creation-time window;
- a signed commitment covering the invoice and requested amount;
- BOLT11 amount and expiry consistency.

The exact event kind and final field layout remain proposal placeholders. They
are intentionally not presented here as an assigned standard.

## Atomic policy and replay protection

Before initiating a Lightning payment, the provider reserves the applicable
budget and durable replay keys. The persisted record correlates the connection,
subscription, billing period, merchant proof, request id and payment hash.

This provides the following behavior:

- a billing period cannot be charged twice;
- a merchant proof or request id cannot be replayed;
- an identical settled request returns its recorded result without paying
  again;
- an ambiguous Lightning result remains reserved and is reconciled by payment
  hash before another payment attempt is allowed;
- budget checks and replay reservation occur before the external payment call.

The experimental provider currently represents an unresolved Lightning result
as `PAYMENT_UNKNOWN`. Whether this should become a shared NWC error is one of
the proposal's open questions.

## Automated coverage

The private reference implementation includes tests for:

- NIP-44 v2 encryption, decryption and tamper detection;
- NWC-13 budget serialization;
- merchant signature and commitment validation;
- merchant and subscription binding;
- billing-period replay prevention;
- recurring-payment policy and uncertain-result handling.

## Interoperability boundary

Existing NWC clients remain unaffected because the feature is optional and
uses explicit discovery. Clients that do not understand the extension can
ignore it. A recurring-payment client must not silently fall back to generic
`pay_invoice`, because doing so would remove the merchant and subscription
binding that the extension is designed to enforce.

