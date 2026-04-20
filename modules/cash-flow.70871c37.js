const CashFlowModule = (() => {
  const { db, helpers, BudgetModule } = window;

  // 사용자가 요청한 상세 4단계 구조 정의
  const CF_STRUCTURE = {
    "Ⅰ_현금유입액": {
      "1.운영활동으로인한현금유입액": {
        "1)산학협력수익현금유입액": {
          "(1)연구수익": ["가.정부연구수익", "나.산업체연구수익"],
          "(2)교육운영수익": ["가.교육운영수익"],
          "(3)지식재산권수익": ["가.지식재산권실시수익", "나.노하우이전수익"],
          "(4)설비자산사용료수익": ["가.설비자산사용료수익", "나.임대료수익"],
          "(5)기타산학협력수익": ["가.기타산학협력수익"]
        },
        "2)지원금수익현금유입액": {
          "(1)연구수익": ["가.정부연구수익", "나.산업체연구수익"],
          "(2)교육운영수익": ["가.교육운영수익"],
          "(3)기타지원금수익": ["가.기타지원금수익"]
        },
        "3)간접비수익현금유입액": {
          "(1)산학협력수익": ["가.산학협력연구수익", "나.산학협력교육운영수익", "다.기타산학협력수익"],
          "(2)지원금수익": ["가.지원금연구수익", "나.지원금교육운영수익", "다.기타지원금수익"]
        },
        "4)전입및기부금수익현금유입액": {
          "(1)전입금수익": ["가.학교법인전입금", "나.학교회계전입금", "다.학교기업전입금", "라.기타전입금"],
          "(2)기부금수익": ["가.일반기부금", "나.지정기부금"]
        },
        "5)운영외수익현금유입액": {
          "(1)운영외수익": ["가.이자수익", "나.배당금수익", "다.전기오류수정이익", "라.기타운영외수익"]
        }
      },
      "2.투자활동으로인한현금유입액": {
        "1)투자자산수입": ["(1)장기금융상품인출", "(2)장기투자금융자산매각대", "(3)출자금회수", "(4)기타투자자산수입"],
        "2)유형자산매각대": ["(1)토지매각대", "(2)건물매각대", "(3)구축물매각대", "(4)기계기구매각대", "(5)집기비품매각대", "(6)차량운반구매각대", "(7)기타유형자산매각대"],
        "3)무형자산매각대": ["(1)지식재산권매각대", "(2)개발비매각대", "(3)기타무형자산매각대"],
        "4)기타비유동자산수입": ["(1)연구기금인출수입", "(2)건축기금인출수입", "(3)장학기금인출수입", "(4)기타기금인출수입", "(5)보증금수입", "(6)기타비유동자산수입"]
      },
      "3.재무활동으로인한현금유입액": {
        "1)부채의차입": ["(1)임대보증금증가", "(2)기타비유동부채증가"],
        "2)기본금조달": ["(1)출연기본금증가"]
      }
    },
    "Ⅱ_현금유출액": {
      "1.운영활동으로인한현금유출액": {
        "1)산학협력비현금유출액": {
          "(1)산학협력연구비": ["가.인건비", "나.학생인건비", "다.연구시설·장비비", "라.연구활동비", "마.연구재료비", "바.연구수당", "사.위탁연구개발비"],
          "(2)교육운영비": ["가.인건비", "나.교육과정개발비", "다.장학금", "라.실험실습비", "마.기타교육운영비", "바.버스임차료"],
          "(3)지식재산권비용": ["가.지식재산권실시·양도비", "나.산학협력보상금"],
          "(4)학교시설사용료": ["가.학교시설사용료"],
          "(5)기타산학협력비": ["가.기타산학협력비"]
        },
        "2)지원금사업비현금유출액": {
          "(1)연구비": ["가.인건비", "나.학생인건비", "다.연구시설·장비비", "라.연구활동비", "마.연구재료비", "바.연구수당", "사.위탁연구개발비"],
          "(2)교육운영비": ["가.인건비", "나.교육과정개발비", "다.장학금", "라.실험실습비", "마.기타교육운영비", "바.버스임차료"],
          "(3)기타지원금사업비": ["가.기타지원금사업비"]
        },
        "3)간접비사업비현금유출액": {
          "(1)인력지원비": ["가.인건비", "나.연구개발능률성과급", "다.연구개발준비금"],
          "(2)연구지원비": ["가.기관 공통비용", "나.사업단 운영비", "다.기반시설구축비", "라.연구실안전관리비", "마.학생보험료", "사.연구활동지원금"],
          "(3)성과활용지원비": ["가.과학문화활동비", "나.지식재산권출원·등록비"],
          "(4)기타지원비": ["가.기타지원비"]
        },
        "4)일반관리비현금유출액": ["(1)일반관리비: 가.인건비, 나.보험료, 다.일반제경비"],
        "5)운영외비용현금유출액": ["가.전기오류수정손실", "나.기타운영외비용"],
        "6)학교회계전출금현금유출액": ["가.학교회계전출금"]
      },
      "2.투자활동으로인한현금유출액": {
        "1)투자자산지출": ["(1)장기금융상품증가", "(2)장기투자금융자산취득", "(3)출자금투자"],
        "2)유형자산취득지출": ["(1)토지취득", "(2)건물취득", "(3)기계기구취득", "(4)집기비품취득", "(5)건설중인자산취득"],
        "3)무형자산취득지출": ["(1)지식재산권취득", "(2)개발비취득"],
        "4)기타비유동자산지출": ["(1)연구기금적립", "(2)보증금지급"]
      },
      "3.재무활동으로인한현금유출액": {
        "1)부채의상환": ["(1)임대보증금감소", "(2)기타비유동부채감소"],
        "2)기본금반환": ["(1)출연기본금감소"]
      }
    }
  };

  function render(container, year) {
    const currentYear = year || BudgetModule?._selectedYear || new Date().getFullYear();
    const prevYear = currentYear - 1;

    const allLedger = db.getLedger();
    const currentData = aggregateCFData(allLedger, currentYear);
    const prevData = aggregateCFData(allLedger, prevYear);

    // 요약 로직 계산 (증감, 기초, 기말)
    currentData.summary = calculateSummary(currentData, allLedger, currentYear);
    prevData.summary = calculateSummary(prevData, allLedger, prevYear);

    container.innerHTML = `
      <div class="print-container comparative">
        <div class="report-form-header">
          <div class="report-logo-section">
            <img src="img/logo_Black.png" alt="예원예술대학교 로고" class="report-university-logo">
          </div>
          <div class="report-title-section">
            <h1 class="report-main-title">현 금 흐 름 표</h1>
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
              ${renderReportContent(currentData, prevData)}
            </tbody>
          </table>
        </div>
        
        <div class="report-footer-school">
          예원예술대학교 산학협력단
        </div>
      </div>
    `;
  }

  function calculateSummary(data, ledger, year) {
    const netChange = data["Ⅰ_현금유입액"].total - data["Ⅱ_현금유출액"].total;

    let beginning = 0;
    const startDate = `${year}-03-01`;

    // 기초 현금 항목(B-1-1-01)
    const bItem = db.getBudgetItems().find(b => b.itemCode === 'B-1-1-01');
    if (bItem) beginning += (bItem.amount || 0);

    // 해당 연도 시작 전까지의 모든 거래 합산
    const prevLedger = ledger.filter(e => e.transactionDate && e.transactionDate < startDate);
    beginning += prevLedger.reduce((sum, e) => {
      return sum + (e.type === 'income' ? (e.amount || 0) : -(e.amount || 0));
    }, 0);

    return {
      netChange: netChange,
      beginning: beginning,
      ending: netChange + beginning
    };
  }

  function aggregateCFData(ledger, year) {
    const startDate = `${year}-03-01`;
    const endDate = `${year + 1}-02-28`;
    const filtered = ledger.filter(e => e.transactionDate >= startDate && e.transactionDate <= endDate);

    // 구조 초기화
    const data = {};
    for (const main in CF_STRUCTURE) {
      data[main] = { total: 0, activities: {} };
      for (const act in CF_STRUCTURE[main]) {
        data[main].activities[act] = { total: 0, sections: {} };
        const actSpec = CF_STRUCTURE[main][act];
        for (const sec in actSpec) {
          if (Array.isArray(actSpec[sec])) {
            data[main].activities[act].sections[sec] = { total: 0, items: {} };
            actSpec[sec].forEach(item => data[main].activities[act].sections[sec].items[item] = 0);
          } else {
            data[main].activities[act].sections[sec] = { total: 0, subsections: {} };
            for (const sub in actSpec[sec]) {
              data[main].activities[act].sections[sec].subsections[sub] = { total: 0, items: {} };
              actSpec[sec][sub].forEach(item => data[main].activities[act].sections[sec].subsections[sub].items[item] = 0);
            }
          }
        }
      }
    }

    // 데이터 맵핑
    filtered.forEach(e => {
      // [v14] 미수금 발생(accrued) 및 [v15] 미지급금 발생(unpaid_occ) 건은 실제 현금 흐름이 없으므로 현금흐름표에서 제외
      if (e.accountingType === 'accrued' || e.accountingType === 'unpaid_occ') return;
      const amount = e.amount || 0;
      const budgetEntry = db.getBudgetItems().find(b => b.itemCode === e.itemCode);
      if (!budgetEntry) return;

      const mainKey = (budgetEntry.type === 'income' || budgetEntry.type === 'beginning') ? "Ⅰ_현금유입액" : "Ⅱ_현금유출액";
      const path = budgetEntry.operatingAccount || "";
      const name = budgetEntry.name || "";

      let found = false;
      for (const act in CF_STRUCTURE[mainKey]) {
        const actSpec = CF_STRUCTURE[mainKey][act];
        for (const sec in actSpec) {
          if (Array.isArray(actSpec[sec])) {
            actSpec[sec].forEach(item => {
              if (match(item, path, name)) {
                data[mainKey].activities[act].sections[sec].items[item] += amount;
                updateTotals(data, mainKey, act, sec, amount);
                found = true;
              }
            });
          } else {
            for (const sub in actSpec[sec]) {
              actSpec[sec][sub].forEach(item => {
                if (match(item, path, name)) {
                  data[mainKey].activities[act].sections[sec].subsections[sub].items[item] += amount;
                  data[mainKey].activities[act].sections[sec].subsections[sub].total += amount;
                  updateTotals(data, mainKey, act, sec, amount);
                  found = true;
                }
              });
              if (found) break;
            }
          }
          if (found) break;
        }
        if (found) break;
      }

      if (!found) {
        const fallAct = Object.keys(CF_STRUCTURE[mainKey])[0];
        const fallSec = Object.keys(CF_STRUCTURE[mainKey][fallAct]).pop();
        const secData = data[mainKey].activities[fallAct].sections[fallSec];
        if (secData.items) {
          const fallItem = Object.keys(secData.items).pop();
          secData.items[fallItem] += amount;
        } else {
          const fallSub = Object.keys(secData.subsections).pop();
          const fallItem = Object.keys(secData.subsections[fallSub].items).pop();
          secData.subsections[fallSub].items[fallItem] += amount;
          secData.subsections[fallSub].total += amount;
        }
        updateTotals(data, mainKey, fallAct, fallSec, amount);
      }
    });

    return data;
  }

  function match(item, path, name) {
    const keyword = item.replace(/^[가-힣0-9a-zA-Z\.\(\)\:\s]+[\.]?[\:\s]?/g, '').trim();
    if (!keyword) return false;
    return path.includes(keyword) || name.includes(keyword);
  }

  function updateTotals(data, main, act, sec, amount) {
    data[main].activities[act].sections[sec].total += amount;
    data[main].activities[act].total += amount;
    data[main].total += amount;
  }

  function renderReportContent(current, prev) {
    let html = '';
    const formatRow = (name, currVal, prevVal, isBold = false, level = 1, isSeparator = false) => {
      const indent = level > 1 ? `padding-left: ${(level - 1) * 20}px;` : '';
      return `
        <tr class="${isSeparator ? 'row-separator' : (isBold ? 'row-group' : 'row-item')}">
          <td><div class="dotted-cell" style="${indent}"><span class="item-name">${isBold ? '<strong>' + name + '</strong>' : name}</span></div></td>
          <td class="amount-cell">${helpers.formatCurrencyRaw(currVal)}</td>
          <td class="amount-cell color-prev">${helpers.formatCurrencyRaw(prevVal)}</td>
          <td class="amount-cell" style="font-weight:600; color:var(--accent);">${helpers.formatCurrencyRaw(currVal - prevVal)}</td>
        </tr>
      `;
    };

    const mains = ["Ⅰ_현금유입액", "Ⅱ_현금유출액"];
    mains.forEach(main => {
      const label = main.startsWith("Ⅰ") ? "Ⅰ. 현금유입액" : "Ⅱ. 현금유출액";
      html += formatRow(label, current[main].total, prev[main].total, true, 1, true);

      for (const act in current[main].activities) {
        const actData = current[main].activities[act];
        html += formatRow(act, actData.total, prev[main].activities[act].total, true, 2);

        for (const sec in actData.sections) {
          const secData = actData.sections[sec];
          const prevSecData = prev[main].activities[act].sections[sec];
          html += formatRow(sec, secData.total, prevSecData.total, true, 3);

          if (secData.subsections) {
            for (const sub in secData.subsections) {
              const subData = secData.subsections[sub];
              const prevSubData = prevSecData.subsections[sub];
              html += formatRow(sub, subData.total, prevSubData.total, false, 4);
              for (const item in subData.items) {
                html += formatRow(item, subData.items[item], prevSubData.items[item], false, 5);
              }
            }
          } else {
            for (const item in secData.items) {
              html += formatRow(item, secData.items[item] || 0, prevSecData.items[item] || 0, false, 4);
            }
          }
        }
      }
    });

    html += `<tr><td colspan="3" style="height: 10px;"></td></tr>`;
    html += formatRow("Ⅲ. 현금의 증감 (Ⅰ - Ⅱ)", current.summary.netChange, prev.summary.netChange, true, 1);
    html += formatRow("Ⅳ. 기초의 현금", current.summary.beginning, prev.summary.beginning, true, 1);
    html += formatRow("Ⅴ. 기말의 현금 (Ⅲ + Ⅳ)", current.summary.ending, prev.summary.ending, true, 1);

    return html;
  }

  function exportToExcel(year) {
    const currentYear = year || BudgetModule?._selectedYear || new Date().getFullYear();
    const prevYear = currentYear - 1;
    const allLedger = db.getLedger();

    const currentData = aggregateCFData(allLedger, currentYear);
    const prevData = aggregateCFData(allLedger, prevYear);
    currentData.summary = calculateSummary(currentData, allLedger, currentYear);
    prevData.summary = calculateSummary(prevData, allLedger, prevYear);

    const wb = XLSX.utils.book_new();
    const data = [];

    // Title & Info
    data.push(["현 금 흐 름 표"]);
    data.push([`[당기] 제 ${currentYear - 1999} 기 : ${currentYear}. 03. 01 ~ ${currentYear + 1}. 02. 28`]);
    data.push([`[전기] 제 ${prevYear - 1999} 기 : ${prevYear}. 03. 01 ~ ${prevYear + 1}. 02. 28`]);
    data.push(["예원예술대학교 산학협력단", "", "", " (단위: 원)"]);
    data.push([]); // Empty row

    // Header
    data.push(["과 목 (Account)", `제 ${currentYear - 1999} (당) 기`, `제 ${prevYear - 1999} (전) 기`, "증 감 (Variance)"]);

    const addRows = (name, currVal, prevVal, level = 0) => {
      const indent = "  ".repeat(level);
      data.push([indent + name, currVal, prevVal, currVal - prevVal]);
    };

    const mains = ["Ⅰ_현금유입액", "Ⅱ_현금유출액"];
    mains.forEach(main => {
      const label = main.startsWith("Ⅰ") ? "Ⅰ. 현금유입액" : "Ⅱ. 현금유출액";
      addRows(label, currentData[main].total, prevData[main].total, 0);

      for (const act in currentData[main].activities) {
        const actData = currentData[main].activities[act];
        addRows(act, actData.total, prevData[main].activities[act].total, 1);

        for (const sec in actData.sections) {
          const secData = actData.sections[sec];
          const prevSecData = prevData[main].activities[act].sections[sec];
          addRows(sec, secData.total, prevSecData.total, 2);

          if (secData.subsections) {
            for (const sub in secData.subsections) {
              const subData = secData.subsections[sub];
              const prevSubData = prevSecData.subsections[sub];
              addRows(sub, subData.total, prevSubData.total, 3);
              for (const item in subData.items) {
                addRows(item, subData.items[item], prevSubData.items[item], 4);
              }
            }
          } else {
            for (const item in secData.items) {
              addRows(item, secData.items[item], prevSecData.items[item], 3);
            }
          }
        }
      }
    });

    data.push([]);
    addRows("Ⅲ. 현금의 증감 (Ⅰ - Ⅱ)", currentData.summary.netChange, prevData.summary.netChange, 0);
    addRows("Ⅳ. 기초의 현금", currentData.summary.beginning, prevData.summary.beginning, 0);
    addRows("Ⅴ. 기말의 현금 (Ⅲ + Ⅳ)", currentData.summary.ending, prevData.summary.ending, 0);

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Styling
    const range = XLSX.utils.decode_range(ws['!ref']);
    const headerRowIdx = 5; // Row 6

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

    XLSX.utils.book_append_sheet(wb, ws, "현금흐름표");
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    XLSX.writeFile(wb, `예원예술대학교_현금흐름표_${dateStr}.xlsx`);
  }

  return { render, exportToExcel };
})();

window.CashFlowModule = CashFlowModule;
