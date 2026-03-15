# 📦 Asset Library (SvelteKit)

A simple **self-hosted asset library** for your 🎮 game development needs, available as a simple selfhostable docker container:

- ⬆️ Uploading assets:
  - 🔊 audio
  - 🖼️ textures
  - ✨ shaders
  - 📜 scripts
  - 🧊 3D models
- 🗂️ Storing metadata:
  - 🏷️ title
  - 🔖 tags
  - 📅 upload date
  - 📝 description
  - ⚖️ license
  - 🔗 source
- 👀 Asset previews for 3D models, audio and text/code
- 🤖 AI integration, which automatically tags/describes imported files (audio, textures, shaders, scripts)
- ⬇️ Downloading / 🔁 Replacing assets
- 🔎 Strong filtering and searching functionalities
  - 🏷️ Filtering by tag, type, ...
  - ↕️ Many sorting options
  - 🧠 Fuzzy search using Fuse.js

- 🧬 File deduplication using hashes
- 📁 Built-in SQLite metadata storage (no external database needed)

🚧 Currently not available

- 🔐 User accounts / permissions

# 🚀 Quick Start

The recommended way to run the app is using **Docker Compose**. Just copy the following into a `docker-compose.yml` file in your project root:

```yaml
services:
  asset-library:
    image: ghcr.io/kellojo/asset-library:latest
    environment:
      - ORIGIN=http://localhost:3000 # Adjust if using a domain or reverse proxy
      - PUBLIC_UPLOAD_PARALLELISM=4 # Number of files uploaded in parallel from the UI (default: 4)
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

Then run:

```bash
docker-compose up -d
```

The app will be available on port 3000, ready to accept your uploads!

`BODY_SIZE_LIMIT` controls the maximum upload/request size for the app. The default is set to 1GB, which should be sufficient for most assets. You can adjust this via an environment variable if you need to allow larger or smaller uploads. To do so set the `BODY_SIZE_LIMIT` environment variable in your `docker-compose.yml`.

`PUBLIC_UPLOAD_PARALLELISM` controls how many files are uploaded in parallel by the UI upload queue. The default is `4` (parallel uploads). Set it to a higher value to process multiple files at once.

Please run this behind a reverse proxy and do not expose this directly on the internet without proper authentication!

In case you obsere failing requests when uploading large files, make sure that your reverse proxy allows uploading files of that size.

# 🗄️ Storage Layout

At runtime the app creates a `data/` directory in the project root:

- 📄 `data/assets.db`: SQLite metadata database
- 📂 `data/uploads/`: uploaded files

This keeps setup **very small and easy to back up**.

If a legacy `data/assets.json` exists, it is automatically migrated into SQLite on first startup.

# ✨ AI Metadata Generation

You can connect **AI metadata generation** from the UI:

1. Open the app and click `AI` in the top bar
2. Enable auto-tagging
3. Set base URL (default `http://127.0.0.1:1234`)
4. Set the model name loaded by your AI endpoint
5. Save

The app sends upload metadata to your AI endpoint using the **OpenAI-compatible API**:

- `POST /v1/chat/completions`

For best results choose an AI model that supports image and audio inputs, so that it can analyze the content of your assets and generate relevant tags and descriptions. Additionally, thinking models with good reasoning capabilities can provide more accurate and detailed metadata.

Models that have been tried:

- qwen/qwen3.5-9b
- mistralai/devstral-small-2-2512

### ⚙️ Configure via `.env`

You can configure **AI metadata** via `.env` instead of the UI.

### Supported variables

- `AI_ENABLED` (`true` / `false`)
- `AI_BASE_URL` (e.g. `http://127.0.0.1:1234`)
- `AI_MODEL` (loaded model name)
- `AI_API_KEY` (optional 🔑)
- `AI_TIMEOUT_MS` (e.g. `12000`)
- `AI_TEMPERATURE` (e.g. `0.2`, range `0` to `2`)
- `AI_DISABLE_THINKING` (`true` / `false`, forces `reasoningEffort=none`)
- `AI_REASONING_EFFORT` (`none` | `minimal` | `low` | `medium` | `high` | `xhigh`)
- `AI_CUSTOM_INSTRUCTION` (optional prompt addition ✏️)

# Contributing

Contributions are very welcome! Just fork the repo and open a PR with your changes.
This can be anything from bug fixes, new features, or even just improving documentation.

Roadmap:

- Bulk actions (tagging, deleting, downloading)
- Metadata generation for 3D models
- Add support for more file types (e.g. video, fonts, ...)
- User accounts and permissions
- Improved infinite scrolling/padination for large libraries
- Better responsiveness for mobile devices

## 🛠️ Development

```bash
npm install
npm run dev
```

Then open: `http://localhost:5173`
