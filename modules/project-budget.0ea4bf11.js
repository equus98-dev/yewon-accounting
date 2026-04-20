// modules/project-budget.js - 과제(사업)별 예산 관리 (관-항-목 체계)

const ProjectBudgetModule = (() => {
  const { db } = window;
  const { helpers } = window;

  const BUDGET_YEARS = [2025, 2026, 2027, 2028, 2029, 2030];
  const EXPENSE_CATEGORIES = ['강사료', '버스임차료', '보험료', '사업비', '소모품비', '숙박비', '연구재료비', '연구활동비', '여비', '인건비', '임차료', '학생보험료', '학생인건비', '회의비', '홍보비', '출장비', '기타'];
  let _selectedYear = 2026;
  let _selectedProjectId = '';

  // budget.js의 구조 재사용
  const BUDGET_STRUCTURE = {
    income: {
      label: '현금수입총계',
      sections: [
        {
          code: 'I-1', name: 'Ⅰ. 현금유입액',
          categories: [
            {
              code: 'I-1-1', name: '1. 운영활동으로인한현금유입액',
              items: [
                { code: 'I-1-1-01', name: '1) 산학협력수익현금유입액' },
                { code: 'I-1-1-02', name: '2) 지원금수익현금유입액' },
                { code: 'I-1-1-03', name: '3) 간접비수익현금유입액' },
                { code: 'I-1-1-04', name: '4) 전입및기부금수익현금유입액' },
                { code: 'I-1-1-05', name: '5) 운영외수익현금유입액' }
              ]
            },
            {
              code: 'I-1-2', name: '2. 투자활동 현금유입',
              items: [
                { code: 'I-1-2-01', name: '1) 투자자산수입 - 장기금융상품인출' },
                { code: 'I-1-2-02', name: '1) 투자자산수입 - 장기투자금융자산매각대' },
                { code: 'I-1-2-03', name: '1) 투자자산수입 - 출자금회수' },
                { code: 'I-1-2-04', name: '1) 투자자산수입 - 기타투자자산수입' },
                { code: 'I-1-2-05', name: '2) 유형자산매각대 - 토지' },
                { code: 'I-1-2-06', name: '2) 유형자산매각대 - 건물' },
                { code: 'I-1-2-07', name: '2) 유형자산매각대 - 구축물' },
                { code: 'I-1-2-08', name: '2) 유형자산매각대 - 기계기구' },
                { code: 'I-1-2-09', name: '2) 유형자산매각대 - 집기비품' },
                { code: 'I-1-2-10', name: '2) 유형자산매각대 - 차량운반구' },
                { code: 'I-1-2-11', name: '2) 유형자산매각대 - 기타유형자산' },
                { code: 'I-1-2-12', name: '3) 무형자산매각대 - 지식재산권' },
                { code: 'I-1-2-13', name: '3) 무형자산매각대 - 개발비' },
                { code: 'I-1-2-14', name: '3) 무형자산매각대 - 기타무형자산매각대' },
                { code: 'I-1-2-15', name: '4) 기타비유동자산수입 - 기금인출수입' },
                { code: 'I-1-2-16', name: '4) 기타비유동자산수입 - 보증금수입' },
                { code: 'I-1-2-17', name: '4) 기타비유동자산수입 - 기타비유동자산수입' }
              ]
            },
            {
              code: 'I-1-3', name: '3. 재무활동 현금유입',
              items: [
                { code: 'I-1-3-01', name: '1) 부채의차입 - 임대보증금증가' },
                { code: 'I-1-3-02', name: '1) 부채의차입 - 기타비유동부채증가' },
                { code: 'I-1-3-03', name: '2) 기본금의조달 - 출연기본금입금액(법인)' },
                { code: 'I-1-3-04', name: '2) 기본금의조달 - 출연기본금입금액(교비)' },
                { code: 'I-1-3-05', name: '2) 기본금의조달 - 출연기본금입금액(기타)' }
              ]
            }
          ]
        },
        {
          code: 'I-2', name: 'Ⅱ. 기초의현금',
          categories: [
            {
              code: 'I-2-1', name: '기초의현금',
              items: [
                { code: 'I-2-1-1', name: '기초의현금(전년도 이월금)' }
              ]
            }
          ]
        }
      ]
    },
    expense: {
      label: '현금지출총계',
      sections: [
        {
          code: 'E-1', name: 'Ⅰ. 현금유출액',
          categories: [
            {
              code: 'E-1-1', name: '1. 운영활동으로인한현금유유출액',
              items: [
                { code: 'E-1-1-01', name: '1) 산학협력비현금유출액' },
                { code: 'E-1-1-02', name: '2) 지원금사업비현금유출액' },
                { code: 'E-1-1-03', name: '3) 간접비사업비현금유출액' },
                { code: 'E-1-1-04', name: '4) 일반관리비현금유출액' },
                { code: 'E-1-1-05', name: '5) 운영외비용현금유출액' },
                { code: 'E-1-1-06', name: '6) 학교회계전출금현금유출액' }
              ]
            },
            {
              code: 'E-1-2', name: '2. 투자활동 현금유출',
              items: [
                { code: 'E-1-2-01', name: '1) 투자자산지출 - 장기금융상품증가' },
                { code: 'E-1-2-02', name: '1) 투자자산지출 - 장기투자금융자산취득' },
                { code: 'E-1-2-03', name: '1) 투자자산지출 - 출자금투자' },
                { code: 'E-1-2-04', name: '1) 투자자산지출 - 기타투자자산지출' },
                { code: 'E-1-2-05', name: '2) 유형자산취득 - 토지' },
                { code: 'E-1-2-06', name: '2) 유형자산취득 - 건물' },
                { code: 'E-1-2-07', name: '2) 유형자산취득 - 구축물' },
                { code: 'E-1-2-08', name: '2) 유형자산취득 - 기계기구' },
                { code: 'E-1-2-09', name: '2) 유형자산취득 - 집기비품' },
                { code: 'E-1-2-10', name: '2) 유형자산취득 - 차량운반구' },
                { code: 'E-1-2-11', name: '2) 유형자산취득 - 건설중인자산' },
                { code: 'E-1-2-12', name: '2) 유형자산취득 - 기타유형자산' },
                { code: 'E-1-2-13', name: '3) 무형자산취득 - 지식재산권취득' },
                { code: 'E-1-2-14', name: '3) 무형자산취득 - 개발비취득' },
                { code: 'E-1-2-15', name: '3) 무형자산취득 - 기타무형자산취득' },
                { code: 'E-1-2-16', name: '4) 기타비유동자산지출 - 기금적립지출' },
                { code: 'E-1-2-17', name: '4) 기타비유동자산지출 - 보증금지출' },
                { code: 'E-1-2-18', name: '4) 기타비유동자산지출 - 기타비유동자산지출' }
              ]
            },
            {
              code: 'E-1-3', name: '3. 재무활동 현금유출',
              items: [
                { code: 'E-1-3-01', name: '1) 부채의상환 - 임대보증금감소' },
                { code: 'E-1-3-02', name: '1) 부채의상환 - 기타비유동부채감소' },
                { code: 'E-1-3-03', name: '2) 기본금의반환 - 출연기본금감소(법인)' },
                { code: 'E-1-3-04', name: '2) 기본금의반환 - 출연기본금감소(교비)' },
                { code: 'E-1-3-05', name: '2) 기본금의반환 - 출연기본금감소(기타)' }
              ]
            }
          ]
        },
        {
          code: 'E-2', name: 'Ⅱ. 기말의현금',
          categories: [
            {
              code: 'E-2-1', name: '기말의현금',
              items: [
                { code: 'E-2-1-1', name: '기말의현금' }
              ]
            }
          ]
        },
        {
          code: 'E-3', name: 'Ⅲ. 예비비',
          categories: [
            {
              code: 'E-3-1', name: '예비비',
              items: [
                { code: 'E-3-1-1', name: '예비비(비상자금)' }
              ]
            }
          ]
        }
      ]
    }
  };

  function render() {
    const projects = db.getProjects();
    if (!_selectedProjectId && projects.length > 0) {
      _selectedProjectId = projects[0].id;
    }

    const items = db.getProjectBudgetItems(_selectedProjectId).filter(b => (b.year || 2026) === _selectedYear);
    const incomeItems = items.filter(b => b.type === 'income');
    const expenseItems = items.filter(b => b.type === 'expense');
    const totalIncome = incomeItems.reduce((s, b) => s + (b.amount || 0), 0);
    const totalExpense = expenseItems.reduce((s, b) => s + (b.amount || 0), 0);

    const filteredProjects = projects.filter(p => helpers.isProjectInFiscalYear(p, _selectedYear));

    const project = db.getProjectById(_selectedProjectId);
    document.getElementById('app-content').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">과제(사업)별 예산관리</h2>
          <p class="page-subtitle">
            ${project ? `<span class="badge badge-primary">${project.manager || '업무담당미정'}</span>` : ''} 
            선택한 과제의 상세 예산을 관-항-목 체계로 관리합니다
          </p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <select id="pb-project-select" class="form-control" style="width:250px" onchange="ProjectBudgetModule.changeProject(this.value)">
            ${filteredProjects.map(p => `<option value="${p.id}" ${p.id === _selectedProjectId ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
          <select id="pb-year-select" class="year-select" onchange="ProjectBudgetModule.changeYear(this.value)">
            ${BUDGET_YEARS.map(y => `<option value="${y}" ${y === _selectedYear ? 'selected' : ''}>${y}년</option>`).join('')}
          </select>
          <button class="btn btn-primary" onclick="ProjectBudgetModule.openAddModal()" ${_selectedProjectId ? '' : 'disabled'}>
            ➕ 예산 항목 추가
          </button>
          <button class="btn btn-primary" onclick="ProjectBudgetModule.openTransferModal()" ${_selectedProjectId ? '' : 'disabled'}>
            🔄 예산 전용
          </button>
        </div>
      </div>

      ${!_selectedProjectId ? `
        <div class="card empty-state">
          <div class="empty-icon">📁</div>
          <p>예산을 관리할 과제를 먼저 선택하거나 추가해 주세요.</p>
        </div>
      ` : `
        <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr);">
          <div class="kpi-card">
            <div class="kpi-icon kpi-green">📥</div>
            <div class="kpi-info">
              <div class="kpi-label">과제 수입예산</div>
              <div class="kpi-value">${helpers.formatCurrencyRaw(totalIncome)}<span class="kpi-unit">원</span></div>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon kpi-red">📤</div>
            <div class="kpi-info">
              <div class="kpi-label">과제 지출예산</div>
              <div class="kpi-value">${helpers.formatCurrencyRaw(totalExpense)}<span class="kpi-unit">원</span></div>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon kpi-blue">💰</div>
            <div class="kpi-info">
              <div class="kpi-label">예산 잔액</div>
              <div class="kpi-value">${helpers.formatCurrencyRaw(totalIncome - totalExpense)}<span class="kpi-unit">원</span></div>
            </div>
          </div>
        </div>

        <div class="card">
          <h4 class="card-title" style="color:var(--success);">📥 수입 항목</h4>
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="text-left" style="width:14%">관</th>
                  <th class="text-left" style="width:16%">항</th>
                  <th class="text-left text-nowrap" style="width:18%">목</th>
                  <th style="width:10%">비목</th>
                  <th class="text-right" style="width:14%">예산액</th>
                  <th style="width:12%">비고</th>
                  <th class="text-center" style="width:8%">관리</th>
                </tr>
              </thead>
              <tbody>
                ${renderGroupedRows(incomeItems, 'income')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <h4 class="card-title" style="color:var(--danger);">📤 지출 항목</h4>
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="text-left" style="width:14%">관</th>
                  <th class="text-left" style="width:16%">항</th>
                  <th class="text-left text-nowrap" style="width:18%">목</th>
                  <th style="width:10%">비목</th>
                  <th class="text-right" style="width:14%">예산액</th>
                  <th style="width:12%">비고</th>
                  <th class="text-center" style="width:8%">관리</th>
                </tr>
              </thead>
              <tbody>
                ${renderGroupedRows(expenseItems, 'expense')}
              </tbody>
            </table>
          </div>
        </div>
      `}

      ${renderAddModal()}
      ${renderTransferModal()}

      ${totalIncome !== totalExpense ? `
        <div class="alert-bar">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <span>현재 과제 예산의 수입(${helpers.formatCurrencyRaw(totalIncome)}원)과 지출합계(${helpers.formatCurrencyRaw(totalExpense)}원)가 일치하지 않습니다.</span>
        </div>
      ` : ''}
    `;
  }

  function renderGroupedRows(items, type) {
    if (!items.length) return `<tr><td colspan="7" class="empty-cell">등록된 항목이 없습니다.</td></tr>`;
    const sections = BUDGET_STRUCTURE[type].sections;
    let html = '';
    sections.forEach(sec => {
      sec.categories.forEach(cat => {
        cat.items.forEach(itemDef => {
          const matching = items.filter(b => b.itemCode === itemDef.code);
          matching.forEach(b => {
            html += `<tr>
                          <td data-label="관" class="text-left"><span class="badge badge-accent">${sec.name}</span></td>
                          <td data-label="항" class="text-left">${cat.name}</td>
                          <td data-label="목" class="text-left text-nowrap"><strong>${itemDef.name}</strong></td>
                          <td data-label="비목"><span class="badge" style="background: rgba(0,0,0,0.05); color: #666; border: none;">${b.expenseCategory || '-'}</span></td>
                          <td data-label="예산액" class="text-right ${type === 'income' ? 'text-success' : 'text-danger'}">
                            <strong>${helpers.formatCurrencyRaw(b.amount)}</strong>
                          </td>
                          <td data-label="비고" class="text-sm">${b.note || '-'}</td>
                          <td data-label="관리" class="text-center">
                            <button class="btn-icon" onclick="ProjectBudgetModule.openEditModal('${b.id}')">✏️</button>
                            <button class="btn-icon" onclick="ProjectBudgetModule.deleteItem('${b.id}')">🗑️</button>
                          </td>
                        </tr>`;
          });
        });
      });
    });
    return html;
  }

  function renderAddModal() {
    return `
      <div class="modal-overlay" id="pb-modal">
        <div class="modal" style="max-width:560px;">
          <div class="modal-header">
            <h3 id="pb-modal-title">과제 예산 항목 추가</h3>
            <button class="modal-close" onclick="helpers.closeModal('pb-modal')">×</button>
          </div>
          <div class="modal-body">
            <div id="pb-budget-info-card" class="info-card" style="margin-bottom: 20px; padding: 16px; border-radius: 12px; background: var(--bg-base); border: 1px solid var(--border);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">과제 총예산 잔액</span>
                <span id="pb-modal-balance" style="font-size: 16px; font-weight: 800; color: var(--accent);">0원</span>
              </div>
            </div>
            <input type="hidden" id="pb-id">
            <div class="form-grid">
              <div class="form-group">
                <label>유형</label>
                <select id="pb-type" class="form-control" onchange="ProjectBudgetModule.onTypeChange()">
                  <option value="income">수입</option>
                  <option value="expense">지출</option>
                </select>
              </div>
              <div class="form-group">
                <label>관</label>
                <select id="pb-section" class="form-control" onchange="ProjectBudgetModule.onSectionChange()"><option value="">-- 선택 --</option></select>
              </div>
              <div class="form-group">
                <label>항</label>
                <select id="pb-category" class="form-control" onchange="ProjectBudgetModule.onCategoryChange()"><option value="">-- 선택 --</option></select>
              </div>
              <div class="form-group">
                <label>목</label>
                <select id="pb-item" class="form-control"><option value="">-- 선택 --</option></select>
              </div>
              <div class="form-group">
                <label>비목 (Expense Category)</label>
                <select id="pb-expense-category" class="form-control">
                  <option value="">-- 선택 --</option>
                </select>
              </div>
              <div class="form-group">
                <label>예산액 (원)</label>
                <input type="text" id="pb-amount" class="form-control" placeholder="0" oninput="helpers.handleAmountInput(this)">
              </div>
              <div class="form-group full">
                <label>비고</label>
                <input type="text" id="pb-note" class="form-control">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="helpers.closeModal('pb-modal')">취소</button>
            <button class="btn btn-primary" onclick="ProjectBudgetModule.saveItem()">저장</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderTransferModal() {
    return `
      <div class="modal-overlay" id="pb-transfer-modal">
        <div class="modal" style="max-width:520px;">
          <div class="modal-header">
            <h3>🔄 과제 예산 전용</h3>
            <button class="modal-close" onclick="helpers.closeModal('pb-transfer-modal')">×</button>
          </div>
          <div class="modal-body">
             <div class="form-grid">
                <div class="form-group"><label>전출(감소)</label><select id="pb-tf-from" class="form-control"></select></div>
                <div class="form-group"><label>전입(증가)</label><select id="pb-tf-to" class="form-control"></select></div>
                <div class="form-group"><label>금액</label><input type="text" id="pb-tf-amount" class="form-control" oninput="helpers.handleAmountInput(this)"></div>
             </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="helpers.closeModal('pb-transfer-modal')">취소</button>
            <button class="btn btn-primary" onclick="ProjectBudgetModule.executeTransfer()">실행</button>
          </div>
        </div>
      </div>
    `;
  }

  function updateModalBalance() {
    const type = document.getElementById('pb-type').value;
    const editId = document.getElementById('pb-id').value || null;
    const project = db.getProjectById(_selectedProjectId);
    const balanceEl = document.getElementById('pb-modal-balance');
    if (!project || !project.totalBudget || !balanceEl) return;

    const allItems = db.getProjectBudgetItems(_selectedProjectId).filter(b => (b.year || 2026) === _selectedYear && b.type === type);
    const currentTotal = allItems
      .filter(b => b.id !== editId)
      .reduce((s, b) => s + (b.amount || 0), 0);

    const remaining = project.totalBudget - currentTotal;
    balanceEl.textContent = `${helpers.formatCurrencyRaw(remaining)}원`;
    balanceEl.style.color = remaining < 0 ? 'var(--danger)' : 'var(--accent)';
  }

  function onTypeChange() {
    updateModalBalance();
    const type = document.getElementById('pb-type').value;
    const struct = BUDGET_STRUCTURE[type];
    document.getElementById('pb-section').innerHTML = `<option value="">-- 선택 --</option>` +
      struct.sections.map((s, i) => `<option value="${i}">${s.name}</option>`).join('');
    document.getElementById('pb-category').innerHTML = `<option value="">-- 선택 --</option>`;
    document.getElementById('pb-item').innerHTML = `<option value="">-- 선택 --</option>`;
  }

  function onSectionChange() {
    const type = document.getElementById('pb-type').value;
    const sIdx = document.getElementById('pb-section').value;
    if (sIdx === '') return;
    const cats = BUDGET_STRUCTURE[type].sections[sIdx].categories;
    document.getElementById('pb-category').innerHTML = `<option value="">-- 선택 --</option>` +
      cats.map((c, i) => `<option value="${i}">${c.name}</option>`).join('');
  }

  function onCategoryChange() {
    const type = document.getElementById('pb-type').value;
    const sIdx = document.getElementById('pb-section').value;
    const cIdx = document.getElementById('pb-category').value;
    if (sIdx === '' || cIdx === '') return;
    const items = BUDGET_STRUCTURE[type].sections[sIdx].categories[cIdx].items;
    document.getElementById('pb-item').innerHTML = `<option value="">-- 선택 --</option>` +
      items.map(i => `<option value="${i.code}">${i.name}</option>`).join('');
  }

  function openAddModal() {
    helpers.openModal('pb-modal');
    document.getElementById('pb-id').value = '';
    document.getElementById('pb-amount').value = '';
    document.getElementById('pb-note').value = '';
    document.getElementById('pb-modal-title').textContent = '과제 예산 항목 추가';
    onTypeChange();
    _refreshExpenseCategoryOptions();
  }

  function openEditModal(id) {
    const item = db.getProjectBudgetItems(_selectedProjectId).find(b => b.id === id);
    if (!item) return;
    openAddModal();
    document.getElementById('pb-modal-title').textContent = '과제 예산 항목 수정';
    document.getElementById('pb-id').value = item.id;
    document.getElementById('pb-type').value = item.type;
    // 관-항-목 역매핑
    const struct = BUDGET_STRUCTURE[item.type];
    for (let sIdx = 0; sIdx < struct.sections.length; sIdx++) {
      const sec = struct.sections[sIdx];
      for (let cIdx = 0; cIdx < sec.categories.length; cIdx++) {
        const cat = sec.categories[cIdx];
        if (cat.items.some(i => i.code === item.itemCode)) {
          // 관(section) 드롭다운 채우기
          document.getElementById('pb-section').innerHTML = `<option value="">­­ 선택 --</option>` +
            struct.sections.map((s, i) => `<option value="${i}">${s.name}</option>`).join('');
          document.getElementById('pb-section').value = sIdx;
          // 항(category) 드롭다운 채우기
          document.getElementById('pb-category').innerHTML = `<option value="">­­ 선택 --</option>` +
            sec.categories.map((c, i) => `<option value="${i}">${c.name}</option>`).join('');
          document.getElementById('pb-category').value = cIdx;
          // 목(item) 드롭다운 채우기
          document.getElementById('pb-item').innerHTML = `<option value="">­­ 선택 --</option>` +
            cat.items.map(i => `<option value="${i.code}">${i.name}</option>`).join('');
          document.getElementById('pb-item').value = item.itemCode;
          break;
        }
      }
    }
    _refreshExpenseCategoryOptions(item.expenseCategory || '');
    document.getElementById('pb-amount').value = item.amount;
    document.getElementById('pb-note').value = item.note || '';
  }

  // 선택된 과제의 비목 목록으로 드롤다운 갱신
  function _refreshExpenseCategoryOptions(selectedValue) {
    const project = db.getProjectById(_selectedProjectId);
    const cats = (project && Array.isArray(project.categories) && project.categories.length > 0)
      ? project.categories
      : EXPENSE_CATEGORIES;
    const sel = document.getElementById('pb-expense-category');
    if (!sel) return;
    sel.innerHTML = `<option value="">&ndash;과제 비목 선택&ndash;</option>` +
      cats.map(c => `<option value="${c}">${c}</option>`).join('');
    if (selectedValue) sel.value = selectedValue;
  }

  function saveItem() {
    const itemCode = document.getElementById('pb-item').value;
    const amount = helpers.parseAmount(document.getElementById('pb-amount').value);
    if (!itemCode || isNaN(amount) || amount <= 0) { helpers.showToast('필수 항목을 확인해 주세요.', 'error'); return; }

    const editId = document.getElementById('pb-id').value || null;

    // 과제 총예산 초과 방지
    const project = db.getProjectById(_selectedProjectId);
    if (project && project.totalBudget) {
      const type = document.getElementById('pb-type').value;
      const allItems = db.getProjectBudgetItems(_selectedProjectId).filter(b => (b.year || 2026) === _selectedYear && b.type === type);
      const currentTotal = allItems
        .filter(b => b.id !== editId) // 수정 중인 항목은 제외
        .reduce((s, b) => s + (b.amount || 0), 0);
      if (currentTotal + amount > project.totalBudget) {
        const remaining = project.totalBudget - currentTotal;
        const typeLabel = type === 'income' ? '수입' : '지출';
        helpers.showToast(`과제 총예산(${helpers.formatCurrencyRaw(project.totalBudget)}원)을 초과합니다!\n${typeLabel} 입력 가능 잔액: ${helpers.formatCurrencyRaw(remaining)}원`, 'error');
        return;
      }
    }

    const it = {
      id: editId,
      projectId: _selectedProjectId,
      year: _selectedYear,
      type: document.getElementById('pb-type').value,
      itemCode,
      expenseCategory: document.getElementById('pb-expense-category').value,
      amount,
      note: document.getElementById('pb-note').value
    };
    db.saveProjectBudgetItem(it);
    helpers.closeModal('pb-modal');
    helpers.showToast('저장되었습니다.');
    render();
  }

  function deleteItem(id) {
    if (confirm('삭제하시겠습니까?')) {
      db.deleteProjectBudgetItem(id);
      render();
    }
  }

  function changeProject(id) { _selectedProjectId = id; render(); }
  function changeYear(y) {
    _selectedYear = parseInt(y);
    const projects = db.getProjects().filter(p => helpers.isProjectInFiscalYear(p, _selectedYear));
    if (projects.length > 0) {
      const currentExists = projects.some(p => p.id === _selectedProjectId);
      if (!currentExists) {
        _selectedProjectId = projects[0].id;
      }
    } else {
      _selectedProjectId = '';
    }
    render();
  }
  function openTransferModal() {
    const items = db.getProjectBudgetItems(_selectedProjectId).filter(b => b.year === _selectedYear);
    const options = items.map(b => `<option value="${b.id}">[${b.type}] ${b.itemCode} ${b.expenseCategory ? `(${b.expenseCategory})` : ''} (${b.amount}원)</option>`).join('');
    document.getElementById('pb-tf-from').innerHTML = options;
    document.getElementById('pb-tf-to').innerHTML = options;
    helpers.openModal('pb-transfer-modal');
  }

  function executeTransfer() {
    const fromId = document.getElementById('pb-tf-from').value;
    const toId = document.getElementById('pb-tf-to').value;
    const amount = helpers.parseAmount(document.getElementById('pb-tf-amount').value);
    if (fromId === toId || isNaN(amount)) return;

    const items = db.getProjectBudgetItems(_selectedProjectId);
    const fromItem = items.find(i => i.id === fromId);
    const toItem = items.find(i => i.id === toId);

    if (fromItem.amount < amount) { helpers.showToast('잔액이 부족합니다.'); return; }

    fromItem.amount -= amount;
    toItem.amount += amount;
    db.saveProjectBudgetItem(fromItem);
    db.saveProjectBudgetItem(toItem);
    helpers.closeModal('pb-transfer-modal');
    render();
  }

  return { render, changeProject, changeYear, openAddModal, openEditModal, saveItem, deleteItem, onTypeChange, onSectionChange, onCategoryChange, openTransferModal, executeTransfer, BUDGET_STRUCTURE, EXPENSE_CATEGORIES };
})();

window.ProjectBudgetModule = ProjectBudgetModule;
