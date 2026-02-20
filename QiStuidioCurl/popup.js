const KEYS = {
  tools: "qis_tools_json",
  messages: "qis_messages_json",
  generatorUrl: "qis_generator_url"
};

const DEFAULT_GENERATOR_URL = "https://openai-curl-generator.vercel.app/";

const generatorUrlEl = document.getElementById("generatorUrl");
const toolsStatusEl = document.getElementById("toolsStatus");
const messagesStatusEl = document.getElementById("messagesStatus");
const flashEl = document.getElementById("flash");
const previewToolsBtn = document.getElementById("previewToolsBtn");
const previewMessagesBtn = document.getElementById("previewMessagesBtn");
const previewModal = document.getElementById("previewModal");
const previewTitle = document.getElementById("previewTitle");
const previewContent = document.getElementById("previewContent");
const closeModalBtn = document.getElementById("closeModalBtn");
const copyPreviewBtn = document.getElementById("copyPreviewBtn");

// Paste modal elements
const pasteToolsBtn = document.getElementById("pasteToolsBtn");
const pasteMessagesBtn = document.getElementById("pasteMessagesBtn");
const pasteModal = document.getElementById("pasteModal");
const pasteTitle = document.getElementById("pasteTitle");
const pasteTextarea = document.getElementById("pasteTextarea");
const closePasteModalBtn = document.getElementById("closePasteModalBtn");
const savePasteBtn = document.getElementById("savePasteBtn");
let currentPasteMode = null;

document.getElementById("captureToolsBtn").addEventListener("click", () => captureFromCurrentTab("tools"));
document.getElementById("captureMessagesBtn").addEventListener("click", () => captureFromCurrentTab("messages"));
document.getElementById("openPrefillBtn").addEventListener("click", openGeneratorAndPrefill);
document.getElementById("clearBtn").addEventListener("click", clearCache);
generatorUrlEl.addEventListener("change", persistGeneratorUrl);
previewToolsBtn.addEventListener("click", () => showPreview("tools"));
previewMessagesBtn.addEventListener("click", () => showPreview("messages"));
closeModalBtn.addEventListener("click", hidePreview);
copyPreviewBtn.addEventListener("click", copyPreviewToClipboard);
previewModal.addEventListener("click", (e) => { if (e.target === previewModal) hidePreview(); });

// Paste modal event listeners
pasteToolsBtn.addEventListener("click", () => showPasteModal("tools"));
pasteMessagesBtn.addEventListener("click", () => showPasteModal("messages"));
closePasteModalBtn.addEventListener("click", hidePasteModal);
savePasteBtn.addEventListener("click", savePastedJson);
pasteModal.addEventListener("click", (e) => { if (e.target === pasteModal) hidePasteModal(); });

// Paste from clipboard button
const pasteFromClipboardBtn = document.getElementById("pasteFromClipboardBtn");
pasteFromClipboardBtn.addEventListener("click", async () => {
  try {
    const clipboardText = await navigator.clipboard.readText();
    if (clipboardText && clipboardText.trim()) {
      pasteTextarea.value = clipboardText;
      flash("📋 Pasted from clipboard!", "success");
    } else {
      flash("⚠️ Clipboard is empty", "error");
    }
  } catch (err) {
    flash("❌ Cannot access clipboard. Use Ctrl+V instead.", "error");
  }
});

init();

async function init() {
  const data = await chrome.storage.local.get([
    KEYS.tools,
    KEYS.messages,
    KEYS.generatorUrl
  ]);

  const storedUrl = (data[KEYS.generatorUrl] || "").trim();
  const oldUrls = [
    "http://localhost:5500/curl-generator/index.html",
    "https://llm-curl-generator.vercel.app/",
    "https://llm-curl-generator.vercel.app"
  ];
  const migratedUrl = !storedUrl || oldUrls.includes(storedUrl)
    ? DEFAULT_GENERATOR_URL
    : storedUrl;

  generatorUrlEl.value = migratedUrl;
  await chrome.storage.local.set({ [KEYS.generatorUrl]: migratedUrl });
  updateStatus("tools", data[KEYS.tools]);
  updateStatus("messages", data[KEYS.messages]);
}

async function persistGeneratorUrl() {
  const generatorUrl = normalizeGeneratorUrl(generatorUrlEl.value);
  generatorUrlEl.value = generatorUrl;
  await chrome.storage.local.set({ [KEYS.generatorUrl]: generatorUrl });
  flash("Saved generator URL");
}

async function captureFromCurrentTab(mode) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    flash("No active tab");
    return;
  }

  // Detect Langfuse - auto-capture doesn't work well, open paste modal instead
  const isLangfuse = tab.url && (tab.url.includes("langfuse") || tab.url.includes("cloud.langfuse"));
  if (isLangfuse && mode === "messages") {
    flash("Langfuse detected - opening paste dialog. Copy Input JSON from Langfuse.");
    showPasteModal("messages");
    return;
  }

  let payload = await runCaptureOnce(tab.id, mode);

  // Qi Studio often loads Monaco JSON only after opening/clicking JSON View panel.
  // If first attempt fails on Qi Studio, auto-open JSON View and retry.
  const onQiStudio = typeof tab.url === "string" && tab.url.includes("qistudio.gep.com");
  if ((!payload || !payload.ok) && mode === "tools" && onQiStudio) {
    flash("Trying auto-open JSON View and re-capture...");

    let lastJsonAction = "";
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const openPayload = await runEnsureJsonViewOpen(tab.id);
      if (openPayload && openPayload.action) {
        lastJsonAction = openPayload.action;
      }

      // Give UI/editor time to hydrate model text.
      // Later attempts wait longer because panel/editor can lazy-load.
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 600 + attempt * 450));

      // eslint-disable-next-line no-await-in-loop
      payload = await runCaptureOnce(tab.id, mode);
      if (payload && payload.ok) {
        break;
      }
    }

    if (payload && !payload.ok && lastJsonAction) {
      payload.debug = `${payload.debug || ""}; jsonAction=${lastJsonAction}`;
    }
  }

  if (!payload || !payload.ok) {
    const base = payload && payload.error ? payload.error : "Capture failed";
    const dbg = payload && payload.debug ? ` [debug: ${payload.debug}]` : "";
    flash(`❌ ${base}${dbg}`, "error");
    return;
  }

  if (mode === "tools") {
    await chrome.storage.local.set({ [KEYS.tools]: payload.value });
    updateStatus("tools", payload.value);
    const agentInfo = payload.agentName ? ` "${payload.agentName}"` : "";
    flash(`✓ Captured agent config${agentInfo} (${payload.count} tool${payload.count === 1 ? "" : "s"})`, "success");
  } else {
    await chrome.storage.local.set({ [KEYS.messages]: payload.value });
    updateStatus("messages", payload.value);
    flash(`✓ Captured conversation (${payload.count} message${payload.count === 1 ? "" : "s"})`, "success");
  }
}

