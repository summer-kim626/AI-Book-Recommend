import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { DEFAULT_AI_CONFIG, AIConfig, ThinkingLevelType } from './src/types/aiConfig.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// AI Configuration File Persistence
const CONFIG_FILE_PATH = path.resolve(__dirname, 'ai-config.json');

export function loadAIConfig(): AIConfig {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_AI_CONFIG,
        ...parsed,
        adminPassword: parsed.adminPassword || process.env.ADMIN_PASSWORD || 'admin1234'
      };
    }
  } catch (e) {
    console.warn('[Config] Failed to read ai-config.json, returning default preset:', e);
  }
  return {
    ...DEFAULT_AI_CONFIG,
    adminPassword: process.env.ADMIN_PASSWORD || 'admin1234'
  };
}

export function saveAIConfig(config: AIConfig): boolean {
  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[Config] Failed to write ai-config.json:', e);
    return false;
  }
}

// In-Memory Admin Tokens
const activeAdminTokens = new Set<string>();

function issueAdminToken(): string {
  const token = 'ms_adm_' + crypto.randomBytes(24).toString('hex');
  activeAdminTokens.add(token);
  return token;
}

function verifyAdmin(req: express.Request): boolean {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : (req.body?.token as string);
  return Boolean(token && activeAdminTokens.has(token));
}

// Helper to map thinking level string to GenAI SDK enum
function mapThinkingLevel(level: ThinkingLevelType | string): ThinkingLevel {
  switch (level?.toUpperCase()) {
    case 'MINIMAL':
      return ThinkingLevel.MINIMAL;
    case 'LOW':
      return ThinkingLevel.LOW;
    case 'MEDIUM':
      return ThinkingLevel.MEDIUM;
    case 'HIGH':
      return ThinkingLevel.HIGH;
    default:
      return ThinkingLevel.MINIMAL;
  }
}

// Common Korean Slang hints for the prompt
const SLANG_HINTS = [
  '멘붕(멘탈 붕괴/불안, 혼란)',
  '현타(현실 자각 타임/허무, 무기력)',
  '쫄리다(위축되고 긴장됨/긴장, 불안)',
  '빡치다(화가 남/분노)',
  '킹받다(약오르고 짜증남/분노, 짜증)',
  '극대노(극도로 화남/분노)',
  '심쿵(심장이 쿵 내려앉음/설렘, 놀람)',
  '이불킥(부끄럽고 후회됨/후회, 민망)',
  '흑역사(부끄러운 과거/후회)',
  '노잼(재미없음/권태)',
  '번아웃(에너지 소진/무기력, 피로)',
  '만사귀찮(모든 게 귀찮음/무기력)',
  '방전(체력·정신력 바닥/피로)',
  '땅굴 파다(가라앉아 혼자 침잠/우울)',
  '멘탈 나가다(정신적으로 버티기 힘듦/불안, 우울)',
  '개이득(뜻밖에 큰 이득/기쁨)',
  '꿀잼(매우 재미있음/즐거움)',
  '소확행(소소하지만 확실한 행복/행복)',
  'ㅠㅠ(울음/슬픔, 서러움)'
].join(', ');

// Status endpoint
app.get('/api/health', (_req, res) => {
  const key = process.env.GEMINI_API_KEY || '';
  const isPlaceholder = key === 'MY_GEMINI_API_KEY' || !key;
  res.json({
    status: 'ok',
    hasApiKey: Boolean(key) && !isPlaceholder,
    keyPrefix: key ? key.substring(0, 4) + '***' : 'none'
  });
});

// Public AI Configuration (No sensitive password exposed)
app.get('/api/config', (_req, res) => {
  const config = loadAIConfig();
  const key = process.env.GEMINI_API_KEY || '';
  const isPlaceholder = key === 'MY_GEMINI_API_KEY' || !key;
  res.json({
    systemInstruction: config.systemInstruction,
    defaultModel: config.defaultModel,
    thinkingLevel: config.thinkingLevel,
    temperature: config.temperature,
    recommendationCount: config.recommendationCount,
    updatedAt: config.updatedAt,
    isCustomized: config.isCustomized ?? false,
    hasGeminiKey: Boolean(key) && !isPlaceholder,
  });
});

