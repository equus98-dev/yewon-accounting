// modules/schedule.js - 산학협력단 일정관리 모듈

const ScheduleModule = (() => {
  const { db, helpers } = window;
  let calendar = null;

  const CATEGORIES = {
    '사업 마감': { color: '#ff4757', label: '사업 마감' },
    '회계 결산': { color: '#2563eb', label: '회계 결산' },
    '일반 회의': { color: '#2dcc70', label: '일반 회의' },
    '기타 일정': { color: '#747d8c', label: '기타 일정' }
  };

  function render() {
    const mainArea = document.getElementById('app-content');
    mainArea.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">산단 일정관리</h2>
          <p class="page-subtitle">산학협력단 주요 마감 및 회계 일정 현황</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" onclick="ScheduleModule.openAddModal()">
            <i class="fa-solid fa-plus"></i> 일정 추가
          </button>
        </div>
      </div>

      <div class="schedule-container">
        <!-- 좌측: 메인 달력 -->
        <div class="calendar-wrapper card">
          <div id="calendar-main"></div>
        </div>

        <!-- 우측: 요약 패널 -->
        <div class="schedule-side">
          <div class="card weekly-deadlines">
            <h4 class="card-title"><i class="fa-solid fa-thumbtack"></i> 이번 주 주요 마감</h4>
            <div id="weekly-deadline-list" class="deadline-list">
              <!-- JS 렌더링 -->
            </div>
          </div>
          
          <div class="card category-legend">
            <h4 class="card-title">카테고리 안내</h4>
            <div class="legend-items">
              ${Object.entries(CATEGORIES).map(([key, val]) => `
                <div class="legend-item">
                  <span class="legend-dot" style="background: ${val.color}"></span>
                  <span class="legend-label">${val.label}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- 일정 입력 모달 (Premium UI 적용) -->
      <div id="schedule-modal" class="modal-overlay">
        <div class="modal schedule-modal">
          <div class="modal-header">
            <h3 id="modal-title"><i class="fa-solid fa-calendar-plus"></i> 새 일정 등록</h3>
            <button class="modal-close" onclick="ScheduleModule.closeModal()">&times;</button>
          </div>
          <div class="modal-body">
            <form id="schedule-form">
              <input type="hidden" id="sch-id">
              <div class="form-group">
                <label><i class="fa-solid fa-heading"></i> 일정 제목</label>
                <input type="text" id="sch-title" class="form-control" placeholder="예: 사업비 정산 마감" required>
              </div>
              <div class="form-grid">
                <div class="form-group">
                  <label><i class="fa-solid fa-calendar-day"></i> 시작일</label>
                  <input type="date" id="sch-start" class="form-control" required>
                </div>
                <div class="form-group">
                  <label><i class="fa-solid fa-calendar-check"></i> 종료일 (선택)</label>
                  <input type="date" id="sch-end" class="form-control">
                </div>
              </div>
              <div class="form-group">
                <label><i class="fa-solid fa-layer-group"></i> 카테고리</label>
                <select id="sch-category" class="form-control" required>
                  ${Object.keys(CATEGORIES).map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label><i class="fa-solid fa-note-sticky"></i> 상세 내용 (메모)</label>
                <textarea id="sch-desc" class="form-control" rows="3" placeholder="추가 정보를 입력하세요."></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <div class="footer-left">
              <button id="btn-delete-sch" class="btn btn-danger hidden" onclick="ScheduleModule.deleteSchedule()">삭제</button>
            </div>
            <div class="footer-right">
              <button class="btn btn-ghost" onclick="ScheduleModule.closeModal()">취소</button>
              <button class="btn btn-primary" onclick="ScheduleModule.saveSchedule()">저장하기</button>
            </div>
          </div>
        </div>
      </div>
    `;

    initCalendar();
    renderWeeklyDeadlines();
  }

  function initCalendar() {
    const calendarEl = document.getElementById('calendar-main');
    if (!calendarEl) return;

    const schedules = db.getSchedules();
    const events = schedules.map(s => ({
      id: s.id,
      title: s.title,
      start: s.start,
      end: s.end || s.start,
      backgroundColor: CATEGORIES[s.category]?.color || '#747d8c',
      borderColor: 'transparent',
      extendedProps: { ...s }
    }));

    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: 'dayGridMonth',
      locale: 'ko',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,listMonth'
      },
      events: events,
      height: 'auto',
      dateClick: function (info) {
        openAddModal(info.dateStr);
      },
      eventClick: function (info) {
        openEditModal(info.event.extendedProps);
      }
    });

    calendar.render();
  }

  function renderWeeklyDeadlines() {
    const listEl = document.getElementById('weekly-deadline-list');
    if (!listEl) return;

    const schedules = db.getSchedules();
    const now = new Date();
    const weekLater = new Date();
    weekLater.setDate(now.getDate() + 7);

    // 마감 카테고리만 필터링 (7일 이내)
    const deadLines = schedules.filter(s => {
      const d = new Date(s.start);
      return s.category === '사업 마감' && d >= now && d <= weekLater;
    }).sort((a, b) => a.start.localeCompare(b.start));

    if (deadLines.length === 0) {
      listEl.innerHTML = '<p class="empty-msg">이번 주 마감 일정이 없습니다.</p>';
      return;
    }

    listEl.innerHTML = deadLines.map(s => `
      <div class="deadline-item" onclick="ScheduleModule.openEditModalById('${s.id}')">
        <div class="deadline-date">${s.start.substring(5)}</div>
        <div class="deadline-title">${s.title}</div>
      </div>
    `).join('');
  }

  function openAddModal(date) {
    document.getElementById('schedule-form').reset();
    document.getElementById('sch-id').value = '';
    document.getElementById('sch-start').value = date || new Date().toISOString().split('T')[0];
    document.getElementById('modal-title').textContent = '새 일정 등록';
    document.getElementById('btn-delete-sch').classList.add('hidden');
    document.getElementById('schedule-modal').classList.add('active');
  }

  function openEditModal(sch) {
    document.getElementById('sch-id').value = sch.id;
    document.getElementById('sch-title').value = sch.title;
    document.getElementById('sch-start').value = sch.start;
    document.getElementById('sch-end').value = sch.end || '';
    document.getElementById('sch-category').value = sch.category;
    document.getElementById('sch-desc').value = sch.desc || '';

    document.getElementById('modal-title').textContent = '일정 수정';
    document.getElementById('btn-delete-sch').classList.remove('hidden');
    document.getElementById('schedule-modal').classList.add('active');
  }

  function openEditModalById(id) {
    const sch = db.getSchedules().find(s => s.id === id);
    if (sch) openEditModal(sch);
  }

  function closeModal() {
    document.getElementById('schedule-modal').classList.remove('active');
  }

  function saveSchedule() {
    const form = document.getElementById('schedule-form');
    if (!form.reportValidity()) return;

    const sch = {
      id: document.getElementById('sch-id').value,
      title: document.getElementById('sch-title').value,
      start: document.getElementById('sch-start').value,
      end: document.getElementById('sch-end').value,
      category: document.getElementById('sch-category').value,
      desc: document.getElementById('sch-desc').value
    };

    db.saveSchedule(sch);
    helpers.showToast('일정이 저장되었습니다.');
    closeModal();
    render(); // 새로고침
  }

  function deleteSchedule() {
    const id = document.getElementById('sch-id').value;
    if (!id || !confirm('이 일정을 삭제하시겠습니까?')) return;

    db.deleteSchedule(id);
    helpers.showToast('일정이 삭제되었습니다.');
    closeModal();
    render();
  }

  // 대시보드 연동용 함수 (오늘의 일정)
  function getTodaySchedules() {
    const today = new Date().toISOString().split('T')[0];
    return db.getSchedules()
      .filter(s => s.start === today)
      .slice(0, 3);
  }

  return {
    render,
    openAddModal,
    openEditModal,
    openEditModalById,
    closeModal,
    saveSchedule,
    deleteSchedule,
    getTodaySchedules
  };
})();

window.ScheduleModule = ScheduleModule;