async function runCaptureOnce(tabId, mode) {
  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: "MAIN",
      func: extractFromPage,
      args: [mode]
    });
  } catch (err) {
    return {
      ok: false,
      error: `Capture failed: ${err && err.message ? err.message : "script injection error"}`
    };
  }

  // Prefer the first successful frame result.
  for (const r of results || []) {
    if (r && r.result && r.result.ok) {
      return r.result;
    }
  }

  // Fall back to the most informative error/debug payload from frames.
  let best = null;
  for (const r of results || []) {
    if (!r || !r.result) {
      continue;
    }
    if (!best) {
      best = r.result;
      continue;
    }
    const curDebugLen = (r.result.debug || "").length;
    const bestDebugLen = (best.debug || "").length;
    if (curDebugLen > bestDebugLen) {
      best = r.result;
    }
  }

  if (best) {
    const frameCount = Array.isArray(results) ? results.length : 0;
    const extra = `frames=${frameCount}`;
    best.debug = best.debug ? `${best.debug}; ${extra}` : extra;
    return best;
  }

  return {
    ok: false,
    error: "Capture failed: no frame results"
  };
}

async function runEnsureJsonViewOpen(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: "MAIN",
      func: ensureJsonViewOpen
    });

    const actions = (results || [])
      .map((r) => r && r.result && r.result.action)
      .filter(Boolean);

    const clicked = actions.find((a) => a && a !== "json_view_control_not_found");
    return {
      ok: true,
      action: clicked || actions[0] || "json_view_control_not_found"
    };
  } catch (_err) {
    return {
      ok: false,
      action: "json_view_click_injection_failed"
    };
  }
}

function ensureJsonViewOpen() {
  const textMatches = (el, text) => {
    const t = (el && (el.textContent || el.innerText) || "").trim().toLowerCase();
    return t.includes(text.toLowerCase());
  };

  const clickable = Array.from(document.querySelectorAll("button,[role='button'],.tab,.ant-tabs-tab,.chakra-tabs__tab,[aria-label],[title]"));
  const jsonViewBtn = clickable.find((el) => textMatches(el, "json view"));

  if (jsonViewBtn) {
    jsonViewBtn.click();
    return { ok: true, action: "clicked_json_view_button" };
  }

  // Qi Studio has an icon-style toggle "{}" near top controls.
  const bracesBtn = clickable.find((el) => {
    const t = (el.textContent || "").replace(/\s+/g, "");
    return t === "{}" || t.includes("{}");
  });
  if (bracesBtn) {
    bracesBtn.click();
    return { ok: true, action: "clicked_braces_toggle" };
  }

  // Fallback: click any element with aria-label/title containing "JSON"
  const genericJsonEl = Array.from(document.querySelectorAll("[aria-label],[title]"))
    .find((el) => {
      const a = (el.getAttribute("aria-label") || "").toLowerCase();
      const t = (el.getAttribute("title") || "").toLowerCase();
      return a.includes("json") || t.includes("json");
    });

  if (genericJsonEl) {
    genericJsonEl.click();
    return { ok: true, action: "clicked_generic_json_control" };
  }

  // Last fallback: inspect all clickable text once.
  const jsonLike = clickable.find((el) => /json|\{\}/i.test((el.textContent || "").trim()));
  if (jsonLike) {
    jsonLike.click();
    return { ok: true, action: "clicked_json_like_control" };
  }

  return { ok: false, action: "json_view_control_not_found" };
}

async function openGeneratorAndPrefill() {
  const data = await chrome.storage.local.get([
    KEYS.tools,
    KEYS.messages,
    KEYS.generatorUrl
  ]);

  const tools = data[KEYS.tools] || "";
  const messages = data[KEYS.messages] || "";
  const generatorUrl = normalizeGeneratorUrl(data[KEYS.generatorUrl] || DEFAULT_GENERATOR_URL);

  if (!generatorUrl) {
    flash("Please provide generator URL");
    return;
  }

  if (!tools && !messages) {
    flash("Nothing to prefill. Capture tools or conversation first.");
    return;
  }

  // Set a flag so the content script knows to prefill
  await chrome.storage.local.set({ qis_prefill_pending: true });

  flash("Opening generator... (prefill will happen automatically)");

  // Open the generator page - the content script will handle prefilling
  const tab = await chrome.tabs.create({ url: generatorUrl, active: true });
  if (!tab || !tab.id) {
    flash("Could not open generator tab");
    return;
  }

  // Also try sending a message to the content script (backup method)
  await waitForTabComplete(tab.id);
  await new Promise((r) => setTimeout(r, 500));

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "prefill",
      tools: tools,
      messages: messages
    });
    console.log("[QiStuidioCurl] Message response:", response);
  } catch (err) {
    // Content script might have already handled it via storage, that's ok
    console.log("[QiStuidioCurl] Message send note:", err.message);
  }
}

async function clearCache() {
  await chrome.storage.local.remove([KEYS.tools, KEYS.messages]);
  updateStatus("tools", "");
  updateStatus("messages", "");
  flash("Captured data cleared");
}

