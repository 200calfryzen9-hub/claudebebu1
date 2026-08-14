import React from 'react';
import { Home, List, BarChart2, Settings, Baby } from 'lucide-react';

interface NavigationProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onTabChange }) => {
  const tabs = [
    { id: 'dashboard', icon: Home, label: 'ホーム' },
    { id: 'list', icon: List, label: '母牛一覧' },
    { id: 'calves', icon: Baby, label: '子牛一覧' },
    { id: 'analytics', icon: BarChart2, label: '分析' },
    { id: 'settings', icon: Settings, label: '設定' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 px-3 pb-2 pb-safe pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="flex justify-around items-center h-[64px] bg-white/90 backdrop-blur-lg rounded-2xl shadow-[0_8px_30px_-8px_rgba(0,0,0,0.18)] border border-gray-100">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative flex flex-col items-center justify-center w-full h-full group"
              >
                <div
                  className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-wagyu-50 text-wagyu-700 -translate-y-1 shadow-sm'
                      : 'text-gray-400 group-hover:text-gray-600 group-active:scale-90'
                  }`}
                >
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  <span className={`text-[10px] font-bold ${isActive ? 'opacity-100' : 'opacity-80'}`}>
                    {tab.label}
                  </span>
                </div>
                {isActive && (
                  <span className="absolute -top-0.5 w-1.5 h-1.5 rounded-full bg-wagyu-500 animate-pop"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
