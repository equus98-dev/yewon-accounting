// modules/budget.js - 산학협력단 전체예산 관리 (운영계산서 기준)
// [v19] 2023.6 산학협력단 회계처리규칙 해설서 표준 계정 체계 완벽 반영

const BudgetModule = (() => {
  const { db } = window;
  const { helpers } = window;

  const BUDGET_YEARS = [2025, 2026, 2027, 2028, 2029, 2030];
  let _selectedYear = 2026;

  // ═══════════════════════════════════════════════
  // 관-항-목 구조 정의 (운영계산서 기준 표준 체계)
  // ═══════════════════════════════════════════════
  const BUDGET_STRUCTURE = {
    income: {
      label: '운영수익총계',
      sections: [
        {
          code: 'OI-1', name: 'Ⅰ.산학협력수익',
          categories: [
            {
              code: 'OI-1-1', name: '1.연구수익',
              items: [
                { code: 'OI-1-1-01', name: '1)정부연구수익' },
                { code: 'OI-1-1-02', name: '2)산업체연구수익' }
              ]
            },
            {
              code: 'OI-1-2', name: '2.교육운영수익',
              items: [
                { code: 'OI-1-2-01', name: '1)교육운영수익' }
              ]
            },
            {
              code: 'OI-1-3', name: '3.기술이전수익',
              items: [
                { code: 'OI-1-3-01', name: '1)지식재산권이전수익' },
                { code: 'OI-1-3-02', name: '2)노하우이전수익' }
              ]
            },
            {
              code: 'OI-1-4', name: '4.설비자산사용료수익',
              items: [
                { code: 'OI-1-4-01', name: '1)설비자산사용료수익' },
                { code: 'OI-1-4-02', name: '2)임대료수익' }
              ]
            },
            {
              code: 'OI-1-5', name: '5.기타산학협력수익',
              items: [
                { code: 'OI-1-5-01', name: '1)기타산학협력수익' },
                { code: 'OI-1-5-02', name: '2)학교기업 수익' }
              ]
            }
          ]
        },
        {
          code: 'OI-2', name: 'Ⅱ.지원금수익',
          categories: [
            {
              code: 'OI-2-1', name: '1.연구수익',
              items: [
                { code: 'OI-2-1-01', name: '1)정부연구수익' },
                { code: 'OI-2-1-02', name: '2)산업체연구수익' }
              ]
            },
            {
              code: 'OI-2-2', name: '2.교육운영수익',
              items: [
                { code: 'OI-2-2-01', name: '1)교육운영수익' }
              ]
            },
            {
              code: 'OI-2-3', name: '3.기타지원금수익',
              items: [
                { code: 'OI-2-3-01', name: '1)기타지원금수익' }
              ]
            }
          ]
        },
        {
          code: 'OI-3', name: 'Ⅲ.간접비수익',
          categories: [
            {
              code: 'OI-3-1', name: '1.산학협력수익',
              items: [
                { code: 'OI-3-1-01', name: '1)산학협력연구수익' },
                { code: 'OI-3-1-02', name: '2)산학협력교육운영수익' },
                { code: 'OI-3-1-03', name: '3)기타산학협력수익' }
              ]
            },
            {
              code: 'OI-3-2', name: '2.지원금수익',
              items: [
                { code: 'OI-3-2-01', name: '1)지원금연구수익' },
                { code: 'OI-3-2-02', name: '2)지원금교육운영수익' },
                { code: 'OI-3-2-03', name: '3)기타지원금수익' }
              ]
            }
          ]
        },
        {
          code: 'OI-4', name: 'Ⅳ.전입및기부금수익',
          categories: [
            {
              code: 'OI-4-1', name: '1.전입금수익',
              items: [
                { code: 'OI-4-1-01', name: '1)학교법인전입금' },
                { code: 'OI-4-1-02', name: '2)학교회계전입금' },
                { code: 'OI-4-1-03', name: '3)학교기업전입금' },
                { code: 'OI-4-1-04', name: '4)기타전입금' }
              ]
            },
            {
              code: 'OI-4-2', name: '2.기부금수익',
              items: [
                { code: 'OI-4-2-01', name: '1)일반기부금' },
                { code: 'OI-4-2-02', name: '2)지정기부금' }
              ]
            }
          ]
        },
        {
          code: 'OI-5', name: 'Ⅴ.운영외수익',
          categories: [
            {
              code: 'OI-5-1', name: '1.운영외수익',
              items: [
                { code: 'OI-5-1-01', name: '1)이자수익' },
                { code: 'OI-5-1-02', name: '2)배당금수익' },
                { code: 'OI-5-1-03', name: '3)유가증권평가이익' },
                { code: 'OI-5-1-04', name: '4)유가증권처분이익' },
                { code: 'OI-5-1-05', name: '5)외환차익' },
                { code: 'OI-5-1-06', name: '6)외화환산이익' },
                { code: 'OI-5-1-07', name: '7)유형자산처분이익' },
                { code: 'OI-5-1-08', name: '8)대손충당금환입' },
                { code: 'OI-5-1-09', name: '9)전기오류수정이익' },
                { code: 'OI-5-1-10', name: '10)고유목적사업준비금환입액' },
                { code: 'OI-5-1-11', name: '11) 기타운영외수익' }
              ]
            }
          ]
        }
      ]
    },
    expense: {
      label: '운영비용총계',
      sections: [
        {
          code: 'OE-1', name: 'Ⅰ.산학협력비',
          categories: [
            {
              code: 'OE-1-1', name: '1.산학협력연구비',
              items: [
                { code: 'OE-1-1-01', name: '1)인건비' },
                { code: 'OE-1-1-02', name: '2)학생인건비' },
                { code: 'OE-1-1-03', name: '3)연구시설·장비비' },
                { code: 'OE-1-1-04', name: '4)연구활동비' },
                { code: 'OE-1-1-05', name: '5)연구재료비' },
                { code: 'OE-1-1-06', name: '6)연구수당' },
                { code: 'OE-1-1-07', name: '7)위탁연구개발비' }
              ]
            },
            {
              code: 'OE-1-2', name: '2.교육운영비',
              items: [
                { code: 'OE-1-2-01', name: '1)인건비' },
                { code: 'OE-1-2-02', name: '2)교육과정개발비' },
                { code: 'OE-1-2-03', name: '3)장학금' },
                { code: 'OE-1-2-04', name: '4)실험실습비' },
                { code: 'OE-1-2-05', name: '5)기타교육운영비' }
              ]
            },
            {
              code: 'OE-1-3', name: '3.지식재산권비용',
              items: [
                { code: 'OE-1-3-01', name: '1)지식재산권실시·양도비' },
                { code: 'OE-1-3-02', name: '2)산학협력보상금' }
              ]
            },
            {
              code: 'OE-1-4', name: '4.학교시설사용료',
              items: [
                { code: 'OE-1-4-01', name: '1)학교시설사용료' }
              ]
            },
            {
              code: 'OE-1-5', name: '5.기타산학협력비',
              items: [
                { code: 'OE-1-5-01', name: '1)인건비' },
                { code: 'OE-1-5-02', name: '2)기타산학협력비' },
                { code: 'OE-1-5-03', name: '3)학교기업 비용' }
              ]
            }
          ]
        },
        {
          code: 'OE-2', name: 'Ⅱ.지원금사업비',
          categories: [
            {
              code: 'OE-2-1', name: '1.연구비',
              items: [
                { code: 'OE-2-1-01', name: '1)인건비' },
                { code: 'OE-2-1-02', name: '2)학생인건비' },
                { code: 'OE-2-1-03', name: '3)연구시설·장비비' },
                { code: 'OE-2-1-04', name: '4)연구활동비' },
                { code: 'OE-2-1-05', name: '5)연구재료비' },
                { code: 'OE-2-1-06', name: '6)연구수당' },
                { code: 'OE-2-1-07', name: '7)위탁연구개발비' }
              ]
            },
            {
              code: 'OE-2-2', name: '2.교육운영비',
              items: [
                { code: 'OE-2-2-01', name: '1)인건비' },
                { code: 'OE-2-2-02', name: '2)교육과정개발비' },
                { code: 'OE-2-2-03', name: '3)장학금' },
                { code: 'OE-2-2-04', name: '4)실험실습비' },
                { code: 'OE-2-2-05', name: '5)기타교육운영비' }
              ]
            },
            {
              code: 'OE-2-3', name: '3.기타지원금사업비',
              items: [
                { code: 'OE-2-3-01', name: '1)인건비' },
                { code: 'OE-2-3-02', name: '2)기타지원금사업비' }
              ]
            }
          ]
        },
        {
          code: 'OE-3', name: 'Ⅲ.간접비사업비',
          categories: [
            {
              code: 'OE-3-1', name: '1.인력지원비',
              items: [
                { code: 'OE-3-1-01', name: '1)인건비' },
                { code: 'OE-3-1-02', name: '2)연구개발능률성과급' },
                { code: 'OE-3-1-03', name: '3)연구개발준비금' }
              ]
            },
            {
              code: 'OE-3-2', name: '2.연구지원비',
              items: [
                { code: 'OE-3-2-01', name: '1)기관 공통비용' },
                { code: 'OE-3-2-02', name: '2)사업단 또는 연구단 운영비' },
                { code: 'OE-3-2-03', name: '3)기반시설·장비구축·운영비' },
                { code: 'OE-3-2-04', name: '4)연구실안전관리비' },
                { code: 'OE-3-2-05', name: '5)학생산재보험료' },
                { code: 'OE-3-2-06', name: '6)연구보안관리비' },
                { code: 'OE-3-2-07', name: '7)연구윤리활동비' },
                { code: 'OE-3-2-08', name: '8)연구활동지원금' }
              ]
            },
            {
              code: 'OE-3-3', name: '3.성과활용지원비',
              items: [
                { code: 'OE-3-3-01', name: '1)과학문화활동비' },
                { code: 'OE-3-3-02', name: '2)지식재산권 출원·등록비' }
              ]
            },
            {
              code: 'OE-3-4', name: '4.기타지원비',
              items: [
                { code: 'OE-3-4-01', name: '1)기타지원비' }
              ]
            }
          ]
        },
        {
          code: 'OE-4', name: 'Ⅳ.일반관리비',
          categories: [
            {
              code: 'OE-4-1', name: '1.일반관리비',
              items: [
                { code: 'OE-4-1-01', name: '1)인건비' },
                { code: 'OE-4-1-02', name: '2)감가상각비' },
                { code: 'OE-4-1-03', name: '3)무형자산상각비' },
                { code: 'OE-4-1-04', name: '4)대손상각비' },
                { code: 'OE-4-1-05', name: '5)일반제경비' }
              ]
            }
          ]
        },
        {
          code: 'OE-5', name: 'Ⅴ.운영외비용',
          categories: [
            {
              code: 'OE-5-1', name: '1.운영외비용',
              items: [
                { code: 'OE-5-1-01', name: '1)유가증권처분손실' },
                { code: 'OE-5-1-02', name: '2)유가증권평가손실' },
                { code: 'OE-5-1-03', name: '3)외환차손' },
                { code: 'OE-5-1-04', name: '4)외화환산손실' },
                { code: 'OE-5-1-05', name: '5)유형자산처분손실' },
                { code: 'OE-5-1-06', name: '6)전기오류수정손실' },
                { code: 'OE-5-1-07', name: '7)고유목적사업준비금전입액' },
                { code: 'OE-5-1-08', name: '8)기타운영외비용' }
              ]
            }
          ]
        },
        {
          code: 'OE-6', name: 'Ⅵ.학교회계전출금',
          categories: [
            {
              code: 'OE-6-1', name: '1.학교회계전출금',
              items: [
                { code: 'OE-6-1-01', name: '1)학교회계전출금' }
              ]
            }
          ]
        }
      ]
    },
    reserve: {
      label: '예비비',
      sections: [
        {
          code: 'R-1', name: '예비비',
          categories: [
            {
              code: 'R-1-1', name: '예비비',
              items: [
                { code: 'R-1-1-01', name: '예비비' }
              ]
            }
          ]
        }
      ]
    }
  };

  // 관-항-목 flat 리스트 생성
  function getFlatItems(type) {
    const result = [];
    const struct = BUDGET_STRUCTURE[type];
    if (!struct) return result;
    struct.sections.forEach(sec => {
      sec.categories.forEach(cat => {
        cat.items.forEach(item => {
          result.push({
            code: item.code,
            section: sec.name,
            category: cat.name,
            item: item.name,
            label: `${sec.name} > ${cat.name} > ${item.name}`
          });
        });
      });
    });
    return result;
  }

  function render() {
    const allItems = db.getBudgetItems();
    const items = allItems.filter(b => (b.year || 2026) === _selectedYear);
    const incomeItems = items.filter(b => b.type === 'income');
    const expenseItems = items.filter(b => b.type === 'expense');
    const reserveItems = items.filter(b => b.type === 'reserve');

    const totalIncome = incomeItems.reduce((s, b) => s + (b.amount || 0), 0);
    const totalExpense = expenseItems.reduce((s, b) => s + (b.amount || 0), 0);
    const totalReserve = reserveItems.reduce((s, b) => s + (b.amount || 0), 0);
    const totalDiff = totalIncome - (totalExpense + totalReserve);

    document.getElementById('app-content').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">산학협력단 전체예산 (운영계산서)</h2>
          <p class="page-subtitle">${_selectedYear}년도 산학협력단 운영계산서 · 관-항-목 체계</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <select id="budget-year-select" class="year-select" onchange="BudgetModule.changeYear(this.value)">
            ${BUDGET_YEARS.map(y => `<option value="${y}" ${y === _selectedYear ? 'selected' : ''}>${y}년</option>`).join('')}
          </select>
          <button class="btn btn-primary" onclick="BudgetModule.openAddModal()">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            예산 항목 추가
          </button>
          <button class="btn btn-primary" onclick="BudgetModule.openTransferModal()">
            🔄 예산 전용
          </button>
        </div>
      </div>

      <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div class="kpi-card">
          <div class="kpi-icon kpi-green">📥</div>
          <div class="kpi-info">
            <div class="kpi-label">운영수익 예산총계</div>
            <div class="kpi-value">${helpers.formatCurrencyRaw(totalIncome)}<span class="kpi-unit">원</span></div>
            <div class="kpi-sub">수익 항목 ${incomeItems.length}개</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-red">📤</div>
          <div class="kpi-info">
            <div class="kpi-label">운영비용 예산총계</div>
            <div class="kpi-value">${helpers.formatCurrencyRaw(totalExpense + totalReserve)}<span class="kpi-unit">원</span></div>
            <div class="kpi-sub">비용 ${expenseItems.length}개 / 예비비 ${reserveItems.length}개</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-blue">💰</div>
          <div class="kpi-info">
            <div class="kpi-label">운영차액</div>
            <div class="kpi-value">${helpers.formatCurrencyRaw(totalDiff)}<span class="kpi-unit">원</span></div>
            <div class="kpi-sub">수익 - 비용</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h4 class="card-title" style="color:var(--success);">📥 운영수익</h4>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th class="text-left" style="width:18%">관 (Section)</th>
                <th class="text-left" style="width:20%">항 (Category)</th>
                <th class="text-left text-nowrap" style="width:20%">목 (Item)</th>
                <th class="text-right" style="width:15%">예산액 (원)</th>
                <th style="width:17%">비고</th>
                <th class="text-center" style="width:10%">관리</th>
              </tr>
            </thead>
            <tbody>
              ${renderGroupedRows(incomeItems, 'income')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h4 class="card-title" style="color:var(--danger);">📤 운영비용</h4>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th class="text-left" style="width:18%">관 (Section)</th>
                <th class="text-left" style="width:20%">항 (Category)</th>
                <th class="text-left text-nowrap" style="width:20%">목 (Item)</th>
                <th class="text-right" style="width:15%">예산액 (원)</th>
                <th style="width:17%">비고</th>
                <th class="text-center" style="width:10%">관리</th>
              </tr>
            </thead>
            <tbody>
              ${renderGroupedRows(expenseItems, 'expense')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="border-left: 4px solid #f59e0b;">
        <h4 class="card-title" style="color:#f59e0b;">🛡️ 예비비</h4>
        <div class="table-wrapper" style="margin-bottom: 20px;">
          <table class="data-table">
            <thead>
              <tr>
                <th class="text-left" style="width:18%">관 (Section)</th>
                <th class="text-left" style="width:20%">항 (Category)</th>
                <th class="text-left text-nowrap" style="width:20%">목 (Item)</th>
                <th class="text-right" style="width:15%">예산액 (원)</th>
                <th style="width:17%">비고</th>
                <th class="text-center" style="width:10%">관리</th>
              </tr>
            </thead>
            <tbody>
              ${renderGroupedRows(reserveItems, 'reserve')}
            </tbody>
          </table>
        </div>
      </div>

      ${renderAddModal()}
      ${renderTransferModal()}
    `;
  }

  function renderGroupedRows(items, type, isPrint = false) {
    const struct = BUDGET_STRUCTURE[type];
    if (!struct) return '';
    let html = '';

    struct.sections.forEach((sec, secIdx) => {
      sec.categories.forEach((cat, catIdx) => {
        cat.items.forEach(itemDef => {
          const matching = items.filter(b => b.itemCode === itemDef.code);

          if (matching.length > 0) {
            matching.forEach(b => {
              html += `<tr>
                            <td class="text-left"><span class="badge ${isPrint ? '' : 'badge-accent'}">${sec.name}</span></td>
                            <td class="text-left">${cat.name}</td>
                            <td class="text-left text-nowrap"><strong>${itemDef.name}</strong></td>
                            <td class="text-right ${['income'].includes(type) ? 'text-success' : 'text-danger'}">
                               <strong>${['income'].includes(type) ? '+' : '-'}${helpers.formatCurrencyRaw(b.amount)}</strong>
                            </td>
                            <td class="text-sm">${b.note || '-'}</td>
                            ${isPrint ? '' : `
                            <td class="text-center">
                              <div class="action-btns">
                                <button class="btn-icon btn-edit" onclick="BudgetModule.openEditModal('${b.id}')" title="수정">✏️</button>
                                <button class="btn-icon btn-delete" onclick="BudgetModule.deleteItem('${b.id}')" title="삭제">🗑️</button>
                              </div>
                            </td>`}
                          </tr>`;
            });
          } else if (!isPrint) {
            html += `<tr style="opacity: 0.6; background-color: rgba(0,0,0,0.02);">
                          <td class="text-left"><span class="badge badge-neutral">${sec.name}</span></td>
                          <td class="text-left">${cat.name}</td>
                          <td class="text-left text-nowrap">${itemDef.name}</td>
                          <td class="text-right">0</td>
                          <td class="text-sm" style="color:var(--text-muted)">-</td>
                          <td class="text-center">
                            <button class="btn btn-sm" style="padding: 2px 8px; font-size: 11px;" 
                                    onclick="BudgetModule.openAddModalPreFilled('${type}', ${secIdx}, ${catIdx}, '${itemDef.code}')">
                              ➕ 추가
                            </button>
                          </td>
                        </tr>`;
          }
        });
      });
    });

    const allCodes = [];
    for (const t in BUDGET_STRUCTURE) {
      BUDGET_STRUCTURE[t].sections.forEach(s => s.categories.forEach(c => c.items.forEach(i => allCodes.push(i.code))));
    }
    const unmatched = items.filter(b => !allCodes.includes(b.itemCode));
    unmatched.forEach(b => {
      html += `<tr>
              <td class="text-left"><span class="badge badge-neutral">미분류</span></td>
              <td class="text-left">${b.section || '-'}</td>
              <td class="text-left text-nowrap"><strong>${b.name || '-'}</strong></td>
              <td class="text-right ${['income'].includes(type) ? 'text-success' : 'text-danger'}">
                <strong>${['income'].includes(type) ? '+' : '-'}${helpers.formatCurrencyRaw(b.amount)}</strong>
              </td>
              <td class="text-sm">${b.note || '-'}</td>
              <td class="text-center">
                <div class="action-btns">
                  <button class="btn-icon btn-edit" onclick="BudgetModule.openEditModal('${b.id}')" title="수정">✏️</button>
                  <button class="btn-icon btn-delete" onclick="BudgetModule.deleteItem('${b.id}')" title="삭제">🗑️</button>
                </div>
              </td>
            </tr>`;
    });

    return html;
  }

  function renderAddModal() {
    return `
      <div class="modal-overlay" id="budget-modal">
        <div class="modal" style="max-width:560px;">
          <div class="modal-header">
            <h3 id="budget-modal-title">예산 항목 추가</h3>
            <button class="modal-close" onclick="helpers.closeModal('budget-modal')">×</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="bgt-id">
            <div class="form-grid">
              <div class="form-group">
                <label>유형 <span class="required">*</span></label>
                <select id="bgt-type" class="form-control" onchange="BudgetModule.onTypeChange()">
                  <option value="income">운영수익</option>
                  <option value="expense">운영비용</option>
                  <option value="reserve">예비비</option>
                </select>
              </div>
              <div class="form-group">
                <label>관 (Section) <span class="required">*</span></label>
                <select id="bgt-section" class="form-control" onchange="BudgetModule.onSectionChange()">
                  <option value="">-- 관 선택 --</option>
                </select>
              </div>
              <div class="form-group">
                <label>항 (Category) <span class="required">*</span></label>
                <select id="bgt-category" class="form-control" onchange="BudgetModule.onCategoryChange()">
                  <option value="">-- 항 선택 --</option>
                </select>
              </div>
              <div class="form-group">
                <label>목 (Item) <span class="required">*</span></label>
                <select id="bgt-item" class="form-control">
                  <option value="">-- 목 선택 --</option>
                </select>
              </div>
              <div class="form-group" id="bgt-amount-group">
                <label>예산액 (원) <span class="required">*</span></label>
                <input type="text" id="bgt-amount" class="form-control" placeholder="0" oninput="helpers.handleAmountInput(this)">
              </div>
              <div id="bgt-edit-calc-area" style="display:none; grid-column: span 2; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 10px;">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                  <div class="form-group">
                    <label style="font-size:12px; color:#64748b;">기존 예산액</label>
                    <input type="text" id="bgt-existing-amount" class="form-control" readonly style="background:#f1f5f9; cursor:not-allowed;">
                  </div>
                  <div class="form-group">
                    <label style="font-size:12px; color:var(--royal-blue); font-weight:bold;">+ 추가 예산액</label>
                    <input type="text" id="bgt-add-amount" class="form-control" placeholder="0" oninput="helpers.handleAmountInput(this); BudgetModule.updateCalculatedAmount();" style="border: 2px solid var(--royal-blue);">
                  </div>
                </div>
                <div style="margin-top:10px; padding-top:10px; border-top:1px dashed #cbd5e1; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-weight:bold; color:#475569;">최종 합계 예산액:</span>
                  <span id="bgt-calc-total" style="font-size:18px; font-weight:800; color:var(--royal-blue);">0원</span>
                </div>
              </div>
              <div class="form-group full">
                <label>비고</label>
                <input type="text" id="bgt-note" class="form-control" placeholder="비고 입력">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="helpers.closeModal('budget-modal')">취소</button>
            <button class="btn btn-primary" onclick="BudgetModule.saveItem()">저장</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderTransferModal() {
    const items = db.getBudgetItems().filter(b => (b.year || 2026) === _selectedYear);
    return `
      <div class="modal-overlay" id="transfer-modal">
        <div class="modal" style="max-width:520px;">
          <div class="modal-header">
            <h3>🔄 예산 전용 (목간 전용)</h3>
            <button class="modal-close" onclick="helpers.closeModal('transfer-modal')">×</button>
          </div>
          <div class="modal-body">
            <p class="hint-text">동일 관 내에서 목간 예산을 전용합니다.</p>
            <div class="form-grid">
              <div class="form-group">
                <label>전출 항목 <span class="required">*</span></label>
                <select id="tf-from" class="form-control">
                  <option value="">-- 원본 선택 --</option>
                  ${items.map(b => `<option value="${b.id}">[${b.type === 'income' ? '수익' : '비용'}] ${b.name} (${helpers.formatCurrencyRaw(b.amount)}원)</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>전입 항목 <span class="required">*</span></label>
                <select id="tf-to" class="form-control">
                  <option value="">-- 대상 선택 --</option>
                  ${items.map(b => `<option value="${b.id}">[${b.type === 'income' ? '수익' : '비용'}] ${b.name} (${helpers.formatCurrencyRaw(b.amount)}원)</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>전용 금액 <span class="required">*</span></label>
                <input type="text" id="tf-amount" class="form-control" placeholder="0" oninput="helpers.handleAmountInput(this)">
              </div>
              <div class="form-group full">
                <label>전용 사유</label>
                <input type="text" id="tf-reason" class="form-control" placeholder="사유">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="helpers.closeModal('transfer-modal')">취소</button>
            <button class="btn btn-primary" onclick="BudgetModule.executeTransfer()">전용 실행</button>
          </div>
        </div>
      </div>
    `;
  }

  function getItemInfo(budgetItem) {
    const info = getItemInfoByCode(budgetItem.type, budgetItem.itemCode);
    return { section: info.section, category: info.category, item: info.item };
  }

  function onTypeChange() {
    const type = document.getElementById('bgt-type').value;
    const secSelect = document.getElementById('bgt-section');
    const struct = BUDGET_STRUCTURE[type];
    secSelect.innerHTML = `<option value="">-- 관 선택 --</option>` +
      struct.sections.map((s, i) => `<option value="${i}">${s.name}</option>`).join('');
    document.getElementById('bgt-category').innerHTML = `<option value="">-- 항 선택 --</option>`;
    document.getElementById('bgt-item').innerHTML = `<option value="">-- 목 선택 --</option>`;
  }

  function onSectionChange() {
    const type = document.getElementById('bgt-type').value;
    const secIdx = document.getElementById('bgt-section').value;
    const catSelect = document.getElementById('bgt-category');
    if (secIdx === '') {
      catSelect.innerHTML = `<option value="">-- 항 선택 --</option>`;
      document.getElementById('bgt-item').innerHTML = `<option value="">-- 목 선택 --</option>`;
      return;
    }
    const cats = BUDGET_STRUCTURE[type].sections[secIdx].categories;
    catSelect.innerHTML = `<option value="">-- 항 선택 --</option>` +
      cats.map((c, i) => `<option value="${i}">${c.name}</option>`).join('');
    document.getElementById('bgt-item').innerHTML = `<option value="">-- 목 선택 --</option>`;
  }

  function onCategoryChange() {
    const type = document.getElementById('bgt-type').value;
    const secIdx = document.getElementById('bgt-section').value;
    const catIdx = document.getElementById('bgt-category').value;
    const itemSelect = document.getElementById('bgt-item');
    if (secIdx === '' || catIdx === '') {
      itemSelect.innerHTML = `<option value="">-- 목 선택 --</option>`;
      return;
    }
    const items = BUDGET_STRUCTURE[type].sections[secIdx].categories[catIdx].items;
    itemSelect.innerHTML = `<option value="">-- 목 선택 --</option>` +
      items.map(i => `<option value="${i.code}">${i.name}</option>`).join('');
  }

  function openAddModal() {
    helpers.openModal('budget-modal');
    document.getElementById('budget-modal-title').textContent = '예산 항목 추가';
    document.getElementById('bgt-id').value = '';
    document.getElementById('bgt-type').value = 'income';
    document.getElementById('bgt-amount').value = '';
    document.getElementById('bgt-note').value = '';
    document.getElementById('bgt-amount-group').style.display = 'block';
    document.getElementById('bgt-edit-calc-area').style.display = 'none';
    onTypeChange();
  }

  function openAddModalPreFilled(type, secIdx, catIdx, itemCode) {
    helpers.openModal('budget-modal');
    document.getElementById('bgt-id').value = '';
    document.getElementById('bgt-type').value = type;
    onTypeChange();
    document.getElementById('bgt-section').value = secIdx;
    onSectionChange();
    document.getElementById('bgt-category').value = catIdx;
    onCategoryChange();
    document.getElementById('bgt-item').value = itemCode;
    document.getElementById('bgt-amount').value = '';
    document.getElementById('bgt-note').value = '';
    document.getElementById('bgt-amount-group').style.display = 'block';
    document.getElementById('bgt-edit-calc-area').style.display = 'none';
  }

  function openEditModal(id) {
    const item = db.getBudgetItems().find(b => b.id === id);
    if (!item) return;
    helpers.openModal('budget-modal');
    document.getElementById('budget-modal-title').textContent = '예산 항목 수정';
    document.getElementById('bgt-id').value = item.id;
    document.getElementById('bgt-type').value = item.type;
    onTypeChange();

    const struct = BUDGET_STRUCTURE[item.type];
    for (let si = 0; si < struct.sections.length; si++) {
      for (let ci = 0; ci < struct.sections[si].categories.length; ci++) {
        for (const it of struct.sections[si].categories[ci].items) {
          if (it.code === item.itemCode) {
            document.getElementById('bgt-section').value = si;
            onSectionChange();
            document.getElementById('bgt-category').value = ci;
            onCategoryChange();
            document.getElementById('bgt-item').value = item.itemCode;
          }
        }
      }
    }
    document.getElementById('bgt-amount').value = helpers.formatCurrencyRaw(item.amount || 0);
    document.getElementById('bgt-note').value = item.note || '';
    document.getElementById('bgt-amount-group').style.display = 'none';
    document.getElementById('bgt-edit-calc-area').style.display = 'block';
    document.getElementById('bgt-existing-amount').value = helpers.formatCurrencyRaw(item.amount || 0);
    document.getElementById('bgt-add-amount').value = '';
    updateCalculatedAmount();
  }

  function updateCalculatedAmount() {
    const existing = helpers.parseAmount(document.getElementById('bgt-existing-amount').value);
    const add = helpers.parseAmount(document.getElementById('bgt-add-amount').value);
    const total = existing + add;
    document.getElementById('bgt-calc-total').textContent = helpers.formatCurrencyRaw(total) + '원';
    document.getElementById('bgt-amount').value = helpers.formatCurrencyRaw(total);
  }

  function saveItem() {
    const itemCode = document.getElementById('bgt-item').value;
    const amount = helpers.parseAmount(document.getElementById('bgt-amount').value);
    if (!itemCode) { helpers.showToast('관-항-목을 모두 선택해 주세요.', 'error'); return; }
    if (amount === undefined || isNaN(amount)) { helpers.showToast('금액을 입력해 주세요.', 'error'); return; }
    const type = document.getElementById('bgt-type').value;
    const info = getItemInfoByCode(type, itemCode);

    const item = {
      id: document.getElementById('bgt-id').value || 'bgt_' + Date.now(),
      type, itemCode, name: info.item, section: info.section, category: info.category,
      amount, year: _selectedYear, note: document.getElementById('bgt-note').value.trim()
    };
    db.saveBudgetItem(item);
    helpers.closeModal('budget-modal');
    render();
  }

  function getItemInfoByCode(type, code) {
    const struct = BUDGET_STRUCTURE[type];
    for (const sec of struct.sections) {
      for (const cat of sec.categories) {
        const item = cat.items.find(i => i.code === code);
        if (item) return { section: sec.name, category: cat.name, item: item.name };
      }
    }
    return { section: '', category: '', item: '' };
  }

  function deleteItem(id) {
    if (!confirm('삭제하시겠습니까?')) return;
    db.deleteBudgetItem(id);
    render();
  }

  // ── 예산 전용 (Restore missing functions) ──
  function openTransferModal() {
    render();
    setTimeout(() => helpers.openModal('transfer-modal'), 100);
  }

  function executeTransfer() {
    const fromId = document.getElementById('tf-from').value;
    const toId = document.getElementById('tf-to').value;
    const amount = helpers.parseAmount(document.getElementById('tf-amount').value);
    const reason = document.getElementById('tf-reason').value.trim();

    if (!fromId || !toId) { helpers.showToast('전출/전입 항목을 모두 선택해 주세요.', 'error'); return; }
    if (fromId === toId) { helpers.showToast('같은 항목으로 전용할 수 없습니다.', 'error'); return; }
    if (!amount || amount <= 0) { helpers.showToast('올바른 금액을 입력해 주세요.', 'error'); return; }

    const items = db.getBudgetItems();
    const fromItem = items.find(b => b.id === fromId);
    const toItem = items.find(b => b.id === toId);
    if (!fromItem || !toItem) { helpers.showToast('항목을 찾을 수 없습니다.', 'error'); return; }
    if (fromItem.type !== toItem.type) { helpers.showToast('같은 유형(수익/비용) 내에서만 전용 가능합니다.', 'error'); return; }
    if (amount > fromItem.amount) { helpers.showToast('전출 항목의 예산액을 초과할 수 없습니다.', 'error'); return; }

    fromItem.amount -= amount;
    toItem.amount += amount;

    const stamp = new Date().toLocaleString('ko-KR');
    fromItem.note = (fromItem.note || '') + ` [전용출 -${helpers.formatCurrencyRaw(amount)}원 ${stamp}${reason ? ' ' + reason : ''}]`;
    toItem.note = (toItem.note || '') + ` [전용입 +${helpers.formatCurrencyRaw(amount)}원 ${stamp}${reason ? ' ' + reason : ''}]`;

    db.saveBudgetItem(fromItem);
    db.saveBudgetItem(toItem);

    helpers.closeModal('transfer-modal');
    helpers.showToast(`예산 전용 완료: ${helpers.formatCurrencyRaw(amount)}원 이동됨`);
    render();
  }

  function changeYear(year) {
    _selectedYear = parseInt(year);
    render();
  }

  return {
    render, openAddModal, openEditModal, openAddModalPreFilled, saveItem, deleteItem,
    onTypeChange, onSectionChange, onCategoryChange,
    openTransferModal, executeTransfer, changeYear, updateCalculatedAmount,
    getItemInfo, BUDGET_STRUCTURE, _selectedYear
  };
})();

window.BudgetModule = BudgetModule;
