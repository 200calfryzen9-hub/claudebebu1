import React, { useState } from 'react';
import { Camera, X, Loader2, ScanLine, AlertTriangle, ClipboardPaste } from 'lucide-react';
import { Calf } from '../types';
import { parseAssenReceipt, ParsedReceipt } from '../utils/receiptParser';
import { EraDateInput } from './EraDateInput';

interface ReceiptScannerProps {
    onExtract: (data: Partial<Calf>) => void;
    onClose: () => void;
}

type Phase = 'idle' | 'paste' | 'recognizing' | 'review' | 'error';

// 写真の暗い背景(机など)を切り落とし、伝票(明るい紙面)の外接矩形だけを残す。
// 背景が写り込んだままだとOCRのレイアウト解析が崩れるため、二値化の前に行う。
function cropToDocument(bitmap: ImageBitmap): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = bitmap.width;
    sampleCanvas.height = bitmap.height;
    const sampleCtx = sampleCanvas.getContext('2d')!;
    sampleCtx.drawImage(bitmap, 0, 0);
    const { data } = sampleCtx.getImageData(0, 0, bitmap.width, bitmap.height);

    const rowBright = new Float64Array(bitmap.height);
    const colBright = new Float64Array(bitmap.width);
    for (let y = 0; y < bitmap.height; y++) {
        for (let x = 0; x < bitmap.width; x++) {
            const idx = (y * bitmap.width + x) * 4;
            const g = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
            rowBright[y] += g;
            colBright[x] += g;
        }
    }
    for (let y = 0; y < bitmap.height; y++) rowBright[y] /= bitmap.width;
    for (let x = 0; x < bitmap.width; x++) colBright[x] /= bitmap.height;

    // 紙面(明るい)と背景(暗い)の境目を、全体平均の中間くらいの明るさで判定する
    const overallAvg = (rowBright.reduce((a, b) => a + b, 0)) / bitmap.height;
    const brightThreshold = overallAvg * 0.7;

    let top = 0, bottom = bitmap.height - 1, left = 0, right = bitmap.width - 1;
    while (top < bottom && rowBright[top] < brightThreshold) top++;
    while (bottom > top && rowBright[bottom] < brightThreshold) bottom--;
    while (left < right && colBright[left] < brightThreshold) left++;
    while (right > left && colBright[right] < brightThreshold) right--;

    // 検出があまりに小さければ誤検出とみなし、クロップせず全体を使う
    const cropW = right - left;
    const cropH = bottom - top;
    if (cropW < bitmap.width * 0.3 || cropH < bitmap.height * 0.3) {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bitmap, 0, 0);
        return { canvas, ctx };
    }

    const margin = Math.round(Math.min(cropW, cropH) * 0.02);
    const cropX = Math.max(0, left - margin);
    const cropY = Math.max(0, top - margin);
    const finalW = Math.min(bitmap.width, right + margin) - cropX;
    const finalH = Math.min(bitmap.height, bottom + margin) - cropY;

    const canvas = document.createElement('canvas');
    canvas.width = finalW;
    canvas.height = finalH;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, cropX, cropY, finalW, finalH, 0, 0, finalW, finalH);
    return { canvas, ctx };
}

// 背景(机など)をおおまかに切り落として伝票の外接矩形に寄せ、
// OCRエンジンが扱いやすい幅(~1600px)にリサイズする。
// 二値化までやると照明ムラや傾きで紙面が潰れることがあったため、ここでは行わない。
async function preprocessForOcr(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const cropped = cropToDocument(bitmap);
    const croppedBitmap = await createImageBitmap(cropped.canvas);

    const targetWidth = 1600;
    const scale = croppedBitmap.width > targetWidth ? targetWidth / croppedBitmap.width : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(croppedBitmap.width * scale);
    canvas.height = Math.round(croppedBitmap.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(croppedBitmap, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92));
}

