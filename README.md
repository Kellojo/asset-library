# 📦 Asset Library (SvelteKit)

A simple **self-hosted asset library** for your 🎮 game development needs, available as a simple selfhostable docker container:

- ⬆️ Uploading assets: 🔊 audio, 🖼️ textures, ✨ shaders, 📜 scripts, and 🧊 3D models
- 🗂️ Storing metadata: 🏷️ title, 🔖 tags, 📅 upload date, 📝 description, ⚖️ license, 🔗 source
- 👀 Asset previews for 🧊 3D models, 🔊 audio and 📄 text/code
- 🤖 AI integration, which automatically 🏷️ tags/describes imported files
- ⬇️ Downloading / 🔁 Replacing assets
- 🔎 Strong filtering and searching functionalities
  - 🏷️ Filtering by tag, type, ...
  - ↕️ Many sorting options
  - 🧠 Fuzzy search using Fuse.js

- 🧬 File deduplication using hashes
- 📁 File-based storage (no external database needed)

---

## 🚧 Currently not available

- 👤 User accounts / 🔐 permissions

---

# 🗄️ Storage Layout

At runtime the app creates a `data/` directory in the project root:

- 📄 `data/assets.json`: metadata database
- 📂 `data/uploads/`: uploaded files

✨ This keeps setup **very small and easy to back up**.

---

# 🤖 AI Auto Metadata

You can connect **AI metadata generation** from the UI:

1. 🚀 Open the app and click `AI` in the top bar
2. 🏷️ Enable auto-tagging
3. 🌐 Set base URL (default `http://127.0.0.1:1234`)
4. 🧠 Set the model name loaded by your AI endpoint
5. 💾 Save

The app sends upload metadata to your AI endpoint using the **OpenAI-compatible API**:

- `POST /v1/chat/completions`

### ⚙️ Behavior

- 🏷️ Auto-generated tags are **merged with existing tags**
- ⚠️ If the AI endpoint is unavailable or times out, upload **still succeeds** with existing tags

---

# ⚙️ Configure via `.env`

You can configure **AI metadata** via `.env` instead of the UI.

### Supported variables

- `AI_ENABLED` (`true` / `false`)
- `AI_BASE_URL` (e.g. `http://127.0.0.1:1234`)
- `AI_MODEL` (loaded model name)
- `AI_API_KEY` (optional 🔑)
- `AI_TIMEOUT_MS` (e.g. `12000`)
- `AI_CUSTOM_INSTRUCTION` (optional prompt addition ✏️)

### 📝 Notes

- 📋 Copy `.env.example` to `.env` and fill values
- 🔁 When `AI_*` env vars are present, they **override UI-saved settings** in `data/ai-config.json`

---

# 🛠️ Development

```bash
npm install
npm run dev
```

Then open:

🌐 `http://localhost:5173`

---

If you want, I can also make a **“GitHub-optimized emoji style”** (used by big repos) which is **cleaner and more consistent** with section icons like 📦 ⚙️ 🧠 🗄️.
