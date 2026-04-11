// utils/helpers.js - 공통 유틸리티

// ───── 숫자 → 한글 금액 변환 ─────
const NUMBER_UNITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const POSITION_UNITS = ['', '십', '백', '천'];
const BIG_UNITS = ['', '만', '억', '조'];

function toKoreanAmount(number) {
    if (!number || number === 0) return '영';
    const n = Math.floor(Math.abs(number));
    if (n === 0) return '영';

    const parts = [];
    let remaining = n;
    let bigIdx = 0;

    while (remaining > 0) {
        const chunk = remaining % 10000;
        if (chunk > 0) {
            parts.unshift(chunkToKorean(chunk) + BIG_UNITS[bigIdx]);
        }
        remaining = Math.floor(remaining / 10000);
        bigIdx++;
    }

    return '일금 ' + parts.join('') + '원정';
}

function chunkToKorean(n) {
    let result = '';
    const d = [Math.floor(n / 1000), Math.floor((n % 1000) / 100), Math.floor((n % 100) / 10), n % 10];
    d.forEach((v, i) => {
        if (v > 0) {
            result += (v === 1 && i !== 3 ? '' : NUMBER_UNITS[v]) + POSITION_UNITS[3 - i];
        }
    });
    return result;
}

// ───── 금액 포맷 (3자리 콤마) ─────
function formatCurrency(amount) {
    if (!amount && amount !== 0) return '-';
    return Math.abs(amount).toLocaleString('ko-KR') + '원';
}

function formatCurrencyRaw(amount) {
    if (amount === 0) return '0';
    if (!amount) return '-';
    return Math.abs(amount).toLocaleString('ko-KR');
}

// ───── 날짜 포맷 ─────
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function toLocalDate(excelNum) {
    // Excel serial date (number) → JS Date
    if (typeof excelNum === 'number') {
        const utc = new Date((excelNum - 25569) * 86400 * 1000);
        return new Date(utc.getTime() + utc.getTimezoneOffset() * 60000);
    }
    return new Date(excelNum);
}

// ───── 중복 방지 해시 ─────
function generateHash(date, amount, desc) {
    const str = `${formatDateShort(date)}_${amount}_${String(desc || '').trim().substring(0, 20)}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(36);
}

// ───── 비목 목록 ─────
const DEFAULT_CATEGORIES = [
    '강사료', '교통비', '대관료', '복리후생비', '보험료', '버스임차료', '사업비', '소모품비', '수수료', '숙박비', '식비', '외주용역비', '인건비', '인쇄비', '재료비', '장비비', '출장비', '학생보험료', '회의비', '홍보비', '기타'
];

// ───── ID 생성 ─────
function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
}

// ───── 엑셀 날짜 파싱 ─────
function parseExcelDate(val) {
    if (!val) return null;
    if (typeof val === 'number') {
        const d = toLocalDate(val);
        return isNaN(d) ? null : formatDateShort(d);
    }
    const str = String(val).replace(/\./g, '-').replace(/\//g, '-');
    const d = new Date(str);
    return isNaN(d) ? str : formatDateShort(d);
}

// ───── 숫자 파싱 (콤마 제거) ─────
function parseAmount(val) {
    if (!val && val !== 0) return 0;
    const n = parseFloat(String(val).replace(/,/g, '').replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? 0 : n;
}

// ───── Toast 알림 ─────
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${message}</span>
  `;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ───── 모달 열기/닫기 ─────
function openModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) { m.classList.add('active'); document.body.style.overflow = 'hidden'; }
}
function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) { m.classList.remove('active'); document.body.style.overflow = ''; }
}

// ───── 실시간 금액 입력 포맷팅 ─────
function handleAmountInput(input) {
    let value = input.value.replace(/,/g, '');
    if (value === '') {
        input.value = '';
        return;
    }
    // 숫자와 소수점만 허용
    if (isNaN(value)) {
        input.value = value.replace(/[^0-9.-]/g, '');
        return;
    }
    input.value = Number(value).toLocaleString('ko-KR');
}

// ───── 차트 그라데이션 유틸리티 ─────
function createChartGradient(ctx, color1, color2) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
}

