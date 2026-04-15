const { execSync } = require('child_process');
const fs = require('fs');

async function run() {
    try {
        console.log('Fetching vouchers...');
        const vouchersRaw = execSync('npx wrangler d1 execute accounting-db --remote --command "SELECT value FROM kv_store WHERE key=\'yw_vouchers\'" --json', { encoding: 'utf-8', maxBuffer: 50*1024*1024 });
        const vouchers = JSON.parse(JSON.parse(vouchersRaw)[0].results[0].value);

        const ids = vouchers
            .filter(v => v.id && v.id.startsWith('y-2026-'))
            .map(v => parseInt(v.id.split('-').pop()))
            .sort((a,b) => a - b);
        
        console.log('--- ALL IDs ---');
        console.log(ids.join(', '));

        console.log('\n--- Gaps Analyis ---');
        let last = 0;
        ids.forEach(id => {
            if (id !== last + 1) {
                console.log(`Gap: ${last + 1} ~ ${id - 1}`);
            }
            last = id;
        });

    } catch (e) {
        console.error(e);
    }
}
run();
