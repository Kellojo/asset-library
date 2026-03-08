# Asset Library (SvelteKit)

A simple self-hosted asset library for:

- Uploading assets: audio, textures, shaders, scripts, and 3D models
- Storing metadata: title, tags, and upload date
- Downloading assets
- Inline previews where possible:
- Audio: built-in audio player
- Textures: image preview
- 3D models: `.glb` and `.gltf` preview
- Scripts/Shaders/Text-like files: text preview

## Stack

- SvelteKit
- Node adapter (`@sveltejs/adapter-node`)
- File-based storage (no external database)

## Storage Layout

At runtime the app creates a `data/` directory in the project root:

- `data/assets.json`: metadata database
- `data/uploads/`: uploaded files

This keeps setup very small and easy to back up.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Production (Self-Hosted)

```bash
npm install
npm run build
npm run start
```

By default it listens on port `3000`. You can override:

```bash
set PORT=8080
npm run start
```

On Linux/macOS use:

```bash
PORT=8080 npm run start
```

## Reverse Proxy (Optional)

Run behind Nginx/Caddy/Traefik for TLS and domain routing. The app itself is just a Node process.

## Notes

- Upload size is limited by your hosting and proxy settings.
- `model-viewer` previews are available for `.glb` and `.gltf` files.
- Other model formats are stored/downloadable but may not have an inline 3D preview.

## LM Studio Auto-Tagging

You can connect LM Studio from the UI:

1. Open the app and click `LM Studio` in the top bar.
2. Enable auto-tagging.
3. Set base URL (default `http://127.0.0.1:1234`).
4. Set the model name loaded in LM Studio.
5. Save.

The app sends upload metadata to LM Studio using the OpenAI-compatible endpoint:

- `POST /v1/chat/completions`

Behavior:

- Auto-generated tags are merged with existing tags.
- If LM Studio is unavailable or times out, upload still succeeds with existing tags.

### Configure via .env

You can configure LM Studio via `.env` instead of the UI.

Supported variables:

- `LMSTUDIO_ENABLED` (`true`/`false`)
- `LMSTUDIO_BASE_URL` (e.g. `http://127.0.0.1:1234`)
- `LMSTUDIO_MODEL` (loaded model name)
- `LMSTUDIO_API_KEY` (optional)
- `LMSTUDIO_TIMEOUT_MS` (e.g. `12000`)

Notes:

- Copy `.env.example` to `.env` and fill values.
- When `LMSTUDIO_*` env vars are present, they override UI-saved settings in `data/lmstudio.json`.

## Maintenance

- Back up `data/` regularly.
- To move the library to another server, copy the project and `data/` folder.