// ───── 오늘의 일정 위젯 (전역 공통) ─────
function renderTodayScheduleWidget() {
    const schedules = typeof window.ScheduleModule !== 'undefined' ? window.ScheduleModule.getTodaySchedules() : [];

    return `
      <div class="global-schedule-widget">
        <h4 class="widget-title"><i class="fa-solid fa-calendar-day"></i> 오늘의 일정</h4>
        <div class="today-sch-row">
          ${schedules.length === 0
            ? `<div class="today-sch-card empty"><p class="empty-msg">오늘 등록된 일정이 없습니다.</p></div>`
            : schedules.map(s => `
                <div class="today-sch-card" onclick="App.navigate('schedule'); setTimeout(() => ScheduleModule.openEditModalById('${s.id}'), 200)">
                  <div class="sch-tag" style="background: ${getCategoryColor(s.category)}"></div>
                  <div class="sch-content">
                    <div class="sch-title">${s.title}</div>
                    <div class="sch-meta">${s.category} | ${s.desc || '메모 없음'}</div>
                  </div>
                </div>
              `).join('')}
        </div>
      </div>
    `;
}

function getCategoryColor(cat) {
    const colors = {
        '사업 마감': '#ff4757',
        '회계 결산': '#2563eb',
        '일반 회의': '#2dcc70',
        '기타 일정': '#747d8c'
    };
    return colors[cat] || '#747d8c';
}

function isEntryLocked(ledgerId) {
    const vouchers = window.db ? window.db.getVouchers() : [];
    return vouchers.some(v => v.entries.some(e => e.id === ledgerId));
}

// ───── 감가상각 계산 (정액법) ─────
function calculateDepreciation(asset, targetDateStr, periodStartDateStr) {
    const cost = parseAmount(asset.acquisitionCost || 0);
    const usefulLifeYears = parseInt(asset.usefulLife) || 5;
    const usefulLifeMonths = usefulLifeYears * 12;
    const acqDate = new Date(asset.acquisitionDate);
    const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();

    if (isNaN(acqDate.getTime()) || cost <= 0) return { accumulated: 0, bookValue: cost, periodDep: 0 };

    // 1. 기준일(targetDate)까지의 총 경과 월수 (누계액용)
    // 월할상각: 취득월을 포함함 (+1)
    let totalMonthsPassed = (targetDate.getFullYear() - acqDate.getFullYear()) * 12 + (targetDate.getMonth() - acqDate.getMonth()) + 1;
    if (totalMonthsPassed < 0) totalMonthsPassed = 0;
    if (totalMonthsPassed > usefulLifeMonths) totalMonthsPassed = usefulLifeMonths;

    const monthlyDep = cost / usefulLifeMonths;
    const accumulated = Math.floor(monthlyDep * totalMonthsPassed);
    const bookValue = Math.max(0, cost - accumulated);

    // 2. 특정 기간(당기) 발생 상각비 계산 (운영계산서용)
    let periodDep = 0;
    if (periodStartDateStr) {
        const periodStart = new Date(periodStartDateStr);
        // 기간 시작 전일까지의 누계액 계산
        const prevTarget = new Date(periodStart);
        prevTarget.setDate(0); // 전월 말일

        const { accumulated: prevAcc } = calculateDepreciation(asset, prevTarget.toISOString().split('T')[0]);

        // 당기 상각비 = (현재 기준 누계액) - (기간 시작 전 누계액)
        // 단, 자산 취득일이 기간 시작 이후라면 prevAcc는 0이 됨
        periodDep = Math.max(0, accumulated - prevAcc);
    }

    return { accumulated, bookValue, periodDep };
}

// ───── 회계연도 계산 ─────
function getFiscalYear(dateStr) {
    if (!dateStr) return new Date().getFullYear();
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date().getFullYear();
    const m = d.getMonth() + 1; // 1-12
    const y = d.getFullYear();
    return m <= 2 ? y - 1 : y;
}

