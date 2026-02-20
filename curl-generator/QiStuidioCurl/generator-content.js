/**
 * Content script that runs on the generator page.
 * Reads captured data from extension storage and fills the form.
 */

(function() {
  console.log("[QiStuidioCurl] Content script loaded on generator page");

  const KEYS = {
    tools: "qis_tools_json",
    messages: "qis_messages_json",
    prefillFlag: "qis_prefill_pending"
  };

  // Wait for DOM to be ready
  function onReady(fn) {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(fn, 100);
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  }

  // Fill textarea helper
  function fillTextarea(el, value) {
    if (!el || !value) return false;
    
    el.value = value;
    el.focus();
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();
    
    return el.value.length > 0;
  }

  // Show toast notification
  function showToast(message, isSuccess) {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${isSuccess ? "#16a34a" : "#dc2626"};
      color: white;
      border-radius: 8px;
      font-family: sans-serif;
      font-size: 14px;
      z-index: 99999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 400px;
      animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Main prefill function
  async function checkAndPrefill() {
    console.log("[QiStuidioCurl] Checking for pending prefill...");
    
    try {
      const data = await chrome.storage.local.get([KEYS.tools, KEYS.messages, KEYS.prefillFlag]);
      
      console.log("[QiStuidioCurl] Storage data:", {
        hasTools: !!data[KEYS.tools],
        hasMessages: !!data[KEYS.messages],
        prefillFlag: data[KEYS.prefillFlag]
      });

      // Only prefill if flag is set
      if (!data[KEYS.prefillFlag]) {
        console.log("[QiStuidioCurl] No prefill pending, skipping");
        return;
      }

      // Clear the flag immediately to prevent re-prefilling on refresh
      await chrome.storage.local.remove([KEYS.prefillFlag]);

      const toolsInput = document.getElementById("toolsInput");
      const messagesInput = document.getElementById("messagesInput");

      console.log("[QiStuidioCurl] Found elements:", {
        toolsInput: !!toolsInput,
        messagesInput: !!messagesInput
      });

      if (!toolsInput && !messagesInput) {
        showToast("Could not find input fields on this page", false);
        return;
      }

      let toolsFilled = false;
      let messagesFilled = false;

      if (toolsInput && data[KEYS.tools]) {
        toolsFilled = fillTextarea(toolsInput, data[KEYS.tools]);
        console.log("[QiStuidioCurl] Tools filled:", toolsFilled);
      }

      if (messagesInput && data[KEYS.messages]) {
        messagesFilled = fillTextarea(messagesInput, data[KEYS.messages]);
        console.log("[QiStuidioCurl] Messages filled:", messagesFilled);
      }

      if (toolsFilled || messagesFilled) {
        showToast(`Prefilled: Tools ${toolsFilled ? "✓" : "–"}, Conversation ${messagesFilled ? "✓" : "–"}`, true);
      } else {
        showToast("No data to prefill", false);
      }

    } catch (err) {
      console.error("[QiStuidioCurl] Error during prefill:", err);
      showToast("Prefill error: " + err.message, false);
    }
  }

  // Run when page is ready
  onReady(checkAndPrefill);

  // Also listen for messages from the popup (backup method)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[QiStuidioCurl] Received message:", message);
    
    if (message.action === "prefill") {
      const toolsInput = document.getElementById("toolsInput");
      const messagesInput = document.getElementById("messagesInput");

      let toolsFilled = false;
      let messagesFilled = false;

      if (toolsInput && message.tools) {
        toolsFilled = fillTextarea(toolsInput, message.tools);
      }
      if (messagesInput && message.messages) {
        messagesFilled = fillTextarea(messagesInput, message.messages);
      }

      showToast(`Prefilled: Tools ${toolsFilled ? "✓" : "–"}, Conversation ${messagesFilled ? "✓" : "–"}`, toolsFilled || messagesFilled);
      
      sendResponse({ ok: true, toolsFilled, messagesFilled });
    }
    
    return true; // Keep channel open for async response
  });

})();

