const { execSync } = require('child_process');
try {
    const res = execSync('npx wrangler d1 execute accounting-db --remote --command "SELECT value FROM kv_store WHERE key=\'yw_users\'" --json', { encoding: 'utf-8', maxBuffer: 50*1024*1024 });
    const us = JSON.parse(JSON.parse(res)[0].results[0].value);
    const lee = us.find(u => u.name === '이명근');
    console.log(lee);
} catch (e) {
    console.error(e);
}
