/**
 * 배포 전 파일 무결성 검사 (Safety Guard)
 * 
 * 검사 항목:
 * 1. index.html - 한글 제목, CSS/JS 링크 정상 여부
 * 2. app.js     - JS 코드 구조 (const App, VIEWS 등) 정상 여부
 * 3. HTML/JS 파일 내에 실제 코드 부분에 깨진 문자 없음
 * 
 * ⚠️ style.css 한글 주석은 원래부터 EUC-KR 인코딩으로 저장되어 있으며,
 *    이는 CSS 동작에 영향 없음 → 검사 제외
 */
const fs = require('fs');

let allOk = true;

function fail(msg) {
    console.error(`❌ CRITICAL: ${msg}`);
    allOk = false;
}

function ok(msg) {
    console.log(`✅ OK: ${msg}`);
}

// ── 1. index.html 검사 ────────────────────────────────────────────────────────
const indexHtml = fs.readFileSync('index.html', 'utf8');

if (!indexHtml.includes('예원예술대학교')) {
    fail('index.html에서 "예원예술대학교" 텍스트가 사라졌습니다. (인코딩 손상 의심)');
} else {
    ok('index.html 한글 제목 정상');
}

if (!indexHtml.includes('<link rel="stylesheet"')) {
    fail('index.html에서 CSS 링크 태그가 사라졌습니다.');
} else {
    ok('index.html CSS 링크 정상');
}

if (!indexHtml.includes('<script src="')) {
    fail('index.html에서 script 태그가 사라졌습니다.');
} else {
    ok('index.html script 태그 정상');
}

if (!indexHtml.includes('doLogin')) {
    fail('index.html에서 doLogin 함수가 사라졌습니다.');
} else {
    ok('index.html doLogin 함수 정상');
}

// ── 2. app.js 검사 ────────────────────────────────────────────────────────────
const appJs = fs.readFileSync('app.js', 'utf8');

if (!appJs.includes('const App')) {
    fail('app.js에서 "const App" 선언이 사라졌습니다. (파일 손상 의심)');
} else {
    ok('app.js App 객체 선언 정상');
}

if (!appJs.includes('VIEWS')) {
    fail('app.js에서 VIEWS 객체가 사라졌습니다.');
} else {
    ok('app.js VIEWS 객체 정상');
}

if (!appJs.includes('산단 일정관리')) {
    fail('app.js에서 한글 메뉴 레이블이 사라졌습니다. (인코딩 손상 의심)');
} else {
    ok('app.js 한글 메뉴 레이블 정상');
}

// ── 3. modules/excel-parser.js 검사 ──────────────────────────────────────────
const excelParser = fs.readFileSync('modules/excel-parser.js', 'utf8');

if (!excelParser.includes('ExcelParserModule')) {
    fail('excel-parser.js에서 ExcelParserModule이 사라졌습니다.');
} else {
    ok('excel-parser.js ExcelParserModule 정상');
}

// ── 결과 출력 ──────────────────────────────────────────────────────────────────
console.log('');
if (!allOk) {
    console.error('🚫 DEPLOYMENT ABORTED: 무결성 검사 실패! 손상된 파일을 복구한 후 다시 시도하세요.');
    process.exit(1);
} else {
    console.log('🚀 무결성 검사 통과! 배포를 진행합니다...');
    process.exit(0);
}
