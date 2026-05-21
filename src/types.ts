export interface NwcConnection {
  walletPubkey: string;
  secret: string;
  relayUrl: string;
  lud16?: string;
}

export interface NwcKitOptions {
  connection: NwcConnection;
  timeoutMs?: number;
}

export interface NwcWalletInfo {
  alias?: string;
  color?: string;
  pubkey?: string;
  network?: string;
  block_height?: number;
  methods?: string[];
}

export interface NwcBalanceResponse {
  balance: number;
}

export interface MakeInvoiceParams {
  amount: number;
  description?: string;
  description_hash?: string;
  expiry?: number;
}

export interface MakeInvoiceResponse {
  type?: string;
  invoice: string;
  payment_hash?: string;
  amount?: number;
  created_at?: number;
  expires_at?: number;
}

export interface PayInvoiceParams {
  invoice: string;
  amount?: number;
}

export interface PayInvoiceResponse {
  preimage?: string;
  fees_paid?: number;
}

export interface LookupInvoiceParams {
  invoice?: string;
  payment_hash?: string;
}

export interface InvoiceLookupResponse {
  type?: "incoming" | "outgoing";
  invoice?: string;
  description?: string;
  description_hash?: string;
  preimage?: string;
  payment_hash?: string;
  amount?: number;
  fees_paid?: number;
  created_at?: number;
  expires_at?: number;
  settled_at?: number;
  settled?: boolean;
}

export interface ListTransactionsParams {
  from?: number;
  until?: number;
  limit?: number;
  offset?: number;
  unpaid?: boolean;
  type?: "incoming" | "outgoing";
}

export interface ListTransactionsResponse {
  transactions: InvoiceLookupResponse[];
}

export interface CreateOnchainToLightningSwapParams {
  amountSats: number;
  invoice: string;
}

export interface CreateLightningToOnchainSwapParams {
  amountSats: number;
  destinationAddress: string;
}

export type SwapRail = "onchain" | "lightning";
export type SwapNetwork = "mainnet" | "testnet" | "signet" | "regtest";
export type SwapAssetCode = "BTC" | string;
export type SwapAmountUnit = "sat" | string;
export type SwapDirection = "onchain_to_lightning" | "lightning_to_onchain";

export interface SwapAsset {
  asset: SwapAssetCode;
  chain: "bitcoin" | string;
  network: SwapNetwork;
  rail: SwapRail | string;
}

export interface SwapAmount {
  value: string;
  unit: SwapAmountUnit;
}

export interface CreateSwapParams {
  direction: SwapDirection;
  sendAsset: SwapAsset;
  receiveAsset: SwapAsset;
  amount: SwapAmount;
  receiveInvoice?: string;
  receiveAddress?: string;
}

export interface CreateSwapRequestParams {
  direction: SwapDirection;
  send_asset: SwapAsset;
  receive_asset: SwapAsset;
  amount: SwapAmount;
  receive_invoice?: string;
  receive_address?: string;
}

export interface SwapStatusParams {
  swapId: string;
}

export interface OnchainToLightningSwapResponse {
  ok?: boolean;
  operationId?: string;
  swapId: string;
  direction?: string;
  sendAsset?: SwapAsset;
  receiveAsset?: SwapAsset;
  amount?: SwapAmount;
  status?: string;
  depositAddress: string;
  bip21?: string;
  expectedAmount?: number;
  timeoutBlockHeight?: number;
  feeSats?: number;
  feePaymentHash?: string;
}

export interface LightningToOnchainSwapResponse {
  ok?: boolean;
  operationId?: string;
  swapId: string;
  direction?: string;
  sendAsset?: SwapAsset;
  receiveAsset?: SwapAsset;
  amount?: SwapAmount;
  status?: string;
  invoice: string;
  lockupAddress?: string;
  timeoutBlockHeight?: number;
  feeSats?: number;
  feePaymentHash?: string;
}

export type CreateSwapResponse =
  | OnchainToLightningSwapResponse
  | LightningToOnchainSwapResponse;

export interface SwapOperationStatusResponse {
  operationId?: string;
  swapId: string;
  type?: string;
  direction?: string;
  sendAsset?: SwapAsset;
  receiveAsset?: SwapAsset;
  amount?: SwapAmount;
  status?: string;
  boltzStatus?: string;
  amountSats?: number;
  expectedAmount?: number;
  depositAddress?: string;
  lockupAddress?: string;
  timeoutBlockHeight?: number;
  createdUtc?: string;
  updatedUtc?: string;
  lastCheckedUtc?: string;
  completedUtc?: string;
}

export interface RefreshSwapStatusResponse {
  ok?: boolean;
  swapId: string;
  status?: string;
  boltzStatus?: string;
  updatedUtc?: string;
}

export interface NwcResponse<T = unknown> {
  result_type?: string;
  result?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface NwcMethodMap {
  get_info: {
    params: Record<string, never>;
    result: NwcWalletInfo;
  };
  get_balance: {
    params: Record<string, never>;
    result: NwcBalanceResponse;
  };
  make_invoice: {
    params: MakeInvoiceParams;
    result: MakeInvoiceResponse;
  };
  pay_invoice: {
    params: PayInvoiceParams;
    result: PayInvoiceResponse;
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
}

export type NwcMethod = keyof NwcMethodMap;
