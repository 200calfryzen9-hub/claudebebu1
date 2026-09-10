// あっせん伝票(せり購入伝票)のOCRテキストから子牛データを抽出するパーサー。
// 罫線入りの帳票はOCRでラベル文字自体が誤読されることが多いため、
// まずラベル近傍を探し、見つからなければ全文からパターンだけで拾うフォールバックを行う。

export interface ParsedReceipt {
  earTag?: string;
  birthDate?: string; // YYYY-MM-DD
  sex?: 'MALE' | 'FEMALE';
  weight?: number;
  price?: number; // 円
  auctionDate?: string; // YYYY-MM-DD
  ageInDays?: number; // せり時点の日齢
  fatherName?: string; // 種雄牛(父)
  motherFatherName?: string; // 母の父
  motherMotherFatherName?: string; // 母の母の父
}

// ラベルの直後(改行含め最大80文字)から最初のパターンを探す。
// OCRはラベルの文字間に空白や改行を挟むことが多いため、ラベル自体も
// 文字間の空白/改行を許容する正規表現にして検索する。
function findAfterLabel(text: string, label: string, pattern: RegExp): string | undefined {
  const loweLabelPattern = label.split('').map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
  const labelMatch = text.match(new RegExp(loweLabelPattern));
  if (!labelMatch || labelMatch.index === undefined) return undefined;
  const windowStart = labelMatch.index + labelMatch[0].length;
  const window = text.slice(windowStart, windowStart + 80);
  const match = window.match(pattern);
  return match ? match[0] : undefined;
}

