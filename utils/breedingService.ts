
import { Cow, BreedingEvent, EventType, BreedingStatus, DashboardAlert, Settings, CalendarEvent, Calf } from '../types';
import { GESTATION_DAYS, ESTRUS_CYCLE_DAYS } from '../constants';

// Simple date helpers
export const parseDate = (dateStr: string) => new Date(dateStr);

// FIX: Use local time for formatting to prevent timezone shifts (e.g. UTC vs JST)
export const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Japanese Date Formatter
export const formatDateJP = (dateInput: string | Date, style: 'long' | 'short' | 'year_only' = 'long') => {
  if (!dateInput) return '---';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  
  try {
    if (style === 'year_only') {
        return new Intl.DateTimeFormat('ja-JP-u-ca-japanese', { year: 'numeric', era: 'long' }).format(date);
    }
    
    if (style === 'short') {
       // Custom short format R7.2.26 to save space
       const dateObj = new Date(date);
       const year = dateObj.getFullYear();
       // Simple Reiwa calc (2019 = R1)
       const reiwaYear = year - 2018;
       const month = dateObj.getMonth() + 1;
       const day = dateObj.getDate();
       if (reiwaYear > 0) return `R${reiwaYear}.${month}.${day}`;
       return `${year}.${month}.${day}`;
    }

    return new Intl.DateTimeFormat('ja-JP-u-ca-japanese', { dateStyle: 'long' }).format(date);
  } catch (e) {
    return date.toLocaleDateString('ja-JP');
  }
};

// Calculate Age (e.g., 5歳3ヶ月)
export const calculateAge = (birthDateStr: string): string => {
    if (!birthDateStr) return '-';
    const birth = new Date(birthDateStr);
    const now = new Date();
    
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    
    if (months < 0) {
        years--;
        months += 12;
    }
    
    return `${years}歳${months}ヶ月`;
};

export const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};
export const daysBetween = (d1: Date, d2: Date) => {
  const oneDay = 24 * 60 * 60 * 1000;
  // d1 - d2: if d1 is after d2, returns positive. If d1 is before d2, returns negative.
  return Math.round((d1.getTime() - d2.getTime()) / oneDay);
};

export const calculateExpectedCalvingDate = (inseminationDate: string): string => {
  const date = parseDate(inseminationDate);
  return formatDate(addDays(date, GESTATION_DAYS));
};

