
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, set, onValue } from 'firebase/database';
import type { Database, DataSnapshot } from 'firebase/database';

let db: Database | null = null;
let hasAlertedPermission = false;

// Robust parser for "key: value" strings typical in JS config objects
// This ignores surrounding syntax like "const config = { ... }" and just finds the data
const parseConfigString = (str: string) => {
    // 1. Attempt strict JSON parse first (Best case for pure JSON)
    try {
        return JSON.parse(str);
    } catch (e) {
        // Ignore JSON error, fall back to regex
    }

    // 2. Manual extraction using Regex (Fallback for JS Object literal)
    const config: any = {};
    
    // Looks for: key : "value" or key: 'value'
    // We strictly catch simple keys and quoted values to avoid regex complexity errors
    const regex = /['"]?([a-zA-Z0-9_]+)['"]?\s*:\s*(['"])(.*?)\2/g;
    
    let match;
    let count = 0;
    
    try {
        // Iterate through all matches in the string
        while ((match = regex.exec(str)) !== null) {
            const key = match[1];
            const value = match[3];
            config[key] = value;
            count++;
        }
    } catch (e) {
        console.error("Regex Parsing Error", e);
    }
    
    if (count === 0) {
        console.warn("No config keys found via regex.");
    }

    return config;
};

// Initialize Firebase with the user-provided config string
export const initFirebase = (configStr: string) => {
    try {
        if (!configStr) return false;

        const config = parseConfigString(configStr);

        // Validate config structure - Must have at least apiKey and projectId
        // Some configs might have camelCase or snake_case depending on source, but standard is apiKey
        if (!config || !config.apiKey || !config.projectId) {
            console.error("Invalid Firebase Config structure. Parsed result:", config);
            return false;
        }

        // Initialize Firebase App
        if (getApps().length === 0) {
            const app = initializeApp(config);
            db = getDatabase(app);
            return true;
        } else {
            // Use existing app if already initialized
            const app = getApp();
            db = getDatabase(app);
            return true;
        }
    } catch (e) {
        console.error("Firebase Init Fatal Error:", e);
        return false;
    }
};

export const saveToRemote = (familyId: string, path: string, data: any) => {
    if (!db || !familyId) return;
    const dbRef = ref(db, `families/${familyId}/${path}`);
    
    // Firebase does not accept 'undefined', so we must strip it.
    // JSON.stringify/parse is a safe way to remove undefined keys from objects.
    let cleanData = data;
    try {
        cleanData = JSON.parse(JSON.stringify(data === undefined ? null : data));
    } catch (e) {
        console.error("Data sanitization failed", e);
    }

    set(dbRef, cleanData).catch((err: any) => {
        console.error("Sync Save Error", err);
        // Alert user specifically for permission denied (Rules issue)
        if ((err.code === 'PERMISSION_DENIED' || err.message?.includes('permission_denied')) && !hasAlertedPermission) {
            hasAlertedPermission = true; // Prevent spamming alerts
            alert("【接続エラー】\nFirebaseデータベースへの書き込みが拒否されました。\n\n「設定」タブの「接続トラブルシューティング」を確認し、Firebaseのルールを変更してください。");
        }
    });
};

export const subscribeToRemote = (familyId: string, path: string, callback: (data: any) => void) => {
    if (!db || !familyId) return;
    const dbRef = ref(db, `families/${familyId}/${path}`);
    
    // Using onValue for real-time updates
    return onValue(dbRef, (snapshot: DataSnapshot) => {
        const val = snapshot.val();
        callback(val);
    }, (error) => {
        console.error("Sync Subscribe Error", error);
    });
};
