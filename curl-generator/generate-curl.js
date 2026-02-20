/**
 * LLM Curl Generator Script
 * Generates OpenAI Chat Completion API curl commands
 */

// ============================================
// CONFIGURATION - Modify these values
// ============================================

const config = {
    // API Settings
    apiEndpoint: "https://135.237.31.202/platform2/openai/deployments/gpt-5.2/chat/completions",
    apiVersion: "2025-04-01-preview",
    apiKey: "<Your openai key>", // Replace with actual key
    hostHeader: "openaiqc.gep.com",
    
    // Model Parameters
    temperature: 0.1,
    topP: 0.1,
    toolChoice: "auto"
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
    // Build the request body
    const requestBody = {
        temperature: config.temperature,
        top_p: config.topP,
        tool_choice: config.toolChoice,
        messages: messages,
        tools: tools
    };

    // Convert to JSON string and escape for shell
    const jsonBody = JSON.stringify(requestBody, null, 4);
    
    // Escape single quotes for shell (replace ' with '\''）
    const escapedBody = jsonBody.replace(/'/g, "'\\''");

    // Build the full URL with query params
    const fullUrl = `${config.apiEndpoint}?api-version=${config.apiVersion}&api-key=${config.apiKey}`;

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
    // Build the request body
    const requestBody = {
        temperature: config.temperature,
        top_p: config.topP,
        tool_choice: config.toolChoice,
        messages: messages,
        tools: tools
    };

    const fullUrl = `${config.apiEndpoint}?api-version=${config.apiVersion}&api-key=${config.apiKey}`;

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

