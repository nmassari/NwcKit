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
}

export type NwcMethod = keyof NwcMethodMap;