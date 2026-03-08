# 📦 Asset Library (SvelteKit)

A simple **self-hosted asset library** for your 🎮 game development needs, available as a simple selfhostable docker container:

- ⬆️ Uploading assets: 🔊 audio, 🖼️ textures, ✨ shaders, 📜 scripts, and 🧊 3D models
- 🗂️ Storing metadata: 🏷️ title, 🔖 tags, 📅 upload date, 📝 description, ⚖️ license, 🔗 source
- 👀 Asset previews for 🧊 3D models, 🔊 audio and 📄 text/code
- 🤖 AI integration, which automatically 🏷️ tags/describes imported files (audio, textures, shaders, scripts)
- ⬇️ Downloading / 🔁 Replacing assets
- 🔎 Strong filtering and searching functionalities
  - 🏷️ Filtering by tag, type, ...
  - ↕️ Many sorting options
  - 🧠 Fuzzy search using Fuse.js

- 🧬 File deduplication using hashes
- 📁 File-based storage (no external database needed)

🚧 Currently not available

- 🔐 User accounts / permissions

# 🚀 Quick Start

The recommended way to run the app is using **Docker Compose**. Just copy the following into a `docker-compose.yml` file in your project root:

```yaml
services:
  asset-library:
    image: ghcr.io/kellojo/asset-library:latest
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

Please run this behind a reverse proxy and do not expose this directly on the internet without proper authentication!

# 🗄️ Storage Layout

At runtime the app creates a `data/` directory in the project root:

- 📄 `data/assets.json`: metadata database
- 📂 `data/uploads/`: uploaded files

This keeps setup **very small and easy to back up**.

# ✨ AI Auto Metadata

You can connect **AI metadata generation** from the UI:

1. Open the app and click `AI` in the top bar
2. Enable auto-tagging
3. Set base URL (default `http://127.0.0.1:1234`)
4. Set the model name loaded by your AI endpoint
5. Save

The app sends upload metadata to your AI endpoint using the **OpenAI-compatible API**:

- `POST /v1/chat/completions`

For best results choose an AI model that supports image inputs so it can analyze file previews.

### ⚙️ Behavior

- 🏷️ Auto-generated tags are **merged with existing tags**
- ⚠️ If the AI endpoint is unavailable or times out, upload **still succeeds** with existing tags

### ⚙️ Configure via `.env`

You can configure **AI metadata** via `.env` instead of the UI.

### Supported variables

- `AI_ENABLED` (`true` / `false`)
- `AI_BASE_URL` (e.g. `http://127.0.0.1:1234`)
- `AI_MODEL` (loaded model name)
- `AI_API_KEY` (optional 🔑)
- `AI_TIMEOUT_MS` (e.g. `12000`)
- `AI_CUSTOM_INSTRUCTION` (optional prompt addition ✏️)


# Contributing
Contributions are very welcome! Just fork the repo and open a PR with your changes.
This can be anything from bug fixes, new features, or even just improving documentation.

## 🛠️ Development

```bash
npm install
npm run dev
```

Then open: `http://localhost:5173`