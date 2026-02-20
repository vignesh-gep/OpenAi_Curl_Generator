# QiStuidioCurl Chrome Extension

Chrome extension to speed up your current workflow:

1. Capture `tools` array from Qi Studio canvas page.
2. Capture conversation/messages array from Langfuse trace page.
3. Open your Curl Generator and auto-prefill `Tools Definition` + `Conversation History`.

## Folder Contents

- `manifest.json` - MV3 extension manifest
- `popup.html` - command UI
- `popup.css` - popup styling
- `popup.js` - capture, storage, and prefill logic

## Install (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `QiStuidioCurl`.

## Usage

1. Open Qi Studio tab (agent canvas) and click:
   - **Capture Tools (Current Tab)**
2. Open Langfuse tab (trace/conversation) and click:
   - **Capture Conversation (Current Tab)**
3. In the extension popup, set **Generator URL** (saved automatically).
4. Click:
   - **Open Generator & Prefill**
5. In generator page, click your existing **Generate** button.

## Notes

- If automatic extraction fails, select JSON text on page and click capture again.
- Captured data is stored locally in `chrome.storage.local`.
- The extension does not call external APIs.

## Architecture

- **Popup-first command model**: user triggers explicit commands from popup.
- **DOM extraction via `chrome.scripting.executeScript`**: no persistent content script required.
- **Heuristic parser**:
  - searches selected text, page text, textareas, and script tags
  - extracts JSON arrays by keys:
    - tools mode: `"tools"`
    - conversation mode: `"messages"`, `"conversation"`, `"threadMessages"`, `"thread.messages"`
- **Prefill injector**:
  - opens target generator URL
  - waits for page load
  - sets `#toolsInput` and `#messagesInput`
  - dispatches `input` events so existing validation logic runs

