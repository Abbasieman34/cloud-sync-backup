# Vaultline Local Companion

The local companion watches one selected folder, encrypts file content with its device-specific AES-256-GCM key before network transfer, and sends only ciphertext plus integrity metadata to the Vaultline web platform.

Create a paired device from **Local sync** in the web application. Copy the displayed JSON to a file named `vaultline-pairing.json` on the local machine. The pairing file deliberately does not select a folder; run the configuration command to choose one with an interactive prompt.

```bash
node sync.mjs configure \
  --pairing /path/to/vaultline-pairing.json \
  --config /path/to/vaultline-companion.json
```

For scripting or unattended setup, select the local folder explicitly with `--folder`.

```bash
node sync.mjs configure \
  --pairing /path/to/vaultline-pairing.json \
  --folder /path/to/your/folder \
  --config /path/to/vaultline-companion.json
```

Once configured, run a single synchronization pass with the following command.

```bash
node sync.mjs once --config /path/to/vaultline-companion.json
```

To keep the folder synchronized while the local machine is running, use the watch mode.

```bash
node sync.mjs watch --config /path/to/vaultline-companion.json
```

The companion supports restoration of a client-encrypted version by version ID.

```bash
node sync.mjs restore --config /path/to/vaultline-companion.json --version 123
```

The pairing and companion configuration files contain the device token and client encryption key. Treat them as passwords: keep them only on the paired local machine and revoke the device from the web application if the machine is lost.
