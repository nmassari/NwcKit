import { SimplePool, finalizeEvent, getPublicKey, } from "nostr-tools";
import { decryptContentWithMode, encryptContentWithMode, } from "./crypto.js";
import { btcMainnetLightning, btcMainnetOnchain } from "./assets.js";
// ---- NWC protocol kinds ----
const NWC_INFO_KIND = 13194;
const NWC_REQUEST_KIND = 23194;
const NWC_RESPONSE_KIND = 23195;
export class NwcError extends Error {
    code;
    requestId;
    constructor(code, message, requestId) {
        super(message);
        this.name = "NwcError";
        this.code = code;
        this.requestId = requestId;
    }
}
export class NwcKit {
    connection;
    timeoutMs;
    pool;
    clientSecret;
    clientPubkey;
    debug;
    onConnectionStateChange;
    encryptionMode = "nip04";
    encryptionWasAdvertised = false;
    connected = false;
    connectingPromise = null;
    destroyed = false;
    responseSub = null;
    pending = new Map();
    constructor(options) {
        validateConnection(options.connection);
        this.connection = options.connection;
        this.timeoutMs = options.timeoutMs ?? 15000;
        this.pool = new SimplePool();
        this.clientSecret = this.connection.secret;
        this.clientPubkey = getPublicKey(hexToBytes(this.clientSecret));
        this.debug = options.debug ?? false;
        this.onConnectionStateChange = options.onConnectionStateChange;
        this.log("clientPubkey:", this.clientPubkey);
    }
    async connect() {
        this.assertAlive();
        if (this.connected)
            return;
        if (this.connectingPromise)
            return this.connectingPromise;
        this.notifyConnectionState("connecting");
        this.connectingPromise = this.openRelayConnection();
        try {
            await this.connectingPromise;
            this.startResponseSubscription();
            this.connected = true;
            this.notifyConnectionState("connected");
        }
        finally {
            this.connectingPromise = null;
        }
    }
    async disconnect() {
        this.responseSub?.close();
        this.responseSub = null;
        for (const [requestId, pending] of this.pending) {
            clearTimeout(pending.timer);
            pending.reject(new NwcError("DISCONNECTED", "Disconnected before receiving response", requestId));
        }
        this.pending.clear();
        this.pool.close([this.connection.relayUrl]);
        this.connected = false;
        this.notifyConnectionState("disconnected");
        this.connectingPromise = null;
    }
    async getInfo() {
        this.assertConnected();
        try {
            const event = await withTimeout(this.pool.get([this.connection.relayUrl], {
                kinds: [NWC_INFO_KIND],
                authors: [this.connection.walletPubkey],
                limit: 1,
            }), this.timeoutMs, "get_info");
            if (event) {
                this.log("NWC info event:", event);
                this.configureEncryptionFromInfoEvent(event);
                return parseWalletInfoEvent(event.content, normalizeTags(event.tags));
            }
            this.log("NWC info event not found; falling back to encrypted get_info request.");
        }
        catch (error) {
            this.log("NWC info event lookup failed; falling back to encrypted get_info request.", error);
        }
        return this.request("get_info", {});
    }
    async supports(method, info) {
        const walletInfo = info ?? (await this.getInfo());
        return walletInfoSupports(walletInfo, method);
    }
    async supportsSwaps(info) {
        const walletInfo = info ?? (await this.getInfo());
        const capabilities = getCapabilitiesFromInfo(walletInfo);
        return capabilities.canSwap;
    }
    async getCapabilities(info) {
        const walletInfo = info ?? (await this.getInfo());
        return getCapabilitiesFromInfo(walletInfo);
    }
    async getBalance() {
        const result = await this.request("get_balance", {});
        return {
            ...result,
            balance: msatsToSats(result.balance),
        };
    }
    async getAssetBalances() {
        return this.request("get_taproot_asset_balances", {});
    }
    async makeInvoice(params) {
        const fixedParams = {
            ...params,
            amount: satsToMsats(params.amount),
        };
        const result = await this.request("make_invoice", fixedParams);
        return normalizeInvoiceAmounts(result);
    }
    async payInvoice(input) {
        const params = typeof input === "string" ? { invoice: input } : input;
        const result = await this.request("pay_invoice", params);
        return {
            ...result,
            fees_paid: result.fees_paid !== undefined
                ? msatsToSats(result.fees_paid)
                : result.fees_paid,
            service_fee_paid: result.service_fee_paid !== undefined
                ? msatsToSats(result.service_fee_paid)
                : result.service_fee_paid,
        };
    }
    async paySubscriptionInvoice(params) {
        if (!params.subscription_id?.trim()) {
            throw new Error("Subscription id is required");
        }
        if (!params.billing_period?.trim()) {
            throw new Error("Billing period is required");
        }
        if (!params.invoice?.trim()) {
            throw new Error("Invoice is required");
        }
        if (!params.merchant_event) {
            throw new Error("Signed merchant event is required");
        }
        return this.request("pay_subscription_invoice", params);
    }
    async revokeSubscription(params = {}) {
        return this.request("revoke_subscription", params);
    }
    async makeTaprootAssetInvoice(params) {
        const amountValue = Number(params.amount);
        assertPositiveAmount(amountValue);
        return this.request("make_taproot_asset_invoice", {
            ...params,
            asset: params.asset ?? "LNUSDT",
            amount: normalizeAmountValue(amountValue, params.unit ?? "USDT"),
            unit: params.unit ?? "USDT",
        });
    }
    async payTaprootAssetInvoice(params) {
        if (!params.invoice?.trim()) {
            throw new Error("Invoice is required");
        }
        const amount = params.amount === undefined
            ? undefined
            : normalizeAmountValue(Number(params.amount), params.unit ?? "USDT");
        return this.request("pay_taproot_asset_invoice", {
            ...params,
            asset: params.asset ?? "LNUSDT",
            invoice: params.invoice.trim(),
            amount,
            unit: params.unit ?? "USDT",
        });
    }
    async lookupInvoice(params) {
        const result = await this.request("lookup_invoice", params);
        return normalizeInvoiceAmounts(result);
    }
    async listTransactions(params = {}) {
        const result = await this.request("list_transactions", params);
        return {
            ...result,
            transactions: (result.transactions ?? []).map(normalizeInvoiceAmounts),
        };
    }
    async createOnchainToLightningSwap(params) {
        assertPositiveSats(params.amountSats);
        if (!params.invoice?.trim()) {
            throw new Error("Invoice is required");
        }
        return this.createSwap({
            direction: "onchain_to_lightning",
            sendAsset: bitcoinOnchainAsset(),
            receiveAsset: bitcoinLightningAsset(),
            amount: satsAmount(params.amountSats),
            receiveInvoice: params.invoice.trim(),
        });
    }
    async createLightningToOnchainSwap(params) {
        assertPositiveSats(params.amountSats);
        if (!params.destinationAddress?.trim()) {
            throw new Error("Destination address is required");
        }
        return this.createSwap({
            direction: "lightning_to_onchain",
            sendAsset: bitcoinLightningAsset(),
            receiveAsset: bitcoinOnchainAsset(),
            amount: satsAmount(params.amountSats),
            receiveAddress: params.destinationAddress.trim(),
        });
    }
    async createSwap(params) {
        const amountValue = Number(params.amount?.value);
        assertPositiveAmount(amountValue);
        if (!params.amount?.unit?.trim()) {
            throw new Error("Amount unit is required");
        }
        if (params.direction === "onchain_to_lightning" && !params.receiveInvoice?.trim()) {
            throw new Error("Receive invoice is required");
        }
        if (params.direction === "lightning_to_onchain" && !params.receiveAddress?.trim()) {
            throw new Error("Receive address is required");
        }
        return this.request("create_swap", {
            request_id: params.requestId?.trim() || crypto.randomUUID().replaceAll("-", ""),
            direction: params.direction,
            send_asset: params.sendAsset,
            receive_asset: params.receiveAsset,
            amount: {
                value: normalizeAmountValue(amountValue, params.amount.unit),
                unit: params.amount.unit.trim(),
            },
            receive_invoice: params.receiveInvoice?.trim(),
            receive_address: params.receiveAddress?.trim(),
        });
    }
    async getSwapStatus(params) {
        const swapId = normalizeSwapId(params.swapId);
        return this.request("get_swap", {
            swap_id: swapId,
        });
    }
    async refreshSwapStatus(params) {
        const swapId = normalizeSwapId(params.swapId);
        return this.request("refresh_swap", {
            swap_id: swapId,
        });
    }
    async request(method, params) {
        this.assertConnected();
        const hasParams = Object.keys(params ?? {}).length > 0;
        const requestBody = hasParams
            ? { method, params }
            : { method };
        const plaintext = JSON.stringify(requestBody);
        const encrypted = await encryptContentWithMode(this.encryptionMode, plaintext, this.clientSecret, this.connection.walletPubkey);
        const unsignedEvent = {
            kind: NWC_REQUEST_KIND,
            created_at: nowSeconds(),
            content: encrypted,
            tags: [
                ["p", this.connection.walletPubkey],
                ...(this.encryptionWasAdvertised
                    ? [["encryption", this.encryptionMode]]
                    : []),
            ],
            pubkey: this.clientPubkey,
        };
        const signedEvent = finalizeEvent(unsignedEvent, hexToBytes(this.clientSecret));
        this.log("NWC request:", signedEvent);
        const responsePromise = new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(signedEvent.id);
                this.notifyConnectionState("degraded", `${method} timed out`);
                reject(new NwcError("TIMEOUT", `${method} timed out after ${this.timeoutMs} ms`, signedEvent.id));
            }, this.timeoutMs);
            this.pending.set(signedEvent.id, {
                timer,
                resolve,
                reject,
            });
        });
        const pubs = this.pool.publish([this.connection.relayUrl], signedEvent);
        for (const pub of pubs) {
            pub.on?.("ok", () => this.log("relay publish ok"));
            pub.on?.("seen", () => this.log("relay publish seen"));
            pub.on?.("failed", (reason) => {
                this.log("relay publish failed:", reason);
                this.notifyConnectionState("degraded", reason);
            });
        }
        const envelope = await responsePromise;
        this.notifyConnectionState("connected");
        if (envelope.error) {
            throw new NwcError(envelope.error.code, envelope.error.message, signedEvent.id);
        }
        return (envelope.result ?? {});
    }
    destroy() {
        if (this.destroyed)
            return;
        this.destroyed = true;
        this.responseSub?.close();
        this.responseSub = null;
        this.pool.close([this.connection.relayUrl]);
        this.connected = false;
        this.connectingPromise = null;
        this.pending.clear();
        this.notifyConnectionState("disconnected");
    }
    notifyConnectionState(state, detail) {
        try {
            this.onConnectionStateChange?.(state, detail);
        }
        catch (error) {
            this.log("connection state callback failed", error);
        }
    }
    async openRelayConnection() {
        await new Promise((resolve, reject) => {
            let settled = false;
            let sub;
            const timer = setTimeout(() => {
                if (settled)
                    return;
                settled = true;
                sub?.close();
                reject(new NwcError("RELAY_TIMEOUT", `Relay connection timed out after ${this.timeoutMs} ms`));
            }, this.timeoutMs);
            const finishOk = () => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                sub?.close();
                resolve();
            };
            const finishError = (error) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                sub?.close();
                reject(error instanceof Error
                    ? error
                    : new NwcError("RELAY_ERROR", "Failed to connect to relay"));
            };
            try {
                sub = this.pool.subscribeMany([this.connection.relayUrl], {
                    kinds: [NWC_INFO_KIND],
                    authors: [this.connection.walletPubkey],
                    limit: 1,
                }, {
                    onevent: (event) => {
                        this.configureEncryptionFromInfoEvent(event);
                        finishOk();
                    },
                    oneose: () => finishOk(),
                });
            }
            catch (error) {
                finishError(error);
            }
        });
    }
    startResponseSubscription() {
        this.responseSub?.close();
        this.responseSub = this.pool.subscribeMany([this.connection.relayUrl], {
            kinds: [NWC_RESPONSE_KIND],
            authors: [this.connection.walletPubkey],
        }, {
            onevent: async (event) => {
                await this.handleResponseEvent(event);
            },
            oneose: () => {
                this.log("NWC response subscription ready");
            },
        });
    }
    async handleResponseEvent(event) {
        this.log("NWC response event:", event);
        let plaintext;
        try {
            const tags = normalizeTags(event.tags);
            const responseMode = parseEncryptionMode(getSingleTagValue(tags, "encryption")) ?? this.encryptionMode;
            plaintext = await decryptContentWithMode(responseMode, event.content, this.clientSecret, this.connection.walletPubkey);
        }
        catch (err) {
            this.log("decrypt failed:", err);
            return;
        }
        this.log("NWC decrypted response:", plaintext);
        let envelope;
        try {
            envelope = JSON.parse(plaintext);
        }
        catch (err) {
            this.log("reading decrypted failed:", err);
            return;
        }
        const tags = normalizeTags(event.tags);
        const eTag = tags.find((t) => t[0] === "e")?.[1];
        if (!eTag || typeof eTag !== "string") {
            this.log("missing e tag");
            return;
        }
        const pending = this.pending.get(eTag);
        if (!pending)
            return;
        this.pending.delete(eTag);
        clearTimeout(pending.timer);
        this.pending.delete(eTag);
        pending.resolve(envelope);
    }
    assertConnected() {
        this.assertAlive();
        if (!this.connected) {
            throw new NwcError("NOT_CONNECTED", "NwcKit is not connected. Call connect() first.");
        }
    }
    configureEncryptionFromInfoEvent(event) {
        const tags = normalizeTags(event.tags);
        const encryptionTag = getSingleTagValue(tags, "encryption");
        if (!encryptionTag) {
            this.encryptionMode = "nip04";
            this.encryptionWasAdvertised = false;
            return;
        }
        const advertised = parseEncryptionModes(encryptionTag);
        if (!advertised.length) {
            throw new NwcError("UNSUPPORTED_ENCRYPTION", `Wallet advertised no supported encryption mode: ${encryptionTag}`);
        }
        this.encryptionWasAdvertised = true;
        this.encryptionMode = advertised.includes("nip44_v2")
            ? "nip44_v2"
            : "nip04";
        this.log("NWC encryption mode:", this.encryptionMode);
    }
    assertAlive() {
        if (this.destroyed) {
            throw new NwcError("DESTROYED", "NwcKit has been destroyed");
        }
    }
    log(...args) {
        if (!this.debug)
            return;
        console.log(...args);
    }
}
// ---- Helpers ----
function bitcoinOnchainAsset() {
    return btcMainnetOnchain();
}
function bitcoinLightningAsset() {
    return btcMainnetLightning();
}
function walletInfoSupports(info, method) {
    const normalized = method.trim();
    if (!normalized)
        return false;
    return (info.methods ?? []).includes(normalized);
}
function getCapabilitiesFromInfo(info) {
    const methods = info.methods ?? [];
    const has = (method) => methods.includes(method);
    const canCreateSwap = has("create_swap");
    const canGetSwap = has("get_swap");
    const canRefreshSwap = has("refresh_swap");
    return {
        methods,
        canGetInfo: has("get_info"),
        canGetBalance: has("get_balance"),
        canMakeInvoice: has("make_invoice"),
        canPayInvoice: has("pay_invoice"),
        canPaySubscriptionInvoice: has("pay_subscription_invoice"),
        canRevokeSubscription: has("revoke_subscription"),
        canLookupInvoice: has("lookup_invoice"),
        canListTransactions: has("list_transactions"),
        canCreateSwap,
        canGetSwap,
        canRefreshSwap,
        canSwap: canCreateSwap && canGetSwap,
    };
}
function satsAmount(sats) {
    assertPositiveSats(sats);
    return {
        value: String(Math.round(sats)),
        unit: "sat",
    };
}
function satsToMsats(sats) {
    assertPositiveSats(sats);
    return Math.round(sats * 1000);
}
function assertPositiveSats(sats) {
    if (!Number.isFinite(sats) || sats <= 0) {
        throw new Error("Amount must be a positive number in sats");
    }
}
function assertPositiveAmount(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Amount must be a positive number");
    }
}
function normalizeAmountValue(amount, unit) {
    return unit.trim().toLowerCase() === "sat"
        ? String(Math.round(amount))
        : String(amount);
}
function normalizeSwapId(swapId) {
    const value = swapId?.trim();
    if (!value) {
        throw new Error("Swap id is required");
    }
    return value;
}
function msatsToSats(msats) {
    if (!Number.isFinite(msats)) {
        throw new Error("Amount must be a finite number in msats");
    }
    return Math.round(msats / 1000);
}
function normalizeInvoiceAmounts(obj) {
    return {
        ...obj,
        amount: obj.amount !== undefined ? msatsToSats(obj.amount) : obj.amount,
        fees_paid: obj.fees_paid !== undefined ? msatsToSats(obj.fees_paid) : obj.fees_paid,
        service_fee_paid: obj.service_fee_paid !== undefined ? msatsToSats(obj.service_fee_paid) : obj.service_fee_paid,
    };
}
function nowSeconds() {
    return Math.floor(Date.now() / 1000);
}
function hexToBytes(hex) {
    if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
        throw new Error("Invalid hex string");
    }
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return out;
}
function withTimeout(promise, timeoutMs, label) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new NwcError("TIMEOUT", `${label} timed out after ${timeoutMs} ms`));
        }, timeoutMs);
        promise
            .then((value) => {
            clearTimeout(timer);
            resolve(value);
        })
            .catch((error) => {
            clearTimeout(timer);
            reject(error);
        });
    });
}
function parseWalletInfoEvent(content, tags) {
    const methods = content.trim().split(/\s+/).filter(Boolean);
    const pubkey = getSingleTagValue(tags, "pubkey");
    const alias = getSingleTagValue(tags, "alias");
    const color = getSingleTagValue(tags, "color");
    const network = getSingleTagValue(tags, "network");
    const blockHeightRaw = getSingleTagValue(tags, "block_height");
    const encryption = parseEncryptionModes(getSingleTagValue(tags, "encryption"));
    const extensions = splitTagValues(getSingleTagValue(tags, "extensions"));
    const blockHeight = blockHeightRaw !== undefined && blockHeightRaw !== ""
        ? Number(blockHeightRaw)
        : undefined;
    return {
        alias: alias ?? undefined,
        color: color ?? undefined,
        pubkey: pubkey ?? undefined,
        network: network ?? undefined,
        block_height: blockHeight !== undefined && Number.isFinite(blockHeight)
            ? blockHeight
            : undefined,
        methods,
        encryption: encryption.length ? encryption : undefined,
        extensions: extensions.length ? extensions : undefined,
    };
}
function parseEncryptionModes(value) {
    return splitTagValues(value)
        .map(parseEncryptionMode)
        .filter((mode) => mode !== undefined);
}
function parseEncryptionMode(value) {
    return value === "nip44_v2" || value === "nip04" ? value : undefined;
}
function splitTagValues(value) {
    return value?.trim().split(/\s+/).filter(Boolean) ?? [];
}
function getSingleTagValue(tags, tagName) {
    const tag = tags.find((t) => t[0] === tagName);
    return tag?.[1];
}
function normalizeTags(tags) {
    if (!Array.isArray(tags))
        return [];
    return tags.filter((tag) => Array.isArray(tag) && tag.every((x) => typeof x === "string"));
}
function validateConnection(connection) {
    if (!connection) {
        throw new Error("Connection is required");
    }
    if (!connection.secret || !/^[0-9a-fA-F]{64}$/.test(connection.secret)) {
        throw new Error("Connection secret must be a 32-byte hex string");
    }
    if (!connection.walletPubkey ||
        !/^[0-9a-fA-F]{64}$/.test(connection.walletPubkey)) {
        throw new Error("Wallet pubkey must be a 32-byte hex string");
    }
    if (!connection.relayUrl || !/^wss?:\/\//i.test(connection.relayUrl)) {
        throw new Error("Relay URL must start with ws:// or wss://");
    }
}
