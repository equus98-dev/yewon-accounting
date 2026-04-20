const OperatingStatementModule = (() => {
  const { db, helpers } = window;

  const CHART_OF_ACCOUNTS = {
    "운영수익": {
      "Ⅰ.산학협력수익": {
        "1.연구수익": ["1)정부연구수익", "2)산업체연구수익"],
        "2.교육운영수익": ["1)교육운영수익"],
        "3.기술이전수익": ["1)지식재산권이전수익", "2)노하우이전수익"],
        "4.설비자산사용료수익": ["1)설비자산사용료수익", "2)임대료수익"],
        "5.기타산학협력수익": ["1)기타산학협력수익", "2)학교기업 수익"]
      },
      "Ⅱ.지원금수익": {
        "1.연구수익": ["1)정부연구수익", "2)산업체연구수익"],
        "2.교육운영수익": ["1)교육운영수익"],
        "3.기타지원금수익": ["1)기타지원금수익"]
      },
      "Ⅲ.간접비수익": {
        "1.산학협력수익": ["1)산학협력연구수익", "2)산학협력교육운영수익", "3)기타산학협력수익"],
        "2.지원금수익": ["1)지원금연구수익", "2)지원금교육운영수익", "3)기타지원금수익"]
      },
      "Ⅳ.전입및기부금수익": {
        "1.전입금수익": ["1)학교법인전입금", "2)학교회계전입금", "3)학교기업전입금", "4)기타전입금"],
        "2.기부금수익": ["1)일반기부금", "2)지정기부금", "3)현물기부금"]
      },
      "Ⅴ.운영외수익": {
        "1.운영외수익": [
          "1)이자수익", "2)배당금수익", "3)유가증권평가이익", "4)유가증권처분이익", "5)외환차익",
          "6)외화환산이익", "7)유형자산처분이익", "8)대손충당금환입", "9)전기오류수정이익",
          "10)고유목적사업준비금환입액", "11)기타운영외수익"
        ]
      }
    },
    "운영비용": {
      "Ⅰ.산학협력비": {
        "1.산학협력단 연구비": [
          "1)인건비", "2)학생인건비", "3)연구시설ㆍ장비비", "4)연구활동비",
          "5)연구재료비", "6)연구수당", "7)위탁연구개발비"
        ],
        "2.교육운영비": [
          "1)인건비", "2)교육과정개발비", "3)장학금", "4)실험실습비", "5)기타교육운영비"
        ],
        "3.지식재산권비용": [
          "1)지식재산권실시ㆍ양도비", "2)산학협력보상금"
        ],
        "4.학교시설사용료": ["1)학교시설사용료"],
        "5.기타산학협력비": ["1)인건비", "2)기타산학협력비", "3)학교기업 비용"]
      },
      "Ⅱ.지원금사업비": {
        "1.연구비": [
          "1)인건비", "2)학생인건비", "3)연구시설ㆍ장비비", "4)연구활동비",
          "5)연구재료비", "6)연구수당", "7)위탁연구개발비"
        ],
        "2.교육운영비": [
          "1)인건비", "2)교육과정개발비", "3)장학금", "4)실험실습비", "5)기타교육운영비"
        ],
        "3.기타지원금사업비": ["1)인건비", "2)기타지원금사업비"]
      },
      "Ⅲ.간접비사업비": {
        "1.인력지원비": ["1)인건비", "2)연구개발능률성과급", "3)연구개발준비금"],
        "2.연구지원비": [
          "1)기관 공통비용", "2)사업단 또는 연구단 운영비", "3)기반시설ㆍ장비 구축ㆍ운영비",
          "4)연구실안전관리비", "5)학생산재보험료", "6)연구보안관리비", "7)연구윤리활동비", "8)연구활동지원금"
        ],
        "3.성과활용지원비": ["1)과학문화활동비", "2)지식재산권 출원ㆍ등록비"],
        "4.기타지원비": ["1)기타지원비"]
      },
      "Ⅳ.일반관리비": {
        "1.일반관리비": ["1)인건비", "2)감가상각비", "3)보험료", "4)무형자산상각비", "5)대손상각비", "6)일반제경비"]
      },
      "Ⅴ.운영외비용": {
        "1.운영외비용": [
          "1)유가증권처분손실", "2)유가증권평가손실", "3)외환차손", "4)외화환산손실",
          "5)유형자산처분손실", "6)전기오류수정손실", "7)고유목적사업준비금전입액", "8)기타운영외비용"
        ]
      },
      "Ⅵ.학교회계전출금": {
        "1.학교회계전출금": ["1)학교회계전출금"]
      }
    }
  };

  function render(container, year) {
    const currentYear = year || new Date().getFullYear();
    const prevYear = currentYear - 1;

    const allLedger = db.getLedger();
    const budgetStructure = window.BudgetModule?.BUDGET_STRUCTURE || {};

    const currentSummary = aggregateData(allLedger, budgetStructure, currentYear);
    const prevSummary = aggregateData(allLedger, budgetStructure, prevYear);

    container.innerHTML = `
      <div class="print-container comparative">
        <div class="report-form-header">
          <div class="report-logo-section">
            <img src="img/logo_Black.png" alt="예원예술대학교 로고" class="report-university-logo">
          </div>
          <div class="report-title-section">
            <h1 class="report-main-title">운 영 계 산 서</h1>
            <p class="report-period">
              [당기] 제 ${currentYear - 1999} 기 : ${currentYear}. 03. 01 ~ ${currentYear + 1}. 02. 28 <br>
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
                <th style="width: 40%">과 목 (Account)</th>
                <th class="text-right">제 ${currentYear - 1999} (당) 기</th>
                <th class="text-right">제 ${prevYear - 1999} (전) 기</th>
                <th class="text-right">증 감 (Variance)</th>
              </tr>
            </thead>
            <tbody>
              ${renderComparativeTableRows(currentSummary, prevSummary, currentYear, prevYear)}
            </tbody>
          </table>
        </div>
        
        <div class="report-footer-school">
          예원예술대학교 산학협력단
        </div>
      </div>
    `;
  }

  function aggregateData(ledger, struct, year) {
    const startDate = `${year}-03-01`;
    const fiscalYearEnd = `${year + 1}-02-28`;

    // [v14] 결산 전표(미수금 등)가 미래 날짜로 입력된 경우에도 보고서에 포함되어야 하므로 오늘 날짜로 제한하지 않음
    const endDate = fiscalYearEnd;

    const filteredLedger = ledger.filter(e => {
      const d = e.transactionDate;
      return d >= startDate && d <= endDate;
    });

    const data = {
      "운영수익": {},
      "운영비용": {}
    };

    for (const group in CHART_OF_ACCOUNTS) {
      for (const section in CHART_OF_ACCOUNTS[group]) {
        data[group][section] = { total: 0, categories: {} };
        for (const category in CHART_OF_ACCOUNTS[group][section]) {
          data[group][section].categories[category] = { total: 0, items: {} };
          CHART_OF_ACCOUNTS[group][section][category].forEach(item => {
            data[group][section].categories[category].items[item] = 0;
          });
        }
      }
    }

    filteredLedger.forEach(entry => {
      if (!entry.itemCode) return;
      // [v14] 미수금 회수(collection) 건은 전기 수익으로 이미 확정되었으므로 운영수익에서 제외
      // [v15] 미지급금 지급(unpaid_pay) 건은 전기 비용으로 이미 확정되었으므로 운영비용에서 제외
      if (entry.accountingType === 'collection' || entry.accountingType === 'unpaid_pay') return;
      const info = findItemInfo(entry.itemCode, struct);
      if (!info || !info.operatingAccount) return;

      const path = info.operatingAccount.split(' > ');
      if (path.length !== 4) return;

      const [group, sect, cat, item] = path;
      const amount = entry.amount || 0;

      if (data[group] && data[group][sect] && data[group][sect].categories[cat]) {
        data[group][sect].categories[cat].items[item] += amount;
        data[group][sect].categories[cat].total += amount;
        data[group][sect].total += amount;
      }
    });

    // 2. 자산 관리 데이터를 기반으로 한 감가상각비 추가 반영
    const assets = db.getAssets();
    let depExp = 0;
    assets.forEach(as => {
      const { periodDep } = helpers.calculateDepreciation(as, endDate, startDate);
      depExp += periodDep;
    });

    if (depExp > 0) {
      const sect = "Ⅳ.일반관리비";
      const cat = "1.일반관리비";
      const item = "2)감가상각비";
      if (data["운영비용"][sect] && data["운영비용"][sect].categories[cat]) {
        data["운영비용"][sect].categories[cat].items[item] += depExp;
        data["운영비용"][sect].categories[cat].total += depExp;
        data["운영비용"][sect].total += depExp;
      }
    }

    return data;
  }

  function findItemInfo(code, struct) {
    for (const type in struct) {
      for (const s of struct[type].sections) {
        for (const c of s.categories) {
          const item = c.items.find(i => i.code === code);
          if (item) return item;
        }
      }
    }
    return null;
  }

  function renderComparativeTableRows(current, prev, currentYear, prevYear) {
    let rows = '';

    const formatRow = (name, currVal, prevVal, level = 0, isBold = false, isSeparator = false) => {
      let classAttr = 'row-item';
      if (isSeparator) classAttr = 'row-separator';
      else if (level === 0) classAttr = 'row-final';
      else if (level === 1) classAttr = 'row-group';

      const indent = level > 1 ? `padding-left: ${(level - 1) * 20}px;` : '';
      const nameContent = isBold ? `<strong>${name}</strong>` : name;
      const dots = (level > 1 && !isSeparator) ? '<div class="item-dots"></div>' : '';

      const currDisplay = isSeparator ? '' : helpers.formatCurrencyRaw(currVal);
      const prevDisplay = isSeparator ? '' : helpers.formatCurrencyRaw(prevVal);

      return `
        <tr class="${classAttr}">
          <td>
            <div class="dotted-cell" style="${indent}">
              <span class="item-name">${nameContent}</span>
              ${dots}
            </div>
          </td>
          <td class="amount-cell">${currDisplay}</td>
          <td class="amount-cell color-prev">${prevDisplay}</td>
          <td class="amount-cell" style="font-weight:600; color:var(--accent);">${isSeparator ? '' : helpers.formatCurrencyRaw(currVal - prevVal)}</td>
        </tr>
      `;
    };

    // 1. 모든 합계 미리 계산
    let currRevSum = 0, prevRevSum = 0;
    for (const sect in CHART_OF_ACCOUNTS["운영수익"]) {
      currRevSum += current["운영수익"][sect].total;
      prevRevSum += prev["운영수익"][sect].total;
    }

    let currExpSub = 0, prevExpSub = 0;
    for (const sect in CHART_OF_ACCOUNTS["운영비용"]) {
      currExpSub += current["운영비용"][sect].total;
      prevExpSub += prev["운영비용"][sect].total;
    }

    const currDiff = currRevSum - currExpSub, prevDiff = prevRevSum - prevExpSub;
    const currTotalExp = currExpSub + (currDiff > 0 ? currDiff : 0);
    const prevTotalExp = prevExpSub + (prevDiff > 0 ? prevDiff : 0);

    rows += formatRow('운 영 수 익', 0, 0, 0, true, true);
    rows += formatRow('운 영 수 익 총 계', currRevSum, prevRevSum, 0, true);

    for (const sect in CHART_OF_ACCOUNTS["운영수익"]) {
      const cS = current["운영수익"][sect], pS = prev["운영수익"][sect];
      rows += formatRow(sect, cS.total, pS.total, 1, true);
      for (const cat in CHART_OF_ACCOUNTS["운영수익"][sect]) {
        const cC = cS.categories[cat], pC = pS.categories[cat];
        rows += formatRow(cat, cC.total, pC.total, 2);
        CHART_OF_ACCOUNTS["운영수익"][sect][cat].forEach(item => {
          rows += formatRow(item, cC.items[item], pC.items[item], 3);
        });
      }
    }

    // 4. 운영비용 섹션 렌더링
    rows += formatRow('운 영 비 용', 0, 0, 0, true, true);
    rows += formatRow('운 영 비 용 총 계', currTotalExp, prevTotalExp, 0, true);

    for (const sect in CHART_OF_ACCOUNTS["운영비용"]) {
      const cS = current["운영비용"][sect], pS = prev["운영비용"][sect];
      rows += formatRow(sect, cS.total, pS.total, 1, true);
      for (const cat in CHART_OF_ACCOUNTS["운영비용"][sect]) {
        const cC = cS.categories[cat], pC = pS.categories[cat];
        rows += formatRow(cat, cC.total, pC.total, 2);
        CHART_OF_ACCOUNTS["운영비용"][sect][cat].forEach(item => {
          rows += formatRow(item, cC.items[item], pC.items[item], 3);
        });
      }
    }

    // 5. 하단 합계 및 차익/차손
    rows += formatRow('운 영 비 용 합 계', currExpSub, prevExpSub, 1, true);
    rows += formatRow('당 기 운 영 차 익', currDiff > 0 ? currDiff : 0, prevDiff > 0 ? prevDiff : 0, 2, true);
    rows += formatRow('당 기 운 영 차 손', currDiff < 0 ? Math.abs(currDiff) : 0, prevDiff < 0 ? Math.abs(prevDiff) : 0, 2, true);

    return rows;
  }

  function exportToExcel(year) {
    const currentYear = year || new Date().getFullYear();
    const prevYear = currentYear - 1;
    const allLedger = db.getLedger();
    const budgetStructure = window.BudgetModule?.BUDGET_STRUCTURE || {};

    const currentSummary = aggregateData(allLedger, budgetStructure, currentYear);
    const prevSummary = aggregateData(allLedger, budgetStructure, prevYear);

    const wb = XLSX.utils.book_new();
    const data = [];

    // Title & Info
    data.push(["운 영 계 산 서"]);
    data.push([`[당기] 제 ${currentYear - 1999} 기 : ${currentYear}. 03. 01 ~ ${currentYear + 1}. 02. 28`]);
    data.push([`[전기] 제 ${prevYear - 1999} 기 : ${prevYear}. 03. 01 ~ ${prevYear + 1}. 02. 28`]);
    data.push(["예원예술대학교 산학협력단", "", "", " (단위: 원)"]);
    data.push([]); // Empty row

    // Header
    data.push(["예원예술대학교 운영계산서"]);
    data.push([`제 ${currentYear - 1999} (당) 기 : ${currentYear}. 03. 01 ~ ${currentYear + 1}. 02. 28`]);
    data.push([`제 ${prevYear - 1999} (전) 기 : ${prevYear}. 03. 01 ~ ${prevYear + 1}. 02. 28`]);
    data.push(["예원예술대학교 산학협력단", "", "", "", " (단위: 원)"]);
    data.push([]);
    data.push(["과 목 (Account)", `제 ${currentYear - 1999} (당) 기`, `제 ${prevYear - 1999} (전) 기`, "증 감 (Variance)"]);

    const addRows = (name, currVal, prevVal, level = 0, isSeparator = false) => {
      const indent = "  ".repeat(level);
      const cVal = isSeparator ? "" : currVal;
      const pVal = isSeparator ? "" : prevVal;
      const vVal = isSeparator ? "" : (currVal - prevVal);
      data.push([indent + name, cVal, pVal, vVal]);
      if (isSeparator) {
        separatorRowIndices.push(data.length - 1);
      }
    };

    // 1. 모든 합계 미리 계산
    let currRevSum = 0, prevRevSum = 0;
    for (const sect in CHART_OF_ACCOUNTS["운영수익"]) {
      currRevSum += currentSummary["운영수익"][sect].total;
      prevRevSum += prevSummary["운영수익"][sect].total;
    }

    let currExpSub = 0, prevExpSub = 0;
    for (const sect in CHART_OF_ACCOUNTS["운영비용"]) {
      currExpSub += currentSummary["운영비용"][sect].total;
      prevExpSub += prevSummary["운영비용"][sect].total;
    }

    const currDiff = currRevSum - currExpSub, prevDiff = prevRevSum - prevExpSub;
    const currTotalExp = currExpSub + (currDiff > 0 ? currDiff : 0);
    const prevTotalExp = prevExpSub + (prevDiff > 0 ? prevDiff : 0);

    const separatorRowIndices = [];

    // 2. 운영수익 섹션
    addRows('운 영 수 익', 0, 0, 0, true);
    addRows('운 영 수 익 총 계', currRevSum, prevRevSum, 0);

    for (const sect in CHART_OF_ACCOUNTS["운영수익"]) {
      const cS = currentSummary["운영수익"][sect], pS = prevSummary["운영수익"][sect];
      addRows(sect, cS.total, pS.total, 1);
      for (const cat in CHART_OF_ACCOUNTS["운영수익"][sect]) {
        const cC = cS.categories[cat], pC = pS.categories[cat];
        addRows(cat, cC.total, pC.total, 2);
        CHART_OF_ACCOUNTS["운영수익"][sect][cat].forEach(item => {
          addRows(item, cC.items[item], pC.items[item], 3);
        });
      }
    }

    // 4. 운영비용 섹션
    addRows('운 영 비 용', 0, 0, 0, true);
    addRows('운 영 비 용 총 계', currTotalExp, prevTotalExp, 0);
    data.push([]); // 섹션 구분용 공백

    for (const sect in CHART_OF_ACCOUNTS["운영비용"]) {
      const cS = currentSummary["운영비용"][sect], pS = prevSummary["운영비용"][sect];
      addRows(sect, cS.total, pS.total, 1);
      for (const cat in CHART_OF_ACCOUNTS["운영비용"][sect]) {
        const cC = cS.categories[cat], pC = pS.categories[cat];
        addRows(cat, cC.total, pC.total, 2);
        CHART_OF_ACCOUNTS["운영비용"][sect][cat].forEach(item => {
          addRows(item, cC.items[item], pC.items[item], 3);
        });
      }
    }

    // 5. 하단 합계 및 차익/차손
    addRows('운 영 비 용 합 계', currExpSub, prevExpSub, 1);
    addRows('당 기 운 영 차 익', currDiff > 0 ? currDiff : 0, prevDiff > 0 ? prevDiff : 0, 2);
    addRows('당 기 운 영 차 손', currDiff < 0 ? Math.abs(currDiff) : 0, prevDiff < 0 ? Math.abs(prevDiff) : 0, 2);

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Styling
    const range = XLSX.utils.decode_range(ws['!ref']);
    const headerRowIdx = 5; // Row 6 in data

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
          alignment: {
            horizontal: isAmount ? "right" : "left",
            vertical: "center"
          }
        };

        if (isAmount && typeof ws[address].v === 'number') {
          ws[address].z = "#,##0";
        }

        // Apply ivory background for separator rows
        if (separatorRowIndices.includes(R)) {
          ws[address].s.fill = { fgColor: { rgb: "FFFFF0" } };
          ws[address].s.font = { bold: true };
        }
      }
    }

    ws["A1"].s = { font: { size: 20, bold: true }, alignment: { horizontal: "center" } };
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // Title
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }, // Period Current
      { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } }  // Period Prev
    ];

    ws["!cols"] = [
      { wch: 45 }, // Account
      { wch: 22 }, // Current
      { wch: 22 }, // Prev
      { wch: 22 }  // Variance
    ];

    XLSX.utils.book_append_sheet(wb, ws, "운영계산서");
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    XLSX.writeFile(wb, `예원예술대학교_운영계산서_${dateStr}.xlsx`);
  }

  return { render, exportToExcel };
})();

window.OperatingStatementModule = OperatingStatementModule;
