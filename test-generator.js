/**
 * LLM CURL GENERATOR - Test Script
 * Converts KeyStudio format to OpenAI Chat Completion API format
 * Run with: node test-generator.js
 */

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    apiEndpoint: "https://135.237.31.202/platform2/openai/deployments/gpt-5.2/chat/completions",
    apiVersion: "2025-04-01-preview",
    apiKey: "<Your openai key>", // User will provide this
    hostHeader: "openaiqc.gep.com",
    temperature: 0.1,
    topP: 0.1,
    toolChoice: "auto"
};

// ============================================
// INPUT: USER'S MESSAGE FORMAT (from KeyStudio)
// This is the format user will paste - can have content as array or string
// ============================================
const USER_INPUT_MESSAGES = [
    {
        "content": [
            {
                "type": "text",
                "text": "# Supplier Profile Update Assistant - System Prompt\n\nYou are a Supplier Profile Update Request Intake Agent built by GEP. You guide users through updating supplier information conversationally."
            }
        ],
        "role": "system"
    },
    {
        "content": "Summary Conversation: User initially requested to remove/offboard supplier Algolia Inc and provided reason 'Not approved by TPRM'. User now requests to temporarily block the supplier (not permanent offboarding).",
        "role": "user"
    },
    {
        "content": "",
        "role": "user"
    },
    {
        "content": "I want to temporary block the supplier",
        "role": "user"
    }
];

// ============================================
// INPUT: TOOLS (from KeyStudio)
// ============================================
const USER_INPUT_TOOLS = [
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
                    "thoughts": { "type": "string" },
                    "reasoning": { "type": "string" }
                },
                "required": ["data", "thoughts", "reasoning"]
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
];

// ============================================
// CONVERTER FUNCTIONS
// ============================================

/**
 * Convert tools from KeyStudio format to OpenAI format
 * 
 * KeyStudio: { type: "tool", config: { schema: {...} }, alias: "name" }
 * OpenAI:    { type: "function", function: { name, description, parameters } }
 */
function convertTools(inputTools) {
    return inputTools.map(tool => {
        // Already in OpenAI format
        if (tool.type === 'function' && tool.function) {
            return tool;
        }
        
        // Convert from KeyStudio format
        const functionName = tool.alias || tool.name || 'unknown_function';
        const description = tool.description || '';
        
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
 * KeyStudio format: content can be array [{type: "text", text: "..."}] or string
 * OpenAI format: content is always a string
 */
function convertMessageContent(content) {
    // If content is already a string, return as-is
    if (typeof content === 'string') {
        return content;
    }
    
    // If content is an array (KeyStudio format with type/text objects)
    if (Array.isArray(content)) {
        // Extract text from all text-type objects and join
        return content
            .filter(item => item.type === 'text' && item.text)
            .map(item => item.text)
            .join('\n');
    }
    
    // Fallback: convert to string
    return String(content || '');
}

/**
 * Convert messages array from KeyStudio format to OpenAI format
 * - Converts content arrays to strings
 * - Filters out empty messages
 * - Ensures proper role/content structure
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

/**
 * Generate the full request body for OpenAI API
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
 * Generate curl command with full body
 */
function generateCurlCommand(config, requestBody) {
    const fullUrl = `${config.apiEndpoint}?api-version=${config.apiVersion}&api-key=${config.apiKey}`;
    
    // Pretty print JSON for readability
    const jsonBody = JSON.stringify(requestBody, null, 4);
    
    // Escape single quotes for bash shell
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
// MAIN EXECUTION
// ============================================

console.log("\n" + "=".repeat(80));
console.log("   🔧 LLM CURL GENERATOR - MESSAGE CONVERTER");
console.log("=".repeat(80));

// Step 1: Convert messages from KeyStudio format to OpenAI format
console.log("\n📥 INPUT MESSAGES (KeyStudio format):");
console.log(`   Total messages: ${USER_INPUT_MESSAGES.length}`);

const convertedMessages = convertMessages(USER_INPUT_MESSAGES);

console.log("\n📤 CONVERTED MESSAGES (OpenAI format):");
console.log(`   Total messages (after filtering empty): ${convertedMessages.length}`);

// Show converted messages summary
convertedMessages.forEach((msg, i) => {
    const preview = msg.content.substring(0, 60).replace(/\n/g, ' ');
    console.log(`   [${i + 1}] ${msg.role}: "${preview}..."`);
});

// Step 2: Convert tools from KeyStudio format to OpenAI format
const convertedTools = convertTools(USER_INPUT_TOOLS);
console.log("\n📤 CONVERTED TOOLS (OpenAI format):");
console.log(`   Total tools: ${convertedTools.length}`);
convertedTools.slice(0, 3).forEach((tool, i) => {
    console.log(`   [${i + 1}] ${tool.function.name}`);
});
if (convertedTools.length > 3) {
    console.log(`   ... and ${convertedTools.length - 3} more`);
}

// Step 3: Generate the full request body
const requestBody = generateRequestBody(CONFIG, convertedMessages, convertedTools);

// Step 3: Output the body JSON
console.log("\n" + "-".repeat(80));
console.log("📋 REQUEST BODY (JSON):");
console.log("-".repeat(80));
console.log(JSON.stringify(requestBody, null, 2));

// Step 4: Generate curl command
console.log("\n" + "-".repeat(80));
console.log("📋 CURL COMMAND:");
console.log("-".repeat(80));
console.log(generateCurlCommand(CONFIG, requestBody));

// Step 5: Generate PowerShell command
console.log("\n" + "-".repeat(80));
console.log("📋 POWERSHELL COMMAND:");
console.log("-".repeat(80));
console.log(generatePowerShellCommand(CONFIG, requestBody));

// Step 6: Save files
const fs = require('fs');

// Save the body JSON
fs.writeFileSync('body.json', JSON.stringify(requestBody, null, 2));
console.log("\n✅ Saved body.json");

// Save just the converted messages
fs.writeFileSync('converted-messages.json', JSON.stringify(convertedMessages, null, 2));
console.log("✅ Saved converted-messages.json");

console.log("\n" + "=".repeat(80));
console.log("✅ Generation Complete!");
console.log("=".repeat(80) + "\n");
