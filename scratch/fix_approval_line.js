const fs = require('fs');
const code = fs.readFileSync('modules/voucher.js', 'utf8');

// IIFE 블록 시작/끝 찾기
const iifePart = '${(() => {';
const iifeEnd = '})()}';
const startIdx = code.indexOf(iifePart);
const endIdx = code.indexOf(iifeEnd, startIdx) + iifeEnd.length;

console.log('startIdx:', startIdx, 'endIdx:', endIdx);
if (startIdx === -1 || endIdx === -1) {
  console.error('IIFE block not found!');
  process.exit(1);
}

// 이전 </td> 포함해서 전체 교체 대상 찾기
// IIFE 앞의 <td class="text-center"> 찾기
const tdStart = code.lastIndexOf('<td class="text-center">', startIdx);
// IIFE 뒤의 </td> 찾기
const tdEnd = code.indexOf('</td>', endIdx) + '</td>'.length;

console.log('tdStart:', tdStart, 'tdEnd:', tdEnd);
console.log('Block to replace:', JSON.stringify(code.substring(tdStart, tdEnd).substring(0, 150)));

const newBlock = `<td class="text-center">\${approvalLineHtml}</td>`;

const newCode = code.substring(0, tdStart) + newBlock + code.substring(tdEnd);

// approvalLineHtml 사전 계산 블록을 canDeleteNow 바로 뒤에 삽입
const insertAfter = 'const canDeleteNow = isAdmin || isAuthor;';
const insertIdx = newCode.indexOf(insertAfter) + insertAfter.length;

const preCalc = `

                  // 결재라인 HTML 사전 계산 (중첩 템플릿 리터럴 오류 방지)
                  const hasManual = Object.values(v.approvalSignatures || {}).includes('\uC218\uAE30\uACB0\uC7AC');
                  let approvalLineHtml;
                  if (hasManual) {
                    const rolesStr = (Array.isArray(v.roles) ? v.roles : []).map(function(r){ return r.slice(0,2); }).join('-');
                    approvalLineHtml = '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;line-height:1.1;">'
                      + '<div style="font-size:10px;color:#555;">' + rolesStr + '</div>'
                      + '<div style="font-size:10px;font-weight:700;color:#d97706;background:#fef3c7;padding:1px 4px;border-radius:3px;">\u21B3 \uC218\uAE30\uACB0\uC7AC</div>'
                      + '</div>';
                  } else {
                    approvalLineHtml = '<div style="display:flex;justify-content:center;gap:2px">'
                      + (Array.isArray(v.roles) ? v.roles : []).map(function(r) {
                          var isApproved = v.approvals && v.approvals[r];
                          var isMyApproval = isApproved && userRank === r && r !== '\uB2F4\uB2F9';
                          var badgeClass = isApproved ? 'badge-success' : 'badge-neutral';
                          var clickAttr = isMyApproval ? ' onclick="VoucherModule.cancelApproval(\\'' + v.id + '\\', \\'' + r + '\\')"' : '';
                          var titleTxt = r + (isApproved ? ' (\uACB0\uC7AC\uC644\uB8CC)' : '') + (isMyApproval ? ' - \uD074\uB9AD\uD558\uC5EC \uACB0\uC7AC \uCDE8\uC18C' : '');
                          return '<span class="badge ' + badgeClass + '" style="font-size:11px;padding:2px 6px;cursor:' + (isMyApproval ? 'pointer' : 'default') + ';" title="' + titleTxt + '"' + clickAttr + '>'
                            + r.slice(0,2) + (isMyApproval ? ' \u21A9' : '') + '</span>';
                        }).join('')
                      + '</div>';
                  }`;

const finalCode = newCode.substring(0, insertIdx) + preCalc + newCode.substring(insertIdx);

fs.writeFileSync('modules/voucher.js', finalCode, 'utf8');
console.log('Done! File written successfully.');