// Admin Password Authentication Endpoint
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const currentConfig = loadAIConfig();
  const expectedPassword = currentConfig.adminPassword || process.env.ADMIN_PASSWORD || 'admin1234';

  if (!password || password.trim() !== expectedPassword.trim()) {
    return res.status(401).json({ error: '관리자 비밀번호가 일치하지 않습니다.' });
  }

  const token = issueAdminToken();
  return res.json({
    success: true,
    token,
    message: '인증되었습니다.'
  });
});

// Admin Google Authentication Endpoint
app.post('/api/admin/google-login', (req, res) => {
  const { email, displayName, photoURL } = req.body;

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: '유효한 Google 이메일 정보가 필요합니다.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const currentConfig = loadAIConfig();
  const allowed = currentConfig.allowedAdminEmails || (process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL.toLowerCase()] : []);

  if (allowed.length > 0 && !allowed.includes(cleanEmail)) {
    return res.status(403).json({
      error: `접근 권한이 없는 Google 계정(${cleanEmail})입니다. 등록된 관리자 계정으로 로그인해 주세요.`
    });
  }

  const token = issueAdminToken();
  console.log(`[Admin] Google Login success for: ${cleanEmail} (${displayName || 'Admin'})`);

  return res.json({
    success: true,
    token,
    user: {
      email: cleanEmail,
      displayName: displayName || cleanEmail.split('@')[0],
      photoURL: photoURL || ''
    },
    message: 'Google 계정으로 인증되었습니다.'
  });
});

// Admin Get Full Config
app.get('/api/admin/config', (req, res) => {
  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: '관리자 인증이 필요합니다.' });
  }
  const config = loadAIConfig();
  return res.json({
    ...config,
    adminPassword: '' // Mask current password for security
  });
});

// Admin Save Config
app.post('/api/admin/config', (req, res) => {
  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: '관리자 인증이 만료되었거나 권한이 없습니다.' });
  }

  try {
    const currentConfig = loadAIConfig();
    const {
      systemInstruction,
      defaultModel,
      thinkingLevel,
      temperature,
      recommendationCount,
      newPassword,
      allowedAdminEmails
    } = req.body;

    const updatedConfig: AIConfig = {
      ...currentConfig,
      systemInstruction: typeof systemInstruction === 'string' && systemInstruction.trim()
        ? systemInstruction.trim()
        : currentConfig.systemInstruction,
      defaultModel: typeof defaultModel === 'string' && defaultModel.trim()
        ? defaultModel.trim()
        : currentConfig.defaultModel,
      thinkingLevel: ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'].includes(thinkingLevel)
        ? thinkingLevel
        : currentConfig.thinkingLevel,
      temperature: typeof temperature === 'number' && temperature >= 0 && temperature <= 1
        ? temperature
        : currentConfig.temperature,
      recommendationCount: typeof recommendationCount === 'number' && recommendationCount >= 2 && recommendationCount <= 5
        ? Math.round(recommendationCount)
        : currentConfig.recommendationCount,
      allowedAdminEmails: Array.isArray(allowedAdminEmails)
        ? allowedAdminEmails.map((e: string) => String(e).trim().toLowerCase()).filter(Boolean)
        : currentConfig.allowedAdminEmails,
      updatedAt: new Date().toISOString(),
      isCustomized: true,
    };

    if (newPassword && typeof newPassword === 'string' && newPassword.trim().length >= 4) {
      updatedConfig.adminPassword = newPassword.trim();
    }

    const saved = saveAIConfig(updatedConfig);
    if (!saved) {
      return res.status(500).json({ error: '설정 파일 저장에 실패했습니다.' });
    }

    console.log('[Admin] AI Configuration updated successfully.');
    return res.json({
      success: true,
      config: {
        ...updatedConfig,
        adminPassword: ''
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || '설정 저장 중 오류가 발생했습니다.' });
  }
});

