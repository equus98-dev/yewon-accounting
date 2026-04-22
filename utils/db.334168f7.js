// utils/db.js - 메모리 캐시 + Cloudflare D1 API 연동 데이터 관리

const DB_KEYS = {
  PROJECTS: 'yw_projects',
  LEDGER: 'yw_ledger',
  BANK_CONFIGS: 'yw_bank_configs',
  SETTINGS: 'yw_settings',
  BUDGET: 'yw_budget',
  VOUCHERS: 'yw_vouchers',
  PROJECT_BUDGET: 'yw_project_budget',
  SCHEDULES: 'yw_schedules',
  ASSETS: 'yw_assets',
  MAINTENANCE: 'yw_maintenance'
};

const db = {
  _cache: null, // 메모리 캐시 (초기 로딩 전 null)

  // ───── 초기화 ─────
  async init() {
    try {
      const response = await fetch('/api/data/load');
      if (response.ok) {
        const data = await response.json();
        this._cache = data || {};
        console.log('DB init complete: Data loaded from D1');
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to init DB from API:', e);
    }
  },

  // ───── Generic ─────
  _get(key) {
    if (this._cache === null) {
      console.warn('DB not initialized yet. Returning empty array for key:', key);
      return [];
    }
    return this._cache[key] || [];
  },
  _set(key, data) {
    if (this._cache === null) {
      console.error('Fatal: Cannot save data before DB initialization. Key:', key);
      helpers.showToast('데이터 로딩이 끝나지 않았습니다. 잠시 후 다시 시도해 주세요.', 'error');
      return;
    }
    this._cache[key] = data; // 캐시 즉시 업데이트
    this._setDirect(key, data);
  },
  _setDirect(key, data) {
    fetch('/api/data/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: data })
    }).then(res => {
      if (!res.ok) console.error(`Failed to save ${key} to D1`);
    }).catch(err => console.error(`Error saving ${key}:`, err));
  },

  // ───── Projects (과제) ─────
  // (이하 함수들은 기존과 로직 동일, 내부에서 _get/_set 사용)
  getProjects() { return this._get(DB_KEYS.PROJECTS); },
  saveProject(project) {
    const list = this.getProjects();
    if (!project.id) {
      project.id = 'proj_' + Date.now();
      project.createdAt = new Date().toISOString();
      list.push(project);
    } else {
      const idx = list.findIndex(p => p.id === project.id);
      if (idx !== -1) list[idx] = project;
    }
    this._set(DB_KEYS.PROJECTS, list);
    return project;
  },
  deleteProject(id) {
    const list = this.getProjects().filter(p => p.id !== id);
    this._set(DB_KEYS.PROJECTS, list);
  },
  getProjectByAccount(accountNo) {
    return this.getProjects().find(p => p.accountNo === accountNo);
  },
  getProjectById(id) {
    return this.getProjects().find(p => p.id === id);
  },

  // ───── Ledger (장부) ─────
  getLedger(projectId) {
    const all = this._get(DB_KEYS.LEDGER);
    if (projectId) return all.filter(l => l.projectId === projectId);
    return all;
  },
  saveLedgerEntry(entry) {
    const list = this._get(DB_KEYS.LEDGER);
    if (!entry.id) {
      entry.id = 'led_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      entry.createdAt = new Date().toISOString();
      list.push(entry);
    } else {
      const idx = list.findIndex(l => l.id === entry.id);
      if (idx !== -1) list[idx] = entry;
    }
    this._set(DB_KEYS.LEDGER, list);
    return entry;
  },
  saveLedgerBatch(entries, batchId) {
    const list = this._get(DB_KEYS.LEDGER);
    let added = 0;
    const now = new Date().toISOString();
    const finalBatchId = batchId || ('batch_' + Date.now());

    entries.forEach(entry => {
      if (!list.find(l => l.hash === entry.hash)) {
        entry.id = 'led_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        entry.createdAt = now;
        entry.batchId = finalBatchId;
        list.push(entry);
        added++;
      }
    });
    this._set(DB_KEYS.LEDGER, list);
    return { added, batchId: finalBatchId };
  },
  getLedgerBatches() {
    const all = this._get(DB_KEYS.LEDGER);
    const batches = {};
    all.forEach(e => {
      if (e.batchId) {
        if (!batches[e.batchId]) {
          batches[e.batchId] = {
            id: e.batchId,
            count: 0,
            date: e.createdAt,
            sampleDesc: e.description
          };
        }
        batches[e.batchId].count++;
      }
    });
    return Object.values(batches).sort((a, b) => b.date.localeCompare(a.date));
  },
  deleteLedgerByBatch(batchId) {
    if (!batchId) return 0;
    const all = this._get(DB_KEYS.LEDGER);
    const filtered = all.filter(e => e.batchId !== batchId);
    const deletedCount = all.length - filtered.length;
    this._set(DB_KEYS.LEDGER, filtered);
    return deletedCount;
  },
  deleteLedgerEntry(id) {
    const list = this._get(DB_KEYS.LEDGER).filter(l => l.id !== id);
    this._set(DB_KEYS.LEDGER, list);
  },
  updateLedgerEntry(id, updates) {
    const list = this._get(DB_KEYS.LEDGER);
    const idx = list.findIndex(l => l.id === id);
    if (idx !== -1) { list[idx] = { ...list[idx], ...updates }; }
    this._set(DB_KEYS.LEDGER, list);
  },

  // ───── Bank Configs (은행 설정) ─────
  getBankConfigs() { return this._get(DB_KEYS.BANK_CONFIGS); },
  saveBankConfig(config) {
    const list = this.getBankConfigs();
    if (!config.id) {
      config.id = 'bc_' + Date.now();
      list.push(config);
    } else {
      const idx = list.findIndex(c => c.id === config.id);
      if (idx !== -1) list[idx] = config;
    }
    this._set(DB_KEYS.BANK_CONFIGS, list);
    return config;
  },
  deleteBankConfig(id) {
    const list = this.getBankConfigs().filter(c => c.id !== id);
    this._set(DB_KEYS.BANK_CONFIGS, list);
  },

  // ───── Budget (전체예산) ─────
  getBudgetItems() { return this._get(DB_KEYS.BUDGET); },
  saveBudgetItem(item) {
    const list = this.getBudgetItems();
    if (!item.id) {
      item.id = 'bgt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      item.createdAt = new Date().toISOString();
      list.push(item);
    } else {
      const idx = list.findIndex(b => b.id === item.id);
      if (idx !== -1) list[idx] = item;
    }
    this._set(DB_KEYS.BUDGET, list);
    return item;
  },
  deleteBudgetItem(id) {
    const list = this.getBudgetItems().filter(b => b.id !== id);
    this._set(DB_KEYS.BUDGET, list);
  },

  // ───── Summary Stats ─────
  getProjectStats(projectId, year) {
    const project = this.getProjectById(projectId);
    if (!project) return null;

    let entries = this.getLedger(projectId);

    // 연도가 제공된 경우 회계연도(3월~익년 2월) 기준으로 필터링
    if (year) {
      const startDate = `${year}-03-01`;
      const endDate = `${year + 1}-02-28`; // 단순하게 2월 28일로 설정 (29일 포함 여부는 DB transactionDate 문자열 비교로 처리)
      // 정확한 익년 2월말 처리를 위해 3월 1일 이전으로 체크하거나 보정 필요
      const nextYearStart = `${year + 1}-03-01`;

      entries = entries.filter(e => {
        const d = e.transactionDate;
        return d >= startDate && d < nextYearStart;
      });
    }

    const totalIncome = entries.filter(e => e.type === 'income').reduce((s, e) => s + (e.amount || 0), 0);
    const totalExpense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + (e.amount || 0), 0);
    const budget = project.totalBudget || 0;

    return {
      projectId,
      projectName: project.name,
      budget,
      totalIncome,
      totalExpense,
      balance: budget - totalExpense,
      executionRate: budget > 0 ? Math.round((totalExpense / budget) * 100) : 0
    };
  },

  // ───── Vouchers (지출결의서) ─────
  getVouchers() { return this._get(DB_KEYS.VOUCHERS); },
  saveVoucher(voucher) {
    const list = this.getVouchers();
    if (!voucher.id) {
      voucher.id = 'vch_' + Date.now();
      voucher.createdAt = new Date().toISOString();
      list.push(voucher);
    } else {
      const idx = list.findIndex(v => v.id === voucher.id);
      if (idx !== -1) list[idx] = voucher;
      else list.push(voucher);
    }
    this._set(DB_KEYS.VOUCHERS, list);
    return voucher;
  },
  deleteVoucher(id) {
    const list = this.getVouchers().filter(v => v.id !== id);
    this._set(DB_KEYS.VOUCHERS, list);
  },
  getVoucherById(id) {
    return this.getVouchers().find(v => v.id === id);
  },
  getNextVoucherId() {
    const vouchers = this.getVouchers();
    const year = new Date().getFullYear();
    const prefix = `y-${year}-`;

    const serials = vouchers
      .filter(v => v.id.startsWith(prefix))
      .map(v => {
        const parts = v.id.split('-');
        return parseInt(parts[2]) || 0;
      });

    const nextSerial = serials.length > 0 ? Math.max(...serials) + 1 : 1;
    return prefix + nextSerial.toString().padStart(4, '0');
  },

  // ───── Project Budget (과제별 예산) ─────
  getProjectBudgetItems(projectId) {
    const all = this._get(DB_KEYS.PROJECT_BUDGET);
    if (projectId) return all.filter(b => b.projectId === projectId);
    return all;
  },
  saveProjectBudgetItem(item) {
    const list = this._get(DB_KEYS.PROJECT_BUDGET);
    if (!item.id) {
      item.id = 'pbgt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      item.createdAt = new Date().toISOString();
      list.push(item);
    } else {
      const idx = list.findIndex(b => b.id === item.id);
      if (idx !== -1) list[idx] = item;
    }
    this._set(DB_KEYS.PROJECT_BUDGET, list);
    return item;
  },
  deleteProjectBudgetItem(id) {
    const list = this._get(DB_KEYS.PROJECT_BUDGET).filter(b => b.id !== id);
    this._set(DB_KEYS.PROJECT_BUDGET, list);
  },

  // ───── Schedules (일정관리) ─────
  getSchedules() { return this._get(DB_KEYS.SCHEDULES); },
  saveSchedule(schedule) {
    const list = this.getSchedules();
    if (!schedule.id) {
      schedule.id = 'sch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      schedule.createdAt = new Date().toISOString();
      list.push(schedule);
    } else {
      const idx = list.findIndex(s => s.id === schedule.id);
      if (idx !== -1) list[idx] = schedule;
    }
    this._set(DB_KEYS.SCHEDULES, list);
    return schedule;
  },
  deleteSchedule(id) {
    const list = this.getSchedules().filter(s => s.id !== id);
    this._set(DB_KEYS.SCHEDULES, list);
  },

  // ───── Assets (자산 관리) ─────
  getAssets() { return this._get(DB_KEYS.ASSETS); },
  saveAsset(asset) {
    const list = this.getAssets();
    if (!asset.id) {
      asset.id = 'ast_' + Date.now();
      asset.assetNumber = this.generateAssetNumber();
      asset.createdAt = new Date().toISOString();
      list.push(asset);
    } else {
      const idx = list.findIndex(a => a.id === asset.id);
      if (idx !== -1) list[idx] = asset;
    }
    this._set(DB_KEYS.ASSETS, list);
    return asset;
  },
  deleteAsset(id) {
    const list = this.getAssets().filter(a => a.id !== id);
    this._set(DB_KEYS.ASSETS, list);
  },
  generateAssetNumber() {
    const assets = this.getAssets();
    const year = new Date().getFullYear();
    const prefix = `AST-${year}-`;
    const serials = assets
      .filter(a => a.assetNumber && a.assetNumber.startsWith(prefix))
      .map(a => parseInt(a.assetNumber.split('-')[2]) || 0);
    const nextSerial = serials.length > 0 ? Math.max(...serials) + 1 : 1;
    return prefix + nextSerial.toString().padStart(4, '0');
  },

  // ───── Large Data (R2 스토리지 사용) ─────
  async setLargeData(key, value) {
    try {
      const res = await fetch('/api/storage/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      return res.ok;
    } catch (e) {
      console.error('Error saving to R2:', e);
      return false;
    }
  },
  async getLargeData(key) {
    try {
      const res = await fetch('/api/storage/get?key=' + encodeURIComponent(key));
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Error fetching from R2:', e);
    }
    return null;
  },
  async getStorageUsage() {
    try {
      const res = await fetch('/api/storage/usage');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Error fetching R2 usage:', e);
    }
    return { totalUsage: 0 };
  },

  // ───── Maintenance Tickets (유지보수 게시판) ─────
  getMaintenanceTickets() { return this._get(DB_KEYS.MAINTENANCE); },
  saveMaintenanceTicket(ticket) {
    const list = this.getMaintenanceTickets();
    if (!ticket.id) {
      ticket.id = 'mnt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      ticket.createdAt = new Date().toISOString();
      list.push(ticket);
    } else {
      const idx = list.findIndex(t => t.id === ticket.id);
      if (idx !== -1) list[idx] = ticket;
      else list.push(ticket);
    }
    this._set(DB_KEYS.MAINTENANCE, list);
    return ticket;
  },
  deleteMaintenanceTicket(id) {
    const list = this.getMaintenanceTickets().filter(t => t.id !== id);
    this._set(DB_KEYS.MAINTENANCE, list);
  }
};

window.db = db;
