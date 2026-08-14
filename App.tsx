
import React, { useState, useEffect, useRef } from 'react';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { CowList } from './components/CowList';
import { CowDetail } from './components/CowDetail';
import { CalfList } from './components/CalfList';
import { CalfDetail } from './components/CalfDetail';
import { Analytics } from './components/Analytics';
import { Settings } from './components/Settings';
import { MOCK_COWS, MOCK_CALVES } from './data/mockData';
import { DEFAULT_SETTINGS, MOCK_BULLS as INITIAL_BULLS } from './constants';
import { generateAlerts, calculateExpectedCalvingDate, recalculateCowStatus, daysBetween, parseDate, resolveFatherName } from './utils/breedingService';
import { Cow, BreedingEvent, EventType, BreedingStatus, GeneralEvent, Calf } from './types';
import { Wifi, WifiOff } from 'lucide-react';
import { initFirebase, saveToRemote, subscribeToRemote } from './utils/firebaseService';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settings, setSettings] = useState(() => {
    try {
        const saved = localStorage.getItem('wagyu_settings');
        return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch (e) {
        return DEFAULT_SETTINGS;
    }
  });
  
  const [cows, setCows] = useState<Cow[]>(() => {
    try {
        const saved = localStorage.getItem('wagyu_cows');
        // Handle case where saved is "null" string or actual null
        let loadedCows = saved ? JSON.parse(saved) : null;
        
        // Fallback if data is corrupted or not an array
        if (!Array.isArray(loadedCows)) {
            loadedCows = MOCK_COWS;
        }

        // Deep sanitization: Ensure arrays are actually arrays (not Firebase objects)
        return loadedCows.map((c: any) => ({
            ...c,
            // If events is an object (Firebase quirk), convert values to array. If undefined, empty array.
            events: Array.isArray(c.events) ? c.events : (c.events ? Object.values(c.events) : []),
            badges: Array.isArray(c.badges) ? c.badges : (c.badges ? Object.values(c.badges) : [])
        }));
    } catch (e) {
        console.error("Failed to load cows data", e);
        return MOCK_COWS;
    }
  });

  const [calves, setCalves] = useState<Calf[]>(() => {
    try {
        const saved = localStorage.getItem('wagyu_calves');
        return saved ? JSON.parse(saved) : MOCK_CALVES;
    } catch (e) { return MOCK_CALVES; }
  });

  const [selectedCowId, setSelectedCowId] = useState<string | null>(null);
  const [selectedCalfId, setSelectedCalfId] = useState<string | null>(null);
  const [lastViewedCowId, setLastViewedCowId] = useState<string | null>(null);
  
  const [bullList, setBullList] = useState<string[]>(() => {
    try {
        const saved = localStorage.getItem('wagyu_bulls');
        return saved ? JSON.parse(saved) : INITIAL_BULLS;
    } catch (e) { return INITIAL_BULLS; }
  });
  
  const [generalEvents, setGeneralEvents] = useState<GeneralEvent[]>(() => {
      try {
          const saved = localStorage.getItem('wagyu_general_events');
          return saved ? JSON.parse(saved) : [];
      } catch (e) { return []; }
  });

  const isRemoteUpdate = useRef(false);
  const [syncStatus, setSyncStatus] = useState<'OFFLINE' | 'ONLINE'>('OFFLINE');

  // Recalculate statuses on mount (e.g. if days passed since last login)
  useEffect(() => {
    setCows(prevCows => {
        let hasChanges = false;
        const newCows = prevCows.map(cow => {
            // Recalculate status based on events to handle RECOVERY -> EMPTY transition automatically
            const { status, lastInseminationDate, lastCalvingDate, expectedCalvingDate } = recalculateCowStatus(cow.events);
            
            // If status changed (e.g. from RECOVERY to EMPTY due to time), update it
            if (cow.status !== status) {
                hasChanges = true;
                return { ...cow, status, lastInseminationDate, lastCalvingDate, expectedCalvingDate };
            }
            return cow;
        });
        return hasChanges ? newCows : prevCows;
    });
  }, []);

  // Firebase Init & Sync Effects
  useEffect(() => {
      if (settings.sync?.enabled && settings.sync?.firebaseConfigString) {
          const success = initFirebase(settings.sync.firebaseConfigString);
          if (success) {
              setSyncStatus('ONLINE');
              
              // Helper: Normalize Firebase data (handles Objects, Arrays, Nulls)
              const normalizeData = <T,>(data: any): T[] => {
                  if (!data) return [];
                  // If it's an object (Firebase often returns objects with ID keys), convert to array values
                  // If it's already an array, use it
                  const list = Array.isArray(data) ? data : Object.values(data);
                  // Filter out null/undefined values (Firebase deletions leave nulls in sparse arrays)
                  return list.filter((item: any) => item != null);
              };

              subscribeToRemote(settings.sync.familyId, 'cows', (val) => { 
                  isRemoteUpdate.current = true; 
                  const rawCows = normalizeData<Cow>(val);
                  
                  // CRITICAL: Deep sanitize internal arrays (events, badges)
                  // This prevents "Cannot read properties of undefined (reading 'type')" crashes
                  const safeCows = rawCows.map(c => ({
                      ...c,
                      events: c.events ? normalizeData<BreedingEvent>(c.events) : [],
                      badges: c.badges ? normalizeData<string>(c.badges) : []
                  }));
                  
                  setCows(safeCows); 
              });
              
              subscribeToRemote(settings.sync.familyId, 'calves', (val) => { 
                  isRemoteUpdate.current = true; 
                  setCalves(normalizeData<Calf>(val)); 
              });
              subscribeToRemote(settings.sync.familyId, 'events', (val) => { 
                  isRemoteUpdate.current = true; 
                  setGeneralEvents(normalizeData<GeneralEvent>(val)); 
              });
          }
      }
  }, [settings.sync?.enabled]);

  useEffect(() => { localStorage.setItem('wagyu_cows', JSON.stringify(cows)); if (settings.sync?.enabled && !isRemoteUpdate.current && syncStatus === 'ONLINE') saveToRemote(settings.sync.familyId, 'cows', cows); isRemoteUpdate.current = false; }, [cows]);
  useEffect(() => { localStorage.setItem('wagyu_calves', JSON.stringify(calves)); if (settings.sync?.enabled && !isRemoteUpdate.current && syncStatus === 'ONLINE') saveToRemote(settings.sync.familyId, 'calves', calves); isRemoteUpdate.current = false; }, [calves]);
  useEffect(() => { localStorage.setItem('wagyu_general_events', JSON.stringify(generalEvents)); if (settings.sync?.enabled && !isRemoteUpdate.current && syncStatus === 'ONLINE') saveToRemote(settings.sync.familyId, 'events', generalEvents); isRemoteUpdate.current = false; }, [generalEvents]);
  useEffect(() => { localStorage.setItem('wagyu_bulls', JSON.stringify(bullList)); if (settings.sync?.enabled && !isRemoteUpdate.current && syncStatus === 'ONLINE') saveToRemote(settings.sync.familyId, 'bulls', bullList); isRemoteUpdate.current = false; }, [bullList]);
  useEffect(() => { localStorage.setItem('wagyu_settings', JSON.stringify(settings)); }, [settings]);

  // Firebase Init & Sync Effects (Update for bulls)
  // Actually we need to make sure we don't duplicate useEffects but I will just add the effect above. Wait, subscribeToRemote was defined in another effect.
  // I will just leave the save side. Let's fix handlePopState
  
  // Handle Browser Back Button (PopState)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
        if (selectedCowId || selectedCalfId) {
            setSelectedCowId(null);
            setSelectedCalfId(null);
        }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedCowId, selectedCalfId]);

  // Safety check: If selected item doesn't exist anymore, clear selection
  useEffect(() => {
    if (selectedCowId && !cows.find(c => c.id === selectedCowId)) setSelectedCowId(null);
    if (selectedCalfId && !calves.find(c => c.id === selectedCalfId)) setSelectedCalfId(null);
  }, [selectedCowId, cows, selectedCalfId, calves]);

  const alerts = generateAlerts(cows, settings);

  const handleCowClick = (cowId: string) => {
      setLastViewedCowId(cowId);
      window.history.pushState({ cowId }, '', `#cow-${cowId}`);
      setSelectedCowId(cowId);
  };
  
  const handleCalfClick = (calfId: string) => {
      window.history.pushState({ calfId }, '', `#calf-${calfId}`);
      setSelectedCalfId(calfId);
  };
  
  const handleBack = () => {
      if (window.history.state?.cowId || window.history.state?.calfId) {
          window.history.back();
      } else {
          setSelectedCowId(null);
          setSelectedCalfId(null);
      }
  };
  
  const handleDeleteCow = (cowId: string) => {
      setSelectedCowId(null);
      setActiveTab('list');
      setCows(prev => prev.filter(c => c.id !== cowId));
      setCalves(prev => prev.filter(c => c.motherId !== cowId));
  };
  
  const handleAddCow = (newCow: Cow) => {
      setCows(prev => [...prev, newCow]);
  };

  const handleUpdateCow = (updatedCow: Cow) => setCows(prev => prev.map(c => c.id === updatedCow.id ? updatedCow : c));
  const handleAddCalf = (newCalf: Calf) => {
      // ★父牛が空なら母牛の種付履歴から自動補完（全登録ルート共通の最終防衛ライン）
      if (!newCalf.fatherName) {
          const resolved = resolveFatherName(newCalf, cows);
          if (resolved) newCalf.fatherName = resolved;
      }
      // Pre-populate with default todos if any exist in settings
      if (settings.defaultCalfTodos && settings.defaultCalfTodos.length > 0) {
          const nowStr = new Date().toISOString();
          newCalf.notes = settings.defaultCalfTodos.map((text: string, idx: number) => ({
              id: Date.now().toString() + idx,
              date: nowStr,
              text,
              isTodo: true,
              isDone: false
          }));
      }
      setCalves(prev => [...prev, newCalf]); 
  };
  const handleUpdateCalf = (updatedCalf: Calf) => {
      // ★更新時も父牛が空なら自動補完
      if (!updatedCalf.fatherName) {
          const resolved = resolveFatherName(updatedCalf, cows);
          if (resolved) updatedCalf = { ...updatedCalf, fatherName: resolved };
      }
      setCalves(prev => prev.map(c => c.id === updatedCalf.id ? updatedCalf : c));
  };
  const handleDeleteCalf = (calfId: string) => setCalves(prev => prev.filter(c => c.id !== calfId));
  const handleResetSalesData = () => setCalves(prev => prev.map(c => ({ ...c, price: undefined, weight: undefined, grade: undefined, auctionDate: undefined })));
  const handleAddGeneralEvent = (event: Omit<GeneralEvent, 'id'>) => { setGeneralEvents(prev => [...prev, { ...event, id: Date.now().toString() }]); };
  
  const handleImportCows = (newCows: Cow[]) => {
      setCows(newCows);
      if (newCows.length > 0) setActiveTab('list');
  };

  const handleAddEvent = (cowId: string, event: Partial<BreedingEvent>) => {
    setCows(prev => prev.map(cow => {
        if (cow.id !== cowId) return cow;

        const newEvents = [...(cow.events || []), { ...event, id: Date.now().toString() } as BreedingEvent];
        const { status, lastInseminationDate, lastCalvingDate, expectedCalvingDate } = recalculateCowStatus(newEvents);

        return {
            ...cow,
            events: newEvents,
            status,
            lastInseminationDate,
            lastCalvingDate,
            expectedCalvingDate
        };
    }));
  };

  const handleDeleteEvent = (cowId: string, eventId: string) => {
      const cow = cows.find(c => c.id === cowId);
      const eventToDelete = cow?.events.find(e => e.id === eventId);

      if (eventToDelete && eventToDelete.type === EventType.CALVING) {
          const calvingDate = eventToDelete.date;
          const linkedCalf = calves.find(c => c.motherId === cowId && c.birthDate === calvingDate);
          
          if (linkedCalf) {
              if (window.confirm('【確認】この日の分娩記録に関連する「子牛データ」も同時に削除しますか？\n（通常は「OK」を押して整合性を保ちます）')) {
                  setCalves(prev => prev.filter(c => c.id !== linkedCalf.id));
              }
          }
      }

      setCows(prev => prev.map(cow => {
          if (cow.id !== cowId) return cow;
          
          const filteredEvents = (Array.isArray(cow.events) ? cow.events : Object.values(cow.events || {})).filter((e: any) => e.id !== eventId);
          const { status, lastInseminationDate, lastCalvingDate, expectedCalvingDate } = recalculateCowStatus(filteredEvents);

          return {
              ...cow,
              events: filteredEvents,
              status,
              lastInseminationDate,
              lastCalvingDate,
              expectedCalvingDate
          };
      }));
  };

  // ★表示用: 父牛が未設定の子牛は、母牛の種付履歴からその場で補完して表示する
  // （過去に登録済みで父牛が空のままのデータも「不明」にならず表示される）
  const enrichedCalves = calves.map(c => {
      if (c.fatherName) return c;
      const resolved = resolveFatherName(c, cows);
      return resolved ? { ...c, fatherName: resolved } : c;
  });

  let tabContent;
  switch (activeTab) {
    case 'dashboard': tabContent = ( <Dashboard cows={cows} calves={calves} alerts={alerts} onCowClick={handleCowClick} generalEvents={generalEvents} onAddGeneralEvent={handleAddGeneralEvent} onUpdateCow={handleUpdateCow} onUpdateCalf={handleUpdateCalf} /> ); break;
    case 'list': tabContent = <CowList cows={cows} onCowClick={handleCowClick} settings={settings} onAddCow={handleAddCow} lastViewedCowId={lastViewedCowId} />; break;
    case 'calves': tabContent = <CalfList calves={enrichedCalves} onCalfClick={handleCalfClick} onAddCalfClick={() => {
        const newCalf: Calf = {
            id: Date.now().toString(),
            sex: 'MALE',
            birthDate: new Date().toISOString().split('T')[0],
        };
        handleAddCalf(newCalf);
        handleCalfClick(newCalf.id); // Open it immediately for editing
    }} />; break;
    case 'analytics': tabContent = ( <Analytics cows={cows} calves={calves} settings={settings} onResetData={handleResetSalesData} onCowClick={handleCowClick} /> ); break;
    case 'settings': tabContent = ( <Settings settings={settings} onSave={setSettings} cows={cows} calves={calves} generalEvents={generalEvents} bullList={bullList} onImportCows={handleImportCows} onRestoreBackup={(restoredCows, restoredCalves, restoredSettings, restoredGeneralEvents, restoredBullList) => { setCows(restoredCows); setCalves(restoredCalves); setSettings(restoredSettings); if(restoredGeneralEvents) setGeneralEvents(restoredGeneralEvents); if(restoredBullList) setBullList(restoredBullList); }} /> ); break;
    default: tabContent = ( <Dashboard cows={cows} calves={calves} alerts={alerts} onCowClick={handleCowClick} generalEvents={generalEvents} onAddGeneralEvent={handleAddGeneralEvent} onUpdateCow={handleUpdateCow} onUpdateCalf={handleUpdateCalf} /> );
  }

  const targetCow = selectedCowId ? cows.find(c => c.id === selectedCowId) : null;
  const targetCalf = selectedCalfId ? enrichedCalves.find(c => c.id === selectedCalfId) : null;

  // 父牛・母の父の入力候補（種雄牛リスト + これまでに登録された父牛名）。全画面共通の1つのdatalistを参照する。
  const bullCandidates = Array.from(new Set([
      ...bullList,
      ...cows.map(c => c.fatherName),
      ...cows.map(c => c.motherFatherName),
  ].filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b, 'ja'));

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden">
        <datalist id="bull-candidates">
            {bullCandidates.map(name => <option key={name} value={name} />)}
        </datalist>
        {settings.sync?.enabled && ( <div className={`absolute top-0 right-0 p-2 z-50 ${syncStatus === 'ONLINE' ? 'text-green-500' : 'text-gray-400'}`}> {syncStatus === 'ONLINE' ? <Wifi size={16} /> : <WifiOff size={16} />} </div> )}
        <main className="h-screen overflow-hidden flex flex-col">
            <div className={`flex-1 overflow-y-auto relative scroll-smooth ${targetCow || targetCalf ? 'hidden' : 'block'}`}>
                {tabContent}
            </div>
            {targetCow && (
                <div className="flex-1 overflow-y-auto relative scroll-smooth block">
                    <CowDetail 
                        cow={targetCow} 
                        allCows={cows} 
                        calves={enrichedCalves.filter(c => c.motherId === targetCow.id)} 
                        settings={settings}
                        onBack={handleBack} 
                        onAddEvent={handleAddEvent}
                        onDeleteEvent={handleDeleteEvent} 
                        bullList={bullList} 
                        onUpdateBullList={setBullList} 
                        onDelete={handleDeleteCow} 
                        onUpdate={handleUpdateCow} 
                        onAddCalf={handleAddCalf} 
                        onUpdateCalf={handleUpdateCalf} 
                        onDeleteCalf={handleDeleteCalf} 
                    /> 
                </div>
            )}
            {targetCalf && (
                <div className="flex-1 overflow-y-auto relative scroll-smooth block">
                    <CalfDetail
                        calf={targetCalf}
                        allCows={cows}
                        onBack={handleBack}
                        onUpdate={handleUpdateCalf}
                        onDelete={handleDeleteCalf}
                        onMotherClick={(motherId) => {
                            setSelectedCalfId(null);
                            handleCowClick(motherId);
                        }}
                    />
                </div>
            )}
        </main>
        {(!targetCow && !targetCalf) && ( <Navigation currentTab={activeTab} onTabChange={setActiveTab} /> )}
    </div>
  );
}
