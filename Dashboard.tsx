
import React, { useState } from 'react';
import { Cow, Calf, DashboardAlert, GeneralEvent, Note } from '../types';
import { Bell, AlertTriangle, Calendar, CheckCircle, Sparkles, Pencil, History, X, CheckCircle2, Circle, Trash2, Send, ClipboardList, ArrowRight } from 'lucide-react';
import { CalendarView } from './CalendarView';
import { COMMON_MEMO_TAGS } from '../constants';
import { getCalendarEvents, formatDateJP, parseDate, daysBetween, calculateBreedingScore, parseMemoTarget } from '../utils/breedingService';

interface DashboardProps {
  cows: Cow[];
  calves: Calf[];
  alerts: DashboardAlert[];
  onCowClick: (cowId: string) => void;
  generalEvents: GeneralEvent[];
  onAddGeneralEvent: (event: Omit<GeneralEvent, 'id'>) => void;
  onUpdateCow: (cow: Cow) => void;
  onUpdateCalf: (calf: Calf) => void;
}

// メモ一覧に表示する共通形式（母牛のメモ／子牛のメモをまとめて扱う）
type MemoEntry =
  | { animalType: 'COW'; note: Note; cow: Cow }
  | { animalType: 'CALF'; note: Note; calf: Calf; cow?: Cow };

