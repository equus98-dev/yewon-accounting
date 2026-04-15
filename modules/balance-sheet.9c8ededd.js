const BalanceSheetModule = (() => {
  const { db, helpers } = window;

  // [v24.2] rule.pdf 산학협력단 회계처리규칙 별지 제1호 재무상태표 서식 100% 반영
  // 유동/비유동 구분 및 관, 항, 목(괄호) 계층 구조 완벽 일치
  const BS_STRUCTURE = {
    assets: {
      label: '자 산',
      sections: {
        "Ⅰ. 유동자산": {
          "1. 당좌자산": [
            "(1)현금및현금성자산", "(2)단기금융상품", "(3)단기매매금융자산", "(4)매출채권", 
            "(5)미수금", "(6)미수수익", "(7)선급금", "(8)선급비용", "(9)선급법인세", "(10)부가세대급금", "(11)기타당좌자산"
          ],
          "2. 재고자산": ["(1)재고자산"]
        },
        "Ⅱ. 비유동자산": {
          "1. 투자자산": ["(1)장기금융상품", "(2)장기투자금융자산", "(3)출자금", "(4)기타투자자산"],
          "2. 유형자산": ["(1)토지", "(2)건물", "(3)구축물", "(4)기계기구", "(5)집기비품", "(6)차량운반구", "(7)건설중인자산", "(8)기타유형자산"],
          "3. 무형자산": ["(1)지식재산권", "(2)개발비", "(3)기타무형자산"],
          "4. 기타비유동자산": ["(1)연구기금", "(2)건축기금", "(3)장학기금", "(4)기타기금", "(5)보증금", "(6)기타비유동자산"]
        }
      }
    },
    liabilities: {
      label: '부 채',
      sections: {
        "Ⅰ. 유동부채": {
          "1. 유동부채": ["(1)매입채무", "(2)미지급금", "(3)선수금", "(4)예수금", "(5)부가세예수금", "(6)미지급비용", "(7)선수수익", "(8)기타유동부채"]
        },
        "Ⅱ. 비유동부채": {
          "1. 비유동부채": ["(1)임대보증금", "(2)퇴직급여충당부채", "(3)고유목적사업준비금", "(4)기타비유동부채"]
        }
      }
    },
    equity: {
      label: '기 본 금',
      sections: {
        "Ⅰ. 출연기본금": { "1. 출연기본금": ["(1)출연기본금"] },
        "Ⅱ. 적립금": { "1. 적립금": ["(1)연구적립금", "(2)건축적립금", "(3)장학적립금", "(4)기타적립금"] },
        "Ⅲ. 운영차익": { "1. 처분전운영차익": ["(1)전기이월운영차익", "(2)당기운영차익"] }
      }
    }
  };

  function render(container, year) {
    const currentYear = year || new Date().getFullYear();
    const prevYear = currentYear - 1;

    const allLedger = db.getLedger();
    const budgetItems = db.getBudgetItems();
    const assetsData = db.getAssets();

    const currentData = aggregateBSData(allLedger, budgetItems, assetsData, currentYear);
    const prevData = aggregateBSData(allLedger, budgetItems, assetsData, prevYear);

    container.innerHTML = `
      <div class="print-container comparative">
        <div class="report-form-header">
          <div class="report-logo-section">
            <img src="img/logo_Black.png" alt="로고" class="report-university-logo">
          </div>
          <div class="report-title-section">
            <h1 class="report-main-title">재 무 상 태 표</h1>
            <p class="report-period">
              [당기] 제 ${currentYear - 1999} 기 : ${currentYear + 1}. 02. 28 현재 <br>
              [전기] 제 ${prevYear - 1999} 기 : ${prevYear + 1}. 02. 28 현재
            </p>
          </div>
          <div class="report-empty-space"></div>
        </div>

        <div class="report-info-bar">
          <span>예원예술대학교 산학협력단</span>
          <span class="report-unit">(단위: 원)</span>
        </div>

        <div class="table-wrapper">
          <table class="report-table comparative-table bs-table">
            <thead>
              <tr>
                <th style="width: 45%">과 목 (Account)</th>
                <th class="text-right">제 ${currentYear - 1999} (당) 기</th>
                <th class="text-right">제 ${prevYear - 1999} (전) 기</th>
                <th class="text-right">증 감 (Variance)</th>
              </tr>
            </thead>
            <tbody>
              ${renderBSTableRows(currentData, prevData)}
            </tbody>
          </table>
        </div>
        
        <div class="report-footer-school">
          예원예술대학교 산학협력단
        </div>
      </div>
    `;
  }

  function aggregateBSData(ledger, budgetItems, assetsData, year) {
    const endDate = `${year + 1}-02-28`;
    const data = initializeData();

    // 1. 기초 현금 자산 기반 (B-1-1-01 시작 잔액 반영)
    budgetItems.filter(b => b.year === year && b.itemCode === 'B-1-1-01').forEach(b => {
      data.assets["Ⅰ. 유동자산"].sections["1. 당좌자산"].items["(1)현금및현금성자산"] += (b.amount || 0);
    });

    // 2. 원장 데이터 누적 집계 (EndDate 까지의 누적)
    const cumulativeLedger = ledger.filter(e => e.transactionDate <= endDate);
    
    cumulativeLedger.forEach(e => {
      const budgetEntry = budgetItems.find(b => b.itemCode === e.itemCode);
      if (!budgetEntry) return;

      const path = budgetEntry.operatingAccount || "";
      const name = budgetEntry.name || "";
      const amount = e.amount || 0;

      // 자산/부채/기본금 분류에 따른 증감 로직 적용
      for (const groupKey in BS_STRUCTURE) {
        for (const sect in BS_STRUCTURE[groupKey].sections) {
          for (const cat in BS_STRUCTURE[groupKey].sections[sect]) {
            const items = BS_STRUCTURE[groupKey].sections[sect][cat];
            for (const item of items) {
              if (match(item, path, name)) {
                // 회계 종류에 따른 자산/부채 증감 처리
                let factor = 0;
                if (groupKey === 'assets') {
                  factor = (e.accountingType === 'collection' || e.accountingType === 'unpaid_pay') ? 1 : -1;
                } else {
                  factor = (e.accountingType === 'payment' || e.accountingType === 'accrued_occ') ? 1 : -1;
                }
                data[groupKey][sect].sections[cat].items[item] += amount * factor;
                data[groupKey][sect].sections[cat].total += amount * factor;
                data[groupKey][sect].total += amount * factor;
                data[groupKey].total += amount * factor;
                return;
              }
            }
          }
        }
      }
    });

    // 3. 고정자산 감가상각 누계액 반영 (필요 시)
    // ...

    return data;
  }

  function initializeData() {
    const data = {};
    for (const groupKey in BS_STRUCTURE) {
      data[groupKey] = { total: 0, sections: {} };
      for (const sect in BS_STRUCTURE[groupKey].sections) {
        data[groupKey].sections[sect] = { total: 0, sections: {} };
        for (const cat in BS_STRUCTURE[groupKey].sections[sect]) {
          const items = BS_STRUCTURE[groupKey].sections[sect][cat];
          data[groupKey].sections[sect].sections[cat] = { 
            total: 0, 
            items: Object.fromEntries(items.map(i => [i, 0])) 
          };
        }
      }
    }
    return data;
  }

  function match(item, path, name) {
    const keyword = item.replace(/^[가-힣A-Z0-9]{1,2}[\.\)]\s?|^\([가-힣A-Z0-9]{1,2}\)\s?/g, '').trim();
    if (!keyword) return false;
    const cleanKeyword = keyword.replace(/[\s\(\)·]/g, '');
    const cleanPath = path.replace(/[\s\(\)·]/g, '');
    const cleanName = name.replace(/[\s\(\)·]/g, '');
    return cleanPath.includes(cleanKeyword) || cleanName.includes(cleanKeyword);
  }

  function renderBSTableRows(current, prev) {
    let html = '';

    const formatRow = (name, currVal, prevVal, level = 0, isBold = false, isSeparator = false) => {
      const classAttr = isSeparator ? 'row-separator' : (level === 0 ? 'row-final' : (level === 1 ? 'row-group' : 'row-item'));
      const indent = level > 0 ? `padding-left: ${level * 25}px;` : '';
      const nameContent = isBold ? `<strong>${name}</strong>` : name;

      return `
        <tr class="${classAttr}">
          <td><div class="dotted-cell" style="${indent}"><span>${nameContent}</span></div></td>
          <td class="amount-cell">${isSeparator ? '' : helpers.formatCurrencyRaw(currVal)}</td>
          <td class="amount-cell color-prev">${isSeparator ? '' : helpers.formatCurrencyRaw(prevVal)}</td>
          <td class="amount-cell" style="font-weight:600; color:var(--accent);">${isSeparator ? '' : helpers.formatCurrencyRaw(currVal - prevVal)}</td>
        </tr>
      `;
    };

    const groups = ['assets', 'liabilities', 'equity'];
    groups.forEach(groupKey => {
      const g = BS_STRUCTURE[groupKey];
      const cG = current[groupKey], pG = prev[groupKey];

      html += `<tr class="row-separator thick"><td colspan="4"><strong>[ ${g.label} ]</strong></td></tr>`;
      html += formatRow(`${g.label} 총계`, cG.total, pG.total, 0, true);

      for (const sectName in cG.sections) {
        const cS = cG.sections[sectName], pS = pG.sections[sectName];
        html += formatRow(sectName, cS.total, pS.total, 1, true);
        for (const catName in cS.sections) {
          const cC = cS.sections[catName], pC = pS.sections[catName];
          html += formatRow(catName, cC.total, pC.total, 2, true);
          for (const itemName in cC.items) {
            html += formatRow(itemName, cC.items[itemName], pC.items[itemName] || 0, 3);
          }
        }
      }
    });

    return html;
  }

  return { render };
})();

window.BalanceSheetModule = BalanceSheetModule;
