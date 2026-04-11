/**
 * utils/accounting-logic.js
 * 사용자가 정의한 full_mapping_logic을 기반으로 한 회계 엔진
 * 보고서(BS, SO, CF) 간의 실시간 데이터 연동 및 매핑을 담당합니다.
 */

const AccountingLogic = (() => {
    // 사용자가 제공한 매핑 로직 정의
    const RULES = {
        // 자산 항목 연동 규칙
        ASSETS: {
            "현금및현금성자산": { bs: "Ⅰ_자산 > 1.유동자산 > 1)당좌자산", cf: "운영/투자/재무 활동의 결과" },
            "단기금융상품": { bs: "Ⅰ_자산 > 1.유동자산 > 1)당좌자산", cf: "투자활동" },
            "단기매매금융자산": { bs: "Ⅰ_자산 > 1.유동자산 > 1)당좌자산", cf: "투자활동" },
            "매출채권(학교기업)": { bs: "Ⅰ_자산 > 1.유동자산 > 1)당좌자산", so: "운영수익", cf: "운영활동" },
            "미수금": { bs: "Ⅰ_자산 > 1.유동자산 > 1)당좌자산", so: "운영수익", cf: "운영활동" },
            "미수수익": { bs: "Ⅰ_자산 > 1.유동자산 > 1)당좌자산", so: "운영수익" },
            "선급금": { bs: "Ⅰ_자산 > 1.유동자산 > 1)당좌자산", cf: "운영활동" },
            "선급비용": { bs: "Ⅰ_자산 > 1.유동자산 > 1)당좌자산", so: "운영비용", cf: "운영활동" },
            "부가세대급금": { bs: "Ⅰ_자산 > 1.유동자산 > 1)당좌자산", isVat: true },
            "3. 부가세대급금": { bs: "Ⅰ_자산 > 1.유동자산 > 1)당좌자산", isVat: true },
            "재고자산(학교기업 판매용)": { bs: "Ⅰ_자산 > 1.유동자산 > 2)재고자산", so: "운영수익/비용" },

            "장기금융상품": { bs: "Ⅰ_자산 > 2.비유동자산 > 1)투자자산", cf: "투자활동" },
            "장기투자금융자산": { bs: "Ⅰ_자산 > 2.비유동자산 > 1)투자자산", cf: "투자활동" },
            "출자금(기술지주 등)": { bs: "Ⅰ_자산 > 2.비유동자산 > 1)투자자산", cf: "투자활동" },

            "토지": { bs: "Ⅰ_자산 > 2.비유동자산 > 2)유형자산", cf: "투자활동" },
            "건물": { bs: "Ⅰ_자산 > 2.비유동자산 > 2)유형자산", cf: "투자활동" },
            "구축물": { bs: "Ⅰ_자산 > 2.비유동자산 > 2)유형자산", cf: "투자활동" },
            "기계기구(실험장비)": { bs: "Ⅰ_자산 > 2.비유동자산 > 2)유형자산", cf: "투자활동" },
            "집기비품": { bs: "Ⅰ_자산 > 2.비유동자산 > 2)유형자산", cf: "투자활동" },
            "차량운반구": { bs: "Ⅰ_자산 > 2.비유동자산 > 2)유형자산", cf: "투자활동" },
            "건설중인자산": { bs: "Ⅰ_자산 > 2.비유동자산 > 2)유형자산", cf: "투자활동" },
            "(감가상각누계액)": { bs: "Ⅰ_자산 > 2.비유동자산 > 2)유형자산", so: "운영비용", isContra: true },

            "지식재산권": { bs: "Ⅰ_자산 > 2.비유동자산 > 3)무형자산", cf: "투자활동" },
            "개발비": { bs: "Ⅰ_자산 > 2.비유동자산 > 3)무형자산", cf: "투자활동" },

            "연구기금": { bs: "Ⅰ_자산 > 2.비유동자산 > 4)기타비유동자산", cf: "투자활동", pairWith: "연구적립금" },
            "건축기금": { bs: "Ⅰ_자산 > 2.비유동자산 > 4)기타비유동자산", cf: "투자활동", pairWith: "건축적립금" },
            "장학기금": { bs: "Ⅰ_자산 > 2.비유동자산 > 4)기타비유동자산", cf: "투자활동", pairWith: "장학적립금" }
        },

        // 부채 항목 연동 규칙
        LIABILITIES: {
            "매입채무": { bs: "Ⅱ_부채 > 1.유동부채", so: "운영비용", cf: "운영활동" },
            "미지급금": { bs: "Ⅱ_부채 > 1.유동부채", so: "운영비용", cf: "운영활동" },
            "선수금": { bs: "Ⅱ_부채 > 1.유동부채", so: "운영수익", cf: "운영활동" },
            "선수수익": { bs: "Ⅱ_부채 > 1.유동부채", so: "운영수익" },
            "예수금": { bs: "Ⅱ_부채 > 1.유동부채", isVat: false },
            "부가세예수금": { bs: "Ⅱ_부채 > 1.유동부채", isVat: true },

            "퇴직급여충당부채": { bs: "Ⅱ_부채 > 2.비유동부채", so: "운영비용", noCash: true },
            "고유목적사업준비금": { bs: "Ⅱ_부채 > 2.비유동부채", so: "운영비용", pairWith: "고유목적사업준비금(신고조정)" }
        },

        // 기본금(자본) 항목 연동 규칙
        CAPITAL: {
            "출연기본금": { bs: "Ⅲ_기본금 > 1.출연기본금", cf: "재무활동" },
            "연구적립금": { bs: "Ⅲ_기본금 > 2.적립금", pairWith: "연구기금" },
            "건축적립금": { bs: "Ⅲ_기본금 > 2.적립금", pairWith: "건축기금" },
            "장학적립금": { bs: "Ⅲ_기본금 > 2.적립금", pairWith: "장학기금" },
            "당기운영차익": { bs: "Ⅲ_기본금 > 3.운영차익", so: "최종결과" }
        }
    };

    /**
     * 거래 항목명(accountName)을 기반으로 회계적 영향을 분석합니다.
     */
    function analyzeImpact(accountName) {
        if (!accountName) return null;

        // 1. 자산에서 찾기
        if (RULES.ASSETS[accountName]) return { type: 'ASSET', ...RULES.ASSETS[accountName] };

        // 2. 부채에서 찾기
        if (RULES.LIABILITIES[accountName]) return { type: 'LIABILITY', ...RULES.LIABILITIES[accountName] };

        // 3. 자본에서 찾기
        if (RULES.CAPITAL[accountName]) return { type: 'CAPITAL', ...RULES.CAPITAL[accountName] };

        // 4. 부분 일치 검색 (예: '토지매각' -> '토지')
        for (const key in RULES.ASSETS) {
            if (accountName.includes(key)) return { type: 'ASSET', ...RULES.ASSETS[key] };
        }

        return null;
    }

    /**
     * 부가세 자동 분리 여부를 결정합니다.
     */
    function shouldSplitVat(itemCode) {
        const item = window.db.getBudgetItems().find(b => b.itemCode === itemCode);
        if (!item) return false;

        // 지출 항목이고 과세 사업 관련성이 높은 항목들 (예: 연구재료비, 비품 등)
        const vatTargetKeywords = ['재료', '비품', '임차', '용역', '위탁', '수수료', '광고', '도서', '장비'];
        return item.type === 'expense' && vatTargetKeywords.some(k => item.name.includes(k));
    }

    return {
        RULES,
        analyzeImpact,
        shouldSplitVat
    };
})();

window.AccountingLogic = AccountingLogic;
