import { Cow, BreedingStatus, EventType, Calf } from '../types';
import { addDays, formatDate } from '../utils/breedingService';

const today = new Date();

export const MOCK_COWS: Cow[] = [
  {
    id: '1',
    earTag: '1234567890',
    name: 'はなこ',
    birthDate: '2018-04-12',
    fatherName: '福之姫',
    motherFatherName: '安福久',
    status: BreedingStatus.PREGNANT,
    lastCalvingDate: '2023-05-20',
    lastInseminationDate: '2023-08-15',
    expectedCalvingDate: formatDate(addDays(new Date('2023-08-15'), 285)),
    events: [],
    badges: ['LEADER', 'EASY_BIRTH']
  },
  {
    id: '2',
    earTag: '9876543210',
    name: 'ゆりこ',
    birthDate: '2019-02-28',
    fatherName: '百合白清',
    motherFatherName: '平茂勝',
    status: BreedingStatus.INSEMINATED,
    lastCalvingDate: '2023-10-10',
    lastInseminationDate: formatDate(addDays(today, -20)), // Needs check tomorrow
    events: [],
    badges: []
  },
  {
    id: '3',
    earTag: '1122334455',
    name: 'みつこ',
    birthDate: '2016-11-15',
    fatherName: '美津照重',
    motherFatherName: '北平安',
    status: BreedingStatus.EMPTY,
    lastCalvingDate: formatDate(addDays(today, -80)), // Empty warning!
    events: [],
    badges: ['LEGEND']
  },
  {
    id: '4',
    earTag: '5544332211',
    name: 'よしこ',
    birthDate: '2020-07-07',
    fatherName: '勝忠平',
    motherFatherName: '安福久',
    status: BreedingStatus.CALVING_SOON,
    lastInseminationDate: formatDate(addDays(today, -280)),
    expectedCalvingDate: formatDate(addDays(today, 5)), // Very soon!
    events: [],
    badges: ['CONSISTENT']
  }
];

export const MOCK_CALVES: Calf[] = [
    { id: 'c1', motherId: '3', birthDate: '2022-04-01', sex: 'MALE', price: 850000, grade: 'A5', weight: 320 },
    { id: 'c2', motherId: '3', birthDate: '2021-03-15', sex: 'FEMALE', price: 720000, grade: 'A4', weight: 290 },
    { id: 'c3', motherId: '1', birthDate: '2022-06-10', sex: 'MALE', price: 680000, grade: 'A4', weight: 310 },
];