function updateStatus(mode, text) {
  const hasValue = typeof text === "string" && text.trim().length > 0;
  let count = 0;
  let agentName = "";
  
  if (hasValue) {
    try {
      const parsed = JSON.parse(text);
      if (mode === "tools") {
        // Check if it's an agent node (has config.tools) or just a tools array
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          // It's an agent node object
          agentName = parsed.name || "";
          const tools = parsed.config?.tools;
          count = Array.isArray(tools) ? tools.length : 0;
        } else if (Array.isArray(parsed)) {
          // It's just a tools array
          count = parsed.length;
        }
      } else {
        count = Array.isArray(parsed) ? parsed.length : 0;
      }
    } catch (e) { /* ignore */ }
  }

  if (mode === "tools") {
    const statusBox = document.getElementById("toolsStatusBox");
    if (hasValue) {
      const nameDisplay = agentName ? `"${agentName}" ` : "";
      toolsStatusEl.textContent = `${nameDisplay}✓ ${count} tools`;
      if (statusBox) statusBox.classList.add("captured");
    } else {
      toolsStatusEl.textContent = "Not captured";
      if (statusBox) statusBox.classList.remove("captured");
    }
    previewToolsBtn.style.display = hasValue ? "inline-block" : "none";
  } else {
    const statusBox = document.getElementById("messagesStatusBox");
    if (hasValue) {
      messagesStatusEl.textContent = `✓ ${count} messages`;
      if (statusBox) statusBox.classList.add("captured");
    } else {
      messagesStatusEl.textContent = "Not captured";
      if (statusBox) statusBox.classList.remove("captured");
    }
    previewMessagesBtn.style.display = hasValue ? "inline-block" : "none";
  }
}

async function showPreview(mode) {
  const key = mode === "tools" ? KEYS.tools : KEYS.messages;
  const data = await chrome.storage.local.get([key]);
  const json = data[key] || "";

  previewTitle.textContent = mode === "tools" ? "Captured Agent Config" : "Captured Conversation";

  try {
    const parsed = JSON.parse(json);
    previewContent.textContent = JSON.stringify(parsed, null, 2);
  } catch (e) {
    previewContent.textContent = json || "(empty)";
  }

  previewModal.style.display = "block";
}

function hidePreview() {
  previewModal.style.display = "none";
}

async function copyPreviewToClipboard() {
  const text = previewContent.textContent;
  try {
    await navigator.clipboard.writeText(text);
    flash("Copied to clipboard!");
  } catch (e) {
    flash("Failed to copy");
  }
}

// Paste modal functions - now with auto-paste from clipboard
async function showPasteModal(mode) {
  currentPasteMode = mode;
  pasteTitle.textContent = mode === "tools" ? "Paste Agent Config JSON" : "Paste Conversation JSON";
  pasteTextarea.value = "";
  pasteTextarea.placeholder = mode === "tools" 
    ? "Paste agent node JSON or tools array here...\n\nExample (agent node):\n{\n  \"name\": \"my_agent\",\n  \"type\": \"agent\",\n  \"config\": {\n    \"tools\": [...],\n    \"model\": {...}\n  }\n}\n\nOr just the tools array:\n[\n  { \"name\": \"tool_name\", ... }\n]"
    : "Paste your messages array JSON here...\n\nExample:\n[\n  {\n    \"role\": \"system\",\n    \"content\": \"...\"\n  },\n  {\n    \"role\": \"user\",\n    \"content\": \"...\"\n  }\n]";
  
  // Try to auto-paste from clipboard
  try {
    const clipboardText = await navigator.clipboard.readText();
    if (clipboardText && clipboardText.trim()) {
      // Check if it looks like JSON
      const trimmed = clipboardText.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        pasteTextarea.value = clipboardText;
        flash("📋 Auto-pasted from clipboard! Click Save to confirm.", "success");
      }
    }
  } catch (err) {
    // Clipboard access denied or not available - that's ok, user can paste manually
    console.log("Clipboard auto-paste not available:", err.message);
  }
  
  pasteModal.style.display = "block";
  pasteTextarea.focus();
}

function hidePasteModal() {
  pasteModal.style.display = "none";
  currentPasteMode = null;
}

async function savePastedJson() {
  const text = pasteTextarea.value.trim();
  
  if (!text) {
    flash("⚠️ Please paste JSON first", "error");
    return;
  }

  // Validate JSON
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    flash("❌ Invalid JSON: " + e.message, "error");
    return;
  }

  // Validate based on mode
  if (currentPasteMode === "tools") {
    // Accept either agent node object or tools array
    if (Array.isArray(parsed)) {
      // It's a tools array
      const hasToolLikeItems = parsed.some(item => 
        item && typeof item === "object" && 
        (item.name || item.type === "tool" || item.type === "function" || item.function)
      );
      if (!hasToolLikeItems && parsed.length > 0) {
        flash("⚠️ Doesn't look like tools array, but saving anyway");
      }
      await chrome.storage.local.set({ [KEYS.tools]: text });
      updateStatus("tools", text);
      flash(`✓ Saved tools array (${parsed.length} items)`, "success");
    } else if (parsed && typeof parsed === "object") {
      // It's an agent node object
      const isAgentNode = parsed.type === "agent" || (parsed.config && parsed.config.tools);
      if (!isAgentNode) {
        flash("⚠️ Doesn't look like agent node, but saving anyway");
      }
      const toolCount = parsed.config?.tools?.length || 0;
      const agentName = parsed.name || "unknown";
      await chrome.storage.local.set({ [KEYS.tools]: text });
      updateStatus("tools", text);
      flash(`✓ Saved agent "${agentName}" (${toolCount} tools)`, "success");
    } else {
      flash("❌ JSON must be an array or agent object", "error");
      return;
    }
  } else {
    // Validate it's an array for messages
    if (!Array.isArray(parsed)) {
      flash("❌ Messages JSON must be an array", "error");
      return;
    }
    // Check if it looks like messages
    const hasMessageLikeItems = parsed.some(item =>
      item && typeof item === "object" && item.role && item.content !== undefined
    );
    if (!hasMessageLikeItems && parsed.length > 0) {
      flash("⚠️ Doesn't look like messages array, but saving anyway");
    }
    await chrome.storage.local.set({ [KEYS.messages]: text });
    updateStatus("messages", text);
    flash(`✓ Saved conversation (${parsed.length} messages)`, "success");
  }

  hidePasteModal();
}

