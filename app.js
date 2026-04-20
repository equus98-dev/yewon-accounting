// app.js - 앱 초기화 및 라우팅

const App = (() => {
    const VIEWS = {
        schedule: { label: '산단 일정관리', icon: 'fa-solid fa-calendar-check', module: () => ScheduleModule.render(), roles: ['admin', 'user'], group: '산학협력단 전체예산관리' },
        budgetOverview: { label: '전체예산(운영계산서) 집행현황', icon: 'fa-solid fa-chart-line', module: () => BudgetOverviewModule.render(), roles: ['admin', 'user'], group: '산학협력단 전체예산관리' },
        budget: { label: '전체예산(운영계산서) 입력', icon: 'fa-solid fa-coins', module: () => BudgetModule.render(), roles: ['admin', 'user'], group: '산학협력단 전체예산관리' },
        dashboard: { label: '과제(사업)별 예산집행현황', icon: 'fa-solid fa-chart-pie', module: () => DashboardModule.render(), roles: ['admin', 'user'], group: '과제(사업)예산관리' },
        projectBudget: { label: '과제(사업)별 예산 입력', icon: 'fa-solid fa-hand-holding-dollar', module: () => ProjectBudgetModule.render(), roles: ['admin', 'user'], group: '과제(사업)예산관리' },
        projects: { label: '과제(사업) 추가', icon: 'fa-solid fa-folder-plus', module: () => ProjectsModule.render(), roles: ['admin', 'user'], group: '과제(사업)예산관리' },
        projectAccounts: { label: '과제(사업)별 통장관리', icon: 'fa-solid fa-file-invoice-dollar', module: () => ProjectAccountsModule.render(), roles: ['admin', 'user'], group: '과제(사업)예산관리' },
        upload: { label: '은행거래내역 관리', icon: 'fa-solid fa-file-excel', module: () => ExcelParserModule.render(), roles: ['admin', 'user'], group: '과제(사업)예산관리' },
        income: { label: '수입 입력', icon: 'fa-solid fa-file-import', module: () => LedgerModule.render('income'), roles: ['admin', 'user'], group: '장부(수입 지출 입력)' },
        expense: { label: '지출 입력', icon: 'fa-solid fa-file-export', module: () => LedgerModule.render('expense'), roles: ['admin', 'user'], group: '장부(수입 지출 입력)' },
        reports: { label: '재무보고서', icon: 'fa-solid fa-file-contract', module: () => ReportsModule.render(), roles: ['admin', 'user'], group: '산학협력단 전체예산관리' },
        assets: { label: '자산 관리', icon: 'fa-solid fa-boxes-stacked', module: () => AssetModule.render(), roles: ['admin', 'user'], group: '산학협력단 전체예산관리' },
        voucher: { label: '수입지출 결의서 작성 및 결재', icon: 'fa-solid fa-signature', module: () => VoucherModule.render(), roles: ['admin', 'user'], group: '장부(수입 지출 입력)' },
        users: { label: '사용자 관리', icon: 'fa-solid fa-users-gear', module: () => UserManagementModule.render(), roles: ['admin'], group: '설정' },
        profile: { label: '마이페이지', icon: 'fa-solid fa-user-gear', module: () => ProfileModule.render(), roles: ['admin', 'user'], group: '설정' },
    };

    let currentView = 'schedule';

    function navigate(view) {
        if (!VIEWS[view]) return;
        const session = Auth.getSession();
        const allowedRoles = VIEWS[view].roles || ['admin', 'user'];
        if (!session || !allowedRoles.includes(session.role)) {
            helpers.showToast('접근 권한이 없습니다.', 'error');
            return;
        }
        currentView = view;

        document.querySelectorAll('.nav-item').forEach(el =>
            el.classList.toggle('active', el.dataset.view === view)
        );

        const content = document.getElementById('app-content');
        content.classList.add('fade-out');
        setTimeout(() => {
            content.classList.remove('fade-out');
            VIEWS[view].module();

            // [전역 위젯] 페이지 제목 하단에 오늘의 일정 자동 삽입 (재무보고서, 결의서 관리 메뉴 제외)
            const pageHeader = content.querySelector('.page-header');
            if (pageHeader && view !== 'login' && view !== 'reports' && view !== 'voucher') {
                const widgetHtml = helpers.renderTodayScheduleWidget();
                pageHeader.insertAdjacentHTML('afterend', widgetHtml);
            }

            // 페이지 제목 동기화 (사이드바 메뉴 기준)
            const titleEl = document.querySelector('.page-title');
            if (titleEl) titleEl.textContent = VIEWS[view].label;

            // 모바일일 경우 탐색 후 사이드바 닫기
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        }, 150);
    }

    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const isOpen = sidebar.classList.contains('show');

        if (isOpen) {
            closeSidebar();
        } else {
            sidebar.classList.add('show');
            overlay?.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    function toggleMiniSidebar() {
        const sidebar = document.getElementById('sidebar');
        const isMini = sidebar.classList.toggle('sidebar-mini');
        localStorage.setItem('yw_sidebar_mini', isMini);

        // 아이콘 변경
        const btnIcon = document.querySelector('#mini-toggle i');
        if (btnIcon) {
            btnIcon.className = isMini ? 'fa-solid fa-angles-right' : 'fa-solid fa-angles-left';
        }
    }

    function closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar?.classList.remove('show');
        overlay?.classList.remove('show');
        document.body.style.overflow = '';
    }

    function renderSidebar() {
        const sidebar = document.getElementById('sidebar-nav');
        if (!sidebar) return;
        const session = Auth.getSession();
        const projects = db.getProjects();
        const allLedger = db.getLedger();
        const expenseCount = allLedger.filter(e => e.type === 'expense').length;
        const incomeCount = allLedger.filter(e => e.type === 'income').length;

        // 그룹별로 분류
        const visibleViews = Object.entries(VIEWS)
            .filter(([, v]) => !session || (v.roles || []).includes(session.role));

        const groups = [];
        const seen = new Set();
        visibleViews.forEach(([key, v]) => {
            const g = v.group || '';
            if (!seen.has(g)) {
                seen.add(g);
                groups.push({ name: g, items: [] });
            }
            groups.find(gr => gr.name === g).items.push([key, v]);
        });

        sidebar.innerHTML = groups.map(g => {
            let groupClass = 'nav-group-blue';
            if (g.name === '사용자 관리' || g.name === '설정') groupClass = 'nav-group-green';
            const header = g.name ? `<li class="nav-group-header ${groupClass}"><span>${g.name}</span></li>` : '';
            const items = g.items.map(([key, v]) => {
                let badge = '';
                if (key === 'projects' && projects.length) badge = `<span class="nav-badge">${projects.length}</span>`;
                if (key === 'expense' && expenseCount) badge = `<span class="nav-badge">${expenseCount}</span>`;
                if (key === 'income' && incomeCount) badge = `<span class="nav-badge">${incomeCount}</span>`;

                // 재무보고서, 자산관리, 과제관리 메뉴는 연두색 강조 배경 적용
                const specialClass = (['reports', 'assets', 'projects', 'projectAccounts', 'upload'].includes(key)) ? 'special-green-item' : '';

                return `
          <li class="nav-item ${currentView === key ? 'active' : ''} ${specialClass}" data-view="${key}" onclick="App.navigate('${key}')" title="${v.label}">
            <i class="nav-icon ${v.icon}"></i>
            <span class="nav-label">${v.label}</span>
            ${badge}
          </li>
        `;
            }).join('');
            return header + items;
        }).join('');

        renderProfile();
    }

    function renderProfile() {
        const session = Auth.getSession();
        const footer = document.getElementById('sidebar-profile');
        if (!footer || !session) return;

        footer.innerHTML = `
            <div class="user-profile-card">
                <div class="user-avatar">
                    <i class="fa-solid fa-user-tie"></i>
                </div>
                <div class="user-info">
                    <div class="user-name">${session.name}</div>
                    <div class="user-role">${session.role === 'admin' ? '시스템 관리자' : '일반 사용자'}</div>
                </div>
                <button class="logout-mini-btn" onclick="Auth.logout()" title="로그아웃">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </button>
            </div>
        `;
    }

    function renderHeaderUser() {
        const session = Auth.getSession();
        const el = document.getElementById('header-user-info');
        if (!el || !session) return;
        el.innerHTML = `
      <span class="header-user-role">${session.role === 'admin' ? '관리자' : '사용자'}</span>
      <span class="header-user-name">${session.name}</span>
      <span style="color:var(--text-muted);font-size:12px;">(${session.username})</span>
    `;
        // 관리자만 데이터 관리 버튼(초기화, 백업, 복원) 표시
        const resetBtn = document.getElementById('btn-reset-data');
        const backupBtn = document.getElementById('btn-backup-data');
        const restoreBtn = document.getElementById('btn-restore-data');
        const isAdmin = session.role === 'admin';

        if (resetBtn) resetBtn.style.display = isAdmin ? '' : 'none';
        if (backupBtn) backupBtn.style.display = isAdmin ? '' : 'none';
        if (restoreBtn) restoreBtn.style.display = isAdmin ? '' : 'none';
    }

    function refreshSidebar() { renderSidebar(); }

    function seedSampleData() {
        if (db.getProjects().length > 0) return;
        const proj = db.saveProject({
            name: '2025 산학협력 전시 프로젝트',
            manager: '김예원',
            accountNo: '110-123-456789',
            startDate: '2025-03-01',
            endDate: '2025-12-31',
            totalBudget: 30000000,
            org: '예원예술대학교 산학협력단',
            categories: helpers.DEFAULT_CATEGORIES,
            note: '샘플 데이터'
        });
        const entries = [
            { transactionDate: '2025-04-05', type: 'income', amount: 30000000, description: '연구비 수령', category: '', projectId: proj.id },
            { transactionDate: '2025-04-10', type: 'expense', amount: 2500000, description: '전시 공간 대관', category: '대관료', projectId: proj.id },
            { transactionDate: '2025-05-02', type: 'expense', amount: 1800000, description: '홍보물 제작', category: '홍보비', projectId: proj.id },
            { transactionDate: '2025-05-15', type: 'expense', amount: 3200000, description: '예술 재료 구입', category: '재료비', projectId: proj.id },
            { transactionDate: '2025-06-01', type: 'expense', amount: 5000000, description: '외부 강사 인건비', category: '인건비', projectId: proj.id },
        ];
        entries.forEach(e => {
            e.hash = helpers.generateHash(e.transactionDate, e.amount, e.description);
            db.saveLedgerEntry(e);
        });
    }

    // ───── 보안 안내 ─────
    function checkSecurity() {
        if (Auth.isDefaultPassword()) {
            setTimeout(() => {
                showPasswordChangePrompt();
            }, 1000);
        }
    }

    function showPasswordChangePrompt() {
        const modalId = 'security-prompt-modal';
        if (document.getElementById(modalId)) return;

        const modalHtml = `
            <div class="modal-overlay active" id="${modalId}">
                <div class="modal security-modal">
                    <div class="modal-header">
                        <h3 style="color:#e11d48;"><i class="fa-solid fa-shield-halved"></i> 보안 알림</h3>
                        <button class="modal-close" onclick="document.getElementById('${modalId}').remove()">×</button>
                    </div>
                    <div class="modal-body text-center" style="padding: 30px 20px;">
                        <div class="security-icon-anim">
                            <i class="fa-solid fa-lock-open" style="font-size: 48px; color: #e11d48; margin-bottom: 20px;"></i>
                        </div>
                        <h4 style="font-size: 18px; margin-bottom: 10px; font-weight: 700;">초기 비밀번호를 사용 중입니다!</h4>
                        <p style="color: var(--text-secondary); line-height: 1.6;">
                            현재 계정의 비밀번호가 초기값(1234)으로 설정되어 있어 보안에 취약합니다.<br>
                            안전한 시스템 이용을 위해 지금 바로 비밀번호를 변경해 주세요.
                        </p>
                    </div>
                    <div class="modal-footer" style="justify-content: center; gap: 12px; padding-bottom: 30px;">
                        <button class="btn btn-ghost" onclick="document.getElementById('${modalId}').remove()">나중에 하기</button>
                        <button class="btn btn-primary" style="background:#e11d48; border-color:#e11d48;" 
                            onclick="document.getElementById('${modalId}').remove(); App.navigate('profile')">
                            비밀번호 변경하러 가기
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    async function refreshStorageUsage() {
        const infoEl = document.getElementById('storage-usage-info');
        if (!infoEl) return;
        const data = await db.getStorageUsage();
        const usageGB = (data.totalUsage / (1024 * 1024 * 1024)).toFixed(2);
        const color = usageGB > 8 ? '#e11d48' : (usageGB > 5 ? '#f59e0b' : '#64748b');
        infoEl.innerHTML = `
            <i class="fa-solid fa-hard-drive"></i> R2 저장소: <span style="color:${color}; font-weight:600;">${usageGB} GB</span> / 9 GB
        `;
    }

    function init() {
        // 기본 관리자 계정 생성
        Auth.initDefaultAdmin();

        // 사이드바 설정 복원
        const sidebar = document.getElementById('sidebar');
        if (localStorage.getItem('yw_sidebar_mini') === 'true') {
            sidebar.classList.add('sidebar-mini');
            const btnIcon = document.querySelector('#mini-toggle i');
            if (btnIcon) btnIcon.className = 'fa-solid fa-angles-right';
        }

        renderSidebar();
        renderHeaderUser();
        // seedSampleData();
        checkSecurity();
        refreshStorageUsage();

        /* 2026-03-02 수정: 모달 오버레이 클릭 시 닫기 기능 제거 (취소 버튼으로만 닫히게 설정)
        document.addEventListener('click', e => {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
        */

        // 모바일 사이드바 토글
        const toggleBtn = document.getElementById('sidebar-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSidebar();
            });
        }

        navigate('schedule');
        renderSidebar();

        // 최상단 이동 버튼 로직 추가
        const topBtn = document.getElementById("back-to-top");
        if (topBtn) {
            window.addEventListener('scroll', () => {
                if (window.scrollY > 300) {
                    topBtn.style.display = "block";
                    setTimeout(() => topBtn.classList.add('show'), 10);
                } else {
                    topBtn.classList.remove('show');
                    setTimeout(() => { if (!topBtn.classList.contains('show')) topBtn.style.display = "none"; }, 400);
                }
            });

            topBtn.onclick = () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
        }
    }

    return { navigate, refreshSidebar, init, toggleSidebar, toggleMiniSidebar, closeSidebar, refreshStorageUsage };
})();

window.App = App;
