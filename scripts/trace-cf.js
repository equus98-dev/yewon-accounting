const { execSync } = require('child_process');

async function run() {
    try {
        const ledgerRes = execSync('npx wrangler d1 execute accounting-db --remote --command "SELECT value FROM kv_store WHERE key=\'yw_ledger\'" --json', { encoding: 'utf-8', maxBuffer: 50*1024*1024 });
        const ledger = JSON.parse(JSON.parse(ledgerRes)[0].results[0].value);

        const budgetRes = execSync('npx wrangler d1 execute accounting-db --remote --command "SELECT value FROM kv_store WHERE key=\'yw_budget\'" --json', { encoding: 'utf-8', maxBuffer: 50*1024*1024 });
        const budget = JSON.parse(JSON.parse(budgetRes)[0].results[0].value);

        const year = 2026;
        const startDate = `${year}-03-01`;
        const endDate = `${year + 1}-02-28`;
        
        const filtered = ledger.filter(e => e.transactionDate >= startDate && e.transactionDate <= endDate);
        
        console.log(`Searching for entries contributing to '학교회계전출금'...`);
        let sum = 0;
        
        filtered.forEach(e => {
            const b = budget.find(bi => bi.itemCode === e.itemCode);
            if (!b) return;
            
            const path = b.operatingAccount || "";
            const name = b.name || "";
            
            if (path.includes('학교회계전출금') || name.includes('학교회계전출금')) {
                console.log(`[Found] Date: ${e.transactionDate}, Amount: ${e.amount}, Desc: ${e.description}, Code: ${e.itemCode}`);
                sum += e.amount;
            }
        });
        
        console.log(`Total Sum: ${sum}`);

    } catch (e) {
        console.error(e);
    }
}
run();