function flash(message, type = "") {
  flashEl.textContent = message;
  flashEl.className = type; // "success", "error", or ""
  clearTimeout(flash._t);
  flash._t = setTimeout(() => {
    flashEl.textContent = "";
    flashEl.className = "";
  }, 4000);
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 250);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function prefillGeneratorPage(toolsJson, messagesJson) {
  // Immediately log to prove script is running
  console.log("[QiStuidioCurl] prefillGeneratorPage STARTED", { 
    toolsJsonLen: toolsJson ? toolsJson.length : 0, 
    messagesJsonLen: messagesJson ? messagesJson.length : 0 
  });

  // Helper to show toast on the page
  const showToast = (message, isError) => {
    // Also show alert for debugging
    // alert("[QiStuidioCurl] " + message);
    
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${isError ? "#dc2626" : "#16a34a"};
      color: white;
      border-radius: 8px;
      font-family: sans-serif;
      font-size: 14px;
      z-index: 99999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 400px;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  };

  const findInputs = () => ({
    toolsInput: document.getElementById("toolsInput"),
    messagesInput: document.getElementById("messagesInput")
  });

  // Wait up to 5s for app/script hydration.
  const maxWaitMs = 5000;
  const start = Date.now();
  let found = findInputs();
  while ((!found.toolsInput || !found.messagesInput) && (Date.now() - start < maxWaitMs)) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 100));
    found = findInputs();
  }

  const { toolsInput, messagesInput } = found;
  const allTextareas = document.querySelectorAll("textarea");

  if (!toolsInput && !messagesInput) {
    const errMsg = `Prefill failed: Could not find input fields. Found ${allTextareas.length} textareas.`;
    console.error("[QiStuidioCurl]", errMsg);
    showToast(errMsg, true);
    return {
      ok: false,
      error: "Could not locate generator input fields",
      debug: `url=${location.href},textareas=${allTextareas.length},ids=[${Array.from(allTextareas).map(t => t.id || 'no-id').join(',')}]`
    };
  }

  let toolsFilled = false;
  let messagesFilled = false;

  // Helper to fill a textarea robustly
  const fillTextarea = (el, value) => {
    if (!el || !value) return false;
    
    // Set value directly
    el.value = value;
    
    // Focus the element
    el.focus();
    
    // Dispatch multiple events to ensure frameworks pick up the change
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    
    // Also try setting via native setter (helps with some frameworks)
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    
    // Blur to trigger any blur-based handlers
    el.blur();
    
    return el.value.length > 0;
  };

  if (toolsInput && toolsJson) {
    toolsFilled = fillTextarea(toolsInput, toolsJson);
  }

  if (messagesInput && messagesJson) {
    messagesFilled = fillTextarea(messagesInput, messagesJson);
  }

  const debugInfo = {
    toolsInput: !!toolsInput,
    messagesInput: !!messagesInput,
    toolsJsonLen: toolsJson ? toolsJson.length : 0,
    messagesJsonLen: messagesJson ? messagesJson.length : 0,
    toolsValueLen: toolsInput ? toolsInput.value.length : 0,
    messagesValueLen: messagesInput ? messagesInput.value.length : 0
  };

  console.log("[QiStuidioCurl] Prefill result:", debugInfo);

  const statusMsg = `Prefilled: Tools ${toolsFilled ? "✓" : "✗"}, Conversation ${messagesFilled ? "✓" : "✗"}`;
  showToast(statusMsg, !toolsFilled && !messagesFilled);

  return {
    ok: true,
    toolsFilled,
    messagesFilled,
    debug: `toolsInput=${debugInfo.toolsInput},messagesInput=${debugInfo.messagesInput},toolsLen=${debugInfo.toolsJsonLen},msgsLen=${debugInfo.messagesJsonLen},toolsVal=${debugInfo.toolsValueLen},msgsVal=${debugInfo.messagesValueLen}`
  };
}

