
import React, { useState, useEffect } from 'react';
import { Cow, BreedingStatus, EventType, Calf, BreedingEvent, Note, Settings as SettingsType } from '../types';
import { ArrowLeft, Syringe, Baby, Activity, TrendingUp, History, Star, Pill, Plus, X, Trash2, Zap, Trophy, AlertTriangle, GitFork, Calendar, Pencil, Save, Dna, ShoppingBag, Stethoscope, Check, Minus, CheckCircle2, Circle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GESTATION_DAYS, COMMON_MEMO_TAGS } from '../constants';
import { addDays, formatDate, formatDateJP, daysBetween, parseDate, calculateAge } from '../utils/breedingService';

import { MemoLine } from './MemoLine';
import { EraDateInput } from './EraDateInput';

interface CowDetailProps {
  cow: Cow;
  allCows: Cow[]; // Needed for lineage
  calves: Calf[];
  settings: SettingsType;
  onBack: () => void;
  onAddEvent: (cowId: string, event: Partial<BreedingEvent>) => void;
  onDeleteEvent?: (cowId: string, eventId: string) => void; // Optional for safety
  bullList: string[];
  onUpdateBullList: (newList: string[]) => void;
  onDelete: (cowId: string) => void;
  onUpdate: (cow: Cow) => void;
  onAddCalf: (calf: Calf) => void;
  onUpdateCalf: (calf: Calf) => void;
  onDeleteCalf: (calfId: string) => void;
}

type TabId = 'ACTION' | 'STATS' | 'HISTORY' | 'MEMO';

