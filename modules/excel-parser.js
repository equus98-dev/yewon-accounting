// modules/excel-parser.js - 은행 엑셀 업로드/파싱 엔진

const ExcelParserModule = (() => {
  const { db } = window;
  const { helpers } = window;

  let parsedRows = [];
  let currentConfig = null;
  let uploadMode = 'excel'; // 'excel' or 'api'

  function render() {
    const configs = db.getBankConfigs();
    const projects = db.getProjects();

    document.getElementById('app-content').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">은행거래내역 관리</h2>
          <p class="page-subtitle">은행 거래내역을 엑셀로 업로드하거나 실시간 API로 가져와 장부에 등록합니다</p>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-secondary" onclick="ExcelParserModule.openConfigModal()">
            ⚙️ 은행 설정 관리
          </button>
        </div>
      </div>

      <div class="card" style="margin-bottom: 24px; padding: 5px;">
        <div class="tab-buttons" style="display:flex; gap:5px;">
          <button class="btn ${uploadMode === 'excel' ? 'btn-primary' : 'btn-ghost'}" onclick="ExcelParserModule.switchMode('excel')" style="flex:1">
            <i class="fa-solid fa-file-excel"></i> 엑셀 파일 업로드
          </button>
          <button class="btn ${uploadMode === 'api' ? 'btn-primary' : 'btn-ghost'}" onclick="ExcelParserModule.switchMode('api')" style="flex:1">
            <i class="fa-solid fa-bolt"></i> 실시간 계좌 연동 (BankAPI)
          </button>
        </div>
      </div>

      <div class="upload-area-wrapper" id="upload-mode-container">
        ${uploadMode === 'excel' ? renderExcelUploadUI() : renderApiSyncUI()}
      </div>

      <div id="parse-result-section" style="display:none">
        <div class="card">
          <div class="table-toolbar">
            <h4 class="section-title" style="margin:0">📋 파싱 결과 검토</h4>
            <div class="toolbar-actions">
              <span id="parse-summary" class="badge badge-info"></span>
              <button class="btn btn-ghost btn-sm" onclick="ExcelParserModule.selectAll(true)">전체 선택</button>
              <button class="btn btn-ghost btn-sm" onclick="ExcelParserModule.selectAll(false)">전체 해제</button>
              <button class="btn btn-primary" onclick="ExcelParserModule.saveSelected()">✓ 선택 항목 저장</button>
            </div>
          </div>
          <div class="table-wrapper">
            <table class="data-table" id="parse-table">
              <thead>
                <tr>
                  <th class="text-center" style="width:40px"><input type="checkbox" id="check-all" onchange="ExcelParserModule.toggleAll(this.checked)"></th>
                  <th>거래일시</th>
                  <th class="text-left">적요</th>
                  <th>구분</th>
                  <th class="text-right">금액</th>
                  <th>과제 배정</th>
                  <th>비목</th>
                  <th class="text-center">중복</th>
                </tr>
              </thead>
              <tbody id="parse-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:24px;">
        <h4 class="section-title">🕒 최근 업로드 이력</h4>
        <div id="upload-history-container">
          ${renderUploadHistory()}
        </div>
      </div>

      ${renderConfigModal()}
    `;
  }

  function renderConfigModal() {
    return `
      <div class="modal-overlay" id="bank-config-modal">
        <div class="modal large">
          <div class="modal-header">
            <h3>은행 엑셀 설정 관리</h3>
            <button class="modal-close" onclick="helpers.closeModal('bank-config-modal')">×</button>
          </div>
          <div class="modal-body">
            <p class="hint-text">💡 은행마다 다른 엑셀 컬럼 위치를 저장해 두면, 다음에 업로드 시 자동으로 적용됩니다.</p>
            <div class="form-grid" id="config-form">
              <div class="form-group">
                <label>은행명 <span class="required">*</span></label>
                <input type="text" id="cfg-bank-name" class="form-control" placeholder="예: 국민은행, 우리은행">
              </div>
              <div class="form-group">
                <label>헤더 행 번호 (1부터 시작)</label>
                <input type="number" id="cfg-header-row" class="form-control" value="1" min="1">
              </div>
              <div class="form-group">
                <label>날짜 컬럼 (예: A, B, 0, 1)</label>
                <input type="text" id="cfg-col-date" class="form-control" placeholder="A">
              </div>
              <div class="form-group">
                <label>적요 컬럼</label>
                <input type="text" id="cfg-col-desc" class="form-control" placeholder="B">
              </div>
              <div class="form-group">
                <label>입금 컬럼</label>
                <input type="text" id="cfg-col-income" class="form-control" placeholder="C">
              </div>
              <div class="form-group">
                <label>출금 컬럼</label>
                <input type="text" id="cfg-col-expense" class="form-control" placeholder="D">
              </div>
              <div class="form-group">
                <label>잔액 컬럼 (선택)</label>
                <input type="text" id="cfg-col-balance" class="form-control" placeholder="E">
              </div>
              <div class="form-group">
                <label>계좌번호 컬럼 (선택)</label>
                <input type="text" id="cfg-col-account" class="form-control" placeholder="F">
              </div>
            </div>
            <hr class="divider">
            <h5>저장된 은행 설정</h5>
            <div id="config-list">
              ${renderConfigList()}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="helpers.closeModal('bank-config-modal')">닫기</button>
            <button class="btn btn-primary" onclick="ExcelParserModule.saveConfig()">설정 저장</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderConfigList() {
    const configs = db.getBankConfigs();
    if (!configs.length) return '<p class="hint-text">저장된 설정이 없습니다.</p>';
    return `<ul class="config-list">${configs.map(c => `
      <li class="config-item">
        <span>🏦 ${c.bankName}</span>
        <button class="btn-icon btn-delete" onclick="ExcelParserModule.deleteConfig('${c.id}')">🗑️</button>
      </li>`).join('')}</ul>`;
  }

  function openConfigModal() {
    helpers.openModal('bank-config-modal');
    document.getElementById('config-list').innerHTML = renderConfigList();
  }

  function saveConfig() {
    const bankName = document.getElementById('cfg-bank-name').value.trim();
    if (!bankName) { helpers.showToast('은행명을 입력해 주세요.', 'error'); return; }
    const config = {
      bankName,
      headerRow: parseInt(document.getElementById('cfg-header-row').value) - 1,
      colDate: document.getElementById('cfg-col-date').value.trim(),
      colDesc: document.getElementById('cfg-col-desc').value.trim(),
      colIncome: document.getElementById('cfg-col-income').value.trim(),
      colExpense: document.getElementById('cfg-col-expense').value.trim(),
      colBalance: document.getElementById('cfg-col-balance').value.trim(),
      colAccount: document.getElementById('cfg-col-account').value.trim(),
    };
    db.saveBankConfig(config);
    helpers.showToast('은행 설정이 저장되었습니다.');
    document.getElementById('config-list').innerHTML = renderConfigList();
    document.getElementById('cfg-bank-name').value = '';
  }

  function deleteConfig(id) {
    db.deleteBankConfig(id);
    document.getElementById('config-list').innerHTML = renderConfigList();
    helpers.showToast('설정이 삭제되었습니다.', 'info');
  }

  function selectConfig(id) {
    if (!id) { currentConfig = null; return; }
    if (id === 'auto') { currentConfig = 'auto'; return; }
    currentConfig = db.getBankConfigs().find(c => c.id === id);
  }

  function onDragOver(e) {
    e.preventDefault();
    document.getElementById('drop-zone').classList.add('drag-over');
  }
  function onDragLeave() {
    document.getElementById('drop-zone').classList.remove('drag-over');
  }
  function onDrop(e) {
    e.preventDefault();
    document.getElementById('drop-zone').classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }
  function onFileSelect(input) {
    if (input.files[0]) processFile(input.files[0]);
  }

  function processFile(file, forcedProjectId = null) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        parseRows(rows, file.name, forcedProjectId);
      } catch (err) {
        helpers.showToast('파일을 읽는 중 오류가 발생했습니다: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function parseRows(rows, filename, forcedProjectId = null) {
    const cfg = currentConfig === 'auto' || !currentConfig ? autoDetect(rows) : currentConfig;
    if (!cfg) { helpers.showToast('컬럼 구조를 인식할 수 없습니다. 은행 설정을 선택해 주세요.', 'error'); return; }

    const headerRow = cfg.headerRow || 0;
    const headers = rows[headerRow] || [];

    const colIdx = (key) => {
      let col = cfg['col' + key[0].toUpperCase() + key.slice(1)];
      if (!col) return -1;
      if (/^\d+$/.test(col)) return parseInt(col);
      const letter = col.toUpperCase();
      if (/^[A-Z]+$/.test(letter)) return letter.charCodeAt(0) - 65;
      return headers.findIndex(h => String(h).includes(col));
    };

    const dateIdx = colIdx('Date') === -1 ? autoFindCol(headers, ['날짜', '거래일', '일자', 'Date']) : colIdx('Date');
    const descIdx = colIdx('Desc') === -1 ? autoFindCol(headers, ['적요', '내용', '거래내용', 'Desc']) : colIdx('Desc');
    const incomeIdx = colIdx('Income') === -1 ? autoFindCol(headers, ['입금', '입금액', 'Credit', 'income']) : colIdx('Income');
    const expenseIdx = colIdx('Expense') === -1 ? autoFindCol(headers, ['출금', '출금액', 'Debit', 'expense']) : colIdx('Expense');
    const accountIdx = colIdx('Account') === -1 ? autoFindCol(headers, ['계좌', '계좌번호', 'Account']) : colIdx('Account');
    const categoryIdx = autoFindCol(headers, ['비목', 'Category']);
    const itemCodeIdx = autoFindCol(headers, ['목코드', '코드', 'ItemCode']);
    const acTypeIdx = autoFindCol(headers, ['회계거래유형', 'AccountingType']);
    const noteIdx = autoFindCol(headers, ['비고', 'Note']);

    const selectedProjectId = document.getElementById('upload-project-select').value;
    const existing = db.getLedger().map(l => l.hash);

    parsedRows = [];
    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i];
      const dateRaw = row[dateIdx];
      const income = helpers.parseAmount(row[incomeIdx]);
      const expense = helpers.parseAmount(row[expenseIdx]);
      const desc = String(row[descIdx] || '');
      if (!dateRaw && !income && !expense) continue;

      const dateStr = helpers.parseExcelDate(dateRaw);
      const amount = income > 0 ? income : expense;
      const type = income > 0 ? 'income' : 'expense';
      const accountNo = accountIdx >= 0 ? String(row[accountIdx] || '') : '';
      const hash = helpers.generateHash(dateStr, amount, desc);

      let projectId = forcedProjectId || selectedProjectId;
      if (!projectId && accountNo) {
        const proj = db.getProjectByAccount(accountNo.replace(/[-\s]/g, ''));
        projectId = proj ? proj.id : '';
      }

      const category = categoryIdx >= 0 ? String(row[categoryIdx] || '') : '';
      const itemCode = itemCodeIdx >= 0 ? String(row[itemCodeIdx] || '') : '';
      const accountingTypeRaw = acTypeIdx >= 0 ? String(row[acTypeIdx] || '') : '';
      const note = noteIdx >= 0 ? String(row[noteIdx] || '') : '';

      // 회계거래유형 변환 (한글 -> 영문 key)
      let accountingType = 'normal';
      if (accountingTypeRaw.includes('미수금 발생')) accountingType = 'accrued';
      else if (accountingTypeRaw.includes('미수금 회수')) accountingType = 'collection';
      else if (accountingTypeRaw.includes('미지급금 발생')) accountingType = 'unpaid_occ';
      else if (accountingTypeRaw.includes('미지급금 지급')) accountingType = 'unpaid_pay';

      parsedRows.push({
        dateStr, desc, type, amount, accountNo, hash, projectId, isDuplicate: existing.includes(hash),
        category, itemCode, accountingType, note
      });
    }

    renderParseResult();
  }

  function autoDetect(rows) {
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const headers = rows[i];
      const dateIdx = autoFindCol(headers, ['날짜', '거래일', '일자']);
      const descIdx = autoFindCol(headers, ['적요', '내용', '거래내용']);
      const incomeIdx = autoFindCol(headers, ['입금', '입금액']);
      const expIdx = autoFindCol(headers, ['출금', '출금액']);
      if (dateIdx >= 0 && (incomeIdx >= 0 || expIdx >= 0)) {
        return { headerRow: i, colDate: String(dateIdx), colDesc: String(descIdx), colIncome: String(incomeIdx), colExpense: String(expIdx), bankName: '자동감지' };
      }
    }
    return null;
  }

  function autoFindCol(headers, keywords) {
    for (let k of keywords) {
      const idx = headers.findIndex(h => String(h).includes(k));
      if (idx >= 0) return idx;
    }
    return -1;
  }

  function renderParseResult() {
    const projects = db.getProjects();
    const section = document.getElementById('parse-result-section');
    section.style.display = '';
    const duplicates = parsedRows.filter(r => r.isDuplicate).length;
    document.getElementById('parse-summary').textContent = `총 ${parsedRows.length}건 | 중복 ${duplicates}건`;

    document.getElementById('parse-tbody').innerHTML = parsedRows.map((r, i) => {
      const proj = projects.find(p => p.id === r.projectId);
      let cats = proj ? (proj.categories || helpers.DEFAULT_CATEGORIES) : helpers.DEFAULT_CATEGORIES;
      if (!cats.includes('강사료')) cats = [...cats, '강사료'];
      if (!cats.includes('버스임차료')) cats = [...cats, '버스임차료'];
      if (!cats.includes('학생보험료')) cats = [...cats, '학생보험료'];
      return `
        <tr class="${r.isDuplicate ? 'row-duplicate' : ''}">
          <td class="text-center">
            <input type="checkbox" class="row-check" data-idx="${i}" ${r.isDuplicate ? '' : 'checked'} ${r.isDuplicate ? 'disabled' : ''}>
          </td>
          <td class="mono">${r.dateStr || '-'}</td>
          <td class="text-left">${r.desc}</td>
          <td><span class="badge ${r.type === 'income' ? 'badge-success' : 'badge-danger'}">${r.type === 'income' ? '입금' : '출금'}</span></td>
          <td class="text-right ${r.type === 'income' ? 'text-success' : 'text-danger'}">${helpers.formatCurrencyRaw(r.amount)}원</td>
          <td>
            <select class="form-control-sm proj-select" data-idx="${i}" onchange="ExcelParserModule.updateRowProject(${i}, this.value)">
              <option value="">미배정</option>
              ${projects.map(p => `<option value="${p.id}" ${p.id === r.projectId ? 'selected' : ''}>${p.name}</option>`).join('')}
            </select>
          </td>
          <td>
            <select class="form-control-sm cat-select" data-idx="${i}">
              <option value="">-- 비목 선택 --</option>
              ${cats.map(c => `<option value="${c}" ${c === r.category ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </td>
          <td><input type="text" class="form-control-sm item-code-input" data-idx="${i}" value="${r.itemCode || ''}" placeholder="목코드" style="width:80px"></td>
          <td><input type="text" class="form-control-sm note-input" data-idx="${i}" value="${r.note || ''}" placeholder="비고"></td>
          <td class="text-center">${r.isDuplicate ? '<span class="badge badge-warning">중복</span>' : ''}</td>
        </tr>
      `;
    }).join('');
  }

  function toggleAll(checked) {
    document.querySelectorAll('.row-check:not([disabled])').forEach(cb => cb.checked = checked);
  }

  function selectAll(state) {
    document.querySelectorAll('.row-check:not([disabled])').forEach(cb => cb.checked = state);
    document.getElementById('check-all').checked = state;
  }

  function updateRowProject(idx, projectId) {
    parsedRows[idx].projectId = projectId;
    const proj = db.getProjectById(projectId);
    let cats = proj ? (proj.categories || helpers.DEFAULT_CATEGORIES) : helpers.DEFAULT_CATEGORIES;
    if (!cats.includes('강사료')) cats = [...cats, '강사료'];
    if (!cats.includes('버스임차료')) cats = [...cats, '버스임차료'];
    if (!cats.includes('학생보험료')) cats = [...cats, '학생보험료'];
    const catSelect = document.querySelector(`.cat-select[data-idx="${idx}"]`);
    if (catSelect) {
      const prev = catSelect.value;
      catSelect.innerHTML = `<option value="">-- 비목 선택 --</option>` +
        cats.map(c => `<option value="${c}" ${c === prev ? 'selected' : ''}>${c}</option>`).join('');
    }
  }

  function saveSelected() {
    const checked = [...document.querySelectorAll('.row-check:checked')];
    if (!checked.length) { helpers.showToast('저장할 항목을 선택해 주세요.', 'error'); return; }

    const entries = checked.map(cb => {
      const i = parseInt(cb.dataset.idx);
      const row = parsedRows[i];
      const catSelect = document.querySelector(`.cat-select[data-idx="${i}"]`);
      return {
        transactionDate: row.dateStr,
        description: row.desc,
        type: row.type,
        amount: row.amount,
        projectId: row.projectId,
        category: catSelect ? catSelect.value : row.category,
        itemCode: document.querySelector(`.item-code-input[data-idx="${i}"]`)?.value || row.itemCode,
        note: document.querySelector(`.note-input[data-idx="${i}"]`)?.value || row.note,
        accountingType: row.accountingType || 'normal',
        accountNo: row.accountNo,
        hash: row.hash
      };
    });

    const { added, batchId } = db.saveLedgerBatch(entries);
    helpers.showToast(`${added}건이 장부에 저장되었습니다. (${entries.length - added}건 중복 제외)`);
    render();
    window.App && window.App.refreshSidebar && window.App.refreshSidebar();
  }

  function renderUploadHistory() {
    const batches = db.getLedgerBatches();
    if (!batches.length) return '<p class="hint-text">최근 업로드 내역이 없습니다.</p>';

    return `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>업로드 일시</th>
              <th>건수</th>
              <th class="text-left">대표 적요</th>
              <th class="text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            ${batches.map(b => `
              <tr>
                <td>${helpers.formatDate(b.date)} ${new Date(b.date).toLocaleTimeString()}</td>
                <td class="text-center"><span class="badge badge-info">${b.count}건</span></td>
                <td class="text-left">${b.sampleDesc} 외...</td>
                <td class="text-center">
                  <button class="btn btn-sm btn-outline-danger" onclick="ExcelParserModule.deleteBatch('${b.id}')">
                    <i class="fa-solid fa-trash-can"></i> 업로드 취소
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function deleteBatch(batchId) {
    if (!confirm('이 업로드 내역을 모두 삭제하시겠습니까?\n(해당 배치로 등록된 모든 거래 내역이 제거됩니다.)')) return;
    const deletedCount = db.deleteLedgerByBatch(batchId);
    helpers.showToast(`${deletedCount}건의 거래 내역이 삭제되었습니다.`, 'info');
    render();
    window.App && window.App.refreshSidebar && window.App.refreshSidebar();
  }

  function downloadTemplate() {
    const data = [
      ['날짜', '적요', '입금액', '출금액', '잔액', '목코드', '비목', '회계거래유형', '계좌번호', '비고'],
      ['2026-04-20', '테스트 수입', 1000000, 0, 1000000, 'OI-1-1-01', '연구비', '일반 거래', '123-456-789', '비고내용'],
      ['2026-04-21', '테스트 지출', 0, 50000, 950000, 'OE-1-1-01', '강사료', '미지급금 발생', '123-456-789', '특이사항']
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);

    ws['!cols'] = [
      { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 30 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "업로드양식");

    // --- 회계거래유형 가이드 시트 ---
    const acGuideData = [
      ['회계거래유형 명칭', '설명'],
      ['일반 거래', '수입/지출 즉시 발생 시 사용 (기본값)'],
      ['미수금 발생', '수익은 확정되었으나 돈은 나중에 들어올 때 (결산용)'],
      ['미수금 회수', '예전에 미수금 처리했던 돈이 실제 입금되었을 때'],
      ['미지급금 발생', '비용은 확정되었으나 돈은 나중에 나갈 때 (결산용)'],
      ['미지급금 지급', '예전에 미지급금 처리했던 돈을 실제 지출했을 때']
    ];
    const wsAc = XLSX.utils.aoa_to_sheet(acGuideData);
    wsAc['!cols'] = [{ wch: 25 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsAc, "회계거래유형_가이드");

    // --- 목코드 리스트 시트 추가 ---
    if (window.BudgetModule && window.BudgetModule.BUDGET_STRUCTURE) {
      const refData = [['유형', '목코드', '관(Section)', '항(Category)', '목(Item)']];
      const struct = window.BudgetModule.BUDGET_STRUCTURE;
      const addStructToRef = (type, label) => {
        if (!struct[type]) return;
        struct[type].sections.forEach(sec => {
          sec.categories.forEach(cat => {
            cat.items.forEach(item => {
              refData.push([label, item.code, sec.name, cat.name, item.name]);
            });
          });
        });
      };
      addStructToRef('income', '수입');
      addStructToRef('expense', '지출');

      const wsRef = XLSX.utils.aoa_to_sheet(refData);
      wsRef['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 35 }];
      XLSX.utils.book_append_sheet(wb, wsRef, "목코드_리스트");
    }

    XLSX.writeFile(wb, "은행거래내역_풀업로드양식.xlsx");
    helpers.showToast('가이드 시트가 분리된 업로드 양식이 다운로드되었습니다.');
  }

  function switchMode(mode) {
    uploadMode = mode;
    render();
  }

  function renderExcelUploadUI() {
    const configs = db.getBankConfigs();
    const projects = db.getProjects();
    return `
      <div class="card">
        <h4 class="section-title">📁 은행 설정 선택</h4>
        <div class="form-row">
          <div class="form-group">
            <label>은행 설정</label>
            <select id="bank-config-select" class="form-control" onchange="ExcelParserModule.selectConfig(this.value)">
              <option value="">-- 은행 설정을 선택하세요 --</option>
              ${configs.map(c => `<option value="${c.id}">${c.bankName}</option>`).join('')}
              <option value="auto">🤖 자동 인식 (권장)</option>
            </select>
          </div>
          <div class="form-group">
            <label>대상 과제 (미선택 시 계좌번호로 자동 배정)</label>
            <select id="upload-project-select" class="form-control">
              <option value="">-- 계좌번호로 자동 배정 --</option>
              ${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="card drop-zone-card" id="drop-zone"
        ondragover="ExcelParserModule.onDragOver(event)"
        ondrop="ExcelParserModule.onDrop(event)"
        ondragleave="ExcelParserModule.onDragLeave(event)">
        <div class="drop-zone-inner">
          <div class="drop-icon">📊</div>
          <p class="drop-title">엑셀 파일을 여기에 드래그하거나</p>
          <div style="display:flex; gap:10px; justify-content:center; align-items:center;">
            <label class="btn btn-primary btn-file">
              파일 선택
              <input type="file" id="excel-file-input" accept=".xlsx,.xls,.csv" style="display:none" onchange="ExcelParserModule.onFileSelect(this)">
            </label>
            <button class="btn btn-outline-secondary" onclick="ExcelParserModule.downloadTemplate()">
              <i class="fa-solid fa-download"></i> 표준 양식 다운로드
            </button>
          </div>
          <p class="drop-hint">지원 형식: .xlsx, .xls, .csv (은행 거래내역 엑셀)</p>
        </div>
      </div>
    `;
  }

  function renderApiSyncUI() {
    const projects = db.getProjects();
    const today = new Date().toISOString().split('T')[0];
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const startDate = lastMonth.toISOString().split('T')[0];

    return `
      <div class="card">
        <h4 class="section-title">🔐 계좌 정보 입력</h4>
        <p class="hint-text" style="margin-bottom:15px;">💡 입력하신 비밀번호는 서버에 저장되지 않고 1회성 조회용으로만 사용됩니다.</p>
        <div class="form-grid">
          <div class="form-group">
            <label>은행 선택 <span class="required">*</span></label>
            <select id="api-bank-code" class="form-control">
              <option value="NH">농협은행 (NH)</option>
              <option value="KB">국민은행 (KB)</option>
              <option value="WR">우리은행 (WR)</option>
              <option value="SH">신한은행 (SH)</option>
              <option value="HN">하나은행 (HN)</option>
              <option value="IBK">기업은행 (IBK)</option>
              <option value="MG">새마을금고 (MG)</option>
              <option value="SC">SC제일은행 (SC)</option>
              <option value="CU">신협 (CU)</option>
              <option value="SU">수협 (SU)</option>
              <option value="POST">우체국</option>
            </select>
          </div>
          <div class="form-group">
            <label>계좌번호 <span class="required">*</span></label>
            <input type="text" id="api-account-no" class="form-control" placeholder="숫자만 입력">
          </div>
          <div class="form-group">
            <label>계좌 비밀번호 (4자리) <span class="required">*</span></label>
            <input type="password" id="api-account-pw" class="form-control" maxlength="4" placeholder="****">
          </div>
          <div class="form-group">
            <label>주민(사업자)번호 앞 6자리 <span class="required">*</span></label>
            <input type="text" id="api-resident-no" class="form-control" maxlength="6" placeholder="예: 800101">
          </div>
          <div class="form-group">
            <label>조회 시작일</label>
            <input type="date" id="api-start-date" class="form-control" value="${startDate}">
          </div>
          <div class="form-group">
            <label>조회 종료일</label>
            <input type="date" id="api-end-date" class="form-control" value="${today}">
          </div>
          <div class="form-group">
            <label>대상 과제 배정</label>
            <select id="api-project-id" class="form-control">
              <option value="">-- 계좌번호로 자동 배정 --</option>
              ${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="margin-top:20px; text-align:center;">
          <button class="btn btn-primary btn-lg" onclick="ExcelParserModule.fetchBankTransactions()" id="btn-api-sync">
            <i class="fa-solid fa-rotate"></i> 거래내역 가져오기
          </button>
        </div>
      </div>
    `;
  }

  async function fetchBankTransactions() {
    const bankCode = document.getElementById('api-bank-code').value;
    const accountNumber = document.getElementById('api-account-no').value.trim();
    const accountPassword = document.getElementById('api-account-pw').value;
    const residentNumber = document.getElementById('api-resident-no').value.trim();
    const startDate = document.getElementById('api-start-date').value.replace(/-/g, '');
    const endDate = document.getElementById('api-end-date').value.replace(/-/g, '');
    const projectId = document.getElementById('api-project-id').value;

    if (!accountNumber || !accountPassword || !residentNumber) {
      helpers.showToast('필수 정보를 모두 입력해 주세요.', 'error');
      return;
    }

    const btn = document.getElementById('btn-api-sync');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 조회 중...`;

    try {
      // 1. 계좌 등록 시도 (이미 등록되어 있어도 무관)
      await fetch('/api/bank/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankCode, accountNumber })
      });

      // 2. 거래내역 조회
      const response = await fetch('/api/bank/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankCode, accountNumber, accountPassword, residentNumber, startDate, endDate
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.error || '조회 실패');

      const transactions = result.transactions || result.data || [];
      if (!transactions.length) {
        helpers.showToast('조회된 거래 내역이 없습니다.', 'info');
        return;
      }

      // 3. 파싱 데이터 변환 (기존 ExcelParser 형식과 통일)
      const existing = db.getLedger().map(l => l.hash);
      parsedRows = transactions.map(t => {
        const dateStr = t.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        const amount = parseInt(t.amount);
        const type = t.type === '입금' || t.transactionType === 'IN' || t.type.includes('입금') ? 'income' : 'expense';
        const desc = t.description || t.content || '';
        const hash = helpers.generateHash(dateStr, amount, desc);

        let finalProjectId = projectId;
        if (!finalProjectId && accountNumber) {
          const proj = db.getProjectByAccount(accountNumber.replace(/[-\s]/g, ''));
          finalProjectId = proj ? proj.id : '';
        }

        return {
          dateStr, desc, type, amount, accountNo: accountNumber, hash,
          projectId: finalProjectId, isDuplicate: existing.includes(hash),
          category: '', itemCode: '', accountingType: 'normal', note: ''
        };
      });

      helpers.showToast(`${parsedRows.length}건의 내역을 가져왔습니다.`);
      renderParseResult();
      
      // 결과 섹션으로 스크롤
      setTimeout(() => {
        document.getElementById('parse-result-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (err) {
      console.error('Bank API Error:', err);
      helpers.showToast(`오류: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }

  return { render, openConfigModal, saveConfig, deleteConfig, selectConfig, onDragOver, onDragLeave, onDrop, onFileSelect, toggleAll, selectAll, updateRowProject, saveSelected, processFile, parseRows, downloadTemplate, deleteBatch, switchMode, fetchBankTransactions };
})();

window.ExcelParserModule = ExcelParserModule;