function extractFromPage(mode) {
  try {
    const selectedText = String(window.getSelection ? window.getSelection().toString() : "").trim();
    const sources = [];
    const debugStats = {
      selectedLen: selectedText ? selectedText.length : 0,
      bodyLen: 0,
      textareaCount: 0,
      monacoModels: 0,
      codemirrorBlocks: 0,
      scriptCount: 0
    };

    if (selectedText) {
      sources.push(selectedText);
    }

    const bodyText = document.body ? document.body.innerText : "";
    if (bodyText) {
      debugStats.bodyLen = bodyText.length;
      sources.push(bodyText);
    }

    const textAreas = Array.from(document.querySelectorAll("textarea"))
      .map((t) => t.value)
      .filter(Boolean);
    debugStats.textareaCount = textAreas.length;
    sources.push(...textAreas);

    const scriptText = Array.from(document.querySelectorAll("script"))
      .map((s) => s.textContent || "")
      .filter(Boolean);
    debugStats.scriptCount = scriptText.length;
    sources.push(...scriptText);

    // Monaco editor (common in JSON side panels)
    try {
      if (window.monaco && window.monaco.editor && typeof window.monaco.editor.getModels === "function") {
        const models = window.monaco.editor.getModels();
        debugStats.monacoModels = (models || []).length;
        for (const m of models || []) {
          try {
            const v = typeof m.getValue === "function" ? m.getValue() : "";
            if (v && typeof v === "string") {
              sources.push(v);
            }
          } catch (_err) {
            // ignore model read errors
          }
        }
      }
    } catch (_err) {
      // ignore monaco access errors
    }

    // CodeMirror-like editors
    try {
      const cmText = Array.from(document.querySelectorAll(".cm-content, .CodeMirror-code"))
        .map((el) => el.textContent || "")
        .filter(Boolean);
      debugStats.codemirrorBlocks = cmText.length;
      sources.push(...cmText);
    } catch (_err) {
      // ignore
    }

    // Langfuse: Look for JSON in pre/code elements or data attributes
    try {
      const preCodeText = Array.from(document.querySelectorAll("pre, code, [data-json], [data-value]"))
        .map((el) => el.textContent || el.getAttribute("data-json") || el.getAttribute("data-value") || "")
        .filter((t) => t && t.length > 50);
      sources.push(...preCodeText);
    } catch (_err) {
      // ignore
    }

    // Langfuse: Try to find React fiber or app state with observation/trace data
    try {
      const rootEl = document.getElementById("__next") || document.getElementById("root") || document.body;
      if (rootEl) {
        const reactKey = Object.keys(rootEl).find((k) => k.startsWith("__reactFiber") || k.startsWith("__reactProps"));
        if (reactKey) {
          const fiberOrProps = rootEl[reactKey];
          if (fiberOrProps) {
            sources.push(JSON.stringify(fiberOrProps));
          }
        }
      }
    } catch (_err) {
      // ignore
    }

    // Langfuse: Check window for trace/observation data
    try {
      const langfuseKeys = ["__NEXT_DATA__", "LANGFUSE_DATA", "traceData", "observationData"];
      for (const key of langfuseKeys) {
        if (window[key] && typeof window[key] === "object") {
          sources.push(JSON.stringify(window[key]));
        }
      }
    } catch (_err) {
      // ignore
    }

    // Langfuse: Try to find React Query cache (Langfuse uses React Query)
    try {
      const reactQueryKeys = ["__REACT_QUERY_STATE__", "__tanstack"];
      for (const key of Object.keys(window)) {
        if (key.includes("tanstack") || key.includes("query") || key.includes("QUERY")) {
          const val = window[key];
          if (val && typeof val === "object") {
            sources.push(JSON.stringify(val));
          }
        }
      }
    } catch (_err) {
      // ignore
    }

    // Langfuse: Look for JSON in any element with data-state or similar attributes
    try {
      const dataElements = document.querySelectorAll("[data-state], [data-value], [data-content], [data-raw]");
      for (const el of dataElements) {
        for (const attr of el.attributes) {
          if (attr.name.startsWith("data-") && attr.value && attr.value.length > 50) {
            sources.push(attr.value);
          }
        }
      }
    } catch (_err) {
      // ignore
    }

    // Langfuse: Try to extract from JSON viewer elements (common patterns)
    try {
      // Look for elements that might contain JSON values
      const jsonValueElements = document.querySelectorAll(
        ".json-view, .json-viewer, [class*='json'], [class*='Json'], " +
        ".tree-view, [class*='tree'], [class*='Tree'], " +
        ".object-value, .string-value, .array-value"
      );
      for (const el of jsonValueElements) {
        const text = el.textContent || "";
        if (text.length > 100 && (text.includes('"role"') || text.includes('"content"'))) {
          sources.push(text);
        }
      }
    } catch (_err) {
      // ignore
    }

    // Langfuse: Try to access Next.js page props through the DOM
    try {
      const nextDataEl = document.getElementById("__NEXT_DATA__");
      if (nextDataEl && nextDataEl.textContent) {
        sources.push(nextDataEl.textContent);
      }
    } catch (_err) {
      // ignore
    }

    // Langfuse: Scan all script tags for JSON data (including inline state)
    try {
      const allScripts = document.querySelectorAll("script");
      for (const script of allScripts) {
        const content = script.textContent || "";
        if (content.includes('"messages"') || content.includes('"role"')) {
          sources.push(content);
        }
      }
    } catch (_err) {
      // ignore
    }

    // Langfuse: Try to find observation/trace data in React component state
    try {
      // Look for any object on window that might contain trace/observation data
      const windowKeys = Object.keys(window);
      for (const key of windowKeys) {
        try {
          const val = window[key];
          if (val && typeof val === "object" && !Array.isArray(val)) {
            const str = JSON.stringify(val);
            // Only include if it has trace/observation/messages data
            if (str && str.length > 500 && str.length < 5000000 &&
                (str.includes('"input"') || str.includes('"messages"') || str.includes('"role"'))) {
              sources.push(str);
            }
          }
        } catch (_e) {
          // Skip non-serializable objects
        }
      }
    } catch (_err) {
      // ignore
    }

    // Langfuse: Try to find data in clipboard (if user recently copied)
    try {
      // Note: This requires user permission and might not work
      if (navigator.clipboard && navigator.clipboard.readText) {
        // We can't actually read clipboard without user gesture, but we can try
      }
    } catch (_err) {
      // ignore
    }

    // Langfuse specific: Look for the observation detail panel content
    try {
      // Langfuse often uses divs with specific classes for the detail panel
      const detailPanels = document.querySelectorAll(
        "[class*='observation'], [class*='Observation'], " +
        "[class*='detail'], [class*='Detail'], " +
        "[class*='panel'], [class*='Panel'], " +
        "[class*='drawer'], [class*='Drawer']"
      );
      for (const panel of detailPanels) {
        const text = panel.innerText || "";
        // Look for JSON-like structure in the panel
        if (text.includes('"role"') && text.includes('"content"')) {
          // Try to find JSON arrays/objects in the text
          const jsonMatches = text.match(/\[[\s\S]*?\{[\s\S]*?"role"[\s\S]*?"content"[\s\S]*?\}[\s\S]*?\]/g);
          if (jsonMatches) {
            for (const match of jsonMatches) {
              sources.push(match);
            }
          }
        }
      }
    } catch (_err) {
      // ignore
    }

    function safeJsonParse(text) {
      try {
        return JSON.parse(text);
      } catch (_err) {
        return null;
      }
    }

    function getByPath(obj, path) {
      let cur = obj;
      for (const key of path) {
        if (!cur || typeof cur !== "object") {
          return undefined;
        }
        cur = cur[key];
      }
      return cur;
    }

    function isLikelyToolsArray(arr) {
      if (!Array.isArray(arr) || arr.length === 0) {
        return false;
      }
      let matching = 0;
      for (const item of arr) {
        if (!item || typeof item !== "object") {
          continue;
        }
        const hasIdentity = typeof item.name === "string" || typeof item.alias === "string";
        const isToolType = item.type === "tool" || item.type === "function";
        const hasToolConfig = !!(item.config && typeof item.config === "object" &&
          (item.config.toolId || item.config.type || item.config.schema));
        if (hasIdentity && (isToolType || hasToolConfig)) {
          matching += 1;
        }
      }
      const ratio = matching / arr.length;
      return matching >= 1 && ratio >= 0.5;
    }

    function isLikelyMessagesArray(arr) {
      if (!Array.isArray(arr) || arr.length === 0) {
        return false;
      }
      return arr.some((item) =>
        item &&
        typeof item === "object" &&
        Object.prototype.hasOwnProperty.call(item, "content") &&
        typeof item.role === "string"
      );
    }

    function extractAgentFromCanvasNodes(root) {
      if (!root || typeof root !== "object") {
        return { agent: null, error: null };
      }
      const nodes = root.nodes;
      if (!Array.isArray(nodes)) {
        return { agent: null, error: null };
      }
      
      // Find all agent nodes
      const agentNodes = nodes.filter(node => 
        node && typeof node === "object" && node.type === "agent"
      );
      
      if (agentNodes.length === 0) {
        return { agent: null, error: null };
      }
      
      // Single agent - return it directly (no selection needed)
      if (agentNodes.length === 1) {
        return { agent: agentNodes[0], error: null };
      }
      
      // Multiple agents - check for selected one
      const selectedAgents = agentNodes.filter(node => node.selected === true);
      
      if (selectedAgents.length === 1) {
        return { agent: selectedAgents[0], error: null };
      }
      
      if (selectedAgents.length === 0) {
        const agentNames = agentNodes.map(n => n.name || n.id).join(", ");
        return { 
          agent: null, 
          error: `Multiple agents found (${agentNames}). Please click on the agent you want to capture first.`
        };
      }
      
      // Multiple selected (rare) - take the first
      return { agent: selectedAgents[0], error: null };
    }
    
    // Legacy function for backwards compatibility
    function extractToolsFromCanvasNodes(root) {
      const { agent } = extractAgentFromCanvasNodes(root);
      if (agent && agent.config && Array.isArray(agent.config.tools)) {
        return agent.config.tools;
      }
      return null;
    }

    function deepFindArray(node, modeValue, seen) {
      if (!node || typeof node !== "object") {
        return null;
      }
      if (seen.has(node)) {
        return null;
      }
      seen.add(node);

      if (Array.isArray(node)) {
        if (modeValue === "tools" && isLikelyToolsArray(node)) {
          return node;
        }
        if (modeValue === "messages" && isLikelyMessagesArray(node)) {
          return node;
        }
        for (const item of node) {
          const found = deepFindArray(item, modeValue, seen);
          if (found) {
            return found;
          }
        }
        return null;
      }

      for (const key of Object.keys(node)) {
        const value = node[key];
        if (Array.isArray(value)) {
          if (modeValue === "tools" && key.toLowerCase().includes("tool") && isLikelyToolsArray(value)) {
            return value;
          }
          if (modeValue === "messages" && (key.toLowerCase().includes("message") || key.toLowerCase().includes("conversation")) && isLikelyMessagesArray(value)) {
            return value;
          }
        }
        const found = deepFindArray(value, modeValue, seen);
        if (found) {
          return found;
        }
      }
      return null;
    }

    function findArrayInObject(value, modeValue) {
      if (Array.isArray(value)) {
        if (modeValue === "tools" && isLikelyToolsArray(value)) {
          return { result: value, isArray: true };
        }
        if (modeValue === "messages" && isLikelyMessagesArray(value)) {
          return { result: value, isArray: true };
        }
      }

      if (!value || typeof value !== "object") {
        return null;
      }

      if (modeValue === "tools") {
        // Try to extract the entire agent node from canvas
        const { agent, error } = extractAgentFromCanvasNodes(value);
        if (error) {
          return { result: null, error: error };
        }
        if (agent) {
          // Return entire agent node (not just tools)
          return { result: agent, isAgentNode: true };
        }

        // Check if value itself is an agent node
        if (value.type === "agent" && value.config && value.config.tools) {
          return { result: value, isAgentNode: true };
        }

        const directPaths = [
          ["config", "tools"],
          ["tools"],
          ["data", "tools"]
        ];
        for (const p of directPaths) {
          const v = getByPath(value, p);
          if (Array.isArray(v) && isLikelyToolsArray(v)) {
            return { result: v, isArray: true };
          }
        }
      } else {
        const directPaths = [
          ["messages"],
          ["conversation"],
          ["thread", "messages"],
          ["threadMessages"],
          ["data", "messages"],
          // Langfuse ChatOpenAI span paths
          ["input", "messages"],
          ["input"],
          ["kwargs", "messages"],
          ["observation", "input", "messages"],
          ["observation", "input"]
        ];
        for (const p of directPaths) {
          const v = getByPath(value, p);
          if (Array.isArray(v) && isLikelyMessagesArray(v)) {
            return { result: v, isArray: true };
          }
        }
      }

      const deepResult = deepFindArray(value, modeValue, new Set());
      if (deepResult) {
        return { result: deepResult, isArray: true };
      }
      return null;
    }

    function readBalancedJsonFrom(text, start) {
      const opening = text[start];
      const closing = opening === "{" ? "}" : "]";
      let depth = 0;
      let inString = false;
      let escaped = false;

      for (let i = start; i < text.length; i += 1) {
        const ch = text[i];
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (ch === "\\") {
            escaped = true;
          } else if (ch === "\"") {
            inString = false;
          }
          continue;
        }
        if (ch === "\"") {
          inString = true;
          continue;
        }
        if (ch === opening) {
          depth += 1;
        } else if (ch === closing) {
          depth -= 1;
          if (depth === 0) {
            return text.slice(start, i + 1);
          }
        }
      }
      return null;
    }

    function collectJsonSlices(text) {
      const slices = [];
      const starts = ["{", "["];
      for (let i = 0; i < text.length; i += 1) {
        if (!starts.includes(text[i])) {
          continue;
        }
        const slice = readBalancedJsonFrom(text, i);
        if (slice) {
          slices.push(slice);
          i += slice.length - 1;
        }
      }
      return slices;
    }

    function escapeRegex(value) {
      return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function readJsonArrayAfterIndex(text, idx) {
      let i = idx;
      while (i < text.length && /\s/.test(text[i])) {
        i += 1;
      }
      if (text[i] !== "[") {
        return null;
      }
      let depth = 0;
      let inString = false;
      let escaped = false;
      const start = i;
      for (; i < text.length; i += 1) {
        const ch = text[i];
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (ch === "\\") {
            escaped = true;
          } else if (ch === "\"") {
            inString = false;
          }
          continue;
        }
        if (ch === "\"") {
          inString = true;
          continue;
        }
        if (ch === "[") {
          depth += 1;
          continue;
        }
        if (ch === "]") {
          depth -= 1;
          if (depth === 0) {
            return text.slice(start, i + 1);
          }
        }
      }
      return null;
    }

    function extractArrayByKnownKeys(text, keys) {
      if (!text || typeof text !== "string") {
        return null;
      }
      for (const key of keys) {
        const regex = new RegExp(`"${escapeRegex(key)}"\\s*:`, "g");
        let match;
        while ((match = regex.exec(text)) !== null) {
          const arrayText = readJsonArrayAfterIndex(text, regex.lastIndex);
          if (!arrayText) {
            continue;
          }
          const arr = safeJsonParse(arrayText);
          if (Array.isArray(arr)) {
            return arr;
          }
        }
      }
      return null;
    }

    function extractFromParsedSource(source, modeValue) {
      if (!source || typeof source !== "string") {
        return null;
      }
      const direct = safeJsonParse(source);
      if (direct !== null) {
        const found = findArrayInObject(direct, modeValue);
        if (found && (found.result || found.error)) {
          return found;
        }
      }
      const jsonSlices = collectJsonSlices(source);
      for (const slice of jsonSlices) {
        const parsed = safeJsonParse(slice);
        if (parsed !== null) {
          const found = findArrayInObject(parsed, modeValue);
          if (found && (found.result || found.error)) {
            return found;
          }
        }
      }
      return null;
    }

    function findInWindowState(modeValue) {
      const candidates = [];

      try {
        if (window.__INITIAL_STATE__) candidates.push(window.__INITIAL_STATE__);
      } catch (_err) {}
      try {
        if (window.__REDUX_STATE__) candidates.push(window.__REDUX_STATE__);
      } catch (_err) {}
      try {
        if (window.__NEXT_DATA__) candidates.push(window.__NEXT_DATA__);
      } catch (_err) {}
      try {
        if (window.store && typeof window.store.getState === "function") {
          candidates.push(window.store.getState());
        }
      } catch (_err) {}

      // Qi Studio-style global cache/state objects (best effort)
      try {
        const keys = Object.keys(window).filter((k) =>
          /state|store|workflow|orchestration|agent|graph|redux|apollo/i.test(k)
        );
        for (const key of keys.slice(0, 40)) {
          try {
            const val = window[key];
            if (val && typeof val === "object") {
              candidates.push(val);
            }
          } catch (_err) {}
        }
      } catch (_err) {}

      for (const obj of candidates) {
        const found = findArrayInObject(obj, modeValue);
        if (found) {
          return found;
        }
      }
      return null;
    }

    const keys = mode === "tools"
      ? ["tools"]
      : ["messages", "conversation", "threadMessages", "thread.messages"];

    for (const source of sources) {
      const fromObject = extractFromParsedSource(source, mode);
      
      // Handle error case (e.g., multiple agents, none selected)
      if (fromObject && fromObject.error) {
        return {
          ok: false,
          error: fromObject.error,
          debug: `sources=${sources.length}`
        };
      }
      
      if (fromObject && fromObject.result) {
        if (fromObject.isAgentNode) {
          // Return entire agent node
          const agent = fromObject.result;
          const toolCount = agent.config?.tools?.length || 0;
          return {
            ok: true,
            value: JSON.stringify(agent, null, 2),
            count: toolCount,
            agentName: agent.name || ""
          };
        } else if (Array.isArray(fromObject.result)) {
          return {
            ok: true,
            value: JSON.stringify(fromObject.result, null, 2),
            count: fromObject.result.length
          };
        }
      }

      const parsed = extractArrayByKnownKeys(source, keys);
      if (parsed && Array.isArray(parsed)) {
        return {
          ok: true,
          value: JSON.stringify(parsed, null, 2),
          count: parsed.length
        };
      }
    }

    // Last structured fallback: inspect app state objects on window.
    const fromWindowState = findInWindowState(mode);
    if (fromWindowState && Array.isArray(fromWindowState)) {
      return {
        ok: true,
        value: JSON.stringify(fromWindowState, null, 2),
        count: fromWindowState.length
      };
    }

    if (selectedText) {
      const direct = safeJsonParse(selectedText);
      if (Array.isArray(direct)) {
        return {
          ok: true,
          value: JSON.stringify(direct, null, 2),
          count: direct.length
        };
      }
    }

    return {
      ok: false,
      error: mode === "tools"
        ? "Could not find agent node. Click on an agent node in the canvas first, then capture."
        : "Could not find conversation/messages array. Open trace JSON or select a JSON block and retry.",
      debug: `sources=${sources.length}, selected=${debugStats.selectedLen}, body=${debugStats.bodyLen}, textarea=${debugStats.textareaCount}, monaco=${debugStats.monacoModels}, cm=${debugStats.codemirrorBlocks}, scripts=${debugStats.scriptCount}`
    };
  } catch (err) {
    return {
      ok: false,
      error: `Capture failed: ${err && err.message ? err.message : "unknown extractor error"}`,
      debug: `mode=${mode}`
    };
  }
}

