// utils/auth.js - 로그인 및 회원관리 시스템

const Auth = (() => {
    const USERS_KEY = 'yw_users';
    const SESSION_KEY = 'yw_session';

    // ───── 비밀번호 단순 해시 (브라우저 환경용) ─────
    function hashPassword(pw) {
        let hash = 0;
        const str = pw + '_yw_salt_2025';
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return 'pw_' + Math.abs(hash).toString(36);
    }

    // ───── 사용자 목록 ─────
    function getUsers() {
        return db._get(USERS_KEY);
    }
    function saveUsers(users) {
        db._set(USERS_KEY, users);
    }

    // 최초 실행 시 기본 관리자 계정 생성
    function initDefaultAdmin() {
        const users = getUsers();
        const adminUser = users.find(u => u.role === 'admin');
        if (!adminUser) {
            users.push({
                id: 'user_admin',
                username: 'admin',
                passwordHash: hashPassword('yewon869'),
                name: '시스템 관리자',
                role: 'admin',       // 'admin' | 'user'
                department: '산학협력단',
                createdAt: new Date().toISOString(),
                isActive: true
            });
            saveUsers(users);
        } else if (adminUser.passwordHash === hashPassword('admin1234')) {
            // 기존 비밀번호(admin1234) → 새 비밀번호(yewon869)로 마이그레이션
            adminUser.passwordHash = hashPassword('yewon869');
            saveUsers(users);
        }
    }

    // ───── 로그인 ─────
    function login(username, password) {
        const users = getUsers();
        const user = users.find(u => u.username === username && u.passwordHash === hashPassword(password) && u.isActive);
        if (!user) return { ok: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' };
        const session = {
            userId: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            department: user.department,
            rank: user.rank,
            loginAt: new Date().toISOString()
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { ok: true, session };
    }

    // ───── 로그아웃 ─────
    function logout() {
        localStorage.removeItem(SESSION_KEY);
        location.reload();
    }

    // ───── 세션 갱신 ─────
    function refreshSession() {
        const session = getSession();
        if (!session) return;
        const user = getUsers().find(u => u.id === session.userId);
        if (!user) return;

        const newSession = {
            ...session,
            name: user.name,
            department: user.department,
            rank: user.rank
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
        return newSession;
    }

    // ───── 현재 세션 ─────
    function getSession() {
        try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
        catch { return null; }
    }

    function isLoggedIn() { return !!getSession(); }
    function isAdmin() { const s = getSession(); return s && s.role === 'admin'; }

    // ───── 사용자 관리 (관리자 전용) ─────
    function createUser({ username, password, name, role, department, rank }) {
        const users = getUsers();
        if (users.find(u => u.username === username)) return { ok: false, message: '이미 사용 중인 아이디입니다.' };
        const user = {
            id: 'user_' + Date.now(),
            username,
            passwordHash: hashPassword(password),
            name,
            role: role || 'user',
            department: department || '',
            rank: rank || '',
            createdAt: new Date().toISOString(),
            isActive: true
        };
        users.push(user);
        saveUsers(users);
        return { ok: true, user };
    }

    function updateUser(id, updates) {
        const users = getUsers();
        const idx = users.findIndex(u => u.id === id);
        if (idx === -1) return { ok: false, message: '사용자를 찾을 수 없습니다.' };
        if (updates.password) {
            updates.passwordHash = hashPassword(updates.password);
            delete updates.password;
        }
        users[idx] = { ...users[idx], ...updates };
        saveUsers(users);
        return { ok: true };
    }

    function deleteUser(id) {
        const session = getSession();
        if (session && session.userId === id) return { ok: false, message: '현재 로그인 중인 계정은 삭제할 수 없습니다.' };
        const users = getUsers().filter(u => u.id !== id);
        saveUsers(users);
        return { ok: true };
    }

    function toggleUserActive(id) {
        const users = getUsers();
        const idx = users.findIndex(u => u.id === id);
        if (idx === -1) return;
        users[idx].isActive = !users[idx].isActive;
        saveUsers(users);
    }

    // ───── 보안 체크 ─────
    function isDefaultPassword() {
        const session = getSession();
        if (!session) return false;
        const user = getUsers().find(u => u.id === session.userId);
        if (!user) return false;
        return user.passwordHash === hashPassword('1234');
    }

    return {
        hashPassword, getUsers, initDefaultAdmin,
        login, logout, getSession, isLoggedIn, isAdmin, refreshSession, isDefaultPassword,
        createUser, updateUser, deleteUser, toggleUserActive
    };
})();

window.Auth = Auth;