export const Dashboard: React.FC<DashboardProps> = ({ cows, calves, alerts, onCowClick, generalEvents, onAddGeneralEvent, onUpdateCow, onUpdateCalf }) => {
  const [memoText, setMemoText] = useState('');
  const [showQuickTags, setShowQuickTags] = useState(false);
  const [showAllMemos, setShowAllMemos] = useState(false);

  const memoPreview = memoText.trim() ? parseMemoTarget(memoText, cows, calves) : null;

  const handleTagClick = (tag: string) => {
      setMemoText(prev => prev.trim() ? `${prev.trim()} ${tag}` : tag);
      setShowQuickTags(false);
  };

  const handleSendMemo = () => {
      if (!memoPreview) return;
      const now = new Date().toISOString();

      if (memoPreview.kind === 'COW') {
          if (!memoPreview.text) return;
          const newNote: Note = { id: Date.now().toString(), date: now, text: memoPreview.text };
          onUpdateCow({ ...memoPreview.cow, notes: [...(memoPreview.cow.notes || []), newNote] });
          setMemoText('');
      } else if (memoPreview.kind === 'CALF') {
          if (!memoPreview.text) return;
          const newNote: Note = { id: Date.now().toString(), date: now, text: memoPreview.text };
          onUpdateCalf({ ...memoPreview.calf, notes: [...(memoPreview.calf.notes || []), newNote] });
          setMemoText('');
      }
      // AMBIGUOUS_COW / NOT_FOUND_COW / NOT_FOUND_CALF / NO_REFERENCE の場合は送信せず、プレビューのエラー表示に任せる
  };

  // 全ての母牛・子牛のメモをまとめて新しい順に並べたもの（更新履歴一覧用）
  const allMemos: MemoEntry[] = [
      ...cows.filter(c => !c.isRemoved).flatMap(cow => (cow.notes || []).map(note => ({ animalType: 'COW' as const, note, cow }))),
      ...calves.filter(c => !c.isRemoved).flatMap(calf => (calf.notes || []).map(note => ({ animalType: 'CALF' as const, note, calf, cow: cows.find(c => c.id === calf.motherId) }))),
  ].sort((a, b) => new Date(b.note.date).getTime() - new Date(a.note.date).getTime());

  const handleToggleMemoDone = (entry: MemoEntry) => {
      const updatedNote = { ...entry.note, isDone: !entry.note.isDone };
      if (entry.animalType === 'COW') {
          onUpdateCow({ ...entry.cow, notes: (entry.cow.notes || []).map(n => n.id === entry.note.id ? updatedNote : n) });
      } else {
          onUpdateCalf({ ...entry.calf, notes: (entry.calf.notes || []).map(n => n.id === entry.note.id ? updatedNote : n) });
      }
  };

  const handleDeleteMemo = (entry: MemoEntry) => {
      if (!window.confirm('このメモを削除しますか？')) return;
      if (entry.animalType === 'COW') {
          onUpdateCow({ ...entry.cow, notes: (entry.cow.notes || []).filter(n => n.id !== entry.note.id) });
      } else {
          onUpdateCalf({ ...entry.calf, notes: (entry.calf.notes || []).filter(n => n.id !== entry.note.id) });
      }
  };

  const memoEntryLabel = (entry: MemoEntry) => {
      if (entry.animalType === 'COW') {
          return `${entry.cow.earTag ? entry.cow.earTag.slice(-5) : ''} ${entry.cow.name}`.trim();
      }
      const motherLabel = entry.cow ? `${entry.cow.earTag.slice(-5)} ${entry.cow.name}` : '母牛不明';
      return `${motherLabel}の子 (${entry.calf.earTag ? entry.calf.earTag.slice(-5) : '未登録'})`;
  };

  const urgentAlerts = alerts.filter(a => a.type === 'URGENT' && !a.id.startsWith('calving-'));
  const infoAlerts = alerts.filter(a => a.type === 'INFO');
  
  // Merge cow events and general events
  const cowEvents = getCalendarEvents(cows);
  const calendarEvents = [
      ...cowEvents,
      ...generalEvents.map(g => ({
          date: g.date,
          type: 'GENERAL' as const,
          title: g.title,
          color: g.color,
          cowId: undefined
      }))
  ];

  const { score, grade } = calculateBreedingScore(cows);
  const gradeColors: Record<string, string> = {
    S: 'text-yellow-300', A: 'text-wagyu-200', B: 'text-blue-200', C: 'text-orange-200', 'N/A': 'text-gray-300',
  };

  return (
    <div className="p-4 space-y-6 pb-28">
      <header className="hero-gradient rounded-3xl p-5 text-white shadow-glow">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">和牛メイト</h1>
                <p className="text-sm text-wagyu-100 mt-0.5">{formatDateJP(new Date())}</p>
            </div>
            <div className="flex flex-col items-center bg-white/10 rounded-2xl px-4 py-2 backdrop-blur-sm border border-white/10">
                <div className="flex items-center gap-1 text-[10px] font-bold text-wagyu-100 uppercase tracking-wider">
                    <Sparkles size={12} /> 繁殖スコア
                </div>
                <div className={`text-3xl font-extrabold leading-tight ${gradeColors[grade] || 'text-white'}`}>
                    {grade}
                </div>
                <div className="text-[11px] text-wagyu-100">{score}点</div>
            </div>
        </div>
      </header>

      {/* Quick Memo Section */}
      <section className="bg-white rounded-2xl shadow-soft border border-gray-100 p-4">
          <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                  <Pencil size={18} className="text-wagyu-600" /> クイックメモ
              </h2>
              {allMemos.length > 0 && (
                  <button
                      onClick={() => setShowAllMemos(true)}
                      className="text-xs text-wagyu-600 font-bold flex items-center gap-1 hover:underline"
                  >
                      <History size={14} /> 更新履歴を見る
                  </button>
              )}
          </div>

          <p className="text-xs text-gray-400 mb-2">
              耳標番号から入力してください（例: 44442 発情 / 44442の子 下痢）
          </p>

          {showQuickTags && (
              <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-50 rounded-lg">
                  {COMMON_MEMO_TAGS.map(tag => (
                      <button
                          key={tag}
                          type="button"
                          onClick={() => handleTagClick(tag)}
                          className="px-3 py-1 bg-white border border-gray-200 hover:bg-wagyu-50 hover:border-wagyu-300 text-gray-700 rounded-full text-xs font-medium transition-colors"
                      >
                          {tag}
                      </button>
                  ))}
              </div>
          )}

          <div className="flex items-end gap-2">
              <button
                  type="button"
                  onClick={() => setShowQuickTags(v => !v)}
                  className={`p-2.5 rounded-full flex-shrink-0 transition-colors ${showQuickTags ? 'bg-wagyu-100 text-wagyu-700 shadow-inner' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                  title="よくある症状・メモから選ぶ"
              >
                  <ClipboardList size={20} />
              </button>
              <textarea
                  value={memoText}
                  onChange={(e) => setMemoText(e.target.value)}
                  placeholder="44442 発情"
                  className="flex-1 max-h-24 min-h-[40px] rounded-xl border border-gray-300 bg-gray-50 placeholder-gray-400 px-4 py-2.5 outline-none resize-none text-sm focus:ring-2 focus:ring-wagyu-300 transition-colors"
                  rows={1}
              />
              <button
                  onClick={handleSendMemo}
                  disabled={!memoPreview || (memoPreview.kind !== 'COW' && memoPreview.kind !== 'CALF') || !memoPreview.text}
                  className="bg-wagyu-600 text-white p-2.5 rounded-full flex-shrink-0 disabled:opacity-50 disabled:bg-gray-400 transition-colors shadow-sm"
              >
                  <Send size={18} className="translate-x-[1px]" />
              </button>
          </div>

          {/* Preview / Feedback */}
          {memoPreview && (
              <div className="mt-2 text-xs">
                  {memoPreview.kind === 'COW' && (
                      <div className={`flex items-center gap-1 ${memoPreview.text ? 'text-wagyu-700 font-bold' : 'text-gray-400'}`}>
                          <ArrowRight size={12} /> {memoPreview.cow.earTag.slice(-5)} {memoPreview.cow.name} のメモに保存されます
                          {!memoPreview.text && <span className="ml-1 text-gray-400">（メモ内容を入力してください）</span>}
                      </div>
                  )}
                  {memoPreview.kind === 'CALF' && (
                      <div className={`flex items-center gap-1 ${memoPreview.text ? 'text-wagyu-700 font-bold' : 'text-gray-400'}`}>
                          <ArrowRight size={12} /> {memoPreview.cow.earTag.slice(-5)} {memoPreview.cow.name} の子（{memoPreview.calf.earTag ? memoPreview.calf.earTag.slice(-5) : '未登録'}）のメモに保存されます
                          {!memoPreview.text && <span className="ml-1 text-gray-400">（メモ内容を入力してください）</span>}
                      </div>
                  )}
                  {memoPreview.kind === 'NOT_FOUND_COW' && (
                      <div className="text-red-500">耳標下{memoPreview.digits.length}桁「{memoPreview.digits}」に一致する牛が見つかりません</div>
                  )}
                  {memoPreview.kind === 'AMBIGUOUS_COW' && (
                      <div className="text-orange-500">「{memoPreview.digits}」に一致する牛が{memoPreview.matches.length}頭あります。もう少し桁数を増やしてください</div>
                  )}
                  {memoPreview.kind === 'NOT_FOUND_CALF' && (
                      <div className="text-red-500">{memoPreview.cow.name}の子牛データが見つかりません（分娩記録から登録してください）</div>
                  )}
                  {memoPreview.kind === 'NO_REFERENCE' && (
                      <div className="text-gray-400">先頭に耳標番号を入力してください（例: 44442 発情）</div>
                  )}
              </div>
          )}
      </section>

      {/* Calendar Section */}
      <section>
          <CalendarView 
            events={calendarEvents} 
            onCowClick={onCowClick} 
            onAddGeneralEvent={onAddGeneralEvent}
          />
      </section>

      {/* Upcoming Calving Section */}
      {(() => {
        const today = new Date();
        const calvingCows = cows
          .filter(c => {
              if (!c.expectedCalvingDate || (c.status !== 'PREGNANT' && c.status !== 'CALVING_SOON' && c.status !== 'INSEMINATED')) return false;
              const due = parseDate(c.expectedCalvingDate);
              const diff = daysBetween(due, today);
              return diff >= -30 && diff <= 30; // Show cows due within 30 days (or overdue up to 30 days)
          })
          .sort((a, b) => a.expectedCalvingDate!.localeCompare(b.expectedCalvingDate!));
        
        if (calvingCows.length === 0) return null;

        return (
          <section>
            <h2 className="text-lg font-bold text-pink-600 mb-2 flex items-center">
              <Calendar className="mr-2" size={20} />
              分娩予定 ({calvingCows.length})
            </h2>
            <div className="space-y-3">
              {calvingCows.map(cow => {
                const displayId = cow.earTag.length >= 5 ? cow.earTag.slice(-5) : cow.earTag;
                const displayName = `${displayId} ${cow.name}`;
                const due = parseDate(cow.expectedCalvingDate!);
                const diff = daysBetween(due, today);
                
                let statusText = '';
                if (diff > 0) {
                    statusText = `あと${diff}日`;
                } else if (diff === 0) {
                    statusText = '本日予定';
                } else {
                    statusText = `${Math.abs(diff)}日超過`;
                }

                return (
                  <div 
                    key={cow.id} 
                    onClick={() => onCowClick(cow.id)}
                    className="bg-pink-50 border-l-4 border-pink-500 p-4 rounded-2xl shadow-soft tap-card"
                  >
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-bold text-pink-900">{displayName}</h3>
                            <p className="text-sm text-pink-700">予定日: {formatDateJP(cow.expectedCalvingDate!)} ({statusText})</p>
                        </div>
                        <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-pink-100 text-pink-500">
                            {formatDateJP(cow.expectedCalvingDate!, 'short')}
                        </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* Urgent Section */}
      {urgentAlerts.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-red-600 mb-2 flex items-center">
            <AlertTriangle className="mr-2" size={20} />
            至急対応 ({urgentAlerts.length})
          </h2>
          <div className="space-y-3">
            {urgentAlerts.map(alert => (
              <div 
                key={alert.id} 
                onClick={() => onCowClick(alert.cowId)}
                className="bg-red-50 border-l-4 border-red-500 p-4 rounded-2xl shadow-soft tap-card"
              >
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-red-900">{alert.cowName}</h3>
                        <p className="text-sm text-red-700">{alert.message}</p>
                    </div>
                    <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-red-100 text-red-500">
                        {formatDateJP(alert.date, 'short')}
                    </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Info/Calendar Section (List view of daily tasks) */}
      <section>
         <h2 className="text-lg font-bold text-wagyu-700 mb-2 flex items-center">
            <CheckCircle className="mr-2" size={20} />
            本日の予定 ({infoAlerts.length})
          </h2>
          {infoAlerts.length === 0 ? (
              <div className="p-6 text-center text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
                  本日の予定はありません
              </div>
          ) : (
             <div className="space-y-2">
                {infoAlerts.map(alert => (
                <div 
                    key={alert.id}
                    onClick={() => onCowClick(alert.cowId)}
                    className="bg-white border border-gray-100 p-3 rounded-2xl shadow-soft flex items-center justify-between tap-card"
                >
                    <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
                            {alert.cowName.substring(0,1)}
                        </div>
                        <div>
                            <div className="font-bold text-gray-800">{alert.cowName}</div>
                            <div className="text-xs text-gray-500">{alert.message}</div>
                        </div>
                    </div>
                </div>
                ))}
             </div>
          )}
      </section>

      {/* Quick Stats Grid */}
      <section className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl shadow-soft border border-gray-100">
              <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">総頭数</span>
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm">🐄</div>
              </div>
              <div className="text-3xl font-extrabold text-gray-800 mt-1">{cows.filter(c => !c.isRemoved).length}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-soft border border-gray-100">
              <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">妊娠中</span>
                  <div className="w-8 h-8 rounded-full bg-wagyu-50 flex items-center justify-center text-sm">🤰</div>
              </div>
              <div className="text-3xl font-extrabold text-wagyu-600 mt-1">
                {cows.filter(c => c.status === 'PREGNANT' || c.status === 'CALVING_SOON').length}
              </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-soft border border-gray-100">
              <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">種付済</span>
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-sm">💉</div>
              </div>
              <div className="text-3xl font-extrabold text-blue-600 mt-1">
                {cows.filter(c => c.status === 'INSEMINATED').length}
              </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-soft border border-gray-100">
              <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">空胎</span>
                  <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-sm">⚠️</div>
              </div>
              <div className="text-3xl font-extrabold text-red-500 mt-1">
                {cows.filter(c => c.status === 'EMPTY' && !c.isRemoved).length}
              </div>
          </div>
      </section>

      {/* All Memos History Modal */}
      {showAllMemos && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center animate-fade-in p-4">
              <div className="bg-white w-full sm:w-96 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                          <History size={20} className="text-wagyu-600" /> メモ更新履歴 ({allMemos.length})
                      </h3>
                      <button onClick={() => setShowAllMemos(false)}><X size={22} className="text-gray-400" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                      {allMemos.length === 0 ? (
                          <div className="text-center text-gray-400 text-sm py-10">まだメモがありません</div>
                      ) : (
                          <div className="space-y-2">
                              {allMemos.map(entry => {
                                  const noteDate = new Date(entry.note.date);
                                  const timeString = isNaN(noteDate.getTime()) ? '' : noteDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                                  return (
                                      <div key={entry.note.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                                          <div className="flex justify-between items-start mb-1">
                                              <button
                                                  onClick={() => {
                                                      setShowAllMemos(false);
                                                      const targetCowId = entry.animalType === 'COW' ? entry.cow.id : entry.calf.motherId;
                                                      if (targetCowId) onCowClick(targetCowId);
                                                  }}
                                                  className="text-xs font-bold text-wagyu-700 bg-wagyu-50 px-2 py-0.5 rounded hover:underline"
                                              >
                                                  {memoEntryLabel(entry)}
                                              </button>
                                              <div className="flex items-center gap-2">
                                                  <span className="text-[10px] text-gray-400">{formatDateJP(entry.note.date.split('T')[0], 'short')} {timeString}</span>
                                                  <button
                                                      onClick={() => handleDeleteMemo(entry)}
                                                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                  >
                                                      <Trash2 size={14} />
                                                  </button>
                                              </div>
                                          </div>
                                          <div className="flex items-start gap-2">
                                              {entry.note.isTodo && (
                                                  <button onClick={() => handleToggleMemoDone(entry)} className="mt-0.5 flex-shrink-0">
                                                      {entry.note.isDone ? (
                                                          <CheckCircle2 size={16} className="text-green-500" />
                                                      ) : (
                                                          <Circle size={16} className="text-gray-300 hover:text-gray-400" />
                                                      )}
                                                  </button>
                                              )}
                                              <div className={`flex-1 text-sm whitespace-pre-wrap ${entry.note.isTodo && entry.note.isDone ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                                  {entry.note.text}
                                              </div>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
