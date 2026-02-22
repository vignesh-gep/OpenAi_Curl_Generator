/**
 * LLM Curl Generator Script
 * Generates OpenAI Chat Completion API curl commands
 */

// ============================================
// CONFIGURATION - Modify these values
// ============================================

const config = {
    // API Settings
    apiEndpoint: "https://your-endpoint.com/openai/deployments/gpt-5.2/chat/completions",
    apiVersion: "2025-04-01-preview",
    apiKey: "<Your openai key>", // Replace with actual key
    hostHeader: "your-endpoint.com",
    
    // Model Parameters
    temperature: 1,
    topP: 1,
    toolChoice: "auto",
    frequencyPenalty: 0,
    presencePenalty: 0,
    maxOutputTokens: 1000,
    reasoningEffort: null,       // Set to "low", "medium", "high" if using reasoning
    responseFormat: null          // Set to { type: "json_schema", json_schema: {...} } if needed
};

// ============================================
// TOOLS - Paste your tools JSON array here
// ============================================

const tools = [
    {
        "type": "function",
        "function": {
            "name": "getsuppliers",
            "description": "Searches suppliers by name or code",
            "parameters": {
                "type": "object",
                "properties": {
                    "data": {
                        "type": "object",
                        "properties": {
                            "supplierName": { "type": "string" },
                            "supplierIdentificationNumber": { "type": "string" }
                        }
                    },
                    "event": { "type": "string" },
                    "additionalData": { "type": "object" },
                    "thoughts": { "type": "string" },
                    "reasoning": { "type": "string" }
                },
                "required": ["data", "event", "additionalData", "thoughts", "reasoning"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "single_supplier",
            "description": "Renders supplier confirmation view",
            "parameters": {
                "type": "object",
                "properties": {
                    "thoughts": { "type": "string" },
                    "reasoning": { "type": "string" }
                },
                "required": ["thoughts", "reasoning"]
            }
        }
    }
    // Add more tools as needed...
];

// ============================================
// MESSAGES - Define your conversation here
// ============================================

const messages = [
    {
        "role": "system",
        "content": "You are a helpful assistant."
    },
    {
        "role": "user", 
        "content": "I want to temporary block the supplier Algolia Inc"
    }
];

// ============================================
// CURL GENERATOR FUNCTION
// ============================================

function generateCurl(config, messages, tools) {
    // Build the request body with ALL parameters
    const requestBody = {
        temperature: config.temperature,
        top_p: config.topP,
        frequency_penalty: config.frequencyPenalty || 0,
        presence_penalty: config.presencePenalty || 0,
        max_completion_tokens: config.maxOutputTokens || 1000,
        tool_choice: config.toolChoice,
        messages: messages,
        tools: tools
    };

    // Add reasoning_effort if configured
    if (config.reasoningEffort) {
        requestBody.reasoning_effort = config.reasoningEffort;
    }

    // Add response_format (structured output) if configured
    if (config.responseFormat) {
        requestBody.response_format = config.responseFormat;
    }

    // Convert to JSON string and escape for shell
    const jsonBody = JSON.stringify(requestBody, null, 4);
    
    // Escape single quotes for shell (replace ' with '\''）
    const escapedBody = jsonBody.replace(/'/g, "'\\''");

    // Build the full URL with query params
    const separator = config.apiEndpoint.includes('?') ? '&' : '?';
    const fullUrl = `${config.apiEndpoint}${separator}api-version=${config.apiVersion}&api-key=${config.apiKey}`;

    // Generate curl command
    const curlCommand = `curl --location '${fullUrl}' \\
--header 'Host: ${config.hostHeader}' \\
--header 'Content-Type: application/json' \\
--data '${escapedBody}'`;

    return curlCommand;
}

// ============================================
// ALTERNATIVE: Generate with JSON in separate file
// ============================================

function generateCurlWithFileRef(config, messages, tools) {
    // Build the request body with ALL parameters
    const requestBody = {
        temperature: config.temperature,
        top_p: config.topP,
        frequency_penalty: config.frequencyPenalty || 0,
        presence_penalty: config.presencePenalty || 0,
        max_completion_tokens: config.maxOutputTokens || 1000,
        tool_choice: config.toolChoice,
        messages: messages,
        tools: tools
    };

    // Add reasoning_effort if configured
    if (config.reasoningEffort) {
        requestBody.reasoning_effort = config.reasoningEffort;
    }

    // Add response_format (structured output) if configured
    if (config.responseFormat) {
        requestBody.response_format = config.responseFormat;
    }

    const separator = config.apiEndpoint.includes('?') ? '&' : '?';
    const fullUrl = `${config.apiEndpoint}${separator}api-version=${config.apiVersion}&api-key=${config.apiKey}`;

    // For PowerShell - using Invoke-RestMethod
    const powershellCommand = `$body = @'
${JSON.stringify(requestBody, null, 2)}
'@

Invoke-RestMethod -Uri '${fullUrl}' \`
    -Method Post \`
    -Headers @{ 'Host' = '${config.hostHeader}'; 'Content-Type' = 'application/json' } \`
    -Body $body`;

    return powershellCommand;
}

// ============================================
// MAIN EXECUTION
// ============================================

console.log("=".repeat(60));
console.log("🔧 LLM CURL GENERATOR");
console.log("=".repeat(60));
console.log("\n📋 CURL COMMAND (for bash/cmd):\n");
console.log("-".repeat(60));

const curlCmd = generateCurl(config, messages, tools);
console.log(curlCmd);

console.log("\n" + "-".repeat(60));
console.log("\n📋 POWERSHELL COMMAND:\n");
console.log("-".repeat(60));

const psCmd = generateCurlWithFileRef(config, messages, tools);
console.log(psCmd);

console.log("\n" + "=".repeat(60));
console.log("✅ Commands generated successfully!");
console.log("=".repeat(60));

// Export for use as module
module.exports = { generateCurl, generateCurlWithFileRef, config };

