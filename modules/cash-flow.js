const CashFlowModule = (() => {
  const { db, helpers } = window;

  // [v24.2] rule.pdf 투자/재무활동 유출액 정밀 수정
  // '적립지출', '보증금지출' 등 지침서 원문 용어 100% 반영 및 불필요 항목(은행차입금감소) 제거
  const CF_STRUCTURE = {
    "Ⅰ. 현금유입액": {
      "1. 운영활동으로 인한 현금유입액": {
        "1)산학협력수익현금유입액": {
          "(1)연구수익": ["가.정부연구수익", "나.산업체연구수익"],
          "(2)교육운영수익": ["가.교육운영수익"],
          "(3)기술이전수익": ["가.지식재산권이전수익", "나.노하우이전수익"],
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
        "1)투자자산수입": {
          "(1)장기금융상품인출": [],
          "(2)장기투자금융자산매각대": [],
          "(3)출자금회수": [],
          "(4)기타투자자산수입": []
        },
        "2)유형자산매각대": {
          "(1)토지매각대": [],
          "(2)건물매각대": [],
          "(3)구축물매각대": [],
          "(4)기계기구매각대": [],
          "(5)집기비품매각대": [],
          "(6)차량운반구매각대": [],
          "(7)기타유형자산매각대": []
        },
        "3)무형자산매각대": {
          "(1)지식재산권매각대": [],
          "(2)개발비매각대": [],
          "(3)기타무형자산매각대": []
        },
        "4)기타비유동자산수입": {
          "(1)연구기금인출수입": [],
          "(2)건축기금인출수입": [],
          "(3)장학기금인출수입": [],
          "(4)기타기금인출수입": [],
          "(5)보증금수입": [],
          "(6)기타비유동자산수입": []
        }
      },
      "3.재무활동으로인한현금유입액": {
        "1)부채의차입": {
          "(1)은행차입금증가": [],
          "(2)임대보증금증가": [],
          "(3)기타비유동부채증가": []
        },
        "2)기본금조달": {
          "(1)출연기본금증가": []
        }
      }
    },
    "Ⅱ. 현금유출액": {
      "1. 운영활동으로 인한 현금유출액": {
        "1)산학협력비현금유출액": {
          "(1)산학협력연구비": ["가.인건비", "나.학생인건비", "다.연구시설·장비비", "라.연구활동비", "마.연구재료비", "바.연구수당", "사.위탁연구개발비"],
          "(2)교육운영비": ["가.인건비", "나.교육과정개발비", "다.장학금", "라.실험실습비", "마.기타교육운영비"],
          "(3)지식재산권비용": ["가.지식재산권실시·양도비", "나.산학협력보상금"],
          "(4)학교시설사용료": ["가.학교시설사용료"],
          "(5)기타산학협력비": ["가.기타산학협력비"]
        },
        "2)지원금사업비현금유출액": {
          "(1)연구명세": ["가.인건비", "나.학생인건비", "다.연구시설·장비비", "라.연구활동비", "마.연구재료비", "바.연구수당", "사.위탁연구개발비"],
          "(2)교육운영비": ["가.인건비", "나.교육과정개발비", "다.장학금", "라.실험실습비", "마.기타교육운영비"],
          "(3)기타지원금사업비": ["가.기타지원금사업비"]
        },
        "3)간접비사업비현금유출액": {
          "(1)인력지원비": ["가.인건비", "나.연구개발능률성과급", "다.연구개발준비금"],
          "(2)연구지원비": ["가.기관 공통비용", "나.사업단 또는 연구단운영비", "다.기반시설·장비구축·운영비", "라.연구실안전관리비", "마.연구보안관리비", "바.연구윤리활동비", "사.연구활동지원금"],
          "(3)성과활용지원비": ["가.과학문화활동비", "나.지식재산권출원·등록비"],
          "(4)기타지원비": ["가.기타지원비"]
        },
        "4)일반관리비현금유출액": {
          "(1)일반관리비": ["가.인건비", "나.일반제경비"]
        },
        "5)운영외비용현금유출액": {
          "가.전기오류수정손실": [],
          "나.기타운영외비용": []
        },
        "6)학교회계전출금현금유출액": {
          "가.학교회계전출금": []
        }
      },
      "2.투자활동으로인한현금유출액": {
        "1)투자자산지출": {
          "(1)장기금융상품증가": [],
          "(2)장기투자금융자산취득지출": [],
          "(3)출자금투자지출": [],
          "(4)기타투자자산투자지출": []
        },
        "2)유형자산취득지출": {
          "(1)토지취득": [],
          "(2)건물취득": [],
          "(3)구축물취득": [],
          "(4)기계기구취득": [],
          "(5)집기비품취득": [],
          "(6)차량운반구취득": [],
          "(7)건설중인자산취득": [],
          "(8)기타유형자산취득": []
        },
        "3)무형자산취득지출": {
          "(1)지식재산권취득": [],
          "(2)개발비취득": [],
          "(3)기타무형자산취득": []
        },
        "4)기타비유동자산지출": {
          "(1)연구기금적립지출": [],
          "(2)건축기금적립지출": [],
          "(3)장학기금적립지출": [],
          "(4)기타기금적립지출": [],
          "(5)보증금지출": [],
          "(6)기타비유동자산지출": []
        }
      },
      "3.재무활동으로인한현금유출액": {
        "1)부채의상환": {
          "(1)임대보증금감소": [],
          "(2)기타비유동부채감소": []
        },
        "2)기본금반환": {
          "(1)출연기본금감소": []
        }
      }
    }
  };

  function render(container, year) {
    const currentYear = year || new Date().getFullYear();
    const prevYear = currentYear - 1;

    const allLedger = db.getLedger();
    const budgetItems = db.getBudgetItems();

    const currentData = aggregateCFData(allLedger, budgetItems, currentYear);
    const prevData = aggregateCFData(allLedger, budgetItems, prevYear);

    const currentCash = calculateTotalCash(allLedger, budgetItems, currentYear);
    const prevCash = calculateTotalCash(allLedger, budgetItems, prevYear);

    container.innerHTML = `
      <div class="print-container detailed-cf">
        <div class="report-form-header">
          <div class="report-logo-section">
            <img src="img/logo_Black.png" alt="로고" class="report-university-logo">
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

        <div class="table-wrapper cf-detailed-wrapper">
          <table class="report-table detailed-cf-table">
            <thead>
              <tr class="header-main-row">
                <th colspan="3" class="text-center border-right-thick">과 목 (Account)</th>
                <th colspan="3" class="text-center border-right-thick">제 ${currentYear - 1999} (당) 기</th>
                <th colspan="3" class="text-center">제 ${prevYear - 1999} (전) 기</th>
              </tr>
              <tr class="header-sub-row">
                <th style="width:10%">관</th>
                <th style="width:12%">항</th>
                <th style="width:18%" class="border-right-thick">목</th>
                <th class="amount-header">목</th>
                <th class="amount-header">항</th>
                <th class="amount-header border-right-thick">관</th>
                <th class="amount-header">목</th>
                <th class="amount-header">항</th>
                <th class="amount-header">관</th>
              </tr>
            </thead>
            <tbody>
              ${renderDetailedCFRows(currentData, prevData)}
              
              <tr class="row-separator"><td colspan="9" style="padding-top:20px; border-bottom: 2.5px solid #334155;"><strong>[ 현금의 증감 요약 ]</strong></td></tr>
              <tr class="summary-total-row">
                 <td colspan="3" class="border-right-thick"><strong>Ⅲ. 현금의 순증가(감소) (Ⅰ-Ⅱ)</strong></td>
                 <td colspan="3" class="text-right border-right-thick"><strong>${helpers.formatCurrencyRaw(currentCash.change)}</strong></td>
                 <td colspan="3" class="text-right"><strong>${helpers.formatCurrencyRaw(prevCash.change)}</strong></td>
              </tr>
              <tr class="summary-total-row">
                 <td colspan="3" class="border-right-thick"><strong>Ⅳ. 기초의 현금</strong></td>
                 <td colspan="3" class="text-right border-right-thick"><strong>${helpers.formatCurrencyRaw(currentCash.beginning)}</strong></td>
                 <td colspan="3" class="text-right"><strong>${helpers.formatCurrencyRaw(prevCash.beginning)}</strong></td>
              </tr>
              <tr class="summary-total-row">
                 <td colspan="3" class="border-right-thick"><strong>Ⅴ. 기말의 현금 (Ⅲ + Ⅳ)</strong></td>
                 <td colspan="3" class="text-right border-right-thick"><strong>${helpers.formatCurrencyRaw(currentCash.end)}</strong></td>
                 <td colspan="3" class="text-right"><strong>${helpers.formatCurrencyRaw(prevCash.end)}</strong></td>
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

  function renderDetailedCFRows(current, prev) {
    let html = '';

    for (const main in CF_STRUCTURE) {
      const cMain = current[main];
      const pMain = prev[main];

      html += `<tr class="cf-main-row">
        <td colspan="3" class="border-right-thick"><strong>${main}</strong></td>
        <td></td><td></td><td class="text-right border-right-thick"><strong>${helpers.formatCurrencyRaw(cMain.total)}</strong></td>
        <td></td><td></td><td class="text-right"><strong>${helpers.formatCurrencyRaw(pMain.total)}</strong></td>
      </tr>`;

      for (const group in CF_STRUCTURE[main]) {
        const cGroup = cMain.groups[group];
        const pGroup = pMain.groups[group];

        html += `<tr class="cf-act-row">
          <td colspan="3" class="border-right-thick">&nbsp;&nbsp;${group}</td>
          <td></td><td></td><td class="text-right border-right-thick">${helpers.formatCurrencyRaw(cGroup.total)}</td>
          <td></td><td></td><td class="text-right">${helpers.formatCurrencyRaw(pGroup.total)}</td>
        </tr>`;

        for (const account in CF_STRUCTURE[main][group]) {
          const cAcc = cGroup.accounts[account];
          const pAcc = pGroup.accounts[account];

          html += `<tr class="cf-sec-row">
            <td colspan="3" class="border-right-thick">&nbsp;&nbsp;&nbsp;&nbsp;${account}</td>
            <td></td><td class="text-right border-right-thick">${helpers.formatCurrencyRaw(cAcc.total)}</td><td></td>
            <td></td><td class="text-right">${helpers.formatCurrencyRaw(pAcc.total)}</td><td></td>
          </tr>`;

          for (const subItem in CF_STRUCTURE[main][group][account]) {
            const cSub = cAcc.subItems[subItem];
            const pSub = pAcc.subItems[subItem];

            html += `<tr class="cf-sub-header-row">
              <td colspan="3" class="border-right-thick">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${subItem}</td>
              <td class="text-right">${helpers.formatCurrencyRaw(cSub.total)}</td><td></td><td class="border-right-thick"></td>
              <td class="text-right">${helpers.formatCurrencyRaw(pSub.total)}</td><td></td><td></td>
            </tr>`;

            if (cSub.items && Array.isArray(cSub.items) && cSub.items.length > 0) {
              for (const itemKey of cSub.items) {
                 const cItemVal = cSub.details ? (cSub.details[itemKey] || 0) : 0;
                 const pItemVal = pSub.details ? (pSub.details[itemKey] || 0) : 0;
                 html += `<tr class="cf-detail-row">
                    <td colspan="3" class="border-right-thick">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${itemKey}</td>
                    <td class="text-right">${helpers.formatCurrencyRaw(cItemVal)}</td><td></td><td class="border-right-thick"></td>
                    <td class="text-right">${helpers.formatCurrencyRaw(pItemVal)}</td><td></td><td></td>
                 </tr>`;
              }
            }
          }
        }
      }
    }
    return html;
  }

  function calculateTotalCash(ledger, budgetItems, year) {
    const yearStart = `${year}-03-01`;
    const yearEnd = `${year + 1}-02-28`;
    const prevYearEnd = `${year}-02-28`;

    const initialCash = budgetItems.filter(b => b.year === year && b.itemCode === 'B-1-1-01')
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    const prevFlow = ledger.filter(e => e.transactionDate <= prevYearEnd)
      .reduce((sum, e) => {
        if (e.accountingType === 'collection' || e.accountingType === 'unpaid_pay') return sum + e.amount;
        if (e.accountingType === 'payment' || e.accountingType === 'accrued_occ') return sum - e.amount;
        return sum;
      }, 0);

    const periodFlow = ledger.filter(e => e.transactionDate >= yearStart && e.transactionDate <= yearEnd)
      .reduce((sum, e) => {
        if (e.accountingType === 'collection' || e.accountingType === 'unpaid_pay') return sum + e.amount;
        if (e.accountingType === 'payment' || e.accountingType === 'accrued_occ') return sum - e.amount;
        return sum;
      }, 0);

    return {
      beginning: initialCash + prevFlow,
      change: periodFlow,
      end: initialCash + prevFlow + periodFlow
    };
  }

  function aggregateCFData(ledger, budgetItems, year) {
    const startDate = `${year}-03-01`;
    const endDate = `${year + 1}-02-28`;
    const filtered = ledger.filter(e => e.transactionDate >= startDate && e.transactionDate <= endDate);

    const data = {};
    for (const main in CF_STRUCTURE) {
      data[main] = { total: 0, groups: {} };
      for (const group in CF_STRUCTURE[main]) {
        data[main].groups[group] = { total: 0, accounts: {} };
        for (const account in CF_STRUCTURE[main][group]) {
          data[main].groups[group].accounts[account] = { total: 0, subItems: {} };
          for (const subItem in CF_STRUCTURE[main][group][account]) {
            const subVal = CF_STRUCTURE[main][group][account][subItem];
            data[main].groups[group].accounts[account].subItems[subItem] = { total: 0, items: Array.isArray(subVal) ? subVal : [], details: {} };
            if (Array.isArray(subVal)) {
              subVal.forEach(i => data[main].groups[group].accounts[account].subItems[subItem].details[i] = 0);
            }
          }
        }
      }
    }

    filtered.forEach(e => {
      const amount = e.amount || 0;
      const budgetEntry = budgetItems.find(b => b.itemCode === e.itemCode);
      if (!budgetEntry) return;

      const path = budgetEntry.operatingAccount || "";
      const name = budgetEntry.name || "";
      const isOutflow = (e.accountingType === 'payment' || e.accountingType === 'accrued_occ');

      for (const main in CF_STRUCTURE) {
        if (main.includes("유입") && isOutflow) continue;
        if (main.includes("유출") && !isOutflow) continue;

        for (const group in CF_STRUCTURE[main]) {
          for (const account in CF_STRUCTURE[main][group]) {
            for (const subItem in CF_STRUCTURE[main][group][account]) {
              const items = CF_STRUCTURE[main][group][account][subItem];
              if (Array.isArray(items) && items.length > 0) {
                for (const item of items) {
                  if (match(item, path, name)) {
                    data[main].groups[group].accounts[account].subItems[subItem].details[item] += amount;
                    data[main].groups[group].accounts[account].subItems[subItem].total += amount;
                    data[main].groups[group].accounts[account].total += amount;
                    data[main].groups[group].total += amount;
                    data[main].total += amount;
                    return;
                  }
                }
              } else {
                if (match(subItem, path, name)) {
                  data[main].groups[group].accounts[account].subItems[subItem].total += amount;
                  data[main].groups[group].accounts[account].total += amount;
                  data[main].groups[group].total += amount;
                  data[main].total += amount;
                  return;
                }
              }
            }
          }
        }
      }
    });

    return data;
  }

  function match(item, path, name) {
    const keyword = item.replace(/^[가-힣A-Z0-9]{1,2}[\.\)]\s?|^\([가-힣A-Z0-9]{1,2}\)\s?/g, '').trim();
    if (!keyword) return false;
    const cleanKeyword = keyword.replace(/현금유입액$|현금유출액$|매각대$|회수$|인출$|수입$|인출수입$| 또는 연구단운영비$|구축·운영비$|지출$|증가$|투자지출$|취득지출$|적립지출$/, '');
    return path.includes(cleanKeyword) || name.includes(cleanKeyword);
  }

  return { render };
})();

window.CashFlowModule = CashFlowModule;
