/**
 * LLM CURL GENERATOR - JavaScript
 * Converts Qi Studio format to OpenAI Chat Completion API format
 */

// ============================================
// THEME TOGGLE
// ============================================

/**
 * Toggle between light and dark theme
 */
function toggleTheme() {
    const html = document.documentElement;
    const themeIcon = document.getElementById('themeIcon');
    const currentTheme = html.getAttribute('data-theme');
    
    if (currentTheme === 'light') {
        html.removeAttribute('data-theme');
        themeIcon.textContent = '☀️';
        localStorage.setItem('theme', 'dark');
    } else {
        html.setAttribute('data-theme', 'light');
        themeIcon.textContent = '🌙';
        localStorage.setItem('theme', 'light');
    }
}

/**
 * Initialize theme from localStorage (defaults to light)
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeIcon = document.getElementById('themeIcon');
    
    // Default to light theme if no preference saved
    if (savedTheme === 'dark') {
        document.documentElement.removeAttribute('data-theme');
        if (themeIcon) themeIcon.textContent = '☀️';
    } else {
        // Light theme is default
        document.documentElement.setAttribute('data-theme', 'light');
        if (themeIcon) themeIcon.textContent = '🌙';
        if (!savedTheme) localStorage.setItem('theme', 'light');
    }
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', initTheme);

// ============================================
// WARNING SYSTEM
// ============================================

// Default template text to check against
const DEFAULT_MESSAGES_TEMPLATE = `[
  {
    "role": "system",
    "content": "You are a helpful assistant. Replace this with your system prompt."
  },
  {
    "role": "user",
    "content": "Replace this with the user message."
  }
]`;

const DEFAULT_TOOLS_TEMPLATE = `[
  {
    "type": "tool",
    "name": "example_tool",
    "description": "Replace with your tool description",
    "config": {
      "schema": {
        "type": "object",
        "properties": {},
        "required": []
      }
    },
    "alias": "example_tool"
  }
]`;

/**
 * Current warnings list
 */
let currentWarnings = [];

/**
 * Check all warnings and update the indicator
 */
function checkWarnings() {
    currentWarnings = [];
    
    // Check if messages template hasn't been modified
    const messagesInput = document.getElementById('messagesInput');
    if (messagesInput) {
        const messagesValue = messagesInput.value.trim();
        const defaultTrimmed = DEFAULT_MESSAGES_TEMPLATE.trim();
        
        // Normalize whitespace for comparison
        const normalizedMessages = messagesValue.replace(/\s+/g, ' ');
        const normalizedDefault = defaultTrimmed.replace(/\s+/g, ' ');
        
        if (normalizedMessages === normalizedDefault) {
            currentWarnings.push('Conversation History still contains the default template. Please replace with your actual messages.');
        }
    }
    
    // Check if tools/agent config is empty or still default template
    const toolsInput = document.getElementById('toolsInput');
    if (toolsInput) {
        const toolsValue = toolsInput.value.trim();
        if (!toolsValue) {
            currentWarnings.push('Agent Configuration is empty. Paste your agent node JSON or tools array.');
        } else {
            // Check if it's still the default template
            const normalizedTools = toolsValue.replace(/\s+/g, ' ');
            const normalizedDefault = DEFAULT_TOOLS_TEMPLATE.trim().replace(/\s+/g, ' ');
            
            if (normalizedTools === normalizedDefault) {
                currentWarnings.push('Agent Configuration still contains the default template. Please replace with your actual agent config or tools.');
            }
        }
    }
    
    // Check reasoning + temperature conflict
    const reasoningEnabled = document.getElementById('reasoningEnabled')?.checked;
    const temperature = parseFloat(document.getElementById('temperature')?.value || 0.1);
    const topP = parseFloat(document.getElementById('topP')?.value || 0.1);
    const maxTokens = parseInt(document.getElementById('maxOutputTokens')?.value || 1000);
    
    if (reasoningEnabled) {
        if (temperature !== 1 || topP !== 1) {
            currentWarnings.push('Reasoning enabled with custom temperature/top_p. GPT-5.2 requires temperature=1 and top_p=1 when reasoning_effort is used.');
        }
        if (maxTokens < 4000) {
            currentWarnings.push(`Max Output Tokens (${maxTokens}) may be too low with reasoning enabled. Reasoning uses tokens from the same pool. Recommend 4000-16000 to avoid empty responses.`);
        }
    }
    
    // Update warning indicator
    updateWarningIndicator();
}

