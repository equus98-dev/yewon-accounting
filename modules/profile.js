// modules/profile.js - 마이페이지 (개인 프로필 관리)

const ProfileModule = (() => {

    let uploadedSignature = null;

    function render() {
        const session = Auth.getSession();
        if (!session) return;

        const user = Auth.getUsers().find(u => u.id === session.userId);
        if (!user) return;

        uploadedSignature = user.signature || null;

        document.getElementById('app-content').innerHTML = `
            <div class="page-header">
                <div>
                    <h2 class="page-title">마이페이지</h2>
                    <p class="page-subtitle">본인의 프로필 정보와 비밀번호를 관리합니다</p>
                </div>
            </div>

            <div class="profile-layout">
                <div class="profile-card-col">
                    <div class="card profile-main-card">
                        <div class="profile-header-bg"></div>
                        <div class="profile-avatar-large">
                            <i class="fa-solid fa-user-tie"></i>
                        </div>
                        <div class="profile-basics">
                            <h3 class="profile-name">${user.name}</h3>
                            <p class="profile-role-badge">${user.role === 'admin' ? '시스템 관리자' : '일반 사용자'}</p>
                            <div class="profile-meta-info">
                                <span><i class="fa-solid fa-id-card"></i> ${user.username}</span>
                                <span><i class="fa-solid fa-building"></i> ${user.department || '소속 미지정'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="profile-form-col">
                    <div class="card">
                        <div class="card-header">
                            <h4 class="card-title">기본 정보 수정</h4>
                        </div>
                        <div class="form-grid">
                            <div class="form-group">
                                <label>이름</label>
                                <input type="text" id="prof-name" class="form-control" value="${user.name}">
                            </div>
                            <div class="form-group">
                                <label>소속/부서</label>
                                <input type="text" id="prof-dept" class="form-control" value="${user.department || ''}">
                            </div>
                            <div class="form-group">
                                <label>직급</label>
                                <select id="prof-rank" class="form-control">
                                    <option value="">직급 선택</option>
                                    <option value="팀원" ${user.rank === '팀원' ? 'selected' : ''}>팀원</option>
                                    <option value="팀장" ${user.rank === '팀장' ? 'selected' : ''}>팀장</option>
                                    <option value="RISE사업단장" ${user.rank === 'RISE사업단장' ? 'selected' : ''}>RISE사업단장</option>
                                    <option value="산학협력단장" ${user.rank === '산학협력단장' ? 'selected' : ''}>산학협력단장</option>
                                    <option value="총장" ${user.rank === '총장' ? 'selected' : ''}>총장</option>
                                </select>
                            </div>
                            <div class="form-group" style="grid-column: 1 / -1;">
                                <label>결재 서명 (이미지 형식)</label>
                                <input type="file" id="prof-signature" class="form-control" accept="image/*" onchange="ProfileModule.previewSignature(this)">
                                <div style="margin-top:10px;">
                                    <img id="prof-sig-preview" src="${user.signature || ''}" style="max-height:80px; border:1px solid #ddd; padding:5px; background:#fff; object-fit:contain; ${user.signature ? '' : 'display:none;'}">
                                </div>
                            </div>
                        </div>
                        <div class="card-footer-actions">
                            <button class="btn btn-primary" onclick="ProfileModule.updateProfile()">프로필 저장</button>
                        </div>
                    </div>

                    <div class="card" style="margin-top:20px;">
                        <div class="card-header">
                            <h4 class="card-title">비밀번호 변경</h4>
                        </div>
                        <div class="form-grid">
                            <div class="form-group">
                                <label>새 비밀번호</label>
                                <input type="password" id="prof-pw" class="form-control" placeholder="변경할 경우에만 입력">
                            </div>
                            <div class="form-group">
                                <label>비밀번호 확인</label>
                                <input type="password" id="prof-pw-confirm" class="form-control" placeholder="비밀번호 다시 입력">
                            </div>
                        </div>
                        <div class="card-footer-actions">
                            <button class="btn btn-neutral" onclick="ProfileModule.updatePassword()">비밀번호 변경</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function previewSignature(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedSignature = e.target.result;
            const img = document.getElementById('prof-sig-preview');
            img.src = uploadedSignature;
            img.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    function updateProfile() {
        const session = Auth.getSession();
        const name = document.getElementById('prof-name').value.trim();
        const department = document.getElementById('prof-dept').value.trim();
        const rank = document.getElementById('prof-rank').value;

        if (!name) { helpers.showToast('이름을 입력해 주세요.', 'error'); return; }

        const result = Auth.updateUser(session.userId, { name, department, rank, signature: uploadedSignature });
        if (result.ok) {
            Auth.refreshSession();
            helpers.showToast('프로필 정보가 수정되었습니다.');
            App.refreshSidebar();
            render();
        } else {
            helpers.showToast(result.message, 'error');
        }
    }

    function updatePassword() {
        const session = Auth.getSession();
        const pw = document.getElementById('prof-pw').value;
        const pwConfirm = document.getElementById('prof-pw-confirm').value;

        if (!pw) { helpers.showToast('새 비밀번호를 입력해 주세요.', 'error'); return; }
        if (pw !== pwConfirm) { helpers.showToast('비밀번호가 일치하지 않습니다.', 'error'); return; }

        const result = Auth.updateUser(session.userId, { password: pw });
        if (result.ok) {
            helpers.showToast('비밀번호가 변경되었습니다. 다음에 로그인할 때 사용해 주세요.');
            document.getElementById('prof-pw').value = '';
            document.getElementById('prof-pw-confirm').value = '';
        } else {
            helpers.showToast(result.message, 'error');
        }
    }

    return { render, updateProfile, updatePassword, previewSignature };
})();

window.ProfileModule = ProfileModule;