// --- NEW: Status Recalculation Logic ---
// Re-evaluates the cow's current status based on its event history.
// Used when deleting events to ensure status rolls back correctly.
export const recalculateCowStatus = (events: BreedingEvent[] | undefined, initialStatus: BreedingStatus = BreedingStatus.EMPTY): {
    status: BreedingStatus;
    lastInseminationDate?: string;
    lastCalvingDate?: string;
    expectedCalvingDate?: string;
} => {
    let safeEvents = events;
    
    // Safety check: ensure safeEvents is an array. If it's an object (Firebase quirk), try values, else empty.
    if (!Array.isArray(safeEvents)) {
        if (safeEvents && typeof safeEvents === 'object') {
             // @ts-ignore
             safeEvents = Object.values(safeEvents);
        } else {
             safeEvents = [];
        }
    }
    
    // Sort events by date ascending (oldest first)
    const sortedEvents = [...(safeEvents as BreedingEvent[])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const today = new Date();

    let status = initialStatus;
    let lastInseminationDate = undefined;
    let lastCalvingDate = undefined;
    let expectedCalvingDate = undefined;

    // Reset basics
    status = BreedingStatus.EMPTY;

    for (const event of sortedEvents) {
        switch (event.type) {
            case EventType.INSEMINATION:
                status = BreedingStatus.INSEMINATED;
                lastInseminationDate = event.date;
                expectedCalvingDate = calculateExpectedCalvingDate(event.date);
                break;
            case EventType.PREG_CHECK:
                if (event.metadata?.pregResult === true) {
                    status = BreedingStatus.PREGNANT;
                    // Keep expectedCalvingDate from previous insemination
                } else {
                    status = BreedingStatus.EMPTY;
                    expectedCalvingDate = undefined;
                }
                break;
            case EventType.CALVING:
                lastCalvingDate = event.date;
                expectedCalvingDate = undefined;
                
                // Logic: 0-25 days is RECOVERY, 26+ days is EMPTY
                const daysSinceCalving = daysBetween(today, parseDate(event.date));
                if (daysSinceCalving >= 0 && daysSinceCalving <= 25) {
                    status = BreedingStatus.RECOVERY;
                } else {
                    status = BreedingStatus.EMPTY;
                }
                break;
            // Other events generally don't change the core breeding status
        }
    }

    if (status === BreedingStatus.PREGNANT && expectedCalvingDate) {
        const daysToCalving = daysBetween(parseDate(expectedCalvingDate), today);
        if (daysToCalving >= -30 && daysToCalving <= 30) {
            status = BreedingStatus.CALVING_SOON;
        }
    }

    return { status, lastInseminationDate, lastCalvingDate, expectedCalvingDate };
};

export const generateAlerts = (cows: Cow[], settings: Settings): DashboardAlert[] => {
  const alerts: DashboardAlert[] = [];
  const today = new Date();

  // 0. System Alert
  if (!settings.sync || !settings.sync.enabled) {
      alerts.push({
          id: 'system-sync-warning',
          cowId: 'system',
          cowName: 'システム通知',
          type: 'URGENT',
          message: 'データ共有設定が未完了です。「設定」タブから同期設定を行ってください。',
          date: formatDate(today),
          daysDiff: 0
      });
  }

  cows.forEach(cow => {
    const displayId = cow.earTag.length >= 5 ? cow.earTag.slice(-5) : cow.earTag;
    const displayName = `${displayId} ${cow.name}`;

    // 1. Calving Alerts
    if (cow.expectedCalvingDate && (cow.status === BreedingStatus.PREGNANT || cow.status === BreedingStatus.CALVING_SOON || cow.status === BreedingStatus.INSEMINATED)) {
      const due = parseDate(cow.expectedCalvingDate);
      const diff = daysBetween(due, today);

      if (diff >= 0 && diff <= 14) {
        alerts.push({
          id: `calving-${cow.id}`,
          cowId: cow.id,
          cowName: displayName,
          type: diff <= 3 ? 'URGENT' : 'WARNING',
          message: `分娩予定まであと${diff}日`,
          date: cow.expectedCalvingDate,
          daysDiff: diff
        });
      } else if (diff < 0) {
        alerts.push({
          id: `calving-overdue-${cow.id}`,
          cowId: cow.id,
          cowName: displayName,
          type: 'URGENT',
          message: `分娩予定日を超過 (${Math.abs(diff)}日)`,
          date: cow.expectedCalvingDate,
          daysDiff: diff
        });
      }
    }

    // 2. Estrus Return Alerts (Only for Inseminated status, NOT Pregnant)
    if (cow.status === BreedingStatus.INSEMINATED && cow.lastInseminationDate) {
      const insDate = parseDate(cow.lastInseminationDate);
      const daysSince = daysBetween(today, insDate);
      
      if (Math.abs(daysSince - 21) <= 2) {
        alerts.push({
          id: `estrus-21-${cow.id}`,
          cowId: cow.id,
          cowName: displayName,
          type: 'INFO',
          message: `再発情確認 (21日目)`,
          date: formatDate(today),
          daysDiff: 0
        });
      }
    }

    // 3. Pregnancy Check Alert (Assuming check around 30-40 days)
    if (cow.status === BreedingStatus.INSEMINATED && cow.lastInseminationDate) {
        const insDate = parseDate(cow.lastInseminationDate);
        const daysSince = daysBetween(today, insDate);
        if (daysSince >= 40 && daysSince <= 60) {
            alerts.push({
                id: `preg-check-${cow.id}`,
                cowId: cow.id,
                cowName: displayName,
                type: 'WARNING',
                message: `妊娠鑑定の時期です (${daysSince}日経過)`,
                date: formatDate(today),
                daysDiff: daysSince
            });
        }
    }

    // 4. Empty Cow Alerts (Exceeding target)
    if ((cow.status === BreedingStatus.EMPTY || cow.status === BreedingStatus.RECOVERY) && cow.lastCalvingDate) {
      const lastCalve = parseDate(cow.lastCalvingDate);
      const daysOpen = daysBetween(today, lastCalve);

      if (daysOpen >= settings.alertEmptyDays) {
        alerts.push({
          id: `empty-${cow.id}`,
          cowId: cow.id,
          cowName: displayName,
          type: 'WARNING',
          message: `分娩後${daysOpen}日経過 (種付推奨)`,
          date: formatDate(today),
          daysDiff: daysOpen
        });
      }
    }
  });

  return alerts.sort((a, b) => (a.type === 'URGENT' ? -1 : 1));
};

export const getCalendarEvents = (cows: Cow[]): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    cows.forEach(cow => {
      const displayId = cow.earTag.length >= 5 ? cow.earTag.slice(-5) : cow.earTag;
      const displayName = `${displayId} ${cow.name}`;

      if (cow.expectedCalvingDate && (cow.status === BreedingStatus.PREGNANT || cow.status === BreedingStatus.CALVING_SOON || cow.status === BreedingStatus.INSEMINATED)) {
          events.push({ 
              date: cow.expectedCalvingDate, 
              type: 'CALVING', 
              title: `分娩予定: ${displayName}`, 
              cowId: cow.id,
              color: cow.status === BreedingStatus.INSEMINATED ? 'bg-orange-400' : 'bg-red-500'
          });
      }
      if (cow.lastInseminationDate && (cow.status === BreedingStatus.INSEMINATED)) {
          const insDate = parseDate(cow.lastInseminationDate);
          events.push({ 
              date: formatDate(addDays(insDate, 21)), 
              type: 'ESTRUS_CHECK', 
              title: `再発情(21日): ${displayName}`, 
              cowId: cow.id,
              color: 'bg-blue-400'
          });
      }
    });
    return events;
};

