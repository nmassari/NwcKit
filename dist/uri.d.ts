import type { BuildNwcUriParams, NwcClientIdentity, NwcConnection } from "./types.js";
export declare function generateNwcClientIdentity(): NwcClientIdentity;
export declare function buildNwcUri(params: BuildNwcUriParams): string;
export declare function parseNwcUri(uri: string): NwcConnection;
export declare function isNwcUri(value: string): boolean;
