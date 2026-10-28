import { describe, it, expect } from "vitest";
import { detectFileType } from "./fileSignature.js";

describe("detectFileType", () => {
  it.each([
    ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]],
    ["image/jpeg", [0xff, 0xd8, 0xff, 0xe0]],
    ["image/gif", Buffer.from("GIF89a....")],
    ["image/webp", Buffer.from("RIFF\x00\x00\x00\x00WEBPVP8 ")],
    ["application/pdf", Buffer.from("%PDF-1.7")],
  ])("recognizes %s", (type, bytes) => {
    expect(detectFileType(Buffer.from(bytes))?.type).toBe(type);
  });

  it.each([
    ["an executable", Buffer.from("MZ\x90\x00")],
    ["plain text", Buffer.from("hello world")],
    ["a RIFF file that isn't WEBP (e.g. WAV)", Buffer.from("RIFF\x00\x00\x00\x00WAVEfmt ")],
    ["an empty file", Buffer.alloc(0)],
  ])("rejects %s", (_label, bytes) => {
    expect(detectFileType(bytes)).toBeNull();
  });
});
