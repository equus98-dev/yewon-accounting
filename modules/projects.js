// modules/projects.js - 과제 마스터 관리

const ProjectsModule = (() => {
  const { db } = window;
  const { helpers } = window;
  let selectedYear = new Date().getFullYear();

  function render() {
    const projects = db.getProjects()
      .filter(p => helpers.isProjectInFiscalYear(p, selectedYear))
      .sort((a, b) => (b.totalBudget || 0) - (a.totalBudget || 0));
    document.getElementById('app-content').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">과제 관리</h2>
          <p class="page-subtitle">연구과제 및 연결 계좌를 등록·관리합니다</p>
        </div>
        <div style="display:flex; align-items:center; gap:15px;">
          <select id="proj-year-select" class="form-control" style="width:120px; font-weight:bold; border-color:var(--primary);" onchange="ProjectsModule.changeYear(this.value)">
            ${[...new Set([2024, 2025, 2026, 2027, 2028, 2029, selectedYear, ...db.getProjects().map(p => p.fiscalYear).filter(Boolean)])].sort((a, b) => b - a).map(y => `<option value="${y}" ${y == selectedYear ? 'selected' : ''}>${y}년도</option>`).join('')}
          </select>
          <button class="btn btn-primary" onclick="ProjectsModule.openAddModal()">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            과제 등록
          </button>
        </div>
      </div>

      <div class="filter-bar card" style="display:flex; justify-content:space-around; padding: 20px; margin-bottom: 24px;">
        <div class="stat-item text-center">
            <div class="text-muted" style="font-size:12px; margin-bottom:4px">전체 과제</div>
            <div class="fw-bold" style="font-size:18px">${projects.length}건</div>
        </div>
        <div style="width:1px; background:var(--border); margin: 0 10px;"></div>
        <div class="stat-item text-center">
            <div class="text-muted" style="font-size:12px; margin-bottom:4px">진행 중</div>
            <div class="fw-bold accent" style="font-size:18px">${projects.filter(p => isActive(p)).length}건</div>
        </div>
        <div style="width:1px; background:var(--border); margin: 0 10px;"></div>
        <div class="stat-item text-center">
            <div class="text-muted" style="font-size:12px; margin-bottom:4px">총 예산</div>
            <div class="fw-bold text-primary" style="font-size:18px">${helpers.formatCurrencyRaw(projects.reduce((s, p) => s + (p.totalBudget || 0), 0))}원</div>
        </div>
      </div>

      <div class="card">
        <div class="table-toolbar">
          <input type="text" class="search-input" placeholder="과제명, 교수명 또는 업무담당 검색..." id="proj-search" oninput="ProjectsModule.search(this.value)">
        </div>
        <div class="table-wrapper">
          <table class="data-table" id="projects-table">
            <thead>
              <tr>
                <th>과제명</th>
                <th class="text-center">참여교수</th>
                <th class="text-center">업무담당</th>
                <th>기간</th>
                <th>사업비계좌</th>
                <th class="text-right">총 예산</th>
                <th class="text-right">수입</th>
                <th class="text-right">지출 금액</th>
                <th class="text-right">잔액(수입-지출)</th>
                <th class="text-center">집행률</th>
                <th class="text-center">상태</th>
                <th class="text-center">관리</th>
              </tr>
            </thead>
            <tbody id="projects-tbody">
              ${renderRows(projects)}
            </tbody>
          </table>
        </div>
      </div>

      ${renderModals()}
    `;
  }

  function renderRows(projects) {
    if (!projects.length) return `<tr><td colspan="10" class="empty-cell">등록된 과제가 없습니다. 과제를 등록해 주세요.</td></tr>`;
    return projects.map(p => {
      const stats = db.getProjectStats(p.id);
      const active = isActive(p);
      return `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td class="text-center">${p.noManager ? '<span style="color:#2563eb;font-weight:600;">자체사업</span>' : (p.manager || '-')}</td>
          <td class="text-center">${p.staff || '-'}</td>
          <td class="text-sm">${p.startDate || ''} ~ ${p.endDate || ''}</td>
          <td class="mono">${p.accountNo || '-'}</td>
          <td class="text-right">${helpers.formatCurrencyRaw(p.totalBudget)}원</td>
          <td class="text-right text-success">${helpers.formatCurrencyRaw(stats?.totalIncome)}원</td>
          <td class="text-right text-danger">${helpers.formatCurrencyRaw(stats?.totalExpense)}원</td>
          <td class="text-right" style="color:${((stats?.totalIncome || 0) - (stats?.totalExpense || 0)) < 0 ? '#e11d48' : '#2563eb'}; font-weight:600;">${((stats?.totalIncome || 0) - (stats?.totalExpense || 0)) < 0 ? '-' : ''}${helpers.formatCurrencyRaw((stats?.totalIncome || 0) - (stats?.totalExpense || 0))}원</td>
          <td class="text-center">
            <div class="progress-bar-wrap">
              <div class="progress-bar" style="width:${Math.min(stats?.executionRate || 0, 100)}%"></div>
              <span class="progress-text">${stats?.executionRate || 0}%</span>
            </div>
          </td>
          <td class="text-center">
            <span class="badge ${active ? 'badge-success' : 'badge-neutral'}">${active ? '진행중' : '완료'}</span>
          </td>
          <td class="text-center">
            <div class="action-btns">
              <button class="btn-icon btn-edit" onclick="ProjectsModule.openEditModal('${p.id}')" title="수정">✏️</button>
              <button class="btn-icon btn-delete" onclick="ProjectsModule.deleteProject('${p.id}')" title="삭제">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderModals() {
    const categories = helpers.DEFAULT_CATEGORIES;
    return `
      <div class="modal-overlay" id="project-modal">
        <div class="modal large">
          <div class="modal-header">
            <h3 id="project-modal-title">과제 등록</h3>
            <button class="modal-close" onclick="helpers.closeModal('project-modal')">×</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="proj-id">
            <div class="form-grid">
              <div class="form-group full">
                <label>과제명 <span class="required">*</span></label>
                <input type="text" id="proj-name" class="form-control" placeholder="예: 2025년 산학협력 전시 프로젝트">
              </div>
              <div class="form-group">
                <label style="display:flex;align-items:center;gap:12px;">
                  참여교수
                  <label style="display:flex;align-items:center;gap:5px;font-weight:normal;font-size:13px;color:var(--text-muted);cursor:pointer;">
                    <input type="checkbox" id="proj-no-manager" style="width:15px;height:15px;cursor:pointer;" onchange="ProjectsModule.toggleNoManager()">
                    <span>참여교수 없음</span>
                  </label>
                </label>
                <input type="text" id="proj-manager" class="form-control" placeholder="교수님 성함">
              </div>
              <div class="form-group">
                <label>업무담당</label>
                <input type="text" id="proj-staff" class="form-control" placeholder="업무 담당자 성함">
              </div>
              <div class="form-group">
                <label>은행명</label>
                <input type="text" id="proj-bank-name" class="form-control" placeholder="예: 국민은행">
              </div>
              <div class="form-group">
                <label>예금주</label>
                <select id="proj-account-holder" class="form-control">
                  <option value="">-- 예금주 선택 --</option>
                  <option value="예원예술대학교 산학협력단(양주캠퍼스)">예원예술대학교 산학협력단(양주캠퍼스)</option>
                  <option value="예원예술대학교 산학협력단(임실캠퍼스)">예원예술대학교 산학협력단(임실캠퍼스)</option>
                </select>
              </div>
              <div class="form-group">
                <label>사업비계좌</label>
                <input type="text" id="proj-account" class="form-control" placeholder="000-0000-0000-00">
              </div>
              <div class="form-group">
                <label>시작일</label>
                <input type="date" id="proj-start" class="form-control">
              </div>
              <div class="form-group">
                <label>종료일</label>
                <input type="date" id="proj-end" class="form-control">
              </div>
              <div class="form-group">
                <label>회계연도 <span class="required">*</span></label>
                <select id="proj-fiscal-year" class="form-control">
                  ${[2024, 2025, 2026, 2027, 2028].map(y => `<option value="${y}" ${y == selectedYear ? 'selected' : ''}>${y}년도</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>총 예산 (원) <span class="required">*</span></label>
                <input type="text" id="proj-budget" class="form-control" placeholder="0" oninput="helpers.handleAmountInput(this)">
              </div>
              <div class="form-group">
                <label>주관 기관</label>
                <input type="text" id="proj-org" class="form-control" placeholder="사업을 발주한 기관명을 입력하세요">
              </div>
              <div class="form-group full">
                <label>비목 설정 (사용할 항목 선택)</label>
                <div class="category-grid" id="proj-category-grid">
                  ${categories.map(c => `
                    <label class="category-chip">
                      <input type="checkbox" name="proj-cats" value="${c}">
                      <span>${c}</span>
                    </label>
                  `).join('')}
                </div>
                <div style="display:flex; gap:8px; margin-top:10px; align-items:center;">
                  <input type="text" id="proj-custom-category" class="form-control" placeholder="직접 입력할 비목명..." style="flex:1; max-width:220px;"
                    onkeydown="if(event.key==='Enter'){event.preventDefault();ProjectsModule.addCustomCategory();}">
                  <button type="button" class="btn btn-primary btn-sm" onclick="ProjectsModule.addCustomCategory()"
                    style="white-space:nowrap; background:linear-gradient(135deg,#6366f1,#8b5cf6); border:none;">
                    + 비목 추가
                  </button>
                </div>
              </div>
              <div class="form-group full">
                <label>비고</label>
                <textarea id="proj-note" class="form-control" rows="2" placeholder="과제 관련 메모"></textarea>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="helpers.closeModal('project-modal')">취소</button>
            <button class="btn btn-primary" onclick="ProjectsModule.saveProject()">저장</button>
          </div>
        </div>
      </div>
    `;
  }

  function isActive(p) {
    if (!p.endDate) return true;
    return new Date(p.endDate) >= new Date();
  }

  function openAddModal() {
    helpers.openModal('project-modal');
    document.getElementById('project-modal-title').textContent = '과제 등록';
    document.getElementById('proj-id').value = '';
    document.getElementById('proj-name').value = '';
    document.getElementById('proj-manager').value = '';
    document.getElementById('proj-staff').value = '';
    document.getElementById('proj-bank-name').value = '';
    document.getElementById('proj-account-holder').value = '';
    document.getElementById('proj-account').value = '';
    document.getElementById('proj-start').value = '';
    document.getElementById('proj-end').value = '';
    document.getElementById('proj-budget').value = '';
    document.getElementById('proj-org').value = '';
    document.getElementById('proj-fiscal-year').value = selectedYear;
    document.getElementById('proj-note').value = '';
    document.querySelectorAll('[name="proj-cats"]').forEach(cb => cb.checked = false);
    document.getElementById('proj-no-manager').checked = false;
    document.getElementById('proj-manager').disabled = false;
    document.getElementById('proj-manager').style.opacity = '1';
  }

  function openEditModal(id) {
    const p = db.getProjectById(id);
    if (!p) return;
    openAddModal();
    document.getElementById('project-modal-title').textContent = '과제 수정';
    document.getElementById('proj-id').value = p.id;
    document.getElementById('proj-name').value = p.name || '';
    document.getElementById('proj-manager').value = p.manager || '';
    document.getElementById('proj-staff').value = p.staff || '';
    document.getElementById('proj-bank-name').value = p.bankName || '';
    document.getElementById('proj-account-holder').value = p.accountHolder || '';
    document.getElementById('proj-account').value = p.accountNo || '';
    document.getElementById('proj-start').value = p.startDate || '';
    document.getElementById('proj-end').value = p.endDate || '';
    document.getElementById('proj-budget').value = p.totalBudget || '';
    document.getElementById('proj-org').value = p.org || '';
    document.getElementById('proj-fiscal-year').value = p.fiscalYear || selectedYear;
    document.getElementById('proj-note').value = p.note || '';
    const cats = p.categories || helpers.DEFAULT_CATEGORIES;
    const defaultCats = helpers.DEFAULT_CATEGORIES;
    // 기본 비목 체크 복원
    document.querySelectorAll('[name="proj-cats"]').forEach(cb => {
      cb.checked = cats.includes(cb.value);
    });
    // 커스텀 비목(기본 목록에 없는 것) 복원
    const customCats = cats.filter(c => !defaultCats.includes(c));
    customCats.forEach(c => _addCategoryChip(c, true));
    // 참여교수 없음 체크박스 복원
    if (p.noManager) {
      document.getElementById('proj-no-manager').checked = true;
      document.getElementById('proj-manager').disabled = true;
      document.getElementById('proj-manager').style.opacity = '0.4';
      document.getElementById('proj-manager').value = '';
    }
  }

  function saveProject() {
    const name = document.getElementById('proj-name').value.trim();
    const noManager = document.getElementById('proj-no-manager').checked;
    const manager = noManager ? '' : document.getElementById('proj-manager').value.trim();
    const budget = helpers.parseAmount(document.getElementById('proj-budget').value);
    if (!name) { helpers.showToast('과제명을 입력해 주세요.', 'error'); return; }
    if (!noManager && !manager) { helpers.showToast('참여교수 성함을 입력하거나 "참여교수 없음"을 체크해 주세요.', 'error'); return; }
    if (!budget || budget <= 0) { helpers.showToast('올바른 예산을 입력해 주세요.', 'error'); return; }

    const cats = [...document.querySelectorAll('[name="proj-cats"]:checked')].map(cb => cb.value);
    const projectId = document.getElementById('proj-id').value || null;

    // 과제명 변경 감지: 수정 모드이고 기존 과제명과 다를 경우 결의서 일괄 업데이트
    if (projectId) {
      const existing = db.getProjectById(projectId);
      if (existing && existing.name !== name) {
        const vouchers = db.getVouchers();
        let updatedCount = 0;
        vouchers.forEach(v => {
          if (v.projectId === projectId || v.projectName === existing.name) {
            v.projectName = name;
            db.saveVoucher(v);
            updatedCount++;
          }
        });
        if (updatedCount > 0) {
          console.log(`[ProjectsModule] 결의서 ${updatedCount}건의 과제명을 "${existing.name}" → "${name}"으로 업데이트했습니다.`);
        }
      }
    }

    const project = {
      id: projectId,
      name,
      manager,
      staff: document.getElementById('proj-staff').value.trim(),
      bankName: document.getElementById('proj-bank-name').value.trim(),
      accountHolder: document.getElementById('proj-account-holder').value.trim(),
      accountNo: document.getElementById('proj-account').value.trim(),
      startDate: document.getElementById('proj-start').value,
      endDate: document.getElementById('proj-end').value,
      totalBudget: budget,
      fiscalYear: parseInt(document.getElementById('proj-fiscal-year').value),
      org: document.getElementById('proj-org').value.trim(),
      note: document.getElementById('proj-note').value.trim(),
      noManager,
      categories: cats
    };

    db.saveProject(project);
    helpers.closeModal('project-modal');
    helpers.showToast(project.id ? '과제가 수정되었습니다.' : '과제가 등록되었습니다.');
    render();
  }

  function deleteProject(id) {
    if (!confirm('과제를 삭제하면 관련 장부 데이터는 유지되지만 과제 정보는 삭제됩니다.\n계속하시겠습니까?')) return;
    db.deleteProject(id);
    helpers.showToast('과제가 삭제되었습니다.', 'info');
    render();
  }

  function addCustomCategory() {
    const input = document.getElementById('proj-custom-category');
    const name = input.value.trim();
    if (!name) { helpers.showToast('비목명을 입력해 주세요.', 'error'); return; }
    // 중복 체크
    const existing = [...document.querySelectorAll('[name="proj-cats"]')].map(cb => cb.value);
    if (existing.includes(name)) { helpers.showToast('이미 존재하는 비목입니다.', 'error'); return; }
    _addCategoryChip(name, true);
    input.value = '';
    input.focus();
  }

  function _addCategoryChip(name, checked) {
    const grid = document.getElementById('proj-category-grid');
    if (!grid) return;
    const label = document.createElement('label');
    label.className = 'category-chip custom-chip';
    label.style.cssText = 'border-color:#6366f1; color:#6366f1;';
    label.innerHTML = `<input type="checkbox" name="proj-cats" value="${name}" ${checked ? 'checked' : ''}><span>${name}</span>`;
    grid.appendChild(label);
  }

  function toggleNoManager() {
    const cb = document.getElementById('proj-no-manager');
    const input = document.getElementById('proj-manager');
    if (cb.checked) {
      input.disabled = true;
      input.style.opacity = '0.4';
      input.value = '';
    } else {
      input.disabled = false;
      input.style.opacity = '1';
    }
  }

  function search(query) {
    const projects = db.getProjects().filter(p =>
      p.name.includes(query) ||
      (p.manager || '').includes(query) ||
      (p.staff || '').includes(query)
    );
    document.getElementById('projects-tbody').innerHTML = renderRows(projects);
  }

  function changeYear(year) {
    selectedYear = parseInt(year);
    render();
  }

  return { render, openAddModal, openEditModal, saveProject, deleteProject, search, changeYear, toggleNoManager, addCustomCategory };
})();

window.ProjectsModule = ProjectsModule;
