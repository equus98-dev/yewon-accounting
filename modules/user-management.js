// modules/user-management.js - 사용자 관리 (관리자 전용)

const UserManagementModule = (() => {

  function render() {
    if (!Auth.isAdmin()) {
      document.getElementById('app-content').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔒</div>
          <p>관리자만 접근할 수 있는 메뉴입니다.</p>
        </div>`;
      return;
    }

    const session = Auth.getSession();

    // 직급 우선순위 정의
    const rankPriority = {
      '단장': 1,
      'RISE사업단장': 2,
      '팀장': 3,
      '팀원': 4
    };

    // 사용자 정렬 로직
    const sortedUsers = [...Auth.getUsers()].sort((a, b) => {
      // 1. 시스템 관리자(admin) 체크 (현재 로그인한 admin 우선)
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (a.role !== 'admin' && b.role === 'admin') return 1;

      // 2. 직급 우선순위 적용
      const priorityA = rankPriority[a.rank] || 99;
      const priorityB = rankPriority[b.rank] || 99;
      if (priorityA !== priorityB) return priorityA - priorityB;

      // 3. 동일 직급 내 사번(아이디) 순 정렬
      return a.username.localeCompare(b.username);
    });

    document.getElementById('app-content').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">사용자 관리</h2>
          <p class="page-subtitle">관리자가 직접 계정을 생성하고 권한을 부여합니다</p>
        </div>
        <button class="btn btn-primary" onclick="UserManagementModule.openAddModal()">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          계정 생성
        </button>
      </div>

      <div class="card">
        <div class="table-wrapper">
          <table class="data-table user-table">
            <thead>
              <tr>
                 <th>이름</th>
                <th>직급</th>
                <th>아이디</th>
                <th>소속/부서</th>
                <th class="text-center">권한</th>
                <th class="text-center">서명</th>
                <th>생성일</th>
                <th class="text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              ${sortedUsers.map(u => `
                <tr>
                  <td>${u.name}${u.id === session?.userId ? ' <span class="badge badge-accent">본인</span>' : ''}</td>
                  <td>${u.rank || '-'}</td>
                  <td>${u.username}</td>
                  <td>${u.department || '-'}</td>
                  <td class="text-center">
                    <span class="badge ${u.role === 'admin' ? 'badge-danger' : 'badge-info'}">
                      ${u.role === 'admin' ? '관리자' : '일반사용자'}
                    </span>
                  </td>
                  <td class="text-center">
                    ${u.signature ? '<span class="text-success" title="서명 등록됨">✅</span>' : '<span class="text-muted" title="서명 없음">❌</span>'}
                  </td>
                  <td>${u.createdAt ? u.createdAt.slice(0, 10) : '-'}</td>
                  <td class="text-center">
                    <div class="action-btns">
                      <button class="btn-icon btn-edit" onclick="UserManagementModule.openEditModal('${u.id}')" title="수정">✏️</button>
                      ${u.id !== session?.userId ? `<button class="btn-icon btn-delete" onclick="UserManagementModule.deleteUser('${u.id}')" title="삭제">🗑️</button>` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card info-card">
        <h4 class="card-title">💡 권한 안내</h4>
        <div class="info-grid">
          <div class="info-item">
            <span class="badge badge-danger">관리자</span>
            <span>모든 기능 접근 + 사용자 계정 관리 가능</span>
          </div>
          <div class="info-item">
            <span class="badge badge-info">일반사용자</span>
            <span>과제 조회, 장부 입력, 결의서 출력 가능 (사용자 관리 불가)</span>
          </div>
        </div>
      </div>

      ${renderModals()}
    `;
  }

  function renderModals() {
    return `
      <div class="modal-overlay" id="user-modal">
        <div class="modal">
          <div class="modal-header">
            <h3 id="user-modal-title">계정 생성</h3>
            <button class="modal-close" onclick="helpers.closeModal('user-modal')">×</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="um-id">
            <div class="form-grid">
              <div class="form-group">
                <label>이름 <span class="required">*</span></label>
                <input type="text" id="um-name" class="form-control" placeholder="홍길동">
              </div>
              <div class="form-group">
                <label>아이디 <span class="required">*</span></label>
                <input type="text" id="um-username" class="form-control" placeholder="영문/숫자 조합">
              </div>
              <div class="form-group">
                <label>비밀번호 <span class="required" id="um-pw-req">*</span></label>
                <input type="password" id="um-password" class="form-control" placeholder="수정 시 변경할 경우만 입력">
              </div>
              <div class="form-group">
                <label>직급 <span class="required">*</span></label>
                <select id="um-rank" class="form-control">
                  <option value="">직급 선택</option>
                  <option value="팀원">팀원</option>
                  <option value="팀장">팀장</option>
                  <option value="RISE사업단장">RISE사업단장</option>
                  <option value="단장">단장</option>
                </select>
              </div>
              <div class="form-group">
                <label>소속/부서</label>
                <input type="text" id="um-department" class="form-control" placeholder="산학협력단">
              </div>
              <div class="form-group full">
                <label>권한 <span class="required">*</span></label>
                <div class="radio-group" style="display:flex; gap:20px; padding:10px 0;">
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="radio" name="um-role" value="user" checked> 일반사용자
                  </label>
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="radio" name="um-role" value="admin"> 관리자
                  </label>
                </div>
              </div>
              <div class="form-group full">
                <label>사용 상태</label>
                <div class="radio-group" style="display:flex; gap:20px; padding:10px 0;">
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="radio" name="um-active" value="true" checked> 활성
                  </label>
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="radio" name="um-active" value="false"> 비활성
                  </label>
                </div>
              </div>
              <div class="form-group full">
                <label>서명 이미지 (PNG/JPG)</label>
                <div style="display:flex; gap:15px; align-items:center; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px;">
                  <div id="um-sig-preview" style="width:60px; height:60px; border:1px solid #cbd5e1; background:#fff; display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius:4px;">
                    <span style="font-size:10px; color:#94a3b8;">미리보기</span>
                  </div>
                  <div style="flex:1">
                    <input type="file" id="um-sig-file" class="form-control" accept="image/*" onchange="UserManagementModule.handleSigFile(this)">
                    <p class="text-xs text-muted" style="margin-top:5px;">투명 배경의 이미지를 권장합니다. (mix-blend-mode: multiply 적용)</p>
                  </div>
                  <button class="btn btn-ghost btn-sm" onclick="UserManagementModule.clearSig()">삭제</button>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="helpers.closeModal('user-modal')">취소</button>
            <button class="btn btn-primary" onclick="UserManagementModule.saveUser()">저장</button>
          </div>
        </div>
      </div>
    `;
  }

  let currentSignature = null;
  function handleSigFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      currentSignature = e.target.result;
      const preview = document.getElementById('um-sig-preview');
      preview.innerHTML = `<img src="${currentSignature}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
    };
    reader.readAsDataURL(file);
  }

  function clearSig() {
    currentSignature = null;
    document.getElementById('um-sig-file').value = '';
    document.getElementById('um-sig-preview').innerHTML = '<span style="font-size:10px; color:#94a3b8;">미리보기</span>';
  }

  function openAddModal() {
    helpers.openModal('user-modal');
    document.getElementById('user-modal-title').textContent = '계정 생성';
    document.getElementById('um-id').value = '';
    document.getElementById('um-name').value = '';
    document.getElementById('um-username').value = '';
    document.getElementById('um-username').readOnly = false;
    document.getElementById('um-pw-req').textContent = '*';
    document.getElementById('um-rank').value = '';
    document.getElementById('um-department').value = '';
    document.querySelector('[name="um-role"][value="user"]').checked = true;
    const activeRadio = document.querySelector('[name="um-active"][value="true"]');
    if (activeRadio) activeRadio.checked = true;
    clearSig();
  }

  function openEditModal(id) {
    const user = Auth.getUsers().find(u => u.id === id);
    if (!user) return;
    openAddModal();
    document.getElementById('user-modal-title').textContent = '계정 수정';
    document.getElementById('um-id').value = user.id;
    document.getElementById('um-name').value = user.name;
    document.getElementById('um-username').value = user.username;
    document.getElementById('um-username').readOnly = true;
    document.getElementById('um-password').placeholder = '변경하지 않으려면 비워두세요';
    document.getElementById('um-pw-req').textContent = '';
    document.getElementById('um-rank').value = user.rank || '';
    document.getElementById('um-department').value = user.department || '';
    document.querySelector(`[name="um-role"][value="${user.role}"]`).checked = true;

    const isActive = user.isActive !== false;
    const activeRadio = document.querySelector(`[name="um-active"][value="${isActive}"]`);
    if (activeRadio) activeRadio.checked = true;

    if (user.signature) {
      currentSignature = user.signature;
      document.getElementById('um-sig-preview').innerHTML = `<img src="${currentSignature}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
    }
  }

  function saveUser() {
    const id = document.getElementById('um-id').value;
    const name = document.getElementById('um-name').value.trim();
    const username = document.getElementById('um-username').value.trim();
    const password = document.getElementById('um-password').value;
    const rank = document.getElementById('um-rank').value;
    const department = document.getElementById('um-department').value.trim();
    const role = document.querySelector('[name="um-role"]:checked')?.value || 'user';
    const isActive = document.querySelector('[name="um-active"]:checked')?.value === 'true';

    if (!name) { helpers.showToast('이름을 입력해 주세요.', 'error'); return; }
    if (!rank) { helpers.showToast('직급을 선택해 주세요.', 'error'); return; }
    if (!username) { helpers.showToast('아이디를 입력해 주세요.', 'error'); return; }
    if (!id && !password) { helpers.showToast('비밀번호를 입력해 주세요.', 'error'); return; }

    let result;
    if (!id) {
      result = Auth.createUser({ username, password, name, role, department, rank, signature: currentSignature, isActive });
    } else {
      const updates = { name, role, department, rank, signature: currentSignature, isActive };
      if (password) updates.password = password;
      result = Auth.updateUser(id, updates);
    }

    if (!result.ok) { helpers.showToast(result.message, 'error'); return; }
    helpers.closeModal('user-modal');
    helpers.showToast(id ? '계정 및 서명이 수정되었습니다.' : '계정 및 서명이 생성되었습니다.');
    render();
    App.refreshSidebar();
  }

  function deleteUser(id) {
    if (!confirm('이 계정을 삭제하시겠습니까?')) return;
    const result = Auth.deleteUser(id);
    if (!result.ok) { helpers.showToast(result.message, 'error'); return; }
    helpers.showToast('계정이 삭제되었습니다.', 'info');
    render();
  }

  function toggleActive(id) {
    Auth.toggleUserActive(id);
    render();
  }

  return { render, openAddModal, openEditModal, saveUser, deleteUser, toggleActive, handleSigFile, clearSig };
})();

window.UserManagementModule = UserManagementModule;