function extractFromParsedSource(source, mode) {
  if (!source || typeof source !== "string") {
    return null;
  }

  const direct = safeJsonParse(source);
  if (direct !== null) {
    const found = findArrayInObject(direct, mode);
    if (found && (found.result || found.error)) {
      return found;
    }
  }

  // If source has additional text, try extracting object/array slices.
  const jsonSlices = collectJsonSlices(source);
  for (const slice of jsonSlices) {
    const parsed = safeJsonParse(slice);
    if (parsed !== null) {
      const found = findArrayInObject(parsed, mode);
      if (found && (found.result || found.error)) {
        return found;
      }
    }
  }

  return null;
}

function findArrayInObject(value, mode) {
  if (Array.isArray(value)) {
    if (mode === "tools" && isLikelyToolsArray(value)) {
      return { result: value, isArray: true };
    }
    if (mode === "messages" && isLikelyMessagesArray(value)) {
      return { result: value, isArray: true };
    }
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  if (mode === "tools") {
    // Try to extract the entire agent node from canvas
    const { agent, error } = extractAgentFromCanvasNodes(value);
    if (error) {
      return { result: null, error: error };
    }
    if (agent) {
      // Return entire agent node (not just tools)
      return { result: agent, isAgentNode: true };
    }

    // Check if value itself is an agent node
    if (value.type === "agent" && value.config && value.config.tools) {
      return { result: value, isAgentNode: true };
    }

    // Preferred explicit paths for agent node JSON.
    const directPaths = [
      ["config", "tools"],
      ["tools"],
      ["data", "tools"]
    ];
    for (const p of directPaths) {
      const v = getByPath(value, p);
      if (Array.isArray(v) && isLikelyToolsArray(v)) {
        return { result: v, isArray: true };
      }
    }
  } else {
    const directPaths = [
      ["messages"],
      ["conversation"],
      ["thread", "messages"],
      ["threadMessages"],
      ["data", "messages"],
      // Langfuse ChatOpenAI span paths
      ["input", "messages"],
      ["input"],
      ["kwargs", "messages"],
      ["observation", "input", "messages"],
      ["observation", "input"]
    ];
    for (const p of directPaths) {
      const v = getByPath(value, p);
      if (Array.isArray(v) && isLikelyMessagesArray(v)) {
        return { result: v, isArray: true };
      }
    }
  }

  // Deep search fallback.
  const deepResult = deepFindArray(value, mode, new Set());
  if (deepResult) {
    return { result: deepResult, isArray: true };
  }
  return null;
}

function deepFindArray(node, mode, seen) {
  if (!node || typeof node !== "object") {
    return null;
  }
  if (seen.has(node)) {
    return null;
  }
  seen.add(node);

  if (Array.isArray(node)) {
    if (mode === "tools" && isLikelyToolsArray(node)) {
      return node;
    }
    if (mode === "messages" && isLikelyMessagesArray(node)) {
      return node;
    }
    for (const item of node) {
      const found = deepFindArray(item, mode, seen);
      if (found) {
        return found;
      }
    }
    return null;
  }

  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) {
      if (mode === "tools" && key.toLowerCase().includes("tool") && isLikelyToolsArray(value)) {
        return value;
      }
      if (mode === "messages" && (key.toLowerCase().includes("message") || key.toLowerCase().includes("conversation")) && isLikelyMessagesArray(value)) {
        return value;
      }
    }
    const found = deepFindArray(value, mode, seen);
    if (found) {
      return found;
    }
  }

  return null;
}

function isLikelyToolsArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return false;
  }
  let matching = 0;
  for (const item of arr) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const hasIdentity = typeof item.name === "string" || typeof item.alias === "string";
    const isToolType = item.type === "tool" || item.type === "function";
    const hasToolConfig = !!(item.config && typeof item.config === "object" &&
      (item.config.toolId || item.config.type || item.config.schema));
    if (hasIdentity && (isToolType || hasToolConfig)) {
      matching += 1;
    }
  }

  // Avoid false positive on canvas "nodes" array:
  // require enough tool-like items.
  const ratio = matching / arr.length;
  return matching >= 1 && ratio >= 0.5;
}

function isLikelyMessagesArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return false;
  }
  return arr.some((item) =>
    item &&
    typeof item === "object" &&
    Object.prototype.hasOwnProperty.call(item, "content") &&
    typeof item.role === "string"
  );
}

function extractAgentFromCanvasNodes(root) {
  if (!root || typeof root !== "object") {
    return { agent: null, error: null };
  }
  const nodes = root.nodes;
  if (!Array.isArray(nodes)) {
    return { agent: null, error: null };
  }
  
  // Find all agent nodes
  const agentNodes = nodes.filter(node => 
    node && typeof node === "object" && node.type === "agent"
  );
  
  if (agentNodes.length === 0) {
    return { agent: null, error: null };
  }
  
  // Single agent - return it directly (no selection needed)
  if (agentNodes.length === 1) {
    return { agent: agentNodes[0], error: null };
  }
  
  // Multiple agents - check for selected one
  const selectedAgents = agentNodes.filter(node => node.selected === true);
  
  if (selectedAgents.length === 1) {
    return { agent: selectedAgents[0], error: null };
  }
  
  if (selectedAgents.length === 0) {
    const agentNames = agentNodes.map(n => n.name || n.id).join(", ");
    return { 
      agent: null, 
      error: `Multiple agents found (${agentNames}). Please click on the agent you want to capture first.`
    };
  }
  
  // Multiple selected (rare) - take the first
  return { agent: selectedAgents[0], error: null };
}

