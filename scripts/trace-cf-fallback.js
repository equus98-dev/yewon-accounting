const { execSync } = require('child_process');

function match(item, path, name) {
    const keyword = item.replace(/^[가-힣0-9a-zA-Z\.\(\)\:\s]+[\.]?[\:\s]?/g, '').trim();
    if (!keyword) return false;
    return path.includes(keyword) || name.includes(keyword);
}

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

        const CF_STRUCTURE_OUT = {
            "1.운영활동으로인한현금유출액": {
                "1)산학협력비현금유출액": {
                    "(1)산학협력연구비": ["가.인건비", "나.학생인건비", "다.연구시설·장비비", "라.연구활동비", "마.연구재료비", "바.연구수당", "사.위탁연구개발비"],
                    "(2)교육운영비": ["가.인건비", "나.교육과정개발비", "다.장학금", "라.실험실습비", "마.기타교육운영비", "바.버스임차료"],
                    "(3)지식재산권비용": ["가.지식재산권실시·양도비", "나.산학협력보상금"],
                    "(4)학교시설사용료": ["가.학교시설사용료"],
                    "(5)기타산학협력비": ["가.기타산학협력비"]
                },
                "2)지원금사업비현금유출액": {
                    "(1)연구비": ["가.인건비", "나.학생인건비", "다.연구시설·장비비", "라.연구활동비", "마.연구재료비", "바.연구수당", "사.위탁연구개발비"],
                    "(2)교육운영비": ["가.인건비", "나.교육과정개발비", "다.장학금", "라.실험실습비", "마.기타교육운영비", "바.버스임차료"],
                    "(3)기타지원금사업비": ["가.기타지원금사업비"]
                },
                "3)간접비사업비현금유출액": {
                    "(1)인력지원비": ["가.인건비", "나.연구개발능률성과급", "다.연구개발준비금"],
                    "(2)연구지원비": ["가.기관 공통비용", "나.사업단 운영비", "다.기반시설구축비", "라.연구실안전관리비", "마.학생보험료", "사.연구활동지원금"],
                    "(3)성과활용지원비": ["가.과학문화활동비", "나.지식재산권출원·등록비"],
                    "(4)기타지원비": ["가.기타지원비"]
                },
                "4)일반관리비현금유출액": ["(1)일반관리비: 가.인건비, 나.보험료, 다.일반제경비"],
                "5)운영외비용현금유출액": ["가.전기오류수정손실", "나.기타운영외비용"],
                "6)학교회계전출금현금유출액": ["가.학교회계전출금"]
            }
        };

        let fallbackSum = 0;
        filtered.forEach(e => {
            if (e.accountingType === 'accrued' || e.accountingType === 'unpaid_occ') return;
            const b = budget.find(bi => bi.itemCode === e.itemCode);
            if (!b || (b.type !== 'expense' && b.type !== 'reserve')) return;

            const path = b.operatingAccount || "";
            const name = b.name || "";
            let found = false;

            for (const act in CF_STRUCTURE_OUT) {
                const actSpec = CF_STRUCTURE_OUT[act];
                for (const sec in actSpec) {
                    if (Array.isArray(actSpec[sec])) {
                        for (const item of actSpec[sec]) {
                            if (match(item, path, name)) { found = true; break; }
                        }
                    } else {
                        for (const sub in actSpec[sec]) {
                            for (const item of actSpec[sec][sub]) {
                                if (match(item, path, name)) { found = true; break; }
                            }
                            if (found) break;
                        }
                    }
                    if (found) break;
                }
                if (found) break;
            }

            if (!found) {
                fallbackSum += e.amount;
                console.log(`[Uncategorized] Date: ${e.transactionDate}, Amount: ${e.amount}, Desc: ${e.description}, Item: ${b.name}, Path: ${b.operatingAccount}`);
            }
        });

        console.log(`\nFallback Sum: ${fallbackSum}`);

    } catch (e) {
        console.error(e);
    }
}
run();