/**
 * Update the warning indicator in navbar
 */
function updateWarningIndicator() {
    const indicator = document.getElementById('warningIndicator');
    const countEl = document.getElementById('warningCount');
    const textEl = indicator?.querySelector('.warning-text');
    const listEl = document.getElementById('warningsList');
    
    if (!indicator) return;
    
    const count = currentWarnings.length;
    
    if (count > 0) {
        indicator.style.display = 'flex';
        countEl.textContent = count;
        textEl.textContent = count === 1 ? 'warning' : 'warnings';
        
        // Update warnings list
        if (listEl) {
            listEl.innerHTML = currentWarnings.map(w => `<li>${w}</li>`).join('');
        }
    } else {
        indicator.style.display = 'none';
        hideWarningsPanel();
    }
}

/**
 * Show warnings panel
 */
function showWarningsPanel() {
    const panel = document.getElementById('warningsPanel');
    if (panel) {
        panel.style.display = 'block';
    }
}

/**
 * Hide warnings panel
 */
function hideWarningsPanel() {
    const panel = document.getElementById('warningsPanel');
    if (panel) {
        panel.style.display = 'none';
    }
}

// Check warnings on input changes
document.addEventListener('DOMContentLoaded', function() {
    // Initial check
    setTimeout(checkWarnings, 100);
    
    // Listen to input changes
    const messagesInput = document.getElementById('messagesInput');
    const toolsInput = document.getElementById('toolsInput');
    
    if (messagesInput) {
        messagesInput.addEventListener('input', checkWarnings);
    }
    if (toolsInput) {
        toolsInput.addEventListener('input', checkWarnings);
    }
    
    // Close warnings panel when clicking outside
    document.addEventListener('click', function(e) {
        const panel = document.getElementById('warningsPanel');
        const indicator = document.getElementById('warningIndicator');
        if (panel && panel.style.display === 'block') {
            if (!panel.contains(e.target) && !indicator.contains(e.target)) {
                hideWarningsPanel();
            }
        }
    });
});

/**
 * Toggle collapsible output sections
 */
function toggleCollapsible(headerElement) {
    const card = headerElement.closest('.output-card');
    card.classList.toggle('expanded');
}

/**
 * Toggle reasoning dropdown visibility
 */
function toggleReasoningDropdown() {
    const checkbox = document.getElementById('reasoningEnabled');
    const dropdown = document.getElementById('reasoningEffort');
    
    if (checkbox.checked) {
        dropdown.disabled = false;
        dropdown.style.opacity = '1';
        // Check for temperature/top_p conflict
        checkReasoningConflict();
    } else {
        dropdown.disabled = true;
        dropdown.style.opacity = '0.5';
        hideReasoningWarning();
    }
}

/**
 * Toggle structured output textarea visibility
 */
function toggleStructuredOutput() {
    const checkbox = document.getElementById('structuredOutputEnabled');
    const schemaTextarea = document.getElementById('structuredOutputSchema');
    
    if (checkbox && schemaTextarea) {
        if (checkbox.checked) {
            schemaTextarea.disabled = false;
            schemaTextarea.style.opacity = '1';
            schemaTextarea.style.display = 'block';
        } else {
            schemaTextarea.disabled = true;
            schemaTextarea.style.opacity = '0.5';
            schemaTextarea.style.display = 'none';
        }
    }
}

/**
 * Check for reasoning + temperature/top_p conflict
 * Now uses the navbar warning system
 */
