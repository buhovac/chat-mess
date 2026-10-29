// Identifies a file from its first bytes ("magic numbers") instead of
// trusting the Content-Type the browser declared — that header is just a
// string the client chose, so a renamed .exe could claim to be image/png.
// Only the 5 whitelisted formats are recognized; anything else -> null.

const startsWith = (buffer, bytes, offset = 0) =>
  buffer.length >= offset + bytes.length && bytes.every((byte, i) => buffer[offset + i] === byte);

const ascii = (text) => [...text].map((char) => char.charCodeAt(0));

const SIGNATURES = [
  { type: "image/png", ext: "png", matches: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { type: "image/jpeg", ext: "jpg", matches: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  { type: "image/gif", ext: "gif", matches: (b) => startsWith(b, ascii("GIF87a")) || startsWith(b, ascii("GIF89a")) },
  // WEBP is a RIFF container: "RIFF" + 4-byte size + "WEBP".
  { type: "image/webp", ext: "webp", matches: (b) => startsWith(b, ascii("RIFF")) && startsWith(b, ascii("WEBP"), 8) },
  { type: "application/pdf", ext: "pdf", matches: (b) => startsWith(b, ascii("%PDF-")) },
];

export const ALLOWED_TYPES = SIGNATURES.map((signature) => signature.type);

export function detectFileType(buffer) {
  const signature = SIGNATURES.find((candidate) => candidate.matches(buffer));
  return signature ? { type: signature.type, ext: signature.ext } : null;
}
