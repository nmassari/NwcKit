import { type Event } from "nostr-tools";
import { type EcsAppMessage, type EcsAppMessageOptions, type SendEcsAppMessageParams, type SubscriptionInvoiceValidationResult, type ValidateSubscriptionInvoiceResponseParams } from "./types.js";
type MessageHandler = (message: EcsAppMessage) => void | Promise<void>;
type ErrorHandler = (error: unknown, event?: Event) => void | Promise<void>;
export declare class NostrPaymentMessages {
    private readonly privateKey;
    private readonly publicKey;
    private readonly relays;
    private readonly timeoutMs;
    private readonly debug;
    private readonly pool;
    private readonly messageHandlers;
    private readonly errorHandlers;
    private readonly seenEventIds;
    private subscription;
    constructor(options: EcsAppMessageOptions);
    get pubkey(): string;
    subscribe(): void;
    close(): void;
    onMessage(handler: MessageHandler): () => void;
    onError(handler: ErrorHandler): () => void;
    send<TPayload>(params: SendEcsAppMessageParams<TPayload>): Promise<Event>;
    private handleEvent;
    private log;
}
export declare function generateInvoiceRequestCode(byteLength?: number): string;
export declare function validateSubscriptionInvoiceResponse(params: ValidateSubscriptionInvoiceResponseParams): SubscriptionInvoiceValidationResult;
export {};
