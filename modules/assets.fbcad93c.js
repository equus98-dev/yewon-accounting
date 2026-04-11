// modules/assets.js - 자산 관리 모듈

const AssetModule = (() => {
  const { db } = window;
  const { helpers } = window;


  function render() {
    const assets = db.getAssets().sort((a, b) => (b.acquisitionDate || '').localeCompare(a.acquisitionDate || ''));
    const projects = db.getProjects();

    // 요약 정보 계산
    let totalAcq = 0;
    let totalAcc = 0;
    let totalBook = 0;
    assets.forEach(a => {
      const { accumulated, bookValue } = helpers.calculateDepreciation(a);
      totalAcq += helpers.parseAmount(a.acquisitionCost || 0);
      totalAcc += accumulated;
      totalBook += bookValue;
    });

    document.getElementById('app-content').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">자산 관리</h2>
          <p class="page-subtitle">과제비로 구매한 30만 원 이상의 비품 및 장비를 관리합니다</p>
        </div>
      </div>

      <div class="filter-bar card" style="display:flex; justify-content:space-around; padding: 20px; margin-bottom: 24px;">
        <div class="stat-item text-center">
            <div class="text-muted" style="font-size:12px; margin-bottom:4px">총 취득가액</div>
            <div class="fw-bold" style="font-size:18px">${helpers.formatCurrencyRaw(totalAcq)}원</div>
        </div>
        <div style="width:1px; background:var(--border); margin: 0 10px;"></div>
        <div class="stat-item text-center">
            <div class="text-muted" style="font-size:12px; margin-bottom:4px">총 상각누계액</div>
            <div class="fw-bold text-danger" style="font-size:18px">-${helpers.formatCurrencyRaw(totalAcc)}원</div>
        </div>
        <div style="width:1px; background:var(--border); margin: 0 10px;"></div>
        <div class="stat-item text-center">
            <div class="text-muted" style="font-size:12px; margin-bottom:4px">현재 총 장부가액</div>
            <div class="fw-bold text-primary" style="font-size:18px">${helpers.formatCurrencyRaw(totalBook)}원</div>
        </div>
      </div>

      <div class="card">
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:130px">자산번호</th>
                <th class="text-left">자산명 (적요)</th>
                <th style="width:110px">취득가액</th>
                <th style="width:110px">상각누계액</th>
                <th style="width:110px">장부가액</th>
                <th style="width:100px">취득일</th>
                <th style="width:100px">상세</th>
                <th style="width:90px">관리</th>
              </tr>
            </thead>
            <tbody>
              ${assets.length === 0 ? `
                <tr><td colspan="7" class="empty-cell">등록된 자산이 없습니다.</td></tr>
              ` : assets.map(a => {
      const proj = projects.find(p => p.id === a.projectId);
      const { accumulated, bookValue } = helpers.calculateDepreciation(a);
      return `
                  <tr>
                    <td class="mono font-bold">${a.assetNumber}</td>
                    <td class="text-left">
                        <div class="fw-bold">${a.name}</div>
                        <div class="text-muted" style="font-size:11px">${proj ? proj.name : '비사업성 자산'}</div>
                    </td>
                    <td class="text-right">${helpers.formatCurrencyRaw(a.acquisitionCost)}</td>
                    <td class="text-right text-danger">-${helpers.formatCurrencyRaw(accumulated)}</td>
                    <td class="text-right fw-bold text-primary">${helpers.formatCurrencyRaw(bookValue)}</td>
                    <td class="text-center" style="font-size:13px">${a.acquisitionDate}</td>
                    <td class="text-center">
                        <span class="badge ${a.status === '정상' ? 'badge-success' : 'badge-warning'}">${a.status}</span>
                    </td>
                    <td class="text-center">
                      <div class="action-btns" style="justify-content:center">
                        <button class="btn-icon" onclick="AssetModule.openEditModal('${a.id}')" title="수정">✏️</button>
                        <button class="btn-icon text-danger" onclick="AssetModule.deleteAsset('${a.id}')" title="삭제">🗑️</button>
                      </div>
                    </td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      ${renderEditModal()}
    `;
  }

  function renderEditModal() {
    return `
      <div class="modal-overlay" id="asset-modal">
        <div class="modal">
          <div class="modal-header">
            <h3>자산 정보 수정</h3>
            <button class="modal-close" onclick="helpers.closeModal('asset-modal')">×</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="ast-id">
            <div class="form-grid">
              <div class="form-group full">
                <label>자산명</label>
                <input type="text" id="ast-name" class="form-control">
              </div>
              <div class="form-group">
                <label>취득일</label>
                <input type="date" id="ast-date" class="form-control">
              </div>
              <div class="form-group">
                <label>취득가액 (원)</label>
                <input type="text" id="ast-cost" class="form-control" oninput="helpers.handleAmountInput(this)">
              </div>
              <div class="form-group">
                <label>내용연수 (년)</label>
                <input type="number" id="ast-life" class="form-control" placeholder="예: 5" min="1">
              </div>
              <div class="form-group">
                <label>상태</label>
                <select id="ast-status" class="form-control">
                  <option value="정상">정상</option>
                  <option value="수리중">수리중</option>
                  <option value="폐기">폐기</option>
                  <option value="분실">분실</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="helpers.closeModal('asset-modal')">취소</button>
            <button class="btn btn-primary" onclick="AssetModule.saveAsset()">저장</button>
          </div>
        </div>
      </div>
    `;
  }

  function openEditModal(id) {
    const a = db.getAssets().find(x => x.id === id);
    if (!a) return;

    document.getElementById('ast-id').value = a.id;
    document.getElementById('ast-name').value = a.name;
    document.getElementById('ast-date').value = a.acquisitionDate;
    document.getElementById('ast-cost').value = helpers.formatCurrencyRaw(a.acquisitionCost);
    document.getElementById('ast-life').value = a.usefulLife || 5;
    document.getElementById('ast-status').value = a.status || '정상';

    helpers.openModal('asset-modal');
  }

  function saveAsset() {
    const id = document.getElementById('ast-id').value;
    const assets = db.getAssets();
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    asset.name = document.getElementById('ast-name').value;
    asset.acquisitionDate = document.getElementById('ast-date').value;
    asset.acquisitionCost = helpers.parseAmount(document.getElementById('ast-cost').value);
    asset.usefulLife = parseInt(document.getElementById('ast-life').value) || 5;
    asset.status = document.getElementById('ast-status').value;

    db.saveAsset(asset);
    helpers.closeModal('asset-modal');
    helpers.showToast('자산 정보가 수정되었습니다.');
    render();
  }

  function deleteAsset(id) {
    const asset = db.getAssets().find(a => a.id === id);
    if (!asset) return;

    // 장부 지출결의서 존재 여부 확인
    // 자산이 특정 과제(projectId)에 연결되어 있고, 해당 과제에 지출결의서가 있으면 삭제 제한
    if (asset.projectId) {
      const vouchers = db.getVouchers();
      const hasVoucher = vouchers.some(v => {
        // 지출결의서 내의 개별 내역(entries) 중 해당 과제의 내역이 있는지 확인
        // (Voucher 저장 시 과제 정보가 포함됨)
        const project = db.getProjectById(asset.projectId);
        return v.projectName === project?.name;
      });

      if (hasVoucher) {
        alert('이 자산은 관련된 지출결의서(증빙)가 존재하여 삭제할 수 없습니다.\n삭제가 필요한 경우 먼저 해당 지출결의서를 확인해 주세요.');
        return;
      }
    }

    if (!confirm('이 자산 정보를 삭제하시겠습니까?')) return;
    db.deleteAsset(id);
    helpers.showToast('자산 정보가 삭제되었습니다.');
    render();
  }

  return { render, openEditModal, saveAsset, deleteAsset };
})();

window.AssetModule = AssetModule;