// --- REAL-TIME BREEDING SCORE LOGIC ---
export const calculateBreedingScore = (cows: Cow[]) => {
    const today = new Date();
    let totalScore = 100; // Start perfect
    let scoreDetails = [];

    // Filter active breeding cows (exclude calves or very young heifers if we tracked them)
    const breedingCows = cows.filter(c => c.status !== BreedingStatus.RECOVERY);
    if (breedingCows.length === 0) return { score: 0, grade: 'N/A', details: [] };

    // 1. Pregnancy Rate (Percentage of cows pregnant or inseminated vs empty)
    const pregnantOrInsem = breedingCows.filter(c => 
        c.status === BreedingStatus.PREGNANT || 
        c.status === BreedingStatus.CALVING_SOON || 
        c.status === BreedingStatus.INSEMINATED
    ).length;
    const pregRate = (pregnantOrInsem / breedingCows.length) * 100;
    
    // Logic: Target > 80% is good. Below 50% is bad.
    if (pregRate < 50) {
        totalScore -= 20;
        scoreDetails.push({ label: '妊娠率低下', value: `${pregRate.toFixed(0)}%`, type: 'bad' });
    } else if (pregRate >= 80) {
        scoreDetails.push({ label: '高い妊娠率', value: `${pregRate.toFixed(0)}%`, type: 'good' });
    }

    // 2. Long Empty Cows
    const longEmptyCows = cows.filter(c => {
        if (!c.lastCalvingDate || c.status === BreedingStatus.PREGNANT) return false;
        const days = daysBetween(today, parseDate(c.lastCalvingDate));
        return days > 90; // Over 3 months empty is penalizing
    });
    
    if (longEmptyCows.length > 0) {
        const penalty = longEmptyCows.length * 5; // -5 points per long empty cow
        totalScore -= penalty;
        scoreDetails.push({ label: '長期空胎牛', value: `${longEmptyCows.length}頭`, type: 'bad' });
    }

    // 3. Calving Interval (Estimated for pregnant cows)
    let totalInterval = 0;
    let intervalCount = 0;
    cows.forEach(c => {
        if (c.lastCalvingDate && c.expectedCalvingDate) {
            const interval = daysBetween(parseDate(c.expectedCalvingDate), parseDate(c.lastCalvingDate));
            totalInterval += interval;
            intervalCount++;
        }
    });
    
    const avgInterval = intervalCount > 0 ? Math.round(totalInterval / intervalCount) : 0;
    if (avgInterval > 400) {
         totalScore -= 10;
         scoreDetails.push({ label: '予想分娩間隔', value: `${avgInterval}日`, type: 'warn' });
    } else if (avgInterval > 0 && avgInterval <= 365) {
         totalScore += 10; // Bonus
         scoreDetails.push({ label: '1年1産ペース', value: `${avgInterval}日`, type: 'good' });
    }

    // Clamp score
    totalScore = Math.max(0, Math.min(100, totalScore));

    let grade = 'C';
    if (totalScore >= 90) grade = 'S';
    else if (totalScore >= 80) grade = 'A';
    else if (totalScore >= 70) grade = 'B';

    return { score: totalScore, grade, details: scoreDetails };
};

