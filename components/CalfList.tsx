import React, { useState } from 'react';
import { Calf } from '../types';
import { Baby, Plus, Search } from 'lucide-react';
import { formatDateJP, calculateAge } from '../utils/breedingService';

interface CalfListProps {
  calves: Calf[];
  onCalfClick: (calfId: string) => void;
  onAddCalfClick: () => void;
}

export const CalfList: React.FC<CalfListProps> = ({ calves, onCalfClick, onAddCalfClick }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'REMOVED'>('ALL');

  const filteredCalves = calves
    .filter((calf) => {
      const matchName = calf.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTag = calf.earTag?.includes(searchTerm);
      const searchMatch = matchName || matchTag;

      if (filterMode === 'REMOVED') {
          return searchMatch && calf.isRemoved === true;
      } else {
          return searchMatch && !calf.isRemoved;
      }
    })
    .sort((a, b) => new Date(b.birthDate).getTime() - new Date(a.birthDate).getTime());

  return (
    <div className="flex flex-col h-full bg-gray-50 pb-24">
      {/* Header */}
      <header className="hero-gradient text-white rounded-b-3xl shadow-glow relative z-10 px-5 pt-10 pb-6">
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
                <Baby size={28} />
                子牛一覧
            </h1>
            <div className="flex gap-2">
                <button 
                    onClick={() => setFilterMode('ALL')} 
                    className={`px-3 py-1 text-xs rounded-full font-bold transition-colors ${filterMode === 'ALL' ? 'bg-white text-wagyu-700 shadow' : 'bg-white/20 text-white'}`}
                >
                    飼養中
                </button>
                <button 
                    onClick={() => setFilterMode('REMOVED')} 
                    className={`px-3 py-1 text-xs rounded-full font-bold transition-colors ${filterMode === 'REMOVED' ? 'bg-white text-wagyu-700 shadow' : 'bg-white/20 text-white'}`}
                >
                    アーカイブ
                </button>
            </div>
        </div>
        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70" />
          <input 
            type="text" 
            placeholder="名号や個体識別番号で検索..." 
            className="w-full bg-white/10 text-white placeholder-white/60 border border-white/20 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pt-4">
         <div className="space-y-3">
            {filteredCalves.map(calf => (
                <div 
                  key={calf.id} 
                  onClick={() => onCalfClick(calf.id)}
                  className="bg-white rounded-2xl p-4 shadow-soft border border-gray-100 tap-card cursor-pointer"
                >
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-1.5">
                                {calf.name || '名前未設定'}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${calf.sex === 'MALE' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                                    {calf.sex === 'MALE' ? 'オス/去勢' : 'メス'}
                                </span>
                            </h3>
                            <div className="flex items-baseline gap-1 mt-0.5">
                                <span className="text-xs text-gray-400 font-mono">ID:</span>
                                <span className="text-gray-900 font-bold text-xl font-mono">
                                    {calf.earTag ? calf.earTag.slice(-5) : 'なし'}
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                             <div className="text-sm font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                 {calculateAge(calf.birthDate)}
                             </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center text-xs text-gray-600 gap-4 mt-3">
                        <div className="flex flex-col">
                            <span className="text-gray-400 text-[10px]">生年月日</span>
                            <span className="font-medium">{formatDateJP(calf.birthDate)}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-gray-400 text-[10px]">種雄牛(父)</span>
                            <span className="font-medium">{calf.fatherName || '-'}</span>
                        </div>
                        {calf.auctionDate && (
                            <div className="flex flex-col">
                                <span className="text-gray-400 text-[10px]">出荷月</span>
                                <span className="font-medium text-wagyu-700">{formatDateJP(calf.auctionDate, 'short')}</span>
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {filteredCalves.length === 0 && (
                <div className="text-center text-gray-500 py-10 flex flex-col items-center">
                    <Baby size={40} className="text-gray-300 mb-3" />
                    <p>該当する子牛が見つかりません</p>
                </div>
            )}
         </div>
      </div>

      {/* FAB */}
      <button 
        onClick={onAddCalfClick}
        className="fixed bottom-20 right-6 w-14 h-14 bg-wagyu-600 text-white rounded-full flex items-center justify-center shadow-glow hover:bg-wagyu-700 transition-all z-20 active:scale-90"
      >
        <Plus size={28} />
      </button>
    </div>
  );
};
