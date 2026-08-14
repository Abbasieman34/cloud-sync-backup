#!/usr/bin/env node
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, watch } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";

const args = process.argv.slice(2);
const command = args[0] ?? "once";
const configIndex = args.indexOf("--config");
const configPath = configIndex >= 0 ? args[configIndex + 1] : "vaultline-companion.json";
const versionIndex = args.indexOf("--version");

function printUsage() {
  console.log("Usage: node sync.mjs <configure|once|watch|restore> --config <config-file> [--pairing <pairing-file>] [--folder <local-folder>] [--version <version-id>]");
}

function argumentValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function configureFolder() {
  const pairingPath = argumentValue("--pairing");
  if (!pairingPath) throw new Error("Configuration requires --pairing <pairing-file> from the web application.");
  const pairing = JSON.parse(await readFile(pairingPath, "utf8"));
  for (const field of ["endpointBaseUrl", "deviceToken", "encryptionKey"]) {
    if (!pairing[field]) throw new Error(`The pairing file is missing ${field}.`);
  }
  let folderPath = argumentValue("--folder");
  if (!folderPath) {
    if (!process.stdin.isTTY) throw new Error("Provide --folder <local-folder> when configuring without an interactive terminal.");
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    folderPath = (await prompt.question("Local folder to synchronize: ")).trim();
    prompt.close();
  }
  const folderInfo = await stat(folderPath);
  if (!folderInfo.isDirectory()) throw new Error("The selected local folder is not a directory.");
  const outputPath = argumentValue("--output") ?? configPath;
  await writeFile(outputPath, JSON.stringify({ endpointBaseUrl: pairing.endpointBaseUrl, deviceToken: pairing.deviceToken, encryptionKey: pairing.encryptionKey, folderPath: path.resolve(folderPath) }, null, 2), { encoding: "utf8", mode: 0o600 });
  console.log(`Companion configuration saved to ${outputPath}.`);
}

async function loadConfig() {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  for (const field of ["endpointBaseUrl", "deviceToken", "encryptionKey", "folderPath"]) {
    if (!config[field]) throw new Error(`Companion configuration is missing ${field}.`);
  }
  if (!existsSync(config.folderPath)) throw new Error(`The configured folder does not exist: ${config.folderPath}`);
  return { ...config, endpointBaseUrl: config.endpointBaseUrl.replace(/\/$/, "") };
}

function shouldSkip(relativePath) {
  return relativePath.split(path.sep).some(part => part.startsWith(".") || part === "node_modules");
}

async function listFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    const relativePath = path.relative(root, absolutePath);
    if (shouldSkip(relativePath)) continue;
    if (entry.isDirectory()) results.push(...await listFiles(root, absolutePath));
    else if (entry.isFile()) results.push(absolutePath);
  }
  return results;
}

function mimeType(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  return ({ ".txt": "text/plain", ".md": "text/markdown", ".json": "application/json", ".csv": "text/csv", ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" })[extension] ?? "application/octet-stream";
}

function encrypt(data, base64Key) {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(base64Key, "base64"), initializationVector);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  return { ciphertextBase64: ciphertext.toString("base64"), initializationVector: initializationVector.toString("base64"), authenticationTag: cipher.getAuthTag().toString("base64") };
}

function decrypt(payload, base64Key) {
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(base64Key, "base64"), Buffer.from(payload.initializationVector, "base64"));
  decipher.setAuthTag(Buffer.from(payload.authenticationTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(payload.ciphertextBase64, "base64")), decipher.final()]);
}

async function post(config, route, body) {
  const response = await fetch(`${config.endpointBaseUrl}${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deviceToken: config.deviceToken, ...body }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Remote companion request failed (${response.status}).`);
  return payload;
}

async function syncFile(config, absolutePath) {
  const relativePath = path.relative(config.folderPath, absolutePath);
  if (!relativePath || shouldSkip(relativePath)) return;
  const info = await stat(absolutePath);
  if (!info.isFile()) return;
  const data = await readFile(absolutePath);
  const checksum = createHash("sha256").update(data).digest("hex");
  const encrypted = encrypt(data, config.encryptionKey);
  const result = await post(config, "/api/companion/sync", { fileName: path.basename(absolutePath), logicalPath: relativePath.split(path.sep).join("/"), mimeType: mimeType(absolutePath), plaintextByteSize: data.byteLength, checksum, ...encrypted });
  console.log(`${result.changed ? "Synced" : "Current"}: ${relativePath}`);
}

async function syncAll(config) {
  const files = await listFiles(config.folderPath);
  for (const file of files) await syncFile(config, file);
}

async function restore(config, versionId) {
  const payload = await post(config, "/api/companion/download", { versionId });
  const outputPath = path.join(config.folderPath, payload.logicalPath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, decrypt(payload, config.encryptionKey));
  console.log(`Restored: ${payload.logicalPath}`);
}

async function watchFolder(config) {
  await syncAll(config);
  const pending = new Map();
  const watcher = watch(config.folderPath, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const absolutePath = path.join(config.folderPath, filename.toString());
    if (shouldSkip(filename.toString())) return;
    const existing = pending.get(absolutePath);
    if (existing) clearTimeout(existing);
    pending.set(absolutePath, setTimeout(async () => {
      pending.delete(absolutePath);
      try { if (existsSync(absolutePath)) await syncFile(config, absolutePath); }
      catch (error) { console.error(`Sync error for ${filename}:`, error.message); }
    }, 600));
  });
  console.log(`Watching ${config.folderPath}. Press Ctrl+C to stop.`);
  process.on("SIGINT", () => { watcher.close(); process.exit(0); });
}

try {
  if (!["configure", "once", "watch", "restore"].includes(command)) { printUsage(); process.exit(1); }
  if (command === "configure") { await configureFolder(); process.exit(0); }
  const config = await loadConfig();
  if (command === "once") await syncAll(config);
  if (command === "watch") await watchFolder(config);
  if (command === "restore") { const versionId = Number(args[versionIndex + 1]); if (!Number.isInteger(versionId) || versionId <= 0) throw new Error("Restore requires a positive --version value."); await restore(config, versionId); }
} catch (error) {
  console.error("Vaultline companion error:", error.message);
  process.exit(1);
}