// Legacy function for backwards compatibility
function extractToolsFromCanvasNodes(root) {
  const { agent } = extractAgentFromCanvasNodes(root);
  if (agent && agent.config && Array.isArray(agent.config.tools)) {
    return agent.config.tools;
  }
  return null;
}

function getByPath(obj, path) {
  let cur = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object") {
      return undefined;
    }
    cur = cur[key];
  }
  return cur;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (_err) {
    return null;
  }
}

function collectJsonSlices(text) {
  const slices = [];
  const starts = ["{", "["];
  for (let i = 0; i < text.length; i += 1) {
    if (!starts.includes(text[i])) {
      continue;
    }
    const slice = readBalancedJsonFrom(text, i);
    if (slice) {
      slices.push(slice);
      i += slice.length - 1;
    }
  }
  return slices;
}

function readBalancedJsonFrom(text, start) {
  const opening = text[start];
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === opening) {
      depth += 1;
    } else if (ch === closing) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

function normalizeGeneratorUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return DEFAULT_GENERATOR_URL;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function extractArrayByKnownKeys(text, keys) {
  if (!text || typeof text !== "string") {
    return null;
  }

  for (const key of keys) {
    const regex = new RegExp(`"${escapeRegex(key)}"\\s*:`, "g");
    let match;
    while ((match = regex.exec(text)) !== null) {
      const arrayText = readJsonArrayAfterIndex(text, regex.lastIndex);
      if (!arrayText) {
        continue;
      }

      try {
        const arr = JSON.parse(arrayText);
        if (Array.isArray(arr)) {
          return arr;
        }
      } catch (_err) {
        // continue scanning
      }
    }
  }

  return null;
}

function readJsonArrayAfterIndex(text, idx) {
  let i = idx;
  while (i < text.length && /\s/.test(text[i])) {
    i += 1;
  }
  if (text[i] !== "[") {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  const start = i;

  for (; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "[") {
      depth += 1;
      continue;
    }

    if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

