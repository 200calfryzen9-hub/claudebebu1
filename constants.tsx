
import React from 'react';
import { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  targetEmptyDays: 60, // Standard target
  targetCalvingInterval: 365, // One calf per year
  firstInseminationDays: 40,
  alertEmptyDays: 60, // Highlight list red if empty > 60 days
  alertCalvingSoonDays: 30, // Highlight list purple if calving < 30 days
  alertHeiferCalvingSoonDays: 45, // Highlight list pink if heifer calving < 45 days (First time needs more prep)
  estimatedCalfPrice: 750000,
  statusColors: {}, // Default empty, falls back to standard Tailwind classes
  groups: Array.from({length: 10}).map((_, i) => ({ id: `group${i+1}`, name: `グループ${i+1}` })),
  sync: {
      enabled: false,
      familyId: '',
      firebaseConfigString: ''
  },
  defaultCalfTodos: ["初乳給与", "へその消毒", "個体識別耳標装着", "ビタミン剤投与"]
};

export const MOCK_BULLS = [
  "桃白鵬", 
  "白隆鵬", 
  "福晴茂", 
  "孔明桜", 
  "美津白鵬", 
  "桃百合"
];

// Helper to calculate Wagyu gestation (approx)
// Rule: Month - 3, Day + 10 (approx 285 days)
export const GESTATION_DAYS = 285;
export const ESTRUS_CYCLE_DAYS = 21;

// メモ入力時にポップアップから選べる、よくある症状・作業の候補
export const COMMON_MEMO_TAGS = [
  "下痢", "かぜ", "発熱", "せき", "肺炎", "去勢", "アイボメック", "TSV", "バイコックス"
];
