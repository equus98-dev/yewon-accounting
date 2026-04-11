const fs = require('fs');
let content = fs.readFileSync('modules/voucher.js', 'utf8');

content = content.replace(
  /3\. 증빙 서류\(영수증\) 첨부/g,
  '3. 증빙 서류(내부기안 등) 첨부'
);

content = content.replace(
  /if\s*\(\s*selectedIds\.size\s*===\s*0\s*\)\s*\{\s*helpers\.showToast[^}]+\}\s*/g,
  `$&
    if (uploadedFiles.length === 0) { helpers.showToast('증빙 서류(내부기안 등)를 필수로 첨부해 주세요.', 'error'); return; }
`
);

fs.writeFileSync('modules/voucher.js', content, 'utf8');

if (content.includes('증빙 서류(내부기안 등) 첨부') && content.includes('uploadedFiles.length === 0')) {
    console.log('Update actually succeeded! mandatory check added.');
} else {
    console.log('Update failed! string not found.');
}
