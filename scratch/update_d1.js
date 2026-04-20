const fs = require('fs');
const { execSync } = require('child_process');

try {
    const cleaned = fs.readFileSync('ledger_cleaned.json', 'utf8');
    // Escape single quotes by doubling them for SQLITE
    const escapedValue = "'" + cleaned.replace(/'/g, "''") + "'";

    console.log('Uploading cleaned ledger to D1...');
    
    const sql = `UPDATE kv_store SET value = ${escapedValue}, updated_at = CURRENT_TIMESTAMP WHERE key = 'yw_ledger';`;
    fs.writeFileSync('update_ledger.sql', sql);

    execSync('npx wrangler d1 execute accounting-db --remote --file=update_ledger.sql', { stdio: 'inherit' });
    
    console.log('Successfully updated ledger in D1.');

} catch (err) {
    console.error('Failed to update D1:', err);
}
