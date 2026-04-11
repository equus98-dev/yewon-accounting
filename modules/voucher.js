// modules/voucher.js - 지출결의서 생성, 저장 및 목록 관리 (개선 버전)

const VoucherModule = (() => {
  // 전역 초기화를 위한 try-catch
  try {
    const { db, helpers, Auth } = window;
    
    let selectedIds = new Set();
    let currentVoucher = null;
    let searchQuery = '';
    const ALL_APPROVAL_ROLES = ['담당', '팀장', 'RISE사업단장', '산학협력단장', '총장'];
    let selectedRoles = ['담당', '팀장', '산학협력단장'];
    const BUDGET_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

    function render() {
      try {
        const appContent = document.getElementById('app-content');
        const isSearchFieldExists = !!document.getElementById('voucher-search-input');
        
        if (!isSearchFieldExists) {
          appContent.innerHTML = `
            <div class="page-header">
              <div>
                <h2 class="page-title">결의서 관리 (Voucher)</h2>
                <p class="page-subtitle">수입/지출결의서 목록을 확인하고 새 결의서를 작성합니다</p>
              </div>
              <div class="header-actions">
                <button class="btn btn-primary" onclick="VoucherModule.openNewVoucher()">📄 새 결의서 작성</button>
              </div>
            </div>

            <div class="card" style="margin-bottom:20px; padding:15px; display:flex; gap:10px; align-items:center;">
              <i class="fa-solid fa-magnifying-glass" style="color:var(--text-muted); font-size:18px; margin-left:5px;"></i>
              <input type="text" id="voucher-search-input" class="form-control" 
                placeholder="결의번호, 과제명, 제목, 작성자 등으로 검색..." 
                value="${searchQuery}"
                oninput="VoucherModule.handleSearch(this.value)"
                style="flex:1; border:none; box-shadow:none; font-size:15px; outline:none;">
              <div id="voucher-search-clear-btn"></div>
            </div>

            <div id="voucher-tab-content"></div>
          `;
        }

        renderVoucherList();
      } catch (e) {
        console.error('VoucherModule.render error:', e);
        if (window.helpers) window.helpers.showToast('결의서 목록을 불러오는 중 오류가 발생했습니다.', 'error');
        else alert('결의서 목록 렌더링 오류: ' + e.message);
      }
    }

    function renderVoucherList() {
      const _db = window.db || db;
      const _helpers = window.helpers || helpers;
      const allVouchers = _db.getVouchers();
      if (!Array.isArray(allVouchers)) return;

      const vouchers = [...allVouchers]
        .filter(v => {
          if (!v || !v.id) return false;
          if (!searchQuery) return true;
          const q = searchQuery.toLowerCase();
          return v.id.toLowerCase().includes(q) || 
                 (v.projectName || '').toLowerCase().includes(q) ||
                 (v.title || '').toLowerCase().includes(q) ||
                 (v.authorName || '').toLowerCase().includes(q);
        })
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      const session = window.Auth?.getSession();
      const userRank = session?.rank;

      const clearBtn = document.getElementById('voucher-search-clear-btn');
      if (clearBtn) {
        clearBtn.innerHTML = searchQuery ? `<button class="btn btn-ghost btn-sm" onclick="VoucherModule.handleSearch('')">✕</button>` : '';
      }

      const container = document.getElementById('voucher-tab-content');
      if (!container) return;

      if (vouchers.length === 0) {
        container.innerHTML = `
          <div class="card empty-state">
            <div class="empty-icon">📂</div>
            <p>${searchQuery ? '검색 결과가 없습니다.' : '저장된 지출결의서가 없습니다. 새 결의서를 작성해 주세요.'}</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="card">
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="text-center" style="width:120px">결의번호</th>
                  <th class="text-center" style="width:250px">과제명</th>
                  <th class="text-center" style="width:80px">유형</th>
                  <th class="text-center" style="width:100px">업무담당</th>
                  <th class="text-center" style="width:100px">작성일</th>
                  <th class="text-right" style="width:140px">합계금액</th>
                  <th class="text-center" style="width:120px">결재라인</th>
                  <th class="text-center" style="width:100px">관리</th>
                </tr>
              </thead>
              <tbody>
                ${vouchers.map(v => {
                  const needsApproval = userRank && Array.isArray(v.roles) && v.roles.includes(userRank) && userRank !== '담당' && !(v.approvals && v.approvals[userRank]);
                  return `
                  <tr>
                    <td class="mono font-bold text-center">
                      <a href="javascript:void(0)" onclick="VoucherModule.viewVoucher('${v.id}')" style="color:var(--royal-blue); text-decoration:underline; cursor:pointer;">${v.id}</a>
                    </td>
                    <td class="text-truncate" style="max-width:250px" title="${v.projectName || ''}">${v.projectName || '-'}</td>
                    <td class="text-center">
                      <span class="badge ${v.type === 'income' ? 'badge-success' : 'badge-danger'}" style="font-size:12px; padding:4px 8px;">
                         ${v.type === 'income' ? '수입' : '지출'}
                      </span>
                    </td>
                    <td class="text-center">${v.manager || v.authorName || '-'}</td>
                    <td class="text-center">${v.createdAt ? new Date(v.createdAt).toLocaleDateString() : '-'}</td>
                    <td class="text-right ${v.type === 'income' ? 'text-success' : 'text-danger'} fw-bold" style="white-space:nowrap">${_helpers.formatCurrencyRaw(v.totalAmount)}원</td>
                    <td class="text-center">
                      <div style="display:flex; justify-content:center; gap:2px">
                        ${(Array.isArray(v.roles) ? v.roles : []).map(r => {
                          const isApproved = v.approvals && v.approvals[r];
                          const isMyApproval = isApproved && userRank === r && r !== '담당';
                          return `<span class="badge ${isApproved ? 'badge-success' : 'badge-neutral'}" 
                          style="font-size:11px; padding:2px 6px; cursor:${isMyApproval ? 'pointer' : 'default'};" 
                          title="${r}${isApproved ? ' (결재완료)' : ''}${isMyApproval ? ' - 클릭하여 결재 취소' : ''}"
                          ${isMyApproval ? `onclick="VoucherModule.cancelApproval('${v.id}', '${r}')"` : ''}>
                          ${r.slice(0, 2)}${isMyApproval ? ' ↩' : ''}
                        </span>`;
                        }).join('')}
                      </div>
                    </td>
                    <td class="text-center">
                      <div class="action-btns" style="justify-content:center">
                        ${needsApproval
                          ? `<button class="btn btn-primary" style="padding:4px 8px; font-size:12px; border-radius:4px;" onclick="VoucherModule.approveVoucher('${v.id}', '${userRank}')">결재하기</button>`
                          : (userRank && Array.isArray(v.roles) && v.roles.includes(userRank) && userRank !== '담당' && v.approvals && v.approvals[userRank]
                            ? `<button class="btn btn-neutral" style="padding:4px 8px; font-size:12px;" disabled>결재완료</button>`
                            : `<button class="btn btn-ghost btn-sm" onclick="VoucherModule.viewVoucher('${v.id}')" title="조회">보기</button>`)
                        }
                        <button class="btn btn-ghost btn-sm" style="color:#ef4444;" onclick="VoucherModule.deleteVoucher('${v.id}')" title="삭제">🗑️</button>
                      </div>
                    </td>
                `;
              }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }



  function openNewVoucher(initialType = 'expense', initialEntryId = null) {
    try {
      selectedIds.clear();
      if (initialEntryId) {
        selectedIds.add(initialEntryId);
        const entries = db.getLedger();
        const entry = entries.find(e => e.id === initialEntryId);
        if (entry) initialType = entry.type;
      }
      selectedRoles = ['담당', '팀장', '산학협력단장'];
      uploadedFiles = []; // 파일 목록 초기화
      const projects = db.getProjects();
      const currentYear = helpers.getFiscalYear(new Date().toISOString().split('T')[0]);
      const allLedger = db.getLedger();
      const allEntries = (Array.isArray(allLedger) ? allLedger : []).filter(e => {
        const isType = e.type === initialType;
        const isYear = helpers.getFiscalYear(e.transactionDate) === currentYear;
        return isType && isYear;
      }).sort((a, b) => (b.transactionDate || '').localeCompare(a.transactionDate || ''));

      document.getElementById('app-content').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">결의서 작성</h2>
          <p class="page-subtitle">출력할 내역(수입/지출)과 결재라인을 선택해 주세요</p>
        </div>
        <div class="header-actions" style="display:flex; gap:10px;">
          <button class="btn btn-primary" onclick="VoucherModule.prepareVoucher()">📄 결의서 미리보기 생성</button>
          <button class="btn btn-ghost" onclick="VoucherModule.render()">⬅️ 목록으로</button>
        </div>
      </div>

  <div class="voucher-layout">
    <div class="voucher-left">
      <div class="card" style="margin-bottom:20px;">
        <div class="table-toolbar">
          <h4 class="section-title" style="margin:0">1. 내역 선택</h4>
          <div style="display:flex; gap:10px;">
            <select id="v-type-filter" class="form-control-sm" onchange="VoucherModule.changeType(this.value)">
              <option value="expense" ${initialType === 'expense' ? 'selected' : ''}>지출(출금)</option>
              <option value="income" ${initialType === 'income' ? 'selected' : ''}>수입(입금)</option>
            </select>
            <select id="v-year-filter" class="form-control-sm" onchange="VoucherModule.filterEntries()">
              ${BUDGET_YEARS.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}년</option>`).join('')}
            </select>
            <select id="v-proj-filter" class="form-control-sm" onchange="VoucherModule.filterEntries(); VoucherModule.prepareVoucher(true);">
              <option value="">전체 과제</option>
              ${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="table-wrapper" style="max-height:400px; overflow-y:auto">
          <table class="data-table">
            <thead>
              <tr>
                <th class="text-center" style="width: 40px;"></th>
                <th class="text-center">거래일</th>
                <th class="text-left">적요</th>
                <th class="text-right" style="width: 120px;">금액</th>
              </tr>
            </thead>
            <tbody id="v-entry-list">
              ${renderEntryRows(allEntries, initialType)}
            </tbody>
          </table>
        </div>
      </div>
      <!-- (결재라인 이하 동일) -->
      <div class="card">
        <h4 class="section-title">2. 결재라인 선택</h4>
        <div class="approval-selector" style="display:flex; flex-wrap:wrap; gap:10px; padding:15px; background:rgba(255,255,255,0.5); border-radius:8px; border:1px solid rgba(0,0,0,0.05); margin-bottom:20px;">
          ${ALL_APPROVAL_ROLES.map(role => `
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; padding:6px 12px; border-radius:20px; background:${selectedRoles.includes(role) ? '#e0e7ff' : '#fff'}; border:1px solid ${selectedRoles.includes(role) ? '#6366f1' : '#ddd'};" class="role-chip">
                  <input type="checkbox" value="${role}" ${selectedRoles.includes(role) ? 'checked' : ''} 
                    onchange="VoucherModule.toggleRole('${role}', this.checked, this.parentElement)" style="display:none">
                  <span style="font-size:14px;">${role}</span>
                </label>
              `).join('')}
        </div>

        <h4 class="section-title">3. 내부기안(문서) 첨부 <span style="font-size:12px; font-weight:normal; color:var(--text-muted);">(선택사항)</span></h4>
        <div id="v-dropzone-draft" style="padding:15px; background:rgba(99,102,241,0.03); border-radius:8px; border:2px dashed #cbd5e1; margin-bottom:15px; transition: all 0.2s;"
          ondragover="event.preventDefault(); this.style.borderColor='var(--primary)'; this.style.background='rgba(99,102,241,0.08)';"
          ondragleave="this.style.borderColor='#cbd5e1'; this.style.background='rgba(99,102,241,0.03)';"
          ondrop="event.preventDefault(); this.style.borderColor='#cbd5e1'; this.style.background='rgba(99,102,241,0.03)'; VoucherModule.handleFileDrop(event, 'draft');">
          <input type="file" id="v-file-input-draft" style="display:none" accept="image/*,.pdf" multiple onchange="VoucherModule.handleFileChange(this, 'draft')">
          <button class="btn btn-ghost btn-sm" style="width:100%; border:1px dashed #94a3b8; color:#475569;" onclick="document.getElementById('v-file-input-draft').click()">📁 내부기안 파일 선택</button>
          <div id="v-file-preview-list-draft" style="margin-top:12px; display:flex; flex-wrap:wrap; gap:8px;"></div>
        </div>

        <h4 class="section-title">4. 기타 증빙(영수증 등) 첨부 <span style="font-size:12px; font-weight:normal; color:var(--text-muted);">(최대 6개 합산)</span></h4>
        <div id="v-dropzone-other" style="padding:15px; background:rgba(16,185,129,0.03); border-radius:8px; border:2px dashed #cbd5e1; margin-bottom:20px; transition: all 0.2s;"
          ondragover="event.preventDefault(); this.style.borderColor='#10b981'; this.style.background='rgba(16,185,129,0.08)';"
          ondragleave="this.style.borderColor='#cbd5e1'; this.style.background='rgba(16,185,129,0.03)';"
          ondrop="event.preventDefault(); this.style.borderColor='#cbd5e1'; this.style.background='rgba(16,185,129,0.03)'; VoucherModule.handleFileDrop(event, 'other');">
          <input type="file" id="v-file-input-other" style="display:none" accept="image/*,.pdf" multiple onchange="VoucherModule.handleFileChange(this, 'other')">
          <button class="btn btn-ghost btn-sm" style="width:100%; border:1px dashed #94a3b8; color:#475569;" onclick="document.getElementById('v-file-input-other').click()">📁 기타 증빙 파일 선택</button>
          <div id="v-file-preview-list-other" style="margin-top:12px; display:flex; flex-wrap:wrap; gap:8px;"></div>
        </div>

        <h4 class="section-title">5. 추가 결의 정보 입력</h4>
        <div class="card" style="padding:20px; background:rgba(255,255,255,0.5); border-radius:8px; border:1px solid rgba(0,0,0,0.05); margin-bottom:20px;">
          <div class="form-grid">
            <div class="form-group full">
              <label>구분경리 <span class="badge badge-warning">선택</span></label>
              <select id="v-business-type" class="form-control" onchange="VoucherModule.prepareVoucher(true)">
                <option value="목적사업">목적사업</option>
                <option value="수익사업">수익사업</option>
                <option value="기타">기타</option>
              </select>
            </div>
            <div class="form-group full">
              <label>제목 <span class="badge badge-info" style="font-size:10px;">자동입력</span></label>
              <input type="text" id="v-title" class="form-control" placeholder="내역을 선택하면 자동으로 적요가 입력됩니다." value="${initialEntryId ? (db.getLedger().find(e => e.id === initialEntryId)?.description || '') : ''}" oninput="VoucherModule.prepareVoucher(true)">
            </div>
            <div class="form-group full">
              <label>관련근거 <span class="badge badge-neutral">수동입력</span></label>
              <div style="display:flex; gap:10px;">
                <input type="text" id="v-draft-doc-no" class="form-control" placeholder="내부결재기안 문서번호 (예: 산학협력단-000)" style="flex:1;" oninput="VoucherModule.prepareVoucher(true)">
                <input type="text" id="v-draft-title" class="form-control" placeholder="기안제목" style="flex:2;" oninput="VoucherModule.prepareVoucher(true)">
              </div>
            </div>
          </div>

          <div style="margin-top:20px; padding-top:15px; border-top:1px dashed #ddd;">
            <h5 style="margin-bottom:12px;"><i class="fa-solid fa-receipt"></i> 증빙 정보</h5>
            <div class="form-grid">
              <div class="form-group">
                <label>발행일자</label>
                <input type="date" id="v-evidence-date" class="form-control" onchange="VoucherModule.prepareVoucher(true)">
              </div>
              <div class="form-group">
                <label>증빙구분</label>
                <select id="v-evidence-type" class="form-control" onchange="VoucherModule.prepareVoucher(true)">
                  <option value="세금계산서">세금계산서</option>
                  <option value="계산서">계산서</option>
                  <option value="신용카드">신용카드</option>
                  <option value="현금영수증">현금영수증</option>
                  <option value="기타">기타</option>
                </select>
              </div>
              <div class="form-group full">
                <label>상호(성명)</label>
                <input type="text" id="v-evidence-vendor" class="form-control" oninput="VoucherModule.prepareVoucher(true)">
              </div>
            </div>
          </div>

          <div style="margin-top:20px; padding-top:15px; border-top:1px dashed #ddd;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <h5 style="margin:0;"><i class="fa-solid fa-credit-card"></i> 지급 구분</h5>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-sm" onclick="VoucherModule.addPaymentRow()" style="background:#6366f1; color:white; border:none; padding:5px 12px; font-size:12px; font-weight:600; border-radius:4px; box-shadow:0 2px 4px rgba(99,102,241,0.2);">+ 지급처 추가</button>
                <button class="btn btn-sm" onclick="VoucherModule.removeLastPaymentRow()" style="background:#f87171; color:white; border:none; padding:5px 12px; font-size:12px; font-weight:600; border-radius:4px; box-shadow:0 2px 4px rgba(248,113,113,0.2);">- 지급처 삭제</button>
              </div>
            </div>
            <div id="v-payment-rows-container">
              ${renderPaymentRowHtml(0)}
            </div>
          </div>
        </div>

        <!-- 하단 버튼 제거 (헤더로 이동) -->
      </div>
    </div>

    <div class="voucher-right" id="voucher-preview-card">
      <div class="card voucher-empty-state">
        <div class="empty-icon">📄</div>
        <p>미리보기를 생성해 주세요</p>
      </div>
    </div>
  </div>
`;
    } catch (e) {
      console.error('VoucherModule.openNewVoucher error:', e);
      helpers.showToast('결의서 작성 화면을 불러오는 중 오류가 발생했습니다.', 'error');
    }
  }

  function toggleRole(role, checked, el) {
    if (checked) {
      if (!selectedRoles.includes(role)) selectedRoles.push(role);
      el.style.background = '#e0e7ff'; el.style.borderColor = '#6366f1';
    } else {
      selectedRoles = selectedRoles.filter(r => r !== role);
      el.style.background = '#fff'; el.style.borderColor = '#ddd';
    }
    selectedRoles.sort((a, b) => ALL_APPROVAL_ROLES.indexOf(a) - ALL_APPROVAL_ROLES.indexOf(b));
    prepareVoucher(true);
  }

  let uploadedFiles = []; // { base64, name } 최대 6개

  function handleFileDrop(event, category = 'other') {
    const files = [...event.dataTransfer.files];
    processFiles(files, category);
  }

  function handleFileChange(input, category = 'other') {
    const files = [...input.files];
    input.value = ''; // reset so same file can be re-added after removal
    processFiles(files, category);
  }

  async function processFiles(files, category = 'other') {
    if (uploadedFiles.length >= 6) {
      helpers.showToast('최대 6개까지 첨부 가능합니다.', 'error'); return;
    }
    const remaining = 6 - uploadedFiles.length;
    const toProcess = files.slice(0, remaining);
    if (files.length > remaining) {
      helpers.showToast(`6개 초과분(${files.length - remaining}개)은 제외되었습니다.`, 'info');
    }

    for (const file of toProcess) {
      if (file.size > 50 * 1024 * 1024) {
        helpers.showToast(`${file.name}: 파일 용량이 너무 큽니다. (최대 50MB)`, 'error'); continue;
      }
      helpers.showToast(`${file.name} 압축 중...`, 'info');
      let base64Data = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
      if (file.type === 'application/pdf') {
        base64Data = await helpers.compressPdf(base64Data);
      } else if (file.type.startsWith('image/')) {
        base64Data = await helpers.compressImage(base64Data);
      }
      const compressedSize = Math.round((base64Data.length * 3) / 4);
      if (compressedSize > 10 * 1024 * 1024) {
        helpers.showToast(`${file.name}: 압축 후에도 10MB 초과. 업로드 불가.`, 'error'); continue;
      }
      uploadedFiles.push({ base64: base64Data, name: file.name, type: file.type, category });
    }
    renderFileList(category);
    prepareVoucher(true);
  }

  function handleSearch(q) {
    searchQuery = q;
    render();
    // 텍스트 박스 초기화(X 버튼 클릭 시)를 위해 값 동기화
    const input = document.getElementById('voucher-search-input');
    if (input && input.value !== q) {
      input.value = q;
    }
  }

  function renderFileList(category) {
    const draftContainer = document.getElementById('v-file-preview-list-draft');
    const otherContainer = document.getElementById('v-file-preview-list-other');

    if (draftContainer) {
      draftContainer.innerHTML = uploadedFiles
        .map((f, idx) => ({ f, idx }))
        .filter(item => item.f.category === 'draft')
        .map(item => getFilePreviewHtml(item.f, item.idx))
        .join('');
    }
    if (otherContainer) {
      otherContainer.innerHTML = uploadedFiles
        .map((f, idx) => ({ f, idx }))
        .filter(item => item.f.category !== 'draft')
        .map(item => getFilePreviewHtml(item.f, item.idx))
        .join('');
    }
  }

  function getFilePreviewHtml(f, idx) {
    return `
      <div style="position:relative; width:80px; text-align:center;">
        ${f.type && f.type.startsWith('image/')
          ? `<img src="${f.base64}" style="width:70px; height:70px; object-fit:cover; border-radius:4px; border:1px solid #ddd;">`
          : `<div style="width:70px; height:70px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#fff1f2; border:1px solid #fecdd3; border-radius:4px; color:#e11d48; font-size:11px;"><i class="fa-solid fa-file-pdf" style="font-size:22px; margin-bottom:4px;"></i>PDF</div>`
        }
        <div style="font-size:10px; color:#64748b; margin-top:3px; word-break:break-all; max-width:75px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${f.name}">${f.name}</div>
        <button onclick="VoucherModule.removeFile(${idx}, '${f.category}')" style="position:absolute; top:-4px; right:0; width:18px; height:18px; border-radius:50%; background:#ef4444; color:white; border:none; font-size:12px; line-height:1; cursor:pointer;" title="삭제">×</button>
      </div>
    `;
  }

  function removeFile(index, category) {
    uploadedFiles.splice(index, 1);
    renderFileList(category);
    prepareVoucher(true);
  }

  function renderEntryRows(entries, type) {
    if (!entries.length) return `<tr><td colspan="4" class="empty-cell">내역 없음</td></tr>`;
    const amountClass = type === 'income' ? 'text-success' : 'text-danger';

    // 결재 상태 확인 로직 및 관련 결의서 ID 매핑
    const allVouchers = db.getVouchers();
    const approvedIds = new Map();
    const pendingIds = new Map();
    allVouchers.forEach(v => {
      const isApproved = v.roles && v.roles.every(r => v.approvals && v.approvals[r]);
      if (v.entries) {
        if (isApproved) {
          v.entries.forEach(e => approvedIds.set(e.id, v.id));
        } else {
          v.entries.forEach(e => pendingIds.set(e.id, v.id));
        }
      }
    });

    return entries.map(e => {
      let statusHtml = "";
      let trStyle = "";

      if (approvedIds.has(e.id)) {
        const vid = approvedIds.get(e.id);
        const session = window.Auth?.getSession();
        const userRank = session?.rank;
        statusHtml = `<span class="badge badge-success" style="font-size:12px; padding:4px 8px; cursor:pointer;" onclick="VoucherModule.viewVoucher('${vid}', '${userRank || ''}')">결재완료</span>`;
        trStyle = "opacity: 0.6; background-color: #f8f9fa;";
      } else if (pendingIds.has(e.id)) {
        const vid = pendingIds.get(e.id);
        const session = window.Auth?.getSession();
        const userRank = session?.rank;
        statusHtml = `<span class="badge badge-warning" style="font-size:12px; padding:4px 8px; cursor:pointer;" title="이미 다른 결의서에 포함되어 결재 진행 중입니다" onclick="VoucherModule.approveVoucher('${vid}', '${userRank || ''}')">결재중</span>`;
        trStyle = "background-color: #fffbeb;";
      } else {
        const isChecked = selectedIds.has(e.id);
        statusHtml = `<input type="checkbox" class="v-check" value="${e.id}" ${isChecked ? 'checked' : ''} onchange="VoucherModule.toggleEntry('${e.id}', this.checked)">`;
      }

      return `
      <tr style="${trStyle}">
        <td data-label="선택" class="text-center">${statusHtml}</td>
        <td data-label="거래일" class="mono text-xs text-center">${e.transactionDate}</td>
        <td data-label="적요" class="text-sm text-left">${e.description || '-'}</td>
        <td data-label="금액" class="text-right ${amountClass} fw-bold">${helpers.formatCurrencyRaw(e.amount)}원</td>
      </tr>
      `;
    }).join('');
  }

  function toggleEntry(id, checked) {
    if (checked) {
      selectedIds.add(id);
      // 자동 제목 입력: 선택한 항목의 적요를 제목 칸에 반영
      const allEntries = db.getLedger();
      const entry = allEntries.find(e => e.id === id);
      const titleInput = document.getElementById('v-title');
      if (entry && titleInput && !titleInput.value) {
        titleInput.value = entry.description || '';
      }
    } else {
      selectedIds.delete(id);
      if (selectedIds.size === 0) {
        const titleInput = document.getElementById('v-title');
        if (titleInput) {
          titleInput.value = '';
          const titleLabel = titleInput.parentElement.querySelector('label');
          if (titleLabel) titleLabel.innerHTML = '제목';
        }
      }
    }
    prepareVoucher(true);
  }

  function changeType(type) {
    const year = parseInt(document.getElementById('v-year-filter').value);
    const projId = document.getElementById('v-proj-filter').value;
    const entries = db.getLedger(projId || null).filter(e => {
      const isType = e.type === type;
      const isYear = helpers.getFiscalYear(e.transactionDate) === year;
      return isType && isYear;
    }).sort((a, b) => (b.transactionDate || '').localeCompare(a.transactionDate || ''));
    document.getElementById('v-entry-list').innerHTML = renderEntryRows(entries, type);
    selectedIds.clear();
  }

  function filterEntries() {
    const type = document.getElementById('v-type-filter').value;
    const year = parseInt(document.getElementById('v-year-filter').value);
    const projId = document.getElementById('v-proj-filter').value;
    const entries = db.getLedger(projId || null).filter(e => {
      const isType = e.type === type;
      const isYear = helpers.getFiscalYear(e.transactionDate) === year;
      return isType && isYear;
    }).sort((a, b) => (b.transactionDate || '').localeCompare(a.transactionDate || ''));
    document.getElementById('v-entry-list').innerHTML = renderEntryRows(entries, type);
    selectedIds.clear();
  }

  function prepareVoucher(isAuto = false) {
    if (selectedIds.size === 0) { 
        if (!isAuto) helpers.showToast('내역을 선택해 주세요.', 'error'); 
        return; 
    }
    

const allEntries = db.getLedger();
    const selected = [...selectedIds].map(id => allEntries.find(e => e.id === id)).filter(Boolean);
    const totalAmount = selected.reduce((s, e) => s + (e.amount || 0), 0);
    const project = db.getProjectById(selected[0].projectId);
    const type = selected[0].type; // 첫 번째 항목의 유형 기준

    const session = window.Auth?.getSession();
    const currentUser = session ? window.Auth?.getUsers().find(u => u.id === session.userId) : null;
    const approverSig = currentUser?.signature || null;

    const approverName = currentUser?.name || null;

    // 신규 입력 필드 데이터 캡처
    const businessType = document.getElementById('v-business-type')?.value || '목적사업';
    const title = document.getElementById('v-title')?.value || '';
    const docNo = document.getElementById('v-draft-doc-no')?.value || '';
    const draftTitle = document.getElementById('v-draft-title')?.value || '';
    const content = (docNo || draftTitle) ? `[문서번호] ${docNo}\n[기안제목] ${draftTitle}` : (document.getElementById('v-content')?.value || '');
    
    const evidenceInfo = {
      date: document.getElementById('v-evidence-date')?.value || '',
      type: document.getElementById('v-evidence-type')?.value || '세금계산서',
      vendor: document.getElementById('v-evidence-vendor')?.value || ''
    };

    const paymentRows = document.querySelectorAll('.v-payment-row');
    const paymentInfos = [...paymentRows].map(row => {
      const idx = row.dataset.idx;
      return {
        recipientType: row.querySelector(`#v-payment-recipient-type-${idx}`)?.value || '거래처(개인)',
        recipient: row.querySelector(`#v-payment-recipient-${idx}`)?.value || '',
        holder: row.querySelector(`#v-payment-holder-${idx}`)?.value || '',
        method: row.querySelector(`#v-payment-method-${idx}`)?.value || '계좌이체',
        bank: row.querySelector(`#v-payment-bank-${idx}`)?.value || '',
        account: row.querySelector(`#v-payment-account-${idx}`)?.value || '',
        amount: helpers.parseAmount(row.querySelector(`#v-payment-amount-${idx}`)?.value) || 0
      };
    });

    // 만약 금액을 입력하지 않은 경우(초기 상태 등), 전체 금액을 첫 번째 지급처에 할당하거나 1/n 처리하는 로직은 유동적일 수 있으나,
    // 여기서는 사용자가 직접 입력하도록 하되 빈 값은 0으로 처리

    // 임시 ID (저장 시 확정)
    currentVoucher = {
      id: db.getNextVoucherId(),
      type: type,
      projectName: project?.name || '-',
      projectBank: project?.bankName || '-',
      projectAccount: project?.accountNo || '-',
      totalAmount,
      entries: selected,
      roles: [...selectedRoles],
      approvals: { '담당': true },
      approvalSignatures: approverSig ? { '담당': approverSig } : {},
      approvalNames: approverName ? { '담당': approverName } : {},
      attachments: uploadedFiles.length > 0 ? [...uploadedFiles] : [],
      // 추가 필드 저장
      businessType,
      title,
      content,
      evidenceInfo,
      paymentInfos,
      // 하위 호환성: 단일 attachment 필드 유지
      attachment: uploadedFiles.length > 0 ? uploadedFiles[0].base64 : null,
      attachmentName: uploadedFiles.length > 0 ? uploadedFiles[0].name : '',
      createdAt: new Date().toISOString(),
      _saved: false
    };
    renderVoucherPreview(currentVoucher);
  }

  function renderVoucherPreview(v) {
    const headerHtml = `
      <div class="voucher-preview-actions" style="margin-bottom:16px; display:flex; gap:10px;">
        <button class="btn btn-primary" style="background:#ef4444; border:none; padding:10px 20px;" onclick="VoucherModule.printVoucher()">🖨️ 인쇄하기</button>
        ${!v._saved ? `<button class="btn btn-primary" style="padding:10px 20px;" onclick="VoucherModule.saveVoucherToDb()">💾 결의서 상신</button>` : `<span class="badge badge-success" style="padding:10px 15px;">✅ 저장된 결의서</span>`}
      </div>
    `;
    const docHtml = `
      <div class="card" style="padding:40px; background:#fff; color:#000; border:1px solid #ddd; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
        ${getVoucherDocHtml(v)}
      </div>
    `;

    // 미리보기 영역이 존재하면 업데이트, 아니면 HTML 반환 (조회 화면용)
    const container = document.getElementById('voucher-preview-card');
    if (container) {
      container.innerHTML = headerHtml + docHtml;

      // 다중 PDF 첨부파일 렌더링
      const files = (v.attachments && v.attachments.length > 0)
        ? v.attachments
        : (v.attachment ? [{ base64: v.attachment, name: v.attachmentName || '파일' }] : []);
      files.forEach((f, fi) => {
        if (f.base64 && f.base64.startsWith('data:application/pdf')) {
          const pdfContainer = container.querySelector(`.voucher-pdf-container[data-pdf-idx="${fi}"]`);
          if (pdfContainer) helpers.renderPdf(pdfContainer, f.base64);
        }
      });
    }
    return headerHtml + docHtml;
  }

  function saveVoucherToDb() {
    if (!currentVoucher) return;
    if (!currentVoucher._saved) {
      currentVoucher.id = db.getNextVoucherId();
    }
    db.saveVoucher(currentVoucher);
    currentVoucher._saved = true;
    helpers.showToast('결의서가 저장되었습니다.', 'success');
    if (currentVoucher.attachment && window.App && App.refreshStorageUsage) App.refreshStorageUsage();
    renderVoucherPreview(currentVoucher);
  }

  function viewVoucher(id) {
    const v = db.getVoucherById(id);
    if (!v) return;
    v._saved = true;
    currentVoucher = v;

    document.getElementById('app-content').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">지출결의서 조회</h2>
          <p class="page-subtitle">${v.projectName} - ${new Date(v.createdAt).toLocaleDateString()}</p>
        </div>
        <button class="btn btn-ghost" onclick="VoucherModule.render()">⬅️ 목록으로</button>
      </div>
      <div style="max-width:900px; margin:0 auto;" id="voucher-preview-card">
        <!-- renderVoucherPreview가 여기서 직접 HTML을 채웁니다 -->
      </div>
    `;

    // DOM이 생성된 후 렌더링 호출
    renderVoucherPreview(v);
  }

  function deleteVoucher(id) {
    if (!confirm('이 지출결의서를 삭제하시겠습니까?')) return;
    db.deleteVoucher(id);
    helpers.showToast('삭제되었습니다.');
    render();
  }

  function getVoucherDocHtml(v) {
    const date = new Date(v.createdAt);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const isIncome = v.type === 'income';
    const title = isIncome ? '수 입 결 의 서' : '지 출 결 의 서';

    // 작성자 정보 (회색 영역) - 사번 / 이름 형식으로 개선
    const session = window.Auth?.getSession();
    const currentUser = session ? window.Auth?.getUsers().find(u => u.id === session.userId) : null;
    const authorId = currentUser?.username || currentUser?.id || '-'; // 사번(username) 사용
    const authorName = currentUser?.name || '-';

    return `
      <div class="voucher-doc-wrapper">
                        <!-- 상단 헤더: 로고(좌측) / 제목(중앙) -->
        <div style="position: relative; margin-bottom: 25px; display: flex; align-items: center; justify-content: center; min-height: 50px;">
          <div style="position: absolute; left: 0; top: 50%; transform: translateY(-50%);">
            <img src="img/logo_Black.png" alt="로고" style="height: 30px;">
          </div>
          <div style="font-size: 26px; font-weight: 800; letter-spacing: 4px; color: #000; margin-top: 5px; text-decoration: underline; text-underline-offset: 8px;">${title.replace(/ /g, '')}</div>
        </div>

        <!-- 문서번호 -->
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
          <span style="background-color: #d1d5db; color: #000; font-weight: bold; font-size: 14px; padding: 6px 20px; text-align: center;">문서번호</span>
          <span style="font-weight: bold; font-size: 15px; margin-left: 15px;">산단-${v.type==='income'?'수입':'지출'}-${date.getFullYear()}-${String(v.id).padStart(4, '0')}</span>
        </div>

        <div style="margin-bottom: 15px;">
          <table class="approval-line-table" style="margin:0; width:60%; border-collapse:collapse; text-align:center; margin-left:auto;">
            <tr>
              ${v.roles.map(r => `<th style="background:#e5e7eb; border:1px solid #000; padding:6px; font-weight:bold; font-size:14px;">${r}</th>`).join('')}
            </tr>
            <tr>
              ${v.roles.map(r => {
                let sigHtml = '';
                if (v.approvals && v.approvals[r]) {
                  const sig = v.approvalSignatures && v.approvalSignatures[r];
                  if (sig === '수기결재') {
                    sigHtml = `<span style="font-weight:800; font-size:12px; color:#666; letter-spacing:-0.5px; border:1px solid #ccc; padding:2px 4px; border-radius:2px;">수기결재</span>`;
                  } else if (sig) {
                    sigHtml = `<img src="${sig}" style="max-height:45px; max-width:65px; object-fit:contain; mix-blend-mode:multiply;">`;
                  } else {
                    const name = v.approvalNames && v.approvalNames[r];
                    sigHtml = name ? `<img src="img/sign_${name}.png" style="max-height:45px; max-width:65px; object-fit:contain; mix-blend-mode:multiply;" onerror="this.outerHTML='<span style=\\'font-size:11px;\\'>${name}</span>'">` : '(인)';
                  }
                }
                return `<td class="sig-box" style="border:1px solid #000; height:60px; vertical-align:middle;">${sigHtml}</td>`;
              }).join('')}
            </tr>
          </table>
        </div>

        <!-- 기본 정보 테이블 (회색/노란색/흰색) -->
        <table class="voucher-doc-meta-table">
          <tr>
            <td class="voucher-doc-label" style="background-color: #e0e0e0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">회계년도</td>
            <td class="voucher-doc-value auto text-center">${date.getFullYear()}</td>
            <td class="voucher-doc-label" style="background-color: #e0e0e0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">결의일자</td>
            <td class="voucher-doc-value auto text-center">${dateStr}</td>
            <td class="voucher-doc-label" style="background-color: #e0e0e0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">지출금액</td>
            <td class="voucher-doc-value auto text-right" style="font-weight:bold;">${helpers.formatCurrencyRaw(v.totalAmount)}원</td>
          </tr>
          <tr>
            <td class="voucher-doc-label" style="background-color: #e0e0e0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">회계단위</td>
            <td class="voucher-doc-value auto text-center">산단회계</td>
            <td class="voucher-doc-label" style="background-color: #e0e0e0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">회계구분</td>
            <td class="voucher-doc-value auto text-center">산단회계</td>
            <td class="voucher-doc-label" style="background-color: #e0e0e0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">구분경리</td>
            <td class="voucher-doc-value select text-center" style="background-color: #fff9c4 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${v.businessType || '목적사업'}</td>
          </tr>
          <tr>
            <td class="voucher-doc-label" style="background-color: #e0e0e0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">예산부서</td>
            <td class="voucher-doc-value auto text-center">산학협력단</td>
            <td class="voucher-doc-label" style="background-color: #e0e0e0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">작성부서</td>
            <td class="voucher-doc-value auto text-center">산학협력단</td>
            <td class="voucher-doc-label" style="background-color: #e0e0e0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">작성자</td>
            <td class="voucher-doc-value auto text-center">${authorId}, ${authorName}</td>
          </tr>
          <tr>
            <td class="voucher-doc-label" style="background-color: #e0e0e0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">사업명</td>
            <td class="voucher-doc-value auto" colspan="5">${v.projectName || '-'}</td>
          </tr>
          <tr>
            <td class="voucher-doc-label" style="background-color: #e0e0e0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; line-height:1.2; font-size:12px; padding:4px 0;">사업비<br>은행명</td>
            <td class="voucher-doc-value auto text-center" colspan="2">${v.projectBank || '-'}</td>
            <td class="voucher-doc-label" style="background-color: #e0e0e0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; line-height:1.2; font-size:12px; padding:4px 0;">사업비<br>계좌번호</td>
            <td class="voucher-doc-value auto text-center" colspan="2">${v.projectAccount || '-'}</td>
          </tr>
          <tr>
            <td class="voucher-doc-label" style="background-color: #e0e0e0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">제목</td>
            <td class="voucher-doc-value text-left" colspan="5">${v.title || '-'}</td>
          </tr>
          <tr>
            <td class="voucher-doc-label" style="height:80px; background-color: #e0e0e0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">관련근거</td>
            <td class="voucher-doc-value text-left" colspan="5" style="vertical-align:top; border-bottom:2px solid #000;">
              ${(v.content || '').replace(/\n/g, '<br>')}
            </td>
          </tr>
        </table>

        <!-- <예산정보> -->
        <div class="section-tag">&lt;예산정보&gt;</div>
        <table class="voucher-data-table">
          <thead>
            <tr style="background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
              <th style="text-align:center; background-color: #f2f2f2 !important; border: 1px solid #000 !important;">적요</th>
              <th style="width:100px; text-align:center; background-color: #f2f2f2 !important; border: 1px solid #000 !important;">금액</th>
              <th style="width:100px; text-align:center; background-color: #f2f2f2 !important; border: 1px solid #000 !important;">배정예산</th>
              <th style="width:100px; text-align:center; background-color: #f2f2f2 !important; border: 1px solid #000 !important;">예산잔액</th>
            </tr>
          </thead>
          <tbody>
            ${v.entries.map(e => {
              const bItem = db.getBudgetItems().find(bi => bi.itemCode === e.itemCode);
              const assigned = bItem ? bItem.amount : 0;
              const spent = db.getLedger().filter(le => le.itemCode === e.itemCode && le.type === v.type && le.transactionDate <= e.transactionDate).reduce((s, le) => s + (le.amount || 0), 0);
              const balance = assigned - spent + (e.amount || 0); // 현재 결의 건을 빼기 전 잔액 계산
              
              const bInfo = window.BudgetModule ? window.BudgetModule.getItemInfo({ type: v.type, itemCode: e.itemCode }) : null;
              const bPath = bInfo ? `<div style="font-size:9px; color:blue; margin-bottom:2px;">[${bInfo.section} > ${bInfo.category} > ${bInfo.item}]</div>` : '';
              
              return `
                <tr>
                  <td class="text-left">
                    ${bPath}
                    ${e.description}
                  </td>
                  <td class="text-right">${helpers.formatCurrencyRaw(e.amount)}</td>
                  <td class="text-right">${helpers.formatCurrencyRaw(assigned)}</td>
                  <td class="text-right">${helpers.formatCurrencyRaw(balance - e.amount)}</td>
                </tr>
              `;
            }).join('')}
            <tr class="total-row" style="background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
              <td class="text-center" style="font-weight: 700; background-color: #f2f2f2 !important;">합계</td>
              <td class="text-right" style="font-weight: 700; background-color: #f2f2f2 !important;">${helpers.formatCurrencyRaw(v.totalAmount)}</td>
              <td class="text-right" style="background-color: #f2f2f2 !important;">-</td>
              <td class="text-right" style="background-color: #f2f2f2 !important;">-</td>
            </tr>
          </tbody>
        </table>

        <!-- <증빙정보> -->
        <div class="section-tag">&lt;증빙정보&gt;</div>
        <table class="voucher-data-table">
          <thead>
            <tr style="background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
              <th style="text-align:center; background-color: #f2f2f2 !important; border: 1px solid #000 !important;">발행일자</th>
              <th style="text-align:center; background-color: #f2f2f2 !important; border: 1px solid #000 !important;">증빙구분</th>
              <th style="text-align:center; background-color: #f2f2f2 !important; border: 1px solid #000 !important;">상호</th>
              <th style="width:100px; text-align:center; background-color: #f2f2f2 !important; border: 1px solid #000 !important;">금액</th>
              <th style="width:100px; text-align:center; background-color: #f2f2f2 !important; border: 1px solid #000 !important;">배정예산</th>
              <th style="width:100px; text-align:center; background-color: #f2f2f2 !important; border: 1px solid #000 !important;">예산잔액</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-center">${v.evidenceInfo?.date || '-'}</td>
              <td class="text-center">${v.evidenceInfo?.type || '-'}</td>
              <td class="text-center">${v.evidenceInfo?.vendor || '-'}</td>
              <td class="text-right">${helpers.formatCurrencyRaw(v.totalAmount)}</td>
              <td class="text-right">-</td>
              <td class="text-right">-</td>
            </tr>
            <tr class="total-row" style="background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
              <td class="text-center" colspan="3" style="font-weight: 700; background-color: #f2f2f2 !important;">합계</td>
              <td class="text-right" style="font-weight: 700; background-color: #f2f2f2 !important;">${helpers.formatCurrencyRaw(v.totalAmount)}</td>
              <td class="text-right" style="background-color: #f2f2f2 !important;">-</td>
              <td class="text-right" style="background-color: #f2f2f2 !important;">-</td>
            </tr>
          </tbody>
        </table>

        <!-- <지급구분> -->
        <div class="section-tag">&lt;지급구분&gt;</div>
        <table class="voucher-data-table">
          <thead>
            <tr style="background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
              <th style="text-align:center; font-weight: 700; width: 12%; border: 1px solid #000 !important; background-color: #f2f2f2 !important;">구분</th>
              <th style="text-align:center; font-weight: 700; width: 15%; border: 1px solid #000 !important; background-color: #f2f2f2 !important;">지급처</th>
              <th style="text-align:center; font-weight: 700; width: 12%; border: 1px solid #000 !important; background-color: #f2f2f2 !important;">예금주</th>
              <th style="text-align:center; font-weight: 700; width: 18%; border: 1px solid #000 !important; background-color: #f2f2f2 !important;">금액</th>
              <th style="text-align:center; font-weight: 700; width: 13%; border: 1px solid #000 !important; background-color: #f2f2f2 !important;">은행명</th>
              <th style="text-align:center; font-weight: 700; width: 30%; border: 1px solid #000 !important; background-color: #f2f2f2 !important;">계좌번호</th>
            </tr>
          </thead>
          <tbody>
            ${(v.paymentInfos && v.paymentInfos.length > 0) 
              ? v.paymentInfos.map(p => `
                <tr>
                  <td style="text-align:center; background-color: #fff9c4 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${p.recipientType || '-'}</td>
                  <td style="text-align:center;">${p.recipient || '-'}</td>
                  <td style="text-align:center;">${p.holder || '-'}</td>
                  <td style="text-align:right;">${helpers.formatCurrencyRaw(p.amount || 0)}</td>
                  <td style="text-align:center;">${p.bank || '-'}</td>
                  <td style="text-align:center;">${p.account || '-'}</td>
                </tr>
              `).join('')
              : `
                <tr>
                  <td style="text-align:center; background-color: #fff9c4 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${v.paymentInfo?.recipientType || '-'}</td>
                  <td style="text-align:center;">${v.paymentInfo?.recipient || '-'}</td>
                  <td style="text-align:center;">${v.paymentInfo?.holder || '-'}</td>
                  <td style="text-align:right;">${helpers.formatCurrencyRaw(v.totalAmount)}</td>
                  <td style="text-align:center;">${v.paymentInfo?.bank || '-'}</td>
                  <td style="text-align:center;">${v.paymentInfo?.account || '-'}</td>
                </tr>
              `
            }
            <tr class="total-row" style="background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
              <td colspan="3" style="text-align:center; font-weight: 700; background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">지급 합계</td>
              <td style="text-align:right; font-weight: 700; background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${helpers.formatCurrencyRaw(v.totalAmount)}</td>
              <td colspan="2" style="background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;"></td>
            </tr>
          </tbody>
        </table>

        <!-- 첨부파일 (인쇄 시 하단에 작게 표시하거나 별도 페이지) -->
        ${(v.attachments && v.attachments.length > 0) ? `
          <div class="voucher-attachment" style="margin-top:30px; border-top:1px solid #eee; padding-top:15px;">
            <div style="font-weight:bold; margin-bottom:10px;">[첨부 증빙 서류]</div>
            ${v.attachments.map((f, fi) => `
              <div style="margin-bottom:20px;">
                <div style="font-size:12px; color:#666; margin-bottom:5px;">파일 ${fi + 1}: ${f.name} (${f.category === 'draft' ? '내부기안' : '기타증빙'})</div>
                ${f.type && f.type.startsWith('image/') 
                  ? `<img src="${f.base64}" style="max-width:100%; border:1px solid #ddd;">` 
                  : `<div class="voucher-pdf-container" data-pdf-idx="${fi}" style="width:100%; min-height:400px; border:1px solid #ddd; background:#f9f9f9;"></div>`
                }
              </div>
            `).join('')}
          </div>
        ` : (v.attachment ? `
          <div class="voucher-attachment" style="margin-top:30px;">
            ${v.attachment.startsWith('data:image/') 
              ? `<img src="${v.attachment}" style="max-width:100%; border:1px solid #ddd;">` 
              : `<div class="voucher-pdf-container" style="width:100%; min-height:400px; border:1px solid #ddd;"></div>`
            }
          </div>
        ` : '')}
      </div>
    `;
  }

  function printVoucher() {
    const content = document.querySelector('.voucher-doc-wrapper');
    if (!content) return;
    const win = window.open('', '_blank', 'width=950,height=950,toolbar=no,scrollbars=yes');
    
    const isolatedStyles = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
        
        @page {
          size: A4 portrait !important;
          margin: 10mm !important;
        }
        
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        
        body { 
          background: white; 
          margin: 0; 
          padding: 0; 
          width: 190mm !important; 
          font-family: 'Noto Sans KR', sans-serif;
          color: #000 !important;
        }

        .voucher-doc-wrapper { 
          width: 190mm !important; 
          margin: 0 auto !important; 
          padding: 0 !important;
          border: none !important;
          box-shadow: none !important;
          background: #fff !important;
        }

        /* 표 가로 폭을 190mm로 엄격히 제한하여 세로 인쇄 강제 */
        table { 
          width: 190mm !important; 
          max-width: 190mm !important;
          border-collapse: collapse !important; 
          margin-bottom: 12px !important; 
          table-layout: fixed !important;
          border: 1px solid #000 !important;
        }
        
        th, td { 
          border: 1px solid #000 !important; 
          padding: 6px 8px !important; 
          font-size: 11pt !important; 
          color: #000 !important;
          line-height: 1.3 !important;
          height: auto !important;
          overflow: hidden;
          word-break: break-all;
        }

        .voucher-doc-label { 
          background-color: #f2f2f2 !important; 
          font-weight: 700 !important;
          text-align: center !important;
          width: 100px !important;
        }

        .voucher-doc-value.auto { background-color: #f2f2f2 !important; }
        .text-center { text-align: center !important; }
        .text-right { text-align: right !important; }
        .text-left { text-align: left !important; }

        .approval-line-table { 
          width: 114mm !important; /* 190mm의 약 60% */
          margin-left: auto !important; 
          margin-bottom: 15px !important;
        }
        
        .sig-box { height: 60px !important; }
        .section-tag { font-weight: bold; margin-top: 15px; margin-bottom: 5px; display: block; font-size: 12pt; }
        
        @media print {
          .voucher-attachment { display: none !important; }
        }
      </style>
    `;

    win.document.write('<html><head><title>지출결의서 인쇄</title>' + isolatedStyles + '</head><body>');
    win.document.write(content.outerHTML);
    win.document.write('</body></html>');
    win.document.close();

    win.onload = () => {
      setTimeout(() => {
        win.print();
        win.close(); 
      }, 700);
    };
  }


  function approveVoucher(id, rank) {
    const v = window.db.getVoucherById(id);
    if (!v) return;

    // 모달 DOM 생성
    const modalId = 'voucher-approval-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const docHtml = getVoucherDocHtml(v);

    const modalHtml = `
      <div class="modal-overlay active" id="${modalId}" style="z-index:9999; display:flex; justify-content:center; align-items:center; background:rgba(0,0,0,0.5);">
        <div class="modal" style="width:900px; max-width:95vw; background:#fff; border-radius:8px; display:flex; flex-direction:column; max-height:90vh;">
          <div class="modal-header" style="padding:15px 20px; border-bottom:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0;"><i class="fa-solid fa-file-signature"></i> 결의서 결재 확인</h3>
            <button class="modal-close" style="background:none; border:none; font-size:24px; cursor:pointer;" onclick="document.getElementById('${modalId}').remove()">×</button>
          </div>
          <div class="modal-body" style="padding:20px; overflow-y:auto; flex:1; background:#f4f6f8;">
            <div class="card" style="padding:40px; background:#fff; color:#000; border:1px solid #ddd; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin:0;">
              ${docHtml}
            </div>
          </div>
          <div class="modal-footer" style="padding:15px 20px; border-top:1px solid #ddd; display:flex; justify-content:flex-end; gap:10px; background:#fff; border-radius:0 0 8px 8px; box-shadow: 0 -2px 10px rgba(0,0,0,0.05); position:relative; z-index:10;">
            <button class="btn btn-ghost" onclick="document.getElementById('${modalId}').remove()">닫기</button>
            <button class="btn btn-primary" style="background:#f59e0b; border-color:#f59e0b;" onclick="VoucherModule.executeManualBypass('${id}'); document.getElementById('${modalId}').remove();">📝 수기결재 통과</button>
            <button class="btn btn-primary" style="background:#2563eb;" onclick="VoucherModule.executeApproval('${id}', '${rank}'); document.getElementById('${modalId}').remove();">✏️ 결재 승인하기</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 다중 PDF 첨부파일 렌더링
    if (v.attachments && v.attachments.length > 0) {
      setTimeout(() => {
        const modal = document.getElementById(modalId);
        v.attachments.forEach((f, fi) => {
          if (f.base64 && f.base64.startsWith('data:application/pdf')) {
            const pdfContainer = modal.querySelector(`.voucher-pdf-container[data-pdf-idx="${fi}"]`);
            if (pdfContainer) helpers.renderPdf(pdfContainer, f.base64);
          }
        });
      }, 100);
    } else if (v.attachment && v.attachment.startsWith('data:application/pdf')) {
      setTimeout(() => {
        const modal = document.getElementById(modalId);
        const pdfContainer = modal.querySelector('.voucher-pdf-container');
        if (pdfContainer) helpers.renderPdf(pdfContainer, v.attachment);
      }, 100);
    }
  }

  function executeApproval(id, rank) {
    if (!confirm(rank + ' 자격으로 결재를 승인하시겠습니까?')) return;
    const v = window.db.getVoucherById(id);
    if (!v) return;
    v.approvals = v.approvals || {};
    v.approvals[rank] = true;

    v.approvalNames = v.approvalNames || {};

    const session = window.Auth?.getSession();
    if (session) {
      const currentUser = window.Auth?.getUsers().find(u => u.id === session.userId);
      if (currentUser) {
        v.approvalNames[rank] = currentUser.name;
        if (currentUser.signature) {
          v.approvalSignatures = v.approvalSignatures || {};
          v.approvalSignatures[rank] = currentUser.signature;
        }
      }
    }

    window.db.saveVoucher(v);
    window.helpers.showToast('결재가 완료되었습니다.', 'success');
    render();
  }

  function executeManualBypass(id) {
    if (!confirm('수기결재 통과 처리를 하시겠습니까? 모든 결재라인이 승인 처리됩니다.')) return;
    const v = window.db.getVoucherById(id);
    if (!v) return;
    
    // 모든 결재라인 승인 처리
    v.approvals = v.approvals || {};
    v.approvalSignatures = v.approvalSignatures || {};
    (v.roles || []).forEach(role => {
      v.approvals[role] = true;
      // 이미 서명이 있는 직위(주로 담당)는 유지하고, 나머지만 '수기결재' 표시
      if (!v.approvalSignatures[role]) {
        v.approvalSignatures[role] = '수기결재';
      }
    });
    
    window.db.saveVoucher(v);
    window.helpers.showToast('수기결재 통과 처리가 완료되었습니다.', 'success');
    render();
  }

  function cancelApproval(id, rank) {
    const v = window.db.getVoucherById(id);
    if (!v) return;

    // 담당(작성자) 결재는 취소 불가
    if (rank === '담당') {
      helpers.showToast('작성자(담당) 결재는 취소할 수 없습니다.', 'error');
      return;
    }

    // 본인 결재만 취소 가능 체크
    const session = window.Auth?.getSession();
    const userRank = session?.rank;
    if (userRank !== rank) {
      helpers.showToast('본인의 결재만 취소할 수 있습니다.', 'error');
      return;
    }

    if (!(v.approvals && v.approvals[rank])) {
      helpers.showToast('해당 직위의 결재 내역이 없습니다.', 'error');
      return;
    }

    const modalId = 'voucher-cancel-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const modalHtml = `
      <div class="modal-overlay active" id="${modalId}" style="z-index:9999; display:flex; justify-content:center; align-items:center; background:rgba(0,0,0,0.5);">
        <div class="modal" style="width:480px; max-width:95vw; background:#fff; border-radius:8px;">
          <div class="modal-header" style="padding:15px 20px; border-bottom:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0; color:#ef4444;">↩ 결재 취소</h3>
            <button class="modal-close" style="background:none; border:none; font-size:24px; cursor:pointer;" onclick="document.getElementById('${modalId}').remove()">×</button>
          </div>
          <div class="modal-body" style="padding:24px;">
            <p style="margin-bottom:12px;">아래 결재를 취소하시겠습니까?</p>
            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:16px; margin-bottom:12px;">
              <div style="font-size:13px; color:#64748b; margin-bottom:4px;">결의번호</div>
              <div style="font-weight:700; font-size:16px;">${id}</div>
              <div style="font-size:13px; color:#64748b; margin-top:10px; margin-bottom:4px;">결재 직위</div>
              <div style="font-weight:700; font-size:16px; color:#ef4444;">${rank}</div>
              <div style="font-size:13px; color:#64748b; margin-top:10px; margin-bottom:4px;">과제명</div>
              <div style="font-size:14px;">${v.projectName}</div>
            </div>
            <p style="font-size:13px; color:#ef4444;">⚠️ 결재를 취소하면 해당 직위의 서명이 제거됩니다.</p>
          </div>
          <div class="modal-footer" style="padding:15px 20px; border-top:1px solid #ddd; display:flex; justify-content:flex-end; gap:10px;">
            <button class="btn btn-ghost" onclick="document.getElementById('${modalId}').remove()">취소</button>
            <button class="btn" style="background:#ef4444; color:white;" onclick="VoucherModule.executeCancelApproval('${id}', '${rank}'); document.getElementById('${modalId}').remove();">↩ 결재 취소 확인</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  function executeCancelApproval(id, rank) {
    const v = window.db.getVoucherById(id);
    if (!v) return;

    // approvals, approvalSignatures, approvalNames에서 해당 rank 제거
    if (v.approvals) delete v.approvals[rank];
    if (v.approvalSignatures) delete v.approvalSignatures[rank];
    if (v.approvalNames) delete v.approvalNames[rank];

    window.db.saveVoucher(v);
    helpers.showToast(`${rank} 결재가 취소되었습니다.`, 'info');
    render();
  }

  let nextPaymentIdx = 1;
  function addPaymentRow() {
    const container = document.getElementById('v-payment-rows-container');
    if (!container) return;
    const div = document.createElement('div');
    div.innerHTML = renderPaymentRowHtml(nextPaymentIdx++);
    container.appendChild(div.firstElementChild);
    prepareVoucher(true);
  }

  function removePaymentRow(btn) {
    const row = btn.closest('.v-payment-row');
    if (row) {
      row.remove();
      prepareVoucher(true);
    }
  }

  function removeLastPaymentRow() {
    const container = document.getElementById('v-payment-rows-container');
    const rows = container.querySelectorAll('.v-payment-row');
    if (rows.length > 1) {
      rows[rows.length - 1].remove();
      prepareVoucher(true);
    } else {
      helpers.showToast('최소 한 개의 지급처는 있어야 합니다.', 'info');
    }
  }

  function renderPaymentRowHtml(idx) {
    return `
      <div class="v-payment-row" data-idx="${idx}" style="position:relative; padding:15px; border:1px solid #eee; border-radius:8px; margin-bottom:10px; background:#fff;">
        ${idx > 0 ? `<button onclick="VoucherModule.removePaymentRow(this)" style="position:absolute; top:5px; right:5px; border:none; background:none; color:#ef4444; cursor:pointer;" title="삭제">×</button>` : ''}
        <div class="form-grid">
          <div class="form-group">
            <label>구분</label>
            <select id="v-payment-recipient-type-${idx}" class="form-control" onchange="VoucherModule.prepareVoucher(true)">
              <option value="거래처(개인)">거래처(개인)</option>
              <option value="거래처(사업자)">거래처(사업자)</option>
            </select>
          </div>
          <div class="form-group">
            <label>지급처</label>
            <input type="text" id="v-payment-recipient-${idx}" class="form-control" oninput="VoucherModule.prepareVoucher(true)">
          </div>
          <div class="form-group">
            <label>예금주</label>
            <input type="text" id="v-payment-holder-${idx}" class="form-control" oninput="VoucherModule.prepareVoucher(true)">
          </div>
          <div class="form-group">
            <label>금액</label>
            <input type="text" id="v-payment-amount-${idx}" class="form-control" placeholder="0" oninput="helpers.handleAmountInput(this); VoucherModule.prepareVoucher(true)">
          </div>
          <div class="form-group">
            <label>은행명</label>
            <input type="text" id="v-payment-bank-${idx}" class="form-control" oninput="VoucherModule.prepareVoucher(true)">
          </div>
          <div class="form-group">
            <label>계좌번호</label>
            <input type="text" id="v-payment-account-${idx}" class="form-control" oninput="VoucherModule.prepareVoucher(true)">
          </div>
          <div class="form-group" style="display:none">
            <label>지급방법</label>
            <select id="v-payment-method-${idx}" class="form-control">
              <option value="계좌이체" selected>계좌이체</option>
              <option value="현금">현금</option>
              <option value="기타">기타</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }

    return { 
      render, openNewVoucher, toggleRole, handleFileDrop, handleFileChange, removeFile, 
      toggleEntry, changeType, filterEntries, prepareVoucher, saveVoucherToDb, 
      viewVoucher, deleteVoucher, printVoucher, approveVoucher, executeManualBypass,
      cancelApproval, executeCancelApproval, addPaymentRow, removePaymentRow, removeLastPaymentRow,
      handleSearch
    };
  } catch (initErr) {
    console.error('VoucherModule Initialization Failed:', initErr);
    alert('🚨 VoucherModule 초기화 실패: ' + initErr.message);
    return { render: () => alert('Voucher 모듈이 정상적으로 로드되지 않았습니다.') };
  }
})();

window.VoucherModule = VoucherModule;
