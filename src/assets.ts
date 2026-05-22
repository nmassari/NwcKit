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

export function btcMainnetOnchain(): SwapAsset {
  return { ...BTC_MAINNET_ONCHAIN };
}

export function btcMainnetLightning(): SwapAsset {
  return { ...BTC_MAINNET_LIGHTNING };
}
