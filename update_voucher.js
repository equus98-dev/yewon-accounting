const fs = require('fs');
let content = fs.readFileSync('modules/voucher.js', 'utf8');

content = content.replace(
  '<label>내용 <span class="badge badge-neutral">수동입력</span></label>',
  '<label>관련근거 <span class="badge badge-neutral">수동입력</span></label>'
);

content = content.replace(
  '<textarea id="v-content" class="form-control" rows="4" placeholder="1. 관련근거: ...&#10;2. 내용: ..."></textarea>',
  '<div style="display:flex; gap:10px;"><input type="text" id="v-draft-doc-no" class="form-control" placeholder="내부결재기안 문서번호 (예: 산학협력단-000)" style="flex:1;"><input type="text" id="v-draft-title" class="form-control" placeholder="기안제목" style="flex:2;"></div>'
);

content = content.replace(
  "const content = document.getElementById('v-content')?.value || '';",
  "const docNo = document.getElementById('v-draft-doc-no')?.value || '';\n    const draftTitle = document.getElementById('v-draft-title')?.value || '';\n    const content = (docNo || draftTitle) ? `[문서번호] ${docNo}\\n[기안제목] ${draftTitle}` : (document.getElementById('v-content')?.value || '');"
);

content = content.replace(
  '<td class="voucher-doc-label" style="height:80px;">내용</td>',
  '<td class="voucher-doc-label" style="height:80px;">관련근거</td>'
);

fs.writeFileSync('modules/voucher.js', content, 'utf8');
console.log('Update successful');