export const ReceiptScanner: React.FC<ReceiptScannerProps> = ({ onExtract, onClose }) => {
    const [phase, setPhase] = useState<Phase>('idle');
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState('');
    const [parsed, setParsed] = useState<ParsedReceipt>({});
    const [pastedText, setPastedText] = useState('');
    // 血統(父・母の父・母の母の父)は伝票のレイアウト上自動抽出が困難なため、常に手入力欄として用意する
    const [fatherName, setFatherName] = useState('');
    const [motherFatherName, setMotherFatherName] = useState('');
    const [motherMotherFatherName, setMotherMotherFatherName] = useState('');

    const handlePasteAnalyze = () => {
        setParsed(parseAssenReceipt(pastedText));
        setPhase('review');
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImageUrl(URL.createObjectURL(file));
        setPhase('recognizing');
        setProgress(0);
        setErrorMessage('');

        try {
            const processedBlob = await preprocessForOcr(file);
            const { createWorker, PSM } = await import('tesseract.js');
            const worker = await createWorker('jpn', 1, {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        setProgress(Math.round(m.progress * 100));
                    }
                },
            });
            await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
            const { data: { text } } = await worker.recognize(processedBlob);
            await worker.terminate();

            setParsed(parseAssenReceipt(text));
            setPhase('review');
        } catch (err) {
            console.error('OCR failed:', err);
            setErrorMessage('文字の読み取りに失敗しました。手動で入力してください。');
            setPhase('error');
        }
    };

    const handleConfirm = () => {
        const data: Partial<Calf> = {};
        if (parsed.earTag) data.earTag = parsed.earTag;
        if (parsed.birthDate) data.birthDate = parsed.birthDate;
        if (parsed.sex) data.sex = parsed.sex;
        if (parsed.weight !== undefined) data.weight = parsed.weight;
        if (parsed.price !== undefined) data.price = parsed.price;
        if (parsed.auctionDate) data.auctionDate = parsed.auctionDate;
        if (fatherName) data.fatherName = fatherName;
        if (motherFatherName) data.motherFatherName = motherFatherName;
        if (motherMotherFatherName) data.motherMotherFatherName = motherMotherFatherName;
        onExtract(data);
        onClose();
    };

    const reset = () => {
        setImageUrl(null);
        setParsed({});
        setPastedText('');
        setFatherName('');
        setMotherFatherName('');
        setMotherMotherFatherName('');
        setErrorMessage('');
        setPhase('idle');
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <ScanLine size={20} className="text-wagyu-600" />
                        伝票をスキャン
                    </h3>
                    <button onClick={onClose} className="p-1 -mr-1 text-gray-400 hover:text-gray-600">
                        <X size={22} />
                    </button>
                </div>

                <div className="p-5">
                    {phase === 'idle' && (
                        <div className="text-center space-y-5">
                            <div>
                                <p className="text-sm text-gray-700 font-bold mb-1">① テキストを貼り付け(おすすめ・高精度)</p>
                                <p className="text-xs text-gray-500 mb-3">
                                    iPhoneの「写真」アプリで伝票を撮影→表示中に画面右下のスキャンアイコン(または長押し)から「テキストを選択」→「すべてをコピー」した内容をここに貼り付けてください。
                                </p>
                                <button
                                    onClick={() => setPhase('paste')}
                                    className="w-full bg-wagyu-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
                                >
                                    <ClipboardPaste size={20} />
                                    テキストを貼り付ける
                                </button>
                            </div>

                            <div className="border-t border-gray-100 pt-5">
                                <p className="text-sm text-gray-700 font-bold mb-1">② 写真から自動認識(簡易)</p>
                                <p className="text-xs text-gray-500 mb-3">
                                    ブラウザ内蔵OCRで読み取ります。①より精度は落ちますが、コピー操作なしで試せます。
                                </p>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <button className="w-full border border-gray-300 text-gray-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 pointer-events-none">
                                        <Camera size={20} />
                                        伝票を撮影 / 選択
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {phase === 'paste' && (
                        <div className="space-y-3">
                            <p className="text-xs text-gray-500">
                                Live Textなどで伝票からコピーしたテキストをそのまま貼り付けてください。改行や順序が崩れていても解析します。
                            </p>
                            <textarea
                                className="w-full p-2 border rounded-lg h-40 text-sm"
                                placeholder="ここに貼り付け"
                                value={pastedText}
                                onChange={(e) => setPastedText(e.target.value)}
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button onClick={reset} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl">
                                    戻る
                                </button>
                                <button
                                    onClick={handlePasteAnalyze}
                                    disabled={!pastedText.trim()}
                                    className="flex-1 bg-wagyu-600 text-white font-bold py-3 rounded-xl shadow-md disabled:opacity-40"
                                >
                                    解析する
                                </button>
                            </div>
                        </div>
                    )}

                    {phase === 'recognizing' && (
                        <div className="text-center py-6">
                            {imageUrl && (
                                <img src={imageUrl} alt="伝票プレビュー" className="w-full max-h-48 object-contain rounded-lg mb-4 border border-gray-100" />
                            )}
                            <Loader2 size={32} className="animate-spin text-wagyu-600 mx-auto mb-3" />
                            <p className="text-sm text-gray-500">文字を読み取っています... {progress}%</p>
                        </div>
                    )}

                    {phase === 'error' && (
                        <div className="text-center py-4">
                            <div className="w-14 h-14 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                <AlertTriangle size={26} />
                            </div>
                            <p className="text-sm text-gray-600 mb-4">{errorMessage}</p>
                            <button onClick={reset} className="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-xl">
                                もう一度試す
                            </button>
                        </div>
                    )}

                    {phase === 'review' && (
                        <div className="space-y-4">
                            {imageUrl && (
                                <img src={imageUrl} alt="伝票プレビュー" className="w-full max-h-40 object-contain rounded-lg border border-gray-100" />
                            )}
                            <p className="text-xs text-gray-400">読み取り結果を確認・修正してから反映してください。空欄の項目は読み取れませんでした。</p>

                            <div>
                                <label className="text-xs text-gray-500 block mb-1">個体識別番号</label>
                                <input
                                    className="w-full p-2 border rounded-lg"
                                    inputMode="numeric"
                                    value={parsed.earTag || ''}
                                    onChange={(e) => setParsed({ ...parsed, earTag: e.target.value })}
                                />
                            </div>

                            <EraDateInput
                                label="生年月日"
                                value={parsed.birthDate || ''}
                                onChange={(val) => setParsed({ ...parsed, birthDate: val })}
                            />

                            <div>
                                <label className="text-xs text-gray-500 block mb-1">性別</label>
                                <select
                                    className="w-full p-2 border rounded-lg"
                                    value={parsed.sex || ''}
                                    onChange={(e) => setParsed({ ...parsed, sex: (e.target.value || undefined) as 'MALE' | 'FEMALE' | undefined })}
                                >
                                    <option value="">不明</option>
                                    <option value="MALE">オス/去勢</option>
                                    <option value="FEMALE">メス</option>
                                </select>
                            </div>

                            <EraDateInput
                                label="開催日(せり月)"
                                value={parsed.auctionDate || ''}
                                onChange={(val) => setParsed({ ...parsed, auctionDate: val })}
                            />

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">せり価格 (円)</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 border rounded-lg"
                                        value={parsed.price ?? ''}
                                        onChange={(e) => setParsed({ ...parsed, price: e.target.value ? Number(e.target.value) : undefined })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">体重 (kg)</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 border rounded-lg"
                                        value={parsed.weight ?? ''}
                                        onChange={(e) => setParsed({ ...parsed, weight: e.target.value ? Number(e.target.value) : undefined })}
                                    />
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-3">
                                <p className="text-xs text-gray-400 mb-2">血統は自動読み取りに対応していません。伝票を見ながら入力してください。</p>
                                <div className="space-y-2">
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">種雄牛(父)</label>
                                        <input
                                            className="w-full p-2 border rounded-lg"
                                            list="bull-candidates"
                                            value={fatherName}
                                            onChange={(e) => setFatherName(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">母の父</label>
                                        <input
                                            className="w-full p-2 border rounded-lg"
                                            list="bull-candidates"
                                            value={motherFatherName}
                                            onChange={(e) => setMotherFatherName(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">母の母の父</label>
                                        <input
                                            className="w-full p-2 border rounded-lg"
                                            list="bull-candidates"
                                            value={motherMotherFatherName}
                                            onChange={(e) => setMotherMotherFatherName(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button onClick={reset} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl">
                                    やり直す
                                </button>
                                <button onClick={handleConfirm} className="flex-1 bg-wagyu-600 text-white font-bold py-3 rounded-xl shadow-md">
                                    反映する
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
