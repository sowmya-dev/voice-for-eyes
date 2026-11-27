// Checks ground rules G2, G6/G8 and unique requirement ownership. Run: node openspec/check-rules.js
const fs = require('fs');
const path = require('path');

const changes = path.join(__dirname, 'changes');
const HEADINGS = ['Context', 'Design decisions', 'High-level architecture flow', 'Low-level component design',
  'Data contracts', 'Tool schemas', 'Agent flow', 'Open decisions', 'Risks'];
const read = f => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : '');
const errors = [];
const pending = [];
const owners = new Map();

for (const change of fs.readdirSync(changes).filter(c => c !== 'archive')) {
  const dir = path.join(changes, change);
  const specsDir = path.join(dir, 'specs');
  if (!fs.existsSync(specsDir)) { pending.push(change); continue; }

  const requirements = new Map(); // name -> scenario names
  for (const file of fs.readdirSync(specsDir, { recursive: true }).filter(f => f.endsWith('spec.md'))) {
    const capability = path.dirname(file);
    const blocks = read(path.join(specsDir, file)).split(/^## (?=ADDED|MODIFIED|REMOVED|RENAMED)/m)
      .filter(s => /^(ADDED|MODIFIED)/.test(s)).join('\n').split(/^### Requirement: /m).slice(1);
    for (const block of blocks) {
      const name = block.split('\n')[0].trim();
      requirements.set(name, [...block.matchAll(/^#### Scenario: (.+)$/gm)].map(m => m[1].trim()));
      const key = `${capability}: ${name}`;
      if (owners.has(key)) errors.push(`${key} is in both ${owners.get(key)} and ${change}`);
      owners.set(key, change);
    }
  }

  const tasks = read(path.join(dir, 'tasks.md')).split('\n').filter(l => /^\s*- \[.*?\]/.test(l));
  const tagged = new Map();
  for (const task of tasks) {
    const tags = [...task.matchAll(/\[Requirement: ([^\]]+)\]/g)].map(m => m[1]);
    if (tags.length !== 1 || !requirements.has(tags[0])) { errors.push(`${change}: task needs one known requirement tag: ${task}`); continue; }
    if (tagged.has(tags[0])) errors.push(`${change}: two tasks for "${tags[0]}"`);
    tagged.set(tags[0], task);
  }
  for (const [name, scenarios] of requirements) {
    if (!tagged.has(name)) { errors.push(`${change}: no task for "${name}"`); continue; }
    for (const s of scenarios) if (!tagged.get(name).includes(`"${s}"`)) errors.push(`${change}: task for "${name}" omits scenario "${s}"`);
  }

  const design = read(path.join(dir, 'design.md'));
  for (const h of HEADINGS) if (!new RegExp(`^## ${h}$`, 'm').test(design)) errors.push(`${change}: design.md lacks "## ${h}"`);
}

console.log(`${owners.size} requirements checked`);
if (pending.length) console.log(`No specs yet: ${pending.join(', ')}`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Ground rule checks passed');
