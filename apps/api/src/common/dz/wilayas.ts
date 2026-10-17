/**
 * Backwards-compatible wilaya helpers. The authoritative data now lives in
 * `./locations.ts` (69 wilayas + 1541 communes, 2026 division); these re-exports
 * keep existing imports (`WILAYAS`, `isWilayaCode`, `getWilaya`) working.
 */
export { WILAYAS, isWilayaCode, getWilaya, findWilaya, type WilayaRef } from "./locations"
