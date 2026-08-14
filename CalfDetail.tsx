import React, { useState, useEffect } from 'react';
import { Calf, Cow, BreedingEvent } from '../types';
import { ArrowLeft, Edit, Save, Trash2 } from 'lucide-react';
import { calculateAge, formatDateJP } from '../utils/breedingService';
import { COMMON_MEMO_TAGS } from '../constants';
import { EraDateInput } from './EraDateInput';
import { MemoLine } from './MemoLine';

interface CalfDetailProps {
    calf: Calf;
    allCows: Cow[]; // Needed for parent selection?
    onBack: () => void;
    onUpdate: (calf: Calf) => void;
    onDelete: (calfId: string) => void;
    onMotherClick?: (motherId: string) => void;
}

// 安全にイベント配列を取得（Firebase由来のオブジェクト型にも対応）
const safeEvents = (cow: Cow | undefined): BreedingEvent[] => {
    if (!cow || !cow.events) return [];
    if (Array.isArray(cow.events)) return cow.events;
    if (typeof cow.events === 'object') return Object.values(cow.events);
    return [];
};

// 母牛の種付履歴から父牛（種雄牛）を取得
// 一番最後（最新）の種付けの種雄牛を返す
export const getBullFromMother = (mother: Cow | undefined): string => {
    const events = safeEvents(mother);
    const inseminations = events
        .filter(ev => ev && ev.type === 'INSEMINATION' && ev.relatedId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return inseminations.length > 0 ? (inseminations[0].relatedId || '') : '';
};

export const CalfDetail: React.FC<CalfDetailProps> = ({ calf, allCows, onBack, onUpdate, onDelete, onMotherClick }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Calf>(calf);
    const [activeTab, setActiveTab] = useState<'INFO' | 'MEMO'>('INFO');
    const [deleteStep, setDeleteStep] = useState(0);
    const [autoFilled, setAutoFilled] = useState(false);

    // ★編集モードに入った瞬間、母牛が設定済みで父牛が空なら自動補完
    useEffect(() => {
        if (isEditing && editForm.motherId && !editForm.fatherName) {
            const motherCow = allCows.find(c => c.id === editForm.motherId);
            const bull = getBullFromMother(motherCow);
            if (bull) {
                setEditForm(prev => ({ ...prev, fatherName: bull }));
                setAutoFilled(true);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing]);

    const handleSave = () => {
        onUpdate(editForm);
        setIsEditing(false);
        setAutoFilled(false);
    };

    const handleArchive = () => {
        onUpdate({ ...calf, isRemoved: true });
        onBack();
    };

    const displayPrice = editForm.price ? Math.round(editForm.price / 1000).toString() : '';
    const mother = calf.motherId ? allCows.find(c => c.id === calf.motherId) : null;

    return (
        <div className="flex flex-col h-full bg-gray-50 pb-20 overflow-y-auto">
            {/* Header */}
            <header className="bg-wagyu-600 text-white p-4 sticky top-0 z-20 shadow-md flex items-center justify-between">
                <button onClick={onBack} className="p-2 -ml-2 active:bg-white/10 rounded-full transition-colors"><ArrowLeft size={24} /></button>
                <div className="font-bold flex-1 text-center truncate px-2">
                    {calf.name || '名前未設定'}
                </div>
                {!isEditing ? (
                    <button onClick={() => setIsEditing(true)} className="p-2 -mr-2 bg-white/20 rounded-full active:bg-white/30"><Edit size={18} /></button>
                ) : (
                    <button onClick={handleSave} className="p-2 -mr-2 bg-green-500 rounded-full active:bg-green-600 shadow-sm"><Save size={18} /></button>
                )}
            </header>

            {/* Quick Info */}
            <div className="bg-white p-5 shadow-sm mb-2">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex gap-2 items-baseline">
                        <span className="text-sm text-gray-500 font-mono">ID:</span>
                        <span className="text-3xl font-black text-gray-900 font-mono">{calf.earTag ? calf.earTag.slice(-5) : 'なし'}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded font-bold ${calf.sex === 'MALE' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                        {calf.sex === 'MALE' ? 'オス/去勢' : 'メス'}
                    </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                    <div>
                        <div className="text-2xl font-black text-gray-800 flex items-center gap-2">
                            {calf.name || '名前未設定'}
                            {calf.isRemoved && <span className="text-xs bg-gray-500 text-white px-2 py-0.5 rounded-full font-normal">アーカイブ済</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex flex-col gap-0.5">
                            <div className="flex flex-wrap items-center gap-1">
                                <span>母:</span>
                                {mother ? (
                                    <button 
                                        onClick={() => onMotherClick && onMotherClick(mother.id)}
                                        className="text-wagyu-600 font-bold hover:underline bg-wagyu-50 px-1.5 py-0.5 rounded flex items-center gap-1"
                                    >
                                        {mother.name} 
                                        <span className="text-[10px] text-gray-500 font-mono">({mother.earTag.slice(-5)})</span>
                                    </button>
                                ) : (
                                    <span className="text-gray-400">不明</span>
                                )}
                            </div>
                            <div>父: {calf.fatherName || '不明'}</div>
                            {calf.earTag && calf.earTag.length > 5 && (
                                <div className="mt-1 text-[10px] text-gray-400 font-mono">フル番号: {calf.earTag}</div>
                            )}
                        </div>
                    </div>
                    <div className="bg-gray-100 px-3 py-1.5 rounded-lg text-center flex-shrink-0 ml-2">
                        <div className="text-[10px] text-gray-500 mb-0.5">現在の日齢</div>
                        <div className="font-bold text-gray-800">{calculateAge(calf.birthDate)}</div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-white border-b border-gray-200 sticky top-16 z-10 shadow-sm">
                <button onClick={() => setActiveTab('INFO')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'INFO' ? 'border-wagyu-600 text-wagyu-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>基本情報</button>
                <button onClick={() => setActiveTab('MEMO')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'MEMO' ? 'border-wagyu-600 text-wagyu-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>メモ・ToDo</button>
            </div>

            {/* Content */}
            <div className="p-4">
                {activeTab === 'INFO' && !isEditing && (
                    <div className="space-y-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-sm font-bold text-gray-700 border-b border-gray-100 pb-2 mb-3">基本データ</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div><p className="text-[10px] text-gray-400 mb-0.5">生年月日</p><p className="font-medium text-sm">{formatDateJP(calf.birthDate)}</p></div>
                                <div><p className="text-[10px] text-gray-400 mb-0.5">母牛</p><p className="font-medium text-sm">{calf.motherId ? allCows.find(c => c.id === calf.motherId)?.name || '未設定' : '未設定'}</p></div>
                                <div><p className="text-[10px] text-gray-400 mb-0.5">種雄牛 (父)</p><p className="font-medium text-sm">{calf.fatherName || '未設定'}</p></div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-sm font-bold text-gray-700 border-b border-gray-100 pb-2 mb-3">出荷・販売実績</h3>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div><p className="text-[10px] text-gray-400 mb-0.5">せり月(出荷月)</p><p className="font-medium text-sm">{calf.auctionDate ? formatDateJP(calf.auctionDate) : '未定'}</p></div>
                                <div><p className="text-[10px] text-gray-400 mb-0.5">販売額</p><p className="font-medium text-sm text-wagyu-700">{calf.price ? `¥${calf.price.toLocaleString()}` : '-'}</p></div>
                                <div><p className="text-[10px] text-gray-400 mb-0.5">体重</p><p className="font-medium text-sm">{calf.weight ? `${calf.weight} kg` : '-'}</p></div>
                            </div>
                        </div>
                        
                        <div className="pt-6 text-center">
                            <button 
                                onClick={() => setDeleteStep(calf.isRemoved ? 2 : 1)} 
                                className="text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition-colors"
                            >
                                <Trash2 size={16} /> 
                                {calf.isRemoved ? '子牛データを完全に削除' : 'データをアーカイブする'}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'INFO' && isEditing && (
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-wagyu-200 space-y-4">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">名前 (名号)</label>
                            <input className="w-full p-2 border rounded-lg" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">個体識別番号</label>
                            <input className="w-full p-2 border rounded-lg" inputMode="numeric" pattern="[0-9]*" value={editForm.earTag || ''} onChange={e => setEditForm({...editForm, earTag: e.target.value})} />
                        </div>
                        <EraDateInput
                            label="生年月日"
                            value={editForm.birthDate}
                            onChange={(val) => setEditForm({...editForm, birthDate: val})}
                        />
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">性別</label>
                            <select className="w-full p-2 border rounded-lg" value={editForm.sex} onChange={e => setEditForm({...editForm, sex: e.target.value as 'MALE' | 'FEMALE'})}>
                                <option value="MALE">オス/去勢</option>
                                <option value="FEMALE">メス</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">母牛</label>
                            <select 
                                className="w-full p-2 border rounded-lg" 
                                value={editForm.motherId || ''} 
                                onChange={e => {
                                    const mId = e.target.value;
                                    const nextState = { ...editForm, motherId: mId };
                                    if (mId) {
                                        // ★母牛を選んだら種付履歴から父牛（種雄牛）を自動補完
                                        const motherCow = allCows.find(c => c.id === mId);
                                        const bull = getBullFromMother(motherCow);
                                        // 父牛が空、または前の自動入力値のままなら上書き
                                        if (bull && (!editForm.fatherName || autoFilled)) {
                                            nextState.fatherName = bull;
                                            setAutoFilled(true);
                                        }
                                    }
                                    setEditForm(nextState);
                                }}
                            >
                                <option value="">選択しない</option>
                                {allCows.map(c => (
                                    <option key={c.id} value={c.id}>{c.earTag ? c.earTag.slice(-5) + ' ' : ''}{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">種雄牛 (父)</label>
                            <input
                                className={`w-full p-2 border rounded-lg ${editForm.fatherName ? 'border-wagyu-300 bg-wagyu-50' : ''}`}
                                list="bull-candidates"
                                value={editForm.fatherName || ''}
                                onChange={e => { setEditForm({...editForm, fatherName: e.target.value}); setAutoFilled(false); }}
                            />
                            {autoFilled && editForm.fatherName && (
                                <p className="text-[10px] text-wagyu-600 font-bold mt-0.5">✅ 母牛の種付履歴から自動入力しました</p>
                            )}
                            {!editForm.fatherName && editForm.motherId && (
                                <p className="text-[10px] text-orange-500 mt-0.5">⚠️ 母牛に種付記録がないため自動入力できません</p>
                            )}
                        </div>
                        
                        <div className="border-t border-gray-100 pt-4 mt-2">
                             <EraDateInput
                                label="せり月(出荷月)"
                                value={editForm.auctionDate || ''}
                                onChange={(val) => setEditForm({...editForm, auctionDate: val})}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                            <label className="text-xs text-gray-500 block mb-1">販売額 (千円)</label>
                            <input type="number" className="w-full p-2 border rounded-lg" value={displayPrice} onChange={e => {
                                const raw = e.target.value ? Number(e.target.value) : undefined;
                                setEditForm({...editForm, price: raw ? raw * 1000 : undefined});
                            }} />
                            </div>
                            <div>
                            <label className="text-xs text-gray-500 block mb-1">体重 (kg)</label>
                            <input type="number" className="w-full p-2 border rounded-lg" value={editForm.weight || ''} onChange={e => setEditForm({...editForm, weight: e.target.value ? Number(e.target.value) : undefined})} />
                            </div>
                        </div>

                        <button onClick={handleSave} className="w-full bg-wagyu-600 text-white font-bold py-3 rounded-xl mt-4 shadow-md">
                            保存する
                        </button>
                    </div>
                )}

                {activeTab === 'MEMO' && (
                    <MemoLine 
                        notes={calf.notes || []}
                        onAddNote={(note) => {
                            const newNoteList = [...(calf.notes || []), { ...note, id: Date.now().toString() }];
                            onUpdate({ ...calf, notes: newNoteList });
                        }}
                        onDeleteNote={(noteId) => {
                            const newNoteList = (calf.notes || []).filter(n => n.id !== noteId);
                            onUpdate({ ...calf, notes: newNoteList });
                        }}
                        onUpdateNote={(note) => {
                            const newNoteList = (calf.notes || []).map(n => n.id === note.id ? note : n);
                            onUpdate({ ...calf, notes: newNoteList });
                        }}
                        quickTags={COMMON_MEMO_TAGS}
                    />
                )}
            </div>

            {/* Archive Confirmation Modal */}
            {deleteStep === 1 && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center">
                        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">データをアーカイブしますか？</h3>
                        <p className="text-gray-500 mb-6 text-sm">
                            「{calf.name || '名前未設定'}」をアーカイブリストに移動します。<br/>
                            通常の子牛一覧からは非表示になります。
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setDeleteStep(0)}
                                className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                キャンセル
                            </button>
                            <button 
                                onClick={handleArchive}
                                className="flex-1 bg-wagyu-600 text-white font-bold py-3 rounded-xl hover:bg-wagyu-700 shadow-lg transition-colors"
                            >
                                アーカイブする
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
                            「{calf.name || '名前未設定'}」のデータが完全に削除されます。<br/>
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
                                        onDelete(calf.id);
                                        onBack();
                                    }}
                                    className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 shadow-lg transition-colors"
                                >
                                    完全に削除する
                                </button>
                            </div>
                            <button 
                                onClick={() => {
                                    onUpdate({ ...calf, isRemoved: false });
                                    setDeleteStep(0);
                                }}
                                className="w-full bg-blue-50 text-blue-600 font-bold py-3 rounded-xl hover:bg-blue-100 transition-colors mt-2"
                            >
                                アーカイブから復元する
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
