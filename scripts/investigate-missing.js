const { execSync } = require('child_process');

async function run() {
    try {
        console.log('Fetching vouchers from D1...');
        const vouchersRaw = execSync('npx wrangler d1 execute accounting-db --remote --command "SELECT value FROM kv_store WHERE key=\'yw_vouchers\'" --json', { encoding: 'utf-8', maxBuffer: 50*1024*1024 });
        const vouchers = JSON.parse(JSON.parse(vouchersRaw)[0].results[0].value);

        console.log('Fetching ledger from D1...');
        const ledgerRaw = execSync('npx wrangler d1 execute accounting-db --remote --command "SELECT value FROM kv_store WHERE key=\'yw_ledger\'" --json', { encoding: 'utf-8', maxBuffer: 50*1024*1024 });
        const ledger = JSON.parse(JSON.parse(ledgerRaw)[0].results[0].value);

        console.log('\n--- Investigation Report ---');
        console.log(`Vouchers existing count: ${vouchers.length}`);
        
        const sortedVoucherIds = vouchers
            .filter(v => v.id && v.id.startsWith('y-2026-'))
            .map(v => parseInt(v.id.split('-').pop()))
            .sort((a, b) => a - b);
        
        console.log(`Sequence range: ${sortedVoucherIds[0]} ~ ${sortedVoucherIds[sortedVoucherIds.length - 1]}`);

        const missingRange = [];
        for (let i = 1; i <= 65; i++) {
            const id = `y-2026-${String(i).padStart(4, '0')}`;
            const exists = vouchers.find(v => v.id === id);
            if (!exists) {
                missingRange.push(id);
                console.log(`\n[Missing] ${id}`);
                
                // Cross-check ledger
                const related = ledger.filter(l => 
                    l.voucherId === id || 
                    (l.description && l.description.includes(id)) ||
                    (l.voucherNo && l.voucherNo.includes(id))
                );
                
                if (related.length > 0) {
                    console.log(`  -> WARNING: ${related.length} entries in Ledger refer to this ID!`);
                    related.forEach(r => console.log(`     - [${r.transactionDate}] ${r.description} (${r.amount}원)`));
                } else {
                    console.log(`  -> No related data in Ledger.`);
                }
            }
        }

        console.log('\n--- Summary ---');
        if (missingRange.length === 0) {
            console.log('No missing vouchers detected in the range y-2026-0001 ~ y-2026-0065.');
        } else {
            console.log(`Total ${missingRange.length} vouchers are missing in the sequence.`);
        }

    } catch (e) {
        console.error('Execution error:', e);
    }
}

run();
