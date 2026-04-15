const { execSync } = require('child_process');
const fs = require('fs');

async function run() {
    try {
        console.log('Fetching vouchers from D1...');
        const result = execSync('npx wrangler d1 execute accounting-db --remote --command "SELECT value FROM kv_store WHERE key=\'yw_vouchers\'" --json', { 
            encoding: 'utf-8',
            maxBuffer: 100 * 1024 * 1024
        });
        
        const vouchers = JSON.parse(JSON.parse(result)[0].results[0].value);
        console.log(`Total vouchers: ${vouchers.length}`);

        let sql = '';
        let updateCount = 0;

        vouchers.forEach((v, index) => {
            // "담당"이 '수기결재' 상태인 모든 결의서를 대상으로 함
            if (v.approvalSignatures && v.approvalSignatures['담당'] === '수기결재') {
                const roles = v.roles || [];
                roles.forEach(role => {
                    // 이미 다른 서명이 있는 경우(담당 제외)는 유지, 서명이 없으면 '수기결재' 주입
                    if (!v.approvalSignatures[role]) {
                        sql += `UPDATE kv_store SET value = json_set(value, '$[${index}].approvalSignatures.${role}', '수기결재') WHERE key='yw_vouchers';\n`;
                    }
                    // 승인 상태는 모두 1(true)로 설정
                    sql += `UPDATE kv_store SET value = json_set(value, '$[${index}].approvals.${role}', 1) WHERE key='yw_vouchers';\n`;
                });
                updateCount++;
            }
        });

        if (updateCount > 0) {
            fs.writeFileSync('complete_approvals.sql', sql, 'utf-8');
            console.log(`Found ${updateCount} manually approved vouchers. Executing full approval SQL...`);
            // SQL 파일이 너무 커질 수 있으므로 나누어 실행하거나 한번에 시도
            execSync('npx wrangler d1 execute accounting-db --remote --file complete_approvals.sql', { stdio: 'inherit' });
            console.log('All roles for manually approved vouchers have been cleared.');
        } else {
            console.log('No manually approved vouchers found.');
        }

    } catch (error) {
        console.error('Error during full bulk approval:', error.message);
    }
}

run();
