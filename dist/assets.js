export const BTC_MAINNET_ONCHAIN = Object.freeze({
    asset: "BTC",
    chain: "bitcoin",
    network: "mainnet",
    rail: "onchain",
});
export const BTC_MAINNET_LIGHTNING = Object.freeze({
    asset: "BTC",
    chain: "bitcoin",
    network: "mainnet",
    rail: "lightning",
});
export const USDT_MAINNET_TAPROOT = Object.freeze({
    asset: "USDT",
    chain: "bitcoin",
    network: "mainnet",
    rail: "taproot-assets",
});
export const USDT_MAINNET_LIGHTNING = Object.freeze({
    asset: "USDT",
    chain: "bitcoin",
    network: "mainnet",
    rail: "taproot-assets-lightning",
});
export function btcMainnetOnchain() {
    return { ...BTC_MAINNET_ONCHAIN };
}
export function btcMainnetLightning() {
    return { ...BTC_MAINNET_LIGHTNING };
}
export function usdtMainnetTaproot() {
    return { ...USDT_MAINNET_TAPROOT };
}
export function usdtMainnetLightning() {
    return { ...USDT_MAINNET_LIGHTNING };
}
