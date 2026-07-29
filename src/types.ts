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

export interface NwcCapabilities {
  methods: string[];
  canGetInfo: boolean;
  canGetBalance: boolean;
  canMakeInvoice: boolean;
  canPayInvoice: boolean;
  canLookupInvoice: boolean;
  canListTransactions: boolean;
  canCreateSwap: boolean;
  canGetSwap: boolean;
  canRefreshSwap: boolean;
  canSwap: boolean;
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
  payment_hash?: string;
  fees_paid?: number;
  service_fee_paid?: number;
  service_fee_payment_hash?: string;
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

export const ECS_APP_MESSAGE_PROTOCOL = "ecs-subscriptions";
export const ECS_APP_MESSAGE_VERSION = "0.1";
export const ECS_APP_MESSAGE_KIND = 31947;

export type EcsAppMessageType =
  | "payment.notification"
  | "subscription.offer"
  | "subscription.accepted"
  | "subscription.rejected"
  | "subscription.invoice_request"
  | "subscription.invoice_response"
  | "subscription.payment_sent"
  | "subscription.payment_failed"
  | "subscription.pause"
  | "subscription.resume"
  | "subscription.cancel"
  | "subscription.terms_update"
  | "subscription.ack";

export type SubscriptionInterval =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

export type SubscriptionStatus =
  | "pending"
  | "active"
  | "paused"
  | "cancelled"
  | "expired";

export type SubscriptionPaymentPolicy = "manual_confirm" | "autopay";

export interface EcsAppMessageEnvelope<TPayload = unknown> {
  protocol: typeof ECS_APP_MESSAGE_PROTOCOL;
  version: typeof ECS_APP_MESSAGE_VERSION;
  type: EcsAppMessageType;
  messageId: string;
  createdAt: string;
  payload: TPayload;
}

export interface EcsAppMessage<TPayload = unknown> extends EcsAppMessageEnvelope<TPayload> {
  eventId: string;
  senderPubkey: string;
  recipientPubkey?: string;
  relayUrl?: string;
  receivedAt: string;
}

export interface EcsAppMessageOptions {
  privateKey: string;
  relays: string[];
  timeoutMs?: number;
  debug?: boolean;
}

export interface SendEcsAppMessageParams<TPayload = unknown> {
  recipientPubkey: string;
  type: EcsAppMessageType;
  payload: TPayload;
  messageId?: string;
  createdAt?: string;
  tags?: string[][];
}

export interface SubscriptionTerms {
  subscriptionId: string;
  merchantPubkey: string;
  customerPubkey?: string;
  amountSats: number;
  interval: SubscriptionInterval;
  maxAmountSats: number;
  description: string;
  startsAt: string;
  expiresAt?: string;
  paymentPolicy?: SubscriptionPaymentPolicy;
  merchantName?: string;
  merchantDomain?: string;
  termsHash?: string;
}

export interface SubscriptionOfferPayload extends SubscriptionTerms {
  initialInvoice?: string;
}

export interface SubscriptionAcceptedPayload {
  subscriptionId: string;
  customerPubkey: string;
  merchantPubkey: string;
  acceptedAt: string;
  termsHash?: string;
}

export interface SubscriptionRejectedPayload {
  subscriptionId: string;
  customerPubkey: string;
  merchantPubkey: string;
  rejectedAt: string;
  reason?: string;
}

export interface SubscriptionInvoiceRequestPayload {
  subscriptionId: string;
  merchantPubkey: string;
  customerPubkey: string;
  billingPeriod: string;
  sequence?: number;
  requestCode: string;
  amountSatsExpected: number;
  createdAt: string;
  expiresAt: string;
  previousPaymentHash?: string;
}

export interface SubscriptionInvoiceResponsePayload {
  subscriptionId: string;
  merchantPubkey: string;
  customerPubkey: string;
  billingPeriod: string;
  sequence?: number;
  requestCode: string;
  invoice: string;
  amountSats: number;
  description?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface SubscriptionPaymentSentPayload {
  subscriptionId: string;
  merchantPubkey: string;
  customerPubkey: string;
  billingPeriod: string;
  invoice: string;
  amountSats: number;
  paymentHash?: string;
  preimage?: string;
  paidAt: string;
}

export interface SubscriptionPaymentFailedPayload {
  subscriptionId: string;
  merchantPubkey: string;
  customerPubkey: string;
  billingPeriod: string;
  invoice?: string;
  amountSats?: number;
  failedAt: string;
  code: string;
  message: string;
}

export interface SubscriptionLifecyclePayload {
  subscriptionId: string;
  merchantPubkey: string;
  customerPubkey: string;
  reason?: string;
  createdAt: string;
}

export interface SubscriptionAckPayload {
  messageId: string;
  receivedEventId?: string;
  subscriptionId?: string;
  receivedAt: string;
}

export interface PendingSubscriptionInvoiceRequest {
  subscriptionId: string;
  merchantPubkey: string;
  customerPubkey: string;
  billingPeriod: string;
  requestCode: string;
  amountSatsExpected: number;
  expiresAt: string;
  sequence?: number;
  consumed?: boolean;
}

export interface ValidateSubscriptionInvoiceResponseParams {
  response: SubscriptionInvoiceResponsePayload;
  pendingRequest: PendingSubscriptionInvoiceRequest;
  now?: Date;
}

export interface SubscriptionInvoiceValidationResult {
  ok: boolean;
  errors: string[];
}
