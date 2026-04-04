import { parseNwcUri } from "./uri.js";
import { NwcKit, NwcError } from "./client.js";

async function main() {
  const connection = parseNwcUri(
    "nostr+walletconnect://75b11fb07d7c87cfff8365326e5fc5e0a266e50cd0a3c22fdae8f727849d09fe?relay=wss://relay.getalby.com/v1&secret=493d81ec9ec17d4ac05c8e0ce9a147c2eaf39dce02d63b246019e76141431657"
  );

  console.log("Parsed connection:");
  console.log(connection);

  const client = new NwcKit({
    connection,
    timeoutMs: 15000,
  });

  console.log("Client created.");

  try {
    await client.connect();
    console.log("Connected to relay.");

    try {
      const info = await client.getInfo();
      console.log("Wallet info:");
      console.dir(info, { depth: null });
    } catch (err) {
      console.warn("getInfo() failed, continuing with getBalance()...");
      console.warn(err);
    }

    try {
      const txs = await client.listTransactions({ limit: 5 });
      console.log("Transactions:");
      console.dir(txs, { depth: null });
    } catch (err) {
      console.warn("listTransactions() failed...");
      console.warn(err);
    }

    const balance = await client.getBalance();
    console.log("Balance:");
    console.dir(balance, { depth: null });

    const invoice = await client.makeInvoice({
      amount: 30000,
      description: "NwcKit test"
    });

    console.log("Invoice:");
    console.dir(invoice, { depth: null });

    if (invoice.payment_hash) {
      const lookup = await client.lookupInvoice({
        payment_hash: invoice.payment_hash        
      });

      console.log("Lookup:");
      console.dir(lookup, { depth: null });
    }



  } finally {
    await client.disconnect();
    console.log("Disconnected.");
  }
}

main().catch((err) => {
  console.error("Test failed:");

  if (err instanceof NwcError) {
    console.error({
      code: err.code,
      message: err.message,
      requestId: err.requestId,
    });
  } else {
    console.error(err);
  }
});