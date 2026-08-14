
import React, { useState, useEffect, useRef } from 'react';
import { Cow, BreedingStatus, Settings } from '../types';
import { Search, ChevronRight, Dna, ArrowUpDown, Plus, X, Calendar, User } from 'lucide-react';
import { formatDateJP, calculateAge, daysBetween, parseDate } from '../utils/breedingService';
import { EraDateInput } from './EraDateInput';

interface CowListProps {
  cows: Cow[];
  onCowClick: (cowId: string) => void;
  settings: Settings;
  onAddCow?: (cow: Cow) => void;
  lastViewedCowId?: string | null;
}

type SortOption = 'NUMBER' | 'EXPECTED_DATE' | 'DAYS_EMPTY' | 'AGE';

export const CowList: React.FC<CowListProps> = ({ cows, onCowClick, settings, onAddCow, lastViewedCowId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('NUMBER');
  
  // Scroll Restoration
  useEffect(() => {
      if (lastViewedCowId) {
          const element = document.getElementById(`cow-card-${lastViewedCowId}`);
          if (element) {
              element.scrollIntoView({ block: 'center' });
          }
      }
  }, [lastViewedCowId]);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCow, setNewCow] = useState<{
      earTag: string, name: string, birthDate: string, fatherName: string, motherFatherName: string, groupId: string
  }>({
      earTag: '', name: '', birthDate: new Date().toISOString().split('T')[0], fatherName: '', motherFatherName: '', groupId: ''
  });

  // Filter Logic
  const filteredCows = cows.filter(cow => {
    const matchesSearch = cow.name.includes(searchTerm) || cow.earTag.endsWith(searchTerm);
    
    if (filterStatus === 'REMOVED') {
      return matchesSearch && cow.isRemoved;
    }
    
    // 抹消牛は通常のリストには表示しない
    if (cow.isRemoved) return false;

    const matchesStatus = filterStatus === 'ALL' || cow.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Sort Logic
  const sortedCows = [...filteredCows].sort((a, b) => {
      switch (sortOption) {
          case 'NUMBER':
              // Logic: Ignore the last digit (10th digit), sort based on the last 2 digits of the remaining 9.
              // Example: 1234567890 -> target "123456789" -> sort by "89"
              const getSortNum = (earTag: string) => {
                  if (earTag.length < 2) return 0;
                  // If length is 10, remove last char. Else use as is.
                  const effectiveTag = earTag.length === 10 ? earTag.slice(0, -1) : earTag;
                  // Get last 2 digits
                  const lastTwo = effectiveTag.slice(-2);
                  return parseInt(lastTwo, 10) || 0;
              };

              return getSortNum(a.earTag) - getSortNum(b.earTag);
          
          case 'EXPECTED_DATE':
              // Sort by expected date (Soonest first). Nulls go last.
              if (!a.expectedCalvingDate) return 1;
              if (!b.expectedCalvingDate) return -1;
              return new Date(a.expectedCalvingDate).getTime() - new Date(b.expectedCalvingDate).getTime();

          case 'DAYS_EMPTY':
              // Sort by last calving date (Older first = Longest empty). 
              // Only affects EMPTY or RECOVERY cows mostly, but applied generally.
              if (!a.lastCalvingDate) return 1;
              if (!b.lastCalvingDate) return -1;
              return new Date(a.lastCalvingDate).getTime() - new Date(b.lastCalvingDate).getTime(); // Ascending date = Descending days passed
            
          case 'AGE':
               return new Date(a.birthDate).getTime() - new Date(b.birthDate).getTime();

          default:
              return 0;
      }
  });

  const getStatusLabel = (status: string) => {
     if (status === 'REMOVED') return '抹消牛';
     switch (status) {
      case BreedingStatus.EMPTY: return '空胎';
      case BreedingStatus.PREGNANT: return '妊娠';
      case BreedingStatus.CALVING_SOON: return '分娩近';
      case BreedingStatus.INSEMINATED: return '種付±';
      case BreedingStatus.RECOVERY: return '休養';
      default: return status;
    }
  };

  // Logic to determine row styling based on user settings
  const getRowStyle = (cow: Cow) => {
      const today = new Date();
      let bgClass = "bg-white";
      let borderClass = "border-gray-200";
      let glitterClass = ""; // ✨ キラキラクラス

      if (cow.isRemoved) {
          bgClass = "bg-gray-200 opacity-70";
          borderClass = "border-gray-400 border-dashed";
          return { bgClass, borderClass, glitterClass };
      }

      // --- STATUS BASED BASE COLORS ---
      const customBg = settings?.statusColors?.[cow.status];
      if (customBg) {
          bgClass = customBg;
          borderClass = customBg === 'bg-white' ? 'border-gray-200' : `${customBg.replace('bg-', 'border-').replace('50', '200').replace('100', '300').replace('200', '400')}`;
      } else {
          if (cow.status === BreedingStatus.PREGNANT) {
              bgClass = "bg-green-50"; borderClass = "border-green-200";
              glitterClass = "shimmer"; // ✨ 妊娠中 → シルバーシマー
          } else if (cow.status === BreedingStatus.INSEMINATED) {
              bgClass = "bg-blue-50"; borderClass = "border-blue-200";
          } else if (cow.status === BreedingStatus.RECOVERY) {
              bgClass = "bg-gray-50"; borderClass = "border-gray-200";
          } else if (cow.status === BreedingStatus.CALVING_SOON) {
              bgClass = "bg-purple-50"; borderClass = "border-purple-200";
              glitterClass = "rainbow-glitter"; // ✨ 分娩近 → レインボー
          }
      }

      // --- ALERTS OVERRIDE (High Priority) ---
      if (cow.expectedCalvingDate) {
          const daysToCalving = daysBetween(parseDate(cow.expectedCalvingDate), today);
          
          if (daysToCalving < 0) {
              bgClass = "bg-red-50";
              borderClass = "border-red-300 border-2";
              glitterClass = "rainbow-glitter"; // ✨ 超過 → レインボー
              return { bgClass, borderClass, glitterClass };
          }

          const heiferThreshold = settings.alertHeiferCalvingSoonDays || 45;
          if (!cow.lastCalvingDate && daysToCalving <= heiferThreshold && daysToCalving >= 0) {
              bgClass = "bg-pink-50"; 
              borderClass = "border-pink-300 ring-1 ring-pink-100";
              glitterClass = "shimmer"; // ✨ 初産近 → シマー
              return { bgClass, borderClass, glitterClass };
          }

          if (daysToCalving <= settings.alertCalvingSoonDays && daysToCalving >= 0) {
              bgClass = "bg-purple-50"; 
              borderClass = "border-purple-300 ring-1 ring-purple-100";
              glitterClass = "rainbow-glitter"; // ✨ 分娩近 → レインボー
              return { bgClass, borderClass, glitterClass };
          }
      }

      if ((cow.status === BreedingStatus.EMPTY || cow.status === BreedingStatus.RECOVERY) && cow.lastCalvingDate) {
          const daysEmpty = daysBetween(today, parseDate(cow.lastCalvingDate));
          if (daysEmpty >= settings.alertEmptyDays) {
              bgClass = "bg-cyan-50";
              borderClass = "border-cyan-300";
              return { bgClass, borderClass, glitterClass };
          }
      }

      return { bgClass, borderClass, glitterClass };
  };
  
  const handleSaveNewCow = () => {
      if (!newCow.earTag || !newCow.name) {
          alert('耳標番号と名号は必須です');
          return;
      }
      
      const uniqueId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      
      const cowData: Cow = {
           id: uniqueId,
           earTag: newCow.earTag,
           name: newCow.name,
           birthDate: newCow.birthDate,
           fatherName: newCow.fatherName,
           motherFatherName: newCow.motherFatherName,
           groupId: newCow.groupId || undefined,
           status: BreedingStatus.EMPTY,
           events: [],
           badges: []
      };
      
      if (onAddCow) onAddCow(cowData);
      
      // Reset
      setNewCow({
          earTag: '', name: '', birthDate: new Date().toISOString().split('T')[0], fatherName: '', motherFatherName: '', groupId: ''
      });
      setShowAddModal(false);
  };

  const renderStatusDetail = (cow: Cow) => {
      const today = new Date();
      
      if (cow.isRemoved) {
          return <div className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-md font-medium border border-gray-200">抹消済</div>;
      }

      switch (cow.status) {
          case BreedingStatus.EMPTY:
              if (cow.lastCalvingDate) {
                  const days = daysBetween(today, parseDate(cow.lastCalvingDate));
                  return <div className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded-md font-medium border border-red-100 whitespace-nowrap"><span className="font-bold text-lg">{days}</span>日空胎</div>;
              }
              return <div className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded-md font-medium border border-red-100 whitespace-nowrap">空胎</div>;
              
          case BreedingStatus.INSEMINATED:
              if (cow.lastInseminationDate) {
                  const days = daysBetween(today, parseDate(cow.lastInseminationDate));
                  return <div className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-md font-medium border border-blue-100 whitespace-nowrap">AI後<span className="font-bold text-lg">{days}</span>日</div>;
              }
              return <div className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-md font-medium border border-blue-100 whitespace-nowrap">種付済</div>;
              
          case BreedingStatus.PREGNANT:
              if (cow.lastInseminationDate) {
                  const days = daysBetween(today, parseDate(cow.lastInseminationDate));
                  const months = Math.floor(days / 30);
                  return <div className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded-md font-medium border border-green-100 whitespace-nowrap">受胎<span className="font-bold text-lg">{months}</span>ヶ月</div>;
              }
              return <div className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded-md font-medium border border-green-100 whitespace-nowrap">妊娠中</div>;
              
          case BreedingStatus.CALVING_SOON:
              if (cow.expectedCalvingDate) {
                  const days = daysBetween(parseDate(cow.expectedCalvingDate), today);
                  if (days >= 0) {
                      return <div className="text-sm text-purple-600 bg-purple-50 px-2 py-1 rounded-md font-medium border border-purple-100 whitespace-nowrap">分娩前<span className="font-bold text-lg">{days}</span>日</div>;
                  } else {
                      return <div className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded-md font-medium border border-red-100 whitespace-nowrap">超過<span className="font-bold text-lg">{Math.abs(days)}</span>日</div>;
                  }
              }
              return <div className="text-sm text-purple-600 bg-purple-50 px-2 py-1 rounded-md font-medium border border-purple-100 whitespace-nowrap">分娩近</div>;
              
          case BreedingStatus.RECOVERY:
              if (cow.lastCalvingDate) {
                  const days = daysBetween(today, parseDate(cow.lastCalvingDate));
                  return <div className="text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-md font-medium border border-gray-200 whitespace-nowrap">出産後<span className="font-bold text-lg">{days}</span>日</div>;
              }
              return <div className="text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-md font-medium border border-gray-200 whitespace-nowrap">休養中</div>;
              
          default:
              return null;
      }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 pb-20 relative">
      <div className="sticky top-0 bg-white z-10 p-4 shadow-sm border-b border-gray-200 space-y-3">
        <div className="flex justify-between items-center mb-1">
             <h2 className="text-lg font-bold text-gray-800">母牛一覧 ({sortedCows.length}頭)</h2>
             {onAddCow && (
                 <button 
                    onClick={() => setShowAddModal(true)}
                    className="bg-wagyu-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 shadow-md hover:bg-wagyu-700 transition-colors"
                 >
                     <Plus size={16} /> 新規登録
                 </button>
             )}
        </div>
        
        {/* Search and Sort Row */}
        <div className="flex gap-2">
            <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
                type="text"
                placeholder="番号(下桁) または 名前"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-lg focus:ring-2 focus:ring-wagyu-500 focus:outline-none font-mono text-base"
            />
            </div>
            {/* Sort Dropdown */}
            <div className="relative">
                <select 
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                    className="h-full pl-8 pr-4 py-2 bg-gray-100 border-none rounded-lg text-sm font-bold text-gray-700 appearance-none focus:ring-2 focus:ring-wagyu-500 outline-none"
                >
                    <option value="NUMBER">番号順 (下2桁)</option>
                    <option value="EXPECTED_DATE">分娩予定日順</option>
                    <option value="DAYS_EMPTY">空胎日数順 (要注意)</option>
                    <option value="AGE">月齢順 (年功序列)</option>
                </select>
                <ArrowUpDown className="absolute left-2.5 top-3 text-gray-500 pointer-events-none" size={14} />
            </div>
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {['ALL', ...Object.values(BreedingStatus), 'REMOVED'].map((status) => (
                <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        filterStatus === status 
                        ? 'bg-wagyu-700 text-white shadow' 
                        : 'bg-white border border-gray-300 text-gray-600'
                    }`}
                >
                    {status === 'ALL' ? '全て' : getStatusLabel(status)}
                </button>
            ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sortedCows.map(cow => {
            const displayId = cow.earTag.length >= 5 ? cow.earTag.slice(-5) : cow.earTag;
            const { bgClass, borderClass, glitterClass } = getRowStyle(cow);

            return (
              <div
                key={cow.id}
                id={`cow-card-${cow.id}`}
                onClick={() => onCowClick(cow.id)}
                className={`${bgClass} ${glitterClass} p-4 rounded-2xl shadow-soft border ${borderClass} flex justify-between items-center tap-card relative overflow-hidden cursor-pointer`}
              >
                {/* Status Indicator Bar on Left */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    cow.status === BreedingStatus.PREGNANT ? 'bg-green-500' :
                    cow.status === BreedingStatus.INSEMINATED ? 'bg-blue-400' :
                    cow.status === BreedingStatus.CALVING_SOON ? 'bg-purple-500' :
                    'bg-gray-300'
                }`}></div>

                {/* ★点滅アイコン: 分娩予定日超過 / 再発情確認超過 */}
                {(() => {
                    const todayD = new Date();
                    let calvingOverdue = false, estrusOverdue = false;
                    if (cow.expectedCalvingDate && (cow.status === BreedingStatus.PREGNANT || cow.status === BreedingStatus.CALVING_SOON || cow.status === BreedingStatus.INSEMINATED)) {
                        if (daysBetween(parseDate(cow.expectedCalvingDate), todayD) < 0) calvingOverdue = true;
                    }
                    if (cow.status === BreedingStatus.INSEMINATED && cow.lastInseminationDate) {
                        const d = daysBetween(todayD, parseDate(cow.lastInseminationDate));
                        if (d > 24 && d < 40) estrusOverdue = true;
                    }
                    if (calvingOverdue) return <span className="absolute top-2 right-2 text-xl animate-blink z-10" title="分娩予定日超過！">🚨</span>;
                    if (estrusOverdue) return <span className="absolute top-2 right-2 text-xl animate-blink z-10" title="再発情確認日超過">⚠️</span>;
                    return null;
                })()}

                <div className="flex items-center gap-4 w-full pl-3">
                   
                   <div className="flex-1 min-w-0">
                      {/* Top Row: Ear Tag + Name + Age */}
                      <div className="flex items-center flex-wrap gap-2 mb-2">
                        {/* Normalized font size/weight */}
                        <h3 className="text-xl font-bold text-gray-900 font-mono tracking-tight leading-none">
                            {displayId}
                        </h3>
                        <div className="flex flex-col leading-none ml-1">
                             <span className="text-sm font-bold text-gray-700 truncate mb-0.5">
                                {cow.name}
                            </span>
                            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded w-fit">
                                {calculateAge(cow.birthDate)}
                            </span>
                        </div>
                        <div className="ml-auto">
                            {renderStatusDetail(cow)}
                        </div>
                      </div>
                      
                      {/* Middle Row: Pedigree */}
                      <div className="flex items-center gap-2 mb-3 w-fit max-w-full">
                          <Dna size={14} className="text-wagyu-600 flex-shrink-0" />
                          <div className="flex items-center gap-1.5 text-sm font-bold text-gray-600 truncate">
                              <span>{cow.fatherName || '-'}</span>
                              <span className="text-gray-300 font-light text-xs">|</span>
                              <span>{cow.motherFatherName || '-'}</span>
                          </div>
                      </div>

                      {/* Bottom Row: Dates (Large Font) */}
                      <div className="flex flex-wrap items-center gap-4">
                          {/* Expected Calving (If Pregnant) */}
                          {cow.expectedCalvingDate && (
                              <div className="flex flex-col">
                                  <span className="text-[10px] text-gray-400 font-bold uppercase">分娩予定</span>
                                  <span className="text-xl font-bold text-purple-700 leading-none">
                                      {formatDateJP(cow.expectedCalvingDate, 'short')}
                                  </span>
                              </div>
                          )}
                          
                          {/* Last Insemination (If Inseminated or Pregnant) */}
                          {cow.lastInseminationDate && (cow.status === BreedingStatus.INSEMINATED || cow.status === BreedingStatus.PREGNANT) && (
                              <div className="flex flex-col">
                                  <span className="text-[10px] text-gray-400 font-bold uppercase">最終種付</span>
                                  <span className="text-xl font-bold text-blue-700 leading-none">
                                      {formatDateJP(cow.lastInseminationDate, 'short')}
                                  </span>
                              </div>
                          )}

                           {/* Days Empty (If Empty) */}
                           {cow.status === BreedingStatus.EMPTY && cow.lastCalvingDate && (
                              <div className="flex flex-col">
                                  <span className="text-[10px] text-gray-400 font-bold uppercase">空胎日数</span>
                                  <span className="text-xl font-bold text-red-500 leading-none">
                                      {daysBetween(new Date(), parseDate(cow.lastCalvingDate))}日
                                  </span>
                              </div>
                          )}
                      </div>
                   </div>
                </div>
                <ChevronRight className="text-gray-300 flex-shrink-0 ml-2" size={24} />
              </div>
            );
        })}
      </div>
      
      {/* Add Cow Modal */}
      {showAddModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold flex items-center gap-2"><Plus size={20} /> 母牛の新規登録</h3>
                      <button onClick={() => setShowAddModal(false)}><X size={24} className="text-gray-400" /></button>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">個体識別番号 (10桁)</label>
                          <input
                            className="w-full p-2 border border-gray-300 rounded-lg font-mono text-lg"
                            placeholder="1234567890"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={newCow.earTag}
                            onChange={(e) => setNewCow({...newCow, earTag: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">名号 (名前)</label>
                          <input 
                            className="w-full p-2 border border-gray-300 rounded-lg" 
                            placeholder="はなこ"
                            value={newCow.name}
                            onChange={(e) => setNewCow({...newCow, name: e.target.value})}
                          />
                      </div>
                      <EraDateInput
                          label="生年月日"
                          value={newCow.birthDate}
                          onChange={(val) => setNewCow({...newCow, birthDate: val})}
                      />
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1">父牛</label>
                              <input
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="福之姫"
                                list="bull-candidates"
                                value={newCow.fatherName}
                                onChange={(e) => setNewCow({...newCow, fatherName: e.target.value})}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1">母の父</label>
                              <input
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="安福久"
                                list="bull-candidates"
                                value={newCow.motherFatherName}
                                onChange={(e) => setNewCow({...newCow, motherFatherName: e.target.value})}
                              />
                          </div>
                      </div>
                      <div className="mt-3">
                          <label className="block text-sm font-bold text-gray-700 mb-1">牛群(グループ/部屋)</label>
                          <select
                              className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                              value={newCow.groupId}
                              onChange={(e) => setNewCow({...newCow, groupId: e.target.value})}
                          >
                              <option value="">グループ未指定</option>
                              {(settings.groups || []).map(g => (
                                  <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                          </select>
                      </div>
                  </div>
                  
                  <button 
                    onClick={handleSaveNewCow}
                    className="w-full bg-wagyu-600 text-white font-bold py-3 rounded-xl shadow-lg mt-6"
                  >
                      登録する
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};
