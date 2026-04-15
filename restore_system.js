const fs = require('fs');

const indexHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>예원예술대학교 산학협력단 | 회계관리 시스템</title>
    <meta name="description" content="예원예술대학교 산학협력단 간편 예결산 및 지출결의 관리 시스템">
    
    <!-- 외부 라이브러리 -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    
    <!-- 스타일 -->
    <link rel="stylesheet" href="style.css">
    
    <!-- FullCalendar CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.css">
    <!-- FullCalendar JS -->
    <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js"></script>
    
    <!-- PDF.js -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    </script>
    
    <!-- jsPDF for compression -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

    <style id="main-style">
        /* 인쇄 참조용 */
    </style>
</head>
<body>
    <script>
        window.onerror = function(msg, url, line, col, error) {
            const errorMsg = "🚨 시스템 오류 발생!\\n\\n메시지: " + msg + "\\n위치: " + url + ":" + line + ":" + col;
            alert(errorMsg);
            return false;
        };
    </script>

    <div id="login-screen">
        <div class="login-container">
            <div class="login-card">
                <div class="login-card-top">
                    <div class="login-deco-circle-1"></div>
                    <div class="login-deco-circle-2"></div>
                    <div class="login-logo-section">
                        <img src="img/logo.png" alt="예원예술대학교" onerror="this.style.display='none';">
                    </div>
                    <div class="login-header-animate">
                        <h1 class="login-title">
                            Accounting ERP System
                            <span>산학협력단 회계관리 시스템</span>
                        </h1>
                    </div>
                    <div class="login-wave-divider">
                        <svg class="login-animated-waves" xmlns="http://www.w3.org/2000/svg" viewBox="0 24 150 28" preserveAspectRatio="none">
                            <defs><path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" /></defs>
                            <g class="moving-waves">
                                <use href="#gentle-wave" x="48" y="0" fill="rgba(255,255,255,0.7)" />
                                <use href="#gentle-wave" x="48" y="7" fill="#ffffff" />
                            </g>
                        </svg>
                    </div>
                </div>
                <div class="login-card-bottom">
                    <div class="login-error" id="login-error"></div>
                    <div class="login-form">
                        <div class="form-group">
                            <label>사번</label>
                            <input type="text" id="login-username" class="login-input" placeholder="사번을 입력하세요">
                        </div>
                        <div class="form-group">
                            <label>비밀번호</label>
                            <input type="password" id="login-password" class="login-input" placeholder="비밀번호를 입력하세요">
                        </div>
                        <button class="login-btn" onclick="doLogin()">LOGIN</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="app-layout" class="app-layout" style="display: none;">
        <aside id="sidebar">
            <div class="sidebar-header">
                <div class="full-logo-group">
                    <img src="img/logo_white.png" alt="로고" class="sidebar-img-logo">
                    <span class="sidebar-org-name">산학협력단</span>
                </div>
            </div>
            <div class="sidebar-body">
                <ul class="nav-list" id="sidebar-nav"></ul>
            </div>
        </aside>

        <div class="main-area">
            <header id="app-header">
                <div class="header-left">
                    <h1 class="header-main-title">
                        <span class="title-ko">회계관리시스템</span>
                        <span class="version-badge">v23.10</span>
                    </h1>
                </div>
                <div class="header-right">
                    <button class="btn-logout" onclick="Auth.logout()">로그아웃</button>
                </div>
            </header>
            <main id="app-content">
                <div id="view-container"></div>
            </main>
        </div>
    </div>

    <script src="utils/accounting-logic.414c9f0d.js"></script>
    <script src="utils/db.798d86c9.js"></script>
    <script src="utils/helpers.8eed398a.js"></script>
    <script src="utils/auth.b272538c.js"></script>
    <script src="modules/dashboard.80e9eebc.js"></script>
    <script src="modules/projects.d16dfb2a.js"></script>
    <script src="modules/project-accounts.ae8e4f4d.js"></script>
    <script src="modules/excel-parser.d5c8eb19.js"></script>
    <script src="modules/ledger.cc7cca88.js"></script>
    <script src="modules/voucher.92b92ed4.js"></script>
    <script src="modules/budget-overview.2e2848e2.js"></script>
    <script src="modules/budget.a160e3ab.js"></script>
    <script src="modules/project-budget.5a59b25a.js"></script>
    <script src="modules/operating-statement.2110476d.js"></script>
    <script src="modules/balance-sheet.c7e83422.js"></script>
    <script src="modules/cash-flow.70871c37.js"></script>
    <script src="modules/cash-budget-report.d1dc24ac.js"></script>
    <script src="modules/reports.ca61bb0c.js"></script>
    <script src="modules/schedule.496c8353.js"></script>
    <script src="modules/user-management.b9a0206b.js"></script>
    <script src="modules/profile.2bf78181.js"></script>
    <script src="modules/assets.fbcad93c.js"></script>
    <script src="app.f4002ebb.js"></script>

    <script>
        (async function init() {
            try {
                await db.init();
                Auth.initDefaultAdmin();
                if (Auth.isLoggedIn()) {
                    document.getElementById('login-screen').style.display = 'none';
                    document.getElementById('app-layout').style.display = 'flex';
                    App.init();
                }
            } catch (e) { console.error(e); }
        })();

        function doLogin() {
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            const result = Auth.login(username, password);
            if (result.ok) {
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('app-layout').style.display = 'flex';
                App.init();
            } else {
                alert(result.message);
            }
        }
    </script>
