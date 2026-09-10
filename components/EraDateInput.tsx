import React, { useState, useEffect } from 'react';

type Era = 'WESTERN' | 'REIWA' | 'HEISEI';

interface EraDateInputProps {
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  label?: string;
  required?: boolean;
  fixedEra?: Era; // 指定時はこの元号に固定し、西暦セレクトとネイティブdate入力(西暦表示)を隠す
}

const ERA_BASE_YEAR: Record<Era, number> = { WESTERN: 0, REIWA: 2018, HEISEI: 1988 };

export const EraDateInput: React.FC<EraDateInputProps> = ({ value, onChange, label, required, fixedEra }) => {
  const [era, setEra] = useState<Era>(fixedEra || 'WESTERN');
  const [rawInput, setRawInput] = useState('');

  // 元号固定時は、OCR結果など外部から渡された値をその元号の表記に変換して表示する
  useEffect(() => {
    if (!fixedEra) return;
    if (!value) { setRawInput(''); return; }
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return;
    const yy = y - ERA_BASE_YEAR[fixedEra];
    setRawInput(`${String(yy).padStart(2, '0')}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`);
  }, [value, fixedEra]);

  const parseRawInput = (input: string, currentEra: Era): string | null => {
    const digits = input.replace(/\D/g, '');
    if (currentEra === 'WESTERN' && digits.length === 8) {
      const y = digits.substring(0, 4);
      const m = digits.substring(4, 6);
      const d = digits.substring(6, 8);
      return `${y}-${m}-${d}`;
    } else if ((currentEra === 'REIWA' || currentEra === 'HEISEI') && digits.length === 6) {
      const yyStr = digits.substring(0, 2);
      const m = digits.substring(2, 4);
      const d = digits.substring(4, 6);
      let year = parseInt(yyStr, 10);
      if (currentEra === 'REIWA') {
        year += 2018; 
      } else if (currentEra === 'HEISEI') {
        year += 1988; 
      }
      return `${year}-${m}-${d}`;
    }
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRawInput(val);
    const parsed = parseRawInput(val, era);
    if (parsed) {
        const d = new Date(parsed);
        if (!isNaN(d.getTime())) {
            onChange(parsed);
        }
    }
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      {label && <label className="text-sm font-semibold text-gray-700">{label}</label>}
      <div className="flex flex-col sm:flex-row gap-2">
        {fixedEra ? (
          <div className="border border-gray-300 rounded px-2 py-2 text-sm bg-gray-50 text-gray-600 max-w-[100px] w-full text-center">
            {fixedEra === 'REIWA' ? '令和' : '平成'}
          </div>
        ) : (
          <select
            className="border border-gray-300 rounded px-2 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-wagyu-500 max-w-[100px] w-full"
            value={era}
            onChange={e => {
              setEra(e.target.value as Era);
              setRawInput('');
            }}
          >
            <option value="WESTERN">西暦</option>
            <option value="REIWA">令和</option>
            <option value="HEISEI">平成</option>
          </select>
        )}

        <div className="flex bg-white border border-gray-300 rounded overflow-hidden flex-1 focus-within:ring-2 focus-within:ring-wagyu-500">
          <input
             type="text"
             className="px-3 py-2 text-sm flex-1 outline-none text-gray-800 placeholder-gray-400"
             placeholder={era === 'WESTERN' ? "略記 (例: 20261008)" : "略記 (例: 051122)"}
             value={rawInput}
             onChange={handleInputChange}
          />
          {!fixedEra && (
            <>
              <div className="w-px bg-gray-200"></div>
              <input
                type="date"
                required={required}
                className="px-2 py-2 text-sm outline-none bg-gray-50 w-[140px] text-gray-700"
                value={value}
                onChange={(e) => {
                  onChange(e.target.value);
                  setRawInput('');
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

