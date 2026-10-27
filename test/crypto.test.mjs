import test from "node:test";
import assert from "node:assert/strict";
import { getPublicKey, nip59 } from "nostr-tools";
import {
  decryptContentWithMode,
  encryptContentWithMode,
} from "../dist/index.js";

const secretA = new Uint8Array(32);
secretA[31] = 1;
const secretB = new Uint8Array(32);
secretB[31] = 2;

const hexA = Buffer.from(secretA).toString("hex");
const hexB = Buffer.from(secretB).toString("hex");
const pubkeyA = getPublicKey(secretA);
const pubkeyB = getPublicKey(secretB);

for (const mode of ["nip04", "nip44_v2"]) {
  test(`${mode} encrypts and decrypts in both directions`, async () => {
    const plaintext = JSON.stringify({ method: "get_balance", params: {} });
    const encryptedForB = await encryptContentWithMode(
      mode,
      plaintext,
      hexA,
      pubkeyB
    );
    assert.notEqual(encryptedForB, plaintext);
    assert.equal(
      await decryptContentWithMode(mode, encryptedForB, hexB, pubkeyA),
      plaintext
    );

    const encryptedForA = await encryptContentWithMode(
      mode,
      plaintext,
      hexB,
      pubkeyA
    );
    assert.equal(
      await decryptContentWithMode(mode, encryptedForA, hexA, pubkeyB),
      plaintext
    );
  });
}

test("NIP-59 gift wrap preserves the private structured message", () => {
  const content = JSON.stringify({
    protocol: "ecs-subscriptions",
    version: "0.1",
    type: "subscription.invoice_request",
    messageId: "msg_test",
    createdAt: "2026-10-28T00:00:00.000Z",
    payload: { subscriptionId: "sub_test" },
  });
  const wrapped = nip59.wrapEvent(
    {
      kind: 31947,
      created_at: 1_798_000_000,
      content,
      tags: [
        ["d", "msg_test"],
        ["p", pubkeyB],
        ["type", "subscription.invoice_request"],
      ],
    },
    secretA,
    pubkeyB
  );

  assert.equal(wrapped.kind, 1059);
  assert.notEqual(wrapped.content, content);
  const rumor = nip59.unwrapEvent(wrapped, secretB);
  assert.equal(rumor.pubkey, pubkeyA);
  assert.equal(rumor.content, content);
  assert.equal(rumor.tags.find((tag) => tag[0] === "d")?.[1], "msg_test");
});
