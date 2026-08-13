#!/usr/bin/env node
/**
 * TAG CSM Operating Manual — HTML Generator
 * Reads manual-content.json and builds 13 standalone HTML files
 */

const fs = require('fs');
const path = require('path');

// Load the JSON data
const jsonPath = path.join(__dirname, 'manual-content.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// CSS — identical to source document
const CSS = `
:root{
  --ink:#050505;
  --paper:#fbf9f4;
  --signal:#cc901b;
  --signal-deep:#a3730f;
  --stop:#b02a1f;
  --stop-tint:#fdf1ef;
  --go:#1a6b45;
  --go-tint:#eef7f2;
  --graphite:#5c6370;
  --field:#f0ede4;
  --line:#ddd8cb;
  --line-soft:#e9e5da;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --disp:Georgia,"Iowan Old Style","Times New Roman",Times,serif;
}
*{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{
  font-family:var(--sans);
  background:var(--paper);
  color:var(--ink);
  font-size:15px;
  line-height:1.55;
  -webkit-font-smoothing:antialiased;
  padding:44px 52px 120px;
  max-width:1020px;
  margin:0 auto;
}
.eyebrow{
  font-family:var(--mono);font-size:11px;font-weight:500;
  letter-spacing:.15em;text-transform:uppercase;color:var(--signal-deep);
  margin-bottom:9px;
}
h1{font-family:var(--disp);font-size:32px;font-weight:600;letter-spacing:0;line-height:1.15;margin-bottom:12px;}
h2{
  font-size:15px;font-weight:600;margin:38px 0 12px;
  padding-bottom:7px;border-bottom:2px solid var(--ink);
  letter-spacing:-.005em;
  display:flex;align-items:baseline;gap:10px;
}
h2 .n{font-family:var(--mono);font-size:11.5px;color:var(--graphite);font-weight:500;}
h3{font-size:14px;font-weight:600;margin:24px 0 8px;}
p{margin-bottom:12px;max-width:74ch;}
.lede{font-size:16.5px;color:var(--graphite);max-width:70ch;margin-bottom:26px;line-height:1.5;}
ul,ol{margin:0 0 14px 20px;max-width:74ch;}
li{margin-bottom:5px;}
strong{font-weight:600;}
em{font-style:italic;color:var(--graphite);}
table{
  width:100%;border-collapse:collapse;margin:14px 0 22px;
  font-size:13px;background:#fff;
  border:1px solid var(--line);
}
th{
  background:var(--field);
  font-family:var(--mono);font-size:10.5px;font-weight:600;
  letter-spacing:.09em;text-transform:uppercase;color:var(--graphite);
  text-align:left;padding:9px 12px;
  border-bottom:1px solid var(--line);
}
td{padding:9px 12px;border-bottom:1px solid var(--line-soft);vertical-align:top;}
tbody tr:last-child td{border-bottom:none;}
td.v{font-family:var(--mono);font-size:12.5px;}
.stop{color:var(--stop);font-weight:600;}
.go{color:var(--go);font-weight:600;}
.note{
  border-left:3px solid var(--signal);
  background:#fffdf0;
  padding:13px 17px;margin:16px 0;font-size:14px;max-width:76ch;
}
.note.hard{border-left-color:var(--stop);background:var(--stop-tint);}
.note.good{border-left-color:var(--go);background:var(--go-tint);}
.note-tag{
  font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.13em;
  text-transform:uppercase;display:block;margin-bottom:5px;color:var(--signal-deep);
}
.note.hard .note-tag{color:var(--stop);}
.note.good .note-tag{color:var(--go);}
.note p:last-child{margin-bottom:0;}
.proc{border:1px solid var(--line);background:#fff;margin:14px 0;}
.proc-head{
  display:flex;align-items:center;gap:11px;
  padding:11px 16px;background:var(--field);
  border-bottom:1px solid var(--line);
}
.proc-ref{
  font-family:var(--mono);font-size:11px;font-weight:600;
  color:#fff;background:var(--ink);padding:2px 7px;
}
.proc-title{font-size:13.5px;font-weight:600;}
.proc-body{padding:14px 17px;}
.proc-body ol{margin-bottom:0;}
.proc-body p:last-child{margin-bottom:0;}
.instrument{
  border:1px solid var(--line);background:#fff;margin:18px 0;
}
.instrument-head{
  padding:11px 17px;background:var(--ink);color:#fff;
  font-family:var(--mono);font-size:10.5px;font-weight:600;
  letter-spacing:.13em;text-transform:uppercase;
}
.instrument-body{padding:18px;}
.inputs{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:16px;}
.fieldset{flex:1;min-width:150px;}
label{
  display:block;font-family:var(--mono);font-size:10.5px;font-weight:500;
  letter-spacing:.08em;text-transform:uppercase;color:var(--graphite);margin-bottom:5px;
}
input[type=number],select{
  width:100%;padding:8px 10px;
  border:1px solid var(--line);background:var(--field);
  font-family:var(--mono);font-size:14px;color:var(--ink);
  border-radius:0;
}
input[type=number]:focus,select:focus{
  outline:2px solid var(--signal);outline-offset:-1px;background:#fff;
}
.readout{display:flex;flex-wrap:wrap;gap:1px;background:var(--line);border:1px solid var(--line);}
.cell{flex:1;min-width:110px;background:#fff;padding:13px 15px;}
.cell-k{
  font-family:var(--mono);font-size:10px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--graphite);margin-bottom:4px;
}
.cell-v{font-family:var(--mono);font-size:22px;font-weight:600;letter-spacing:-.02em;}
.verdict{
  margin-top:14px;padding:12px 15px;font-size:13.5px;
  border-left:3px solid var(--graphite);background:var(--field);
}
.verdict.pass{border-left-color:var(--go);background:var(--go-tint);}
.verdict.fail{border-left-color:var(--stop);background:var(--stop-tint);}
.verdict b{font-weight:600;}
.kbd{
  font-family:var(--mono);font-size:11.5px;background:var(--field);
  border:1px solid var(--line);padding:1px 6px;
}
.pill{
  display:inline-block;font-family:var(--mono);font-size:10px;font-weight:600;
  letter-spacing:.1em;text-transform:uppercase;padding:2px 8px;
  background:var(--ink);color:#fff;vertical-align:middle;
}
.pill.warn{background:var(--stop);}
footer{
  margin-top:52px;padding-top:16px;border-top:1px solid var(--line);
  font-family:var(--mono);font-size:11px;color:var(--graphite);
}
@media (max-width:900px){
  body{padding:28px 20px 80px;}
  h1{font-size:26px;}
  .inputs{flex-direction:column;}
}
`;

/**
 * Render a block to HTML
 */
function renderBlock(block) {
  switch (block.type) {
    case 'paragraph':
      return `
        <div>
          ${block.title ? `<h3>${block.title}</h3>` : ''}
          ${block.content.split('\n\n').map(p => `<p>${p}</p>`).join('')}
          ${block.caveat ? `
            <div class="note">
              <span class="note-tag">${block.caveatLabel || 'Note'}</span>
              <p>${block.caveat}</p>
            </div>
          ` : ''}
        </div>
      `;

    case 'heading':
      return `
        <div>
          ${block.title ? `<h2><span class="n">${block.title.split(' ').slice(0, 1).join('')}</span> ${block.title.split(' ').slice(1).join(' ')}</h2>` : ''}
          ${block.content.split('\n\n').map(p => `<p>${p}</p>`).join('')}
        </div>
      `;

    case 'table':
      return `
        <table>
          ${block.title ? `<caption style="text-align:left;caption-side:top;padding-bottom:10px;font-weight:600;">${block.title}</caption>` : ''}
          <thead>
            <tr>
              ${block.headers.map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${block.rows.map(row => `
              <tr>
                ${row.map(cell => `<td${cell.startsWith('$') || cell.match(/^\\d+/) ? ' class="v"' : ''}>${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

    case 'note':
      const severity = block.severity || '';
      return `
        <div class="note ${severity}">
          ${block.title ? `<span class="note-tag">${block.title}</span>` : ''}
          <p>${block.content}</p>
        </div>
      `;

    case 'procedure':
      return `
        <div class="proc">
          <div class="proc-head">
            <span class="proc-ref">${block.ref}</span>
            <span class="proc-title">${block.title}</span>
          </div>
          <div class="proc-body">
            <ol>
              ${block.steps.map(step => `<li>${step}</li>`).join('')}
            </ol>
            ${block.note ? `<p style="margin-top:12px;"><em>${block.note}</em></p>` : ''}
            ${block.warning ? `<p class="stop" style="margin-bottom:10px;">${block.warning}</p>` : ''}
          </div>
        </div>
      `;

    case 'instrument':
      const fieldIds = block.fields.map(f => f.id).join(', ');
      const hasOutputs = block.outputs && block.outputs.length > 0;
      return `
        <div class="instrument">
          <div class="instrument-head">${block.title}</div>
          <div class="instrument-body">
            <div class="inputs">
              ${block.fields.map(f => `
                <div class="fieldset">
                  <label for="${f.id}">${f.label}</label>
                  ${f.type === 'select'
                    ? `<select id="${f.id}">
                        ${f.options.map(o => `<option value="${o.value}">${o.text}</option>`).join('')}
                       </select>`
                    : `<input type="number" id="${f.id}" value="${f.default}" min="0" step="50">`
                  }
                </div>
              `).join('')}
            </div>
            ${hasOutputs ? `
            <div class="readout">
              ${block.outputs.map(o => `
                <div class="cell">
                  <div class="cell-k">${o.label}</div>
                  <div class="cell-v" id="${o.id}">—</div>
                </div>
              `).join('')}
            </div>
            <div class="verdict" id="${block.fields[0].id}-verdict">Enter figures to evaluate.</div>
            ` : `
            <div class="verdict" id="${block.fields[0].id}-verdict">Answer the three questions for a recommendation.</div>
            `}
          </div>
        </div>
      `;

    default:
      return '';
  }
}

/**
 * Generate a single page HTML
 */
function generatePage(page) {
  const pageNum = page.num.padStart(2, '0');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${page.title} — TAG CSM Operating Manual</title>
<style>
${CSS}
</style>
</head>
<body>
  <div class="eyebrow">${page.eyebrow}</div>
  <h1>${page.title}</h1>
  <p class="lede">${page.lede}</p>

  ${page.blocks.map(block => renderBlock(block)).join('\n')}

  <footer>
    <p>TAG CSM Operating Manual · Section ${pageNum} · v${data.meta.version}</p>
  </footer>
</body>
</html>`;

  return html;
}

// Generate all pages
console.log('Generating TAG CSM Operating Manual HTML files...\n');

data.pages.forEach(page => {
  const pageNum = page.num.padStart(2, '0');
  const filename = path.join(__dirname, `${pageNum}.html`);
  const html = generatePage(page);

  fs.writeFileSync(filename, html, 'utf-8');
  console.log(`✓ ${filename}`);
});

console.log(`\n✓ Generated ${data.pages.length} pages`);
console.log(`\nNext steps:`);
console.log(`  1. Review the generated HTML files (00.html through 13.html)`);
console.log(`  2. Update the generation script if block rendering needs adjustment`);
console.log(`  3. Run: node generate-manual.js`);
