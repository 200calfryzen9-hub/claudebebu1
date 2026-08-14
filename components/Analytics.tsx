
import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, ComposedChart } from 'recharts';
import { Calf, Cow, Settings as SettingsType, BreedingStatus } from '../types';
import { formatDateJP, calculateBreedingScore, daysBetween, parseDate } from '../utils/breedingService';
import { GitFork, RotateCcw, Activity, TrendingUp, Database } from 'lucide-react';

interface AnalyticsProps {
  cows: Cow[];
  calves: Calf[];
  settings: SettingsType;
  onResetData: () => void;
  onCowClick?: (cowId: string) => void;
}

export const Analytics: React.FC<AnalyticsProps> = ({ cows, calves, settings, onResetData, onCowClick }) => {
  // Sales Data Processing
  const salesData = calves.filter(c => c.price && c.price > 0).map(c => {
        const dateStr = c.auctionDate || c.birthDate;
        const jpYear = formatDateJP(new Date(dateStr), 'year_only'); 
        return { name: jpYear, price: c.price ? c.price / 10000 : 0 };
    });
  const groupedSalesData: {name: string, price: number, count: number}[] = [];
  salesData.forEach(item => {
      const existing = groupedSalesData.find(i => i.name === item.name);
      if (existing) { existing.price += item.price; existing.count += 1; } 
      else { groupedSalesData.push({ name: item.name, price: item.price, count: 1 }); }
  });
  const chartData = groupedSalesData.map(d => ({ name: d.name, price: Math.round(d.price / d.count) })).sort((a,b) => a.name.localeCompare(b.name)).slice(-5);
  const soldCalves = calves.filter(c => c.price && c.price > 0);
  const maxPrice = Math.max(...(soldCalves.map(c => c.price || 0))) || 0;
  const avgPrice = soldCalves.length > 0 ? Math.round(soldCalves.reduce((sum, c) => sum + (c.price || 0), 0) / soldCalves.length) : 0;

  // --- NEW METRICS ---
  const inseminatedCount = cows.filter(c => c.status === 'INSEMINATED').length;
  const emptyCount = cows.filter(c => c.status === 'EMPTY').length;
  
  // Avg Empty Days
  const emptyCowsWithHistory = cows.filter(c => c.status === 'EMPTY' && c.lastCalvingDate);
  const totalEmptyDays = emptyCowsWithHistory.reduce((sum, c) => sum + daysBetween(new Date(), parseDate(c.lastCalvingDate!)), 0);
  const avgEmptyDays = emptyCowsWithHistory.length > 0 ? Math.round(totalEmptyDays / emptyCowsWithHistory.length) : 0;

  // Pre-calving (1 month)
  const preCalvingCount = cows.filter(c => {
      if (!c.expectedCalvingDate) return false;
      const days = daysBetween(parseDate(c.expectedCalvingDate), new Date());
      return days >= 0 && days <= 30;
  }).length;

  // Real-time Breeding Score
  const { score, grade, details } = calculateBreedingScore(cows);

  const calculateBloodlineStats = (key: 'fatherName' | 'motherFatherName') => {
      const stats: Record<string, { total: number, count: number }> = {};
      calves.forEach(calf => {
          if (!calf.price) return;
          const mother = cows.find(c => c.id === calf.motherId);
          if (!mother) return;
          // Fix: Type-safe access to cow property
          const bullName = mother[key as keyof Cow] as string;
          if (!bullName) return;
          if (!stats[bullName]) stats[bullName] = { total: 0, count: 0 };
          stats[bullName].total += calf.price;
          stats[bullName].count += 1;
      });
      return Object.entries(stats).map(([name, data]) => ({ name, avg: Math.round(data.total / data.count) })).sort((a, b) => b.avg - a.avg);
  };
  const fatherStats = calculateBloodlineStats('fatherName'); 
  const grandFatherStats = calculateBloodlineStats('motherFatherName'); 

  // --- REVENUE PROJECTION ---
  const estimatedPrice = settings?.estimatedCalfPrice || 750000;
  
  const projectionMonthly: Record<string, { count: number, revenue: number, types: { calf: number, preg: number } }> = {};
  
  const addProjection = (date: Date, type: 'calf' | 'preg') => {
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // 1-12
      const key = `${year}年${month}月`;
      if (!projectionMonthly[key]) projectionMonthly[key] = { count: 0, revenue: 0, types: { calf: 0, preg: 0 } };
      projectionMonthly[key].count += 1;
      projectionMonthly[key].revenue += estimatedPrice;
      projectionMonthly[key].types[type] += 1;
  };

  // 1. Unsold calves (Wait 9 months after birth approx)
  calves.filter(c => !c.isRemoved && (!c.price || c.price === 0)).forEach(c => {
      const saleDate = new Date(c.birthDate);
      saleDate.setMonth(saleDate.getMonth() + 9);
      addProjection(saleDate, 'calf');
  });

  // 2. Pregnant / Inseminated Cows (expecting calves, 10 months after calving = approx 19-20 months after insemination actually)
  cows.filter(c => [BreedingStatus.PREGNANT, BreedingStatus.CALVING_SOON, BreedingStatus.INSEMINATED].includes(c.status) && !c.isRemoved).forEach(c => {
      if (c.expectedCalvingDate) {
          const saleDate = new Date(c.expectedCalvingDate);
          saleDate.setMonth(saleDate.getMonth() + 9);
          addProjection(saleDate, 'preg');
      }
  });

  const projectionChartData = Object.keys(projectionMonthly).sort((a, b) => {
      const [aY, aM] = a.replace('月','').split('年').map(Number);
      const [bY, bM] = b.replace('月','').split('年').map(Number);
      if (aY !== bY) return aY - bY;
      return aM - bM;
  }).map(k => ({
      name: k,
      '販売予定(頭)': projectionMonthly[k].count,
      '売上予測(万円)': Math.round(projectionMonthly[k].revenue / 10000),
      calfCount: projectionMonthly[k].types.calf,
      pregCount: projectionMonthly[k].types.preg
  })).filter(item => {
      const [y] = item.name.split('年').map(Number);
      return y >= new Date().getFullYear(); // Only show future to current
  }).slice(0, 18); // Show up to 18 visible months

  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  let currentYearExpectedCount = 0;
  let nextYearExpectedCount = 0;
  let currentYearExpectedSales = 0;
  let nextYearExpectedSales = 0;

  projectionChartData.forEach(item => {
      const y = Number(item.name.split('年')[0]);
      if (y === currentYear) {
          currentYearExpectedCount += item['販売予定(頭)'];
          currentYearExpectedSales += item['売上予測(万円)'] * 10000;
      } else if (y === nextYear) {
          nextYearExpectedCount += item['販売予定(頭)'];
          nextYearExpectedSales += item['売上予測(万円)'] * 10000;
      }
  });

  const handleReset = () => { if(window.confirm('販売データをリセットしますか？')) onResetData(); };

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">経営分析</h1>
          <button onClick={handleReset} className="text-xs text-gray-500 flex items-center gap-1 border border-gray-200 px-2 py-1 rounded hover:bg-gray-100"><RotateCcw size={12} /> リセット</button>
      </div>

      {/* New Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm">
              <div className="text-xs font-bold text-blue-600 mb-1">種付け済み</div>
              <div className="text-2xl font-black text-gray-800">{inseminatedCount}<span className="text-sm font-normal text-gray-500 ml-1">頭</span></div>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="text-xs font-bold text-gray-500 mb-1">空胎牛</div>
              <div className="text-2xl font-black text-gray-800">{emptyCount}<span className="text-sm font-normal text-gray-500 ml-1">頭</span></div>
          </div>
          <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm">
              <div className="text-xs font-bold text-red-600 mb-1">平均空胎日数</div>
              <div className="text-2xl font-black text-gray-800">{avgEmptyDays}<span className="text-sm font-normal text-gray-500 ml-1">日</span></div>
          </div>
          <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 shadow-sm">
              <div className="text-xs font-bold text-purple-600 mb-1">出産前1ヶ月</div>
              <div className="text-2xl font-black text-gray-800">{preCalvingCount}<span className="text-sm font-normal text-gray-500 ml-1">頭</span></div>
          </div>
      </div>

      {/* Breeding Score Card (New) */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white shadow-xl">
          <div className="flex justify-between items-start mb-4">
              <div>
                  <h2 className="font-bold text-lg flex items-center gap-2"><Activity /> 繁殖効率スコア</h2>
                  <p className="text-xs text-gray-400">1年1産を目指すリアルタイム評価</p>
              </div>
              <div className="text-right">
                  <div className={`text-4xl font-black italic ${grade === 'S' ? 'text-yellow-400' : grade === 'A' ? 'text-green-400' : 'text-gray-300'}`}>
                      {grade} <span className="text-lg not-italic">判定</span>
                  </div>
              </div>
          </div>
          
          <div className="flex items-end gap-2 mb-6">
              <span className="text-5xl font-bold">{score}</span>
              <span className="text-gray-400 mb-1">/ 100点</span>
          </div>

          <div className="space-y-2 bg-white/10 p-3 rounded-lg">
              {details.length === 0 && <span className="text-sm text-gray-300">評価データが不足しています</span>}
              {details.map((d, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-gray-300">{d.label}</span>
                      <span className={`font-bold ${d.type === 'good' ? 'text-green-400' : d.type === 'bad' ? 'text-red-400' : 'text-yellow-400'}`}>
                          {d.value}
                      </span>
                  </div>
              ))}
          </div>
      </div>

      {/* Sales Stats */}
      <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="text-xs text-gray-500 mb-1">平均せり価格</div>
              <div className="text-2xl font-bold text-gray-800">¥{(avgPrice/10000).toFixed(0)}万</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="text-xs text-gray-500 mb-1">最高販売額</div>
              <div className="text-2xl font-bold text-wagyu-600">¥{(maxPrice/10000).toFixed(0)}万</div>
          </div>
      </div>

      {/* Revenue Projection (Future) */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-gray-700 text-md flex items-center gap-2"><TrendingUp size={18} className="text-wagyu-600"/> 売上・経営予測</h3>
              <div className="text-xs text-gray-400">予想単価: {(estimatedPrice/10000).toLocaleString()}万円</div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <div className="text-xs text-blue-600 font-bold mb-1">{currentYear}年 (合計)</div>
                  <div className="text-xl font-black text-blue-700">¥{(currentYearExpectedSales/10000).toLocaleString()}<span className="text-sm font-normal ml-1">万</span></div>
                  <div className="text-xs text-blue-500 mt-1">予定: {currentYearExpectedCount}頭</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                  <div className="text-xs text-green-600 font-bold mb-1">{nextYear}年 (合計)</div>
                  <div className="text-xl font-black text-green-700">¥{(nextYearExpectedSales/10000).toLocaleString()}<span className="text-sm font-normal ml-1">万</span></div>
                  <div className="text-xs text-green-500 mt-1">予定: {nextYearExpectedCount}頭</div>
              </div>
          </div>

          {projectionChartData.length > 0 ? (
              <div className="h-64 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={projectionChartData} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                          <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                          <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                          <Tooltip 
                            contentStyle={{borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                          />
                          <Bar yAxisId="left" dataKey="calfCount" name="生後(頭)" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={20} />
                          <Bar yAxisId="left" dataKey="pregCount" name="胎児(頭)" stackId="a" fill="#93c5fd" radius={[4, 4, 0, 0]} barSize={20} />
                          <Line yAxisId="right" type="monotone" dataKey="売上予測(万円)" stroke="#eab308" strokeWidth={3} dot={{r: 4}} />
                      </ComposedChart>
                  </ResponsiveContainer>
              </div>
          ) : (
              <div className="text-center text-sm text-gray-400 py-6">売上予測データがありません。種付けや分娩を記録すると表示されます。</div>
          )}
      </div>

      {/* Group Visualization */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-gray-700 text-md flex items-center gap-2">
                  <Database size={18} className="text-wagyu-600"/> 
                  グループ（部屋）別の状況
              </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(settings?.groups || []).map(group => {
                  const groupCows = cows.filter(c => !c.isRemoved && c.groupId === group.id);
                  if (groupCows.length === 0) return null; // Skip empty groups visually

                  // ★グループ内の注意情報を集計
                  const todayD = new Date();
                  const getAlertFlags = (cow: Cow) => {
                      let estrusAlert = false;   // 再発情注意 (種付後21日±3日)
                      let calvingAlert = false;  // 分娩予定注意 (14日以内)
                      let estrusOverdue = false; // 再発情確認日超過
                      let calvingOverdue = false;// 分娩予定日超過
                      if (cow.status === BreedingStatus.INSEMINATED && cow.lastInseminationDate) {
                          const d = daysBetween(todayD, new Date(cow.lastInseminationDate));
                          if (d >= 18 && d <= 24) estrusAlert = true;
                          if (d > 24 && d < 40) estrusOverdue = true; // 21日チェック期間を過ぎて妊鑑前
                      }
                      if (cow.expectedCalvingDate && (cow.status === BreedingStatus.PREGNANT || cow.status === BreedingStatus.CALVING_SOON || cow.status === BreedingStatus.INSEMINATED)) {
                          const d = daysBetween(new Date(cow.expectedCalvingDate), todayD);
                          if (d >= 0 && d <= 14) calvingAlert = true;
                          if (d < 0) calvingOverdue = true;
                      }
                      return { estrusAlert, calvingAlert, estrusOverdue, calvingOverdue };
                  };
                  const estrusCount = groupCows.filter(c => { const f = getAlertFlags(c); return f.estrusAlert || f.estrusOverdue; }).length;
                  const calvingCount = groupCows.filter(c => { const f = getAlertFlags(c); return f.calvingAlert || f.calvingOverdue; }).length;

                  return (
                      <div key={group.id} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                          <div className="bg-wagyu-600 text-white p-3 font-bold text-sm flex justify-between items-center">
                              <span>{group.name}</span>
                              <div className="flex items-center gap-1.5">
                                  {estrusCount > 0 && (
                                      <span className="text-[10px] bg-blue-500 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                          👀 再発情 {estrusCount}
                                      </span>
                                  )}
                                  {calvingCount > 0 && (
                                      <span className="text-[10px] bg-pink-500 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                          🍼 分娩 {calvingCount}
                                      </span>
                                  )}
                                  <span className="text-xs bg-wagyu-700 px-2 py-0.5 rounded-full">{groupCows.length}頭</span>
                              </div>
                          </div>
                          <div className="p-3 grid grid-cols-2 gap-2">
                              {groupCows.map(cow => {
                                  const flags = getAlertFlags(cow);
                                  // Determine status badge colors and short text
                                  let bgColor = 'bg-white';
                                  let textColor = 'text-gray-600';
                                  let shortStatus = '';

                                  const customBg = settings?.statusColors?.[cow.status];
                                  if (customBg) {
                                      bgColor = customBg;
                                      textColor = "text-gray-900"; // Assuming light custom bgs
                                  } else {
                                      if (cow.status === BreedingStatus.EMPTY) { bgColor = 'bg-red-50'; textColor = 'text-red-700'; }
                                      else if (cow.status === BreedingStatus.INSEMINATED) { bgColor = 'bg-blue-50'; textColor = 'text-blue-700'; }
                                      else if (cow.status === BreedingStatus.PREGNANT) { bgColor = 'bg-green-50'; textColor = 'text-green-700'; }
                                      else if (cow.status === BreedingStatus.RECOVERY) { bgColor = 'bg-gray-100'; textColor = 'text-gray-600'; }
                                      else if (cow.status === BreedingStatus.CALVING_SOON) { bgColor = 'bg-purple-50'; textColor = 'text-purple-700'; }
                                  }

                                  if (cow.status === BreedingStatus.EMPTY) shortStatus = '空胎';
                                  else if (cow.status === BreedingStatus.INSEMINATED) shortStatus = '種付済';
                                  else if (cow.status === BreedingStatus.PREGNANT) shortStatus = '妊娠中';
                                  else if (cow.status === BreedingStatus.RECOVERY) shortStatus = '休養';
                                  else if (cow.status === BreedingStatus.CALVING_SOON) shortStatus = '分娩前';

                                  let detailText = '';
                                  if (cow.status === BreedingStatus.INSEMINATED && cow.lastInseminationDate) {
                                      detailText = `AI後${daysBetween(new Date(), new Date(cow.lastInseminationDate))}日`;
                                  } else if (cow.status === BreedingStatus.CALVING_SOON && cow.expectedCalvingDate) {
                                      const d = daysBetween(new Date(cow.expectedCalvingDate), new Date());
                                      detailText = d >= 0 ? `あと${d}日` : `予定日超過`;
                                  } else if (cow.status === BreedingStatus.EMPTY && cow.lastCalvingDate) {
                                      detailText = `産後${daysBetween(new Date(), new Date(cow.lastCalvingDate))}日`;
                                  }

                                  const displayId = cow.earTag.length >= 5 ? cow.earTag.slice(-5) : cow.earTag;
                                  // ★予定超過の牛は枠を強調
                                  const overdueRing = (flags.calvingOverdue || flags.estrusOverdue) ? 'ring-2 ring-red-400' : '';

                                  return (
                                      <div 
                                          key={cow.id} 
                                          onClick={() => onCowClick && onCowClick(cow.id)}
                                          className={`p-2 rounded border border-gray-200 flex flex-col justify-between cursor-pointer hover:opacity-80 active:scale-95 transition-all relative ${bgColor} ${overdueRing}`}
                                      >
                                          {/* ★点滅アイコン: 予定超過 */}
                                          {flags.calvingOverdue && (
                                              <span className="absolute -top-1.5 -right-1.5 text-sm animate-blink" title="分娩予定日超過">🚨</span>
                                          )}
                                          {!flags.calvingOverdue && flags.estrusOverdue && (
                                              <span className="absolute -top-1.5 -right-1.5 text-sm animate-blink" title="再発情確認超過">⚠️</span>
                                          )}
                                          {/* 注意バッジ: 予定日前 */}
                                          {!flags.calvingOverdue && flags.calvingAlert && (
                                              <span className="absolute -top-1.5 -right-1.5 text-sm" title="分娩間近">🍼</span>
                                          )}
                                          {!flags.estrusOverdue && flags.estrusAlert && !flags.calvingAlert && !flags.calvingOverdue && (
                                              <span className="absolute -top-1.5 -right-1.5 text-sm" title="再発情チェック時期">👀</span>
                                          )}
                                          <div className="flex flex-col items-start gap-0.5">
                                              <span className={`font-bold text-xs ${textColor} truncate w-full`}>{displayId} {cow.name}</span>
                                          </div>
                                          <div className="flex justify-between items-end mt-1">
                                              <span className={`text-[10px] font-bold px-1.5 py-0.5 bg-white rounded-sm border ${textColor} opacity-80`}>{shortStatus}</span>
                                              <span className="text-[10px] text-gray-500 font-medium">{detailText}</span>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  );
              })}
              
              {/* No Group Cows */}
              {(() => {
                  const noGroupCows = cows.filter(c => !c.isRemoved && (!c.groupId || c.groupId === ''));
                  if (noGroupCows.length === 0) return null;
                  return (
                      <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                          <div className="bg-gray-400 text-white p-3 font-bold text-sm flex justify-between items-center">
                              <span>グループ未指定</span>
                              <span className="text-xs bg-gray-500 px-2 py-0.5 rounded-full">{noGroupCows.length}頭</span>
                          </div>
                          <div className="p-3 grid grid-cols-2 gap-2">
                              <span className="text-xs text-gray-500 italic col-span-2 text-center py-2">牛の詳細画面からグループを設定できます</span>
                          </div>
                      </div>
                  );
              })()}
          </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-72">
          <h3 className="font-bold text-gray-700 mb-4 text-sm">過去の販売価格推移 (万円)</h3>
          {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
                    <Bar dataKey="price" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
          ) : <div className="h-full flex items-center justify-center text-gray-400 text-xs">データなし</div>}
      </div>

      {/* Bloodline Stats (Simplified visual) */}
      <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center"><GitFork className="mr-2" size={18} /> 血統分析</h2>
          {/* Father Stats */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
             <div className="p-3 bg-gray-50 border-b border-gray-100 font-bold text-gray-700 text-xs">父牛別 (母牛の父)</div>
             <div className="divide-y divide-gray-100">
                 {fatherStats.slice(0, 5).map((stat, idx) => (
                     <div key={idx} className="p-3 flex justify-between items-center text-sm">
                         <div className="flex items-center gap-2"><span className="text-gray-400 w-4">{idx + 1}</span><span className="font-bold">{stat.name}</span></div>
                         <div className="text-wagyu-700 font-bold">¥{stat.avg.toLocaleString()}</div>
                     </div>
                 ))}
             </div>
          </div>
      </div>
    </div>
  );
};
