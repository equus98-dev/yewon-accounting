const BalanceSheetModule = (() => {
  const { db, helpers, BudgetModule } = window;

  // 사용자가 요청한 상세 구조 정의
  const BS_STRUCTURE = {
    "Ⅰ_자산": {
      "1.유동자산": {
        "1)당좌자산": [
          "현금및현금성자산", "단기금융상품", "단기매매금융자산",
          "매출채권(학교기업)", "미수금", "미수수익", "선급금",
          "선급비용", "선급법인세", "부가세대급금", "기타당좌자산"
        ],
        "2)재고자산": ["재고자산(학교기업 판매용)"]
      },
      "2.비유동자산": {
        "1)투자자산": ["장기금융상품", "장기투자금융자산", "출자금(기술지주 등)", "기타투자자산"],
        "2)유형자산": ["토지", "건물", "구축물", "기계기구(실험장비)", "집기비품", "차량운반구", "건설중인자산", "(감가상각누계액)"],
        "3)무형자산": ["지식재산권", "개발비", "기타무형자산"],
        "4)기타비유동자산": ["연구기금", "건축기금", "장학기금", "기타기금", "보증금", "기타비유동자산"]
      }
    },
    "Ⅱ_부채": {
      "1.유동부채": [
        "매입채무", "미지급금", "선수금", "예수금", "제세예수금(4대보험/원천세)",
        "부가세예수금", "미지급비용", "선수수익", "기타유동부채"
      ],
      "2.비유동부채": ["임대보증금", "퇴직급여충당부채", "(퇴직연금운용자산)", "고유목적사업준비금", "기타비유동부채"]
    },
    "Ⅲ_기본금": {
      "1.출연기본금": ["출연기본금"],
      "2.적립금": ["연구적립금", "건축적립금", "장학적립금", "기타적립금", "고유목적사업준비금(신고조정)"],
      "3.운영차익": ["전기이월운영차익", "당기운영차익"]
    }
  };

  function render(container, selectedYear) {
    const year = selectedYear || BudgetModule?._selectedYear || new Date().getFullYear();
    const targetDate = `${year + 1}-02-28`;

    const ledger = db.getLedger().filter(e => e.transactionDate && e.transactionDate <= targetDate);
    const budgetItems = db.getBudgetItems();

    // 데이터 집계
    const summary = aggregateBSData(ledger, budgetItems, year);

    container.innerHTML = `
      <div class="print-container">
        <div class="report-form-header">
          <div class="report-logo-section">
            <img src="img/logo_Black.png" alt="예원예술대학교 로고" class="report-university-logo">
          </div>
          <div class="report-title-section">
            <h1 class="report-main-title">재 무 상 태 표</h1>
            <p class="report-period">${year + 1}년 02월 28일 현재</p>
          </div>
          <div class="report-empty-space"></div>
        </div>

        <div class="report-info-bar">
          <span>예원예술대학교 산학협력단</span>
          <span class="report-unit">(단위: 원)</span>
        </div>

        <div class="table-wrapper">
          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 70%">과 목 (Account)</th>
                <th>금 액 (Amount)</th>
              </tr>
            </thead>
            <tbody>
              ${renderReportContent(summary)}
            </tbody>
          </table>
        </div>

        <div class="report-summary-line" style="text-align: left; margin-top: 20px; font-weight: 600; color: #1e3a8a; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-family: 'Noto Sans KR', sans-serif;">
          ※ 자산 (${helpers.formatCurrencyRaw(summary.totals.assets)}) = 
          부채 (${helpers.formatCurrencyRaw(summary.totals.liabilities)}) + 
          기본금 (${helpers.formatCurrencyRaw(summary.totals.capital)})
        </div>

        <div class="report-footer-school">
          예원예술대학교 산학협력단
        </div>
      </div>
    `;
  }

  function aggregateBSData(ledger, budgetItems, year) {
    const summary = {
      data: {},
      totals: { assets: 0, liabilities: 0, capital: 0 }
    };

    // 초기화
    for (const main in BS_STRUCTURE) {
      summary.data[main] = { total: 0, subs: {} };
      for (const sub in BS_STRUCTURE[main]) {
        if (Array.isArray(BS_STRUCTURE[main][sub])) {
          summary.data[main].subs[sub] = { total: 0, items: {} };
          BS_STRUCTURE[main][sub].forEach(item => summary.data[main].subs[sub].items[item] = 0);
        } else {
          summary.data[main].subs[sub] = { total: 0, details: {} };
          for (const detail in BS_STRUCTURE[main][sub]) {
            summary.data[main].subs[sub].details[detail] = { total: 0, items: {} };
            BS_STRUCTURE[main][sub][detail].forEach(item => summary.data[main].subs[sub].details[detail].items[item] = 0);
          }
        }
      }
    }

    // 0. 자산 관리 데이터 집계 (비품 및 감가상각누계액)
    const assets = db.getAssets();
    let totalEquipment = 0;
    let totalAccumDep = 0;
    let currentTermDep = 0; // 당기 상각비 (운영차익용)

    const fiscalYearStart = `${year}-03-01`;
    const fiscalYearEnd = `${year + 1}-02-28`;
    const todayStr = new Date().toISOString().split('T')[0];
    const targetEndDate = fiscalYearEnd > todayStr ? todayStr : fiscalYearEnd;

    assets.forEach(as => {
      const { accumulated, periodDep } = helpers.calculateDepreciation(as, targetEndDate, fiscalYearStart);
      totalEquipment += helpers.parseAmount(as.acquisitionCost || 0);
      totalAccumDep += accumulated;
      currentTermDep += periodDep;
    });

    // 1. 기초 현금 및 장부 데이터 집계
    // 현금및현금성자산 계산
    const beginningCash = budgetItems.find(b => b.itemCode === 'B-1-1-01')?.amount || 0;
    let cashBalance = beginningCash;

    ledger.forEach(e => {
      const amount = e.amount || 0;

      // [v14] 미수금 발생(accrued) 및 [v15] 미지급금 발생(unpaid_occ) 건은 실제 현금이 들어온 것이 아니므로 현금 잔액에서 제외
      if (e.accountingType !== 'accrued' && e.accountingType !== 'unpaid_occ') {
        if (e.type === 'income') cashBalance += amount;
        else if (e.type === 'expense') cashBalance -= amount;
      }

      // 자산/부채/기본금 항목 맵핑 (AccountingLogic 연동)
      const bItem = db.getBudgetItems().find(bi => bi.itemCode === e.itemCode);
      if (!bItem) return;

      const impact = window.AccountingLogic?.analyzeImpact(bItem.name);
      if (impact && impact.bs) {
        mapToStructure(summary, impact.bs, amount);
      }

      // [v14] 미수금 계정 직접 연동
      if (e.accountingType === 'accrued') {
        summary.data["Ⅰ_자산"].subs["1.유동자산"].details["1)당좌자산"].items["미수금"] += amount;
      } else if (e.accountingType === 'collection') {
        summary.data["Ⅰ_자산"].subs["1.유동자산"].details["1)당좌자산"].items["미수금"] -= amount;
      }

      // [v15] 미지급금 부채 직접 연동
      if (e.accountingType === 'unpaid_occ') {
        summary.data["Ⅱ_부채"].subs["1.유동부채"].items["미지급금"] += amount;
      } else if (e.accountingType === 'unpaid_pay') {
        summary.data["Ⅱ_부채"].subs["1.유동부채"].items["미지급금"] -= amount;
      }
    });

    // 자산/현금 반영
    summary.data["Ⅰ_자산"].subs["2.비유동자산"].details["2)유형자산"].items["집기비품"] = totalEquipment;
    summary.data["Ⅰ_자산"].subs["2.비유동자산"].details["2)유형자산"].items["(감가상각누계액)"] = -totalAccumDep;
    summary.data["Ⅰ_자산"].subs["1.유동자산"].details["1)당좌자산"].items["현금및현금성자산"] = cashBalance;
    updateBranchTotals(summary);

    // 2. 당기운영차익 및 전기이월운영차익 계산
    // [v16] 당기운영차익은 '현재 보고서 연도(3월~익년2월)' 내의 모든 수익-비용
    const netIncome = calculateNetIncome(ledger, currentTermDep, year);

    // [v16] 전기이월운영차익 평형 로직: "자산 - 부채 - 출연금/적립금 - 당기순이익"
    // 이를 통해 시스템에 입력된 모든 현금/자산 잔액에 대한 자본적 근거를 자동으로 맞춤
    const currentAssets = summary.totals.assets;
    const currentLiabilities = summary.totals.liabilities;
    const basicCapital = (summary.data["Ⅲ_기본금"].subs["1.출연기본금"].total || 0) +
      (summary.data["Ⅲ_기본금"].subs["2.적립금"].total || 0);

    const totalPriorIncome = currentAssets - currentLiabilities - basicCapital - netIncome;

    summary.data["Ⅲ_기본금"].subs["3.운영차익"].items["전기이월운영차익"] = totalPriorIncome;
    summary.data["Ⅲ_기본금"].subs["3.운영차익"].items["당기운영차익"] = netIncome;
    updateBranchTotals(summary);

    return summary;
  }

  function mapToStructure(summary, path, amount) {
    for (const main in BS_STRUCTURE) {
      for (const sub in BS_STRUCTURE[main]) {
        if (Array.isArray(BS_STRUCTURE[main][sub])) {
          BS_STRUCTURE[main][sub].forEach(item => {
            if (path.includes(item)) {
              const val = (item.startsWith('(') && item.endsWith(')')) ? -amount : amount;
              summary.data[main].subs[sub].items[item] += val;
            }
          });
        } else {
          for (const detail in BS_STRUCTURE[main][sub]) {
            BS_STRUCTURE[main][sub][detail].forEach(item => {
              if (path.includes(item)) {
                const val = (item.startsWith('(') && item.endsWith(')')) ? -amount : amount;
                summary.data[main].subs[sub].details[detail].items[item] += val;
              }
            });
          }
        }
      }
    }
  }

  function updateBranchTotals(summary) {
    let totalAssets = 0, totalLiabilities = 0, totalCapital = 0;

    for (const main in summary.data) {
      let mainTotal = 0;
      for (const sub in summary.data[main].subs) {
        let subTotal = 0;
        const subData = summary.data[main].subs[sub];
        if (subData.items) {
          subTotal = Object.values(subData.items).reduce((a, b) => a + b, 0);
        } else {
          for (const detail in subData.details) {
            const detTotal = Object.values(subData.details[detail].items).reduce((a, b) => a + b, 0);
            subData.details[detail].total = detTotal;
            subTotal += detTotal;
          }
        }
        subData.total = subTotal;
        mainTotal += subTotal;
      }
      summary.data[main].total = mainTotal;
      if (main === "Ⅰ_자산") totalAssets = mainTotal;
      else if (main === "Ⅱ_부채") totalLiabilities = mainTotal;
      else if (main === "Ⅲ_기본금") totalCapital = mainTotal;
    }
    summary.totals = { assets: totalAssets, liabilities: totalLiabilities, capital: totalCapital };
  }

  function calculateNetIncome(ledger, depreciationExpense = 0, reportYear) {
    const startDate = `${reportYear}-03-01`;
    let rev = 0, exp = 0;

    ledger.forEach(e => {
      // 해당 회계연도 이전 데이터는 당기이익에서 제외
      if (e.transactionDate < startDate) return;

      // [v14] 미수금 회수 및 [v15] 미지급금 지급 건은 수익/비용이 아니므로 제외
      if (e.accountingType === 'collection' || e.accountingType === 'unpaid_pay') return;

      // [v16] 모든 장부 기록을 수익/비용으로 합산 (비목 매핑 여부와 무관하게 평형 유지)
      if (e.type === 'income') rev += (e.amount || 0);
      else exp += (e.amount || 0);
    });
    return rev - exp - depreciationExpense;
  }

  function renderReportContent(summary) {
    let html = '';
    const formatRow = (name, amount, isBold = false, level = 1, isFinal = false, isSeparator = false) => {
      const indent = level > 1 ? `padding-left: ${(level - 1) * 20}px;` : '';
      const nameContent = isBold ? `<strong>${name}</strong>` : name;
      const classAttr = isSeparator ? 'row-separator' : (isFinal ? 'row-final' : isBold ? 'row-group' : 'row-item');
      const displayAmount = amount < 0 ? `(${helpers.formatCurrencyRaw(Math.abs(amount))})` : helpers.formatCurrencyRaw(amount);

      return `
        <tr class="${classAttr}">
          <td style="${indent}"><div class="dotted-cell"><span class="item-name">${nameContent}</span></div></td>
          <td class="amount-cell">${displayAmount}</td>
        </tr>
      `;
    };

    // Ⅰ. 자산
    html += formatRow("Ⅰ. 자 산", summary.totals.assets, true, 1, false, true);
    for (const sub in summary.data["Ⅰ_자산"].subs) {
      const subData = summary.data["Ⅰ_자산"].subs[sub];
      html += formatRow(sub, subData.total, true, 2);
      if (subData.details) {
        for (const det in subData.details) {
          html += formatRow(det, subData.details[det].total, true, 3);
          for (const item in subData.details[det].items) {
            html += formatRow(item, subData.details[det].items[item], false, 4);
          }
        }
      }
    }
    html += formatRow("자 산 총 계", summary.totals.assets, true, 1, true);

    // Ⅱ. 부채
    html += `<tr><td colspan="2" style="height:20px;"></td></tr>`;
    html += formatRow("Ⅱ. 부 채", summary.totals.liabilities, true, 1, false, true);
    for (const sub in summary.data["Ⅱ_부채"].subs) {
      const subData = summary.data["Ⅱ_부채"].subs[sub];
      html += formatRow(sub, subData.total, true, 2);
      for (const item in subData.items) {
        html += formatRow(item, subData.items[item], false, 3);
      }
    }
    html += formatRow("부 채 총 계", summary.totals.liabilities, true, 1, true);

    // Ⅲ. 기본금
    html += `<tr><td colspan="2" style="height:20px;"></td></tr>`;
    html += formatRow("Ⅲ. 기 본 금", summary.totals.capital, true, 1, false, true);
    for (const sub in summary.data["Ⅲ_기본금"].subs) {
      const subData = summary.data["Ⅲ_기본금"].subs[sub];
      html += formatRow(sub, subData.total, true, 2);
      for (const item in subData.items) {
        html += formatRow(item, subData.items[item], false, 3);
      }
    }
    html += formatRow("기 본 금 총 계", summary.totals.capital, true, 1, true);

    // 최종 합계 (부채 + 기본금)
    html += `<tr><td colspan="2" style="height:20px;"></td></tr>`;
    html += formatRow("부채 및 기본금 총계", summary.totals.liabilities + summary.totals.capital, true, 1, true);

    return html;
  }

  function exportToExcel(year) {
    const reportYear = year || selectedYear;
    const targetDate = `${reportYear + 1}-02-28`;
    const ledger = db.getLedger().filter(e => e.transactionDate && e.transactionDate <= targetDate);
    const budgetItems = db.getBudgetItems();
    const summary = aggregateBSData(ledger, budgetItems, reportYear);

    const wb = XLSX.utils.book_new();
    const data = [];

    // Title & Info
    data.push(["재 무 상 태 표"]);
    data.push([`${reportYear + 1}년 02월 28일 현재`]);
    data.push(["예원예술대학교 산학협력단", "", " (단위: 원)"]);
    data.push([]); // Empty row

    // Header
    data.push(["과 목 (Account)", "금 액 (Amount)"]);

    // Content
    const addRows = (name, amount, level = 0) => {
      const indent = "  ".repeat(level);
      data.push([indent + name, amount]);
    };

    // Ⅰ. 자산
    addRows("Ⅰ. 자 산", summary.totals.assets, 0);
    for (const sub in summary.data["Ⅰ_자산"].subs) {
      const subData = summary.data["Ⅰ_자산"].subs[sub];
      addRows(sub, subData.total, 1);
      if (subData.details) {
        for (const det in subData.details) {
          addRows(det, subData.details[det].total, 2);
          for (const item in subData.details[det].items) {
            addRows(item, subData.details[det].items[item], 3);
          }
        }
      }
    }
    addRows("자 산 총 계", summary.totals.assets, 0);
    data.push([]);

    // Ⅱ. 부채
    addRows("Ⅱ. 부 채", summary.totals.liabilities, 0);
    for (const sub in summary.data["Ⅱ_부채"].subs) {
      const subData = summary.data["Ⅱ_부채"].subs[sub];
      addRows(sub, subData.total, 1);
      for (const item in subData.items) {
        addRows(item, subData.items[item], 2);
      }
    }
    addRows("부 채 총 계", summary.totals.liabilities, 0);
    data.push([]);

    // Ⅲ. 기본금
    addRows("Ⅲ. 기 본 금", summary.totals.capital, 0);
    for (const sub in summary.data["Ⅲ_기본금"].subs) {
      const subData = summary.data["Ⅲ_기본금"].subs[sub];
      addRows(sub, subData.total, 1);
      for (const item in subData.items) {
        addRows(item, subData.items[item], 2);
      }
    }
    addRows("기 본 금 총 계", summary.totals.capital, 0);
    data.push([]);
    addRows("부채 및 기본금 총계", summary.totals.liabilities + summary.totals.capital, 0);

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Styling
    const range = XLSX.utils.decode_range(ws['!ref']);

    // Header Style (Row 5 in data, which is index 4)
    const headerRowIdx = 4;

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

    // Body Styles (Borders & Number Formats)
    for (let R = headerRowIdx + 1; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[address]) continue;

        const isAmount = (C === 1);
        ws[address].s = {
          border: {
            top: { style: "thin" }, bottom: { style: "thin" },
            left: { style: "thin" }, right: { style: "thin" }
          },
          alignment: {
            horizontal: isAmount ? "right" : "left",
            vertical: "center"
          }
        };

        if (isAmount && typeof ws[address].v === 'number') {
          ws[address].z = "#,##0";
        }
      }
    }

    // Title Styling
    ws["A1"].s = { font: { size: 20, bold: true }, alignment: { horizontal: "center" } };
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, // Title
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }  // Period
    ];

    // Auto Width
    ws["!cols"] = [
      { wch: 40 }, // Account
      { wch: 20 }  // Amount
    ];

    XLSX.utils.book_append_sheet(wb, ws, "재무상태표");
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    XLSX.writeFile(wb, `예원예술대학교_재무상태표_${dateStr}.xlsx`);
  }

  return { render, exportToExcel };
})();

window.BalanceSheetModule = BalanceSheetModule;