// ───── Export ─────
window.helpers = {
    toKoreanAmount, formatCurrency, formatCurrencyRaw,
    formatDate, formatDateShort, parseExcelDate, parseAmount,
    generateHash, generateId, DEFAULT_CATEGORIES,
    showToast, openModal, closeModal, createChartGradient,
    handleAmountInput, renderTodayScheduleWidget, getCategoryColor,
    isEntryLocked, calculateDepreciation, getFiscalYear,
    exportDatabaseBackup() {
        if (!window.db || !window.db._cache) return;
        const dataStr = JSON.stringify(window.db._cache);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        a.download = `yewon_accounting_backup_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
        window.helpers.showToast('백업 파일이 다운로드되었습니다.', 'success');
    },
    importDatabaseBackup(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!confirm('🚨 경고: 복원 시 현재 서버의 모든 데이터가 백업 파일의 내용으로 덮어씌워집니다.\n정말 복원하시겠습니까? (충분한 확인 후 진행해 주세요)')) {
            event.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data || typeof data !== 'object') throw new Error('올바르지 않은 백업 파일 형식입니다.');

                window.helpers.showToast('데이터 복원 중입니다. 잠시만 기다려 주세요...', 'info');
                // 모든 키를 순회하며 서버에 저장
                for (const key of Object.keys(data)) {
                    await fetch('/api/data/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key, value: data[key] })
                    });
                }
                alert('데이터 복원이 완료되었습니다.\n시스템을 다시 시작합니다.');
                location.reload();
            } catch (err) {
                alert('복원 실패: ' + err.message);
                console.error(err);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },
    isProjectInFiscalYear(project, year) {
        // 회계연도 시작/종료일 설정 (Y년 3월 1일 ~ Y+1년 2월 말일)
        const fyStart = new Date(`${year}-03-01`);
        const fyEnd = new Date(`${year + 1}-02-28`);
        fyEnd.setHours(23, 59, 59, 999);

        // 프로젝트 사업기간이 없을 경우 기존 fiscalYear 필드로 판단
        if (!project.startDate || !project.endDate) {
            return project.fiscalYear == year;
        }

        const pStart = new Date(project.startDate);
        const pEnd = new Date(project.endDate);

        // 기간 중첩(Overlap) 확인: (P_Start <= FY_End) AND (P_End >= FY_Start)
        return pStart <= fyEnd && pEnd >= fyStart;
    },
    base64ToBlob(base64, type) {
        const bin = atob(base64.split(',')[1]);
        const len = bin.length;
        const arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: type || 'application/pdf' });
    },
    async renderPdf(container, base64) {
        if (!container) return;
        container.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> PDF 로딩 중...</div>';

        try {
            const blob = this.base64ToBlob(base64);
            const url = URL.createObjectURL(blob);

            // 1. 우선 iframe 시도 (PC 브라우저에서 가장 깔끔함)
            container.innerHTML = `<iframe src="${url}" style="width:100%; height:800px; border:none;"></iframe>`;

            // 2. 모바일이거나 iframe이 제한적일 수 있으므로 PDF.js 버튼 제안 또는 자동 렌더링 고려
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

            if (isMobile && window.pdfjsLib) {
                container.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> 모바일 뷰어 최적화 중...</div>';
                const loadingTask = pdfjsLib.getDocument(url);
                const pdf = await loadingTask.promise;
                container.innerHTML = ''; // 클리어

                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement('canvas');
                    canvas.style.display = 'block';
                    canvas.style.margin = '10px auto';
                    canvas.style.maxWidth = '100%';
                    canvas.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';

                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    await page.render({ canvasContext: context, viewport: viewport }).promise;
                    container.appendChild(canvas);
                }
            }
        } catch (e) {
            console.error('PDF Render Error:', e);
            container.innerHTML = `<div style="padding:20px; color:red; border:1px solid #ddd;">PDF를 표시할 수 없습니다. (에러: ${e.message})</div>`;
        }
    },
    async compressPdf(base64Data, quality = 0.7) {
        if (!window.pdfjsLib || !window.jspdf) {
            console.warn('PDF Libraries not loaded');
            return base64Data;
        }

        try {
            const pdfData = atob(base64Data.split(',')[1]);
            const loadingTask = pdfjsLib.getDocument({ data: pdfData });
            const pdf = await loadingTask.promise;
            const { jsPDF } = window.jspdf;

            let doc = null;

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2.0 }); // 고해상도 이미지화
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport: viewport }).promise;

                // JPEG로 압축 변환
                const imgData = canvas.toDataURL('image/jpeg', quality);

                const imgProps = {
                    width: viewport.width,
                    height: viewport.height
                };

                // 용지 방향 및 크기 설정
                const orientation = imgProps.width > imgProps.height ? 'l' : 'p';
                if (i === 1) {
                    doc = new jsPDF(orientation, 'px', [imgProps.width, imgProps.height]);
                } else {
                    doc.addPage([imgProps.width, imgProps.height], orientation);
                }
                doc.addImage(imgData, 'JPEG', 0, 0, imgProps.width, imgProps.height);
            }

            return doc.output('datauristring');
        } catch (error) {
            console.error('PDF Compression Error:', error);
            return base64Data;
        }
    },
    async compressImage(base64Data, quality = 0.7) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Data;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => resolve(base64Data);
        });
    }
};
