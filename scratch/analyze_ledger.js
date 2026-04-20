const fs = require('fs');

try {
    const raw = fs.readFileSync('ledger_dump.json', 'utf8').replace(/^\uFEFF/, '');
    const dbData = JSON.parse(raw);
    const ledger = JSON.parse(dbData[0].results[0].value);

    console.log(`Total entries: ${ledger.length}`);

    // Find entries with 'hash' (bank uploads) and recent createdAt
    // Let's look for anything created in the last hour
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));

    const recentlyUploaded = ledger.filter(e => {
        if (!e.hash) return false;
        const created = new Date(e.createdAt);
        return created > oneHourAgo;
    });

    console.log(`Found ${recentlyUploaded.length} recently uploaded bank entries.`);
    recentlyUploaded.forEach(e => {
        console.log(`- [${e.transactionDate}] ${e.description}: ${e.amount}원 (ID: ${e.id}, CreatedAt: ${e.createdAt})`);
    });

    if (recentlyUploaded.length > 0) {
        const remaining = ledger.filter(e => !recentlyUploaded.includes(e));
        console.log(`Remaining entries if deleted: ${remaining.length}`);
        
        // Save the cleaned ledger for confirmation/upload
        fs.writeFileSync('ledger_cleaned.json', JSON.stringify(remaining));
        console.log('Cleaned ledger saved to ledger_cleaned.json');
    }

} catch (err) {
    console.error(err);
}