function checkReasoningConflict() {
    // Just trigger the warning system check
    checkWarnings();
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate JSON input and update badge
 * Now supports both array format and agent node JSON format
 */
function validateJSON(inputId, badgeId) {
    const input = document.getElementById(inputId);
    const badge = document.getElementById(badgeId);
    const value = input.value.trim();
    
    if (!value) {
        badge.textContent = 'Paste JSON array or agent node';
        badge.className = 'validation-badge';
        return null;
    }
    
    try {
        const parsed = JSON.parse(value);
        
        // Check if it's an array (tools array or messages array)
        if (Array.isArray(parsed)) {
            badge.textContent = `✓ Valid array (${parsed.length} items)`;
            badge.className = 'validation-badge valid';
            return parsed;
        }
        
        // Check if it's an agent node JSON (for tools input)
        if (inputId === 'toolsInput' && isAgentNodeJson(parsed)) {
            const tools = parsed.config?.tools || [];
            badge.textContent = `✓ Agent node detected (${tools.length} tools)`;
            badge.className = 'validation-badge valid';
            
            // Auto-fill config fields from agent node - but only once per unique agent
            // Use agent id + name as unique identifier
            const agentUniqueId = `${parsed.id || ''}_${parsed.name || ''}_${tools.length}`;
            if (lastAutoFilledAgentId !== agentUniqueId) {
                autoFillFromAgentNode(parsed);
                lastAutoFilledAgentId = agentUniqueId;
            }
            
            return tools;
        }
        
        // Not a valid format
        badge.textContent = '✗ Must be array or agent node';
        badge.className = 'validation-badge invalid';
        return null;
    } catch (e) {
        badge.textContent = '✗ Invalid JSON';
        badge.className = 'validation-badge invalid';
        return null;
    }
}

/**
 * Check if the JSON is an agent node from Qi Studio
 */
function isAgentNodeJson(obj) {
    if (!obj || typeof obj !== 'object') return false;
    // Agent node has type: "agent" and config.tools
    return obj.type === 'agent' && obj.config && Array.isArray(obj.config.tools);
}

// Track if we've already auto-filled from this agent config
let lastAutoFilledAgentId = null;

/**
 * Auto-fill UI fields from agent node JSON
 */
function autoFillFromAgentNode(agentNode) {
    const config = agentNode.config || {};
    const model = config.model || {};
    const structuredOutput = config.structuredOutput || {};
    
    let filledFields = [];
    
    // Fill temperature
    if (model.temperature !== undefined) {
        const tempInput = document.getElementById('temperature');
        tempInput.value = model.temperature;
        // Update the display badge
        const tempDisplay = document.getElementById('tempValue');
        if (tempDisplay) tempDisplay.textContent = model.temperature;
        filledFields.push('temperature');
    }
    
    // Fill reasoning effort
    if (model.reasoningEffort) {
        const reasoningCheckbox = document.getElementById('reasoningEnabled');
        const reasoningDropdown = document.getElementById('reasoningEffort');
        
        reasoningCheckbox.checked = true;
        reasoningDropdown.disabled = false;
        reasoningDropdown.style.opacity = '1';
        reasoningDropdown.value = model.reasoningEffort;
        
        checkReasoningConflict();
        filledFields.push('reasoning');
    }
    
    // Fill structured output - check if enable is true
    const structuredCheckbox = document.getElementById('structuredOutputEnabled');
    const structuredSchema = document.getElementById('structuredOutputSchema');
    
    if (structuredCheckbox && structuredSchema) {
        if (structuredOutput.enable === true && structuredOutput.schema) {
            // Enable and fill the schema
            structuredCheckbox.checked = true;
            structuredSchema.disabled = false;
            structuredSchema.style.opacity = '1';
            structuredSchema.style.display = 'block';
            structuredSchema.value = JSON.stringify(structuredOutput.schema, null, 2);
            filledFields.push('structured output');
        } else {
            // Disable structured output (default)
            structuredCheckbox.checked = false;
            structuredSchema.disabled = true;
            structuredSchema.style.opacity = '0.5';
            structuredSchema.style.display = 'none';
            structuredSchema.value = '';
        }
    }
    
    // Show a toast notification with what was filled
    const agentName = agentNode.name || 'agent';
    const fieldsStr = filledFields.length > 0 ? ` (${filledFields.join(', ')})` : '';
    showToast(`✓ Auto-filled from: ${agentName}${fieldsStr}`);
}

// Add event listeners for real-time validation
document.addEventListener('DOMContentLoaded', function() {
    const toolsInput = document.getElementById('toolsInput');
    const messagesInput = document.getElementById('messagesInput');
    const temperatureInput = document.getElementById('temperature');
    const topPInput = document.getElementById('topP');
    
    toolsInput.addEventListener('input', () => {
        validateJSON('toolsInput', 'toolsValidation');
        // Hide error when user starts typing
        document.getElementById('errorSection').style.display = 'none';
    });
    messagesInput.addEventListener('input', () => {
        validateJSON('messagesInput', 'messagesValidation');
        // Hide error when user starts typing
        document.getElementById('errorSection').style.display = 'none';
    });
    
    // Check reasoning conflict when temperature or top_p changes
    temperatureInput.addEventListener('input', checkReasoningConflict);
    topPInput.addEventListener('input', checkReasoningConflict);
    
    // Check warnings when max tokens changes
    const maxTokensInput = document.getElementById('maxOutputTokens');
    if (maxTokensInput) {
        maxTokensInput.addEventListener('input', checkWarnings);
    }
    
    // Check warnings when reasoning is toggled
    const reasoningCheckbox = document.getElementById('reasoningEnabled');
    if (reasoningCheckbox) {
        reasoningCheckbox.addEventListener('change', checkWarnings);
    }
});

// ============================================
// CONVERTERS
// ============================================

/**
 * Convert tools from Qi Studio format to OpenAI format
 * 
 * Qi Studio format:
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
    const normalizeSchema = (schemaNode) => {
        if (!schemaNode || typeof schemaNode !== 'object') {
            return schemaNode;
        }

        const normalized = { ...schemaNode };

        if (normalized.type === 'object') {
            const props = normalized.properties && typeof normalized.properties === 'object'
                ? normalized.properties
                : {};
            const propKeys = Object.keys(props);

            // Guardrail: object schema with no properties and additionalProperties=false
            // rejects every real object payload (common source of tool schema failures).
            if (propKeys.length === 0 && normalized.additionalProperties === false) {
                normalized.additionalProperties = true;
            }

            const normalizedProps = {};
            for (const key of propKeys) {
                normalizedProps[key] = normalizeSchema(props[key]);
            }
            normalized.properties = normalizedProps;
        }

        if (normalized.type === 'array' && normalized.items) {
            normalized.items = normalizeSchema(normalized.items);
        }

        return normalized;
    };

    return inputTools.map(tool => {
        // Check if already in OpenAI format (type === "function" and has function object)
        if (tool.type === 'function' && tool.function) {
            return tool;
        }
        
        // Convert from Qi Studio format
        const functionName = tool.alias || tool.name || 'unknown_function';
        const description = tool.description || '';
        
        // Extract parameters from config.schema or use empty object
        let parameters = { type: 'object', properties: {}, required: [] };
        if (tool.config && tool.config.schema) {
            parameters = normalizeSchema(tool.config.schema);
        } else if (tool.function && tool.function.parameters) {
            parameters = normalizeSchema(tool.function.parameters);
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
 * Build a tool-name resolver map.
 * Maps both internal tool names and aliases to the final OpenAI function name.
 */
function buildToolNameMap(inputTools) {
    const map = {};

    for (const tool of inputTools) {
        // Already OpenAI format
        if (tool.type === 'function' && tool.function && tool.function.name) {
            map[tool.function.name] = tool.function.name;
            continue;
        }

        const finalName = tool.alias || tool.name || 'unknown_function';
        if (tool.name) {
            map[tool.name] = finalName;
        }
        if (tool.alias) {
            map[tool.alias] = finalName;
        }
    }

    return map;
}

/**
 * Convert message content from Qi Studio format to OpenAI format
 * Qi Studio: content can be array [{type: "text", text: "..."}] or string
 * OpenAI: content is always a string
 */
function convertMessageContent(content) {
    // If content is already a string, return as-is
    if (typeof content === 'string') {
        return content;
    }
    
    // If content is an array (Qi Studio format)
    if (Array.isArray(content)) {
        return content
            .filter(item => item.type === 'text' && item.text)
            .map(item => item.text)
            .join('\n');
    }
    
    // If content is an object (like tool response data), stringify it
    if (content !== null && typeof content === 'object') {
        return JSON.stringify(content);
    }
    
    // Fallback
    return String(content || '');
}

/**
 * Convert messages array from Qi Studio format to OpenAI format
 * 
 * ROLE MAPPING STRATEGY:
 * 1. If role is already valid (system, user, assistant, tool, function, developer) → keep as-is
 * 2. If message has additional_kwargs.node_metadata.nodeType → use that to determine role:
 *    - nodeType = "tool" or "script" → role = "tool" (with tool_call_id from pending queue)
 *    - nodeType = "llm" or "agent" → role = "assistant"
 * 3. If unknown role with pending tool_call → role = "tool" (with tool_call_id)
 * 4. Otherwise → role = "assistant"
 * 
 * OpenAI REQUIREMENT: Every tool_call must have a matching tool response!
 */
function convertMessages(inputMessages, toolNameMap) {
    const convertedMessages = [];
    
    // Queue to track pending tool_call_ids that need responses
    const pendingToolCallIds = [];

    for (let i = 0; i < inputMessages.length; i += 1) {
        const msg = inputMessages[i];
        const content = convertMessageContent(msg.content);

        // Normalize assistant tool_calls into OpenAI format
        if (msg.role === 'assistant' && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
            const normalizedToolCalls = msg.tool_calls.map((call, idx) => {
                const callId = call.id || `call_${Date.now()}_${i}_${idx}`;

                let rawName = '';
                let rawArgs = {};

                // Qi Studio style: { id, name, args }
                if (call.name) {
                    rawName = call.name;
                    rawArgs = call.args || {};
                }

                // OpenAI-like style: { id, function: { name, arguments }, type }
                if (call.function && call.function.name) {
                    rawName = call.function.name;
                    if (typeof call.function.arguments === 'string') {
                        rawArgs = call.function.arguments;
                    } else {
                        rawArgs = call.function.arguments || {};
                    }
                }

                // Heuristic: if internal node name was used, try to infer actual tool name
                // from the immediate next message: "Executed **tool_name** ..."
                if (!toolNameMap[rawName] && inputMessages[i + 1]) {
                    const nextContent = convertMessageContent(inputMessages[i + 1].content);
                    const executedMatch = nextContent.match(/Executed \*\*([^*]+)\*\*/i);
                    if (executedMatch && executedMatch[1]) {
                        rawName = executedMatch[1].trim();
                    }
                }

                const finalName = toolNameMap[rawName] || rawName;
                const argumentsString = typeof rawArgs === 'string' ? rawArgs : JSON.stringify(rawArgs || {});

                // Track this tool_call_id - it needs a response!
                pendingToolCallIds.push(callId);

                return {
                    id: callId,
                    type: 'function',
                    function: {
                        name: finalName,
                        arguments: argumentsString
                    }
                };
            });

            convertedMessages.push({
                role: 'assistant',
                content: content || '',
                tool_calls: normalizedToolCalls
            });
            continue;
        }

        // SIMPLE LOGIC:
        // If role is user, assistant, or system → keep as-is
        // If role is anything else → it's a tool response
        
        const validRoles = new Set(['user', 'assistant', 'system']);
        
        if (validRoles.has(msg.role)) {
            // Valid role - keep as-is
            // Skip empty messages
            if (!content || content.trim() === '') {
                continue;
            }
            convertedMessages.push({
                role: msg.role,
                content: content
            });
        } else {
            // Invalid role (like "get_contracts_by_supplier_name", "store_contract_node", etc.)
            // This is a tool response - assign pending tool_call_id
            if (pendingToolCallIds.length > 0) {
                const toolCallId = pendingToolCallIds.shift();
                convertedMessages.push({
                    role: 'tool',
                    tool_call_id: toolCallId,
                    content: content || ''
                });
            }
            // If no pending tool_call_id, skip this message (orphan response)
        }
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
    const reasoningEnabled = document.getElementById('reasoningEnabled').checked;
    const structuredOutputEnabled = document.getElementById('structuredOutputEnabled')?.checked || false;
    
    let structuredOutputSchema = null;
    if (structuredOutputEnabled) {
        const schemaText = document.getElementById('structuredOutputSchema')?.value?.trim();
        if (schemaText) {
            try {
                structuredOutputSchema = JSON.parse(schemaText);
            } catch (e) {
                console.warn('Invalid structured output schema JSON');
            }
        }
    }
    
    return {
        apiEndpoint: document.getElementById('apiEndpoint').value || '',
        apiVersion: document.getElementById('apiVersion').value || '2024-02-01',
        apiKey: document.getElementById('apiKey').value || '<Your openai key>',
        hostHeader: document.getElementById('hostHeader').value || 'api.openai.com',
        temperature: parseFloat(document.getElementById('temperature').value) || 0.1,
        topP: parseFloat(document.getElementById('topP').value) || 0.1,
        toolChoice: document.getElementById('toolChoice').value || 'auto',
        frequencyPenalty: parseFloat(document.getElementById('frequencyPenalty').value) || 0,
        presencePenalty: parseFloat(document.getElementById('presencePenalty').value) || 0,
        maxOutputTokens: parseInt(document.getElementById('maxOutputTokens').value) || 1000,
        reasoningEnabled: reasoningEnabled,
        reasoningEffort: reasoningEnabled ? document.getElementById('reasoningEffort').value : null,
        structuredOutputEnabled: structuredOutputEnabled,
        structuredOutputSchema: structuredOutputSchema
    };
}

/**
 * Fix schema for OpenAI strict mode requirements:
 * 1. All properties in 'properties' must be in 'required' array
 * 2. additionalProperties must be false
 * Applies recursively for nested objects
 */
function fixSchemaForOpenAI(schema) {
    if (!schema || typeof schema !== 'object') return schema;
    
    const fixed = { ...schema };
    
    // If it's an object type with properties
    if (fixed.type === 'object' && fixed.properties) {
        // Get all property keys
        const allPropertyKeys = Object.keys(fixed.properties);
        
        // Set required to include ALL properties
        fixed.required = allPropertyKeys;
        
        // Set additionalProperties to false
        fixed.additionalProperties = false;
        
        // Recursively fix nested object properties
        const fixedProperties = {};
        for (const [key, value] of Object.entries(fixed.properties)) {
            fixedProperties[key] = fixSchemaForOpenAI(value);
        }
        fixed.properties = fixedProperties;
    }
    
    // Handle array items
    if (fixed.type === 'array' && fixed.items) {
        fixed.items = fixSchemaForOpenAI(fixed.items);
    }
    
    return fixed;
}

/**
 * Generate the request body
 */
function generateRequestBody(config, messages, tools) {
    const body = {
        temperature: config.temperature,
        top_p: config.topP,
        frequency_penalty: config.frequencyPenalty,
        presence_penalty: config.presencePenalty,
        max_completion_tokens: config.maxOutputTokens,
        tool_choice: config.toolChoice,
        messages: messages,
        tools: tools
    };
    
    // Add reasoning_effort parameter only if enabled
    if (config.reasoningEnabled && config.reasoningEffort) {
        body.reasoning_effort = config.reasoningEffort;
    }
    
    // Add structured output (response_format) if enabled
    if (config.structuredOutputEnabled && config.structuredOutputSchema) {
        // Auto-fix schema for OpenAI strict mode requirements:
        // 1. All properties must be in 'required' array
        // 2. additionalProperties must be false
        const fixedSchema = fixSchemaForOpenAI(config.structuredOutputSchema);
        
        body.response_format = {
            type: "json_schema",
            json_schema: {
                name: "structured_output",
                strict: true,
                schema: fixedSchema
            }
        };
    }
    
    return body;
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
            showError('Please enter valid Agent Configuration (agent node JSON or tools array)');
            return;
        }
        
        // Validate and parse messages
        const inputMessages = validateJSON('messagesInput', 'messagesValidation');
        if (!inputMessages) {
            showError('Please enter valid Messages JSON array');
            return;
        }
        
        // Convert tools from Qi Studio format to OpenAI format
        const convertedTools = convertTools(inputTools);
        const toolNameMap = buildToolNameMap(inputTools);
        
        // Convert messages to OpenAI format
        const convertedMessages = convertMessages(inputMessages, toolNameMap);
        
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
        
        // Show success toast with config info
        const extras = [];
        if (config.reasoningEnabled) extras.push(`reasoning: ${config.reasoningEffort}`);
        if (config.structuredOutputEnabled) extras.push('structured output');
        const extraInfo = extras.length > 0 ? ` [${extras.join(', ')}]` : '';
        showToast(`✓ Generated! ${convertedMessages.length} msgs, ${convertedTools.length} tools${extraInfo}`);
        
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
 * Open generated request in Postman
 */
function openInPostman() {
    try {
        // Get the request body from the output
        const bodyOutput = document.getElementById('bodyOutput');
        if (!bodyOutput || !bodyOutput.textContent.trim()) {
            showToast('Generate a request first!');
            return;
        }
        
        const requestBody = bodyOutput.textContent;
        const config = getConfig();
        
        // Build the API URL
        let apiUrl = config.apiEndpoint;
        if (apiUrl && !apiUrl.includes('api-version') && config.apiVersion) {
            apiUrl += (apiUrl.includes('?') ? '&' : '?') + 'api-version=' + config.apiVersion;
        }
        
        // Create Postman collection format
        const postmanCollection = {
            info: {
                name: "Qi Studio Generated Request",
                schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            item: [{
                name: "OpenAI Chat Completion",
                request: {
                    method: "POST",
                    header: [
                        { key: "Content-Type", value: "application/json" },
                        { key: "api-key", value: config.apiKey || "{{api-key}}" }
                    ],
                    body: {
                        mode: "raw",
                        raw: requestBody,
                        options: { raw: { language: "json" } }
                    },
                    url: {
                        raw: apiUrl || "https://your-endpoint.openai.azure.com/openai/deployments/gpt-4/chat/completions",
                        protocol: (apiUrl || "").startsWith("https") ? "https" : "http",
                        host: [(apiUrl || "").split("//")[1]?.split("/")[0] || "your-endpoint.openai.azure.com"],
                        path: (apiUrl || "").split("//")[1]?.split("/").slice(1).join("/").split("?")[0].split("/") || []
                    }
                }
            }]
        };
        
        // Add host header if specified
        if (config.hostHeader) {
            postmanCollection.item[0].request.header.push({ key: "Host", value: config.hostHeader });
        }
        
        // Convert to JSON and encode for URL
        const collectionJson = JSON.stringify(postmanCollection);
        const encodedCollection = encodeURIComponent(collectionJson);
        
        // Try to open Postman with the collection
        // Method 1: Postman deep link (opens Postman app if installed)
        const postmanDeepLink = `postman://app/collections/import?data=${encodedCollection}`;
        
        // Create a hidden iframe to try the deep link
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        // Try deep link
        iframe.src = postmanDeepLink;
        
        // Show success message with fallback instructions
        setTimeout(() => {
            document.body.removeChild(iframe);
            showToast('Opening Postman... If not opened, copy the JSON body and import manually.');
        }, 500);
        
        // Also try window.open as fallback (some browsers block iframe approach)
        window.open(postmanDeepLink, '_blank');
        
    } catch (err) {
        console.error('Postman open error:', err);
        showToast('Could not open Postman. Copy the request body and import manually.');
    }
}

/**
 * Toggle API key visibility
 */
function toggleApiKeyVisibility() {
    const input = document.getElementById('apiKey');
    const eyeIcon = document.getElementById('eyeIcon');
    
    if (input.type === 'password') {
        input.type = 'text';
        eyeIcon.textContent = 'Hide';
    } else {
        input.type = 'password';
        eyeIcon.textContent = 'Show';
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
        // Hide any previous error
        document.getElementById('errorSection').style.display = 'none';
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
        badge.textContent = 'Paste JSON array or agent node';
        badge.className = 'validation-badge';
        // Reset auto-fill tracking so next paste will auto-fill again
        lastAutoFilledAgentId = null;
    } else if (inputId === 'messagesInput') {
        const badge = document.getElementById('messagesValidation');
        badge.textContent = 'Paste JSON array';
        badge.className = 'validation-badge';
    }
}

