// modules/ledger.js - 장부 관리 (지출/수입 분리)

const LedgerModule = (() => {
  const { db } = window;
  const { helpers } = window;

  let currentFilter = { projectId: '', type: '', category: '', dateFrom: '', dateTo: '' };
  let _fixedType = ''; // 'expense' | 'income' | '' (전체)
  const BUDGET_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

  function render(fixedType) {
    _fixedType = fixedType || '';
    const projects = db.getProjects();

    const isExpense = _fixedType === 'expense';
    const isIncome = _fixedType === 'income';
    const pageTitle = isExpense ? '지출 장부' : isIncome ? '수입 장부' : '장부';
    const pageSubtitle = isExpense ? '과제별 지출 내역을 조회하고 관리합니다'
      : isIncome ? '과제별 수입 내역을 조회하고 관리합니다'
        : '과제별 수입·지출 내역을 조회하고 관리합니다';
    const addBtnLabel = isExpense ? '지출 입력' : isIncome ? '수입 입력' : '직접 입력';

    document.getElementById('app-content').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">${pageTitle}</h2>
          <p class="page-subtitle">${pageSubtitle}</p>
        </div>
        <button class="btn btn-primary ${isExpense ? 'btn-fab' : ''}" onclick="LedgerModule.openAddModal()">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          <span class="btn-label">${addBtnLabel}</span>
        </button>
      </div>

      <div class="filter-bar card">
        <div class="filter-row">
          <div class="form-group">
            <label>과제</label>
            <select id="f-project" class="form-control-sm" onchange="LedgerModule.applyFilter()">
              <option value="">전체 과제</option>
              ${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </div>
          ${!_fixedType ? `<div class="form-group">
            <label>유형</label>
            <select id="f-type" class="form-control-sm" onchange="LedgerModule.applyFilter()">
              <option value="">전체</option>
              <option value="income">입금</option>
              <option value="expense">출금</option>
            </select>
          </div>` : ''}
          <div class="form-group">
            <label>관-항-목</label>
            <input type="text" id="f-budget-text" class="form-control-sm" placeholder="목 명칭 검색..." oninput="LedgerModule.applyFilter()">
          </div>
          <div class="form-group">
            <label>시작일</label>
            <input type="date" id="f-from" class="form-control-sm" onchange="LedgerModule.applyFilter()">
          </div>
          <div class="form-group">
            <label>종료일</label>
            <input type="date" id="f-to" class="form-control-sm" onchange="LedgerModule.applyFilter()">
          </div>
          <button class="btn btn-ghost btn-sm" onclick="LedgerModule.resetFilter()">초기화</button>
        </div>
      </div>

      <div class="card" id="ledger-summary-bar"></div>

      <div class="card">
        <div class="table-wrapper">
          <table class="data-table ledger-table">
            <thead>
              <tr>
                <th style="width: 100px;">거래일</th>
                <th style="width: 180px;">과제명</th>
                <th style="width: 100px;">업무담당</th>
                <th style="width: auto;" class="text-left">적요</th>
                <th style="width: 120px;">회계거래유형</th>
                <th style="width: 130px;">비목</th>
                ${!_fixedType ? '<th style="width: 80px;">유형</th>' : ''}
                <th style="width: 120px;">금액</th>
                <th style="width: 100px;">관리</th>
              </tr>
            </thead>
            <tbody id="ledger-tbody"></tbody>
          </table>
        </div>
        <div id="ledger-pagination" class="pagination-wrap"></div>
      </div>

      ${renderAddModal(projects)}
    `;

    applyFilter();
  }

  function renderAddModal(projects) {
    const typeFixed = !!_fixedType;
    const defaultType = _fixedType || 'expense';
    return `
      <div class="modal-overlay" id="ledger-modal">
        <div class="modal">
          <div class="modal-header" style="display: flex; align-items: center; justify-content: space-between;">
            <h3 id="ledger-modal-title" style="margin-bottom: 0;">거래 직접 입력</h3>
            <select id="led-ac-type" class="form-control" style="width: auto; height: 32px; padding: 0 10px; font-size: 13px; border: 2px solid var(--royal-blue); background: white; border-radius: 6px; cursor: pointer;">
                <option value="normal">일반 거래</option>
                <option value="accrued">미수금 발생 (결산/수익확정)</option>
                <option value="collection">미수금 회수 (실제입금/수익제외)</option>
                <option value="unpaid_occ">미지급금 발생 (결산/비용확정)</option>
                <option value="unpaid_pay">미지급금 지급 (실제지불/비용제외)</option>
            </select>
          </div>
          <div class="modal-body">
            <input type="hidden" id="led-id">
            <input type="hidden" id="led-fixed-type" value="${_fixedType}">
            <div class="form-grid">
              <div class="form-group">
                <label>거래일 <span class="required">*</span></label>
                <input type="date" id="led-date" class="form-control" onchange="LedgerModule.onItemChange()">
              </div>
              <div class="form-group" ${typeFixed ? 'style="display:none"' : ''}>
                <label>유형 <span class="required">*</span></label>
                <select id="led-type" class="form-control" onchange="LedgerModule.updateAccountingTypeOptions()">
                  <option value="expense" ${defaultType === 'expense' ? 'selected' : ''}>출금 (지출)</option>
                  <option value="income" ${defaultType === 'income' ? 'selected' : ''}>입금 (수입)</option>
                </select>
              </div>
                <div class="form-group full">
                  <label>금액 (Amount) <span class="required">*</span></label>
                  <input type="text" id="led-amount" class="form-control" placeholder="0" oninput="helpers.handleAmountInput(this); LedgerModule.updateInfo()">
                </div>
              <div class="form-group">
                <label>회계연도 (Fiscal Year)</label>
                <select id="led-year-filter" class="form-control" onchange="LedgerModule.onLedgerYearChange()">
                  ${BUDGET_YEARS.map(y => `<option value="${y}">${y}년</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>과제 (Project) <span class="text-muted" style="font-weight: normal; font-size: 0.85em;">(선택 사항)</span></label>
                <select id="led-project" class="form-control" onchange="LedgerModule.onProjectChange()">
                  <option value="">-- 비사업(공통) 항목 --</option>
                  ${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
              </div>
              <div id="led-project-info" class="form-group full" style="background: rgba(16, 185, 129, 0.04); padding: 14px; border-radius: 10px; border: 1px solid rgba(16, 185, 129, 0.1); display: none; margin-top: -10px; margin-bottom: 10px;">
                <!-- 과제별 잔액 정보가 여기에 표시됨 -->
              </div>
              <div class="form-group full">
                <label>비목 (Expense Category)</label>
                <select id="led-category" class="form-control">
                  <option value="">-- 비목 선택 --</option>
                </select>
              </div>
              <div class="form-group">
                <label>관 (Section) <span class="required">*</span></label>
                <select id="led-section" class="form-control" onchange="LedgerModule.onSectionChange()">
                  <option value="">-- 관 선택 --</option>
                </select>
              </div>
              <div class="form-group">
                <label>항 (Category) <span class="required">*</span></label>
                <select id="led-category-select" class="form-control" onchange="LedgerModule.onCategoryChange()">
                  <option value="">-- 항 선택 --</option>
                </select>
              </div>
              <div class="form-group">
                <label>목 (Item) <span class="required">*</span></label>
                <select id="led-item" class="form-control" onchange="LedgerModule.onItemChange()">
                  <option value="">-- 목 (Item) 선택 --</option>
                </select>
              </div>
              <div id="led-item-info-card" class="info-card form-group full" style="margin-bottom: 20px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; display: none; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                <div style="background: linear-gradient(90deg, #1e3a8a, #3b82f6); padding: 8px 16px; color: white; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                  <i class="fa-solid fa-circle-info"></i> 해당 목 예산/집행 현황
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #e2e8f0; padding: 1px;">
                  <div style="background: white; padding: 12px 16px;">
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">해당 목 예산액</div>
                    <div id="led-info-budget" style="font-size: 14px; font-weight: 700; color: #1e293b;">0원</div>
                  </div>
                  <div style="background: white; padding: 12px 16px;">
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">현재 집행액</div>
                    <div id="led-info-actual" style="font-size: 14px; font-weight: 700; color: #ef4444;">0원</div>
                  </div>
                  <div style="background: white; padding: 12px 16px;">
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">집행 잔액</div>
                    <div id="led-info-balance" style="font-size: 14px; font-weight: 700; color: #10b981;">0원</div>
                  </div>
                </div>
              </div>
              <div class="form-group full">
                <label>적요 (내용)</label>
                <input type="text" id="led-desc" class="form-control" placeholder="거래 내용을 입력하세요">
              </div>
              <div class="form-group full">
                <label>비고</label>
                <input type="text" id="led-note" class="form-control" placeholder="추가 메모">
              </div>
            </div>

          </div>
          <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:10px;">
            <button class="btn btn-ghost" onclick="helpers.closeModal('ledger-modal')">취소</button>
            <button class="btn btn-primary" onclick="LedgerModule.saveEntry(true)" style="background: var(--royal-blue); border-color: var(--royal-blue);">💾 저장 후 지출결의서 작성</button>
            <button class="btn btn-primary" onclick="LedgerModule.saveEntry(false)">저장</button>
          </div>
        </div>
      </div>
    `;
  }

  let allFiltered = [];
  let page = 1;
  const PAGE_SIZE = 30;

  function applyFilter() {
    currentFilter = {
      projectId: document.getElementById('f-project')?.value || '',
      type: _fixedType || (document.getElementById('f-type')?.value || ''),
      budgetText: document.getElementById('f-budget-text')?.value || '',
      dateFrom: document.getElementById('f-from')?.value || '',
      dateTo: document.getElementById('f-to')?.value || '',
    };

    let entries = db.getLedger(currentFilter.projectId || null);
    if (currentFilter.type) entries = entries.filter(e => e.type === currentFilter.type);
    if (currentFilter.budgetText) {
      entries = entries.filter(e => (e.category || '').includes(currentFilter.budgetText));
    }
    if (currentFilter.dateFrom) entries = entries.filter(e => (e.transactionDate || '') >= currentFilter.dateFrom);
    if (currentFilter.dateTo) entries = entries.filter(e => (e.transactionDate || '') <= currentFilter.dateTo);

    entries.sort((a, b) => (b.transactionDate || '').localeCompare(a.transactionDate || ''));
    allFiltered = entries;
    page = 1;
    renderSummary(entries);
    renderPage();
  }

  function renderSummary(entries) {
    const income = entries.filter(e => e.type === 'income').reduce((s, e) => s + (e.amount || 0), 0);
    const expense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + (e.amount || 0), 0);
    const el = document.getElementById('ledger-summary-bar');
    if (!el) return;

    if (_fixedType === 'expense') {
      el.innerHTML = `
        <div class="summary-bar">
          <span class="summary-item">총 <strong>${entries.length}</strong>건</span>
          <span class="summary-item text-danger">총 지출 <strong>${helpers.formatCurrencyRaw(expense)}원</strong></span>
        </div>`;
    } else if (_fixedType === 'income') {
      el.innerHTML = `
        <div class="summary-bar">
          <span class="summary-item">총 <strong>${entries.length}</strong>건</span>
          <span class="summary-item text-success">총 수입 <strong>${helpers.formatCurrencyRaw(income)}원</strong></span>
        </div>`;
    } else {
      el.innerHTML = `
        <div class="summary-bar">
          <span class="summary-item">총 <strong>${entries.length}</strong>건</span>
          <span class="summary-item text-success">총 입금 <strong>${helpers.formatCurrencyRaw(income)}원</strong></span>
          <span class="summary-item text-danger">총 지출 <strong>${helpers.formatCurrencyRaw(expense)}원</strong></span>
          <span class="summary-item">차액 <strong>${helpers.formatCurrencyRaw(income - expense)}원</strong></span>
        </div>`;
    }
  }

  function getBudgetPath(itemCode, type) {
    if (!itemCode) return '';
    const struct = getBudgetStructure()[type || 'expense'];
    if (!struct) return '';

    for (const sec of struct.sections) {
      for (const cat of sec.categories) {
        const item = cat.items.find(i => i.code === itemCode);
        if (item) {
          return `<div class="budget-tag-box" style="text-align:left;">
            <span class="budget-tag-path" style="text-align:left; display:block;" title="${sec.name} > ${cat.name} > ${item.name}">
              [${sec.name} > ${cat.name} > ${item.name}]
            </span>
          </div>`;
        }
      }
    }
    return '';
  }

  function renderPage() {
    const projects = db.getProjects();
    const start = (page - 1) * PAGE_SIZE;
    const pageData = allFiltered.slice(start, start + PAGE_SIZE);
    const tbody = document.getElementById('ledger-tbody');
    if (!tbody) return;

    const colSpan = _fixedType ? 6 : 7;

    if (!pageData.length) {
      tbody.innerHTML = `<tr><td colspan="${colSpan}" class="empty-cell">조회된 내역이 없습니다.</td></tr>`;
    } else {
      tbody.innerHTML = pageData.map(e => {
        const proj = projects.find(p => p.id === e.projectId);
        const bItem = db.getBudgetItems().find(bi => bi.itemCode === e.itemCode);
        return `
          <tr>
            <td data-label="거래일">${e.transactionDate || '-'}</td>
            <td data-label="과제명">${proj ? proj.name : '<span class="badge badge-neutral">비사업성 항목</span>'}</td>
            <td data-label="업무담당">${proj ? (proj.staff || '-') : '-'}</td>
            <td data-label="적요" class="text-left" style="text-align:left !important;">
              ${getBudgetPath(e.itemCode, e.type)}
              <div class="ledger-desc" style="text-align:left;">${e.description || '-'}</div>
              ${e.note ? `<div class="ledger-note" style="text-align:left;">${e.note}</div>` : ''}
            </td>
            <td data-label="회계거래유형">
              ${renderAccountingTypeLabel(e.accountingType, e.type)}
            </td>
            <td data-label="비목">${e.category || (bItem ? bItem.name : '<span class="text-muted">미지정</span>')}</td>
            ${!_fixedType ? `<td data-label="유형" class="text-center">
              <span class="badge ${e.type === 'income' ? 'badge-success' : 'badge-danger'}">${e.type === 'income' ? '입금' : '출금'}</span>
            </td>` : ''}
            <td data-label="금액" class="text-right ${e.type === 'income' ? 'text-success' : 'text-danger'}">
              ${e.type === 'income' ? '+' : '-'}${helpers.formatCurrencyRaw(e.amount)}원
            </td>
            <td data-label="관리" class="text-center">
              <div class="action-btns">
                ${helpers.isEntryLocked(e.id) ? `
                  <span title="결의서 작성됨 (수정/삭제 불가)" style="cursor:help; font-size:16px;">🔒</span>
                ` : `
                  <button class="btn-icon btn-edit" onclick="LedgerModule.openEditModal('${e.id}')" title="수정">✏️</button>
                  <button class="btn-icon btn-delete" onclick="LedgerModule.deleteEntry('${e.id}')" title="삭제">🗑️</button>
                `}
                <button class="btn-icon" onclick="LedgerModule.openVoucher('${e.id}', '${e.type}')" title="결의서">📄</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    const totalPages = Math.ceil(allFiltered.length / PAGE_SIZE);
    const paginEl = document.getElementById('ledger-pagination');
    if (paginEl) {
      paginEl.innerHTML = totalPages > 1 ? `
        <button class="btn btn-ghost btn-sm" ${page <= 1 ? 'disabled' : ''} onclick="LedgerModule.goPage(${page - 1})">◀ 이전</button>
        <span class="page-info">${page} / ${totalPages}</span>
        <button class="btn btn-ghost btn-sm" ${page >= totalPages ? 'disabled' : ''} onclick="LedgerModule.goPage(${page + 1})">다음 ▶</button>
      ` : '';
    }
  }

  function goPage(p) { page = p; renderPage(); }
  function resetFilter() {
    ['f-project', 'f-type', 'f-budget-text', 'f-from', 'f-to'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    applyFilter();
  }

  const getBudgetStructure = () => (window.BudgetModule && window.BudgetModule.BUDGET_STRUCTURE) || {};

  function onSectionChange() {
    const type = document.getElementById('led-type').value || _fixedType || 'expense';
    const secIdx = document.getElementById('led-section').value;
    const catSelect = document.getElementById('led-category-select');
    const itemSelect = document.getElementById('led-item');

    if (secIdx === '') {
      catSelect.innerHTML = `<option value="">-- 항 선택 --</option>`;
      itemSelect.innerHTML = `<option value="">-- 목 선택 --</option>`;
      return;
    }

    const struct = getBudgetStructure()[type];
    const sections = struct?.sections || [];
    if (!sections[secIdx]) return;

    const categories = sections[secIdx].categories || [];
    catSelect.innerHTML = `<option value="">-- 항 선택 --</option>` +
      categories.map((c, idx) => `<option value="${idx}">${c.name}</option>`).join('');
    itemSelect.innerHTML = `<option value="">-- 목 선택 --</option>`;
    document.getElementById('led-item-info-card').style.display = 'none';
  }

  function onCategoryChange() {
    const type = document.getElementById('led-type').value || _fixedType || 'expense';
    const secIdx = document.getElementById('led-section').value;
    const catIdx = document.getElementById('led-category-select').value;
    const itemSelect = document.getElementById('led-item');

    if (secIdx === '' || catIdx === '') {
      itemSelect.innerHTML = `<option value="">-- 목 선택 --</option>`;
      return;
    }

    const struct = getBudgetStructure()[type];
    const sections = struct?.sections || [];
    if (!sections[secIdx] || !sections[secIdx].categories[catIdx]) return;

    const items = sections[secIdx].categories[catIdx].items || [];
    itemSelect.innerHTML = `<option value="">-- 목 (Item) 선택 --</option>` +
      items.map(i => `<option value="${i.code}">${i.name}</option>`).join('');
    document.getElementById('led-item-info-card').style.display = 'none';
  }

  function onItemChange() {
    const itemCode = document.getElementById('led-item').value;
    const dateVal = document.getElementById('led-date').value;
    const cardEl = document.getElementById('led-item-info-card');
    const budgetEl = document.getElementById('led-info-budget');
    const balanceEl = document.getElementById('led-info-balance');

    if (!itemCode || !dateVal) {
      cardEl.style.display = 'none';
      return;
    }

    const year = new Date(dateVal).getFullYear();
    const budgetItems = db.getBudgetItems();
    const bItem = budgetItems.find(b => b.itemCode === itemCode && (b.year || 2026) === year);

    if (!bItem) {
      cardEl.style.display = 'block';
      budgetEl.textContent = '정보 없음';
      balanceEl.textContent = '정보 없음';
      return;
    }

    const ledger = db.getLedger();
    const currentId = document.getElementById('led-id').value;
    const inputAmount = helpers.parseAmount(document.getElementById('led-amount').value) || 0;

    const actual = ledger
      .filter(e => e.itemCode === itemCode && e.id !== currentId && new Date(e.transactionDate).getFullYear() === year)
      .reduce((s, e) => s + (e.amount || 0), 0);

    const totalWithInput = actual + inputAmount;
    const balance = bItem.amount - totalWithInput;

    cardEl.style.display = 'block';
    budgetEl.textContent = `${helpers.formatCurrencyRaw(bItem.amount)}원`;
    document.getElementById('led-info-actual').textContent = `${helpers.formatCurrencyRaw(totalWithInput)}원`;
    balanceEl.textContent = `${helpers.formatCurrencyRaw(balance)}원`;
    balanceEl.style.color = balance < 0 ? '#ef4444' : '#10b981';
  }

  function onProjectChange() {
    const projectId = document.getElementById('led-project').value;
    const dateVal = document.getElementById('led-date').value;
    const infoEl = document.getElementById('led-project-info');

    if (!projectId || !dateVal) {
      infoEl.style.display = 'none';
      return;
    }

    const year = new Date(dateVal).getFullYear();
    const project = db.getProjectById(projectId);
    if (!project) {
      infoEl.style.display = 'none';
      return;
    }
    const ledger = db.getLedger(projectId);
    const currentId = document.getElementById('led-id').value;
    const inputAmount = helpers.parseAmount(document.getElementById('led-amount').value) || 0;

    const actual = ledger
      .filter(e => e.id !== currentId && new Date(e.transactionDate).getFullYear() === year)
      .reduce((s, e) => s + (e.amount || 0), 0);

    const budget = project.totalBudget || 0;
    const totalWithInput = actual + inputAmount;
    const balance = budget - totalWithInput;

    infoEl.style.display = 'block';

    // 비목 목록 갱신
    updateCategoryOptions(projectId);

    infoEl.innerHTML = `
      <div style="display: flex; flex-direction: column; overflow: hidden; border-radius: 10px; border: 1px solid #e2e8f0; background: #fff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
        <div style="background: linear-gradient(90deg, #065f46, #10b981); padding: 8px 16px; color: white; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-microchip"></i> ${year}년 과제 집행 현황
          </div>
          <span style="opacity: 0.9; font-weight: 400;">${project.name}</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #e2e8f0; padding: 1px;">
          <div style="background: white; padding: 12px 16px;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">과제 총 예산</div>
            <div style="font-size: 14px; font-weight: 700; color: #1e293b;">${helpers.formatCurrencyRaw(budget)}원</div>
          </div>
          <div style="background: white; padding: 12px 16px;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">기집행 + 예정액</div>
            <div style="font-size: 14px; font-weight: 700; color: #ef4444;">${helpers.formatCurrencyRaw(totalWithInput)}원</div>
          </div>
          <div style="background: white; padding: 12px 16px;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">과제 잔액</div>
            <div style="font-size: 14px; font-weight: 700; color: ${balance < 0 ? '#ef4444' : '#10b981'};">${helpers.formatCurrencyRaw(balance)}원</div>
          </div>
        </div>
      </div>
    `;
  }

  function openAddModal() {
    helpers.openModal('ledger-modal');
    const isExpense = _fixedType === 'expense';
    const isIncome = _fixedType === 'income';
    const title = isExpense ? '지출 입력' : isIncome ? '수입 입력' : '거래 직접 입력';
    document.getElementById('ledger-modal-title').textContent = title;
    document.getElementById('led-id').value = '';
    document.getElementById('led-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('led-type').value = _fixedType || 'expense';
    document.getElementById('led-amount').value = '';
    document.getElementById('led-project').value = '';
    document.getElementById('led-desc').value = '';
    document.getElementById('led-note').value = '';
    document.getElementById('led-project-info').style.display = 'none';

    // 비목 초기화
    updateCategoryOptions('');

    // 관 목록 초기화
    const type = _fixedType || 'expense';
    const struct = getBudgetStructure()[type];
    const sections = struct?.sections || [];
    document.getElementById('led-section').innerHTML = `<option value="">-- 관 선택 --</option>` +
      sections.map((s, idx) => `<option value="${idx}">${s.name}</option>`).join('');
    document.getElementById('led-category-select').innerHTML = `<option value="">-- 항 선택 --</option>`;
    document.getElementById('led-item').innerHTML = `<option value="">-- 목 (Item) 선택 --</option>`;
    document.getElementById('led-item-info-card').style.display = 'none';

    // 회계거래유형 옵션 업데이트
    updateAccountingTypeOptions();

    // 연도 필터 초기화 (기본 2026년 또는 현재 연도)
    const currentYear = new Date().getFullYear();
    const defaultYear = BUDGET_YEARS.includes(currentYear) ? currentYear : 2026;
    const yearSelect = document.getElementById('led-year-filter');
    if (yearSelect) {
      yearSelect.value = defaultYear;
      onLedgerYearChange();
    }
  }

  function onLedgerYearChange() {
    const year = parseInt(document.getElementById('led-year-filter').value);
    updateProjectOptionsByYear(year);
  }

  function updateProjectOptionsByYear(year) {
    const allProjects = db.getProjects();
    const filtered = allProjects.filter(p => helpers.isProjectInFiscalYear(p, year));
    const projectSelect = document.getElementById('led-project');
    const currentId = projectSelect.value;

    projectSelect.innerHTML = `<option value="">-- 비사업(공통) 항목 --</option>` +
      filtered.map(p => `<option value="${p.id}" ${p.id === currentId ? 'selected' : ''}>${p.name}</option>`).join('');

    onProjectChange();
  }

  function openEditModal(id) {
    try {
      const e = db.getLedger().find(l => l.id === id);
      if (!e) return;

      // 1. 모달 열기 및 기본 필드 설정
      helpers.openModal('ledger-modal');
      document.getElementById('ledger-modal-title').textContent = '거래 수정';
      document.getElementById('led-id').value = e.id;
      document.getElementById('led-date').value = e.transactionDate;
      document.getElementById('led-desc').value = e.description || '';
      document.getElementById('led-amount').value = helpers.formatCurrencyRaw(e.amount);
      document.getElementById('led-note').value = e.note || '';

      // 회계거래 유형 (Accounting Type) 설정
      const acTypeSelect = document.getElementById('led-ac-type');
      if (acTypeSelect) {
        acTypeSelect.value = e.accountingType || 'normal';
      }

      // 2. 유형 설정 (입금/출금)
      if (document.getElementById('led-type')) {
        document.getElementById('led-type').value = e.type || 'expense';
      }

      // 3. 회계연도 및 과제 설정
      // 과제 시작일이 있으면 그 연도를, 없으면 거래일의 연도를 회계연도로 우선 설정
      let pYear = 2026;
      const projData = db.getProjectById(e.projectId);
      if (projData && projData.startDate) {
        pYear = helpers.getFiscalYear(projData.startDate);
      } else if (e.transactionDate) {
        pYear = new Date(e.transactionDate).getFullYear();
      }

      const yearFilter = document.getElementById('led-year-filter');
      if (yearFilter) {
        yearFilter.value = pYear;
        updateProjectOptionsByYear(pYear); // 해당 연도의 프로젝트 목록으로 갱신
      }

      const projectSelect = document.getElementById('led-project');
      projectSelect.value = e.projectId || '';

      // 비목(Expense Category) 옵션 갱신 및 값 설정
      updateCategoryOptions(e.projectId || '');
      document.getElementById('led-category').value = e.category || '';

      // 4. 관/항/목 구조 순차적 로드
      const struct = getBudgetStructure()[e.type || 'expense'];
      const sections = struct?.sections || [];

      // 관(Section) 로드
      const secSelect = document.getElementById('led-section');
      secSelect.innerHTML = `<option value="">-- 관 선택 --</option>` +
        sections.map((s, idx) => `<option value="${idx}">${s.name}</option>`).join('');

      // 값이 있다면 관 선택 및 항 로드
      if (e.itemCode) {
        // itemCode를 통해 관/항을 역추적
        let foundSecIdx = -1;
        let foundCatIdx = -1;

        for (let si = 0; si < sections.length; si++) {
          const cats = sections[si].categories || [];
          for (let ci = 0; ci < cats.length; ci++) {
            const items = cats[ci].items || [];
            if (items.some(it => it.code === e.itemCode)) {
              foundSecIdx = si;
              foundCatIdx = ci;
              break;
            }
          }
          if (foundSecIdx !== -1) break;
        }

        if (foundSecIdx !== -1) {
          secSelect.value = foundSecIdx;

          // 항(Category) 로드
          const catSelect = document.getElementById('led-category-select');
          const categories = sections[foundSecIdx].categories || [];
          catSelect.innerHTML = `<option value="">-- 항 선택 --</option>` +
            categories.map((c, idx) => `<option value="${idx}">${c.name}</option>`).join('');

          catSelect.value = foundCatIdx;

          // 목(Item) 로드
          const itemSelect = document.getElementById('led-item');
          const items = categories[foundCatIdx].items || [];
          itemSelect.innerHTML = `<option value="">-- 목 (Item) 선택 --</option>` +
            items.map(i => `<option value="${i.code}">${i.name}</option>`).join('');

          itemSelect.value = e.itemCode;
          onItemChange(); // 예산 정보 카드 업데이트
        }
      }

      // 과제 정보 카드 업데이트
      onProjectChange();

    } catch (err) {
      console.error('Error in openEditModal:', err);
      helpers.showToast('데이터를 불러오는 중 오류가 발생했습니다.', 'error');
    }
  }

  function updateCategoryOptions(projectId) {
    const proj = db.getProjectById(projectId);
    // 과제에 비목이 설정되어 있으면 그것만, 없으면 기본 목록 사용
    const cats = (proj && Array.isArray(proj.categories) && proj.categories.length > 0)
      ? proj.categories
      : helpers.DEFAULT_CATEGORIES;
    // 가나다순 정렬
    const sortedCats = [...cats].sort((a, b) => a.localeCompare(b, 'ko'));
    const select = document.getElementById('led-category');
    if (!select) return;
    const prev = select.value;
    select.innerHTML = `<option value="">-- 비목 선택 --</option>` +
      sortedCats.map(c => `<option value="${c}" ${c === prev ? 'selected' : ''}>${c}</option>`).join('');
  }

  function saveEntry(andOpenVoucher = false) {
    const date = document.getElementById('led-date').value;
    const amount = helpers.parseAmount(document.getElementById('led-amount').value);
    const projectId = document.getElementById('led-project').value || null;
    const itemCode = document.getElementById('led-item').value;
    const description = document.getElementById('led-desc').value;
    const note = document.getElementById('led-note').value;
    const entryId = document.getElementById('led-id').value || null;

    if (!date || isNaN(amount) || !itemCode) {
      helpers.showToast('필수 항목을 모두 입력해주세요.', 'error');
      return;
    }

    // 수정 시 잠금 체크
    if (entryId && helpers.isEntryLocked(entryId)) {
      helpers.showToast('이미 지출결의서가 생성된 내역은 수정할 수 없습니다.', 'error');
      return;
    }

    const type = _fixedType || document.getElementById('led-type').value;
    const year = new Date(date).getFullYear();

    // 전체 예산 기준 초과 체크 (지출일 경우)
    if (type === 'expense') {
      const bItems = db.getBudgetItems().filter(b => b.itemCode === itemCode && (b.year || 2026) === year);
      const budgetAmount = bItems.reduce((sum, b) => sum + (b.amount || 0), 0);
      const actualAmount = db.getLedger()
        .filter(e => e.itemCode === itemCode && e.id !== entryId && new Date(e.transactionDate).getFullYear() === year)
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      if (actualAmount + amount > budgetAmount) {
        if (!confirm(`예산이 부족합니다! (현재잔액: ${helpers.formatCurrencyRaw(budgetAmount - actualAmount)}원)\n계속 진행하시겠습니까?`)) {
          return;
        }
      }
    }

    const entry = {
      id: entryId,
      type,
      transactionDate: date,
      amount,
      projectId: projectId || null,
      itemCode,
      category: document.getElementById('led-category').value,
      description,
      note,
      accountingType: document.getElementById('led-ac-type').value
    };

    // [v13] 부가세 자동 분리 로직 (AccountingLogic 연동)
    if (type === 'expense' && window.AccountingLogic?.shouldSplitVat(itemCode)) {
      const vatAmount = Math.floor(amount / 11);
      const supplyAmount = amount - vatAmount;

      entry.amount = supplyAmount;
      entry.note = (entry.note ? entry.note + ' ' : '') + `[부가세분산: 원금액 ${helpers.formatCurrencyRaw(amount)}]`;

      const vatEntry = {
        type: 'expense',
        transactionDate: date,
        amount: vatAmount,
        projectId: projectId || null,
        itemCode: 'E-1-5-03', // 부가세대급금 공식 항목 코드
        category: '부가세',
        description: `[부가세] ${description}`,
        note: `원거래 ID: ${entry.id || 'new'}`,
        accountingType: entry.accountingType, // [v16] 원본 거래의 회계처리 유형 상속 (미지급금 등 연동)
        isVatEntry: true
      };
      db.saveLedgerEntry(vatEntry);
      helpers.showToast(`부가세 ${helpers.formatCurrencyRaw(vatAmount)}원이 자동 분리되었습니다.`, 'info');
    }

    const savedEntry = db.saveLedgerEntry(entry);
    const savedId = savedEntry.id;

    // 자동 자산 등록 로직 (30만 원 이상의 장비비)
    if (type === 'expense' && amount >= 300000 && (entry.category === '장비비')) {
      db.saveAsset({
        name: description || '신규 자산',
        acquisitionDate: date,
        acquisitionCost: amount,
        projectId: projectId,
        ledgerId: savedId,
        status: '정상'
      });
      helpers.showToast('30만 원 이상 장비비가 입력되어 자산으로 자동 등록되었습니다.', 'info');
    }

    helpers.closeModal('ledger-modal');
    helpers.showToast('거래 내역이 저장되었습니다.');
    applyFilter();

    if (andOpenVoucher) {
      setTimeout(() => {
        openVoucher(savedId, type);
      }, 300);
    }
  }

  function deleteEntry(id) {
    if (helpers.isEntryLocked(id)) {
      helpers.showToast('이미 지출결의서가 생성된 내역은 삭제할 수 없습니다.', 'error');
      return;
    }
    if (!confirm('이 거래 내역을 삭제하시겠습니까?')) return;
    db.deleteLedgerEntry(id);
    helpers.showToast('삭제되었습니다.', 'info');
    applyFilter();
  }

  function openVoucher(id, type) {
    window.App && window.App.navigate('voucher');
    setTimeout(() => {
        if (typeof VoucherModule !== 'undefined' && VoucherModule.openNewVoucher) {
            VoucherModule.openNewVoucher(type, id);
        }
    }, 200);
  }

  function updateInfo() {
    onItemChange();
    onProjectChange();
  }

  function renderAccountingTypeLabel(type, ledType) {
    const labels = {
      'accrued': '<span class="badge" style="background:#eff6ff; color:#1e40af; border:1px solid #dbeafe;">미수금 발생</span>',
      'collection': '<span class="badge" style="background:#f0fdf4; color:#166534; border:1px solid #dcfce7;">미수금 회수</span>',
      'unpaid_occ': '<span class="badge" style="background:#fff7ed; color:#9a3412; border:1px solid #ffedd5;">미지급금 발생</span>',
      'unpaid_pay': '<span class="badge" style="background:#fef2f2; color:#991b1b; border:1px solid #fee2e2;">미지급금 지급</span>',
      'normal': '<span class="badge badge-neutral">일반거래</span>'
    };
    return labels[type] || labels['normal'];
  }

  function updateAccountingTypeOptions() {
    const type = document.getElementById('led-type').value;
    const acSelect = document.getElementById('led-ac-type');
    if (!acSelect) return;

    let options = '<option value="normal">일반 거래</option>';
    if (type === 'income') {
      options += `
        <option value="accrued">미수금 발생 (결산/수익확정)</option>
        <option value="collection">미수금 회수 (실제입금/수익제외)</option>
      `;
    } else { // expense
      options += `
        <option value="unpaid_occ">미지급금 발생 (결산/비용확정)</option>
        <option value="unpaid_pay">미지급금 지급 (실제지불/비용제외)</option>
      `;
    }
    const currentVal = acSelect.value;
    acSelect.innerHTML = options;

    // 이전에 선택된 값이 새로운 옵션에도 있으면 유지, 없으면 일반거래로
    const hasValue = Array.from(acSelect.options).some(opt => opt.value === currentVal);
    if (hasValue) acSelect.value = currentVal;
    else acSelect.value = 'normal';

    // UI 업데이트 (수동 호출 시에만 필요한 로직을 분리하거나 조심스럽게 처리)
    // 장부 입력창이 열려있을 때만 비목 정보 갱신
    if (document.getElementById('ledger-modal').classList.contains('active')) {
      onSectionChange();
    }
  }

  return {
    render,
    openAddModal,
    openEditModal,
    saveEntry,
    deleteEntry,
    applyFilter,
    resetFilter,
    onSectionChange,
    onCategoryChange,
    onItemChange,
    updateInfo,
    onProjectChange,
    updateAccountingTypeOptions,
    onLedgerYearChange,
    goPage, // Added goPage to the returned object
    openVoucher // Added openVoucher to the returned object
  };
})();

window.LedgerModule = LedgerModule;
