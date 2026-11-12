/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Sparkles,
  Search,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  PhoneCall,
  Share2,
  Compass,
  ArrowRight,
  Info,
  SlidersHorizontal,
  Bot,
  Eye,
  EyeOff,
  Key,
  Trash2,
  Cpu,
  Check,
  Lock
} from 'lucide-react';
import AdminModal from './components/AdminModal';
import {
  RULE_BASED_DATA,
  GENRES,
  findEmotion,
  suggestEmotions,
  detectSlang,
  getBookHue,
  BookItem
} from './data/bookData';

interface SlangItem {
  term: string;
  meaning: string;
  emotions: string[];
  understood: boolean;
  alternatives?: string[];
}

interface EmotionItem {
  name: string;
  intensity: number;
}

interface AIResponseData {
  summary: string;
  slang: SlangItem[];
  emotions: EmotionItem[];
  need: string;
  crisis: boolean;
  books: BookItem[];
  providerUsed?: 'gemini' | 'claude';
  modelUsed?: string;
}

const CLAUDE_MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (최신 기본 권장)' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (초고속 응답)' },
  { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet (고지능 추론)' },
  { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'rule' | 'ai'>('rule');

  // Tab 1 (Rule-based) States
  const [selectedEmotion, setSelectedEmotion] = useState<string>('불안');
  const [selectedTastes, setSelectedTastes] = useState<string[]>([]);
  const [ruleInput, setRuleInput] = useState<string>('');
  const [ruleSuggestions, setRuleSuggestions] = useState<string[]>([]);
  const [ruleSearchMiss, setRuleSearchMiss] = useState<string | null>(null);

  // Tab 2 (AI-based) States
  const [aiInput, setAiInput] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiStatusMessage, setAiStatusMessage] = useState<string>('');
  const [aiResult, setAiResult] = useState<AIResponseData | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeSlangPreview, setActiveSlangPreview] = useState<any[]>([]);

  // AI Provider Switcher (Gemini vs Claude)
  const [aiProvider, setAiProvider] = useState<'gemini' | 'claude'>(() => {
    try {
      return (localStorage.getItem('maum_ai_provider') as 'gemini' | 'claude') || 'gemini';
    } catch {
      return 'gemini';
    }
  });

  const [claudeApiKey, setClaudeApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem('maum_claude_key') || localStorage.getItem('ms_key') || '';
    } catch {
      return '';
    }
  });

  const [claudeModel, setClaudeModel] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('maum_claude_model') || localStorage.getItem('ms_model');
      if (saved && !saved.includes('haiku-2024') && !saved.includes('sonnet-2024')) {
        return saved;
      }
      return 'claude-sonnet-5-5';
    } catch {
      return 'claude-sonnet-5-5';
    }
  });

  const [saveClaudeKey, setSaveClaudeKey] = useState<boolean>(() => {
    try {
      return localStorage.getItem('maum_claude_save') !== 'false';
    } catch {
      return true;
    }
  });

  const [showClaudeConfig, setShowClaudeConfig] = useState<boolean>(false);
  const [showKeySecret, setShowKeySecret] = useState<boolean>(false);
  const [tempKeyInput, setTempKeyInput] = useState<string>(claudeApiKey);
  const [availableClaudeModels, setAvailableClaudeModels] = useState<any[]>([]);
  const [fetchingModels, setFetchingModels] = useState<boolean>(false);
  const [keyVerificationStatus, setKeyVerificationStatus] = useState<string | null>(null);

  // System Health & Server AI Config
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean>(true);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [serverAIConfig, setServerAIConfig] = useState<any>(null);

  const ruleResultRef = useRef<HTMLDivElement>(null);
  const aiResultRef = useRef<HTMLDivElement>(null);

  // Check Gemini health & load active server AI config on mount
  const fetchServerConfig = () => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setServerAIConfig(data);
          if (data.hasGeminiKey !== undefined) {
            setHasGeminiKey(data.hasGeminiKey);
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchServerConfig();
  }, []);

  // Save Provider preference
  useEffect(() => {
    try {
      localStorage.setItem('maum_ai_provider', aiProvider);
    } catch {}
  }, [aiProvider]);

  // Sync slang preview as user types in AI tab
  useEffect(() => {
    if (aiInput.trim()) {
      const detected = detectSlang(aiInput);
      setActiveSlangPreview(detected);
    } else {
      setActiveSlangPreview([]);
    }
  }, [aiInput]);

  // Handle Tab 1 Emotion Selection
  const handleSelectEmotion = (emotionKey: string, fromUserAction = false) => {
    setSelectedEmotion(emotionKey);
    setRuleSearchMiss(null);
    setRuleSuggestions([]);
    if (fromUserAction && ruleResultRef.current) {
      setTimeout(() => {
        ruleResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  };

  // Handle Tab 1 Search
  const handleRuleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = ruleInput.trim();
    if (!query) return;

    const matched = findEmotion(query);
    if (matched) {
      handleSelectEmotion(matched, true);
      setRuleInput('');
    } else {
      const suggestions = suggestEmotions(query);
      setRuleSearchMiss(query);
      setRuleSuggestions(suggestions);
    }
  };

  // Toggle Taste Filter
  const toggleTaste = (genre: string) => {
    setSelectedTastes((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  // Rule-based book picking logic
  const getRuleBooks = () => {
    if (!selectedEmotion || !RULE_BASED_DATA[selectedEmotion]) return [];
    const books = RULE_BASED_DATA[selectedEmotion].books;
    if (selectedTastes.length === 0) {
      return books.slice(0, 3).map((b) => ({
        title: b[0],
        author: b[1],
        genre: b[2],
        why: b[3],
        isMatch: true
      }));
    }

    const hit = books.filter((b) => selectedTastes.includes(b[2]));
    const rest = books.filter((b) => !selectedTastes.includes(b[2]));
    const combined = [...hit, ...rest].slice(0, 3);

    return combined.map((b) => ({
      title: b[0],
      author: b[1],
      genre: b[2],
      why: b[3],
      isMatch: selectedTastes.includes(b[2])
    }));
  };

  // Save Claude settings
  const handleSaveClaudeConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = tempKeyInput.trim();
    setClaudeApiKey(cleanKey);

    try {
      if (saveClaudeKey && cleanKey) {
        localStorage.setItem('maum_claude_key', cleanKey);
        localStorage.setItem('maum_claude_save', 'true');
      } else {
        localStorage.removeItem('maum_claude_key');
        localStorage.setItem('maum_claude_save', 'false');
      }
      localStorage.setItem('maum_claude_model', claudeModel);
    } catch {}

    setAiProvider('claude');
    setShowClaudeConfig(false);
    setAiError(null);
  };

  // Verify Claude API key and query available models
  const handleVerifyClaudeKey = async (keyOverride?: string) => {
    const key = (keyOverride || tempKeyInput).trim();
    if (!key) return;

    setFetchingModels(true);
    setKeyVerificationStatus('키 유효성 및 지원 모델 조회 중...');

    try {
      const res = await fetch('/api/claude/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key })
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.models) && data.models.length > 0) {
        setAvailableClaudeModels(data.models);
        setKeyVerificationStatus(`✓ 연동 확인 완료 (계정 지원 모델: ${data.models.length}개)`);

        const ids = data.models.map((m: any) => m.id);
        if (!ids.includes(claudeModel)) {
          const best = ids.find((id: string) => id.includes('sonnet')) || ids[0];
          setClaudeModel(best);
        }
      } else {
        setKeyVerificationStatus(data.error || '계정 모델 정보를 가져오지 못했습니다.');
      }
    } catch (err: any) {
      setKeyVerificationStatus('확인 실패: ' + err.message);
    } finally {
      setFetchingModels(false);
    }
  };

  const handleClearClaudeKey = () => {
    setClaudeApiKey('');
    setTempKeyInput('');
    try {
      localStorage.removeItem('maum_claude_key');
    } catch {}
    setAiProvider('gemini');
  };

  // Switch Provider with validation
  const handleSwitchProvider = (provider: 'gemini' | 'claude') => {
    if (provider === 'claude') {
      if (!claudeApiKey.trim()) {
        setShowClaudeConfig(true);
      }
      setAiProvider('claude');
    } else {
      setAiProvider('gemini');
      setAiError(null);
    }
  };

  // Handle AI Recommendation Request
  const handleRequestAI = async (textToUse?: string, pick?: { term: string; alt: string }) => {
    const text = (textToUse !== undefined ? textToUse : aiInput).trim();
    if (!text || aiLoading) return;

    if (aiProvider === 'claude' && !claudeApiKey.trim()) {
      setShowClaudeConfig(true);
      setAiError('Claude API 키가 필요합니다. 아래 설정창에서 sk-ant- 로 시작하는 키를 입력해 주세요.');
      return;
    }

    setAiLoading(true);
    setAiError(null);

    const providerLabel = aiProvider === 'claude' ? 'Claude' : 'Gemini';
    setAiStatusMessage(
      pick
        ? `'${pick.term}'의 의미를 '${pick.alt}'(으)로 반영하여 ${providerLabel}가 다시 분석 중입니다...`
        : `${providerLabel}가 문장 속 은어와 감정을 섬세하게 해석하고 있습니다...`
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          text,
          pick,
          provider: aiProvider,
          claudeApiKey: aiProvider === 'claude' ? claudeApiKey.trim() : undefined,
          claudeModel: aiProvider === 'claude' ? claudeModel : undefined
        })
      });
      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'no_claude_key' || data.code === 'bad_claude_key') {
          setShowClaudeConfig(true);
        }
        throw new Error(data.error || 'AI 응답 처리에 실패했습니다.');
      }

      setAiResult(data);
      setAiStatusMessage('');

      setTimeout(() => {
        aiResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error(err);
      if (err.name === 'AbortError') {
        setAiError('요청 대기 시간(25초)이 초과되었습니다. 네트워크 상태를 확인하시거나 다시 시도해 주세요.');
      } else {
        setAiError(err.message || 'AI 추천을 불러오는 도중 오류가 발생했습니다.');
      }
      setAiStatusMessage('');
    } finally {
      setAiLoading(false);
    }
  };

  // Render Book Cover with Dynamic Hue & Spine
  const renderBookCover = (title: string, author: string) => {
    const hue = getBookHue(title);
    return (
      <div
        className="book-cover flex-shrink-0 w-24 sm:w-28 text-left select-none"
        style={{
          background: `linear-gradient(155deg, hsl(${hue}, 42%, 36%), hsl(${(hue + 25) % 360}, 46%, 20%))`
        }}
        role="img"
        aria-label={`『${title}』 도서 표지`}
      >
        <div className="font-serif-kr font-bold leading-snug line-clamp-3 text-xs sm:text-sm drop-shadow-sm">
          {title}
        </div>
        <div className="text-[10px] sm:text-[11px] opacity-85 truncate font-sans">
          {author}
        </div>
      </div>
    );
  };

  const currentEmotionData = RULE_BASED_DATA[selectedEmotion];
  const ruleBooks = getRuleBooks();
  const hasFallbackGenre =
    selectedTastes.length > 0 && ruleBooks.some((b) => !b.isMatch);

  // Quick prompt presets for Tab 2
  const quickPrompts = [
    '내일 큰 발표가 있는데 심장이 터질 것 같고 잠이 안 와',
    '야근하고 퇴근했는데 현타 와서 만사귀찮고 방전됐어',
    '믿었던 친구한테 서운한 일 있어서 빡치고 억울해',
    '혼자 자취방에 누워있는데 문득 너무 쓸쓸하고 외로워',
    '실수를 크게 해서 멘탈 나가고 이불킥하고 싶어'
  ];

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-[#1d2733] antialiased">
      {/* Top Banner / Navigation */}
      <header className="border-b border-[#dce3ea] bg-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#1f6f78] text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-serif-kr text-[#164e53] tracking-tight">
                마음 서가
              </h1>
              <p className="text-[12px] text-[#6b7c8f] -mt-0.5">
                감정 맞춤 도서 처방전
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-all ${
                aiProvider === 'gemini'
                  ? 'bg-teal-50 text-[#1f6f78] border-teal-200'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              {aiProvider === 'gemini' ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[#1f6f78]" />
                  Gemini 연동
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5 text-amber-700" />
                  Claude 연동
                </>
              )}
            </span>
            <button
              onClick={() => setIsAdminModalOpen(true)}
              className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1.5 border border-slate-200"
              title="AI 관리자 설정 (비밀번호 보호)"
              aria-label="AI 관리자 설정"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-medium text-xs">관리자</span>
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopiedNotification(true);
                setTimeout(() => setCopiedNotification(false), 2000);
              }}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 transition-colors"
              title="링크 복사"
              aria-label="링크 복사"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-1">
            <button
              onClick={() => setActiveTab('rule')}
              className={`py-3 text-sm font-semibold border-b-2 transition-all flex items-center justify-center gap-2 ${
                activeTab === 'rule'
                  ? 'border-[#1f6f78] text-[#1f6f78]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Compass className="w-4 h-4" />
              탭 1 · 규칙 기반 추천
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`py-3 text-sm font-semibold border-b-2 transition-all flex items-center justify-center gap-2 ${
                activeTab === 'ai'
                  ? 'border-[#1f6f78] text-[#1f6f78]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              탭 2 · AI 감정 분석 추천
            </button>
          </div>
        </div>
      </header>

      {/* Copy Alert Toast */}
      {copiedNotification && (
        <div className="fixed bottom-6 right-6 bg-[#164e53] text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium flex items-center gap-2 z-50 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-teal-300" />
          마음 서가 주소가 복사되었습니다!
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-20 space-y-6">
        {/* Intro Banner */}
        <section className="bg-white rounded-xl p-5 border border-[#dce3ea] shadow-xs">
          <h2 className="text-xl sm:text-2xl font-bold font-serif-kr text-[#1d2733] mb-1.5">
            {activeTab === 'rule'
              ? '지금 마음을 두드리는 감정은 무엇인가요?'
              : '어떤 기분이나 상황인지 편하게 털어놓아 보세요.'}
          </h2>
          <p className="text-sm text-[#5d6b7a] leading-relaxed">
            {activeTab === 'rule'
              ? '10가지 대표 감정을 누르거나 직접 단어를 적으면, 취향에 꼭 맞춘 도서 3권을 큐레이션해 드립니다.'
              : '말하기 힘든 복잡한 심경이나 은어, 유행어, 줄임말도 괜찮습니다. Gemini 또는 Claude 인공지능이 마음의 결을 읽어드립니다.'}
          </p>
        </section>

        {/* TAB 1: RULE-BASED RECOMMENDATION */}
        {activeTab === 'rule' && (
          <div className="space-y-6">
            {/* Step 1: Emotion Selection */}
            <section className="bg-white rounded-xl p-5 border border-[#dce3ea] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1f6f78] bg-teal-50 px-2 py-0.5 rounded">
                  STEP 1
                </span>
                <span className="text-xs text-[#5d6b7a]">
                  감정을 누르거나 아래에서 검색하세요
                </span>
              </div>

              {/* Emoji Buttons Grid */}
              <div className="grid grid-cols-5 gap-2">
                {Object.keys(RULE_BASED_DATA).map((key) => {
                  const item = RULE_BASED_DATA[key];
                  const isSelected = selectedEmotion === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelectEmotion(key, true)}
                      aria-pressed={isSelected}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center ${
                        isSelected
                          ? 'bg-[#1f6f78] text-white border-[#1f6f78] shadow-sm ring-2 ring-teal-200'
                          : 'bg-[#fafbfc] hover:bg-slate-50 text-[#1d2733] border-[#dce3ea]'
                      }`}
                    >
                      <span className="text-2xl sm:text-3xl mb-1 select-none">
                        {item.face}
                      </span>
                      <span className="text-xs font-semibold">{key}</span>
                    </button>
                  );
                })}
              </div>

              {/* Emotion Direct Input Form */}
              <form onSubmit={handleRuleSearch} className="flex gap-2 pt-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={ruleInput}
                    onChange={(e) => setRuleInput(e.target.value)}
                    placeholder="직접 입력: 예) 불안해, 외로워, 번아웃, 답답해"
                    className="w-full pl-3.5 pr-8 py-2.5 text-sm bg-white border border-[#dce3ea] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1f6f78] focus:border-transparent"
                  />
                  {ruleInput && (
                    <button
                      type="button"
                      onClick={() => setRuleInput('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#1f6f78] hover:bg-[#185960] text-white font-medium text-sm rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Search className="w-4 h-4" />
                  찾기
                </button>
              </form>

              {/* Search Miss & Suggestions */}
              {ruleSearchMiss && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs sm:text-sm text-amber-900 space-y-2">
                  <p className="flex items-center gap-1.5 font-medium">
                    <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>
                      '{ruleSearchMiss}'에 정확히 일치하는 기본 감정을 찾지
                      못했습니다. 혹시 다음 감정인가요?
                    </span>
                  </p>
                  {ruleSuggestions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {ruleSuggestions.map((sugKey) => (
                        <button
                          key={sugKey}
                          onClick={() => {
                            handleSelectEmotion(sugKey, true);
                            setRuleInput('');
                          }}
                          className="px-3 py-1.5 bg-white border border-amber-300 rounded-full text-xs font-semibold hover:bg-amber-100 transition-colors"
                        >
                          {RULE_BASED_DATA[sugKey].face} {sugKey}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700">
                      위 10가지 감정 버튼 중 가장 가까운 감정을 직접 선택해
                      주세요.
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Step 2: Reading Taste Filter */}
            <section className="bg-white rounded-xl p-5 border border-[#dce3ea] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1f6f78] bg-teal-50 px-2 py-0.5 rounded">
                  STEP 2
                </span>
                <span className="text-xs text-[#5d6b7a]">
                  독서 취향 (복수 선택 가능, 미선택 시 전체)
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {GENRES.map((genre) => {
                  const isSelected = selectedTastes.includes(genre);
                  return (
                    <button
                      key={genre}
                      onClick={() => toggleTaste(genre)}
                      aria-pressed={isSelected}
                      className={`px-4 py-2 text-sm rounded-full border transition-all ${
                        isSelected
                          ? 'bg-teal-50 border-[#1f6f78] text-[#1f6f78] font-bold shadow-xs'
                          : 'bg-white border-[#dce3ea] text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {genre}
                      {isSelected && ' ✓'}
                    </button>
                  );
                })}
                {selectedTastes.length > 0 && (
                  <button
                    onClick={() => setSelectedTastes([])}
                    className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 underline ml-1"
                  >
                    전체 해제
                  </button>
                )}
              </div>
            </section>

            {/* Recommendation Result Display */}
            <div ref={ruleResultRef} className="space-y-4">
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-bold font-serif-kr text-[#164e53] flex items-center gap-2">
                  <span>{currentEmotionData?.face}</span>
                  <span>'{selectedEmotion}' 일 때 마음에 가 닿는 책 3권</span>
                </h3>
                <span className="text-xs text-[#5d6b7a]">
                  취향:{' '}
                  {selectedTastes.length > 0
                    ? selectedTastes.join(', ')
                    : '전체 장르'}
                </span>
              </div>

              {/* Books List */}
              <div className="space-y-3">
                {ruleBooks.map((book, idx) => (
                  <article
                    key={idx}
                    className="bg-white rounded-xl p-4 border border-[#dce3ea] shadow-xs hover:border-[#1f6f78] transition-all flex gap-4"
                  >
                    {renderBookCover(book.title, book.author)}
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <span className="text-[11px] font-bold text-[#1f6f78] bg-teal-50 px-2 py-0.5 rounded">
                            {book.genre}
                          </span>
                          {!book.isMatch && (
                            <span className="text-[10px] text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded">
                              선택 취향 외 보충
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-base text-[#1d2733] font-serif-kr line-clamp-1 mb-0.5">
                          『{book.title}』
                        </h4>
                        <p className="text-xs text-[#5d6b7a] mb-2 font-medium">
                          {book.author} 저
                        </p>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                        {book.why}
                      </p>
                    </div>
                  </article>
                ))}
              </div>

              {hasFallbackGenre && (
                <p className="text-xs text-[#5d6b7a] bg-slate-100/70 p-2.5 rounded-lg text-center">
                  💡 이 감정에서 선택하신 장르의 책이 3권 미만이어서 다른 장르의
                  명작으로 풍성하게 채웠습니다.
                </p>
              )}

              {/* Emotional Care Notice */}
              {currentEmotionData?.notice && (
                <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs sm:text-sm text-amber-900 flex items-start gap-2.5">
                  <PhoneCall className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong>마음 지킴 안내: </strong>
                    {currentEmotionData.notice}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: AI RECOMMENDATION (GEMINI / CLAUDE) */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            {/* AI Model Switcher Bar */}
            <section className="bg-white rounded-xl p-4 sm:p-5 border border-[#dce3ea] shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      AI 엔진 선택
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                        aiProvider === 'gemini'
                          ? 'bg-teal-50 text-teal-800 border border-teal-200'
                          : 'bg-amber-50 text-amber-900 border border-amber-200'
                      }`}
                    >
                      {aiProvider === 'gemini'
                        ? `Google ${serverAIConfig?.defaultModel || 'gemini-3.1-flash-lite'} (Thinking: ${serverAIConfig?.thinkingLevel || 'MINIMAL'}) 활성`
                        : `Anthropic ${claudeModel.includes('3-7') ? 'Claude 3.7 Sonnet' : claudeModel.includes('haiku') ? 'Claude 3.5 Haiku' : 'Claude 3.5 Sonnet'} 활성`}
                    </span>
                    {serverAIConfig?.isCustomized && aiProvider === 'gemini' && (
                      <span className="text-[10px] text-teal-800 bg-teal-100/70 border border-teal-200 px-1.5 py-0.5 rounded-full font-medium">
                        관리자 커스텀 지침
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {aiProvider === 'gemini'
                      ? '기본 탑재 키로 설정 없이 즉시 사용하실 수 있습니다.'
                      : claudeApiKey
                      ? '등록된 Anthropic API 키로 클로드 분석이 실행됩니다.'
                      : '클로드 API 키를 등록하면 클로드 엔진으로 맞춤 도서를 추천받을 수 있습니다.'}
                  </p>
                </div>

                {/* Model Toggle Buttons */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => handleSwitchProvider('gemini')}
                      className={`px-3 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                        aiProvider === 'gemini'
                          ? 'bg-white text-teal-800 shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                      Gemini
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchProvider('claude')}
                      className={`px-3 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                        aiProvider === 'claude'
                          ? 'bg-[#d97706] text-white shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Bot className="w-3.5 h-3.5" />
                      Claude
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowClaudeConfig(!showClaudeConfig)}
                    className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors ${
                      showClaudeConfig || (aiProvider === 'claude' && !claudeApiKey)
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    title="Claude API 키 및 모델 변경 설정"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span className="hidden sm:inline">Claude 키 설정</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Claude Configuration Drawer */}
              {showClaudeConfig && (
                <form
                  onSubmit={handleSaveClaudeConfig}
                  className="mt-3 pt-3 border-t border-slate-200 bg-[#fdfbf7] p-4 rounded-xl border border-amber-200 space-y-3.5 animate-fadeIn"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                      <Key className="w-4 h-4 text-amber-700" />
                      <span>Anthropic Claude API 설정</span>
                    </div>
                    {claudeApiKey && (
                      <button
                        type="button"
                        onClick={handleClearClaudeKey}
                        className="text-[11px] text-red-600 hover:text-red-800 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        키 삭제
                      </button>
                    )}
                  </div>

                  {/* API Key Input */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700">
                        Claude API 키
                      </label>
                      <button
                        type="button"
                        onClick={() => handleVerifyClaudeKey()}
                        disabled={fetchingModels || !tempKeyInput.trim()}
                        className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 underline disabled:opacity-40"
                      >
                        {fetchingModels ? '모델 조회 중...' : '키 확인 및 모델 불러오기'}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showKeySecret ? 'text' : 'password'}
                        value={tempKeyInput}
                        onChange={(e) => setTempKeyInput(e.target.value)}
                        placeholder="sk-ant-api03-..."
                        autoComplete="off"
                        spellCheck="false"
                        className="w-full pl-3 pr-10 py-2 text-xs font-mono bg-white border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeySecret(!showKeySecret)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showKeySecret ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {keyVerificationStatus && (
                      <p className={`text-[11px] font-medium pt-0.5 ${keyVerificationStatus.includes('성공') || keyVerificationStatus.includes('완료') ? 'text-emerald-700' : 'text-amber-800'}`}>
                        {keyVerificationStatus}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500">
                      Anthropic Console(console.anthropic.com)에서 발급받은 API 키를 입력하세요.
                    </p>
                  </div>

                  {/* Claude Model Selection */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Claude 모델 버전 {availableClaudeModels.length > 0 && `(계정 연동: ${availableClaudeModels.length}개 지원)`}
                    </label>
                    <select
                      value={claudeModel}
                      onChange={(e) => setClaudeModel(e.target.value)}
                      className="w-full p-2 text-xs bg-white border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {availableClaudeModels.length > 0 ? (
                        availableClaudeModels.map((m: any) => (
                          <option key={m.id} value={m.id}>
                            {m.display_name ? `${m.display_name} (${m.id})` : m.id}
                          </option>
                        ))
                      ) : (
                        CLAUDE_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))
                      )}
                    </select>
                    <p className="text-[11px] text-slate-400">
                      * 모델 호출 시 404가 발생하면 계정에서 지원하는 다른 활성 모델로 자동 폴백됩니다.
                    </p>
                  </div>

                  {/* Save to LocalStorage Checkbox */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="save-key-chk"
                      checked={saveClaudeKey}
                      onChange={(e) => setSaveClaudeKey(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <label htmlFor="save-key-chk" className="text-xs text-slate-600 select-none">
                      이 브라우저에 키 저장 (다음에 열 때도 유지됩니다)
                    </label>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowClaudeConfig(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 rounded-lg"
                    >
                      닫기
                    </button>
                    <button
                      type="submit"
                      disabled={!tempKeyInput.trim()}
                      className="px-4 py-1.5 text-xs font-bold bg-[#d97706] hover:bg-[#b45309] disabled:bg-slate-300 text-white rounded-lg flex items-center gap-1.5 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      설정 저장 및 Claude 모델로 전환
                    </button>
                  </div>
                </form>
              )}
            </section>

            {/* AI Prompt Input Section */}
            <section className="bg-white rounded-xl p-5 border border-[#dce3ea] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      aiProvider === 'gemini'
                        ? 'text-[#1f6f78] bg-teal-50'
                        : 'text-amber-800 bg-amber-50'
                    }`}
                  >
                    {aiProvider === 'gemini' ? 'GEMINI AI 분석' : 'CLAUDE AI 분석'}
                  </span>
                  <span className="text-xs text-[#5d6b7a]">
                    상황이나 기분을 문장으로 적어주세요 (최대 300자)
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {aiInput.length}/300자
                </span>
              </div>

              {/* Textarea Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRequestAI();
                }}
                className="space-y-3"
              >
                <div className="relative">
                  <textarea
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value.slice(0, 300))}
                    placeholder="예) 내일 중요한 발표인데 심장이 터질 것 같고 잠이 통 안 와요. 긴장돼서 미치겠어요."
                    rows={4}
                    className="w-full p-3.5 text-sm sm:text-base bg-[#fafbfc] border border-[#dce3ea] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1f6f78] focus:border-transparent transition-all leading-relaxed"
                  />
                </div>

                {/* Live Slang Detected Badge */}
                {activeSlangPreview.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-teal-50/70 border border-teal-100 rounded-lg text-xs text-[#164e53]">
                    <span className="font-semibold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                      감지된 표현:
                    </span>
                    {activeSlangPreview.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-white border border-teal-200 rounded-md font-medium text-teal-800"
                        title={s.meaning}
                      >
                        {s.term} ({s.emotions.join(', ')})
                      </span>
                    ))}
                  </div>
                )}

                {/* Quick Presets */}
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs text-slate-500 font-medium">
                    어떤 표현을 적을지 막막하다면 눌러보세요:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {quickPrompts.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setAiInput(q);
                        }}
                        className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors text-left"
                      >
                        "{q}"
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="submit"
                    disabled={aiLoading || !aiInput.trim()}
                    className={`w-full sm:w-auto px-6 py-3 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm ${
                      aiProvider === 'gemini'
                        ? 'bg-[#1f6f78] hover:bg-[#164e53] disabled:bg-slate-300'
                        : 'bg-[#d97706] hover:bg-[#b45309] disabled:bg-slate-300'
                    }`}
                  >
                    {aiLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {aiProvider === 'gemini' ? 'Gemini' : 'Claude'}가 분석하는 중...
                      </>
                    ) : (
                      <>
                        {aiProvider === 'gemini' ? (
                          <Sparkles className="w-4 h-4 text-amber-300" />
                        ) : (
                          <Bot className="w-4 h-4 text-amber-200" />
                        )}
                        {aiProvider === 'gemini' ? 'Gemini AI로 추천받기' : 'Claude AI로 추천받기'}
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Status Message */}
              {aiStatusMessage && (
                <div
                  className={`p-3 rounded-lg text-sm flex items-center gap-2 animate-pulse ${
                    aiProvider === 'gemini'
                      ? 'bg-teal-50 border border-teal-200 text-[#164e53]'
                      : 'bg-amber-50 border border-amber-200 text-amber-900'
                  }`}
                >
                  <RefreshCw
                    className={`w-4 h-4 animate-spin ${
                      aiProvider === 'gemini' ? 'text-[#1f6f78]' : 'text-amber-700'
                    }`}
                  />
                  <span>{aiStatusMessage}</span>
                </div>
              )}

              {/* Error Message */}
              {aiError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">추천을 생성하지 못했습니다</p>
                    <p className="text-xs text-red-700">{aiError}</p>
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => handleRequestAI()}
                        className="text-xs font-bold text-red-800 underline"
                      >
                        다시 시도하기
                      </button>
                      {aiProvider === 'claude' && (
                        <button
                          onClick={() => setShowClaudeConfig(true)}
                          className="text-xs font-bold text-amber-800 underline"
                        >
                          Claude 키 재설정하기
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* AI Results Section */}
            {aiResult && (
              <div ref={aiResultRef} className="space-y-6 animate-fadeIn">
                <div className="border-t border-slate-200 pt-6">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {aiResult.providerUsed === 'claude' ? (
                        <Bot className="w-5 h-5 text-amber-700" />
                      ) : (
                        <Sparkles className="w-5 h-5 text-teal-600" />
                      )}
                      <h3 className="text-xl font-bold font-serif-kr text-[#164e53]">
                        {aiResult.providerUsed === 'claude' ? 'Claude' : 'Gemini'} 독서 큐레이션 결과
                      </h3>
                    </div>
                    {aiResult.modelUsed && (
                      <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {aiResult.modelUsed}
                      </span>
                    )}
                  </div>
                </div>

                {/* 1. Slang Analysis Section */}
                {aiResult.slang && aiResult.slang.length > 0 && (
                  <section className="bg-white rounded-xl p-5 border border-[#dce3ea] shadow-xs space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#1f6f78] flex items-center gap-1.5">
                      <span>1. 은어 및 표현 해석</span>
                    </h4>
                    <div className="grid gap-2.5">
                      {aiResult.slang.map((s, idx) => {
                        const isUnknown = s.understood === false;
                        return (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-lg border ${
                              isUnknown
                                ? 'bg-amber-50/70 border-amber-200'
                                : 'bg-[#fafbfc] border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-sm text-[#1d2733] font-serif-kr">
                                {s.term}
                              </span>
                              {isUnknown ? (
                                <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                                  의미 불확실
                                </span>
                              ) : (
                                <span className="text-[11px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                                  해석 완료
                                </span>
                              )}
                            </div>

                            <p className="text-xs sm:text-sm text-slate-700 mb-2">
                              {s.meaning}
                            </p>

                            {/* Alternatives buttons if unknown */}
                            {isUnknown && s.alternatives && s.alternatives.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-amber-200/60">
                                <p className="text-xs text-amber-900 font-medium mb-1.5">
                                  혹시 이런 뜻으로 쓰셨나요? 누르면 해당 뜻으로 다시
                                  추천합니다:
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {s.alternatives.map((alt, aIdx) => (
                                    <button
                                      key={aIdx}
                                      onClick={() =>
                                        handleRequestAI(aiInput, {
                                          term: s.term,
                                          alt: alt
                                        })
                                      }
                                      className="px-3 py-1 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-full text-xs font-semibold transition-colors"
                                    >
                                      '{alt}' 뜻으로 읽기 →
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Emotion pills */}
                            {s.emotions && s.emotions.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {s.emotions.map((emo, eIdx) => (
                                  <span
                                    key={eIdx}
                                    className="px-2 py-0.5 bg-white border border-slate-200 rounded-full text-[11px] text-slate-600 font-medium"
                                  >
                                    #{emo}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* 2. Sentiment Summary & Intensity */}
                <section className="bg-white rounded-xl p-5 border border-[#dce3ea] shadow-xs space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#1f6f78]">
                    {aiResult.slang && aiResult.slang.length > 0 ? '2' : '1'}. 마음의 결 요약 및 감정 강도
                  </h4>

                  {aiResult.summary && (
                    <blockquote className="p-4 bg-teal-50/60 border-l-4 border-[#1f6f78] rounded-r-xl text-sm sm:text-base font-serif-kr text-[#164e53] leading-relaxed">
                      "{aiResult.summary}"
                    </blockquote>
                  )}

                  {/* Emotion Pills with Intensity Meter */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {aiResult.emotions?.map((e, idx) => {
                        const intensity = Math.max(1, Math.min(5, e.intensity || 3));
                        return (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#f0f4f7] border border-[#dce3ea] rounded-full text-xs sm:text-sm font-medium"
                          >
                            <span className="font-bold text-[#1d2733]">
                              {e.name}
                            </span>
                            <span
                              className="text-[#1f6f78] tracking-widest text-xs"
                              aria-label={`강도 ${intensity}/5`}
                            >
                              {'●'.repeat(intensity)}
                              {'○'.repeat(5 - intensity)}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {intensity}/5
                            </span>
                          </div>
                        );
                      })}

                      {aiResult.need && (
                        <div className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs sm:text-sm font-bold text-amber-900">
                          <span>필요한 처방:</span>
                          <span className="text-[#1f6f78]">『{aiResult.need}』</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      * ● 표시가 많을수록 더 깊고 강하게 느껴지는 감정 상태입니다. (5점 만점)
                    </p>
                  </div>
                </section>

                {/* Crisis Notice */}
                {aiResult.crisis ? (
                  <div className="p-5 bg-red-50 border border-red-300 rounded-xl text-red-900 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-base text-red-800">
                      <PhoneCall className="w-5 h-5" />
                      <span>당신의 마음을 가장 먼저 지켜주세요</span>
                    </div>
                    <p className="text-sm leading-relaxed">
                      지금 혼자 감당하기 벅찬 고통이나 위기 상황에 계신 것으로
                      보입니다. 책을 읽는 것보다 전문 상담사나 주변의 다정한 사람과
                      먼저 이야기 나누시기를 간곡히 권합니다.
                    </p>
                    <div className="pt-2 text-xs font-semibold flex flex-wrap gap-3 text-red-700">
                      <span>자살예방상담전화: 📞 109 (24시간)</span>
                      <span>정신건강상담전화: 📞 1577-0199</span>
                      <span>위급상황: 📞 119</span>
                    </div>
                  </div>
                ) : (
                  /* 3. AI Book Recommendations List */
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-bold font-serif-kr text-[#164e53]">
                        {aiResult.slang && aiResult.slang.length > 0 ? '3' : '2'}. 상황 맞춤 추천 도서
                      </h4>
                      <span className="text-xs text-[#5d6b7a]">
                        총 {aiResult.books?.length || 0}권 추천
                      </span>
                    </div>

                    <div className="space-y-3">
                      {aiResult.books?.map((book, idx) => (
                        <article
                          key={idx}
                          className="bg-white rounded-xl p-4 border border-[#dce3ea] shadow-xs hover:border-[#1f6f78] transition-all flex gap-4"
                        >
                          {renderBookCover(book.title, book.author)}
                          <div className="flex-1 flex flex-col justify-between min-w-0">
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="text-[11px] font-bold text-[#1f6f78] bg-teal-50 px-2 py-0.5 rounded">
                                  {book.genre || '추천 도서'}
                                </span>
                              </div>
                              <h5 className="font-bold text-base text-[#1d2733] font-serif-kr line-clamp-1 mb-0.5">
                                『{book.title}』
                              </h5>
                              <p className="text-xs text-[#5d6b7a] mb-2 font-medium">
                                {book.author} 저
                              </p>
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                              {book.why}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>

                    <p className="text-[12px] text-slate-500 bg-slate-100/70 p-3 rounded-lg text-center leading-relaxed">
                      💡 AI가 선정한 도서는 실제 출판된 작품들이며, 감정 상태에 맞춰
                      위로와 통찰을 드리기 위한 추천입니다. 읽기 전에 도서관이나 서점에서
                      미리보기를 참고해 보세요.
                    </p>
                  </section>
                )}
              </div>
            )}
          </div>
        )}

        {/* Global Footer & Info */}
        <footer className="pt-6 border-t border-slate-200 text-xs text-[#6b7c8f] space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="font-semibold text-slate-700">
              마음 서가 · 감정과 상황으로 만나는 인생의 책
            </p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] text-slate-500">
                Gemini & Claude 멀티 AI 모델 지원
              </span>
            </div>
          </div>
          <p className="leading-relaxed">
            탭 1의 도서 목록 및 감정 분류는 고정 큐레이션 데이터이며, 탭 2는 Google
            Gemini 및 Anthropic Claude 인공지능이 사용자의 서술을 정밀 분석하여 생성합니다. 도서 표지는
            제목의 고유 해시와 서체로 동적 생성된 그래픽입니다.
          </p>
        </footer>
      </main>

      {/* AI Admin Configuration Modal */}
      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onConfigSaved={(savedConfig) => {
          setServerAIConfig(savedConfig);
          fetchServerConfig();
        }}
      />
    </div>
  );
}