</body>
</html>`;

const styleCss = \`@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css");

:root {
  --bg-base: #f8f9fa;
  --bg-surface: #ffffff;
  --bg-elevated: #f0f2f5;
  --border: #e9ecef;
  --border-light: #f1f3f5;
  --text-primary: #1a2236;
  --text-secondary: #495057;
  --text-muted: #adb5bd;
  --accent: #003366;
  --royal-blue: #0052cc;
  --radius: 10px;
  --shadow-card: 0 2px 12px rgba(0, 51, 102, 0.05);
  --transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --sidebar-w: 320px;
  --header-h: 85px;
}

body {
  font-family: 'Pretendard Variable', sans-serif;
  background: var(--bg-base);
  color: var(--text-primary);
  margin: 0;
}

#login-screen {
  position: fixed; inset: 0;
  background: linear-gradient(135deg, #001a33 0%, #003366 100%);
  display: flex; align-items: center; justify-content: center;
  z-index: 9000;
}
.login-card {
  background: white; border-radius: 20px; width: 400px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.3); overflow: hidden;
}
.login-card-top {
  background: #001f3f; padding: 30px; text-align: center; color: white;
}
.login-card-bottom { padding: 30px; }
.login-input {
  width: 100%; padding: 12px; margin-bottom: 15px;
  border: 1px solid #ddd; border-radius: 8px;
}
.login-btn {
  width: 100%; padding: 12px; background: #003366; color: white;
  border: none; border-radius: 8px; cursor: pointer; font-weight: bold;
}

.app-layout { display: flex; min-height: 100vh; }
#sidebar {
  width: var(--sidebar-w); background: #001a33; color: white;
  position: fixed; height: 100vh;
}
.main-area { margin-left: var(--sidebar-w); flex: 1; }
#app-header {
  height: var(--header-h); background: #f8f9fa; border-bottom: 1px solid #ddd;
  display: flex; align-items: center; justify-content: space-between; padding: 0 20px;
}
#app-content { padding: 20px; }

@media print {
  #sidebar, #app-header { display: none !important; }
  .main-area { margin: 0 !important; width: 100% !important; }
  @page { size: auto; margin: 10mm; }
}
\`;

fs.writeFileSync('index.html', indexHtml, 'utf8');
fs.writeFileSync('style.css', styleCss, 'utf8');

console.log('Restored index.html and style.css successfully.');
