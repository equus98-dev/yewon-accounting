const ReportsModule = (() => {
  let currentTab = 'cashflow'; // 'cashflow' | 'operating' | 'balance' | 'budget'
  let selectedYear = window.BudgetModule?._selectedYear || new Date().getFullYear();

  function render() {
    const years = [];
    const currentY = new Date().getFullYear();
    for (let y = currentY - 5; y <= currentY + 1; y++) years.push(y);

    document.getElementById('app-content').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">재무 보고서</h2>
          <p class="page-subtitle">실시간 집행 데이터를 기반으로 운영계산서, 현금흐름표, 재무상태표 및 현금예산서를 생성합니다.</p>
        </div>
        <div class="header-actions" style="display: flex; gap: 8px; align-items: center;">
          <select id="report-year-select" class="form-select" style="width: 120px; height: 38px;" onchange="ReportsModule.handleYearChange(this.value)">
            ${years.map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}년도</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-round" onclick="window.print()" title="PDF 출력">
            <i class="fa-solid fa-print"></i>
          </button>
          <button class="btn btn-outline btn-round" onclick="ReportsModule.exportToExcel()" title="엑셀 다운로드">
            <i class="fa-solid fa-file-excel"></i>
          </button>
        </div>
      </div>

      <div class="report-tabs-container">
        <div class="report-tab-group group-settlement">
          <span class="tab-group-label"><i class="fa-solid fa-file-invoice"></i> 결산용 보고서</span>
          <div class="tab-items">
            <button class="tab-item ${currentTab === 'cashflow' ? 'active' : ''}" onclick="ReportsModule.switchTab('cashflow')">현금흐름표 (Cash Flow)</button>
            <button class="tab-item ${currentTab === 'operating' ? 'active' : ''}" onclick="ReportsModule.switchTab('operating')">운영계산서 (Operating Statement)</button>
            <button class="tab-item ${currentTab === 'balance' ? 'active' : ''}" onclick="ReportsModule.switchTab('balance')">재무상태표 (Balance Sheet)</button>
          </div>
        </div>
        <div class="report-tab-group group-budget">
          <span class="tab-group-label"><i class="fa-solid fa-coins"></i> 예산용 보고서</span>
          <div class="tab-items">
            <button class="tab-item ${currentTab === 'budget' ? 'active' : ''}" onclick="ReportsModule.switchTab('budget')">현금예산서 (Cash Budget)</button>
          </div>
        </div>
      </div>

      <div id="report-container" class="fade-in">
        <!-- 리포트 컨텐츠 로드 영역 -->
      </div>
    `;

    loadTab();
  }

  function handleYearChange(year) {
    selectedYear = parseInt(year);
    loadTab();
  }

  function switchTab(tab) {
    currentTab = tab;
    render(); // Re-render to update tab active state and preserve year selection
  }

  function loadTab() {
    const container = document.getElementById('report-container');
    if (!container) return;

    container.innerHTML = `<div class="loading-wrap"><div class="spinner"></div><p>${selectedYear}년도 데이터를 집계 중입니다...</p></div>`;

    setTimeout(() => {
      if (currentTab === 'operating') {
        if (window.OperatingStatementModule) {
          OperatingStatementModule.render(container, selectedYear);
        } else {
          container.innerHTML = '<p class="text-center p-20">운영계산서 모듈을 로드할 수 없습니다.</p>';
        }
      } else if (currentTab === 'cashflow') {
        if (window.CashFlowModule) {
          CashFlowModule.render(container, selectedYear);
        } else {
          container.innerHTML = '<p class="text-center p-20">현금흐름표 모듈을 로드할 수 없습니다.</p>';
        }
      } else if (currentTab === 'balance') {
        if (window.BalanceSheetModule) {
          BalanceSheetModule.render(container, selectedYear);
        } else {
          container.innerHTML = '<p class="text-center p-20">재무상태표 모듈을 로드할 수 없습니다.</p>';
        }
      } else if (currentTab === 'budget') {
        if (window.CashBudgetReportModule) {
          CashBudgetReportModule.render(container, selectedYear);
        } else {
          container.innerHTML = '<p class="text-center p-20">현금예산서 모듈을 로드할 수 없습니다.</p>';
        }
      }
    }, 300);
  }

  function exportToExcel() {
    if (currentTab === 'operating' && window.OperatingStatementModule) {
      OperatingStatementModule.exportToExcel(selectedYear);
    } else if (currentTab === 'cashflow' && window.CashFlowModule) {
      CashFlowModule.exportToExcel(selectedYear);
    } else if (currentTab === 'balance' && window.BalanceSheetModule) {
      BalanceSheetModule.exportToExcel(selectedYear);
    } else if (currentTab === 'budget' && window.CashBudgetReportModule) {
      CashBudgetReportModule.exportToExcel(selectedYear);
    }
  }

  return { render, switchTab, exportToExcel, handleYearChange, get selectedYear() { return selectedYear; } };
})();

window.ReportsModule = ReportsModule;
