import type { SwapAsset } from "./types.js";

export const BTC_MAINNET_ONCHAIN: SwapAsset = Object.freeze({
  asset: "BTC",
  chain: "bitcoin",
  network: "mainnet",
  rail: "onchain",
});

export const BTC_MAINNET_LIGHTNING: SwapAsset = Object.freeze({
  asset: "BTC",
  chain: "bitcoin",
  network: "mainnet",
  rail: "lightning",
});

export const USDT_MAINNET_TAPROOT: SwapAsset = Object.freeze({
  asset: "USDT",
  chain: "bitcoin",
  network: "mainnet",
  rail: "taproot-assets",
});

export const USDT_MAINNET_LIGHTNING: SwapAsset = Object.freeze({
  asset: "USDT",
  chain: "bitcoin",
  network: "mainnet",
  rail: "taproot-assets-lightning",
});

export function btcMainnetOnchain(): SwapAsset {
  return { ...BTC_MAINNET_ONCHAIN };
}

export function btcMainnetLightning(): SwapAsset {
  return { ...BTC_MAINNET_LIGHTNING };
}

export function usdtMainnetTaproot(): SwapAsset {
  return { ...USDT_MAINNET_TAPROOT };
}

export function usdtMainnetLightning(): SwapAsset {
  return { ...USDT_MAINNET_LIGHTNING };
}
