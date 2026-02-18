/**
 * LLM CURL GENERATOR - JavaScript
 * Converts KeyStudio format to OpenAI Chat Completion API format
 */

// ============================================
// VALIDATION
// ============================================

/**
 * Validate JSON input and update badge
 */
function validateJSON(inputId, badgeId) {
    const input = document.getElementById(inputId);
    const badge = document.getElementById(badgeId);
    const value = input.value.trim();
    
    if (!value) {
        badge.textContent = 'Paste JSON array';
        badge.className = 'validation-badge';
        return null;
    }
    
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            badge.textContent = `✓ Valid (${parsed.length} items)`;
            badge.className = 'validation-badge valid';
            return parsed;
        } else {
            badge.textContent = '✗ Must be an array';
            badge.className = 'validation-badge invalid';
            return null;
        }
    } catch (e) {
        badge.textContent = '✗ Invalid JSON';
        badge.className = 'validation-badge invalid';
        return null;
    }
}

// Add event listeners for real-time validation
document.addEventListener('DOMContentLoaded', function() {
    const toolsInput = document.getElementById('toolsInput');
    const messagesInput = document.getElementById('messagesInput');
    
    toolsInput.addEventListener('input', () => validateJSON('toolsInput', 'toolsValidation'));
    messagesInput.addEventListener('input', () => validateJSON('messagesInput', 'messagesValidation'));
});

// ============================================
// CONVERTERS
// ============================================

/**
 * Convert tools from KeyStudio format to OpenAI format
 * 
 * KeyStudio format:
 * {
 *   "_id": "...",
 *   "name": "handoff_to_node",
 *   "description": "...",
 *   "type": "tool",                    // <-- Wrong for OpenAI
 *   "config": { "schema": {...} },     // <-- Parameters are here
 *   "alias": "actual_function_name"    // <-- Use this as function name
 * }
 * 
 * OpenAI format:
 * {
 *   "type": "function",
 *   "function": {
 *     "name": "actual_function_name",
 *     "description": "...",
 *     "parameters": {...}
 *   }
 * }
 */
function convertTools(inputTools) {
    return inputTools.map(tool => {
        // Check if already in OpenAI format (type === "function" and has function object)
        if (tool.type === 'function' && tool.function) {
            return tool;
        }
        
        // Convert from KeyStudio format
        const functionName = tool.alias || tool.name || 'unknown_function';
        const description = tool.description || '';
        
        // Extract parameters from config.schema or use empty object
        let parameters = { type: 'object', properties: {}, required: [] };
        if (tool.config && tool.config.schema) {
            parameters = tool.config.schema;
        }
        
        return {
            type: 'function',
            function: {
                name: functionName,
                description: description,
                parameters: parameters
            }
        };
    });
}

/**
 * Convert message content from KeyStudio format to OpenAI format
 * KeyStudio: content can be array [{type: "text", text: "..."}] or string
 * OpenAI: content is always a string
 */
function convertMessageContent(content) {
    // If content is already a string, return as-is
    if (typeof content === 'string') {
        return content;
    }
    
    // If content is an array (KeyStudio format)
    if (Array.isArray(content)) {
        return content
            .filter(item => item.type === 'text' && item.text)
            .map(item => item.text)
            .join('\n');
    }
    
    // Fallback
    return String(content || '');
}

/**
 * Convert messages array from KeyStudio format to OpenAI format
 */
function convertMessages(inputMessages) {
    const convertedMessages = [];
    
    for (const msg of inputMessages) {
        const content = convertMessageContent(msg.content);
        
        // Skip empty messages
        if (!content || content.trim() === '') {
            continue;
        }
        
        convertedMessages.push({
            role: msg.role,
            content: content
        });
    }
    
    return convertedMessages;
}

// ============================================
// GENERATORS
// ============================================

/**
 * Get configuration from UI
 */
function getConfig() {
    return {
        apiEndpoint: document.getElementById('apiEndpoint').value || 'https://api.openai.com/v1/chat/completions',
        apiVersion: document.getElementById('apiVersion').value || '2024-02-01',
        apiKey: document.getElementById('apiKey').value || '<Your openai key>',
        hostHeader: document.getElementById('hostHeader').value || 'api.openai.com',
        temperature: parseFloat(document.getElementById('temperature').value) || 0.1,
        topP: parseFloat(document.getElementById('topP').value) || 0.1,
        toolChoice: document.getElementById('toolChoice').value || 'auto'
    };
}

/**
 * Generate the request body
 */
function generateRequestBody(config, messages, tools) {
    return {
        temperature: config.temperature,
        top_p: config.topP,
        tool_choice: config.toolChoice,
        messages: messages,
        tools: tools
    };
}

/**
 * Generate curl command
 */
