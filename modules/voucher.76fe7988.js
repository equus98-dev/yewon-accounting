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

    // [최적화용] 이미지 상단과 하단만 크롭하여 병합하는 유틸리티
    function cropImageSections(base64Data, topRatio = 0.3, bottomRatio = 0.3) {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Data;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const topH = img.height * topRatio;
          const bottomH = img.height * bottomRatio;
          
          canvas.width = img.width;
          canvas.height = topH + bottomH;
          
          // 상단 영역 그리기
          ctx.drawImage(img, 0, 0, img.width, topH, 0, 0, img.width, topH);
          // 하단 영역을 상단 바로 아래에 이어 그리기
          ctx.drawImage(img, 0, img.height - bottomH, img.width, bottomH, 0, topH, img.width, bottomH);
          
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = () => resolve(base64Data);
      });
    }

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
            <table class="data-table" style="table-layout: fixed; width: 100%;">
              <thead>
                <tr>
                  <th class="text-center" style="width:120px">결의번호</th>
                  <th class="text-center" style="width:200px">과제명 / 지출내용</th>
                  <th class="text-center" style="width:80px">유형</th>
                  <th class="text-center" style="width:100px">업무담당</th>
                  <th class="text-center" style="width:100px">작성일</th>
                  <th class="text-right" style="width:110px">합계금액</th>
                  <th class="text-center" style="width:120px">결재라인</th>
                  <th class="text-center" style="width:130px">관리</th>
                </tr>
              </thead>
              <tbody>
                ${vouchers.map(v => {
                  const author = getAuthorInfo(v);
                  const userSession = window.Auth?.getSession();
                  const isAdmin = userSession?.role === 'admin';
                  const isAuthor = userSession && (userSession.username === author.id || userSession.userId === author.id || (userRank === '담당' && !v.authorId));
                  
                  const isFullyApproved = Array.isArray(v.roles) && v.roles.every(r => v.approvals && v.approvals[r]);
                  const alreadyApproved = v.approvals && v.approvals[userRank];

                  // 결재 버튼 표시 조건: 승인이 필요하거나, 관리자이거나, 담당자 본인이면서 수기결재를 위해 상신 상태인 경우
                  const canShowApprovalBtn = (userRank && Array.isArray(v.roles) && v.roles.includes(userRank) && !alreadyApproved) || isAdmin || (userRank === '담당' && isAuthor && !isFullyApproved);
                  
                  const noHigherApproval = !Object.keys(v.approvals || {}).some(r => r !== '담당' && v.approvals[r]);
                  const canEditNow = (isAdmin || isAuthor) && noHigherApproval;
                  const canDeleteNow = isAdmin || isAuthor;

                  // 결재라인 HTML 사전 계산 (중첩 템플릿 리터럴 오류 방지)
                  const hasManual = Object.values(v.approvalSignatures || {}).includes('수기결재');
                  let approvalLineHtml;
                  if (hasManual) {
                    const rolesStr = (Array.isArray(v.roles) ? v.roles : []).map(function(r){ return r.slice(0,2); }).join('-');
                    approvalLineHtml = '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;line-height:1.1;">'
                      + '<div style="font-size:10px;color:#555;">' + rolesStr + '</div>'
                      + '<div style="font-size:10px;font-weight:700;color:#d97706;background:#fef3c7;padding:1px 4px;border-radius:3px;">↳ 수기결재</div>'
                      + '</div>';
                  } else {
                    approvalLineHtml = '<div style="display:flex;justify-content:center;gap:2px">'
                      + (Array.isArray(v.roles) ? v.roles : []).map(function(r) {
                          var isApproved = v.approvals && v.approvals[r];
                          var isMyApproval = isApproved && userRank === r && r !== '담당';
                          var badgeClass = isApproved ? 'badge-success' : 'badge-neutral';
                          var clickAttr = isMyApproval ? ' onclick="VoucherModule.cancelApproval(\'' + v.id + '\', \'' + r + '\')"' : '';
                          var titleTxt = r + (isApproved ? ' (결재완료)' : '') + (isMyApproval ? ' - 클릭하여 결재 취소' : '');
                          return '<span class="badge ' + badgeClass + '" style="font-size:11px;padding:2px 6px;cursor:' + (isMyApproval ? 'pointer' : 'default') + ';" title="' + titleTxt + '"' + clickAttr + '>'
                            + r.slice(0,2) + (isMyApproval ? ' ↩' : '') + '</span>';
                        }).join('')
                      + '</div>';
                  }

                  return `
                  <tr>
                    <td class="mono font-bold text-center">
                      <a href="javascript:void(0)" onclick="VoucherModule.viewVoucher('${v.id}')" style="color:var(--royal-blue); text-decoration:underline; cursor:pointer;">${v.id}</a>
                    </td>
                    <td style="max-width:200px; padding: 12px 16px;">
                      <div class="text-truncate" style="color:var(--royal-blue); font-weight:600; margin-bottom:4px;" title="${v.projectName || ''}">${v.projectName || '-'}</div>
                      <div class="text-truncate" style="font-size:13px; color:#555;" title="${v.title || ''}">${v.title || '-'}</div>
                    </td>
                    <td class="text-center">
                      <span class="badge ${v.type === 'income' ? 'badge-success' : 'badge-danger'}" style="font-size:12px; padding:4px 8px;">
                         ${v.type === 'income' ? '수입' : '지출'}
                      </span>
                    </td>
                    <td class="text-center">${author.name}</td>
                    <td class="text-center">${v.createdAt ? new Date(v.createdAt).toLocaleDateString() : '-'}</td>
                    <td class="text-right ${v.type === 'income' ? 'text-success' : 'text-danger'} fw-bold" style="white-space:nowrap">${_helpers.formatCurrencyRaw(v.totalAmount)}원</td>
                    <td class="text-center">${approvalLineHtml}</td>
                    <td class="text-center">
                      <div class="action-btns" style="justify-content:center; gap:5px;">
                        ${canShowApprovalBtn 
                            ? `<button class="btn btn-primary btn-sm" style="padding:4px 8px; font-size:12px; background:#2563eb;" onclick="VoucherModule.approveVoucher('${v.id}', '${userRank}')">결재</button>` 
                            : `<button class="btn btn-ghost btn-sm" onclick="VoucherModule.viewVoucher('${v.id}')" title="조회">보기</button>`}
                        
                        ${(isAdmin || isAuthor) && !isFullyApproved
                            ? `<button class="btn btn-sm" style="background:#f59e0b; color:white; padding:4px 8px; font-size:12px; border:none; border-radius:4px;" onclick="VoucherModule.executeManualBypass('${v.id}'); VoucherModule.render();" title="수기결재 통과">수기</button>`
                            : ''}

                        ${canEditNow 
                            ? `<button class="btn btn-ghost btn-sm" style="color:var(--royal-blue); padding:4px 8px; font-size:12px;" onclick="VoucherModule.editVoucher('${v.id}')" title="수정">수정</button>` 
                            : ''}
                        ${canDeleteNow 
                            ? `<button class="btn btn-ghost btn-sm" style="color:#ef4444;" onclick="VoucherModule.deleteVoucher('${v.id}')" title="삭제">🗑️</button>` 
                            : ''}
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



  function getAuthorInfo(v) {
    const session = window.Auth?.getSession();
    const currentUser = session ? (window.Auth?.getUsers() || []).find(u => u.id === session.userId) : null;
    
    let id = v.authorId;
    let name = v.authorName;
    
    // 소급 적용 로직
    if (!id || !name) {
      // 1. 담당 결재자 이름 확인
      name = v.approvalNames?.['담당'] || v.manager || name;
      // 2. 이름을 통해 사번(ID) 역추적
      if (name && !id) {
        const authorUser = (window.Auth?.getUsers() || []).find(u => u.name === name);
        id = authorUser?.username || authorUser?.id;
      }
    }
    
    return {
      id: id || currentUser?.username || currentUser?.id || '-',
      name: name || currentUser?.name || '-'
    };
  }


  function openNewVoucher(initialType = 'expense', initialEntryId = null, existingVoucherId = null) {
    try {
      if (existingVoucherId) {
        const v = db.getVoucherById(existingVoucherId);
        if (v) {
          currentVoucher = v;
          selectedIds = new Set(v.entries.map(e => e.id));
          selectedRoles = [...v.roles];
          uploadedFiles = v.attachments ? [...v.attachments] : [];
          initialType = v.type;
        }
      } else {
        currentVoucher = null;
        selectedIds.clear();
        if (initialEntryId) {
          selectedIds.add(initialEntryId);
          const entries = db.getLedger();
          const entry = entries.find(e => e.id === initialEntryId);
          if (entry) initialType = entry.type;
        }
        selectedRoles = ['담당', '팀장', '산학협력단장'];
        uploadedFiles = []; // 파일 목록 초기화
      }

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

        <h4 class="section-title">3. 내부기안(문서) 첨부 <span style="font-size:12px; font-weight:bold; color:#ef4444;">(필수사항)</span></h4>
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
              <label style="display: inline-block; background: #334155; color: #fff; padding: 2px 10px; border-radius: 4px; margin-bottom: 8px; font-weight: 600; font-size: 13px;">구분경리</label> <span style="font-size:12px; font-weight:600; color:#2563eb; margin-left:8px;">클릭하여 선택하세요.</span>
              <select id="v-business-type" class="form-control" onchange="VoucherModule.prepareVoucher(true)">
                <option value="" ${!currentVoucher?.businessType ? 'selected' : ''}>&lt;선택&gt;</option>
                <option value="목적사업" ${currentVoucher?.businessType === '목적사업' ? 'selected' : ''}>목적사업</option>
                <option value="수익사업" ${currentVoucher?.businessType === '수익사업' ? 'selected' : ''}>수익사업</option>
                <option value="기타" ${currentVoucher?.businessType === '기타' ? 'selected' : ''}>기타</option>
              </select>
            </div>
            <div class="form-group full">
              <label style="display: inline-block; background: #334155; color: #fff; padding: 2px 10px; border-radius: 4px; margin-bottom: 8px; font-weight: 600; font-size: 13px;">제목</label> <span style="font-size:12px; font-weight:600; color:#2563eb; margin-left:8px;">자동입력됩니다.</span>
              <input type="text" id="v-title" class="form-control" placeholder="내역을 선택하면 자동으로 적요가 입력됩니다." value="${currentVoucher ? (currentVoucher.title || '') : (initialEntryId ? (db.getLedger().find(e => e.id === initialEntryId)?.description || '') : '')}" oninput="VoucherModule.prepareVoucher(true)">
            </div>
            <div class="form-group full">
              <label style="display: inline-block; background: #334155; color: #fff; padding: 2px 10px; border-radius: 4px; margin-bottom: 8px; font-weight: 600; font-size: 13px;">관련근거</label> <span style="font-size:12px; font-weight:600; color:#2563eb; margin-left:8px;">관련근거를 첨부하면, 탑재된 AI가 자동으로 인식합니다.</span>
              <div style="display:flex; gap:10px;">
                <input type="text" id="v-draft-doc-no" class="form-control" placeholder="내부결재기안 문서번호 (예: 산학협력단-000)" style="flex:1;" oninput="VoucherModule.prepareVoucher(true)" value="${currentVoucher?.content?.match(/\[문서번호\] (.*)/)?.[1] || ''}">
                <input type="text" id="v-draft-title" class="form-control" placeholder="기안제목" style="flex:2;" oninput="VoucherModule.prepareVoucher(true)" value="${currentVoucher?.content?.match(/\[기안제목\] (.*)/)?.[1] || ''}">
              </div>
            </div>
          </div>

          <div style="margin-top:20px; padding-top:15px; border-top:1px dashed #ddd;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
              <h5 style="margin:0;"><i class="fa-solid fa-receipt"></i> 증빙 정보</h5>
              <label style="display:flex; align-items:center; gap:4px; font-size:12px; cursor:pointer; color:#2563eb; font-weight:600;">
                <input type="checkbox" id="v-no-evidence" ${currentVoucher?.noEvidence ? 'checked' : ''} onchange="VoucherModule.prepareVoucher(true)"> 해당없음
              </label>
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label style="display: inline-block; background: #334155; color: #fff; padding: 2px 10px; border-radius: 4px; margin-bottom: 8px; font-weight: 600; font-size: 13px;">발행일자</label>
                <input type="date" id="v-evidence-date" class="form-control" onchange="VoucherModule.prepareVoucher(true)" value="${currentVoucher?.evidenceInfo?.date || ''}">
              </div>
              <div class="form-group">
                <label style="display: inline-block; background: #334155; color: #fff; padding: 2px 10px; border-radius: 4px; margin-bottom: 8px; font-weight: 600; font-size: 13px;">증빙구분</label>
                <select id="v-evidence-type" class="form-control" onchange="VoucherModule.prepareVoucher(true)">
                  <option value="" ${!currentVoucher?.evidenceInfo?.type ? 'selected' : ''}>&lt;선택&gt;</option>
                  <option value="세금계산서" ${currentVoucher?.evidenceInfo?.type === '세금계산서' ? 'selected' : ''}>세금계산서</option>
                  <option value="계산서" ${currentVoucher?.evidenceInfo?.type === '계산서' ? 'selected' : ''}>계산서</option>
                  <option value="신용카드" ${currentVoucher?.evidenceInfo?.type === '신용카드' ? 'selected' : ''}>신용카드</option>
                  <option value="현금영수증" ${currentVoucher?.evidenceInfo?.type === '현금영수증' ? 'selected' : ''}>현금영수증</option>
                  <option value="기타" ${currentVoucher?.evidenceInfo?.type === '기타' ? 'selected' : ''}>기타</option>
                </select>
              </div>
              <div class="form-group full">
                <label style="display: inline-block; background: #334155; color: #fff; padding: 2px 10px; border-radius: 4px; margin-bottom: 8px; font-weight: 600; font-size: 13px;">상호(성명)</label>
                <input type="text" id="v-evidence-vendor" class="form-control" oninput="VoucherModule.prepareVoucher(true)" value="${currentVoucher?.evidenceInfo?.vendor || ''}">
              </div>
            </div>
          </div>

          <div style="margin-top:20px; padding-top:15px; border-top:1px dashed #ddd;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div style="display:flex; align-items:center; gap:15px;">
                <h5 style="margin:0;"><i class="fa-solid fa-credit-card"></i> 지급 구분</h5>
                <label style="display:flex; align-items:center; gap:4px; font-size:12px; cursor:pointer; color:#2563eb; font-weight:600;">
                  <input type="checkbox" id="v-no-payment" ${currentVoucher?.noPayment ? 'checked' : ''} onchange="VoucherModule.prepareVoucher(true)"> 해당없음
                </label>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-sm" onclick="VoucherModule.addPaymentRow()" style="background:#6366f1; color:white; border:none; padding:5px 12px; font-size:12px; font-weight:600; border-radius:4px; box-shadow:0 2px 4px rgba(99,102,241,0.2);">+ 지급처 추가</button>
                <button class="btn btn-sm" onclick="VoucherModule.removeLastPaymentRow()" style="background:#f87171; color:white; border:none; padding:5px 12px; font-size:12px; font-weight:600; border-radius:4px; box-shadow:0 2px 4px rgba(248,113,113,0.2);">- 지급처 삭제</button>
              </div>
            </div>
            <div id="v-payment-rows-container">
              ${(currentVoucher?.paymentInfos && currentVoucher.paymentInfos.length > 0) 
                 ? currentVoucher.paymentInfos.map((pi, idx) => renderPaymentRowHtml(idx, pi)).join('')
                 : renderPaymentRowHtml(0)}
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

      // 내부기안(draft) 파일인 경우 분석 시도
      if (category === 'draft') {
        if (file.type === 'application/pdf') {
          // PDF 분석
          analyzeDraftPdf(base64Data);
        } else if (file.type.startsWith('image/')) {
          // 이미지 분석 (고화질)
          helpers.compressImage(base64Data, 0.95).then(hdBase64 => {
            analyzeDraftWithAI(hdBase64);
          });
        }
      }
    }
    renderFileList(category);
    prepareVoucher(true);
  }

  async function analyzeDraftPdf(base64Data) {
    try {
      helpers.showToast('PDF 기안문을 추출하고 있습니다...', 'info', 4000);
      
      const pdfData = atob(base64Data.split(',')[1]);
      const loadingTask = pdfjsLib.getDocument({ data: pdfData });
      const pdf = await loadingTask.promise;
      
      // 첫 페이지 텍스트 추출
      const page = await pdf.getPage(1);
      const textContent = await page.getTextContent();
      const strings = textContent.items.map(item => item.str);
      const fullText = strings.join(' ');
      
      console.log('PDF Extracted Text:', fullText);

      let title = '';
      let docNo = '';

      // 1. 제목 찾기 (최대한 공격적인 키워드 및 구조 추적)
      const titleKeywords = [
          '제목', '제 목', '제  목', '제   목', '채목', '체목', '재목', '재 목', '체 목', '채 목', 
          '제 속', '재 속', '채 속', '제 족', '계목', '세목', '세 목', '제육', '제독', '제옥', '제복', 'subject'
      ];
      
      // 키워드 기반 탐색
      for (const kw of titleKeywords) {
          const idx = fullText.indexOf(kw);
          if (idx !== -1) {
              const fragment = fullText.substring(idx + kw.length, idx + kw.length + 300);
              const lines = fragment.split('\n').map(l => l.trim()).filter(l => l.length > 5);
              if (lines.length > 0) {
                  title = lines[0].replace(/^[:\s\-_=.,]+/, '').trim();
                  if (title) break;
              }
          }
      }

      // 2. 구조 기반 백업 (상단 15줄 중 가장 제목다운 줄 찾기)
      if (!title || title.length < 5) {
          const topLines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 10);
          for (const line of topLines.slice(0, 15)) {
              // 문서번호, 수신처 등 제외하고 가장 긴 줄을 제목으로 추측
              if (!line.includes('시행') && !line.includes('수신') && !line.includes('귀하') && !line.includes('협조') && line.length > 15) {
                  title = line.replace(/^(?:제\s*목|제목|채\s*목|체\s*목|재\s*목|속|목)\s*[:\s\-_=.,]*/, '').trim();
                  break;
              }
          }
      }

      // 3. 문서번호 찾기 (간격 및 오타 대응)
      const docNoKeywords = ['시행', '시 행', '시형', '문서번호', '시 형', '시  행'];
      for (const kw of docNoKeywords) {
          const idx = fullText.indexOf(kw);
          if (idx !== -1) {
              const fragment = fullText.substring(idx, idx + 100);
              const m = fragment.match(/([가-힣a-zA-Z\s]*\([가-힣\s]*\)[-\s]*\d+)/) || fragment.match(/([가-힣\w-]+-\d+)/);
              if (m) {
                  docNo = m[1].replace(/^(?:시행|시 행|시형|문서번호|시 형|시  행)\s*/, '').trim();
                  break;
              }
          }
      }

      // [DEBUG] 인식된 텍스트 일부를 토스트로 보여주기 (문찰 원인 파악용)
      const debugText = fullText.substring(0, 40).replace(/\n/g, ' ');
      helpers.showToast(`분석결과: ${debugText}...`, 'info', 3000);

      // 만약 텍스트 추출로 실패했다면 (스캔된 이미지 PDF인 경우), 첫 페이지를 이미지로 변환하여 AI에게 전달
      if (!title || !docNo) {
        helpers.showToast('이미지 형태의 PDF입니다. AI 분석으로 전환합니다...', 'info');
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        const imgBase64 = canvas.toDataURL('image/jpeg', 0.95);
        return analyzeDraftWithAI(imgBase64);
      }

      // 결과 반영
      if (title) document.getElementById('v-draft-title').value = title;
      if (docNo) document.getElementById('v-draft-doc-no').value = docNo;

      helpers.showToast('PDF에서 정보를 성공적으로 추출했습니다.', 'success');
      prepareVoucher(true);

    } catch (err) {
      console.error('PDF Analysis Failed:', err);
      helpers.showToast('PDF 분석 중 오류가 발생했습니다.', 'warning');
    }
  }

  async function analyzeDraftWithAI(base64Data) {
    try {
      // [최적화] 제목(상단 30%)과 문서번호(하단 30%) 영역만 추출하여 인식 속도 향상
      const optimizedBase64 = await cropImageSections(base64Data, 0.3, 0.3);
      
      // Tesseract.js를 이용한 클라이언트 사이드 OCR
      const result = await Tesseract.recognize(optimizedBase64, 'kor+eng', {
        logger: m => console.log(m)
      });
      
      const fullText = result.data.text;
      console.log('OCR Extracted Text:', fullText);

      let title = '';
      let docNo = '';

      // 1. 제목 찾기 (최대한 공격적인 키워드 및 구조 추적)
      const titleKeywords = [
          '제목', '제 목', '제  목', '제   목', '채목', '체목', '재목', '재 목', '체 목', '채 목', 
          '제 속', '재 속', '채 속', '제 족', '계목', '세목', '세 목', '제육', '제독', '제옥', '제복', 'subject'
      ];
      
      for (const kw of titleKeywords) {
          const idx = fullText.indexOf(kw);
          if (idx !== -1) {
              const fragment = fullText.substring(idx + kw.length, idx + kw.length + 300);
              const lines = fragment.split('\n').map(l => l.trim()).filter(l => l.length > 5);
              if (lines.length > 0) {
                  title = lines[0].replace(/^[:\s\-_=.,]+/, '').trim();
                  if (title) break;
              }
          }
      }

      // 2. 구조 기반 백업 (상단 15줄 중 가장 제목다운 줄 찾기)
      if (!title || title.length < 5) {
          const topLines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 10);
          for (const line of topLines.slice(0, 15)) {
              if (!line.includes('시행') && !line.includes('수신') && !line.includes('귀하') && !line.includes('협조') && line.length > 15) {
                  title = line.replace(/^(?:제\s*목|제목|채\s*목|체\s*목|재\s*목|속|목)\s*[:\s\-_=.,]*/, '').trim();
                  break;
              }
          }
      }

      // 3. 문서번호 찾기 (간격 및 오타 대응)
      const docNoKeywords = ['시행', '시 행', '시형', '문서번호', '시 형', '시  행'];
      for (const kw of docNoKeywords) {
          const idx = fullText.indexOf(kw);
          if (idx !== -1) {
              const fragment = fullText.substring(idx, idx + 100);
              const m = fragment.match(/([가-힣a-zA-Z\s]*\([가-힣\s]*\)[-\s]*\d+)/) || fragment.match(/([가-힣\w-]+-\d+)/);
              if (m) {
                  docNo = m[1].replace(/^(?:시행|시 행|시형|문서번호|시 형|시  행)\s*/, '').trim();
                  break;
              }
          }
      }

      // [DEBUG] 인식된 텍스트 일부를 토스트로 보여주기 (문찰 원인 파악용)
      const debugText = fullText.substring(0, 40).replace(/\n/g, ' ');
      helpers.showToast(`분석결과: ${debugText}...`, 'info', 3000);

      let filledCount = 0;
      if (title) {
        // [오타 교정] EH 00, EH 0 등은 '보고 건'의 오타일 확률이 매우 높음
        const cleanTitle = title.replace(/\s*[A-Z]{1,2}\s*[0O]{1,2}\s*$/, ' 보고 건')
                                .replace(/\s*보고\s*EH\s*/, ' 보고 ')
                                .replace(/\s*EH$/, ' 건')
                                .replace(/\s*보고\s*건\s*보고\s*건$/, ' 보고 건') // 중복 발생 방지
                                .trim();
        document.getElementById('v-draft-title').value = cleanTitle;
        filledCount++;
      }
      if (docNo) {
        // [오타 보정] '단'이 '난'으로 읽히는 경우 보정 및 머리말 제거
        const cleanDocNo = docNo.replace(/난(?=\))/g, '단')
                                .replace(/^(?:시행|시 행|시형|문서번호|시 형|시  행)\s*/, '')
                                .trim();
        document.getElementById('v-draft-doc-no').value = cleanDocNo;
        filledCount++;
      }

      if (filledCount > 0) {
        helpers.showToast(`이미지에서 ${filledCount}개 정보를 인식했습니다.`, 'success');
        prepareVoucher(true);
      } else {
        helpers.showToast('텍스트를 찾지 못했습니다. 화질이 좋은 사진으로 다시 시도해 주세요.', 'info');
      }
    } catch (err) {
      console.error('OCR Failed:', err);
      helpers.showToast('문자 인식에 실패했습니다. 수동으로 입력해 주세요.', 'warning');
    }
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
    
    // 증빙 서류 필수 체크 (내부기안 파일이 있는지 확인)
    if (uploadedFiles.length === 0) {
        if (!isAuto) helpers.showToast('증빙 서류(내부기안 등)를 필수로 첨부해 주세요.', 'error');
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
      ...currentVoucher, // 기존 ID 등 유지
      id: currentVoucher?.id || db.getNextVoucherId(),
      type: type,
      projectName: project?.name || '-',
      projectBank: project?.bankName || '-',
      projectAccount: project?.accountNo || '-',
      totalAmount,
      entries: selected,
      roles: [...selectedRoles],
      approvals: currentVoucher?.approvals || { '담당': true },
      approvalSignatures: currentVoucher?.approvalSignatures || (approverSig ? { '담당': approverSig } : {}),
      approvalNames: currentVoucher?.approvalNames || (approverName ? { '담당': approverName } : {}),
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
      noEvidence: document.getElementById('v-no-evidence')?.checked || false,
      noPayment: document.getElementById('v-no-payment')?.checked || false,
      createdAt: currentVoucher?.createdAt || new Date().toISOString(),
      authorId: currentVoucher?.authorId || currentUser?.username || currentUser?.id || '-',
      authorName: currentVoucher?.authorName || currentUser?.name || '-',
      _saved: !!currentVoucher?._saved
    };
    renderVoucherPreview(currentVoucher);
  }

  function renderVoucherPreview(v) {
    const userSession = window.Auth?.getSession();
    const isAdmin = userSession?.role === 'admin';
    const userRank = userSession?.rank || '';
    const authorInfo = getAuthorInfo(v);
    const isAuthor = userSession && (userSession.username === authorInfo.id || userSession.userId === authorInfo.id);
    const canBypass = isAdmin || isAuthor;

    const headerHtml = `
      <div class="voucher-preview-actions" style="margin-bottom:16px; display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
        <button class="btn" style="background:#ef4444; color:white; border:none; padding:10px 25px; border-radius:30px; font-weight:600; box-shadow:0 4px 10px rgba(239,68,68,0.2); display:inline-flex; align-items:center; gap:8px;" onclick="VoucherModule.printVoucher()">
          <i class="fa-solid fa-print"></i> 인쇄하기
        </button>
        
        ${!v._saved 
          ? `<button class="btn btn-primary" style="padding:10px 25px; border-radius:30px; box-shadow:0 4px 10px rgba(37,99,235,0.2); font-weight:600; display:inline-flex; align-items:center; gap:8px;" onclick="VoucherModule.saveVoucherToDb()">
               <i class="fa-solid fa-save"></i> 결의서 상신
             </button>` 
          : `<div style="display:inline-flex; align-items:center; gap:12px;">
               <div style="background:#f0fdf4; color:#16a34a; padding:10px 25px; border-radius:30px; border:1px solid #bbf7d0; display:inline-flex; align-items:center; gap:8px; font-weight:700; font-size:14px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                 <i class="fa-solid fa-circle-check"></i> 저장된 결의서
               </div>
               <button class="btn" style="background:#6366f1; color:white; border:none; padding:10px 25px; border-radius:30px; font-weight:700; box-shadow:0 4px 10px rgba(99,102,241,0.3); display:inline-flex; align-items:center; gap:8px;" onclick="VoucherModule.saveAndExit()">
                 <i class="fa-solid fa-paper-plane"></i> 재상신하기
               </button>
               ${canBypass ? `
               <button class="btn" style="background:#f59e0b; color:white; border:none; padding:10px 25px; border-radius:30px; font-weight:700; box-shadow:0 4px 10px rgba(245,158,11,0.3); display:inline-flex; align-items:center; gap:8px;" onclick="VoucherModule.executeManualBypass('${v.id}'); VoucherModule.render();">
                 <i class="fa-solid fa-file-signature"></i> 수기결재 통과
               </button>` : ''}
             </div>`
        }
      </div>
    `;
    const docHtml = `
      <div id="voucher-preview-scale-wrapper" style="overflow: hidden; background: #f4f6f8; padding: 20px; border-radius: 8px;">
        <div class="card" style="padding:40px; background:#fff; color:#000; border:1px solid #ddd; box-shadow: 0 10px 30px rgba(0,0,0,0.1); width: 850px; min-width: 850px; margin: 0 auto; transform-origin: top center;">
          ${getVoucherDocHtml(v)}
        </div>
      </div>
    `;

    // 미리보기 영역이 존재하면 업데이트, 아니면 HTML 반환 (조회 화면용)
    const container = document.getElementById('voucher-preview-card');
    if (container) {
      container.innerHTML = headerHtml + docHtml;

      // 축소 로직 적용
      setTimeout(() => adjustVoucherScale(), 50);

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

  // 화면 크기에 맞춰 결의서 미리보기 축소
  function adjustVoucherScale() {
    const wrapper = document.getElementById('voucher-preview-scale-wrapper');
    if (!wrapper) return;
    const card = wrapper.querySelector('.card');
    if (!card) return;

    const availableWidth = wrapper.clientWidth - 40; // 패딩 제외
    const baseWidth = 850;

    if (availableWidth < baseWidth) {
      const scale = availableWidth / baseWidth;
      card.style.transform = `scale(${scale})`;
      // 카드가 축소되면서 생기는 하단 공백 제거 및 높이 보정
      wrapper.style.height = `${card.offsetHeight * scale + 40}px`;
    } else {
      card.style.transform = 'none';
      wrapper.style.height = 'auto';
    }
  }

  // 윈도우 리사이즈 대응
  window.addEventListener('resize', () => {
    if (document.getElementById('voucher-preview-scale-wrapper')) {
      adjustVoucherScale();
    }
  });

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

  function saveAndExit() {
    if (currentVoucher) {
      db.saveVoucher(currentVoucher);
      currentVoucher._saved = true;
    }
    helpers.showToast('결의서가 성공적으로 저장 및 재상신 되었습니다.', 'success');
    render(); // 목록 화면으로 복귀
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
    const v = db.getVoucherById(id);
    if (!v) return;

    const author = getAuthorInfo(v);
    const userSession = window.Auth?.getSession();
    const isAdmin = userSession?.role === 'admin';
    const isAuthor = userSession && (userSession.username === author.id || userSession.userId === author.id);

    if (!isAdmin && !isAuthor) {
      helpers.showToast('본인이 작성한 결의서만 삭제할 수 있습니다.', 'error');
      return;
    }

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

    // 작성자 정보 (회색 영역) - getAuthorInfo를 통해 기존 데이터 소급 적용 포함 추출
    const author = getAuthorInfo(v);
    const authorId = author.id;
    const authorName = author.name;

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
          <span style="font-weight: bold; font-size: 15px; margin-left: 15px;">산단-${v.type==='income'?'수입':'지출'}-${date.getFullYear()}-${String(v.id).split('-').pop().padStart(4, '0')}</span>
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
              <td class="text-center">${v.noEvidence ? '-' : (v.evidenceInfo?.date || '-')}</td>
              <td class="text-center">${v.noEvidence ? '-' : (v.evidenceInfo?.type || '-')}</td>
              <td class="text-center">${v.noEvidence ? '-' : (v.evidenceInfo?.vendor || '-')}</td>
              <td class="text-right">${v.noEvidence ? '-' : helpers.formatCurrencyRaw(v.totalAmount)}</td>
              <td class="text-right">-</td>
              <td class="text-right">-</td>
            </tr>
            <tr class="total-row" style="background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
              <td class="text-center" colspan="3" style="font-weight: 700; background-color: #f2f2f2 !important;">합계</td>
              <td class="text-right" style="font-weight: 700; background-color: #f2f2f2 !important;">${v.noEvidence ? '-' : helpers.formatCurrencyRaw(v.totalAmount)}</td>
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
            ${v.noPayment ? `
                <tr>
                  <td style="text-align:center; background-color: #fff9c4 !important;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:right;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                </tr>
            ` : ((v.paymentInfos && v.paymentInfos.length > 0) 
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
              `)
            }
            <tr class="total-row" style="background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
              <td colspan="3" style="text-align:center; font-weight: 700; background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">지급 합계</td>
              <td style="text-align:right; font-weight: 700; background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${v.noPayment ? '-' : helpers.formatCurrencyRaw(v.totalAmount)}</td>
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
    v.approvalNames = v.approvalNames || {};

    // 작성자 정보를 찾아 서명 복구 시도
    const authorInfo = getAuthorInfo(v);
    const authorUser = (window.Auth?.getUsers() || []).find(u => u.username === authorInfo.id || u.id === authorInfo.id);

    (v.roles || []).forEach(role => {
      v.approvals[role] = true;
      
      if (role === '담당') {
        // 담당(작성자)은 수기결재 시에도 가능하면 실제 서명을 주입
        if (!v.approvalSignatures[role] || v.approvalSignatures[role] === '수기결재') {
          v.approvalSignatures[role] = authorUser?.signature || '수기결재';
          v.approvalNames[role] = authorUser?.name || authorInfo.name;
        }
      } else {
        // 이미 서명이 있는 직위는 유지하고, 나머지만 '수기결재' 표시
        if (!v.approvalSignatures[role]) {
          v.approvalSignatures[role] = '수기결재';
        }
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

  function editVoucher(id) {
    const v = db.getVoucherById(id);
    if (!v) return;

    const author = getAuthorInfo(v);
    const userSession = window.Auth?.getSession();
    const isAdmin = userSession?.role === 'admin';
    const isAuthor = userSession && (userSession.username === author.id || userSession.userId === author.id);

    if (!isAdmin && !isAuthor) {
      helpers.showToast('본인이 작성한 결의서만 수정할 수 있습니다.', 'error');
      return;
    }

    openNewVoucher(null, null, id);
    setTimeout(() => prepareVoucher(true), 100);
  }

  function renderPaymentRowHtml(idx, pi = null) {
    return `
      <div class="v-payment-row" data-idx="${idx}" style="position:relative; padding:15px; border:1px solid #eee; border-radius:8px; margin-bottom:10px; background:#fff;">
        ${idx > 0 ? `<button onclick="VoucherModule.removePaymentRow(this)" style="position:absolute; top:5px; right:5px; border:none; background:none; color:#ef4444; cursor:pointer;" title="삭제">×</button>` : ''}
        <div class="form-grid">
          <div class="form-group">
            <label style="display: inline-block; background: #334155; color: #fff; padding: 2px 10px; border-radius: 4px; margin-bottom: 8px; font-weight: 600; font-size: 13px;">구분</label>
            <select id="v-payment-recipient-type-${idx}" class="form-control" onchange="VoucherModule.prepareVoucher(true)">
              <option value="" ${!pi?.recipientType ? 'selected' : ''}>&lt;선택&gt;</option>
              <option value="거래처(개인)" ${pi?.recipientType === '거래처(개인)' ? 'selected' : ''}>거래처(개인)</option>
              <option value="거래처(사업자)" ${pi?.recipientType === '거래처(사업자)' ? 'selected' : ''}>거래처(사업자)</option>
            </select>
          </div>
          <div class="form-group">
            <label style="display: inline-block; background: #334155; color: #fff; padding: 2px 10px; border-radius: 4px; margin-bottom: 8px; font-weight: 600; font-size: 13px;">지급처</label>
            <input type="text" id="v-payment-recipient-${idx}" class="form-control" oninput="VoucherModule.prepareVoucher(true)" value="${pi?.recipient || ''}">
          </div>
          <div class="form-group">
            <label style="display: inline-block; background: #334155; color: #fff; padding: 2px 10px; border-radius: 4px; margin-bottom: 8px; font-weight: 600; font-size: 13px;">예금주</label>
            <input type="text" id="v-payment-holder-${idx}" class="form-control" oninput="VoucherModule.prepareVoucher(true)" value="${pi?.holder || ''}">
          </div>
          <div class="form-group">
            <label style="display: inline-block; background: #334155; color: #fff; padding: 2px 10px; border-radius: 4px; margin-bottom: 8px; font-weight: 600; font-size: 13px;">금액</label>
            <input type="text" id="v-payment-amount-${idx}" class="form-control" placeholder="0" oninput="helpers.handleAmountInput(this); VoucherModule.prepareVoucher(true)" value="${pi ? helpers.formatCurrencyRaw(pi.amount) : ''}">
          </div>
          <div class="form-group">
            <label style="display: inline-block; background: #334155; color: #fff; padding: 2px 10px; border-radius: 4px; margin-bottom: 8px; font-weight: 600; font-size: 13px;">은행명</label>
            <input type="text" id="v-payment-bank-${idx}" class="form-control" oninput="VoucherModule.prepareVoucher(true)" value="${pi?.bank || ''}">
          </div>
          <div class="form-group">
            <label style="display: inline-block; background: #334155; color: #fff; padding: 2px 10px; border-radius: 4px; margin-bottom: 8px; font-weight: 600; font-size: 13px;">계좌번호</label>
            <input type="text" id="v-payment-account-${idx}" class="form-control" oninput="VoucherModule.prepareVoucher(true)" value="${pi?.account || ''}">
          </div>
          <div class="form-group" style="display:none">
            <label style="display: inline-block; background: #334155; color: #fff; padding: 2px 10px; border-radius: 4px; margin-bottom: 8px; font-weight: 600; font-size: 13px;">지급방법</label>
            <select id="v-payment-method-${idx}" class="form-control">
              <option value="계좌이체" ${(!pi || pi.method === '계좌이체') ? 'selected' : ''}>계좌이체</option>
              <option value="현금" ${pi?.method === '현금' ? 'selected' : ''}>현금</option>
              <option value="기타" ${pi?.method === '기타' ? 'selected' : ''}>기타</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }

    return { 
      render, openNewVoucher, editVoucher, toggleRole, handleFileDrop, handleFileChange, removeFile, 
      toggleEntry, changeType, filterEntries, prepareVoucher, saveVoucherToDb, saveAndExit,
      viewVoucher, deleteVoucher, printVoucher, approveVoucher, executeApproval, executeManualBypass,
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
