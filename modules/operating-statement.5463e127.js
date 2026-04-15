const OperatingStatementModule = (() => {
  const { db, helpers } = window;

  // [v24.6] 운영비용 섹션 최신 지침서 이미지 3장 바탕으로 인건비 추가 및 학생산재보험료 복구
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
        "2.기부금수익": ["1)일반기부금", "2)지정기부금"]
      },
      "Ⅴ.운영외수익": {
        "1.운영외수익": [
          "1)이자수익", "2)배당금수익", "3)유가증권평가이익", "4)유가증권처분이익", "5)외환차익",
          "6)외화환산이익", "7)유형자산처분이익", "8)대손충당금환입", "9)전기오류수정이익",
          "10)고유목적사업준비금환입액", "11) 기타운영외수익"
        ]
      }
    },
    "운영비용": {
      "Ⅰ.산학협력비": {
        "1.산학협력연구비": ["1)인건비", "2)학생인건비", "3)연구시설·장비비", "4)연구활동비", "5)연구재료비", "6)연구수당", "7)위탁연구개발비"],
        "2.교육운영비": ["1)인건비", "2)교육과정개발비", "3)장학금", "4)실험실습비", "5)기타교육운영비"],
        "3.지식재산권비용": ["1)지식재산권실시·양도비", "2)산학협력보상금"],
        "4.학교시설사용료": ["1)학교시설사용료"],
        "5.기타산학협력비": ["1)인건비", "2)기타산학협력비", "3)학교기업 비용"]
      },
      "Ⅱ.지원금사업비": {
        "1.연구비": ["1)인건비", "2)학생인건비", "3)연구시설·장비비", "4)연구활동비", "5)연구재료비", "6)연구수당", "7)위탁연구개발비"],
        "2.교육운영비": ["1)인건비", "2)교육과정개발비", "3)장학금", "4)실험실습비", "5)기타교육운영비"],
        "3.기타지원금사업비": ["1)인건비", "2)기타지원금사업비"]
      },
      "Ⅲ.간접비사업비": {
        "1.인력지원비": ["1)인건비", "2)연구개발능률성과급", "3)연구개발준비금"],
        "2.연구지원비": [
          "1)기관 공통비용", "2)사업단 또는 연구단 운영비", "3)기반시설·장비구축·운영비",
          "4)연구실안전관리비", "5)학생산재보험료", "6)연구보안관리비", "7)연구윤리활동비", "8)연구활동지원금"
        ],
        "3.성과활용지원비": ["1)과학문화활동비", "2)지식재산권 출원·등록비"],
        "4.기타지원비": ["1)기타지원비"]
      },
      "Ⅳ.일반관리비": {
        "1.일반관리비": ["1)인건비", "2)감가상각비", "3)무형자산상각비", "4)대손상각비", "5)일반제경비"]
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
    const budgetStructure = (window.BudgetModule && window.BudgetModule.BUDGET_STRUCTURE) || {};

    const currentData = aggregateData(allLedger, budgetStructure, currentYear);
    const prevData = aggregateData(allLedger, budgetStructure, prevYear);

    container.innerHTML = `
      <div class="print-container comparative">
        <div class="report-form-header">
          <div class="report-logo-section">
            <img src="img/logo_Black.png" alt="로고" class="report-university-logo">
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
          <table class="report-table comparative-table os-table">
            <thead>
              <tr>
                <th style="width: 45%">과 목 (Account)</th>
                <th class="text-right">제 ${currentYear - 1999} (당) 기</th>
                <th class="text-right">제 ${prevYear - 1999} (전) 기</th>
                <th class="text-right">증 감 (Variance)</th>
              </tr>
            </thead>
            <tbody>
              ${renderOSTableRows(currentData, prevData)}
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
    const endDate = `${year + 1}-02-28`;

    const filtered = ledger.filter(e => e.transactionDate >= startDate && e.transactionDate <= endDate);
    const data = initializeData();

    filtered.forEach(entry => {
      if (!entry.itemCode) return;
      if (entry.accountingType === 'collection' || entry.accountingType === 'unpaid_pay') return;
      
      const budgetEntry = db.getBudgetItems().find(b => b.itemCode === entry.itemCode);
      if (!budgetEntry) return;

      const path = budgetEntry.operatingAccount || "";
      const name = budgetEntry.name || "";
      const amount = entry.amount || 0;

      for (const groupKey in CHART_OF_ACCOUNTS) {
        for (const kwan in CHART_OF_ACCOUNTS[groupKey]) {
          for (const hang in CHART_OF_ACCOUNTS[groupKey][kwan]) {
            const moks = CHART_OF_ACCOUNTS[groupKey][kwan][hang];
            for (const mok of moks) {
              if (match(mok, path, name)) {
                data[groupKey].kvans[kwan].hangs[hang].moks[mok] += amount;
                data[groupKey].kvans[kwan].hangs[hang].total += amount;
                data[groupKey].kvans[kwan].total += amount;
                data[groupKey].total += amount;
                return;
              }
            }
          }
        }
      }
    });

    return data;
  }

  function initializeData() {
    const data = {};
    for (const groupKey in CHART_OF_ACCOUNTS) {
      data[groupKey] = { total: 0, kvans: {} };
      for (const kwan in CHART_OF_ACCOUNTS[groupKey]) {
        data[groupKey].kvans[kwan] = { total: 0, hangs: {} };
        for (const hang in CHART_OF_ACCOUNTS[groupKey][kwan]) {
          const moks = CHART_OF_ACCOUNTS[groupKey][kwan][hang];
          data[groupKey].kvans[kwan].hangs[hang] = {
            total: 0,
            moks: Object.fromEntries(moks.map(m => [m, 0]))
          };
        }
      }
    }
    return data;
  }

  function match(item, path, name) {
    const keyword = item.replace(/^[가-힣A-Z0-9]{1,2}[\.\)]\s?|^\([가-힣A-Z0-9]{1,2}\)\s?/g, '').trim();
    if (!keyword) return false;
    const cleanKeyword = keyword.replace(/[·\s\(\)]/g, '');
    const cleanPath = path.replace(/[·\s\(\)]/g, '');
    const cleanName = name.replace(/[·\s\(\)]/g, '');
    return cleanPath.includes(cleanKeyword) || cleanName.includes(cleanKeyword);
  }

  function renderOSTableRows(current, prev) {
    let html = '';

    const formatRow = (name, currVal, prevVal, level = 0, isBold = false) => {
      const classAttr = level === 0 ? 'row-final' : (level === 1 ? 'row-group' : 'row-item');
      const indent = level > 0 ? `padding-left: ${level * 25}px;` : '';
      const nameContent = isBold ? `<strong>${name}</strong>` : name;

      return `
        <tr class="${classAttr}">
          <td><div class="dotted-cell" style="${indent}"><span>${nameContent}</span></div></td>
          <td class="amount-cell">${helpers.formatCurrencyRaw(currVal)}</td>
          <td class="amount-cell color-prev">${helpers.formatCurrencyRaw(prevVal)}</td>
          <td class="amount-cell" style="font-weight:600; color:var(--accent);">${helpers.formatCurrencyRaw(currVal - prevVal)}</td>
        </tr>
      `;
    };

    // 1.운영수익
    const cRev = current["운영수익"], pRev = prev["운영수익"];
    html += `<tr class="row-separator thick"><td colspan="4"><strong>1.운영수익</strong></td></tr>`;
    html += formatRow('운영수익총계', cRev.total, pRev.total, 0, true);
    for (const kwan in CHART_OF_ACCOUNTS["운영수익"]) {
      const cK = cRev.kvans[kwan], pK = pRev.kvans[kwan];
      html += formatRow(kwan, cK.total, pK.total, 1, true);
      for (const hang in CHART_OF_ACCOUNTS["운영수익"][kwan]) {
        const cH = cK.hangs[hang], pH = pK.hangs[hang];
        html += formatRow(hang, cH.total, pH.total, 2, true);
        for (const mok in cH.moks) {
          html += formatRow(mok, cH.moks[mok], pH.moks[mok] || 0, 3);
        }
      }
    }

    // 2.운영비용
    const cExp = current["운영비용"], pExp = prev["운영비용"];
    html += `<tr class="row-separator thick"><td colspan="4"><strong>2.운영비용</strong></td></tr>`;
    html += formatRow('운영비용합계', cExp.total, pExp.total, 0, true);
    for (const kwan in CHART_OF_ACCOUNTS["운영비용"]) {
      const cK = cExp.kvans[kwan], pK = pExp.kvans[kwan];
      html += formatRow(kwan, cK.total, pK.total, 1, true);
      for (const hang in CHART_OF_ACCOUNTS["운영비용"][kwan]) {
        const cH = cK.hangs[hang], pH = pK.hangs[hang];
        html += formatRow(hang, cH.total, pH.total, 2, true);
        for (const mok in cH.moks) {
          html += formatRow(mok, cH.moks[mok], pH.moks[mok] || 0, 3);
        }
      }
    }

    const diffCurr = cRev.total - cExp.total;
    const diffPrev = pRev.total - pExp.total;

    html += `<tr class="row-separator thick"><td colspan="4" style="text-align:right; font-weight:bold; padding: 10px 15px;">당기운영차익 (또는 당기운영차손) : ${helpers.formatCurrencyRaw(diffCurr)}</td></tr>`;
    html += formatRow('운영비용총계', cRev.total, pRev.total, 0, true);

    return html;
  }

  return { render };
})();

window.OperatingStatementModule = OperatingStatementModule;