// Admin Reset Config to Defaults
app.post('/api/admin/reset', (req, res) => {
  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: '관리자 인증이 필요합니다.' });
  }

  const currentConfig = loadAIConfig();
  const resetConfig: AIConfig = {
    ...DEFAULT_AI_CONFIG,
    adminPassword: currentConfig.adminPassword, // preserve current password
    updatedAt: new Date().toISOString(),
    isCustomized: false
  };

  const saved = saveAIConfig(resetConfig);
  if (!saved) {
    return res.status(500).json({ error: '초기화 저장 실패' });
  }

  console.log('[Admin] AI Configuration reset to factory defaults.');
  return res.json({
    success: true,
    config: {
      ...resetConfig,
      adminPassword: ''
    }
  });
});

// Endpoint to list available Claude models for a given API key
app.post('/api/claude/models', async (req, res) => {
  try {
    const key = (req.body?.apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
    if (!key) {
      return res.status(400).json({ error: 'API 키가 전달되지 않았습니다.' });
    }

    const mRes = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      }
    });

    if (!mRes.ok) {
      const err = await mRes.json().catch(() => ({}));
      return res.status(mRes.status).json({
        error: err?.error?.message || 'Claude 모델 목록 조회 실패',
        status: mRes.status
      });
    }

    const data = await mRes.json();
    return res.json({
      models: Array.isArray(data?.data) ? data.data : []
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || '서버 오류' });
  }
});

