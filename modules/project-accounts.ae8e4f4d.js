// modules/project-accounts.js - 과제(사업)별 통장관리 모듈

const ProjectAccountsModule = (() => {
  const { db } = window;
  const { helpers } = window;
  let selectedYear = new Date().getFullYear();

  function render() {
    const projects = db.getProjects().filter(p => helpers.isProjectInFiscalYear(p, selectedYear));
    const allLedger = db.getLedger();

    document.getElementById('app-content').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">과제(사업)별 통장관리</h2>
          <p class="page-subtitle">각 과제별 연결 계좌 및 통장 정보를 확인하고 관리합니다</p>
        </div>
        <div style="display:flex; align-items:center; gap:15px;">
          <select id="acc-year-select" class="form-control" style="width:120px; font-weight:bold; border-color:var(--primary);" onchange="ProjectAccountsModule.changeYear(this.value)">
            ${[...new Set([2024, 2025, 2026, 2027, 2028, 2029, selectedYear, ...db.getProjects().map(p => p.fiscalYear).filter(Boolean)])].sort((a, b) => b - a).map(y => `<option value="${y}" ${y == selectedYear ? 'selected' : ''}>${y}년도</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="filter-bar card" style="display:flex; justify-content:space-around; padding: 20px; margin-bottom: 24px;">
        <div class="stat-item text-center">
            <div class="text-muted" style="font-size:12px; margin-bottom:4px">총 과제 수</div>
            <div class="fw-bold" style="font-size:18px">${projects.length}건</div>
        </div>
        <div style="width:1px; background:var(--border); margin: 0 10px;"></div>
        <div class="stat-item text-center">
            <div class="text-muted" style="font-size:12px; margin-bottom:4px">연결 계좌 수</div>
            <div class="fw-bold text-primary" style="font-size:18px">${projects.filter(p => p.accountNo).length}개</div>
        </div>
      </div>

      <div class="card">
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>과제명</th>
                <th style="width:120px" class="text-center">업무담당</th>
                <th style="width:180px">은행 및 계좌번호</th>
                <th style="width:100px" class="text-center">거래내역</th>
                <th style="width:120px" class="text-right">총 예산</th>
                <th style="width:100px" class="text-center">통장표지</th>
                <th style="width:100px" class="text-center">통장거래내역(스캔)</th>
                <th style="width:180px" class="text-center">은행거래내역 관리</th>
              </tr>
            </thead>
            <tbody>
              ${projects.length === 0 ? `
                <tr><td colspan="8" class="empty-cell">등록된 과제가 없습니다.</td></tr>
              ` : projects.map(p => {
      const active = isActive(p);
      const entryCount = allLedger.filter(e => e.projectId === p.id).length;
      const bankInfo = [p.bankName, p.accountNo].filter(Boolean).join(' ');
      return `
                  <tr>
                    <td>
                        <strong>${p.name}</strong>
                        <div class="text-muted" style="font-size:11px">${p.accountHolder ? `예금주: ${p.accountHolder}` : ''}</div>
                    </td>
                    <td class="text-center">${p.staff || '-'}</td>
                    <td class="mono font-bold">${bankInfo || '<span class="text-muted">미등록 : (과제)사업 추가 메뉴에서 등록</span>'}</td>
                    <td class="text-center"><span class="badge badge-info">${entryCount}건</span></td>
                    <td class="text-right">${helpers.formatCurrencyRaw(p.totalBudget)}원</td>
                    <td class="text-center">
                        ${p.hasPassbook ?
          `<div onclick="ProjectAccountsModule.viewPdf(null, '통장표지 - ${p.name}', '${p.id}', 'passbook')" style="cursor:pointer; color:#e11d48; font-size:24px;" title="클릭하여 PDF 보기/수정/삭제"><i class="fa-solid fa-file-pdf"></i></div>` :
          `<button class="btn btn-xs btn-ghost" onclick="ProjectAccountsModule.triggerPdfUpload('${p.id}', 'passbook')">➕ 등록(PDF)</button>`}
                    </td>
                    <td class="text-center">
                        ${p.hasLedgerScan ?
          `<div onclick="ProjectAccountsModule.viewPdf(null, '통장거래내역(스캔) - ${p.name}', '${p.id}', 'ledgerScan')" style="cursor:pointer; color:#e11d48; font-size:24px;" title="클릭하여 PDF 보기/수정/삭제"><i class="fa-solid fa-file-pdf"></i></div>` :
          `<button class="btn btn-xs btn-ghost" onclick="ProjectAccountsModule.triggerPdfUpload('${p.id}', 'ledgerScan')">➕ 등록(PDF)</button>`}
                    </td>
                    <td class="text-center">
                        <div class="action-btns" style="justify-content:center; gap:5px;">
                            <button class="btn btn-sm btn-primary" onclick="ProjectAccountsModule.triggerUpload('${p.id}')" title="은행 엑셀 업로드">
                                <i class="fa-solid fa-upload"></i> 업로드
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="ProjectAccountsModule.exportToExcel('${p.id}')" title="장부 내역 다운로드">
                                <i class="fa-solid fa-download"></i> 다운로드
                            </button>
                        </div>
                    </td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <input type="file" id="hidden-excel-input" style="display:none" accept=".xlsx,.xls,.csv" onchange="ProjectAccountsModule.handleFileUpload(this)">
      <input type="file" id="hidden-pdf-input" style="display:none" accept="application/pdf" onchange="ProjectAccountsModule.handlePdfUpload(this)">
    `;
  }

  let _activeUploadProjectId = null;
  let _activePdfProjectId = null;
  let _activePdfType = null;

  function triggerUpload(projectId) {
    _activeUploadProjectId = projectId;
    document.getElementById('hidden-excel-input').click();
  }

  function triggerPdfUpload(projectId, type) {
    _activePdfProjectId = projectId;
    _activePdfType = type;
    document.getElementById('hidden-pdf-input').click();
  }

  function handlePdfUpload(input) {
    if (!input.files || !input.files[0] || !_activePdfProjectId) return;
    const file = input.files[0];
    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      helpers.showToast('PDF 및 이미지 파일만 등록 가능합니다.', 'error');
      return;
    }

    // 파일 용량 체크 (압축 전 최대 50MB 허용)
    if (file.size > 50 * 1024 * 1024) {
      helpers.showToast('파일 용량이 너무 큽니다. (최대 50MB)', 'error');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      let base64Data = e.target.result;
      const originalSize = file.size;

      helpers.showToast('파일을 압축 중입니다...', 'info');

      if (file.type === 'application/pdf') {
        base64Data = await helpers.compressPdf(base64Data);
      } else if (file.type.startsWith('image/')) {
        base64Data = await helpers.compressImage(base64Data);
      }

      const compressedSize = Math.round((base64Data.length * 3) / 4);
      const ratio = Math.round((1 - compressedSize / originalSize) * 100);

      if (compressedSize > 10 * 1024 * 1024) {
        helpers.showToast(`압축 후에도 용량이 10MB를 초과하여 업로드할 수 없습니다. (현재: ${(compressedSize / 1024 / 1024).toFixed(2)}MB)`, 'error');
        return;
      }

      helpers.showToast(`압축 완료: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${ratio}% 감소)`);

      const project = db.getProjectById(_activePdfProjectId);
      if (project) {
        helpers.showToast('파일을 업로드 중입니다...', 'info');
        // 큰 파일은 별도 키로 저장
        const storageKey = `pdf_${_activePdfType}_${_activePdfProjectId}`;
        const success = await db.setLargeData(storageKey, base64Data);

        if (success) {
          // 프로젝트 객체에는 유무 플래그만 저장 (D1 1MB 제한 방지)
          if (_activePdfType === 'passbook') project.hasPassbook = true;
          else if (_activePdfType === 'ledgerScan') project.hasLedgerScan = true;

          db.saveProject(project);
          helpers.showToast('업로드가 완료되었습니다.');
          if (window.App && App.refreshStorageUsage) App.refreshStorageUsage();
          render();
        } else {
          helpers.showToast('업로드에 실패했습니다.', 'error');
        }
      }
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  async function viewPdf(dummy, title, projectId, type) {
    _activePdfProjectId = projectId;
    _activePdfType = type;

    // 동적 모달 생성 (결의서와 동일한 방식)
    const modalId = 'dynamic-pdf-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const modalHtml = `
      <div id="${modalId}" class="modal-overlay active" style="z-index:9999;">
        <div class="modal large" style="width: 90%; max-width: 1000px; height: 90vh;">
          <div class="modal-header">
            <h3>${title}</h3>
            <div style="display:flex; gap:12px; align-items:center;">
                <button class="btn btn-sm btn-outline-primary" onclick="ProjectAccountsModule.updatePdfFromModal()">
                    <i class="fa-solid fa-pen-to-square"></i> 수정
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="ProjectAccountsModule.deletePdfFromModal()">
                    <i class="fa-solid fa-trash-can"></i> 삭제
                </button>
                <div style="width:1px; height:24px; background:var(--border); margin:0 4px;"></div>
                <button class="modal-close" onclick="document.getElementById('${modalId}').remove()" style="position:static; padding:8px;">×</button>
            </div>
          </div>
          <div class="modal-body" id="dynamic-pdf-target" style="height: calc(100% - 60px); padding:0; display:flex; justify-content:center; align-items:center; background:#eee; overflow-y:auto;">
            <div style="padding:40px; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> PDF 로딩 중...</div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 데이터 로드 및 렌더링
    const storageKey = `pdf_${type}_${projectId}`;
    const base64 = await db.getLargeData(storageKey);
    const target = document.getElementById('dynamic-pdf-target');

    if (base64) {
      if (base64.startsWith('data:image')) {
        target.innerHTML = `<img src="${base64}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
      } else {
        helpers.renderPdf(target, base64);
      }
    } else {
      target.innerHTML = '<div style="padding:20px; color:red;">파일을 불러올 수 없습니다.</div>';
    }
  }

  function updatePdfFromModal() {
    if (!_activePdfProjectId || !_activePdfType) return;
    document.getElementById('hidden-pdf-input').click();
  }

  function deletePdfFromModal() {
    if (!_activePdfProjectId || !_activePdfType) return;
    const label = _activePdfType === 'passbook' ? '통장표지' : '통장거래내역(스캔)';
    if (!confirm(`${label} PDF를 삭제하시겠습니까?`)) return;

    const project = db.getProjectById(_activePdfProjectId);
    if (project) {
      if (_activePdfType === 'passbook') delete project.hasPassbook;
      else if (_activePdfType === 'ledgerScan') delete project.hasLedgerScan;
      db.saveProject(project);

      // 개별 데이터도 삭제 요청 (Optional but recommended)
      const storageKey = `pdf_${_activePdfType}_${_activePdfProjectId}`;
      db.setLargeData(storageKey, null);

      helpers.showToast(`${label} PDF가 삭제되었습니다.`);
      const modal = document.getElementById('dynamic-pdf-modal');
      if (modal) modal.remove();
      render();
    }
  }

  function handleFileUpload(input) {
    if (!input.files || !input.files[0] || !_activeUploadProjectId) return;
    const file = input.files[0];

    if (window.ExcelParserModule) {
      App.navigate('upload');
      setTimeout(() => {
        window.ExcelParserModule.processFile(file, _activeUploadProjectId);
      }, 300);
    }
    input.value = '';
  }

  function exportToExcel(projectId) {
    const project = db.getProjectById(projectId);
    if (!project) return;
    const entries = db.getLedger(projectId).sort((a, b) => (a.transactionDate || '').localeCompare(b.transactionDate || ''));

    if (entries.length === 0) {
      helpers.showToast('다운로드할 거래 내역이 없습니다.', 'error');
      return;
    }

    const data = [
      ['날짜', '구분', '금액', '적요', '비목', '계좌번호'],
      ...entries.map(e => [
        e.transactionDate,
        e.type === 'income' ? '입금' : '출금',
        e.amount,
        e.description,
        e.category || '-',
        e.accountNo || project.accountNo || '-'
      ])
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 40 }, { wch: 20 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(wb, ws, "거래내역");
    XLSX.writeFile(wb, `은행거래내역_${project.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
    helpers.showToast('엑셀 다운로드가 시작되었습니다.');
  }

  function isActive(p) {
    if (!p.endDate) return true;
    return new Date(p.endDate) >= new Date();
  }

  function changeYear(year) {
    selectedYear = parseInt(year);
    render();
  }

  return { render, triggerUpload, handleFileUpload, exportToExcel, triggerPdfUpload, handlePdfUpload, viewPdf, updatePdfFromModal, deletePdfFromModal, changeYear };
})();

window.ProjectAccountsModule = ProjectAccountsModule;
