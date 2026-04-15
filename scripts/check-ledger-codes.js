const { execSync } = require('child_process');
try {
    const res = execSync('npx wrangler d1 execute accounting-db --remote --command "SELECT value FROM kv_store WHERE key=\'yw_ledger\'" --json', { encoding: 'utf-8', maxBuffer: 50*1024*1024 });
    const ls = JSON.parse(JSON.parse(res)[0].results[0].value);
    console.log('Total entries:', ls.length);
    const codes = [...new Set(ls.filter(e => e.itemCode).map(e => e.itemCode))];
    console.log('Unique itemCodes:', codes.join(', '));
} catch (e) {
    console.error(e);
}
