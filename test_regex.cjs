const fs = require('fs');
const content = fs.readFileSync('./core/base/MODES.md', 'utf8');

const getModeBlock = (content, tag) => {
    if (!content) return '';
    const escapedTag = tag.replace(/[-]/g, '\\-');
    const match = content.match(new RegExp(`\\[${escapedTag}\\]\\s*\\r?\\n([\\s\\S]*?)(?=\\n\\s*\\[\\/${escapedTag}\\]|$)`));
    return match ? match[1].trim() : 'NOT FOUND';
};

console.log('--- CHAT_MODE_TIPS (first 200 chars) ---');
const tips = getModeBlock(content, 'CHAT_MODE_TIPS');
console.log(tips.substring(0, 200));
console.log('\n--- AGENT_TIPS (first 200 chars) ---');
const agentTips = getModeBlock(content, 'AGENT_TIPS');
console.log(agentTips.substring(0, 200));
console.log('\n--- INSTRUCTION_MODE_MANDATORY (first 200 chars) ---');
const inst = getModeBlock(content, 'INSTRUCTION_MODE_MANDATORY');
console.log(inst.substring(0, 200));
console.log('\n--- SCHEDULED_TASK_AUTO-PILOT (first 200 chars) ---');
const sched = getModeBlock(content, 'SCHEDULED_TASK_AUTO-PILOT');
console.log(sched.substring(0, 200));
