// Lazy keccak256 for the browser.
//
// `keccak256(utf8(text))` is the same fingerprint the server commits on-chain
// (see `hashText` in lib/receipts). It is only ever needed once someone opens
// a receipt and plays with the tamper demo — but importing `ethers` at module
// scope put the whole library into the /chat/[id] bundle, which every message
// view paid for on first load. Loading it on demand keeps it off that path.
//
// The module cache makes the dynamic import a no-op after the first call, so
// the hash stays synchronous once resolved and typing in the demo is instant.
type HashText = (text: string) => string;

let cached: HashText | null = null;

export async function loadHashText(): Promise<HashText> {
  if (!cached) {
    const { keccak256, toUtf8Bytes } = await import("ethers");
    cached = (text: string) => keccak256(toUtf8Bytes(text));
  }
  return cached;
}