function generateCurlCommand(config, requestBody) {
    const fullUrl = `${config.apiEndpoint}?api-version=${config.apiVersion}&api-key=${config.apiKey}`;
    
    // Pretty print JSON
    const jsonBody = JSON.stringify(requestBody, null, 4);
    
    // Escape single quotes for bash
    const escapedBody = jsonBody.replace(/'/g, "'\\''");
    
    return `curl --location '${fullUrl}' \\
--header 'Host: ${config.hostHeader}' \\
--header 'Content-Type: application/json' \\
--data '${escapedBody}'`;
}

/**
 * Generate PowerShell command
 */
function generatePowerShellCommand(config, requestBody) {
    const fullUrl = `${config.apiEndpoint}?api-version=${config.apiVersion}&api-key=${config.apiKey}`;
    const jsonBody = JSON.stringify(requestBody, null, 2);
    
    return `$headers = @{
    "Host" = "${config.hostHeader}"
    "Content-Type" = "application/json"
}

$body = @'
${jsonBody}
'@

Invoke-RestMethod -Uri "${fullUrl}" -Method Post -Headers $headers -Body $body`;
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Main generate function - called when button clicked
 */
function generateCurl() {
    // Hide previous outputs/errors
    document.getElementById('outputSection').style.display = 'none';
    document.getElementById('errorSection').style.display = 'none';
    
    try {
        // Validate and parse tools
        const inputTools = validateJSON('toolsInput', 'toolsValidation');
        if (!inputTools) {
            showError('Please enter valid Tools JSON array');
            return;
        }
        
        // Validate and parse messages
        const inputMessages = validateJSON('messagesInput', 'messagesValidation');
        if (!inputMessages) {
            showError('Please enter valid Messages JSON array');
            return;
        }
        
        // Convert tools from KeyStudio format to OpenAI format
        const convertedTools = convertTools(inputTools);
        
        // Convert messages to OpenAI format
        const convertedMessages = convertMessages(inputMessages);
        
        if (convertedMessages.length === 0) {
            showError('No valid messages found after conversion. Please check your input.');
            return;
        }
        
        // Get configuration
        const config = getConfig();
        
        // Generate request body
        const requestBody = generateRequestBody(config, convertedMessages, convertedTools);
        
        // Generate outputs
        const bodyJSON = JSON.stringify(requestBody, null, 2);
        const curlCmd = generateCurlCommand(config, requestBody);
        const psCmd = generatePowerShellCommand(config, requestBody);
        
        // Display outputs
        document.getElementById('bodyOutput').textContent = bodyJSON;
        document.getElementById('curlOutput').textContent = curlCmd;
        document.getElementById('psOutput').textContent = psCmd;
        
        // Show output section
        document.getElementById('outputSection').style.display = 'flex';
        
        // Scroll to output
        document.getElementById('outputSection').scrollIntoView({ behavior: 'smooth' });
        
        // Show success toast
        showToast(`✓ Generated! ${convertedMessages.length} messages, ${convertedTools.length} tools`);
        
    } catch (error) {
        showError('Error generating curl: ' + error.message);
        console.error(error);
    }
}

// ============================================
// UI HELPERS
// ============================================

/**
 * Show error message
 */
function showError(message) {
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.textContent = message;
    errorSection.style.display = 'block';
    errorSection.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Show toast notification
 */
function showToast(message) {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create new toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

/**
 * Copy to clipboard
 */
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    const text = element.textContent;
    
    navigator.clipboard.writeText(text).then(() => {
        // Find the copy button for this element
        const card = element.closest('.output-card');
        const btn = card.querySelector('.btn-copy');
        
        // Update button state
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<span class="copy-icon">✓</span> Copied!';
        btn.classList.add('copied');
        
        // Reset after 2 seconds
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.remove('copied');
        }, 2000);
        
        showToast('Copied to clipboard!');
    }).catch(err => {
        showError('Failed to copy: ' + err.message);
    });
}

/**
 * Toggle API key visibility
 */
function toggleApiKeyVisibility() {
    const input = document.getElementById('apiKey');
    const btn = document.querySelector('.toggle-visibility');
    
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁';
    }
}

/**
 * Format JSON in textarea
 */
function formatJSON(inputId) {
    const input = document.getElementById(inputId);
    const value = input.value.trim();
    
    if (!value) return;
    
    try {
        const parsed = JSON.parse(value);
        input.value = JSON.stringify(parsed, null, 2);
        showToast('JSON formatted!');
    } catch (e) {
        showError('Cannot format: Invalid JSON');
    }
}

/**
 * Clear input
 */
function clearInput(inputId) {
    document.getElementById(inputId).value = '';
    
    // Reset validation badge
    if (inputId === 'toolsInput') {
        const badge = document.getElementById('toolsValidation');
        badge.textContent = 'Paste JSON array';
        badge.className = 'validation-badge';
    } else if (inputId === 'messagesInput') {
        const badge = document.getElementById('messagesValidation');
        badge.textContent = 'Paste JSON array';
        badge.className = 'validation-badge';
    }
}