// 「07.10.28」「2007.10.28」「令和5年11月22日」「R5.11.22」などを YYYY-MM-DD に正規化
function normalizeDate(raw: string): string | undefined {
  const eraMatch = raw.match(/(令和|平成|昭和|R|H|S)\.?(\d{1,2})[年.](\d{1,2})[月.](\d{1,2})日?/);
  if (eraMatch) {
    const eraBase: Record<string, number> = { '令和': 2018, 'R': 2018, '平成': 1988, 'H': 1988, '昭和': 1925, 'S': 1925 };
    const base = eraBase[eraMatch[1]];
    const year = base + parseInt(eraMatch[2], 10);
    const month = eraMatch[3].padStart(2, '0');
    const day = eraMatch[4].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const numMatch = raw.match(/(\d{2,4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (numMatch) {
    let year = parseInt(numMatch[1], 10);
    if (numMatch[1].length === 2) {
      // 2桁年: 00-49→20xx, 50-99→19xx とみなす(せり伝票は主に平成〜令和期のため)
      year = year <= 49 ? 2000 + year : 1900 + year;
    }
    const month = numMatch[2].padStart(2, '0');
    const day = numMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return undefined;
}

// 座席ナンバー(伝票ごとに変わるため固定の番号では探せない)の直後に印字されている
// 数字が日齢なので、「座席」ラベル→数字(座席番号、無視)→次の数字(日齢)という
// 並び順を手がかりに抽出する。
function findAgeAfterSeatNumber(text: string): number | undefined {
  const labelPattern = '座席'.split('').map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
  const labelMatch = text.match(new RegExp(labelPattern));
  if (!labelMatch || labelMatch.index === undefined) return undefined;
  const windowStart = labelMatch.index + labelMatch[0].length;
  const window = text.slice(windowStart, windowStart + 40);
  const twoNums = window.match(/\d{1,4}\D{1,10}(\d{1,4})/);
  return twoNums ? parseInt(twoNums[1], 10) : undefined;
}

// 血統(父・母の父・母の母の父)は「都城農業協同組合」という組合名の直前(印字上は上側)に
// 番号(ない場合もある)→その上に種雄牛名が3つ並ぶ、という伝票の書式上の並びを手がかりに
// 自動認識する。上から 種雄牛(父) → 母の父 → 母の母の父 の順。
function extractPedigree(text: string): { fatherName?: string; motherFatherName?: string; motherMotherFatherName?: string } {
  const orgLabel = '都城農業協同組合';
  const idx = text.indexOf(orgLabel);
  if (idx === -1) return {};

  const windowText = text.slice(Math.max(0, idx - 200), idx);
  const lines = windowText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return {};

  let cursor = lines.length - 1;
  // 直前の行が番号だけ(全角数字も含む)なら、それは種雄牛名ではないので読み飛ばす
  if (/^[0-9０-９]+$/.test(lines[cursor])) cursor--;

  const names = lines.slice(Math.max(0, cursor - 2), cursor + 1);
  const [fatherName, motherFatherName, motherMotherFatherName] = names;
  return { fatherName, motherFatherName, motherMotherFatherName };
}

const EAR_TAG_PATTERN = /\d{4,5}[-‐ー]\d{3,4}[-‐ー]\d/;
// OCRでカンマが句点やピリオドに誤読され、しかも複数個並ぶことがあるため区切りは1文字以上許容する
const PRICE_PATTERN = /\d{2,3}[,.。\s]+\d{3}/;
const SLASH_DATE_PATTERN = /\d{2}[/／]\d{2}[/／]\d{2}/;
const DOT_DATE_PATTERN = /\d{2}[.。]\d{2}[.。]\d{2}/;
const ERA_DATE_PATTERN = /(令和|平成|昭和|R|H|S)\.?\d{1,2}[年.]\d{1,2}[月.]\d{1,2}日?/;

// 数字だけの日付(08/08/17, 07.10.28 等)は年を必ず2桁に限定する。
// \d{1,4} のように桁数を広げると、伝票内の隣接する無関係な数字
// (座席番号や日齢など)まで年として拾ってしまうため。
export function parseAssenReceipt(text: string): ParsedReceipt {
  const result: ParsedReceipt = {};

  const earTagRaw = findAfterLabel(text, '耳標番号', EAR_TAG_PATTERN) || text.match(EAR_TAG_PATTERN)?.[0];
  if (earTagRaw) {
    // アプリ内の既存データはハイフンなしの数字のみで保存されているため合わせる
    result.earTag = earTagRaw.replace(/\D/g, '');
  }

  // 開催日はスラッシュ区切り(例 08/08/17)、生年月日はドット区切り(例 07.10.28)という
  // 伝票側の書式差を手がかりに区別する
  const auctionDateRaw = findAfterLabel(text, '開催日', SLASH_DATE_PATTERN) || text.match(SLASH_DATE_PATTERN)?.[0];
  if (auctionDateRaw) {
    result.auctionDate = normalizeDate(auctionDateRaw);
  }

  const birthDateRaw = findAfterLabel(text, '生年月日', ERA_DATE_PATTERN)
    || findAfterLabel(text, '生年月日', DOT_DATE_PATTERN)
    || text.match(ERA_DATE_PATTERN)?.[0]
    || text.match(DOT_DATE_PATTERN)?.[0];
  if (birthDateRaw) {
    result.birthDate = normalizeDate(birthDateRaw);
  }

  // 性別欄: 「牡」はオス、「去」は去勢(=オス/去勢としてMALE扱い)、「牝」はメス。
  // 「去」は「消去」等の単漢字として誤検出しやすいため、まず「性別」ラベル直後を優先して探し、
  // ラベルが見つからない場合のみ全文フォールバックで「去勢」(2文字)に限定して拾う。
  const sexRaw = findAfterLabel(text, '性別', /[牡牝去]/);
  if (sexRaw === '牡' || sexRaw === '去') {
    result.sex = 'MALE';
  } else if (sexRaw === '牝') {
    result.sex = 'FEMALE';
  } else if (/牡/.test(text) || /去勢/.test(text)) {
    result.sex = 'MALE';
  } else if (/牝/.test(text)) {
    result.sex = 'FEMALE';
  }

  const weightRaw = findAfterLabel(text, '体重', /\d{2,3}/);
  if (weightRaw) {
    result.weight = parseInt(weightRaw, 10);
  }

  const priceRaw = findAfterLabel(text, 'せり価格', PRICE_PATTERN) || text.match(PRICE_PATTERN)?.[0];
  if (priceRaw) {
    const num = parseInt(priceRaw.replace(/[,.。\s]/g, ''), 10);
    if (!isNaN(num)) result.price = num;
  }

  result.ageInDays = findAgeAfterSeatNumber(text);

  Object.assign(result, extractPedigree(text));

  return result;
}
