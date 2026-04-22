// modules/maintenance.js - 유지보수 요청 게시판 모듈

const MaintenanceModule = (() => {
  const STATUS_CONFIG = {
    pending:    { label: '접수대기', color: '#64748b', bg: '#f1f5f9', icon: 'fa-solid fa-clock' },
    inprogress: { label: '진행중',   color: '#f59e0b', bg: '#fffbeb', icon: 'fa-solid fa-spinner fa-spin' },
    done:       { label: '처리완료', color: '#10b981', bg: '#ecfdf5', icon: 'fa-solid fa-circle-check' },
    rejected:   { label: '처리불가', color: '#e11d48', bg: '#fff1f2', icon: 'fa-solid fa-circle-xmark' },
  };

  const PRIORITY_CONFIG = {
    low:    { label: '낮음',  color: '#64748b' },
    medium: { label: '보통',  color: '#3b82f6' },
    high:   { label: '높음',  color: '#f59e0b' },
    urgent: { label: '긴급',  color: '#e11d48' },
  };

  let currentFilter = 'all';
  let searchKeyword = '';

  // ── 렌더링 ──────────────────────────────────────────────
  function render() {
    const session = Auth.getSession();
    const isAdmin = session?.role === 'admin';
    const tickets = db.getMaintenanceTickets();

    document.getElementById('app-content').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title"><i class="fa-solid fa-screwdriver-wrench" style="color:#f59e0b;"></i> 유지보수 요청 게시판</h2>
          <p class="page-subtitle">시스템 개선 요청, 오류 신고, 기능 문의를 등록해 주세요.</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" id="btn-new-ticket" onclick="MaintenanceModule.openNewTicketModal()">
            <i class="fa-solid fa-plus"></i> 새 요청 등록
          </button>
        </div>
      </div>

      <!-- 통계 카드 -->
      <div class="mnt-stats-row" id="mnt-stats-row"></div>

      <!-- 필터 & 검색 -->
      <div class="mnt-toolbar card" style="margin-bottom:16px; padding: 14px 20px;">
        <div class="mnt-filter-btns" id="mnt-filter-btns">
          <button class="mnt-filter-btn ${currentFilter==='all'?'active':''}" onclick="MaintenanceModule.setFilter('all')">전체</button>
          <button class="mnt-filter-btn ${currentFilter==='pending'?'active':''}" onclick="MaintenanceModule.setFilter('pending')">접수대기</button>
          <button class="mnt-filter-btn ${currentFilter==='inprogress'?'active':''}" onclick="MaintenanceModule.setFilter('inprogress')">진행중</button>
          <button class="mnt-filter-btn ${currentFilter==='done'?'active':''}" onclick="MaintenanceModule.setFilter('done')">처리완료</button>
          <button class="mnt-filter-btn ${currentFilter==='rejected'?'active':''}" onclick="MaintenanceModule.setFilter('rejected')">처리불가</button>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <div style="position:relative;">
            <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#94a3b8;font-size:13px;"></i>
            <input type="text" id="mnt-search" class="form-control" placeholder="제목 또는 내용 검색..."
              style="padding-left:32px; min-width:220px;"
              value="${searchKeyword}"
              oninput="MaintenanceModule.onSearch(this.value)">
          </div>
        </div>
      </div>

      <!-- 게시판 목록 -->
      <div id="mnt-ticket-list"></div>

      <!-- 새 요청 등록 모달 -->
      <div id="mnt-new-modal" class="modal-overlay">
        <div class="modal mnt-modal">
          <div class="modal-header">
            <h3><i class="fa-solid fa-screwdriver-wrench"></i> 유지보수 요청 등록</h3>
            <button class="modal-close" onclick="MaintenanceModule.closeNewModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label><i class="fa-solid fa-heading"></i> 제목 <span style="color:#e11d48">*</span></label>
              <input type="text" id="mnt-title" class="form-control" placeholder="요청 사항을 간략히 입력하세요" maxlength="100">
            </div>
            <div class="form-group">
              <label><i class="fa-solid fa-list"></i> 유형</label>
              <select id="mnt-type" class="form-control">
                <option value="bug">🐛 오류/버그 신고</option>
                <option value="feature">✨ 기능 개선 요청</option>
                <option value="inquiry">❓ 기능 문의</option>
                <option value="other">📌 기타</option>
              </select>
            </div>
            <div class="form-group">
              <label><i class="fa-solid fa-flag"></i> 우선순위</label>
              <select id="mnt-priority" class="form-control">
                <option value="low">낮음</option>
                <option value="medium" selected>보통</option>
                <option value="high">높음</option>
                <option value="urgent">긴급</option>
              </select>
            </div>
            <div class="form-group">
              <label><i class="fa-solid fa-align-left"></i> 상세 내용 <span style="color:#e11d48">*</span></label>
              <textarea id="mnt-content" class="form-control" rows="5"
                placeholder="문제 상황, 재현 방법, 원하는 기능 등을 상세히 설명해 주세요."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="MaintenanceModule.closeNewModal()">취소</button>
            <button class="btn btn-primary" onclick="MaintenanceModule.submitTicket()">
              <i class="fa-solid fa-paper-plane"></i> 등록하기
            </button>
          </div>
        </div>
      </div>

      <!-- 상세/댓글 모달 -->
      <div id="mnt-detail-modal" class="modal-overlay">
        <div class="modal mnt-modal mnt-detail-modal">
          <div class="modal-header" id="mnt-detail-header">
            <h3 id="mnt-detail-title"><i class="fa-solid fa-ticket"></i> 요청 상세</h3>
            <button class="modal-close" onclick="MaintenanceModule.closeDetailModal()">&times;</button>
          </div>
          <div class="modal-body" id="mnt-detail-body" style="max-height:75vh; overflow-y:auto;"></div>
        </div>
      </div>
    `;

    renderStats();
    renderTicketList();
  }

  // ── 통계 카드 ──
  function renderStats() {
    const tickets = db.getMaintenanceTickets();
    const stats = {
      total:      tickets.length,
      pending:    tickets.filter(t => t.status === 'pending').length,
      inprogress: tickets.filter(t => t.status === 'inprogress').length,
      done:       tickets.filter(t => t.status === 'done').length,
      rejected:   tickets.filter(t => t.status === 'rejected').length,
    };

    const el = document.getElementById('mnt-stats-row');
    if (!el) return;
    el.innerHTML = `
      <div class="mnt-stat-card" style="border-left:4px solid #6366f1;" onclick="MaintenanceModule.setFilter('all')">
        <div class="mnt-stat-icon" style="background:#eef2ff; color:#6366f1;"><i class="fa-solid fa-list-check"></i></div>
        <div class="mnt-stat-info">
          <div class="mnt-stat-num">${stats.total}</div>
          <div class="mnt-stat-label">전체 요청</div>
        </div>
      </div>
      <div class="mnt-stat-card" style="border-left:4px solid #64748b;" onclick="MaintenanceModule.setFilter('pending')">
        <div class="mnt-stat-icon" style="background:#f1f5f9; color:#64748b;"><i class="fa-solid fa-clock"></i></div>
        <div class="mnt-stat-info">
          <div class="mnt-stat-num">${stats.pending}</div>
          <div class="mnt-stat-label">접수대기</div>
        </div>
      </div>
      <div class="mnt-stat-card" style="border-left:4px solid #f59e0b;" onclick="MaintenanceModule.setFilter('inprogress')">
        <div class="mnt-stat-icon" style="background:#fffbeb; color:#f59e0b;"><i class="fa-solid fa-gear fa-spin"></i></div>
        <div class="mnt-stat-info">
          <div class="mnt-stat-num">${stats.inprogress}</div>
          <div class="mnt-stat-label">진행중</div>
        </div>
      </div>
      <div class="mnt-stat-card" style="border-left:4px solid #10b981;" onclick="MaintenanceModule.setFilter('done')">
        <div class="mnt-stat-icon" style="background:#ecfdf5; color:#10b981;"><i class="fa-solid fa-circle-check"></i></div>
        <div class="mnt-stat-info">
          <div class="mnt-stat-num">${stats.done}</div>
          <div class="mnt-stat-label">처리완료</div>
        </div>
      </div>
      <div class="mnt-stat-card" style="border-left:4px solid #e11d48;" onclick="MaintenanceModule.setFilter('rejected')">
        <div class="mnt-stat-icon" style="background:#fff1f2; color:#e11d48;"><i class="fa-solid fa-circle-xmark"></i></div>
        <div class="mnt-stat-info">
          <div class="mnt-stat-num">${stats.rejected}</div>
          <div class="mnt-stat-label">처리불가</div>
        </div>
      </div>
    `;
  }

  // ── 목록 렌더링 ──
  function renderTicketList() {
    const el = document.getElementById('mnt-ticket-list');
    if (!el) return;

    let tickets = db.getMaintenanceTickets();

    // 필터
    if (currentFilter !== 'all') tickets = tickets.filter(t => t.status === currentFilter);

    // 검색
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      tickets = tickets.filter(t =>
        t.title.toLowerCase().includes(kw) ||
        t.content.toLowerCase().includes(kw)
      );
    }

    // 최신 순 정렬
    tickets = tickets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (tickets.length === 0) {
      el.innerHTML = `
        <div class="card" style="text-align:center; padding: 60px 20px; color:#94a3b8;">
          <div style="font-size:48px; margin-bottom:16px;">📋</div>
          <p style="font-size:16px; font-weight:500;">등록된 요청이 없습니다.</p>
          <p style="font-size:13px; margin-top:4px;">새 요청 등록 버튼을 눌러 첫 번째 요청을 등록해 보세요.</p>
        </div>
      `;
      return;
    }

    const TYPE_LABELS = { bug:'🐛 버그', feature:'✨ 개선', inquiry:'❓ 문의', other:'📌 기타' };

    el.innerHTML = `
      <div class="mnt-ticket-list-wrap">
        ${tickets.map((t, idx) => {
          const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.pending;
          const pc = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium;
          const commentCount = (t.comments || []).length;
          const createdDate = t.createdAt ? t.createdAt.substring(0, 10) : '';
          const isNew = !t.lastReadAt || t.comments?.some(c => c.createdAt > (t.lastReadAt || ''));

          return `
            <div class="mnt-ticket-row" onclick="MaintenanceModule.openDetail('${t.id}')"
              style="animation-delay: ${idx * 40}ms">
              <div class="mnt-ticket-status-badge" style="background:${sc.bg}; color:${sc.color}; border:1px solid ${sc.color}33;">
                <i class="${sc.icon}"></i> ${sc.label}
              </div>
              <div class="mnt-ticket-main">
                <div class="mnt-ticket-title-row">
                  <span class="mnt-ticket-title">${t.title}</span>
                  ${isNew && commentCount > 0 ? `<span class="mnt-new-badge">NEW</span>` : ''}
                  <span class="mnt-ticket-type">${TYPE_LABELS[t.type] || t.type}</span>
                </div>
                <div class="mnt-ticket-meta">
                  <span><i class="fa-solid fa-user"></i> ${t.authorName}</span>
                  <span><i class="fa-solid fa-calendar"></i> ${createdDate}</span>
                  <span style="color:${pc.color}; font-weight:600;"><i class="fa-solid fa-flag"></i> ${pc.label}</span>
                  <span><i class="fa-solid fa-comment"></i> 댓글 ${commentCount}개</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // ── 필터 & 검색 ──
  function setFilter(filter) {
    currentFilter = filter;
    render();
  }

  function onSearch(value) {
    searchKeyword = value;
    renderTicketList();
  }

  // ── 새 요청 등록 ──
  function openNewTicketModal() {
    document.getElementById('mnt-title').value = '';
    document.getElementById('mnt-content').value = '';
    document.getElementById('mnt-type').value = 'bug';
    document.getElementById('mnt-priority').value = 'medium';
    document.getElementById('mnt-new-modal').classList.add('active');
    setTimeout(() => document.getElementById('mnt-title').focus(), 100);
  }

  function closeNewModal() {
    document.getElementById('mnt-new-modal').classList.remove('active');
  }

  function submitTicket() {
    const title = document.getElementById('mnt-title').value.trim();
    const content = document.getElementById('mnt-content').value.trim();
    const type = document.getElementById('mnt-type').value;
    const priority = document.getElementById('mnt-priority').value;

    if (!title) { helpers.showToast('제목을 입력해 주세요.', 'warning'); return; }
    if (!content) { helpers.showToast('상세 내용을 입력해 주세요.', 'warning'); return; }

    const session = Auth.getSession();
    db.saveMaintenanceTicket({
      title, content, type, priority,
      status: 'pending',
      authorId: session?.username || 'unknown',
      authorName: session?.name || '알 수 없음',
      comments: []
    });

    helpers.showToast('요청이 등록되었습니다. 개발자가 확인 후 처리해 드립니다.', 'success');
    closeNewModal();
    render();
  }

  // ── 상세 모달 ──
  function openDetail(ticketId) {
    const ticket = db.getMaintenanceTickets().find(t => t.id === ticketId);
    if (!ticket) return;

    const session = Auth.getSession();
    const isAdmin = session?.role === 'admin';
    const sc = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.pending;
    const pc = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
    const TYPE_LABELS = { bug:'🐛 버그', feature:'✨ 개선', inquiry:'❓ 문의', other:'📌 기타' };

    // 읽음 처리 (타임스탬프 갱신)
    ticket.lastReadAt = new Date().toISOString();
    db.saveMaintenanceTicket(ticket);

    const bodyEl = document.getElementById('mnt-detail-body');
    const titleEl = document.getElementById('mnt-detail-title');

    titleEl.innerHTML = `<i class="fa-solid fa-ticket"></i> 요청 상세`;

    bodyEl.innerHTML = `
      <!-- 티켓 기본 정보 -->
      <div class="mnt-detail-head">
        <div class="mnt-detail-title-row">
          <h3 class="mnt-detail-ticket-title">${ticket.title}</h3>
          <span class="mnt-ticket-status-badge" style="background:${sc.bg}; color:${sc.color}; border:1px solid ${sc.color}33; white-space:nowrap;">
            <i class="${sc.icon}"></i> ${sc.label}
          </span>
        </div>
        <div class="mnt-ticket-meta" style="margin-top:8px;">
          <span><i class="fa-solid fa-user"></i> ${ticket.authorName}</span>
          <span><i class="fa-solid fa-calendar"></i> ${ticket.createdAt?.substring(0,10)}</span>
          <span><i class="fa-solid fa-tag"></i> ${TYPE_LABELS[ticket.type] || ticket.type}</span>
          <span style="color:${pc.color}; font-weight:600;"><i class="fa-solid fa-flag"></i> ${pc.label}</span>
        </div>
      </div>

      <div class="mnt-detail-content">${escapeHtml(ticket.content).replace(/\n/g,'<br>')}</div>

      <!-- 관리자 상태 변경 -->
      ${isAdmin ? `
        <div class="mnt-admin-panel card" style="margin-bottom:20px; padding:16px; background:linear-gradient(135deg,#1e293b,#0f172a); border:1px solid #334155;">
          <div style="color:#94a3b8; font-size:12px; font-weight:600; letter-spacing:1px; margin-bottom:12px;">
            <i class="fa-solid fa-shield-halved" style="color:#f59e0b;"></i> 관리자 패널
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${Object.entries(STATUS_CONFIG).map(([key, cfg]) => `
              <button class="btn ${ticket.status === key ? 'btn-primary' : 'btn-ghost'} btn-sm"
                style="${ticket.status === key ? `background:${cfg.color}; border-color:${cfg.color};` : `color:${cfg.color}; border-color:${cfg.color}33;`}"
                onclick="MaintenanceModule.changeStatus('${ticket.id}', '${key}')">
                <i class="${cfg.icon}"></i> ${cfg.label}
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 댓글 목록 -->
      <div class="mnt-comments-section">
        <h4 style="font-size:14px; font-weight:700; color:var(--text-primary); margin-bottom:12px; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-comments"></i> 댓글
          <span style="background:#e2e8f0; color:#64748b; border-radius:99px; padding:1px 10px; font-size:12px;">${(ticket.comments||[]).length}</span>
        </h4>
        <div id="mnt-comments-list">
          ${renderComments(ticket.comments || [], isAdmin)}
        </div>
      </div>

      <!-- 댓글 작성 -->
      <div class="mnt-comment-form">
        ${isAdmin ? `
          <div class="mnt-comment-admin-indicator">
            <i class="fa-solid fa-shield-halved"></i> 개발자/관리자 답변
          </div>
        ` : ''}
        <textarea id="mnt-comment-input" class="form-control" rows="3"
          placeholder="${isAdmin ? '관리자 답변을 작성하세요...' : '댓글을 작성하세요...'}"></textarea>
        <div style="display:flex; justify-content:flex-end; margin-top:8px;">
          <button class="btn btn-primary btn-sm" onclick="MaintenanceModule.submitComment('${ticket.id}')">
            <i class="fa-solid fa-paper-plane"></i> ${isAdmin ? '답변 등록' : '댓글 등록'}
          </button>
        </div>
      </div>
    `;

    document.getElementById('mnt-detail-modal').classList.add('active');
  }

  function renderComments(comments, isAdmin) {
    if (!comments || comments.length === 0) {
      return `<div style="text-align:center; padding:24px; color:#94a3b8; font-size:13px;">
        <i class="fa-regular fa-comment" style="font-size:24px; margin-bottom:8px; display:block;"></i>
        아직 댓글이 없습니다.
      </div>`;
    }

    return comments.map(c => {
      const isDevComment = c.isAdmin;
      return `
        <div class="mnt-comment ${isDevComment ? 'mnt-comment-admin' : ''}">
          <div class="mnt-comment-header">
            <span class="mnt-comment-author">
              ${isDevComment
                ? `<i class="fa-solid fa-shield-halved" style="color:#f59e0b;"></i> ${c.authorName} <span class="mnt-dev-tag">개발자</span>`
                : `<i class="fa-solid fa-user" style="color:#6366f1;"></i> ${c.authorName}`
              }
            </span>
            <span class="mnt-comment-date">${c.createdAt?.substring(0,16).replace('T',' ')}</span>
          </div>
          <div class="mnt-comment-body">${escapeHtml(c.content).replace(/\n/g,'<br>')}</div>
        </div>
      `;
    }).join('');
  }

  function closeDetailModal() {
    document.getElementById('mnt-detail-modal').classList.remove('active');
    renderTicketList(); // NEW 뱃지 업데이트
    renderStats();
  }

  function changeStatus(ticketId, newStatus) {
    const tickets = db.getMaintenanceTickets();
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    ticket.status = newStatus;
    ticket.updatedAt = new Date().toISOString();
    db.saveMaintenanceTicket(ticket);
    helpers.showToast(`상태가 "${STATUS_CONFIG[newStatus].label}"(으)로 변경되었습니다.`, 'success');
    openDetail(ticketId); // 새로고침
    renderStats();
  }

  function submitComment(ticketId) {
    const content = document.getElementById('mnt-comment-input').value.trim();
    if (!content) { helpers.showToast('댓글 내용을 입력해 주세요.', 'warning'); return; }

    const session = Auth.getSession();
    const isAdmin = session?.role === 'admin';

    const tickets = db.getMaintenanceTickets();
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    if (!ticket.comments) ticket.comments = [];
    ticket.comments.push({
      id: 'cmt_' + Date.now(),
      content,
      authorId: session?.username || 'unknown',
      authorName: session?.name || '알 수 없음',
      isAdmin,
      createdAt: new Date().toISOString()
    });

    // 관리자 댓글 시 상태가 pending이면 inprogress로 자동 변경
    if (isAdmin && ticket.status === 'pending') {
      ticket.status = 'inprogress';
    }

    ticket.updatedAt = new Date().toISOString();
    db.saveMaintenanceTicket(ticket);
    helpers.showToast('댓글이 등록되었습니다.', 'success');
    openDetail(ticketId);
    renderStats();
  }

  // ── 유틸 ──
  function escapeHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── 사이드바 뱃지 카운트 반환 ──
  function getPendingCount() {
    const tickets = db.getMaintenanceTickets();
    return tickets.filter(t => t.status === 'pending').length;
  }

  return {
    render,
    openNewTicketModal, closeNewModal, submitTicket,
    openDetail, closeDetailModal,
    changeStatus, submitComment,
    setFilter, onSearch,
    getPendingCount
  };
})();

window.MaintenanceModule = MaintenanceModule;
