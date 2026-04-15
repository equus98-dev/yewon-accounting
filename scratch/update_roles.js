const fs = require('fs');

try {
  const vouchersRaw = fs.readFileSync('scratch/latest_vouchers.json', 'utf8').replace(/^\uFEFF/, '');
  const data = JSON.parse(vouchersRaw);
  if (!data[0] || !data[0].results || !data[0].results[0] || !data[0].results[0].value) {
    console.error("Invalid JSON structure from DB extraction.");
    process.exit(1);
  }

  const vouchersList = JSON.parse(data[0].results[0].value);
  let changed = 0;

  vouchersList.forEach(v => {
    // If exact match for ["담당"] or missing roles, update to standard line
    if ((v.roles && v.roles.length === 1 && v.roles[0] === '담당') || !v.roles || v.roles.length === 0) {
      v.roles = ["담당", "팀장", "산학협력단장"];
      changed++;
    }
  });

  console.log('Total vouchers updated:', changed);

  if (changed > 0) {
    const finalJson = JSON.stringify(vouchersList);
    // Escape single quotes for SQL
    const escapedJson = finalJson.replace(/'/g, "''");
    const sql = `UPDATE kv_store SET value = '${escapedJson}', updated_at = CURRENT_TIMESTAMP WHERE key = 'yw_vouchers';`;
    
    fs.writeFileSync('scratch/update_roles.sql', sql);
    console.log('Update successful. Saved to scratch/update_roles.sql');
  } else {
    console.log('All vouchers already have the proper roles.');
  }
} catch (e) {
  console.error(e);
}