// Recommendation API endpoint (Honors Server-side AIConfig)
app.post('/api/recommend', async (req, res) => {
  try {
    const { text, pick, provider = 'gemini', claudeApiKey, claudeModel, configOverride } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: '상황이나 기분을 적은 문장을 입력해 주세요.' });
    }

    // Load active config (or use temporary override for Admin live test)
    const baseConfig = loadAIConfig();
    const activeConfig: AIConfig = configOverride ? { ...baseConfig, ...configOverride } : baseConfig;

    const cleanText = text.replace(/[<>]/g, ' ').trim().slice(0, 300);
    const recCount = activeConfig.recommendationCount || 3;

    const promptUserInstruction = [
      `사용자의 감정 및 상황 문장: "${cleanText}"`,
      pick
        ? `[사용자 선택]: 사용자가 '${pick.term}' 표현을 '${pick.alt}'의 의미로 해석해 달라고 직접 지정했습니다. 이 해석을 우선 반영하여 understood: true로 설정하고 meaning을 보정하세요.`
        : '',
      `참고 가능한 대표적 은어 사전: ${SLANG_HINTS}`,
      `위 문장에서 은어/줄임말을 파악하고, 전체적인 감정(1~3개)과 감정 강도(1~5점 정수), 필요한 심리적 방향(공감/해결/이해 중 택1), 그리고 한국어로 출판된 실존 추천 도서 ${recCount}권을 골라 JSON으로 응답해 주세요.`
    ].filter(Boolean).join('\n\n');

    // === PROVIDER 1: ANTHROPIC CLAUDE ===
    if (provider === 'claude') {
      const effectiveKey = (claudeApiKey || process.env.ANTHROPIC_API_KEY || '').trim();
      if (!effectiveKey) {
        return res.status(400).json({
          error: 'Claude API 키(sk-ant-...)가 입력되지 않았습니다. 모델 변경 설정에서 Anthropic API 키를 입력해 주세요.',
          code: 'no_claude_key'
        });
      }

      // Try querying account models
      let accountModels: string[] = [];
      try {
        const mRes = await fetch('https://api.anthropic.com/v1/models', {
          method: 'GET',
          headers: {
            'x-api-key': effectiveKey,
            'anthropic-version': '2023-06-01'
          }
        });
        if (mRes.ok) {
          const mData = await mRes.json();
          if (Array.isArray(mData?.data) && mData.data.length > 0) {
            accountModels = mData.data.map((item: any) => item.id).filter(Boolean);
          }
        }
      } catch (listErr) {
        console.warn('[API] /v1/models fetch failed:', listErr);
      }

      // Build candidate models order
      const candidateModels: string[] = [];
      const addModel = (m?: string) => {
        if (m && typeof m === 'string' && !candidateModels.includes(m.trim())) {
          candidateModels.push(m.trim());
        }
      };

      if (claudeModel) {
        addModel(claudeModel);
      }
      accountModels.forEach(addModel);
      const standardFallbacks = [
        'claude-sonnet-5-5',
        'claude-haiku-4-5',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-latest',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-latest',
        'claude-3-5-haiku-20241022'
      ];
      standardFallbacks.forEach(addModel);

      let lastClaudeError: any = null;
      let successfulData: any = null;
      let modelActuallyUsed = '';

      for (const targetModel of candidateModels) {
        try {
          console.log(`[API] Calling Claude with model: ${targetModel}`);

          const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-api-key': effectiveKey,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: targetModel,
              max_tokens: 2200,
              temperature: activeConfig.temperature ?? 0.7,
              system: activeConfig.systemInstruction + '\n\n반드시 마크다운 포맷이나 추가 설명 없이 순수한 JSON 단일 객체로만 응답하세요.',
              messages: [
                {
                  role: 'user',
                  content: `${promptUserInstruction}\n\n다음 JSON 구조로만 정확하게 응답하세요:\n{\n  "summary": "한 줄 요약",\n  "slang": [{"term": "은어", "meaning": "뜻", "emotions": ["감정"], "understood": true, "alternatives": []}],\n  "emotions": [{"name": "감정명", "intensity": 3}],\n  "need": "공감",\n  "crisis": false,\n  "books": [{"title": "책제목", "author": "저자명", "genre": "소설", "why": "추천이유"}]\n}`
                }
              ]
            })
          });

          if (!claudeRes.ok) {
            const errBody = await claudeRes.json().catch(() => ({}));
            if (claudeRes.status === 401 || claudeRes.status === 403) {
              return res.status(403).json({
                error: '입력하신 Claude API 키가 올바르지 않거나 권한이 없습니다. 키(sk-ant-...)를 다시 확인해 주세요.',
                code: 'bad_claude_key'
              });
            }
            if (claudeRes.status === 404) {
              lastClaudeError = { status: 404, message: `Claude 모델(${targetModel})을 찾을 수 없습니다.` };
              continue;
            }
            lastClaudeError = { status: claudeRes.status, message: errBody?.error?.message || claudeRes.statusText };
            continue;
          }

          const claudeData = await claudeRes.json();
          const textContent = (claudeData.content || []).map((c: any) => c.text || '').join('');
          const jsonMatch = textContent.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('Claude 응답에서 데이터 형식을 해석하지 못했습니다.');
          }

          successfulData = JSON.parse(jsonMatch[0]);
          modelActuallyUsed = targetModel;
          break;
        } catch (mErr: any) {
          console.warn(`[Claude Model ${targetModel} Failed]:`, mErr?.message);
          lastClaudeError = mErr;
        }
      }

      if (successfulData) {
        return res.json({
          ...successfulData,
          providerUsed: 'claude',
          modelUsed: modelActuallyUsed
        });
      }

      console.error('[All Claude Models Failed]:', lastClaudeError);
      return res.status(lastClaudeError?.status || 500).json({
        error: lastClaudeError?.message || '사용 가능한 Claude 모델을 호출하지 못했습니다. 키 및 권한을 확인해 주세요.',
        code: 'claude_error'
      });
    }

    // === PROVIDER 2: GOOGLE GEMINI (DEFAULT) ===
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY가 서버에 등록되어 있지 않습니다. AI Studio의 Settings > Secrets에서 키를 등록해 주세요.',
        code: 'no_key',
      });
    }

    console.log('[API] Starting Gemini recommendation with configured model:', activeConfig.defaultModel);

    const callModelWithFallback = async () => {
      // Prioritize configured default model, then fallback
      const primaryModel = activeConfig.defaultModel || 'gemini-3.1-flash-lite';
      const fallbackModel = primaryModel === 'gemini-3.1-flash-lite' ? 'gemini-3.8-flash' : 'gemini-3.1-flash-lite';
      const modelsToTry = [primaryModel, fallbackModel];

      let lastError: any = null;

      for (const modelName of modelsToTry) {
        try {
          console.log(`[API] Attempting Gemini model: ${modelName}`);
          const config: any = {
            systemInstruction: activeConfig.systemInstruction,
            temperature: activeConfig.temperature ?? 0.7,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: {
                  type: Type.STRING,
                  description: '사용자의 현재 심경과 마음에 대한 따뜻하고 통찰력 있는 한 줄 요약'
                },
                slang: {
                  type: Type.ARRAY,
                  description: '문장에서 감지된 은어, 신조어, 줄임말 목록',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      term: { type: Type.STRING, description: '은어/표현' },
                      meaning: { type: Type.STRING, description: '표현의 본래 뜻과 뉘앙스' },
                      emotions: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: '표현에 담긴 감정'
                      },
                      understood: {
                        type: Type.BOOLEAN,
                        description: '의미가 명확한지 여부. 불확실하면 false'
                      },
                      alternatives: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: 'understood가 false일 때 제안할 수 있는 대체 표현 2~3개'
                      }
                    },
                    required: ['term', 'meaning', 'emotions', 'understood']
                  }
                },
                emotions: {
                  type: Type.ARRAY,
                  description: '주요 감정 및 강도 목록',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING, description: '감정 이름 (예: 불안, 피로, 외로움 등)' },
                      intensity: { type: Type.INTEGER, description: '감정 강도 (1~5)' }
                    },
                    required: ['name', 'intensity']
                  }
                },
                need: {
                  type: Type.STRING,
                  description: "사용자에게 지금 필요한 치유 방향 ('공감', '해결', '이해' 중 택1)"
                },
                crisis: {
                  type: Type.BOOLEAN,
                  description: '자해/자살 등 위기 신호 여부'
                },
                books: {
                  type: Type.ARRAY,
                  description: `추천 도서 ${recCount}권`,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING, description: '실제 출간된 책 제목' },
                      author: { type: Type.STRING, description: '저자명' },
                      genre: { type: Type.STRING, description: '장르 (소설, 에세이, 인문학, 자기계발)' },
                      why: { type: Type.STRING, description: '상황 맞춤 추천 이유 (1~2문장)' }
                    },
                    required: ['title', 'author', 'genre', 'why']
                  }
                }
              },
              required: ['summary', 'slang', 'emotions', 'need', 'crisis', 'books']
            }
          };

          // Apply configured thinking level
          const tLevel = mapThinkingLevel(activeConfig.thinkingLevel || 'MINIMAL');
          config.thinkingConfig = { thinkingLevel: tLevel };

          // Timeout promise race (14s max per model attempt)
          const response: any = await Promise.race([
            ai.models.generateContent({
              model: modelName,
              contents: promptUserInstruction,
              config,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Gemini model ${modelName} timed out after 14s`)), 14000)
            )
          ]);

          const responseText = response.text;
          if (responseText) {
            console.log(`[API] Success with Gemini model: ${modelName} (Thinking: ${activeConfig.thinkingLevel})`);
            return {
              ...JSON.parse(responseText),
              providerUsed: 'gemini',
              modelUsed: modelName
            };
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`[API] Gemini model ${modelName} failed or timed out:`, err?.message || err);
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      throw lastError || new Error('All Gemini models failed to respond');
    };

    const parsedData = await callModelWithFallback();
    return res.json(parsedData);
  } catch (error: any) {
    console.error('Error generating AI recommendation:', error);

    const errorMessage = error?.message || '';
    if (errorMessage.includes('API_KEY_INVALID') || errorMessage.includes('PERMISSION_DENIED')) {
      return res.status(403).json({
        error: 'Gemini API 키가 유효하지 않거나 권한이 없습니다. Settings > Secrets에서 API 키를 확인해 주세요.',
        code: 'bad_key'
      });
    }
    if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('429')) {
      return res.status(429).json({
        error: '요청 한도에 일시 도달했습니다. 잠시 후 다시 시도해 주세요.',
        code: 'rate_limit'
      });
    }

    return res.status(500).json({
      error: 'AI 추천 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      details: errorMessage
    });
  }
});

// Vite dev middleware or static serving
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();
