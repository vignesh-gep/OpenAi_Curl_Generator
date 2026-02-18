# ⚡ LLM Curl Generator

A web tool to convert **KeyStudio format** to **OpenAI Chat Completion API** curl commands.

![LLM Curl Generator](https://img.shields.io/badge/OpenAI-API-green?style=for-the-badge)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge)

## 🚀 Features

- **Convert KeyStudio Tools** → OpenAI function format
- **Convert Messages** → Handle array/string content formats
- **Generate Curl Commands** → Ready to copy and use
- **Generate PowerShell Commands** → For Windows users
- **Real-time JSON Validation** → Instant feedback
- **Dark Professional Theme** → Easy on the eyes

## 📋 What It Does

### Tool Conversion
Converts KeyStudio tool format:
```json
{
  "type": "tool",
  "config": { "schema": {...} },
  "alias": "function_name"
}
```

To OpenAI format:
```json
{
  "type": "function",
  "function": {
    "name": "function_name",
    "parameters": {...}
  }
}
```

### Message Conversion
Converts KeyStudio message format:
```json
{
  "content": [{ "type": "text", "text": "..." }],
  "role": "system"
}
```

To OpenAI format:
```json
{
  "role": "system",
  "content": "..."
}
```

## 🛠️ Usage

1. **Paste Tools** - JSON array from KeyStudio
2. **Paste Messages** - Conversation history
3. **Configure** - API endpoint, key, temperature
4. **Generate** - Click to create curl command
5. **Copy** - Use the generated command

## 🏃 Run Locally

```bash
# Clone the repo
git clone https://github.com/vigneshpatel14/LLM-Curl-Generator.git

# Open in browser
open index.html

# Or serve with Node.js
npx serve .
```

## 📁 Project Structure

```
curl-generator/
├── index.html          # Main web page
├── styles.css          # Dark theme styling
├── script.js           # Conversion & generation logic
├── test-generator.js   # Node.js test script
├── vercel.json         # Vercel deployment config
└── package.json        # Project metadata
```

## 🔧 Configuration Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| Temperature | 0.1 | Controls randomness (0-2) |
| Top P | 0.1 | Nucleus sampling (0-1) |
| Tool Choice | auto | auto, none, required |

## 🌐 Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/vigneshpatel14/LLM-Curl-Generator)

## 📝 License

MIT License - Built for GEP KeyStudio

---

Made by Vignesh

