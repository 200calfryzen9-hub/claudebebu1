
import React, { useState } from 'react';
import { parseDate, formatDate, addDays, formatDateJP } from '../utils/breedingService';
import { ChevronLeft, ChevronRight, Plus, X, Calendar, ArrowRight } from 'lucide-react';
import { GeneralEvent, CalendarEvent } from '../types';

interface CalendarViewProps {
  events: CalendarEvent[];
  onCowClick: (cowId: string) => void;
  onAddGeneralEvent: (event: Omit<GeneralEvent, 'id'>) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ events, onCowClick, onAddGeneralEvent }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  // New Event State
  const [newEventDate, setNewEventDate] = useState(formatDate(new Date()));
  const [newEventTitle, setNewEventTitle] = useState('');

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleAddEvent = () => {
      if (newEventTitle) {
          onAddGeneralEvent({
              date: newEventDate,
              title: newEventTitle,
              type: 'TASK',
              color: 'bg-gray-500'
          });
          setNewEventTitle('');
          setShowAddModal(false);
      }
  };

  const days = [];
  // Empty slots
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  // Days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const getEventsForDay = (day: number) => {
      const dateStr = formatDate(new Date(year, month, day));
      return events.filter(e => e.date === dateStr);
  };

  const headerDateLabel = new Intl.DateTimeFormat('ja-JP-u-ca-japanese', { year: 'numeric', month: 'long' }).format(currentDate);

  const handleEventClick = (e: CalendarEvent) => {
      setSelectedEvent(e);
  };

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden relative">
      <div className="flex justify-between items-center p-4 border-b border-gray-100">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft size={20} />
        </button>
        <h2 className="font-bold text-lg text-gray-800">
            {headerDateLabel}
        </h2>
        <div className="flex items-center gap-2">
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full">
                <ChevronRight size={20} />
            </button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 text-center text-xs font-bold text-gray-500 bg-gray-50 py-2">
          <div className="text-red-500">日</div>
          <div>月</div>
          <div>火</div>
          <div>水</div>
          <div>木</div>
          <div>金</div>
          <div className="text-blue-500">土</div>
      </div>

      <div className="grid grid-cols-7 text-sm">
          {days.map((day, idx) => {
              const dayEvents = day ? getEventsForDay(day) : [];
              const isToday = day && formatDate(new Date(year, month, day)) === formatDate(new Date());
              const hasCalvingEvent = dayEvents.some(e => e.type === 'CALVING');
              
              let dayClass = 'text-gray-700';
              if (hasCalvingEvent && isToday) {
                  dayClass = 'bg-wagyu-600 text-white border-2 border-red-500 font-bold';
              } else if (hasCalvingEvent) {
                  dayClass = 'border-2 border-red-500 text-red-600 font-bold';
              } else if (isToday) {
                  dayClass = 'bg-wagyu-600 text-white';
              }

              // Map bg color class → text color class for earTag labels
              const bgToText = (bgClass: string): string => {
                  const map: Record<string, string> = {
                      'bg-red-500':    'text-red-600',
                      'bg-orange-400': 'text-orange-500',
                      'bg-blue-400':   'text-blue-500',
                      'bg-blue-500':   'text-blue-600',
                      'bg-green-500':  'text-green-600',
                      'bg-purple-500': 'text-purple-600',
                      'bg-pink-400':   'text-pink-500',
                      'bg-amber-400':  'text-amber-500',
                      'bg-gray-500':   'text-gray-500',
                  };
                  return map[bgClass] ?? 'text-gray-500';
              };

              // Extract earTag last-5 from event title  e.g. "分娩予定: 67890 はなこ" → "67890"
              const extractId = (title: string): string => {
                  const m = title.match(/(\d{5})/);
                  return m ? m[1] : '----';
              };

              return (
                  <div key={idx} className={`min-h-[64px] border-t border-r border-gray-100 p-1 relative ${!day ? 'bg-gray-50' : ''}`}>
                      {day && (
                          <>
                            <span className={`block w-6 h-6 text-center leading-5 rounded-full text-xs font-medium mb-0.5 mx-auto ${dayClass}`}>
                                {day}
                            </span>
                            <div className="flex flex-col gap-0.5">
                                {dayEvents.map((evt, eIdx) => {
                                    const textColor = bgToText(evt.color);
                                    const earTagId  = extractId(evt.title);
                                    return (
                                        <div
                                            key={eIdx}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEventClick(evt);
                                            }}
                                            className={`w-full text-center leading-tight font-bold cursor-pointer truncate rounded ${textColor}`}
                                            style={{ fontSize: '9px' }}
                                            title={evt.title}
                                        >
                                            {earTagId}
                                        </div>
                                    );
                                })}
                            </div>
                          </>
                      )}
                  </div>
              );
          })}
      </div>

      {/* Legend / List below calendar */}
      <div className="p-4 border-t border-gray-100">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase">今月のイベント</h3>
            <button 
                onClick={() => setShowAddModal(true)}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded flex items-center gap-1"
            >
                <Plus size={12} /> 予定追加
            </button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
             {events
                .filter(e => e.date.startsWith(formatDate(new Date(year, month, 1)).substring(0, 7)))
                .sort((a,b) => a.date.localeCompare(b.date))
                .map((e, idx) => {
                  // Derive border/text color from bg color class
                  const colorMap: Record<string, { border: string; text: string; bg: string }> = {
                    'bg-red-500':    { border: 'border-red-400',    text: 'text-red-600',    bg: 'bg-red-50'    },
                    'bg-orange-400': { border: 'border-orange-400', text: 'text-orange-600', bg: 'bg-orange-50' },
                    'bg-blue-400':   { border: 'border-blue-400',   text: 'text-blue-600',   bg: 'bg-blue-50'   },
                    'bg-blue-500':   { border: 'border-blue-500',   text: 'text-blue-700',   bg: 'bg-blue-50'   },
                    'bg-green-500':  { border: 'border-green-400',  text: 'text-green-700',  bg: 'bg-green-50'  },
                    'bg-purple-500': { border: 'border-purple-400', text: 'text-purple-700', bg: 'bg-purple-50' },
                    'bg-gray-500':   { border: 'border-gray-400',   text: 'text-gray-600',   bg: 'bg-gray-50'   },
                  };
                  const c = colorMap[e.color] ?? { border: 'border-gray-300', text: 'text-gray-600', bg: 'bg-gray-50' };
                  // Extract earTag (5 digits) from title if present
                  const idMatch = e.title.match(/(\d{5})/);
                  const earTagId = idMatch ? idMatch[1] : null;
                  // Event type label
                  const typeLabel = e.type === 'CALVING' ? '分娩予定' : e.type === 'ESTRUS_CHECK' ? '再発情' : null;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleEventClick(e)}
                      className={`flex items-center gap-2 text-sm p-2 rounded-lg border-l-4 ${c.border} ${c.bg} cursor-pointer hover:brightness-95 transition-all`}
                    >
                      <span className="font-mono text-gray-400 text-[10px] min-w-[42px]">{formatDateJP(e.date, 'short')}</span>
                      {typeLabel && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.bg} ${c.text} border ${c.border} whitespace-nowrap`}>
                          {typeLabel}
                        </span>
                      )}
                      {earTagId ? (
                        <span className={`font-bold font-mono ${c.text} text-sm`}>{earTagId}</span>
                      ) : (
                        <span className="text-gray-700 truncate text-xs">{e.title}</span>
                      )}
                    </div>
                  );
                })}
             {events.filter(e => e.date.startsWith(formatDate(new Date(year, month, 1)).substring(0, 7))).length === 0 && (
                 <div className="text-center text-xs text-gray-400 py-2">イベントはありません</div>
             )}
          </div>
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
          <div className="absolute inset-0 bg-white z-20 p-6 flex flex-col animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg">予定の追加</h3>
                  <button onClick={() => setShowAddModal(false)}><X size={24} className="text-gray-400" /></button>
              </div>
              
              <div className="space-y-4 flex-1">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
                      <input 
                        type="date"
                        value={newEventDate}
                        onChange={(e) => setNewEventDate(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                      <p className="text-xs text-gray-500 mt-1">{formatDateJP(newEventDate)}</p>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
                      <input 
                        type="text"
                        placeholder="例：共進会、会議、草刈り"
                        value={newEventTitle}
                        onChange={(e) => setNewEventTitle(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                  </div>
              </div>

              <button 
                onClick={handleAddEvent}
                className="w-full bg-gray-800 text-white font-bold py-3 rounded-xl mt-4"
              >
                  追加する
              </button>
          </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl relative">
                  <button 
                    onClick={() => setSelectedEvent(null)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                  >
                      <X size={24} />
                  </button>
                  
                  <div className="flex items-center gap-2 mb-2 text-gray-500 text-sm">
                      <Calendar size={16} />
                      {formatDateJP(selectedEvent.date)}
                  </div>
                  
                  <div className="flex items-start gap-3 mb-6">
                      <div className={`w-4 h-4 rounded-full mt-1.5 ${selectedEvent.color}`}></div>
                      <h3 className="text-xl font-bold text-gray-800">{selectedEvent.title}</h3>
                  </div>

                  {selectedEvent.cowId ? (
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-center">
                          <p className="text-sm text-gray-600 mb-3">この牛の詳細ページへ移動しますか？</p>
                          <button 
                            onClick={() => {
                                if (selectedEvent.cowId) onCowClick(selectedEvent.cowId);
                                setSelectedEvent(null);
                            }}
                            className="w-full bg-wagyu-600 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2"
                          >
                              詳細を見る <ArrowRight size={16} />
                          </button>
                      </div>
                  ) : (
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <span className="text-sm text-gray-500">個別の予定メモです</span>
                      </div>
                  )}
                  
                  <button 
                    onClick={() => setSelectedEvent(null)}
                    className="w-full mt-4 text-gray-500 font-bold py-2"
                  >
                      閉じる
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};
