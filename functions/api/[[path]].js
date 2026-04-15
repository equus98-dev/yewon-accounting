export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 1.5. 단일 키 데이터 조회 (GET /api/data/get?key=...)
  if (path === '/api/data/get' && request.method === 'GET') {
    try {
      const key = url.searchParams.get('key');
      if (!key) throw new Error('Key is required');
      const row = await env.DB.prepare('SELECT value FROM kv_store WHERE key = ?').bind(key).first();
      return new Response(row ? row.value : 'null', {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // 1. 전체 데이터 로드 (GET /api/data/load)
  if (path === '/api/data/load' && request.method === 'GET') {
    try {
      const { results } = await env.DB.prepare('SELECT key, value FROM kv_store').all();
      const data = {};
      results.forEach(row => {
        // PDF 데이터는 초기 로딩에서 제외 (메모리 절약 및 로딩 속도 향상)
        if (row.key.startsWith('pdf_')) return;

        try {
          data[row.key] = JSON.parse(row.value);
        } catch (e) {
          data[row.key] = row.value;
        }
      });
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // 1.7. R2 스토리지 데이터 조회 (GET /api/storage/get?key=...)
  if (path === '/api/storage/get' && request.method === 'GET') {
    try {
      const key = url.searchParams.get('key');
      if (!key) throw new Error('Key is required');

      let value = null;
      if (env.BUCKET) {
        const obj = await env.BUCKET.get(key);
        if (obj) value = await obj.text();
      }

      // R2에 없거나 BUCKET이 없으면 D1 kv_store에서 확인 (하이브리드 지원)
      if (value === null) {
        const row = await env.DB.prepare('SELECT value FROM kv_store WHERE key = ?').bind(key).first();
        if (row) {
          try { value = JSON.parse(row.value); } catch (e) { value = row.value; }
        }
      }

      return new Response(JSON.stringify(value), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // 2. 단일 키 데이터 저장 (POST /api/data/save)
  if (path === '/api/data/save' && request.method === 'POST') {
    try {
      const { key, value } = await request.json();
      if (!key) throw new Error('Key is required');

      await env.DB.prepare(
        'INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
      ).bind(key, JSON.stringify(value)).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // 2.5. R2 스토리지 데이터 저장 (POST /api/storage/save)
  if (path === '/api/storage/save' && request.method === 'POST') {
    try {
      const { key, value } = await request.json();
      if (!key) throw new Error('Key is required');

      // 용량 관리 로직 (9GB 제한)
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      const newSize = new TextEncoder().encode(valueStr).length;
      const LIMIT_9GB = 9 * 1024 * 1024 * 1024;

      // 현재 총 사용량 조회
      const usageRow = await env.DB.prepare('SELECT value FROM kv_store WHERE key = ?').bind('r2_usage_total').first();
      let currentTotal = usageRow ? parseInt(usageRow.value) || 0 : 0;

      if (currentTotal + newSize > LIMIT_9GB) {
        return new Response(JSON.stringify({
          error: 'STORAGE_LIMIT_EXCEEDED',
          message: '저장 용량 제한(9GB)을 초과했습니다. 관리자에게 문의하세요.'
        }), { status: 507, headers: { 'Content-Type': 'application/json' } });
      }

      if (env.BUCKET) {
        await env.BUCKET.put(key, valueStr);
      } else {
        // R2가 없으면 D1 kv_store에 저장 (1MB 제한 주의)
        if (newSize > 1000000) {
          throw new Error('R2 스토리지가 설정되지 않았으며, 파일이 D1 제한(1MB)을 초과합니다.');
        }
        await env.DB.prepare(
          'INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
        ).bind(key, valueStr).run();
      }

      // 사용량 업데이트 (D1에 기록)
      currentTotal += newSize;
      await env.DB.prepare(
        'INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
      ).bind('r2_usage_total', currentTotal.toString()).run();

      return new Response(JSON.stringify({ success: true, usage: currentTotal }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.error('API Storage Save Error:', err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // 1.8. R2 사용량 조회 (GET /api/storage/usage)
  if (path === '/api/storage/usage' && request.method === 'GET') {
    try {
      const row = await env.DB.prepare('SELECT value FROM kv_store WHERE key = ?').bind('r2_usage_total').first();
      return new Response(JSON.stringify({ totalUsage: row ? parseInt(row.value) || 0 : 0 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }



  // 3. AI 이미지 분석 (내부기안 추출) (POST /api/ai/analyze-draft)
  if (path === '/api/ai/analyze-draft' && request.method === 'POST') {
    try {
      const { image, filename } = await request.json(); // image는 base64 string
      if (!image) throw new Error('Image data is required');
      if (!env.AI) throw new Error('AI binding is not configured');

      // Base64를 Uint8Array로 더 효율적으로 변환
      const base64Content = image.split(',')[1] || image;
      const binaryString = atob(base64Content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const prompt = `이 이미지는 한국의 대학 또는 공공기관에서 사용하는 '내부기안' 또는 '공문' 문서입니다.
이미지에서 다음 두 가지 정보를 찾아내어 JSON 형식으로 응답하세요:
1. doc_no: '시행' 글자 옆의 문서번호
2. title: '제목' 글자 옆의 제목

결과 예시: {"doc_no": "산학협력단-123", "title": "비품 구입의 건"}
응답은 오직 JSON만 하세요.`;

      // Workers AI 실행 (가장 안정적인 Phi-3 Vision 모델로 교체)
      const aiResponse = await env.AI.run('@cf/microsoft/phi-3-vision-128k-instruct', {
        prompt,
        image: Array.from(bytes)
      });

      // AI 응답 파싱
      let result = { doc_no: '', title: '' };
      const text = aiResponse.response || aiResponse.description || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('JSON Parse Error:', e);
        }
      }

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.error('AI Analysis Error:', err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  return new Response('Not Found', { status: 404 });
}