export const CowDetail: React.FC<CowDetailProps> = ({ 
    cow, allCows, calves, settings, onBack, onAddEvent, onDeleteEvent, bullList, onUpdateBullList, 
    onDelete, onUpdate, onAddCalf, onUpdateCalf, onDeleteCalf 
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('ACTION');
  
  // Modals state
  const [showInseminationModal, setShowInseminationModal] = useState(false);
  const [showCalvingModal, setShowCalvingModal] = useState(false);
  const [showCidrModal, setShowCidrModal] = useState(false);
  const [showPgModal, setShowPgModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCalfModal, setShowCalfModal] = useState(false);
  const [showPregCheckModal, setShowPregCheckModal] = useState(false);
  
  // 0: Closed, 1: Confirm
  const [deleteStep, setDeleteStep] = useState(0); 

  // Form States
  const [editFormData, setEditFormData] = useState({
      name: cow.name,
      earTag: cow.earTag,
      birthDate: cow.birthDate,
      fatherName: cow.fatherName,
      motherFatherName: cow.motherFatherName,
      motherId: cow.motherId || '',
      groupId: cow.groupId || ''
  });

  const [selectedCalf, setSelectedCalf] = useState<Calf | null>(null);
  const [calfForm, setCalfForm] = useState<{
      earTag: string, birthDate: string, sex: 'MALE' | 'FEMALE', 
      price: string, weight: string, auctionDate: string, fatherName: string
  }>({
      earTag: '', birthDate: new Date().toISOString().split('T')[0], sex: 'MALE', 
      price: '', weight: '', auctionDate: '', fatherName: ''
  });

  const todayStr = new Date().toISOString().split('T')[0];
  
  const [insemDate, setInsemDate] = useState(todayStr);
  const [selectedBull, setSelectedBull] = useState(''); 
  const [isManagingBulls, setIsManagingBulls] = useState(false);

  const [calvingDate, setCalvingDate] = useState(todayStr);
  const [calfSex, setCalfSex] = useState<'MALE'|'FEMALE'>('MALE');
  const [calvingDifficulty, setCalvingDifficulty] = useState('正常');
  const [calvingBull, setCalvingBull] = useState(''); // Bull for the calf being born

  const [cidrDate, setCidrDate] = useState(todayStr);
  const [cidrRemovalDate, setCidrRemovalDate] = useState(formatDate(addDays(new Date(), 9))); 
  const [pgDate, setPgDate] = useState(todayStr);
  const [pregCheckDate, setPregCheckDate] = useState(todayStr);

  const mother = allCows.find(c => c.id === cow.motherId);
  const grandMother = mother ? allCows.find(c => c.id === mother.motherId) : null;

  // Handlers
  const handleAddBullToList = () => {
    if (selectedBull && !bullList.includes(selectedBull)) {
      onUpdateBullList([...bullList, selectedBull]);
    }
  };
  const handleDeleteBullFromList = (bull: string) => {
    onUpdateBullList(bullList.filter(b => b !== bull));
  };
  const handleInseminate = () => {
    if (!selectedBull) return;
    onAddEvent(cow.id, {
        type: EventType.INSEMINATION,
        date: insemDate,
        details: `種雄牛: ${selectedBull}`,
        relatedId: selectedBull
    });
    setShowInseminationModal(false);
    setSelectedBull('');
  };
  const handleCalving = () => {
      // ★安全版: eventsがFirebase由来のオブジェクト型でも動作する
      const finalBull = calvingBull || getLastBullName() || '';

      onAddEvent(cow.id, {
          type: EventType.CALVING,
          date: calvingDate,
          details: `産子: ${calfSex === 'MALE' ? 'オス' : 'メス'}, 状態: ${calvingDifficulty}${finalBull ? `, 父: ${finalBull}` : ''}`,
          metadata: { difficulty: calvingDifficulty, calfSex, fatherName: finalBull || undefined }
      });
      const newCalf: Calf = {
          id: Date.now().toString(),
          motherId: cow.id,
          birthDate: calvingDate,
          sex: calfSex,
          earTag: '',
          fatherName: finalBull || undefined
      };
      onAddCalf(newCalf);
      setShowCalvingModal(false);
  };
  const handleCidrInsert = () => {
      onAddEvent(cow.id, {
          type: EventType.CIDR_INSERTION,
          date: cidrDate,
          details: `トンボ挿入 (抜去予定: ${formatDateJP(cidrRemovalDate, 'short')})`,
          metadata: { plannedRemovalDate: cidrRemovalDate }
      });
      setShowCidrModal(false);
  };
  const handlePgInjection = () => {
      onAddEvent(cow.id, {
          type: EventType.PG_INJECTION,
          date: pgDate,
          details: `PG注射`,
      });
      setShowPgModal(false);
  };

  const handlePregCheck = (isPregnant: boolean) => {
      onAddEvent(cow.id, {
          type: EventType.PREG_CHECK,
          date: pregCheckDate,
          details: isPregnant ? '妊娠鑑定: プラス(+)' : '妊娠鑑定: マイナス(-)',
          metadata: { pregResult: isPregnant }
      });
      setShowPregCheckModal(false);
  };
  
  const handleDeleteEventClick = (eventId: string) => {
      if(window.confirm('この履歴を削除しますか？\n（誤って入力した場合などに使用してください）')) {
          if (onDeleteEvent) onDeleteEvent(cow.id, eventId);
      }
  };

  const handleEditSave = () => {
      onUpdate({
          ...cow,
          name: editFormData.name,
          earTag: editFormData.earTag,
          birthDate: editFormData.birthDate,
          fatherName: editFormData.fatherName,
          motherFatherName: editFormData.motherFatherName,
          motherId: editFormData.motherId || undefined,
          groupId: editFormData.groupId || undefined
      });
      setShowEditModal(false);
  };

  // Helper: Get the bull name from the most recent insemination event
  // Firebase由来のオブジェクト型eventsにも対応
  const getLastBullName = (): string => {
      let evts: any = cow.events;
      if (!evts) return '';
      if (!Array.isArray(evts) && typeof evts === 'object') evts = Object.values(evts);
      if (!Array.isArray(evts)) return '';
      const lastInsem = evts
          .filter((e: any) => e && e.type === EventType.INSEMINATION && e.relatedId)
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      return (lastInsem?.relatedId) || '';
  };

  const openCalfModal = (calf?: Calf) => {
      if (calf) {
          setSelectedCalf(calf);
          // Convert price: Stored as yen (850000), Display as thousand yen (850)
          const displayPrice = calf.price ? Math.round(calf.price / 1000).toString() : '';
          setCalfForm({
              earTag: calf.earTag || '', birthDate: calf.birthDate, sex: calf.sex, 
              price: displayPrice, weight: calf.weight ? calf.weight.toString() : '', 
              auctionDate: calf.auctionDate || '',
              fatherName: calf.fatherName || getLastBullName()
          });
      } else {
          setSelectedCalf(null);
          const autoBull = getLastBullName();
          setCalfForm({
              earTag: '', birthDate: todayStr, sex: 'MALE', 
              price: '', weight: '', auctionDate: '',
              fatherName: autoBull
          });
      }
      setShowCalfModal(true);
  };
  const handleSaveCalf = () => {
      // Convert price: Input as thousand yen (850), Store as yen (850000)
      const rawPrice = calfForm.price ? Number(calfForm.price) : undefined;
      const storedPrice = rawPrice ? rawPrice * 1000 : undefined;

      const calfData: Calf = {
          id: selectedCalf ? selectedCalf.id : Date.now().toString(),
          motherId: cow.id,
          earTag: calfForm.earTag,
          birthDate: calfForm.birthDate,
          sex: calfForm.sex,
          price: storedPrice,
          weight: calfForm.weight ? Number(calfForm.weight) : undefined,
          auctionDate: calfForm.auctionDate || undefined,
          fatherName: calfForm.fatherName || undefined
      };
      if (selectedCalf) onUpdateCalf(calfData);
      else onAddCalf(calfData);
      setShowCalfModal(false);
  };
  const handleDeleteCalfWrapper = () => {
      if(selectedCalf && window.confirm('この子牛データを削除しますか？')) {
          onDeleteCalf(selectedCalf.id);
          setShowCalfModal(false);
      }
  };
  
  // Logic to guess bull for calving
  useEffect(() => {
      if (showCalvingModal) {
          // ★安全版: 種付履歴の最新種雄牛を自動セット（オブジェクト型events対応）
          setCalvingBull(getLastBullName());
      }
  }, [showCalvingModal, cow.events]);

  const getStatusColor = (status: BreedingStatus) => {
    // Custom color from settings
    const customBg = settings?.statusColors?.[status];
    if (customBg) {
        let textColor = "text-gray-900"; // default dark text for custom bgs
        let borderColor = customBg === 'bg-white' ? 'border-gray-200' : `${customBg.replace('bg-', 'border-').replace('50', '300').replace('100', '400').replace('200', '500')}`;
        return `${customBg} ${textColor} ${borderColor}`;
    }

    // Default Fallbacks
    switch (status) {
      case BreedingStatus.EMPTY: return 'text-red-600 bg-red-50 border-red-200';
      case BreedingStatus.PREGNANT: return 'text-green-600 bg-green-50 border-green-200';
      case BreedingStatus.CALVING_SOON: return 'text-purple-600 bg-purple-50 border-purple-200';
      case BreedingStatus.INSEMINATED: return 'text-blue-600 bg-blue-50 border-blue-200';
      case BreedingStatus.RECOVERY: return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusText = (status: BreedingStatus) => {
      switch (status) {
          case BreedingStatus.EMPTY: return '空胎 (要種付)';
          case BreedingStatus.PREGNANT: return '妊娠確定 (本鑑定済)';
          case BreedingStatus.CALVING_SOON: return '分娩間近';
          case BreedingStatus.INSEMINATED: return '種付済 (鑑定待ち±)';
          case BreedingStatus.RECOVERY: return '分娩後休養';
          default: return '---';
      }
  };

  const tabs: { id: TabId; icon: LucideIcon; label: string }[] = [
    { id: 'ACTION', icon: Activity, label: '管理' },
    { id: 'STATS', icon: TrendingUp, label: '成績・血統' },
    { id: 'HISTORY', icon: History, label: '履歴・メモ' },
  ];

  const ActionTab = () => (
    <div className="space-y-4 p-4">
      <div className={`p-4 rounded-xl border-2 flex items-center justify-between ${getStatusColor(cow.status)}`}>
        <div>
            <div className="text-xs font-bold uppercase opacity-70">現在の状態</div>
            <div className="text-xl font-bold">
                {getStatusText(cow.status)}
            </div>
        </div>
        <Activity size={32} className="opacity-50" />
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200 p-3 text-sm shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-wagyu-600" />
                  <span className="text-gray-500">生年月日・年齢</span>
              </div>
              <div className="text-right">
                  <span className="font-bold text-gray-800 mr-2">{formatDateJP(cow.birthDate)}</span>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{calculateAge(cow.birthDate)}</span>
              </div>
          </div>
          <div className="flex items-start gap-2">
              <Dna size={16} className="text-wagyu-600 mt-1" />
              <div className="flex-1 grid grid-cols-2 gap-4">
                  <div>
                      <span className="text-[10px] text-gray-400 block mb-0.5">父</span>
                      <span className="font-bold text-gray-800 block text-base">{cow.fatherName || '---'}</span>
                  </div>
                   <div>
                      <span className="text-[10px] text-gray-400 block mb-0.5">母の父</span>
                      <span className="font-bold text-gray-800 block text-base">{cow.motherFatherName || '---'}</span>
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button 
            onClick={() => { setInsemDate(todayStr); setShowInseminationModal(true); }}
            className="flex flex-col items-center justify-center p-3 bg-blue-600 text-white rounded-xl shadow-lg active:bg-blue-700 transition-colors"
        >
            <Syringe size={24} className="mb-1" />
            <span className="font-bold text-sm">種付け</span>
        </button>
        <button 
            onClick={() => { setPregCheckDate(todayStr); setShowPregCheckModal(true); }}
            className="flex flex-col items-center justify-center p-3 bg-teal-500 text-white rounded-xl shadow-lg active:bg-teal-600 transition-colors"
        >
            <Stethoscope size={24} className="mb-1" />
            <span className="font-bold text-sm">妊娠鑑定</span>
        </button>
        <button 
            onClick={() => { 
                setCalvingDate(todayStr); 
                setCalvingBull(getLastBullName()); // ★安全版: 種付履歴から自動セット
                setShowCalvingModal(true); 
            }}
            className="flex flex-col items-center justify-center p-3 bg-pink-500 text-white rounded-xl shadow-lg active:bg-pink-600 transition-colors"
        >
            <Baby size={24} className="mb-1" />
            <span className="font-bold text-sm">分娩</span>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button 
            onClick={() => { setCidrDate(todayStr); setCidrRemovalDate(formatDate(addDays(new Date(), 14))); setShowCidrModal(true); }}
            className="flex flex-col items-center justify-center p-3 bg-purple-500 text-white rounded-xl shadow-lg active:bg-purple-600 transition-colors"
        >
            <Pill size={24} className="mb-1" />
            <span className="font-bold text-sm">トンボ (CIDR)</span>
        </button>
        <button 
            onClick={() => { setPgDate(todayStr); setShowPgModal(true); }}
            className="flex flex-col items-center justify-center p-3 bg-orange-500 text-white rounded-xl shadow-lg active:bg-orange-600 transition-colors"
        >
            <Zap size={24} className="mb-1" />
            <span className="font-bold text-sm">PG注射</span>
        </button>
      </div>
      
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-2">
          <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">最終分娩日</span>
              <span className="font-medium">{formatDateJP(cow.lastCalvingDate || '')}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">最終種付日</span>
              <span className="font-medium text-lg">{formatDateJP(cow.lastInseminationDate || '')}</span>
          </div>
          <div className="flex justify-between py-2">
              <span className="text-gray-500">分娩予定日</span>
              <span className="font-bold text-wagyu-700 text-lg">{formatDateJP(cow.expectedCalvingDate || '')}</span>
          </div>
      </div>
    </div>
  );

  const StatsTab = () => {
     const avgPrice = calves.length 
        ? Math.round(calves.reduce((sum, c) => sum + (c.price || 0), 0) / calves.length)
        : 0;

    return (
        <div className="p-4 space-y-4">
             <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-gray-700 flex items-center gap-2"><ShoppingBag size={18} /> 子牛販売履歴</h3>
                     <button onClick={() => openCalfModal()} className="text-xs bg-wagyu-100 text-wagyu-700 px-2 py-1 rounded flex items-center gap-1"><Plus size={12}/> 登録</button>
                 </div>
                 {calves.length === 0 ? (
                     <div className="text-center text-gray-400 py-4 text-sm">データがありません</div>
                 ) : (
                     <div className="space-y-3">
                         {calves.map(calf => (
                             <div key={calf.id} onClick={() => openCalfModal(calf)} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100 active:bg-gray-100">
                                 <div>
                                     <div className="font-bold text-gray-800">{formatDateJP(calf.auctionDate || calf.birthDate, 'short')}</div>
                                     <div className="text-xs text-gray-500">{calf.sex === 'MALE' ? '去勢' : 'メス'}</div>
                                 </div>
                                 <div className="text-right">
                                     <div className="font-bold text-wagyu-700">¥{(calf.price || 0).toLocaleString()}</div>
                                     <div className="text-xs text-gray-400">{calf.weight ? `${calf.weight}kg` : '-'}</div>
                                 </div>
                             </div>
                         ))}
                         <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-bold">
                             <span>平均価格</span>
                             <span>¥{avgPrice.toLocaleString()}</span>
                         </div>
                     </div>
                 )}
             </div>
        </div>
    );
  };

  const HistoryTab = () => {
       const combinedTimeline = [
          ...(cow.events || []).map(e => ({ type: 'event' as const, data: e, date: new Date(e.date).getTime(), id: e.id })),
          ...(cow.notes || []).map(n => ({ type: 'note' as const, data: n, date: new Date(n.date).getTime(), id: n.id }))
       ].sort((a, b) => b.date - a.date);

       return (
          <div className="p-4 flex flex-col gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <h3 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2"><Pencil size={16}/> メモ・ToDoを追加</h3>
                  <MemoLine 
                      notes={[]} // Only use it for input
                      onAddNote={(note) => {
                          const newNoteList = [...(cow.notes || []), { ...note, id: Date.now().toString() }];
                          onUpdate({ ...cow, notes: newNoteList });
                      }}
                      onDeleteNote={() => {}} // Notes deleted from timeline
                      hideNotesList={true}
                      quickTags={COMMON_MEMO_TAGS}
                  />
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <h3 className="font-bold text-gray-800 mb-4 text-sm flex items-center gap-2"><History size={16}/> 履歴・メモ</h3>
                  <div className="relative border-l-2 border-gray-200 ml-3 space-y-6 mt-4">
                      {combinedTimeline.map(({ type, data, id }, idx) => {
                          if (type === 'event') {
                              const event = data as BreedingEvent;
                              let Icon = Activity;
                              let iconColor = 'text-gray-500';
                              let bgColor = 'bg-white';
                              let borderColor = 'border-gray-300';
                              
                              if (event.type === EventType.INSEMINATION) { Icon = Syringe; iconColor = 'text-blue-500'; borderColor = 'border-blue-300'; }
                              else if (event.type === EventType.CALVING) { Icon = Baby; iconColor = 'text-pink-500'; borderColor = 'border-pink-300'; }
                              else if (event.type === EventType.PREG_CHECK) { Icon = Stethoscope; iconColor = 'text-teal-500'; bgColor = 'bg-teal-50'; borderColor = 'border-teal-500'; }
                              else if (event.type === EventType.CIDR_INSERTION || event.type === EventType.CIDR_REMOVAL) { Icon = Pill; iconColor = 'text-purple-500'; borderColor = 'border-purple-300'; }
                              else if (event.type === EventType.PG_INJECTION) { Icon = Zap; iconColor = 'text-yellow-500'; borderColor = 'border-yellow-300'; }

                              return (
                                  <div key={id} className="mb-6 ml-6 relative group">
                                      <span className={`absolute -left-[35px] top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${bgColor} ${borderColor} ${iconColor}`}>
                                          <Icon size={12} />
                                      </span>
                                      <div className="flex justify-between items-start">
                                          <div>
                                              <div className="text-sm text-gray-500 mb-1">{formatDateJP(event.date)}</div>
                                              <div className="font-bold text-gray-800">
                                                  {event.type === EventType.INSEMINATION ? '人工授精' : 
                                                   event.type === EventType.PREG_CHECK ? '妊娠鑑定' :
                                                   event.type === EventType.CIDR_INSERTION ? 'トンボ挿入' :
                                                   event.type === EventType.CIDR_REMOVAL ? 'トンボ除去' :
                                                   event.type === EventType.PG_INJECTION ? 'PG注射' :
                                                   event.type === EventType.CALVING ? '分娩' : event.type}
                                              </div>
                                          </div>
                                          <button 
                                            onClick={() => handleDeleteEventClick(event.id)}
                                            className="text-gray-300 hover:text-red-500 p-1"
                                          >
                                              <Trash2 size={16} />
                                          </button>
                                      </div>
                                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded mt-1">
                                          {event.details}
                                      </div>
                                  </div>
                              );
                          } else {
                              const note = data as Note;
                              return (
                                  <div key={id} className="mb-6 ml-6 relative group">
                                      <span className={`absolute -left-[35px] top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white border-gray-300`}>
                                          <Pencil size={12} className="text-gray-400" />
                                      </span>
                                      <div className="flex justify-between items-start">
                                          <div>
                                              <div className="text-sm text-gray-500 mb-1">{formatDateJP(note.date.split('T')[0])} <span className="text-[10px] text-gray-400 ml-1">{new Date(note.date).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span></div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                              <button 
                                                onClick={() => {
                                                    if(window.confirm('削除しますか？')){
                                                        const newNoteList = (cow.notes || []).filter(n => n.id !== note.id);
                                                        onUpdate({ ...cow, notes: newNoteList });
                                                    }
                                                }}
                                                className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                              >
                                                  <Trash2 size={14} />
                                              </button>
                                          </div>
                                      </div>
                                      <div className="flex items-start gap-2 mt-1">
                                          {note.isTodo && (
                                              <button 
                                                  onClick={() => {
                                                      const updatedNote = { ...note, isDone: !note.isDone };
                                                      const newNoteList = (cow.notes || []).map(n => n.id === note.id ? updatedNote : n);
                                                      onUpdate({ ...cow, notes: newNoteList });
                                                  }}
                                                  className="mt-0.5 flex-shrink-0"
                                              >
                                                  {note.isDone ? (
                                                      <CheckCircle2 size={18} className="text-green-500" />
                                                  ) : (
                                                      <Circle size={18} className="text-gray-300 hover:text-gray-400" />
                                                  )}
                                              </button>
                                          )}
                                          <div className={`flex-1 break-words text-sm ${note.isTodo ? (note.isDone ? 'text-gray-400 line-through' : 'font-medium text-gray-900') : 'text-gray-800'}`}>
                                              <div className="whitespace-pre-wrap">{note.text}</div>
                                          </div>
                                      </div>
                                  </div>
                              );
                          }
                      })}
                  </div>
              </div>
          </div>
       );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white px-4 py-3 shadow-sm flex items-center justify-between gap-4 z-10 sticky top-0">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 -ml-2 text-gray-600 active:bg-gray-100 rounded-full"><ArrowLeft size={24} /></button>
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                    {cow.name}
                    {cow.isRemoved && <span className="text-xs bg-gray-500 text-white px-2 py-0.5 rounded-full font-normal">抹消済</span>}
                </h1>
                <div className="font-mono flex items-baseline">
                    <span className="text-xs text-gray-400 mr-1 self-center">ID:</span>
                    <span className="text-gray-900 text-lg font-bold">{cow.earTag.slice(-5)}</span>
                </div>
            </div>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => { 
                    setEditFormData({
                        name: cow.name,
                        earTag: cow.earTag,
                        birthDate: cow.birthDate,
                        fatherName: cow.fatherName,
                        motherFatherName: cow.motherFatherName,
                        motherId: cow.motherId || '',
                        groupId: cow.groupId || ''
                    });
                    setShowEditModal(true); 
                }} 
                className="p-2 text-gray-400 hover:text-wagyu-600 hover:bg-wagyu-50 rounded-full"
            >
                <Pencil size={20} />
            </button>
            <button 
                onClick={() => setDeleteStep(cow.isRemoved ? 2 : 1)} 
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full"
            >
                <Trash2 size={20} />
            </button>
        </div>
      </div>

      <div className="flex bg-white border-b border-gray-200">
        {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === tab.id ? 'border-wagyu-500 text-wagyu-700' : 'border-transparent text-gray-400'}`}>
                <tab.icon size={16} />{tab.label}
            </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
          {activeTab === 'ACTION' && <ActionTab />}
          {activeTab === 'STATS' && <StatsTab />}
          {activeTab === 'HISTORY' && <HistoryTab />}
      </div>

      {/* Pregnancy Check Modal */}
      {showPregCheckModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center animate-fade-in p-4">
              <div className="bg-white w-full sm:w-96 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="p-6 overflow-y-auto flex-1">
                      <h3 className="text-lg font-bold mb-4 text-teal-600 flex items-center gap-2">
                          <Stethoscope /> 妊娠鑑定
                      </h3>
                      
                      <label className="block text-sm font-medium text-gray-700 mb-2">鑑定日</label>
                      <input 
                        type="date"
                        value={pregCheckDate}
                        onChange={(e) => setPregCheckDate(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg mb-4"
                      />

                      <div className="grid grid-cols-2 gap-4">
                          <button 
                             onClick={() => handlePregCheck(true)}
                             className="flex flex-col items-center justify-center p-6 bg-green-50 border-2 border-green-500 rounded-xl active:bg-green-100"
                          >
                              <Check size={40} className="text-green-600 mb-2" />
                              <span className="font-bold text-green-800 text-lg">プラス (+)</span>
                              <span className="text-xs text-green-600">妊娠確定</span>
                          </button>
                          <button 
                             onClick={() => handlePregCheck(false)}
                             className="flex flex-col items-center justify-center p-6 bg-gray-50 border-2 border-gray-400 rounded-xl active:bg-gray-100"
                          >
                              <Minus size={40} className="text-gray-600 mb-2" />
                              <span className="font-bold text-gray-800 text-lg">マイナス (-)</span>
                              <span className="text-xs text-gray-600">空胎</span>
                          </button>
                      </div>
                  </div>
                  <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                       <button 
                        onClick={() => setShowPregCheckModal(false)}
                        className="w-full bg-gray-200 text-gray-600 font-bold py-3 rounded-xl"
                      >
                          キャンセル
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Insemination Modal - Fixed Footer */}
      {showInseminationModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center animate-fade-in p-4">
              <div className="bg-white w-full sm:w-96 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="p-6 overflow-y-auto flex-1">
                      <h3 className="text-lg font-bold mb-4">種付け記録</h3>
                      <label className="block text-sm font-medium text-gray-700 mb-2">日付</label>
                      <input type="date" value={insemDate} onChange={(e) => setInsemDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg mb-2" />
                      <label className="block text-sm font-medium text-gray-700 mb-2">種雄牛</label>
                      <div className="flex gap-2 mb-2">
                        <input type="text" placeholder="種雄牛名" list="bull-candidates" value={selectedBull} onChange={(e) => setSelectedBull(e.target.value)} className="flex-1 p-2 border border-gray-300 rounded-lg"/>
                         {/* Ensure add button is visible */}
                         <button onClick={handleAddBullToList} disabled={!selectedBull} className="p-2 rounded-lg border text-wagyu-600 border-wagyu-500 bg-wagyu-50 active:bg-wagyu-100"><Plus size={20} /></button>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-2">
                          {bullList.map(bull => (
                              <div key={bull} className="relative group inline-block">
                                <button 
                                  onClick={() => setSelectedBull(bull)} 
                                  className={`pl-3 pr-8 py-2 rounded-full border text-sm transition-colors ${selectedBull === bull ? 'bg-wagyu-500 text-white border-wagyu-500' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                                >
                                  {bull}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteBullFromList(bull); }}
                                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full ${selectedBull === bull ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-gray-400 hover:text-red-500 hover:bg-gray-200'} transition-colors`}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                          ))}
                      </div>
                  </div>
                  <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex flex-col gap-2">
                      <button 
                        onClick={handleInseminate} 
                        disabled={!selectedBull} 
                        className={`w-full font-bold py-3 rounded-xl text-white transition-colors ${!selectedBull ? 'bg-gray-300' : 'bg-wagyu-500 shadow-md'}`}
                      >
                        記録する
                      </button>
                      <button onClick={() => setShowInseminationModal(false)} className="w-full bg-gray-200 text-gray-600 font-bold py-3 rounded-xl">キャンセル</button>
                  </div>
              </div>
          </div>
      )}

       {/* Calving Modal */}
       {showCalvingModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center animate-fade-in p-4">
              <div className="bg-white w-full sm:w-96 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="p-6 overflow-y-auto flex-1">
                      <h3 className="text-lg font-bold mb-4 text-pink-600">分娩記録</h3>
                      <input type="date" value={calvingDate} onChange={(e) => setCalvingDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg mb-4" />
                       <div className="flex gap-3 mb-4">
                          <button onClick={() => setCalfSex('MALE')} className={`flex-1 py-2 rounded-lg border ${calfSex === 'MALE' ? 'bg-blue-100 border-blue-500 text-blue-700 font-bold' : 'text-gray-600'}`}>オス</button>
                          <button onClick={() => setCalfSex('FEMALE')} className={`flex-1 py-2 rounded-lg border ${calfSex === 'FEMALE' ? 'bg-pink-100 border-pink-500 text-pink-700 font-bold' : 'text-gray-600'}`}>メス</button>
                      </div>
                      
                      <div className="mb-4">
                          <label className="block text-sm font-bold text-gray-700 mb-1">種雄牛 (父) ※自動取得</label>
                          {/* Show all insemination events as radio-style options */}
                          {(() => {
                              const insemEvents = [...(cow.events || [])]
                                  .filter(e => e.type === EventType.INSEMINATION && e.relatedId)
                                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                  .slice(0, 4); // Show up to 4 most recent
                              return insemEvents.length > 0 ? (
                                  <div className="space-y-2 mb-2">
                                      {insemEvents.map((ev, i) => (
                                          <button
                                              key={ev.id}
                                              type="button"
                                              onClick={() => setCalvingBull(ev.relatedId!)}
                                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all ${
                                                  calvingBull === ev.relatedId
                                                      ? 'bg-blue-50 border-blue-400 text-blue-800 font-bold'
                                                      : 'bg-white border-gray-200 text-gray-600'
                                              }`}
                                          >
                                              <span className="font-bold">{ev.relatedId}</span>
                                              <span className="text-[10px] text-gray-400">
                                                  {i === 0 ? '🔵 最新の種付' : `種付日: ${formatDateJP(ev.date, 'short')}`}
                                              </span>
                                          </button>
                                      ))}
                                  </div>
                              ) : null;
                          })()}
                          <input 
                            type="text" 
                            placeholder="上のボタンで選択、または直接入力"
                            value={calvingBull} 
                            onChange={(e) => setCalvingBull(e.target.value)} 
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                          />
                          {calvingBull && (
                              <div className="mt-1 px-2 py-1 bg-wagyu-50 border border-wagyu-200 rounded text-xs text-wagyu-700 font-bold">
                                  ✅ 父牛: {calvingBull} として子牛に登録されます
                              </div>
                          )}
                      </div>

                      <label className="block text-sm font-medium text-gray-700 mb-1">分娩の状態</label>
                      <select value={calvingDifficulty} onChange={(e) => setCalvingDifficulty(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg mb-4">
                          <option value="正常">正常分娩 (安産)</option>
                          <option value="介助">介助 (軽い牽引)</option>
                          <option value="難産">難産 (獣医対応等)</option>
                          <option value="死産">死産</option>
                      </select>
                  </div>
                  <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex flex-col gap-2">
                      <button onClick={handleCalving} className="w-full bg-pink-600 text-white font-bold py-3 rounded-xl shadow-md">記録する</button>
                      <button onClick={() => setShowCalvingModal(false)} className="w-full bg-gray-200 text-gray-600 font-bold py-3 rounded-xl">キャンセル</button>
                  </div>
              </div>
          </div>
      )}

      {/* CIDR Modal */}
      {showCidrModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center animate-fade-in p-4">
              <div className="bg-white w-full sm:w-96 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="p-6 overflow-y-auto flex-1">
                      <h3 className="text-lg font-bold mb-4 text-purple-600">CIDR(トンボ)挿入</h3>
                      <label className="block text-sm font-medium text-gray-700 mb-1">挿入日</label>
                      <input type="date" value={cidrDate} onChange={(e) => setCidrDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg mb-4" />
                      <label className="block text-sm font-medium text-gray-700 mb-1">抜去予定日 (14日後など)</label>
                      <input type="date" value={cidrRemovalDate} onChange={(e) => setCidrRemovalDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg mb-6 bg-purple-50" />
                  </div>
                   <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex flex-col gap-2">
                      <button onClick={handleCidrInsert} className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl shadow-md">記録する</button>
                      <button onClick={() => setShowCidrModal(false)} className="w-full bg-gray-200 text-gray-600 font-bold py-3 rounded-xl">キャンセル</button>
                  </div>
              </div>
          </div>
      )}

      {/* PG Modal */}
      {showPgModal && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center animate-fade-in p-4">
              <div className="bg-white w-full sm:w-96 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="p-6 overflow-y-auto flex-1">
                      <h3 className="text-lg font-bold mb-4 text-orange-600">PG注射</h3>
                      <label className="block text-sm font-medium text-gray-700 mb-1">注射日</label>
                      <input type="date" value={pgDate} onChange={(e) => setPgDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg mb-6" />
                  </div>
                  <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex flex-col gap-2">
                      <button onClick={handlePgInjection} className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl shadow-md">記録する</button>
                      <button onClick={() => setShowPgModal(false)} className="w-full bg-gray-200 text-gray-600 font-bold py-3 rounded-xl">キャンセル</button>
                  </div>
              </div>
          </div>
      )}

      {/* Edit Cow Modal */}
      {showEditModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-bold mb-4">母牛情報の編集</h3>
                  <div className="space-y-3 mb-6">
                      <input className="w-full p-2 border rounded-lg" placeholder="耳標番号" inputMode="numeric" pattern="[0-9]*" value={editFormData.earTag} onChange={e => setEditFormData({...editFormData, earTag: e.target.value})} />
                      <input className="w-full p-2 border rounded-lg" placeholder="名号" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} />
                      <EraDateInput value={editFormData.birthDate} onChange={val => setEditFormData({...editFormData, birthDate: val})} />
                      <input className="w-full p-2 border rounded-lg" placeholder="父牛" list="bull-candidates" value={editFormData.fatherName} onChange={e => setEditFormData({...editFormData, fatherName: e.target.value})} />
                      <input className="w-full p-2 border rounded-lg" placeholder="母の父" list="bull-candidates" value={editFormData.motherFatherName} onChange={e => setEditFormData({...editFormData, motherFatherName: e.target.value})} />
                      <select 
                          className="w-full p-2 border rounded-lg text-gray-700" 
                          value={editFormData.groupId} 
                          onChange={e => setEditFormData({...editFormData, groupId: e.target.value})}
                      >
                          <option value="">グループ未指定</option>
                          {(settings?.groups || []).map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                      </select>
                  </div>
                  <button onClick={handleEditSave} className="w-full bg-wagyu-600 text-white font-bold py-3 rounded-xl mb-2">保存する</button>
                  <button onClick={() => setShowEditModal(false)} className="w-full bg-gray-100 text-gray-600 font-bold py-3 rounded-xl">キャンセル</button>
              </div>
          </div>
      )}

      {/* Calf Modal */}
      {showCalfModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold">{selectedCalf ? '子牛情報の編集' : '子牛の登録'}</h3>
                      {selectedCalf && <button onClick={handleDeleteCalfWrapper} className="text-red-500 text-sm"><Trash2 size={18}/></button>}
                  </div>
                  
                  <div className="space-y-3 mb-6">
                      <div>
                          <label className="text-xs text-gray-500">個体識別番号(任意)</label>
                          <input className="w-full p-2 border rounded-lg" placeholder="1234567890" inputMode="numeric" pattern="[0-9]*" value={calfForm.earTag} onChange={e => setCalfForm({...calfForm, earTag: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-500">生年月日</label>
                            <input type="date" className="w-full p-2 border rounded-lg" value={calfForm.birthDate} onChange={e => setCalfForm({...calfForm, birthDate: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">性別</label>
                            <select className="w-full p-2 border rounded-lg" value={calfForm.sex} onChange={e => setCalfForm({...calfForm, sex: e.target.value as 'MALE' | 'FEMALE'})}>
                                <option value="MALE">オス/去勢</option>
                                <option value="FEMALE">メス</option>
                            </select>
                          </div>
                      </div>
                      <div>
                          <label className="text-xs text-gray-500 font-bold">父牛 (種雄牛)</label>
                          <input
                              className={`w-full p-2 border rounded-lg mt-1 ${calfForm.fatherName ? 'border-wagyu-300 bg-wagyu-50' : 'border-gray-300'}`}
                              placeholder="例: 福之姫"
                              list="bull-candidates"
                              value={calfForm.fatherName}
                              onChange={e => setCalfForm({...calfForm, fatherName: e.target.value})}
                          />
                          {calfForm.fatherName && !selectedCalf && (
                              <p className="text-[10px] text-wagyu-600 font-bold mt-0.5">
                                  ✅ 種付履歴より自動入力: {calfForm.fatherName}
                              </p>
                          )}
                          {!calfForm.fatherName && (
                              <p className="text-[10px] text-orange-500 mt-0.5">
                                  ⚠️ 種付記録が見つかりません。直接入力してください。
                              </p>
                          )}
                      </div>

                      <div className="border-t border-gray-100 pt-2 mt-2">
                          <label className="text-xs text-gray-500 font-bold mb-1 block">出荷・販売実績 (未定なら空欄)</label>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                              <div>
                                  <label className="text-[10px] text-gray-400">出荷日</label>
                                  <input className="w-full p-2 border rounded-lg" type="date" value={calfForm.auctionDate} onChange={e => setCalfForm({...calfForm, auctionDate: e.target.value})} />
                              </div>
                              <div className="flex items-center pt-5 text-xs text-gray-500">
                                  {calfForm.auctionDate && calfForm.birthDate ? (
                                      <span>日齢: {daysBetween(parseDate(calfForm.auctionDate), parseDate(calfForm.birthDate))}日</span>
                                  ) : <span>日齢: -</span>}
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-gray-400">販売額 (千円)</label>
                                <div className="relative">
                                    <input type="number" className="w-full p-2 pl-2 pr-8 border rounded-lg" placeholder="800" value={calfForm.price} onChange={e => setCalfForm({...calfForm, price: e.target.value})} />
                                    <span className="absolute right-2 top-2 text-gray-400 text-xs mt-0.5">千円</span>
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-400">体重 (kg)</label>
                                <div className="relative">
                                    <input type="number" className="w-full p-2 pr-6 border rounded-lg" placeholder="300" value={calfForm.weight} onChange={e => setCalfForm({...calfForm, weight: e.target.value})} />
                                    <span className="absolute right-2 top-2 text-gray-400 text-xs mt-0.5">kg</span>
                                </div>
                              </div>
                          </div>
                      </div>
                  </div>
                  <button onClick={handleSaveCalf} className="w-full bg-wagyu-600 text-white font-bold py-3 rounded-xl mb-2">保存する</button>
                  <button onClick={() => setShowCalfModal(false)} className="w-full bg-gray-100 text-gray-600 font-bold py-3 rounded-xl">キャンセル</button>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteStep === 1 && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center">
                  <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Trash2 size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">牛を抹消しますか？</h3>
                  <p className="text-gray-500 mb-6 text-sm">
                      「{cow.name} ({cow.earTag})」を抹消牛リストに移動します。<br/>
                      通常の牛一覧からは非表示になります。
                  </p>
                  <div className="flex gap-3">
                      <button 
                        onClick={() => setDeleteStep(0)}
                        className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                      >
                          キャンセル
                      </button>
                      <button 
                        onClick={() => {
                            onUpdate({ ...cow, isRemoved: true });
                            onBack(); // 抹消後は一覧に戻る
                        }}
                        className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 shadow-lg transition-colors"
                      >
                          抹消する
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Hard Delete Confirmation Modal */}
      {deleteStep === 2 && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center">
                  <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Trash2 size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">完全に削除しますか？</h3>
                  <p className="text-gray-500 mb-6 text-sm">
                      「{cow.name} ({cow.earTag})」のデータが完全に削除されます。<br/>
                      この操作は取り消せません。
                  </p>
                  <div className="flex gap-3 flex-col">
                      <div className="flex gap-3">
                          <button 
                            onClick={() => setDeleteStep(0)}
                            className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                          >
                              キャンセル
                          </button>
                          <button 
                            onClick={() => {
                                onDelete(cow.id);
                            }}
                            className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 shadow-lg transition-colors"
                          >
                              完全に削除する
                          </button>
                      </div>
                      <button 
                        onClick={() => {
                            onUpdate({ ...cow, isRemoved: false });
                            setDeleteStep(0);
                        }}
                        className="w-full bg-blue-50 text-blue-600 font-bold py-3 rounded-xl hover:bg-blue-100 transition-colors mt-2"
                      >
                          抹消を取り消す (復元)
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
