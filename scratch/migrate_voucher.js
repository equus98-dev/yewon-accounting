const fs = require('fs');

const vouchersRaw = fs.readFileSync('scratch/vouchers.json', 'utf8').replace(/^\uFEFF/, '');
const data = JSON.parse(vouchersRaw);
const vouchersList = JSON.parse(data[0].results[0].value);

const targetVoucherId = 'y-2026-0075';
const sora = { id: 'A0244', name: '송소라' };

const voucher = vouchersList.find(v => v.id === targetVoucherId);

if (voucher) {
  console.log('Changing author for:', voucher.id);
  voucher.authorId = sora.id;
  voucher.authorName = sora.name;
  
  if (voucher.approvalNames) {
    voucher.approvalNames['담당'] = sora.name;
    delete voucher.approvalNames['undefined'];
  }
  
  if (voucher.approvals && voucher.approvals['undefined']) {
    delete voucher.approvals['undefined'];
  }

  // If it was manually bypassed, maybe we should also try to put Sora's signature if we had it,
  // but the user just asked to change the author name.
  
  fs.writeFileSync('scratch/vouchers_updated.json', JSON.stringify(vouchersList));
  
  const finalJson = JSON.stringify(vouchersList);
  // 단일 따옴표 이스케이프 (SQL용)
  const escapedJson = finalJson.replace(/'/g, "''");
  const sql = `UPDATE kv_store SET value = '${escapedJson}', updated_at = CURRENT_TIMESTAMP WHERE key = 'yw_vouchers';`;
  fs.writeFileSync('scratch/update.sql', sql);
  
  console.log('Update successful. Saved to scratch/vouchers_updated.json and scratch/update.sql');
} else {
  console.error('Voucher not found:', targetVoucherId);
  process.exit(1);
}
