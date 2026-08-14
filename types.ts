
export enum BreedingStatus {
  EMPTY = 'EMPTY', // 空胎
  INSEMINATED = 'INSEMINATED', // 種付済 (±)
  PREGNANT = 'PREGNANT', // 妊娠確定 (+)
  CALVING_SOON = 'CALVING_SOON', // 分娩間近
  RECOVERY = 'RECOVERY', // 分娩後休養
}

export enum EventType {
  INSEMINATION = 'INSEMINATION', // 種付け
  PREG_CHECK = 'PREG_CHECK', // 妊娠鑑定
  CALVING = 'CALVING', // 分娩
  ESTRUS = 'ESTRUS', // 発情発見
  WEANING = 'WEANING', // 離乳
  TREATMENT = 'TREATMENT', // 治療
  CIDR_INSERTION = 'CIDR_INSERTION', // トンボ挿入
  CIDR_REMOVAL = 'CIDR_REMOVAL', // トンボ除去
  PG_INJECTION = 'PG_INJECTION', // PG注射
  NOTE = 'NOTE', // メモ
}

export interface BreedingEvent {
  id: string;
  cowId: string;
  type: EventType;
  date: string; // YYYY-MM-DD
  details: string;
  relatedId?: string; // Bull name or Calf ID
  metadata?: any; // Extra data like "Easy birth", "Difficult birth", "plannedRemovalDate", "pregResult"
}

export interface GeneralEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: 'MEETING' | 'TASK' | 'OTHER';
  color: string;
}

export interface CalendarEvent {
  date: string;
  title: string;
  type: string;
  color: string;
  cowId?: string;
}

export interface Note {
  id: string;
  date: string; // YYYY-MM-DD or ISO
  text: string;
  isTodo?: boolean;
  isDone?: boolean;
}

export interface Calf {
  id: string;
  motherId?: string; // Made optional for standalone calf
  earTag?: string; 
  name?: string;
  birthDate: string;
  sex: 'MALE' | 'FEMALE';
  fatherName?: string; 
  price?: number;
  weight?: number;
  grade?: string; 
  bms?: number; 
  auctionDate?: string; // Existing, can be used for "せり月"
  notes?: Note[]; // Added memo field
  isRemoved?: boolean; // 抹消（アーカイブ）フラグ
}

export interface Cow {
  id: string;
  earTag: string; // 10 digit full, but usually use last 5
  name: string;
  birthDate: string;
  fatherName: string;
  motherFatherName: string;
  motherId?: string;
  status: BreedingStatus;
  lastCalvingDate?: string;
  lastInseminationDate?: string;
  expectedCalvingDate?: string;
  events: BreedingEvent[];
  badges: string[]; // "Legend", "Consistent", etc.
  isRemoved?: boolean; // 抹消牛フラグ
  notes?: Note[]; // Added memo field
  groupId?: string; // グループ(部屋)ID
}

export interface CowGroup {
  id: string;
  name: string;
}

export interface SyncSettings {
    enabled: boolean;
    familyId: string; // Shared ID between husband and wife
    firebaseConfigString: string; // Raw JSON string from Firebase Console
}

export type StatusColors = {
  [key in BreedingStatus]?: string;
};

export interface Settings {
  targetEmptyDays: number;
  targetCalvingInterval: number;
  firstInseminationDays: number;
  // Visual Alert Thresholds
  alertEmptyDays: number; // Highlight RED if empty days > this
  alertCalvingSoonDays: number; // Highlight PURPLE if calving within this days
  alertHeiferCalvingSoonDays?: number; // Highlight PINK if heifer (first time) calving within this days
  sync: SyncSettings;
  defaultCalfTodos?: string[]; // Todo list to be automatically added to new calves
  estimatedCalfPrice?: number; // Estimated average calf auction price
  statusColors?: StatusColors; // Custom background colors for statuses
  groups?: CowGroup[]; // Group settings
}

export interface DashboardAlert {
  id: string;
  cowId: string;
  cowName: string;
  type: 'WARNING' | 'INFO' | 'SUCCESS' | 'URGENT';
  message: string;
  date: string;
  daysDiff: number; // e.g., "5 days overdue" or "in 3 days"
}
