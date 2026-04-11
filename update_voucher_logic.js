const fs = require('fs');
let content = fs.readFileSync('modules/voucher.js', 'utf8');

// 1. Remove "결재라인" header cell
content = content.replace(
  /<th rowspan="2" style="background:#e5e7eb; width:40px; border:1px solid #000; padding:6px; font-weight:bold; font-size:13px; line-height:1.4;">결<br>재<br>라<br>인<\/th>\s*/g,
  ''
);

// 2. 작성자란 사번/이름 split layout
content = content.replace(
  /<td class="voucher-doc-value auto text-center">\$\{authorId\} \/ \$\{authorName\}<\/td>/g,
  `<td class="voucher-doc-value auto text-center" style="padding:0;"><div style="display:flex; width:100%; height:100%; min-height:30px;"><div style="flex:1; border-right:1px solid #000; display:flex; align-items:center; justify-content:center;">\${authorId}</div><div style="flex:1; display:flex; align-items:center; justify-content:center;">\${authorName}</div></div></td>`
);

// 3. 문서번호 포맷 변경 (결의서 HTML 내)
content = content.replace(
  /산학협력단-\$\{v\.type==='income'\?'수입':'지출'\}-\$\{v\.id\}/g,
  "산단-${v.type==='income'?'수입':'지출'}-${date.getFullYear()}-${String(v.id).padStart(4, '0')}"
);

// 4. 첨부 파일 UI 변경
const newUploadUI = `      <h4 class="section-title" style="margin-bottom:8px;">3-1. 증빙 서류 (내부기안) 첨부 <span class="badge badge-error">필수</span> <span style="font-size:12px; font-weight:normal; color:#e11d48;">(PDF만 업로드 가능)</span></h4>
        <div class="file-drop-zone" id="file-drop-zone-draft" style="margin-bottom:15px; padding:15px; background:#f8fafc;">
          <input type="file" id="v-file-input-draft" style="display:none" accept=".pdf" multiple onchange="VoucherModule.handleFileChange(this, 'draft')">
          <button class="btn btn-ghost btn-sm" style="width:100%; border:1px dashed #ccc;" onclick="document.getElementById('v-file-input-draft').click()">📁 필수 내부기안 첨부 (여기를 클릭하세요)</button>
          <div id="v-file-preview-list-draft" style="margin-top:10px; display:flex; flex-wrap:wrap; gap:8px;"></div>
        </div>

        <h4 class="section-title" style="margin-bottom:8px;">3-2. 증빙 서류 (기타증빙) 첨부 <span style="font-size:12px; font-weight:normal; color:#e11d48;">(PDF만 업로드 가능)</span></h4>
        <div class="file-drop-zone" id="file-drop-zone-other" style="padding:15px; background:#f8fafc;">
          <input type="file" id="v-file-input-other" style="display:none" accept=".pdf" multiple onchange="VoucherModule.handleFileChange(this, 'other')">
          <button class="btn btn-ghost btn-sm" style="width:100%; border:1px dashed #ccc;" onclick="document.getElementById('v-file-input-other').click()">📁 기타 증빙서류 첨부 (여기를 클릭하세요)</button>
          <div id="v-file-preview-list-other" style="margin-top:10px; display:flex; flex-wrap:wrap; gap:8px;"></div>
        </div>`;

content = content.replace(
  /<h4 class="section-title">3\. 증빙 서류.*<\/h4>\s*<div class="file-drop-zone" id="file-drop-zone">[\s\S]*?<div id="v-file-preview-list".*?<\/div>\s*<\/div>/,
  newUploadUI
);

// 5. handleFileChange 및 processFiles 수정 -> 'category' 지원하도록
// handleFileChange 수정 (async 가 붙어있을 수도 아닐 수도 있으므로 유연하게 매칭)
content = content.replace(
  /(async\s+)?function\s+handleFileChange\s*\(\s*input\s*\)\s*\{/g,
  `function handleFileChange(input, category = 'other') {`
);
// processFiles 호출 시 category 전달
content = content.replace(
  /processFiles\s*\(\s*files\s*\)\s*;/g,
  `processFiles(files, category);`
);
// handleFileDrop 수정
content = content.replace(
  /function\s+handleFileDrop\s*\(\s*event\s*\)\s*\{/g,
  `function handleFileDrop(event, category = 'other') {`
);
// processFiles 정의 수정
content = content.replace(
  /async\s+function\s+processFiles\s*\(\s*files\s*\)\s*\{/g,
  `async function processFiles(files, category = 'other') {`
);

content = content.replace(
  /uploadedFiles\.push\(\{\s*base64:\s*base64Data,\s*name:\s*file\.name,\s*type:\s*file\.type\s*\}\);/g,
  `uploadedFiles.push({ base64: base64Data, name: file.name, type: file.type, category });`
);

// 6. renderFilePreviewList 수정 -> 카테고리에 따라 다른 div에 렌더링하도록
const newRenderFilePreviewList = `  function renderFilePreviewList() {
    ['draft', 'other'].forEach(cat => {
      const container = document.getElementById('v-file-preview-list-' + cat);
      if (!container) return;
      
      const filesOfCat = uploadedFiles.map((f, i) => ({f, i})).filter(item => item.f.category === cat);
      
      container.innerHTML = filesOfCat.map(item => \`
        <div style="position:relative; width:80px; text-align:center;">
          \${item.f.type && item.f.type.startsWith('image/')
            ? \`<img src="\${item.f.base64}" style="width:70px; height:70px; object-fit:cover; border-radius:4px; border:1px solid #ddd;">\`
            : \`<div style="width:70px; height:70px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#fff1f2; border:1px solid #fecdd3; border-radius:4px; color:#e11d48; font-size:11px;"><i class="fa-solid fa-file-pdf" style="font-size:22px; margin-bottom:4px;"></i>PDF</div>\`
          }
          <div style="font-size:10px; color:#64748b; margin-top:3px; word-break:break-all; max-width:75px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="\${item.f.name}">\${item.f.name}</div>
          <button onclick="VoucherModule.removeFile(\${item.i})" style="position:absolute; top:-4px; right:0; width:18px; height:18px; border-radius:50%; background:#ef4444; color:white; border:none; font-size:12px; line-height:1; cursor:pointer;" title="삭제">×</button>
        </div>
      \`).join('');
    });
  }`;

content = content.replace(
  /function renderFilePreviewList\(\) \{[\s\S]*?\}\n\s*function removeFile/g,
  `${newRenderFilePreviewList}\n\n  function removeFile`
);

// 7. prepareVoucher 의 validation 필터링
content = content.replace(
  /if \(uploadedFiles\.length === 0\) \{ helpers\.showToast\('증빙 서류\(내부기안 등\)를 필수로 첨부해 주세요\.', 'error'\); return; \}/g,
  `if (!uploadedFiles.some(f => f.category === 'draft')) { helpers.showToast('증빙 서류(내부기안)를 필수로 첨부해 주세요.', 'error'); return; }`
);

// Write to file
fs.writeFileSync('modules/voucher.js', content, 'utf8');

// Also append to style.css for darker background
let styleContent = fs.readFileSync('style.css', 'utf8');
const darkTableCss = `
/* Voucher Header background overwrite */
.voucher-doc-meta-table .voucher-doc-label,
.voucher-doc-meta-table td.voucher-doc-label,
.voucher-doc-meta-table th {
    background-color: #d1d5db !important; /* darker gray */
}
`;
if (!styleContent.includes('.voucher-doc-meta-table td.voucher-doc-label')) {
  fs.appendFileSync('style.css', darkTableCss);
}

console.log('Update scripts executed.');
