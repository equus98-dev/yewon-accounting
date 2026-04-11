const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * hash-assets.js
 * 모든 .js, .css 파일의 해시값을 계산하여 파일명을 변경하고,
 * index.html 및 yewon_erp.html의 참조 경로를 업데이트합니다.
 */

const baseDir = path.join(__dirname, '..');

// 0. 기존 해시 파일 정리 (파일명.8자리해시.js/css 패턴)
function cleanOldHashes(files) {
    const allFiles = fs.readdirSync(baseDir);
    for (const f of allFiles) {
        if (/\.[a-f0-9]{8}\.(js|css)$/.test(f)) {
            console.log(`Cleaning old hash file: ${f}`);
            fs.unlinkSync(path.join(baseDir, f));
        }
    }
    // 하위 폴더(utils, modules)도 정리
    ['utils', 'modules'].forEach(dir => {
        const dirPath = path.join(baseDir, dir);
        if (fs.existsSync(dirPath)) {
            const subFiles = fs.readdirSync(dirPath);
            for (const f of subFiles) {
                if (/\.[a-f0-9]{8}\.(js|css)$/.test(f)) {
                    console.log(`Cleaning old hash file: ${dir}/${f}`);
                    fs.unlinkSync(path.join(dirPath, f));
                }
            }
        }
    });
}

async function run() {
    console.log('--- Asset Hashing Started ---');
    cleanOldHashes();

    const filesToHash = [
        'style.css',
        'app.js',
        'utils/accounting-logic.js',
        'utils/db.js',
        'utils/helpers.js',
        'utils/auth.js',
        'modules/dashboard.js',
        'modules/projects.js',
        'modules/project-accounts.js',
        'modules/excel-parser.js',
        'modules/ledger.js',
        'modules/voucher.js',
        'modules/budget-overview.js',
        'modules/budget.js',
        'modules/project-budget.js',
        'modules/operating-statement.js',
        'modules/balance-sheet.js',
        'modules/cash-flow.js',
        'modules/cash-budget-report.js',
        'modules/reports.js',
        'modules/schedule.js',
        'modules/user-management.js',
        'modules/profile.js',
        'modules/assets.js'
    ];

    const hashMap = {};

    // 1. 각 파일의 해시 계산 및 복사본 생성
    for (const relPath of filesToHash) {
        const fullPath = path.join(baseDir, relPath);
        if (!fs.existsSync(fullPath)) {
            console.warn(`File not found: ${relPath}`);
            continue;
        }

        const content = fs.readFileSync(fullPath);
        const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);

        const ext = path.extname(relPath);
        const name = relPath.replace(ext, '');
        const hashedName = `${name}.${hash}${ext}`;

        hashMap[relPath] = hashedName;

        // 배포용 폴더(예: public_dist)를 만들거나 단순히 같은 폴더에 생성
        // 여기서는 같은 폴더에 해시 파일 생성 (이후 deploy.bat에서 이 파일들을 사용하도록 유도)
        fs.writeFileSync(path.join(baseDir, hashedName), content);
        console.log(`Hashed: ${relPath} -> ${hashedName}`);
    }

    // 2. HTML 파일 업데이트
    const htmlFiles = ['index.html', 'yewon_erp.html'];
    for (const htmlFile of htmlFiles) {
        const filePath = path.join(baseDir, htmlFile);
        if (!fs.existsSync(filePath)) continue;

        let content = fs.readFileSync(filePath, 'utf8');

        // BOM 제거 (UTF-8 with BOM 대응)
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }

        for (const [orig, hashed] of Object.entries(hashMap)) {
            const ext = path.extname(orig);
            const name = orig.replace(ext, '');
            const escapedName = name.replace(/\//g, '\\/').replace(/\./g, '\\.');
            const escapedExt = ext.replace(/\./g, '\\.');

            // CDN 주소와의 충돌을 피하기 위해 따옴표 내의 상대 경로만 정밀 타겟팅
            const regex = new RegExp(`(?<=")${escapedName}(\\.[a-f0-9]{8})?${escapedExt}(?="|\\?)`, 'g');
            content = content.replace(regex, hashed);
        }

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated HTML: ${htmlFile}`);
    }

    console.log('--- Asset Hashing Completed ---');
}

run().catch(console.error);
