const fs = require('fs');
const vm = require('vm');

// Minimal browser stubs so script.js can load in Node
const fakeEl = () => ({
  value: '',
  textContent: '',
  className: '',
  style: {},
  addEventListener: () => {},
  scrollIntoView: () => {},
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

theCode = fs.readFileSync('script.js', 'utf8');
vm.runInThisContext(theCode);

const inputTools = [
  {
    name: 'handoff_to_node',
    alias: 'store_description_of_changes_handoff',
    description: 'Stores description',
    type: 'tool',
    config: { schema: { type: 'object', properties: { thoughts: { type: 'string' } }, required: ['thoughts'] } }
  },
  {
    type: 'function',
    function: {
      name: 'create_summary',
      description: 'summary',
      parameters: {
        type: 'object',
        properties: {
          collectedData: { type: 'object', properties: {}, additionalProperties: false }
        },
        required: ['collectedData']
      }
    }
  }
];

const inputMessages = [
  { role: 'system', content: [{ type: 'text', text: 'System prompt' }] },
  { role: 'user', content: 'hello' },
  { role: 'assistant', content: '', tool_calls: [{ id: 'c1', name: 'get_contract_details', args: {} }] },
  { role: 'get_contract_details', content: 'Executed **fetch_contract_details**, result: {}' },
  { role: 'assistant', content: 'done' },
  { role: 'validate_date_backend', content: 'Executed **validate_extension_date** ok' }
];

const tools = convertTools(inputTools);
const toolMap = buildToolNameMap(inputTools);
const messages = convertMessages(inputMessages, toolMap);

const invalidRoles = messages.filter(m => !['system','user','assistant','tool','function','developer'].includes(m.role));
const toolTypeOk = tools.every(t => t.type === 'function' && t.function && t.function.name);

console.log('Converted tools:', tools.length);
console.log('Converted messages:', messages.length);
console.log('Invalid roles count:', invalidRoles.length);
console.log('All tools function format:', toolTypeOk);

console.log('\nMessages preview:');
for (const m of messages) {
  console.log('-', m.role, m.tool_call_id ? `(tool_call_id=${m.tool_call_id})` : '');
}

if (invalidRoles.length > 0 || !toolTypeOk) {
  process.exit(1);
}
