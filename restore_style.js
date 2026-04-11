const fs = require('fs');

const fullCss = `@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css");

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
  --accent-hover: #002244;
  --accent-glow: rgba(0, 82, 204, 0.12);
  --accent-sub: #eef4ff;
  --success: #2dcc70;
  --success-hover: #27ae60;
  --danger: #ff4757;
  --warning: #ffa502;
  --info: #2f3542;
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 16px;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.05);
  --shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  --shadow-card: 0 2px 12px rgba(0, 51, 102, 0.05);
  --shadow-premium: 0 10px 30px rgba(0, 51, 102, 0.08);
  --transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --sidebar-w: 320px;
  --sidebar-mini-w: 78px;
  --header-h: 85px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 17px; scroll-behavior: smooth; }
body {
  font-family: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif;
  background: var(--bg-base); color: var(--text-primary); min-height: 100vh; overflow-x: hidden; -webkit-font-smoothing: antialiased;
}

.text-left { text-align: left !important; }
.text-center { text-align: center !important; }
.text-right { text-align: right !important; }

.amount { font-family: 'JetBrains Mono', 'Pretendard', monospace; font-weight: 600; text-align: right !important; white-space: nowrap; letter-spacing: 0.8px; }
.text-success { color: var(--success) !important; }
.text-danger { color: var(--danger) !important; }
.text-muted { color: var(--text-muted) !important; }

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }

#sidebar {
  width: var(--sidebar-w); background: linear-gradient(135deg, #001a33 0%, #003366 30%, #004d40 70%, #00695c 100%);
  border-right: 1px solid rgba(255, 255, 255, 0.1); display: flex; flex-direction: column;
  position: fixed; top: 0; left: 0; height: 100vh; z-index: 1000; transition: width var(--transition);
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.2); overflow: hidden;
}

.sidebar-header { height: var(--header-h); padding: 14px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 6px; position: relative; }
.sidebar-logo { display: flex; align-items: center; text-decoration: none; }
.sidebar-img-logo { height: 38px; width: auto; }
.sidebar-org-name { font-size: 17px; font-weight: 800; color: #ffffff; margin-top: -5px; }

#login-screen { position: fixed; inset: 0; background: linear-gradient(135deg, #001a33 0%, #003366 40%, #004d40 70%, #00695c 100%); display: flex; align-items: center; justify-content: center; z-index: 9000; }
.login-card { background: #ffffff; border-radius: 28px; width: 100%; max-width: 480px; box-shadow: 0 40px 80px rgba(0,0,0,0.45); overflow: hidden; }
.login-card-top { background: linear-gradient(160deg, #001f3f 0%, #003366 45%, #00574b 80%, #006d5b 100%); padding: 42px; display: flex; flex-direction: column; align-items: center; }
.login-title { font-size: 26px; font-weight: 900; color: #ffffff; text-align: center; }
.login-title span { display: block; font-size: 14px; font-weight: 500; opacity: 0.8; margin-top: 8px; }
.login-card-bottom { padding: 32px; }
.login-input { width: 100%; padding: 14px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; margin-bottom: 14px; font-size: 15px; }
.login-btn { width: 100%; padding: 15px; background: linear-gradient(135deg, #001f3f 0%, #003366 50%, #004d40 100%); color: white; border: none; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 16px; letter-spacing: 2px; }

.main-area { margin-left: var(--sidebar-w); flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
#app-header { height: var(--header-h); background: linear-gradient(135deg, #001a33 0%, #003366 30%, #004d40 70%, #00695c 100%); display: flex; align-items: center; justify-content: space-between; padding: 0 32px; box-shadow: 0 4px 25px rgba(0, 0, 0, 0.4); z-index: 100; position: sticky; top: 0; }
.header-main-title { display: flex; align-items: center; gap: 20px; color: white; }
.version-badge { background: #0052cc; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 10px; }

@media print {
  #sidebar, #app-header { display: none !important; }
  .main-area { margin: 0 !important; width: 100% !important; }
  @page { size: auto; margin: 10mm; }
}
`;

fs.writeFileSync('style.css', fullCss, 'utf8');
console.log('Restored style.css with premium login styles.');
