# Vaultline

Vaultline is a local-first encrypted backup workspace. This repository includes a GitHub Pages-compatible static demo in [`docs/`](./docs/).

## GitHub Pages demo

The static app runs without a server, database, build step, or environment secrets. It is designed for GitHub Pages and stores demo metadata only in the visitor's browser `localStorage`.

Once GitHub Pages is enabled for this repository, open:

**https://abbasieman34.github.io/cloud-sync-backup/**

To publish it from this repository, open **Settings → Pages**, choose **Deploy from a branch**, select the branch containing this project, and select the `/docs` folder. GitHub will then serve the static app at the URL above. No build step or environment secrets are required.

### Run the demo locally

```bash
python3 -m http.server 4173 --directory docs
```

Then open <http://localhost:4173>.

## Privacy and scope

This GitHub Pages version is a static browser demo. It provides local interactions for protecting file metadata, creating schedules, pairing a local companion, and viewing an audit trail. It does **not** upload files to a cloud service or replace the full-stack server, database, authentication, and object-storage implementation elsewhere in this repository.

The local companion documentation is in [`companion-client/README.md`](./companion-client/README.md).
