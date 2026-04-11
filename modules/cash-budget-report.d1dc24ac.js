// modules/cash-budget-report.js - 현금예산서 공식 보고서 형식 (비교식 버전)

const CashBudgetReportModule = (() => {
  const { db, helpers } = window;

  function render(container, selectedYear) {
    const year = selectedYear || (window.BudgetModule ? window.BudgetModule._selectedYear : 2026);
    const prevYear = year - 1;
    const allItems = db.getBudgetItems();

    const items = allItems.filter(b => (b.year || 2026) === year);
    const prevItems = allItems.filter(b => (b.year || 2026) === prevYear);

    const getStats = (list) => {
      const beginning = list.filter(b => b.type === 'beginning').reduce((s, b) => s + (b.amount || 0), 0);
      const income = list.filter(b => b.type === 'income').reduce((s, b) => s + (b.amount || 0), 0);
      const expense = list.filter(b => b.type === 'expense').reduce((s, b) => s + (b.amount || 0), 0);
      const reserve = list.filter(b => b.type === 'reserve').reduce((s, b) => s + (b.amount || 0), 0);
      return { beginning, income, expense, reserve, ending: (beginning + income) - (expense + reserve) };
    };

    const stats = getStats(items);
    const prevStats = getStats(prevItems);

    container.innerHTML = `
      <div class="print-container comparative">
        <div class="report-form-header">
          <div class="report-logo-section">
            <img src="img/logo_Black.png" alt="예원예술대학교 로고" class="report-university-logo">
          </div>
          <div class="report-title-section">
            <h1 class="report-main-title">현 금 예 산 서</h1>
            <p class="report-period">
              [당기] 제 ${year - 1999} 기 : ${year}. 03. 01 ~ ${year + 1}. 02. 28 <br>
              [전기] 제 ${prevYear - 1999} 기 : ${prevYear}. 03. 01 ~ ${prevYear + 1}. 02. 28
            </p>
          </div>
          <div class="report-empty-space"></div>
        </div>

        <div class="report-info-bar">
          <span>예원예술대학교 산학협력단</span>
          <span class="report-unit">(단위: 원)</span>
        </div>

        <div class="table-wrapper">
          <table class="report-table comparative-table">
            <thead>
              <tr>
                <th style="width:40%">과 목 (Account)</th> 
                <th>제 ${year - 1999} (당) 기</th> 
                <th>제 ${prevYear - 1999} (전) 기</th> 
                <th>증 감 (Variance)</th> 
              </tr>
            </thead>
            <tbody>
              <tr class="row-final">
                <td><strong>📥 수입 (현금유입액)</strong></td>
                <td class="text-right"><strong>${helpers.formatCurrencyRaw(stats.income + stats.beginning)}</strong></td>
                <td class="text-right"><strong>${helpers.formatCurrencyRaw(prevStats.income + prevStats.beginning)}</strong></td>
                <td class="text-right"><strong>${helpers.formatCurrencyRaw((stats.income + stats.beginning) - (prevStats.income + prevStats.beginning))}</strong></td>
              </tr>
              ${renderHierarchicalRows(items, prevItems, 'income', year, prevYear)}
              ${renderHierarchicalRows(items, prevItems, 'beginning', year, prevYear)}
              
              <tr style="height: 30px;"><td colspan="4"></td></tr>

              <tr class="row-final">
                <td><strong>📤 지출 (현금유출액)</strong></td>
                <td class="text-right"><strong>${helpers.formatCurrencyRaw(stats.expense + stats.reserve)}</strong></td>
                <td class="text-right"><strong>${helpers.formatCurrencyRaw(prevStats.expense + prevStats.reserve)}</strong></td>
                <td class="text-right"><strong>${helpers.formatCurrencyRaw((stats.expense + stats.reserve) - (prevStats.expense + prevStats.reserve))}</strong></td>
              </tr>
              ${renderHierarchicalRows(items, prevItems, 'expense', year, prevYear)}
              ${renderHierarchicalRows(items, prevItems, 'reserve', year, prevYear)}

              <tr class="row-final" style="background-color: #f8fafc !important;">
                <td><strong>📊 기말의현금 (회계상 잔액)</strong></td>
                <td class="text-right"><strong>${helpers.formatCurrencyRaw(stats.ending)}</strong></td>
                <td class="text-right"><strong>${helpers.formatCurrencyRaw(prevStats.ending)}</strong></td>
                <td class="text-right"><strong>${helpers.formatCurrencyRaw(stats.ending - prevStats.ending)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="report-footer-school">
          예원예술대학교 산학협력단
        </div>
      </div>
    `;
  }

  function renderHierarchicalRows(items, prevItems, type, year, prevYear) {
    if (!window.BudgetModule) return '';
    const struct = window.BudgetModule.BUDGET_STRUCTURE[type];
    if (!struct) return '';

    let html = '';

    struct.sections.forEach(sec => {
      const secCodes = [];
      sec.categories.forEach(c => c.items.forEach(i => secCodes.push(i.code)));

      const secTotal = items.filter(b => secCodes.includes(b.itemCode)).reduce((s, b) => s + (b.amount || 0), 0);
      const prevSecTotal = prevItems.filter(b => secCodes.includes(b.itemCode)).reduce((s, b) => s + (b.amount || 0), 0);

      html += formatHierarchicalRow(sec.name, secTotal, prevSecTotal, 1, true);

      sec.categories.forEach(cat => {
        const catCodes = cat.items.map(i => i.code);
        const catTotal = items.filter(b => catCodes.includes(b.itemCode)).reduce((s, b) => s + (b.amount || 0), 0);
        const prevCatTotal = prevItems.filter(b => catCodes.includes(b.itemCode)).reduce((s, b) => s + (b.amount || 0), 0);

        html += formatHierarchicalRow(cat.name, catTotal, prevCatTotal, 2);

        cat.items.forEach(itemDef => {
          const b = items.find(x => x.itemCode === itemDef.code);
          const pb = prevItems.find(x => x.itemCode === itemDef.code);

          html += formatHierarchicalRow(itemDef.name, b ? b.amount : 0, pb ? pb.amount : 0, 3);
        });
      });
    });

    return html;
  }

  function formatHierarchicalRow(name, amount, prevAmount, level = 0, isBold = false) {
    let classAttr = 'row-item';
    if (level === 1) classAttr = 'row-group';

    const indent = level > 1 ? `padding-left: ${(level - 1) * 20}px;` : '';
    const nameContent = isBold ? `<strong>${name}</strong>` : name;
    const dots = level > 1 ? '<div class="item-dots"></div>' : '';

    return `
      <tr class="${classAttr}">
        <td>
          <div class="dotted-cell" style="${indent}">
            <span class="item-name" style="white-space: nowrap;">${nameContent}</span>
            ${dots}
          </div>
        </td>
        <td class="text-right" style="vertical-align: bottom;">${helpers.formatCurrencyRaw(amount)}</td>
        <td class="text-right" style="vertical-align: bottom; color: #64748b;">${helpers.formatCurrencyRaw(prevAmount)}</td>
        <td class="text-right" style="vertical-align: bottom; font-weight: 600;">${helpers.formatCurrencyRaw(amount - prevAmount)}</td>
      </tr>
    `;
  }

  function exportToExcel(selectedYear) {
    const year = selectedYear || (window.BudgetModule ? window.BudgetModule._selectedYear : 2026);
    const prevYear = year - 1;
    const allItems = db.getBudgetItems();
    const items = allItems.filter(b => (b.year || 2026) === year);
    const prevItems = allItems.filter(b => (b.year || 2026) === prevYear);

    const getStats = (list) => {
      const beginning = list.filter(b => b.type === 'beginning').reduce((s, b) => s + (b.amount || 0), 0);
      const income = list.filter(b => b.type === 'income').reduce((s, b) => s + (b.amount || 0), 0);
      const expense = list.filter(b => b.type === 'expense').reduce((s, b) => s + (b.amount || 0), 0);
      const reserve = list.filter(b => b.type === 'reserve').reduce((s, b) => s + (b.amount || 0), 0);
      return { beginning, income, expense, reserve, ending: (beginning + income) - (expense + reserve) };
    };

    const stats = getStats(items);
    const prevStats = getStats(prevItems);

    const wb = XLSX.utils.book_new();
    const data = [];

    // Title & Info
    data.push(["현 금 예 산 서"]);
    data.push([`[당기] 제 ${year - 1999} 기 : ${year}. 03. 01 ~ ${year + 1}. 02. 28`]);
    data.push([`[전기] 제 ${prevYear - 1999} 기 : ${prevYear}. 03. 01 ~ ${prevYear + 1}. 02. 28`]);
    data.push(["예원예술대학교 산학협력단", "", "", " (단위: 원)"]);
    data.push([]); // Empty row

    // Header
    data.push(["과 목 (Account)", `제 ${year - 1999} (당) 기`, `제 ${prevYear - 1999} (전) 기`, "증 감 (Variance)"]);

    const addRows = (name, currVal, prevVal, level = 0) => {
      const indent = "  ".repeat(level);
      data.push([indent + name, currVal, prevVal, currVal - prevVal]);
    };

    // Income
    addRows("📥 수입 (현금유입액)", stats.income + stats.beginning, prevStats.income + prevStats.beginning, 0);
    const incomeStruct = window.BudgetModule?.BUDGET_STRUCTURE['income'];
    if (incomeStruct) {
      incomeStruct.sections.forEach(sec => {
        const secCodes = [];
        sec.categories.forEach(c => c.items.forEach(i => secCodes.push(i.code)));
        const secTotal = items.filter(b => secCodes.includes(b.itemCode)).reduce((s, b) => s + (b.amount || 0), 0);
        const prevSecTotal = prevItems.filter(b => secCodes.includes(b.itemCode)).reduce((s, b) => s + (b.amount || 0), 0);
        addRows(sec.name, secTotal, prevSecTotal, 1);
        sec.categories.forEach(cat => {
          const catCodes = cat.items.map(i => i.code);
          const catTotal = items.filter(b => catCodes.includes(b.itemCode)).reduce((s, b) => s + (b.amount || 0), 0);
          const prevCatTotal = prevItems.filter(b => catCodes.includes(b.itemCode)).reduce((s, b) => s + (b.amount || 0), 0);
          addRows(cat.name, catTotal, prevCatTotal, 2);
        });
      });
    }

    data.push([]);

    // Expense
    addRows("📤 지출 (현금유출액)", stats.expense + stats.reserve, prevStats.expense + prevStats.reserve, 0);
    const expenseStruct = window.BudgetModule?.BUDGET_STRUCTURE['expense'];
    if (expenseStruct) {
      expenseStruct.sections.forEach(sec => {
        const secCodes = [];
        sec.categories.forEach(c => c.items.forEach(i => secCodes.push(i.code)));
        const secTotal = items.filter(b => secCodes.includes(b.itemCode)).reduce((s, b) => s + (b.amount || 0), 0);
        const prevSecTotal = prevItems.filter(b => secCodes.includes(b.itemCode)).reduce((s, b) => s + (b.amount || 0), 0);
        addRows(sec.name, secTotal, prevSecTotal, 1);
        sec.categories.forEach(cat => {
          const catCodes = cat.items.map(i => i.code);
          const catTotal = items.filter(b => catCodes.includes(b.itemCode)).reduce((s, b) => s + (b.amount || 0), 0);
          const prevCatTotal = prevItems.filter(b => catCodes.includes(b.itemCode)).reduce((s, b) => s + (b.amount || 0), 0);
          addRows(cat.name, catTotal, prevCatTotal, 2);
        });
      });
    }

    data.push([]);
    addRows("📊 기말의현금 (회계상 잔액)", stats.ending, prevStats.ending, 0);

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Styling
    const range = XLSX.utils.decode_range(ws['!ref']);
    const headerRowIdx = 5;

    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: headerRowIdx, c: C });
      if (!ws[address]) continue;
      ws[address].s = {
        fill: { fgColor: { rgb: "F2F2F2" } },
        font: { bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin" }, bottom: { style: "thin" },
          left: { style: "thin" }, right: { style: "thin" }
        }
      };
    }

    for (let R = headerRowIdx + 1; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[address]) continue;

        const isAmount = (C > 0);
        ws[address].s = {
          border: {
            top: { style: "thin" }, bottom: { style: "thin" },
            left: { style: "thin" }, right: { style: "thin" }
          },
          alignment: { horizontal: isAmount ? "right" : "left", vertical: "center" }
        };

        if (isAmount && typeof ws[address].v === 'number') {
          ws[address].z = "#,##0";
        }
      }
    }

    ws["A1"].s = { font: { size: 20, bold: true }, alignment: { horizontal: "center" } };
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } }
    ];

    ws["!cols"] = [
      { wch: 45 }, { wch: 22 }, { wch: 22 }, { wch: 22 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "현금예산서");
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    XLSX.writeFile(wb, `예원예술대학교_현금예산서_${dateStr}.xlsx`);
  }

  return { render, exportToExcel };
})();

window.CashBudgetReportModule = CashBudgetReportModule;
