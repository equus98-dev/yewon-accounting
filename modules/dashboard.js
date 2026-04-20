// modules/dashboard.js - 예결산 대시보드

const DashboardModule = (() => {
  const { db } = window;
  const { helpers } = window;
  let charts = [];
  const BUDGET_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
  let _selectedYear = new Date().getMonth() < 2 ? new Date().getFullYear() - 1 : new Date().getFullYear();

  function render() {
    const projects = db.getProjects().filter(p => helpers.isProjectInFiscalYear(p, _selectedYear));
    const allLedger = db.getLedger();

    // 회계연도 기간 (3월 1일 ~ 익년 2월 말)
    const startDate = `${_selectedYear}-03-01`;
    const nextYearStart = `${_selectedYear + 1}-03-01`;

    // 해당 연도 장부 데이터 필터링
    const yearLedger = allLedger.filter(e => {
      const d = e.transactionDate;
      return d >= startDate && d < nextYearStart;
    });

    const stats = projects.map(p => db.getProjectStats(p.id, _selectedYear)).filter(Boolean);

    const totalBudget = stats.reduce((s, p) => s + p.budget, 0);
    const totalExpense = stats.reduce((s, p) => s + p.totalExpense, 0);
    const totalBalance = totalBudget - totalExpense;
    const overallRate = totalBudget > 0 ? Math.round((totalExpense / totalBudget) * 100) : 0;

    const recentEntries = [...yearLedger]
      .sort((a, b) => (b.transactionDate || '').localeCompare(a.transactionDate || ''))
      .slice(0, 10);

    document.getElementById('app-content').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">과제(사업)별 예산집행현황</h2>
          <p class="page-subtitle">${_selectedYear}년도 과제 예산 실적 현황을 확인합니다</p>
        </div>
        <select class="year-select" onchange="DashboardModule.changeYear(this.value)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--primary); font-weight: bold; color: var(--primary);">
          ${BUDGET_YEARS.map(y => `<option value="${y}" ${y === _selectedYear ? 'selected' : ''}>${y}년도</option>`).join('')}
        </select>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon kpi-blue">💰</div>
          <div class="kpi-info">
            <div class="kpi-label">당해 예산 합계</div>
            <div class="kpi-value">${helpers.formatCurrencyRaw(totalBudget)}<span class="kpi-unit">원</span></div>
            <div class="kpi-sub">${projects.length}개 과제</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-red">📤</div>
          <div class="kpi-info">
            <div class="kpi-label">당해 지출 합계</div>
            <div class="kpi-value">${helpers.formatCurrencyRaw(totalExpense)}<span class="kpi-unit">원</span></div>
            <div class="kpi-sub">집행률 ${overallRate}%</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-green">📥</div>
          <div class="kpi-info">
            <div class="kpi-label">당해 잔여 예산</div>
            <div class="kpi-value">${helpers.formatCurrencyRaw(totalBalance)}<span class="kpi-unit">원</span></div>
            <div class="kpi-sub">미집행 ${100 - overallRate}%</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-purple">📊</div>
          <div class="kpi-info">
            <div class="kpi-label">당해 거래 건수</div>
            <div class="kpi-value">${yearLedger.length}<span class="kpi-unit">건</span></div>
            <div class="kpi-sub">연간 실적</div>
          </div>
        </div>
      </div>

      <div class="charts-grid">
        <div class="card chart-card">
          <h4 class="card-title">과제별 예산 집행 현황 (${_selectedYear}년)</h4>
          <div class="chart-container">
            <canvas id="chart-execution"></canvas>
          </div>
        </div>
        <div class="card chart-card">
          <h4 class="card-title">비목별 지출 분포 (${_selectedYear}년)</h4>
          <div class="chart-container">
            <canvas id="chart-category"></canvas>
          </div>
        </div>
      </div>

      ${projects.length ? `
      <div class="card">
        <h4 class="card-title">과제별 상세 현황 (${_selectedYear}년)</h4>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>과제명</th>
                <th>책임자</th>
                <th>업무담당</th>
                <th class="text-right">총 예산</th>
                <th class="text-right">수입</th>
                <th class="text-right">지출</th>
                <th class="text-right">잔액(수입-지출)</th>
                <th>집행률</th>
                <th class="text-center">상태</th>
              </tr>
            </thead>
            <tbody>
              ${stats.map(s => {
      const proj = db.getProjectById(s.projectId);
      const isActive = proj && (!proj.endDate || new Date(proj.endDate) >= new Date());
      const rateColor = s.executionRate >= 90 ? 'danger' : s.executionRate >= 70 ? 'warning' : 'success';
      return `
                  <tr>
                    <td><strong>${s.projectName}</strong></td>
                    <td>${proj?.manager || '-'}</td>
                    <td>${proj?.staff || '-'}</td>
                    <td class="text-right">${helpers.formatCurrencyRaw(s.budget)}원</td>
                    <td class="text-right text-success">${helpers.formatCurrencyRaw(s.totalIncome)}원</td>
                    <td class="text-right text-danger">${helpers.formatCurrencyRaw(s.totalExpense)}원</td>
                    <td class="text-right" style="color:#2563eb; font-weight:600;">${helpers.formatCurrencyRaw(s.totalIncome - s.totalExpense)}원</td>
                    <td style="min-width:160px">
                      <div class="progress-bar-wrap">
                        <div class="progress-bar progress-${rateColor}" style="width:${Math.min(s.executionRate, 100)}%"></div>
                        <span class="progress-text">${s.executionRate}%</span>
                      </div>
                    </td>
                    <td class="text-center">
                      <span class="badge ${isActive ? 'badge-success' : 'badge-neutral'}">${isActive ? '진행중' : '완료'}</span>
                    </td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>
      </div>` : `<div class="card empty-state">
        <div class="empty-icon">📋</div>
        <p>${_selectedYear}년도에 해당하는 과제 데이터가 없습니다.</p>
        <button class="btn btn-primary" onclick="App.navigate('projects')">과제 등록하기</button>
      </div>`}

      <div class="card">
        <h4 class="card-title">당해 회계연도 거래 내역 (최근 10건)</h4>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>거래일</th>
                <th>과제명</th>
                <th class="text-left">적요</th>
                <th>비목</th>
                <th class="text-center">유형</th>
                <th class="text-right">금액</th>
              </tr>
            </thead>
            <tbody>
              ${recentEntries.length ? recentEntries.map(e => {
      const proj = db.getProjectById(e.projectId);
      return `
                  <tr>
                    <td class="mono">${e.transactionDate || '-'}</td>
                    <td>${proj ? proj.name : '<span class="badge badge-neutral">비사업 항목</span>'}</td>
                    <td class="text-left">${e.description || '-'}</td>
                    <td>${e.category ? `<span class="badge badge-category">${e.category}</span>` : '-'}</td>
                    <td class="text-center">
                      <span class="badge ${e.type === 'income' ? 'badge-success' : 'badge-danger'}">${e.type === 'income' ? '입금' : '출금'}</span>
                    </td>
                    <td class="text-right ${e.type === 'income' ? 'text-success' : 'text-danger'}">
                      ${e.type === 'income' ? '+' : '-'}${helpers.formatCurrencyRaw(e.amount)}원
                    </td>
                  </tr>
                `;
    }).join('') : `<tr><td colspan="6" class="empty-cell">해당 연도의 거래 내역이 없습니다.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    destroyCharts();
    if (projects.length) {
      setTimeout(() => {
        renderExecutionChart(stats);
        renderCategoryChart(yearLedger);
      }, 50);
    }
  }

  function changeYear(year) {
    _selectedYear = parseInt(year);
    render();
  }

  function destroyCharts() {
    charts.forEach(c => { try { c.destroy(); } catch { } });
    charts = [];
  }

  function renderExecutionChart(stats) {
    const ctx = document.getElementById('chart-execution');
    if (!ctx || !stats.length) return;
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: stats.map(s => s.projectName.length > 10 ? s.projectName.substring(0, 10) + '…' : s.projectName),
        datasets: [
          {
            label: '지출',
            data: stats.map(s => s.totalExpense),
            backgroundColor: helpers.createChartGradient(ctx.getContext('2d'), '#e11d48', '#fb7185'),
            borderRadius: 6
          },
          {
            label: '잔액',
            data: stats.map(s => Math.max(s.balance, 0)),
            backgroundColor: helpers.createChartGradient(ctx.getContext('2d'), '#9bc31e', '#b8e23b'),
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: {
          x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
          y: { stacked: true, ticks: { color: '#94a3b8', callback: v => (v / 10000).toFixed(0) + '만' }, grid: { color: 'rgba(148,163,184,0.1)' } }
        }
      }
    });
    charts.push(chart);
  }

  function renderCategoryChart(entries) {
    const ctx = document.getElementById('chart-category');
    if (!ctx) return;
    const expenses = entries.filter(e => e.type === 'expense' && e.category);
    const catMap = {};
    expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
    const labels = Object.keys(catMap);
    const data = Object.values(catMap);
    if (!labels.length) return;

    // 세련된 색상 조합
    const COLORS = [
      helpers.createChartGradient(ctx.getContext('2d'), '#004ba0', '#0066d6'), // Blue
      helpers.createChartGradient(ctx.getContext('2d'), '#9bc31e', '#b8e23b'), // Green
      helpers.createChartGradient(ctx.getContext('2d'), '#f59e0b', '#fbbf24'), // Orange
      helpers.createChartGradient(ctx.getContext('2d'), '#e11d48', '#fb7185'), // Red
      helpers.createChartGradient(ctx.getContext('2d'), '#8b5cf6', '#a78bfa'), // Purple
      helpers.createChartGradient(ctx.getContext('2d'), '#14b8a6', '#5eead4')  // Teal
    ];
    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: COLORS.slice(0, labels.length), borderWidth: 2, borderColor: '#1e293b' }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${Number(ctx.parsed).toLocaleString()}원` } }
        }
      }
    });
    charts.push(chart);
  }

  return { render, changeYear };
})();

window.DashboardModule = DashboardModule;
