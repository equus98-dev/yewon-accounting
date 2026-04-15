const { execSync } = require('child_process');

async function run() {
    try {
        const raw = execSync('npx wrangler d1 execute accounting-db --remote --command "SELECT value FROM kv_store WHERE key=\'yw_vouchers\'" --json', { encoding: 'utf-8', maxBuffer: 50*1024*1024 });
        const vs = JSON.parse(JSON.parse(raw)[0].results[0].value);
        
        const targets = ['y-2026-0043', 'y-2026-0044', 'y-2026-0054', 'y-2026-0055', 'y-2026-0063'];
        
        targets.forEach(id => {
            const v = vs.find(x => x.id === id);
            if (v) {
                console.log(`[Found] ${id}: CreatedAt=${v.createdAt}, Title="${v.title}", Author=${v.authorName}`);
            } else {
                console.log(`[Missing] ${id}`);
            }
        });

    } catch (e) {
        console.error(e);
    }
}
run();
