// modules/budget-overview.js - 전체예산 집행현황 대시보드 (운영계산서 기준)

const BudgetOverviewModule = (() => {
  const { db } = window;
  const { helpers } = window;

  const BUDGET_YEARS = [2025, 2026, 2027, 2028, 2029, 2030];
  let _selectedYear = 2026;

  function render() {
    const budgetItems = db.getBudgetItems().filter(b => (b.year || 2026) === _selectedYear);

    // 관-항-목 순서로 정렬 (itemCode 기준)
    budgetItems.sort((a, b) => (a.itemCode || '').localeCompare(b.itemCode || ''));

    const allLedger = db.getLedger();

    // 예산 항목 필터링 및 합계 계산
    const incomeBudgetItems = budgetItems.filter(b => b.type === 'income');
    const expenseBudgetItems = budgetItems.filter(b => b.type === 'expense');
    const reserveBudgetItems = budgetItems.filter(b => b.type === 'reserve');

    const totalIncomeBudget = incomeBudgetItems.reduce((s, b) => s + (b.amount || 0), 0);
    const totalExpenseBudget = expenseBudgetItems.reduce((s, b) => s + (b.amount || 0), 0);
    const totalReserveBudget = reserveBudgetItems.reduce((s, b) => s + (b.amount || 0), 0);

    // 실제 집행 합계 (달력 연도 기준: 1월 ~ 12월)
    const startDate = `${_selectedYear}-01-01`;
    const endDate = `${_selectedYear}-12-31`;
    const yearLedger = allLedger.filter(e => {
      const d = e.transactionDate;
      return d >= startDate && d <= endDate;
    });
    const totalIncomeActual = yearLedger.filter(e => e.type === 'income').reduce((s, e) => s + (e.amount || 0), 0);
    const totalExpenseActual = yearLedger.filter(e => e.type === 'expense').reduce((s, e) => s + (e.amount || 0), 0);

    const incomeRate = totalIncomeBudget > 0
      ? Math.round((totalIncomeActual / totalIncomeBudget) * 100) : 0;
    const totalBudgetExpense = totalExpenseBudget + totalReserveBudget;
    const expenseRate = totalBudgetExpense > 0
      ? Math.round((totalExpenseActual / totalBudgetExpense) * 100) : 0;

    document.getElementById('app-content').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">전체예산(운영계산서) 집행현황</h2>
          <p class="page-subtitle">${_selectedYear}년도 산학협력단 운영수익·비용 대비 실제 집행 현황</p>
        </div>
        <select class="year-select" onchange="BudgetOverviewModule.changeYear(this.value)">
          ${BUDGET_YEARS.map(y => `<option value="${y}" ${y === _selectedYear ? 'selected' : ''}>${y}년</option>`).join('')}
        </select>
      </div>

      <!-- 항목별 집행 요약통계 (표형식) -->
      <div class="card summary-card" style="margin-top: 0; margin-bottom: 24px; padding: 24px; overflow: hidden;">
        <h4 class="card-title" style="margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">📊</span> 항목별 집행 요약통계
        </h4>
        <div class="table-wrapper">
          <table class="data-table summary-table" style="margin-bottom: 0; min-width: 800px;">
            <thead>
              <tr>
                <th class="text-left" style="width: 250px;">구분 (Category)</th>
                <th class="text-right">예산 총계 (A)</th>
                <th class="text-right">집행 실적 (B)</th>
                <th class="text-right">잔액 (A - B)</th>
                <th class="text-center" style="width: 160px;">집행/달성률</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="구분">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; background: rgba(45, 204, 112, 0.1); color: #2dcc70; font-size: 18px;">📥</span>
                    <div>
                      <div style="font-weight: 700; color: var(--text-primary); font-size: 15px;">운영수익</div>
                      <div style="font-size: 11px; color: var(--text-muted);">항목 ${incomeBudgetItems.length}개</div>
                    </div>
                  </div>
                </td>
                <td data-label="예산 총계" class="text-right amount" style="font-size: 16px;">${helpers.formatCurrencyRaw(totalIncomeBudget)}원</td>
                <td data-label="집행 실적" class="text-right amount text-success" style="font-size: 16px;"><strong>${helpers.formatCurrencyRaw(totalIncomeActual)}원</strong></td>
                <td data-label="잔액" class="text-right amount" style="font-size: 16px;">${helpers.formatCurrencyRaw(totalIncomeBudget - totalIncomeActual)}원</td>
                <td data-label="달성률" class="text-center">
                  <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                    <span class="badge badge-success" style="font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 20px;">${incomeRate}%</span>
                    <div style="width: 100px; height: 4px; background: #eee; border-radius: 2px; overflow: hidden;">
                      <div style="width: ${Math.min(incomeRate, 100)}%; height: 100%; background: #2dcc70;"></div>
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td data-label="구분">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; background: rgba(255, 71, 87, 0.1); color: #ff4757; font-size: 18px;">📤</span>
                    <div>
                      <div style="font-weight: 700; color: var(--text-primary); font-size: 15px;">운영비용</div>
                      <div style="font-size: 11px; color: var(--text-muted);">${expenseBudgetItems.length}개 + 예비비 ${reserveBudgetItems.length}개</div>
                    </div>
                  </div>
                </td>
                <td data-label="예산 총계" class="text-right amount" style="font-size: 16px;">${helpers.formatCurrencyRaw(totalBudgetExpense)}원</td>
                <td data-label="집행 실적" class="text-right amount text-danger" style="font-size: 16px;"><strong>${helpers.formatCurrencyRaw(totalExpenseActual)}원</strong></td>
                <td data-label="잔액" class="text-right amount" style="font-size: 16px;">${helpers.formatCurrencyRaw(totalBudgetExpense - totalExpenseActual)}원</td>
                <td data-label="집행률" class="text-center">
                  <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                    <span class="badge ${expenseRate >= 90 ? 'badge-danger' : 'badge-accent'}" style="font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 20px;">${expenseRate}%</span>
                    <div style="width: 100px; height: 4px; background: #eee; border-radius: 2px; overflow: hidden;">
                      <div style="width: ${Math.min(expenseRate, 100)}%; height: 100%; background: ${expenseRate >= 90 ? '#ff4757' : '#0052cc'};"></div>
                    </div>
                  </div>
                </td>
              </tr>
              <tr style="background: var(--bg-elevated); border-top: 2px solid var(--border);">
                <td data-label="구분">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; background: rgba(0, 82, 204, 0.1); color: #0052cc; font-size: 18px;">📊</span>
                    <div>
                      <div style="font-weight: 700; color: var(--text-primary); font-size: 15px;">운영차액</div>
                      <div style="font-size: 11px; color: var(--text-muted);">수익 - 비용</div>
                    </div>
                  </div>
                </td>
                <td data-label="예산 총계" class="text-right amount" style="font-size: 16px;"><strong>${helpers.formatCurrencyRaw(totalIncomeBudget - totalBudgetExpense)}원</strong></td>
                <td data-label="집행 실적" class="text-right amount ${totalIncomeActual - totalExpenseActual >= 0 ? 'text-success' : 'text-danger'}" style="font-size: 16px;"><strong>${helpers.formatCurrencyRaw(totalIncomeActual - totalExpenseActual)}원</strong></td>
                <td data-label="잔액" class="text-right amount" style="font-size: 16px;"><strong>${helpers.formatCurrencyRaw((totalIncomeBudget - totalBudgetExpense) - (totalIncomeActual - totalExpenseActual))}원</strong></td>
                <td data-label="비고" class="text-center">
                   <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">실시간 자동계산</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 운영수익 집행현황 -->
      <div class="card">
        <h4 class="card-title text-success">📥 운영수익 집행현황</h4>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th class="text-left">관 (Section)</th>
                <th class="text-left">항 (Category)</th>
                <th class="text-left text-nowrap">목 (Item)</th>
                <th class="text-right">예산액</th>
                <th class="text-right">집행액</th>
                <th class="text-right">잔액</th>
                <th style="min-width:140px">달성률</th>
              </tr>
            </thead>
            <tbody>
              ${incomeBudgetItems.length === 0
                ? `<tr><td colspan="7" class="empty-cell">등록된 운영수익 예산이 없습니다.</td></tr>`
                : renderExecutionRows(incomeBudgetItems, yearLedger, 'income')
              }
              <tr class="total-row">
                <td colspan="3" class="text-right">운영수익 합계</td>
                <td class="text-right">${helpers.formatCurrencyRaw(totalIncomeBudget)}원</td>
                <td class="text-right">${helpers.formatCurrencyRaw(totalIncomeActual)}원</td>
                <td class="text-right">${helpers.formatCurrencyRaw(totalIncomeBudget - totalIncomeActual)}원</td>
                <td>${renderProgressBar(incomeRate, 'success', true)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 운영비용 집행현황 -->
      <div class="card">
        <h4 class="card-title text-danger">📤 운영비용 집행현황</h4>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th class="text-left">관 (Section)</th>
                <th class="text-left">항 (Category)</th>
                <th class="text-left text-nowrap">목 (Item)</th>
                <th class="text-right">예산액</th>
                <th class="text-right">집행액</th>
                <th class="text-right">잔액</th>
                <th style="min-width:140px">집행률</th>
              </tr>
            </thead>
            <tbody>
              ${(expenseBudgetItems.length + reserveBudgetItems.length) === 0
                ? `<tr><td colspan="7" class="empty-cell">등록된 운영비용 예산이 없습니다.</td></tr>`
                : renderExecutionRows(expenseBudgetItems, yearLedger, 'expense') + renderExecutionRows(reserveBudgetItems, yearLedger, 'reserve')
              }
              <tr class="total-row">
                <td colspan="3" class="text-right">운영비용 합계 (예비비 포함)</td>
                <td class="text-right">${helpers.formatCurrencyRaw(totalBudgetExpense)}원</td>
                <td class="text-right">${helpers.formatCurrencyRaw(totalExpenseActual)}원</td>
                <td class="text-right">${helpers.formatCurrencyRaw(totalBudgetExpense - totalExpenseActual)}원</td>
                <td>${renderProgressBar(expenseRate, expenseRate >= 90 ? 'danger' : expenseRate >= 70 ? 'warning' : 'success', true)}</td>
              </tr>
              <!-- 운영차액 -->
              <tr class="total-row">
                <td colspan="3" class="text-right">📊 운영차액 (수익 - 비용)</td>
                <td class="text-right">${helpers.formatCurrencyRaw(totalIncomeBudget - totalBudgetExpense)}원</td>
                <td class="text-right">${helpers.formatCurrencyRaw(totalIncomeActual - totalExpenseActual)}원</td>
                <td class="text-right">${helpers.formatCurrencyRaw((totalIncomeBudget - totalBudgetExpense) - (totalIncomeActual - totalExpenseActual))}원</td>
                <td class="text-center"><span class="badge badge-accent">자동계산</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderExecutionRows(budgetItems, ledger, type) {
    if (!budgetItems.length) return '';

    return budgetItems.map(b => {
      const ledgerType = (type === 'reserve') ? 'expense' : type;
      const execution = (ledger && ledger.filter(e =>
        e.itemCode && e.itemCode.startsWith(b.itemCode) && e.type === ledgerType
      ).reduce((sum, e) => sum + (e.amount || 0), 0)) || 0;
      const balance = (b.amount || 0) - execution;
      const rate = (b.amount || 0) > 0 ? ((execution / (b.amount || 0)) * 100).toFixed(1) : '0.0';

      let colSection = b.section || '-';
      let colCategory = b.category || '-';
      let colItem = b.itemName || b.name || '-';

      if (b.level === '관') { colCategory = '-'; colItem = '-'; }
      else if (b.level === '항') { colItem = '-'; }

      const rateColor = type === 'expense' || type === 'reserve'
        ? (parseFloat(rate) >= 90 ? 'danger' : parseFloat(rate) >= 70 ? 'warning' : 'success')
        : 'success';

      return `
        <tr class="${b.level === '관' ? 'row-section' : ''}">
          <td data-label="관 (Section)" class="text-left">${colSection}</td>
          <td data-label="항 (Category)" class="text-left">${colCategory}</td>
          <td data-label="목 (Item)" class="text-left">${colItem}</td>
          <td data-label="예산액" class="text-right">${helpers.formatCurrencyRaw(b.amount || 0)}원</td>
          <td data-label="집행액" class="text-right ${type === 'income' ? 'text-success' : 'text-danger'}">
            <strong>${helpers.formatCurrencyRaw(execution)}원</strong>
          </td>
          <td data-label="잔액" class="text-right">${helpers.formatCurrencyRaw(balance)}원</td>
          <td data-label="${type === 'income' ? '달성률' : '집행률'}">${renderProgressBar(rate, rateColor)}</td>
        </tr>
      `;
    }).join('');
  }

  function renderProgressBar(rate, color, isTotal = false) {
    const trackStyle = isTotal
      ? 'background: rgba(255, 255, 255, 0.2) !important; border: 1px solid rgba(255, 255, 255, 0.3) !important;'
      : '';
    const barStyle = isTotal
      ? 'box-shadow: 0 0 8px #ADFF2F !important; border: 1px solid rgba(255, 255, 255, 0.5) !important;'
      : '';
    const textStyle = isTotal
      ? 'color: var(--text-primary) !important; font-weight: 800 !important;'
      : '';

    return `
      <div class="progress-bar-wrap" style="${trackStyle}">
        <div class="progress-bar progress-${color}" style="width:${Math.min(rate, 100)}%; ${barStyle}"></div>
        <span class="progress-text" style="${textStyle}">${rate}%</span>
      </div>
    `;
  }

  function changeYear(year) {
    _selectedYear = parseInt(year);
    render();
  }

  return { render, changeYear };
})();

window.BudgetOverviewModule = BudgetOverviewModule;
