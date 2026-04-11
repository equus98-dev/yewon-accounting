const fs = require('fs');
let content = fs.readFileSync('modules/voucher.js', 'utf8');
const payload = fs.readFileSync('payload2.txt', 'utf8');

const targetStrStart = '<!-- 상단 헤더';
const targetStrEnd = '<!-- 기본 정보 테이블 (회색/노란색/흰색) -->';

const startIndex = content.indexOf(targetStrStart);
const endIndex = content.indexOf(targetStrEnd);

if (startIndex !== -1 && endIndex !== -1) {
    content = content.substring(0, startIndex) + payload + '\n        ' + content.substring(endIndex);
    fs.writeFileSync('modules/voucher.js', content, 'utf8');
    console.log('Update actually succeeded!');
} else {
    console.log('Update failed! Indexes not found.');
}
