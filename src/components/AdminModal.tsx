import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  Key,
  ShieldAlert,
  Save,
  RotateCcw,
  Sparkles,
  Cpu,
  Sliders,
  Play,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  LogOut,
  FileText,
  Compass,
  RefreshCw,
  BookOpen,
  UserCheck,
  Plus,
  Trash2
} from 'lucide-react';
import {
  AIConfig,
  DEFAULT_SYSTEM_INSTRUCTION,
  DEFAULT_AI_CONFIG,
  ThinkingLevelType
} from '../types/aiConfig';
import { signInWithGoogle, logoutGoogle } from '../lib/firebaseAuth';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (savedConfig: AIConfig) => void;
}

const GoogleIcon = () => (
  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

export default function AdminModal({ isOpen, onClose, onConfigSaved }: AdminModalProps) {
  // Authentication State
  const [token, setToken] = useState<string>(() => {
    try {
      return sessionStorage.getItem('maum_admin_token') || '';
    } catch {
      return '';
    }
  });

  const [adminUser, setAdminUser] = useState<{
    email: string;
    displayName?: string;
    photoURL?: string;
  } | null>(() => {
    try {
      const saved = sessionStorage.getItem('maum_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'prompt' | 'engine' | 'test'>('prompt');

  // Form Configuration State
  const [systemInstruction, setSystemInstruction] = useState(DEFAULT_SYSTEM_INSTRUCTION);
  const [defaultModel, setDefaultModel] = useState('gemini-3.1-flash-lite');
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevelType>('MINIMAL');
  const [temperature, setTemperature] = useState(0.7);
  const [recommendationCount, setRecommendationCount] = useState(3);
  const [allowedAdminEmails, setAllowedAdminEmails] = useState<string[]>([]);
  const [newAdminEmailInput, setNewAdminEmailInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [isCustomized, setIsCustomized] = useState(false);

  // UI Feedback States
  const [fetchingConfig, setFetchingConfig] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live Test Sandbox State
  const [testInput, setTestInput] = useState('오늘 큰 발표가 망해서 멘붕 오고 이불킥하고 싶어');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Load config on open if authenticated
  useEffect(() => {
    if (isOpen && token) {
      loadServerConfig();
    }
  }, [isOpen, token]);

  const loadServerConfig = async () => {
    setFetchingConfig(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/admin/config', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        handleLogout();
        setAuthError('세션이 만료되었습니다. 다시 로그인해 주세요.');
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setSystemInstruction(data.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION);
        setDefaultModel(data.defaultModel || 'gemini-3.1-flash-lite');
        setThinkingLevel(data.thinkingLevel || 'MINIMAL');
        setTemperature(typeof data.temperature === 'number' ? data.temperature : 0.7);
        setRecommendationCount(data.recommendationCount || 3);
        if (Array.isArray(data.allowedAdminEmails)) {
          setAllowedAdminEmails(data.allowedAdminEmails);
        }
        setUpdatedAt(data.updatedAt || '');
        setIsCustomized(Boolean(data.isCustomized));
      } else {
        setErrorMessage(data.error || '설정을 불러오지 못했습니다.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || '네트워크 연결 오류');
    } finally {
      setFetchingConfig(false);
    }
  };

  // Handle Google Login
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setAuthError(null);
    try {
      const { user, idToken } = await signInWithGoogle();
      const res = await fetch('/api/admin/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          idToken
        })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setToken(data.token);
        setAdminUser(data.user);
        try {
          sessionStorage.setItem('maum_admin_token', data.token);
          sessionStorage.setItem('maum_admin_user', JSON.stringify(data.user));
        } catch {}
      } else {
        setAuthError(data.error || 'Google 로그인 인증에 실패했습니다.');
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setAuthError('Google 로그인 팝업 창이 닫혔습니다.');
      } else {
        setAuthError(err.message || 'Google 로그인 중 오류가 발생했습니다.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // Handle Password Login (Fallback)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;

    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput.trim() })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setToken(data.token);
        setAdminUser({ email: 'admin (비밀번호 인증)' });
        try {
          sessionStorage.setItem('maum_admin_token', data.token);
          sessionStorage.setItem('maum_admin_user', JSON.stringify({ email: 'admin' }));
        } catch {}
        setPasswordInput('');
      } else {
        setAuthError(data.error || '비밀번호가 올바르지 않습니다.');
      }
    } catch (err: any) {
      setAuthError(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutGoogle();
    } catch {}
    setToken('');
    setAdminUser(null);
    try {
      sessionStorage.removeItem('maum_admin_token');
      sessionStorage.removeItem('maum_admin_user');
    } catch {}
    setAuthError(null);
  };

  // Save Settings to Server
  const handleSave = async () => {
    setSaveLoading(true);
    setErrorMessage(null);
    try {
      const body: any = {
        systemInstruction,
        defaultModel,
        thinkingLevel,
        temperature,
        recommendationCount,
        allowedAdminEmails
      };
      if (newPassword.trim().length >= 4) {
        body.newPassword = newPassword.trim();
      }

      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '설정 저장 실패');
      }

      setSaveToast('모든 방문자에게 새로운 AI 설정이 즉시 반영되었습니다!');
      setIsCustomized(true);
      setUpdatedAt(new Date().toISOString());
      setNewPassword('');

      if (onConfigSaved) {
        onConfigSaved(data.config);
      }

      setTimeout(() => {
        setSaveToast(null);
      }, 3500);
    } catch (err: any) {
      setErrorMessage(err.message || '저장 중 오류 발생');
    } finally {
      setSaveLoading(false);
    }
  };

  // Reset to Defaults
  const handleReset = async () => {
    if (!window.confirm('모든 AI 프롬프트와 설정을 서비스 기본값으로 복원하시겠습니까?')) {
      return;
    }

    setResetLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '초기화 실패');

      setSystemInstruction(DEFAULT_SYSTEM_INSTRUCTION);
      setDefaultModel(DEFAULT_AI_CONFIG.defaultModel);
      setThinkingLevel(DEFAULT_AI_CONFIG.thinkingLevel);
      setTemperature(DEFAULT_AI_CONFIG.temperature);
      setRecommendationCount(DEFAULT_AI_CONFIG.recommendationCount);
      setIsCustomized(false);
      setUpdatedAt(new Date().toISOString());

      setSaveToast('서비스 기본 설정으로 복원되었습니다.');
      if (onConfigSaved) {
        onConfigSaved(data.config);
      }
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || '초기화 실패');
    } finally {
      setResetLoading(false);
    }
  };

  // Run Test Sandbox
  const handleRunTest = async () => {
    if (!testInput.trim()) return;
    setTestLoading(true);
    setTestError(null);
    setTestResult(null);

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testInput.trim(),
          provider: 'gemini',
          configOverride: {
            systemInstruction,
            defaultModel,
            thinkingLevel,
            temperature,
            recommendationCount
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '테스트 생성 실패');
      }
      setTestResult(data);
    } catch (err: any) {
      setTestError(err.message || '테스트 요청 중 오류가 발생했습니다.');
    } finally {
      setTestLoading(false);
    }
  };

  const handleAddAllowedEmail = () => {
    const email = newAdminEmailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    if (!allowedAdminEmails.includes(email)) {
      setAllowedAdminEmails([...allowedAdminEmails, email]);
    }
    setNewAdminEmailInput('');
  };

  const handleRemoveAllowedEmail = (emailToRemove: string) => {
    setAllowedAdminEmails(allowedAdminEmails.filter((e) => e !== emailToRemove));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Top Header Bar */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#164e53] to-[#1f6f78] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
              <Lock className="w-4 h-4 text-teal-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif-kr font-bold text-base sm:text-lg tracking-tight">
                  마음 서가 AI 관리자 콘솔
                </h3>
                {token && (
                  <span className="text-[10px] bg-teal-300/20 text-teal-100 border border-teal-300/40 px-2 py-0.5 rounded-full font-sans font-medium">
                    서버 영구 반영
                  </span>
                )}
                {adminUser?.email && (
                  <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-sans hidden sm:inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    {adminUser.email}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-teal-100/80 -mt-0.5">
                AI 추천 지침 및 추론 파라미터 세밀 제어
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/admin-test-report.html"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 text-teal-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs flex items-center gap-1 border border-teal-300/40"
              title="관리자 기능 테스트 결과 보고서 보기"
            >
              <FileText className="w-3.5 h-3.5 text-teal-200" />
              <span className="hidden sm:inline font-medium">테스트 보고서</span>
            </a>
            {token && (
              <button
                onClick={handleLogout}
                className="p-1.5 text-teal-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs flex items-center gap-1"
                title="관리자 로그아웃"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-teal-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="창 닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Toast Notification */}
        {saveToast && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 animate-fadeIn flex-shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            <span>{saveToast}</span>
          </div>
        )}

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-2 text-xs font-medium flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
              ✕
            </button>
          </div>
        )}

        {/* MAIN BODY AREA */}
        {!token ? (
          /* 1. AUTHENTICATION LOGIN VIEW */
          <div className="p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 text-[#1f6f78] flex items-center justify-center shadow-xs">
              <Lock className="w-7 h-7 text-[#1f6f78]" />
            </div>
            <div>
              <h4 className="text-lg font-bold font-serif-kr text-slate-800">
                관리자 인증
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                AI 시스템 프롬프트 및 추천 지침을 안전하게 관리하기 위해 Google 계정으로 로그인해 주세요.
              </p>
            </div>

            {authError && (
              <div className="w-full p-3 bg-red-50 border border-red-200 rounded-xl text-left text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            {/* Primary Google Login Button */}
            <div className="w-full pt-1 space-y-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 rounded-xl font-medium text-sm flex items-center justify-center gap-3 transition-all shadow-xs hover:shadow-sm disabled:opacity-50"
              >
                {googleLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                    <span>Google 계정 인증 중...</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    <span className="font-semibold text-slate-800">Google 계정으로 관리자 로그인</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 h-px bg-slate-200"></div>
                <span className="text-[11px] text-slate-400">또는</span>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>

              {!showPasswordFallback ? (
                <button
                  type="button"
                  onClick={() => setShowPasswordFallback(true)}
                  className="w-full py-2 text-xs text-slate-500 hover:text-slate-800 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Key className="w-3.5 h-3.5" />
                  비밀번호로 로그인
                </button>
              ) : (
                <form onSubmit={handleLogin} className="w-full space-y-2.5 pt-1 text-left animate-fadeIn">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="관리자 비밀번호 입력"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1f6f78]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPasswordFallback(false)}
                      className="flex-1 py-2 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Google 로그인으로 돌아가기
                    </button>
                    <button
                      type="submit"
                      disabled={authLoading || !passwordInput.trim()}
                      className="flex-1 py-2 text-xs font-bold text-white bg-[#1f6f78] hover:bg-[#164e53] disabled:bg-slate-300 rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5"
                    >
                      {authLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                      인증
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                닫기
              </button>
            </div>
          </div>
        ) : (
          /* 2. AUTHENTICATED DASHBOARD VIEW */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 bg-slate-50/70 px-4 sm:px-6 pt-2 gap-2 flex-shrink-0">
              <button
                onClick={() => setActiveTab('prompt')}
                className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'prompt'
                    ? 'border-[#1f6f78] text-[#1f6f78]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                1. 프롬프트 & 추천 지침
              </button>
              <button
                onClick={() => setActiveTab('engine')}
                className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'engine'
                    ? 'border-[#1f6f78] text-[#1f6f78]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Cpu className="w-4 h-4" />
                2. 모델 & 추론 파라미터
              </button>
              <button
                onClick={() => setActiveTab('test')}
                className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'test'
                    ? 'border-[#1f6f78] text-[#1f6f78]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Play className="w-4 h-4 text-emerald-600" />
                3. 실시간 샌드박스 테스트
              </button>
            </div>

            {/* Tab Contents Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* TAB 1: SYSTEM PROMPT & PERSONA */}
              {activeTab === 'prompt' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-[#1f6f78]" />
                        AI 시스템 프롬프트 (System Instruction)
                      </h4>
                      <p className="text-xs text-slate-500">
                        AI 사서의 페르소나, 어조, 분석 순서, 위기 감지 및 도서 추천 기준을 직접 커스터마이징합니다.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSystemInstruction(DEFAULT_SYSTEM_INSTRUCTION)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors"
                        title="원래 기본 프롬프트 텍스트 불러오기"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        기본 텍스트 불러오기
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <textarea
                      value={systemInstruction}
                      onChange={(e) => setSystemInstruction(e.target.value)}
                      rows={14}
                      className="w-full p-3.5 text-xs sm:text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1f6f78] leading-relaxed resize-y"
                      placeholder="AI 시스템 프롬프트를 입력하세요..."
                    />
                    <div className="absolute right-3 bottom-3 text-[11px] text-slate-400 bg-white/80 px-2 py-0.5 rounded">
                      {systemInstruction.length}자
                    </div>
                  </div>

                  {/* Tips Card */}
                  <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl space-y-2 text-xs text-teal-950">
                    <p className="font-semibold flex items-center gap-1 text-[#164e53]">
                      <Compass className="w-3.5 h-3.5" /> 프롬프트 작성 팁
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
                      <li>
                        <strong>은어 분석 규칙:</strong> 문장 속 신조어/초성의 본래 뜻(meaning), 감정(emotions), 불확실 시 alternatives 제안 구조를 유지하는 것이 좋습니다.
                      </li>
                      <li>
                        <strong>위기 상황(crisis):</strong> 자해/자살 위험 감지 시 <code className="bg-white px-1 rounded border">crisis: true</code>와 함께 빈 도서 목록을 반환하도록 설계되어 응급 안내를 우선합니다.
                      </li>
                      <li>
                        <strong>어조 변경:</strong> "다정하고 따뜻한 문체" 대신 "명쾌하고 분석적인 철학자 어조"나 "재치 있는 상담사 어조" 등으로 변경해 보실 수 있습니다.
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* TAB 2: MODEL & THINKING LEVEL & PARAMETERS */}
              {activeTab === 'engine' && (
                <div className="space-y-6">
                  {/* Default Model Selector */}
                  <section className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                      기본 AI 모델 선택
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setDefaultModel('gemini-3.1-flash-lite')}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          defaultModel === 'gemini-3.1-flash-lite'
                            ? 'bg-teal-50/80 border-[#1f6f78] ring-2 ring-teal-200 shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-slate-800">Gemini 3.1 Flash-Lite</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                            초고속 추천
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          1.5~2초대의 번개 같은 응답 속도로 감정을 분석하고 도서를 처방합니다. (기본 권장)
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDefaultModel('gemini-3.8-flash')}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          defaultModel === 'gemini-3.8-flash'
                            ? 'bg-teal-50/80 border-[#1f6f78] ring-2 ring-teal-200 shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-slate-800">Gemini 3.8 Flash</span>
                          <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-bold">
                            고지능 분석
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          복잡한 복합 감정과 심도 있는 문학적 연결이 필요할 때 적합한 고성능 모델입니다.
                        </p>
                      </button>
                    </div>
                  </section>

                  {/* Thinking Level (Reasoning Depth) */}
                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        추론 강도 (Thinking Level)
                      </label>
                      <span className="text-xs font-semibold text-[#1f6f78]">
                        현재: {thinkingLevel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        {
                          id: 'MINIMAL',
                          label: '최소 (MINIMAL)',
                          speed: '1~2초',
                          desc: '즉각적인 빠른 반응, 딜레이 없는 일상 큐레이션'
                        },
                        {
                          id: 'LOW',
                          label: '낮음 (LOW)',
                          speed: '2~4초',
                          desc: '가벼운 문맥 숙고 및 균형잡힌 추천'
                        },
                        {
                          id: 'MEDIUM',
                          label: '중간 (MEDIUM)',
                          speed: '4~8초',
                          desc: '깊이 있는 심리 분석 및 이유 서술'
                        },
                        {
                          id: 'HIGH',
                          label: '높음 (HIGH)',
                          speed: '8~15초',
                          desc: '최대 사고력 발휘, 복합 감정 심층 사색'
                        }
                      ].map((item) => {
                        const isSelected = thinkingLevel === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setThinkingLevel(item.id as ThinkingLevelType)}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              isSelected
                                ? 'bg-teal-50 border-[#1f6f78] text-[#164e53] font-semibold ring-1 ring-teal-300'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-bold mb-1">
                              <span>{item.label}</span>
                            </div>
                            <div className="text-[11px] text-emerald-700 font-medium mb-1">
                              예상 속도: {item.speed}
                            </div>
                            <p className="text-[10px] text-slate-500 leading-snug">
                              {item.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Recommendation Count & Temperature */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* Count */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700">
                          1회 추천 도서 권수
                        </label>
                        <span className="text-xs font-bold text-[#1f6f78] bg-white px-2 py-0.5 rounded border border-slate-200">
                          {recommendationCount}권
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {[2, 3, 4, 5].map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setRecommendationCount(count)}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                              recommendationCount === count
                                ? 'bg-[#1f6f78] text-white border-[#1f6f78]'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {count}권
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        기본 3권이 권장되며, 사용자의 화면 밀도에 맞춰 2~5권으로 조정할 수 있습니다.
                      </p>
                    </div>

                    {/* Temperature */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700">
                          창의성 지수 (Temperature)
                        </label>
                        <span className="text-xs font-mono font-bold text-[#1f6f78] bg-white px-2 py-0.5 rounded border border-slate-200">
                          {temperature.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="w-full accent-[#1f6f78] cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>0.0 (정밀·일관적)</span>
                        <span>0.7 (권장 균형)</span>
                        <span>1.0 (감성·다채로움)</span>
                      </div>
                    </div>
                  </div>

                  {/* Google Admin Emails Access Control */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-[#1f6f78]" />
                        관리자 접근 허용 Google 계정 (선택 사항)
                      </label>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        특정 Google 이메일만 관리자 콘솔에 접근할 수 있도록 제한합니다. 비워둘 경우 로그인한 모든 Google 계정이 접근할 수 있습니다.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={newAdminEmailInput}
                        onChange={(e) => setNewAdminEmailInput(e.target.value)}
                        placeholder="예: admin@gmail.com"
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1f6f78]"
                      />
                      <button
                        type="button"
                        onClick={handleAddAllowedEmail}
                        disabled={!newAdminEmailInput.trim()}
                        className="px-3 py-1.5 text-xs font-bold bg-[#1f6f78] hover:bg-[#164e53] disabled:bg-slate-300 text-white rounded-lg flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        추가
                      </button>
                    </div>

                    {allowedAdminEmails.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {allowedAdminEmails.map((email) => (
                          <span
                            key={email}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-teal-200 rounded-full text-xs text-teal-900 font-medium"
                          >
                            <span>{email}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveAllowedEmail(email)}
                              className="text-slate-400 hover:text-red-500"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Password Change Option */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">
                      대체 로그인 비밀번호 변경 (선택 사항)
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="변경할 새 비밀번호 입력 (4자 이상)"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1f6f78]"
                    />
                    <p className="text-[11px] text-slate-500">
                      비워둘 경우 기존 비밀번호가 유지됩니다.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: LIVE TEST SANDBOX */}
              {activeTab === 'test' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <Play className="w-4 h-4 text-emerald-600" />
                        실시간 테스트 샌드박스
                      </h4>
                      <p className="text-xs text-slate-500">
                        현재 작성 중인 프롬프트와 파라미터로 즉시 테스트하여 AI의 출력을 사전에 확인합니다.
                      </p>
                    </div>
                    <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
                      {defaultModel} · {thinkingLevel}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={testInput}
                        onChange={(e) => setTestInput(e.target.value)}
                        placeholder="테스트할 감정 문장 입력"
                        className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1f6f78]"
                      />
                      <button
                        type="button"
                        onClick={handleRunTest}
                        disabled={testLoading || !testInput.trim()}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
                      >
                        {testLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            테스트 중...
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            테스트 실행
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[
                        '오늘 큰 발표가 망해서 멘붕 오고 이불킥하고 싶어',
                        '야근하고 퇴근했는데 현타 와서 만사귀찮고 방전됐어',
                        '내일 소개팅인데 너무 떨리고 심쿵거려'
                      ].map((sample, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setTestInput(sample)}
                          className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded-md"
                        >
                          "{sample}"
                        </button>
                      ))}
                    </div>
                  </div>

                  {testError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{testError}</span>
                    </div>
                  )}

                  {testResult && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          테스트 응답 완료 ({testResult.providerUsed} / {testResult.modelUsed})
                        </span>
                        <span className="text-xs text-slate-500">
                          추천 도서: {testResult.books?.length || 0}권
                        </span>
                      </div>

                      {/* Summary Quote */}
                      <blockquote className="p-3 bg-white border-l-4 border-emerald-600 rounded-r-lg text-xs sm:text-sm font-serif-kr text-slate-800">
                        "{testResult.summary}"
                      </blockquote>

                      {/* Slang Preview */}
                      {testResult.slang?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {testResult.slang.map((s: any, idx: number) => (
                            <span key={idx} className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                              🏷️ <strong>{s.term}</strong>: {s.meaning}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Books Preview */}
                      <div className="space-y-2 pt-1">
                        {testResult.books?.map((b: any, idx: number) => (
                          <div key={idx} className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900">『{b.title}』 - {b.author}</span>
                              <span className="text-[10px] bg-teal-50 text-teal-800 px-1.5 py-0.5 rounded font-medium">
                                {b.genre}
                              </span>
                            </div>
                            <p className="text-slate-600 text-[11px]">{b.why}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Sticky Action Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={resetLoading || saveLoading}
                  className="px-3 py-1.5 text-xs text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded-lg border border-rose-200 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  전체 기본값 초기화
                </button>
                {updatedAt && (
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    최근 저장: {new Date(updatedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 rounded-xl"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveLoading}
                  className="px-5 py-2 text-xs font-bold bg-[#1f6f78] hover:bg-[#164e53] disabled:bg-slate-300 text-white rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                >
                  {saveLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      설정 저장 및 전체 적용
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
