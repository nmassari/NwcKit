import type { NwcKitOptions, NwcWalletInfo, NwcCapabilities, MakeInvoiceParams, PayInvoiceParams, MakeTaprootAssetInvoiceParams, PayTaprootAssetInvoiceParams, LookupInvoiceParams, ListTransactionsParams, CreateSwapParams, CreateSwapRequestParams, CreateSwapResponse, CreateOnchainToLightningSwapParams, CreateLightningToOnchainSwapParams, SwapStatusParams, NwcBalanceResponse, NwcAssetBalancesResponse, MakeInvoiceResponse, PayInvoiceResponse, MakeTaprootAssetInvoiceResponse, PayTaprootAssetInvoiceResponse, InvoiceLookupResponse, ListTransactionsResponse, OnchainToLightningSwapResponse, LightningToOnchainSwapResponse, SwapOperationStatusResponse, RefreshSwapStatusResponse } from "./types.js";
type NwcMethodMap = {
    get_info: {
        params: Record<string, never>;
        result: NwcWalletInfo;
    };
    get_balance: {
        params: Record<string, never>;
        result: NwcBalanceResponse;
    };
    get_taproot_asset_balances: {
        params: Record<string, never>;
        result: NwcAssetBalancesResponse;
    };
    make_invoice: {
        params: MakeInvoiceParams;
        result: MakeInvoiceResponse;
    };
    pay_invoice: {
        params: PayInvoiceParams;
        result: PayInvoiceResponse;
    };
    make_taproot_asset_invoice: {
        params: MakeTaprootAssetInvoiceParams;
        result: MakeTaprootAssetInvoiceResponse;
    };
    pay_taproot_asset_invoice: {
        params: PayTaprootAssetInvoiceParams;
        result: PayTaprootAssetInvoiceResponse;
    };
    lookup_invoice: {
        params: LookupInvoiceParams;
        result: InvoiceLookupResponse;
    };
    list_transactions: {
        params: ListTransactionsParams;
        result: ListTransactionsResponse;
    };
    create_swap: {
        params: CreateSwapRequestParams;
        result: CreateSwapResponse;
    };
    get_swap: {
        params: {
            swap_id: string;
        };
        result: SwapOperationStatusResponse;
    };
    refresh_swap: {
        params: {
            swap_id: string;
        };
        result: RefreshSwapStatusResponse;
    };
};
type NwcMethod = keyof NwcMethodMap;
export declare class NwcError extends Error {
    readonly code: string;
    readonly requestId?: string;
    constructor(code: string, message: string, requestId?: string);
}
export declare class NwcKit {
    private readonly connection;
    private readonly timeoutMs;
    private readonly pool;
    private readonly clientSecret;
    private readonly clientPubkey;
    private readonly debug;
    private connected;
    private connectingPromise;
    private destroyed;
    private responseSub;
    private readonly pending;
    constructor(options: NwcKitOptions & {
        debug?: boolean;
    });
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getInfo(): Promise<NwcWalletInfo>;
    supports(method: string, info?: NwcWalletInfo): Promise<boolean>;
    supportsSwaps(info?: NwcWalletInfo): Promise<boolean>;
    getCapabilities(info?: NwcWalletInfo): Promise<NwcCapabilities>;
    getBalance(): Promise<NwcBalanceResponse>;
    getAssetBalances(): Promise<NwcAssetBalancesResponse>;
    makeInvoice(params: MakeInvoiceParams): Promise<MakeInvoiceResponse>;
    payInvoice(invoice: string): Promise<PayInvoiceResponse>;
    payInvoice(params: PayInvoiceParams): Promise<PayInvoiceResponse>;
    makeTaprootAssetInvoice(params: MakeTaprootAssetInvoiceParams): Promise<MakeTaprootAssetInvoiceResponse>;
    payTaprootAssetInvoice(params: PayTaprootAssetInvoiceParams): Promise<PayTaprootAssetInvoiceResponse>;
    lookupInvoice(params: LookupInvoiceParams): Promise<InvoiceLookupResponse>;
    listTransactions(params?: ListTransactionsParams): Promise<ListTransactionsResponse>;
    createOnchainToLightningSwap(params: CreateOnchainToLightningSwapParams): Promise<OnchainToLightningSwapResponse>;
    createLightningToOnchainSwap(params: CreateLightningToOnchainSwapParams): Promise<LightningToOnchainSwapResponse>;
    createSwap(params: CreateSwapParams): Promise<CreateSwapResponse>;
    getSwapStatus(params: SwapStatusParams): Promise<SwapOperationStatusResponse>;
    refreshSwapStatus(params: SwapStatusParams): Promise<RefreshSwapStatusResponse>;
    request<TMethod extends NwcMethod>(method: TMethod, params: NwcMethodMap[TMethod]["params"]): Promise<NwcMethodMap[TMethod]["result"]>;
    destroy(): void;
    private openRelayConnection;
    private startResponseSubscription;
    private handleResponseEvent;
    private assertConnected;
    private assertAlive;
    private log;
}
export {};
