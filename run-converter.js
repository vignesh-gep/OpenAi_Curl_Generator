const fs = require('fs');

// Load the script.js functions
const scriptContent = fs.readFileSync('./script.js', 'utf8');

// Create minimal browser stubs
const fakeEl = () => ({
    value: '', textContent: '', className: '', style: {},
    addEventListener: () => {}, scrollIntoView: () => {},
    querySelector: () => ({ innerHTML: '', classList: { add(){}, remove(){} } }),
    closest: () => ({ querySelector: () => ({ innerHTML: '', classList: { add(){}, remove(){} } }) })
});

global.document = {
    addEventListener: () => {},
    getElementById: () => fakeEl(),
    querySelector: () => null,
    body: { appendChild: () => {} },
    createElement: () => fakeEl()
};
global.navigator = { clipboard: { writeText: async () => {} } };

// Execute script.js to get functions
eval(scriptContent);

// Load input
const input = JSON.parse(fs.readFileSync('./test-input.json', 'utf8'));

// Convert tools
const convertedTools = convertTools(input.tools);

// Build tool name map
const toolMap = buildToolNameMap(input.tools);

// Convert messages
const convertedMessages = convertMessages(input.messages, toolMap);

// Build final request body
const requestBody = {
    temperature: 0.1,
    top_p: 0.1,
    tool_choice: "auto",
    messages: convertedMessages,
    tools: convertedTools
};

// Write output
fs.writeFileSync('./converted-output.json', JSON.stringify(requestBody, null, 2));

console.log('=== CONVERSION COMPLETE ===');
console.log('Messages:', convertedMessages.length);
console.log('Tools:', convertedTools.length);
console.log('');
console.log('Message roles:');
convertedMessages.forEach((m, i) => {
    console.log(`  ${i}: ${m.role}${m.tool_call_id ? ` (tool_call_id=${m.tool_call_id})` : ''}${m.tool_calls ? ` (has tool_calls)` : ''}`);
});
console.log('');
console.log('Output written to: converted-output.json');

