const fs = require('fs');
let content = fs.readFileSync('modules/voucher.js', 'utf8');

// Replace label
content = content.replace(
  /<label>내용 <span class="badge badge-neutral">수동입력<\/span><\/label>/g,
  '<label>관련근거 <span class="badge badge-neutral">수동입력</span></label>'
);

// Replace textarea with inputs (use regex whitespace tolerance)
content = content.replace(
  /<textarea id="v-content"[^>]*placeholder="[^"]*".*?<\/textarea>/s,
  `<div style="display:flex; gap:10px;">
    <input type="text" id="v-draft-doc-no" class="form-control" placeholder="내부결재기안 문서번호 (예: 산학협력단-000)" style="flex:1;">
    <input type="text" id="v-draft-title" class="form-control" placeholder="기안제목" style="flex:2;">
  </div>`
);

// Replace script logic
content = content.replace(
  /const content = document\.getElementById\('v-content'\)\?\.value \|\| '';/g,
  `const docNo = document.getElementById('v-draft-doc-no')?.value || '';
    const draftTitle = document.getElementById('v-draft-title')?.value || '';
    const content = (docNo || draftTitle) ? \`[문서번호] \${docNo}\\n[기안제목] \${draftTitle}\` : (document.getElementById('v-content')?.value || '');`
);

// Replace PDF printed doc label
content = content.replace(
  /<td class="voucher-doc-label" style="height:80px;">내용<\/td>/g,
  '<td class="voucher-doc-label" style="height:80px;">관련근거</td>'
);

fs.writeFileSync('modules/voucher.js', content, 'utf8');

if (content.includes('v-draft-doc-no')) {
    console.log('Update actually succeeded!');
} else {
    console.log('Update failed! string not found.');
}
