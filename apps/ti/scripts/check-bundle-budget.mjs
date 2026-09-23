import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve("dist/index.html"), "utf8");
const scriptMatch = html.match(/<script[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/);
const styleMatch = html.match(/<link[^>]+href="([^"]*\/assets\/index-[^"]+\.css)"/);

if (!scriptMatch || !styleMatch) {
  throw new Error("BUNDLE_ENTRY_NOT_FOUND");
}

const size = (asset) =>
  gzipSync(readFileSync(resolve("dist", asset.replace(/^\//, "")))).byteLength;

const js = size(scriptMatch[1]);
const css = size(styleMatch[1]);
const jsLimit = 150 * 1024;
const cssLimit = 8 * 1024;

console.log(`TI JS gzip: ${(js / 1024).toFixed(2)} KiB / 150 KiB`);
console.log(`TI CSS gzip: ${(css / 1024).toFixed(2)} KiB / 8 KiB`);

if (js > jsLimit || css > cssLimit) {
  process.exitCode = 1;
}