// --- 父牛（種雄牛）解決ロジック ---
// Firebase経由でeventsがオブジェクト型になっても安全に配列化する
export const safeEventsArray = (events: any): BreedingEvent[] => {
    if (!events) return [];
    if (Array.isArray(events)) return events;
    if (typeof events === 'object') return Object.values(events) as BreedingEvent[];
    return [];
};

// 母牛の種付履歴から、この子牛の父牛（種雄牛）を特定する
// 優先順位: ①出生日以前の最新の種付け ②それがなければ最新の種付け
export const resolveFatherName = (calf: { motherId?: string; birthDate?: string; fatherName?: string }, cows: Cow[]): string | undefined => {
    if (calf.fatherName) return calf.fatherName; // 既に設定済みならそのまま
    if (!calf.motherId) return undefined;
    const mother = cows.find(c => c.id === calf.motherId);
    if (!mother) return undefined;
    const insems = safeEventsArray(mother.events)
        .filter(e => e && e.type === EventType.INSEMINATION && e.relatedId)
        .sort((a, b) => b.date.localeCompare(a.date)); // 新しい順
    if (insems.length === 0) return undefined;
    if (calf.birthDate) {
        const before = insems.find(e => e.date <= calf.birthDate);
        if (before) return before.relatedId;
    }
    return insems[0].relatedId;
};

// --- ホーム画面クイックメモの宛先解析 ---
// 入力例: "44442 発情" -> 耳標44442の母牛へのメモ
//         "44442の子 下痢" -> 母牛44442の直近の子牛へのメモ
export type MemoTarget =
    | { kind: 'COW'; cow: Cow; text: string }
    | { kind: 'CALF'; calf: Calf; cow: Cow; text: string }
    | { kind: 'AMBIGUOUS_COW'; digits: string; matches: Cow[] }
    | { kind: 'NOT_FOUND_COW'; digits: string }
    | { kind: 'NOT_FOUND_CALF'; digits: string; cow: Cow }
    | { kind: 'NO_REFERENCE' };

export const parseMemoTarget = (input: string, cows: Cow[], calves: Calf[]): MemoTarget => {
    const trimmed = input.trim();
    const match = trimmed.match(/^(\d{2,})(の子)?[\s　]*([\s\S]*)$/);
    if (!match) return { kind: 'NO_REFERENCE' };

    const [, digits, calfFlag, rest] = match;
    const matchedCows = cows.filter(c => !c.isRemoved && c.earTag && c.earTag.endsWith(digits));

    if (matchedCows.length === 0) return { kind: 'NOT_FOUND_COW', digits };
    if (matchedCows.length > 1) return { kind: 'AMBIGUOUS_COW', digits, matches: matchedCows };

    const cow = matchedCows[0];
    const text = rest.trim();

    if (calfFlag) {
        const cowCalves = calves
            .filter(c => c.motherId === cow.id && !c.isRemoved)
            .sort((a, b) => (b.birthDate || '').localeCompare(a.birthDate || ''));
        if (cowCalves.length === 0) return { kind: 'NOT_FOUND_CALF', digits, cow };
        return { kind: 'CALF', calf: cowCalves[0], cow, text };
    }

    return { kind: 'COW', cow, text };
};
