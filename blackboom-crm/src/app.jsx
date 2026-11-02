import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, fetchSignInMethodsForEmail, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, setDoc, getDocs, getDoc, orderBy, limit, writeBatch, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

const ADMIN_EMAIL = "support@blackbookcrm.org"; 
const FIREBASE_EMAIL_URL = "https://us-central1-barbertemp-7640a.cloudfunctions.net/sendInvite";
// Optional: configure your PayPal checkout base URL here (e.g. hosted PayPal checkout or your PayPal server handler)
// Example: window.PAYPAL_CHECKOUT_URL = 'https://www.paypal.com/checkoutnow?token=';
window.PAYPAL_CHECKOUT_URL = window.PAYPAL_CHECKOUT_URL || '';

const firebaseConfig = {
    apiKey: "AIzaSyCfFAPxSoYrF2S_I-UrBHUELNuvKJ2JV1M",
    authDomain: "barbertemp-7640a.firebaseapp.com",
    projectId: "barbertemp-7640a",
    storageBucket: "barbertemp-7640a.firebasestorage.app",
    messagingSenderId: "1039105271688",
    appId: "1:1039105271688:web:3be2346a70f3ec9d513c3d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const { useState, useEffect, useRef, useMemo } = React;

// --- Image resize helper: returns a Blob resized to maxDimension while preserving aspect ratio
async function resizeImageFile(file, maxDimension = 1200, quality = 0.8) {
    if (!file || !(file instanceof File)) return file;
    try {
        const img = await new Promise((res, rej) => {
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = rej;
            i.src = URL.createObjectURL(file);
        });
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width <= maxDimension && height <= maxDimension) {
            URL.revokeObjectURL(img.src);
            return file;
        }
        const ratio = width / height;
        if (ratio > 1) {
            width = maxDimension; height = Math.round(maxDimension / ratio);
        } else {
            height = maxDimension; width = Math.round(maxDimension * ratio);
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
        URL.revokeObjectURL(img.src);
        return blob instanceof Blob ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }) : file;
    } catch (e) {
        return file;
    }
}

// ICONS
const Scissors = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg>;
const Check = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const XIcon = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
const LogOut = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>;
const CalendarIcon = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>;
const DollarSign = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const ChevronLeft = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>;
const ChevronRight = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
const Users = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const Eye = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>;
const MessageIcon = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>;
const Send = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const Megaphone = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>;
const Crown = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
const SettingsIcon = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
const Spinner = () => <svg aria-hidden="true" focusable="false" className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;
const ListIcon = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
const EditIcon = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const TrashIcon = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
const ShopIcon = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
const PinIcon = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>;
const ClockIcon = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>;
const PlusIcon = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>;
const UserIcon = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
const SupportIcon = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>;

// --- TOAST / NOTIFICATION BUS ---
const toastBus = new EventTarget();
function showToast(message, type = 'info', timeout = 4000) {
    toastBus.dispatchEvent(new CustomEvent('toast', { detail: { message, type, timeout } }));
}

function Toasts() {
    const [toasts, setToasts] = useState([]);
    useEffect(() => {
        const handler = (e) => {
            const t = { id: Date.now() + Math.random(), ...e.detail };
            setToasts((s) => [t, ...s]);
            setTimeout(() => setToasts((s) => s.filter(x => x.id !== t.id)), e.detail.timeout || 4000);
        };
        toastBus.addEventListener('toast', handler);
        return () => toastBus.removeEventListener('toast', handler);
    }, []);

    return (
        <div aria-live="polite" className="fixed z-[9999] top-[calc(env(safe-area-inset-top)+12px)] left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 flex flex-col gap-2 w-[calc(100%-32px)] max-w-sm pointer-events-none">
            {toasts.map(t => (
                <div key={t.id} role={t.type === 'error' ? 'alert' : 'status'} className="toast pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 shadow-[0_12px_32px_rgba(0,0,0,0.6)] text-sm text-white">
                    <span aria-hidden="true" className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${t.type === 'error' ? 'bg-red-500' : t.type === 'success' ? 'bg-green-500' : 'bg-gold'}`} />
                    <span>{t.message}</span>
                </div>
            ))}
        </div>
    );
}

// --- CONFIRM / MODAL BUS ---
const confirmBus = new EventTarget();
function showConfirm({ title = 'Confirm', message = 'Are you sure?' } = {}) {
    return new Promise((resolve) => {
        confirmBus.dispatchEvent(new CustomEvent('confirm', { detail: { id: Date.now() + Math.random(), title, message, resolve } }));
    });
}

function ConfirmModal() {
    const [queue, setQueue] = useState([]);
    useEffect(() => {
        const handler = (e) => {
            setQueue((q) => [e.detail, ...q]);
        };
        confirmBus.addEventListener('confirm', handler);
        return () => confirmBus.removeEventListener('confirm', handler);
    }, []);

    const cur = queue[0];
    if(!cur) return null;

    const respond = (val) => {
        try { cur.resolve(val); } catch(e){}
        setQueue((q) => q.filter(x => x.id !== cur.id));
    };

    // The button says exactly what happens ("Delete client"), and destructive actions are oxblood
    const text = (cur.message || '').trim();
    const short = text.replace(/\?$/, '');
    const danger = cur.title === 'Danger' || /^(delete|cancel|remove)\b/i.test(short);
    const confirmLabel = short.length <= 28 && !/[.:]/.test(short) ? short : 'Confirm';
    const heading = cur.title && !['Confirm', 'Danger'].includes(cur.title) ? cur.title : (confirmLabel === short ? `${short}?` : 'Are you sure?');
    const body = heading === `${short}?` ? null : text;

    return (
        <div className="bb-overlay" style={{ zIndex: 9999 }} onMouseDown={(e) => { if (e.target === e.currentTarget) respond(false); }}>
            <div role="alertdialog" aria-modal="true" aria-label={heading} className="bb-sheet sm:!max-w-sm">
                <h3 className="text-2xl text-white">{heading}</h3>
                {body && <p className="text-zinc-400 mt-2">{body}</p>}
                {danger && !body && <p className="text-zinc-400 mt-2">This can't be undone.</p>}
                <div className="mt-6 flex gap-2">
                    <button onClick={() => respond(false)} className="btn btn-secondary flex-1">Go back</button>
                    <button autoFocus onClick={() => respond(true)} className={`btn flex-1 ${danger ? 'bg-oxblood text-white hover:bg-red-600' : 'btn-primary'}`}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
}

// --- SHEET: the one pop-up frame. Bottom sheet on phones, dialog from 640px. Esc or tap outside closes. ---
function Sheet({ title, onClose, children, footer, wide = false }) {
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') closeRef.current && closeRef.current(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
    return (
        <div className="bb-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div role="dialog" aria-modal="true" aria-label={title} className={`bb-sheet ${wide ? 'sm:!max-w-2xl' : ''}`}>
                <div className="flex items-start justify-between gap-4 mb-5">
                    <h3 className="text-[28px] text-white">{title}</h3>
                    <button onClick={onClose} aria-label="Close" className="icon-btn -mr-2 -mt-1 shrink-0"><XIcon /></button>
                </div>
                {children}
                {footer && <div className="mt-6 flex gap-2">{footer}</div>}
            </div>
        </div>
    );
}

const Field = ({ label, hint, children, className = '' }) => (
    <label className={`block ${className}`}>
        <span className="field-label">{label}</span>
        {children}
        {hint && <span className="block text-xs text-zinc-500 mt-1.5">{hint}</span>}
    </label>
);
const inputCls = "w-full h-11 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-[15px]";
const areaCls = "w-full px-3 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-[15px]";

// --- ERROR BOUNDARY: one broken screen shouldn't blank the whole app ---
class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error, info) { console.error('UI crashed', error, info); }
    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-6">
                <div role="alert" className="max-w-sm w-full bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                    <h2 className="text-white font-bold text-lg mb-2">Something went wrong</h2>
                    <p className="text-zinc-400 text-sm mb-5">This screen hit an error. Reloading usually fixes it. If it keeps happening, email support@blackbookcrm.org.</p>
                    <button onClick={() => window.location.reload()} className="w-full py-3 bg-gold text-black rounded font-bold uppercase text-sm">Reload</button>
                </div>
            </div>
        );
    }
}

const getConversationId = (uid1, uid2) => { return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`; }
const formatTime = (isoString) => { if(!isoString) return ""; const date = new Date(isoString); return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }

        // Convert "HH:MM" (24h) to 12-hour format with am/pm
        const formatHM = (hhmm) => {
            if(!hhmm) return "";
            const [hStr, mStr] = hhmm.split(':');
            if(hStr === undefined || mStr === undefined) return hhmm;
            let h = parseInt(hStr, 10);
            const m = mStr.padStart(2, '0');
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12;
            if (h === 0) h = 12;
            // Compact: no space to keep single-line in tight UI
            return `${h}:${m}${ampm}`;
        }

        // Format minutes into human readable string like "1h 30m" or "45m"
        const formatDuration = (mins) => {
            if (typeof mins !== 'number' || isNaN(mins) || mins <= 0) return '0m';
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            if (h > 0 && m > 0) return `${h}h ${m}m`;
            if (h > 0) return `${h}h`;
            return `${m}m`;
        }

        // --- PST helpers ---
        const getNowPST = () => {
            const now = new Date();
            const pstStr = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
            return new Date(pstStr);
        };

        const parseDateTimePST = (dateStr, timeStr) => {
            if(!dateStr) return null;
            const t = timeStr || '00:00';
            // Build local Date from PST-represented wall time
            const localLike = new Date(`${dateStr}T${t}`);
            const pstLike = new Date(localLike.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
            return pstLike;
        };

        const parseDatePST = (dateStr) => {
            if(!dateStr) return null;
            const localLike = new Date(`${dateStr}T00:00:00`);
            return new Date(localLike.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
        };

        const getTodayPSTString = () => {
            return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
        };

// --- SUPPORT MODAL (FIXED PREVIEW) ---
function SupportModal({ user, onClose }) {
    const [view, setView] = useState('list');
    const [tickets, setTickets] = useState([]);
    const [subject, setSubject] = useState("");
    const [description, setDescription] = useState("");
    const [activeTicket, setActiveTicket] = useState(null);
    const [replyText, setReplyText] = useState("");

    useEffect(() => {
        const q = query(collection(db, "tickets"), where("userId", "==", user.uid));
        const unsub = onSnapshot(q, (snapshot) => {
            const t = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            t.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
            setTickets(t);
        });
        return () => unsub();
    }, [user.uid]);

    const createTicket = async (e) => {
        e.preventDefault();
        if(!subject || !description) return;
        await addDoc(collection(db, "tickets"), {
            userId: user.uid,
            userEmail: user.email,
            userName: user.firstName || "Unknown",
            subject,
            description,
            status: 'open',
            createdAt: new Date().toISOString(),
            messages: [{
                sender: 'user',
                text: description,
                time: new Date().toISOString()
            }]
        });
        setView('list'); setSubject(""); setDescription("");
    };

    // Read the ticket from the live list, so replies build on the latest messages, not a stale copy
    const liveTicket = activeTicket ? (tickets.find(t => t.id === activeTicket.id) || activeTicket) : null;

    const sendReply = async (e) => {
        e.preventDefault();
        if(!replyText || !liveTicket) return;
        const newMsg = { sender: 'user', text: replyText, time: new Date().toISOString() };
        const updatedMessages = [...(liveTicket.messages || []), newMsg];
        await updateDoc(doc(db, "tickets", liveTicket.id), { messages: updatedMessages });
        setReplyText("");
    };

    const headTitle = view === 'new' ? 'New question' : view === 'detail' && liveTicket ? liveTicket.subject : 'Help';
    const goBack = () => { if (view === 'list') onClose(); else { setView('list'); setActiveTicket(null); } };

    return (
        <div className="bb-sidepanel" role="dialog" aria-modal="true" aria-label="Help and support">
            <div className="bb-panel-head">
                <button onClick={goBack} aria-label={view === 'list' ? 'Close help' : 'Back to your questions'} className="icon-btn"><ChevronLeft /></button>
                <h2 className="flex-1 min-w-0 truncate text-2xl text-white">{headTitle}</h2>
                {view !== 'list' && <button onClick={onClose} aria-label="Close help" className="icon-btn"><XIcon /></button>}
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col">
                {view === 'list' && (
                    <div className="space-y-5 fade-in">
                        <div className="panel p-4">
                            <p className="text-white font-semibold">Ask us anything</p>
                            <p className="text-sm text-zinc-400 mt-1">We answer within a day. You can also email <a href="mailto:support@blackbookcrm.org" className="text-gold underline underline-offset-2">support@blackbookcrm.org</a>.</p>
                            <button onClick={() => setView('new')} className="btn btn-primary w-full mt-4">Ask a question</button>
                        </div>
                        {tickets.length > 0 && (
                            <div>
                                <h3 className="text-xl text-white mb-2">Your questions</h3>
                                <div className="ledger">
                                    {tickets.map(t => {
                                        const lastMessage = t.messages && t.messages.length > 0 ? t.messages[t.messages.length - 1] : null;
                                        const previewText = lastMessage ? (lastMessage.sender === 'admin' ? `BlackBook: ${lastMessage.text}` : `You: ${lastMessage.text}`) : t.description;
                                        return (
                                            <button key={t.id} onClick={() => { setActiveTicket(t); setView('detail'); }} className="ledger-row !items-start">
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-white font-semibold truncate">{t.subject}</span>
                                                    <span className="block text-sm text-zinc-400 truncate">{previewText}</span>
                                                </span>
                                                <span className={`chip !h-5 !px-2 shrink-0 ${t.status === 'replied' ? 'chip-gold' : ''}`}>{t.status === 'replied' ? 'Answered' : t.status === 'closed' ? 'Closed' : 'Waiting'}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {view === 'new' && (
                    <form onSubmit={createTicket} className="space-y-4 fade-in">
                        <Field label="What's it about?"><input className={inputCls} placeholder="Can't change my booking" value={subject} onChange={e => setSubject(e.target.value)} required /></Field>
                        <Field label="Tell us more" hint="What you tried and what happened"><textarea rows={6} className={areaCls} value={description} onChange={e => setDescription(e.target.value)} required /></Field>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setView('list')} className="btn btn-secondary flex-1">Cancel</button>
                            <button type="submit" disabled={!subject || !description} className="btn btn-primary flex-1">Send question</button>
                        </div>
                    </form>
                )}

                {view === 'detail' && liveTicket && (
                    <div className="flex flex-col flex-1 min-h-0 fade-in">
                        <div className="flex-1 space-y-2">
                            {(liveTicket.messages || []).map((m, i) => (
                                <div key={i} className={`max-w-[85%] px-3.5 py-2.5 text-[15px] ${m.sender === 'user' ? 'chat-bubble-me ml-auto' : 'chat-bubble-them'}`}>
                                    <p>{m.text}</p>
                                    <span className="block text-xs opacity-60 mt-1">{m.sender === 'user' ? 'You' : 'BlackBook'}, {formatTime(m.time)}</span>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={sendReply} className="flex gap-2 pt-4 sticky bottom-0 bg-black">
                            <input className={`${inputCls} flex-1`} placeholder="Write a reply" aria-label="Reply" value={replyText} onChange={e => setReplyText(e.target.value)} />
                            <button type="submit" aria-label="Send reply" disabled={!replyText} className="btn btn-primary !px-3.5"><Send /></button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- CHAT WINDOW ---
function ChatWindow({ currentUser, chatPartnerUid, chatPartnerName, onClose }) {
    const [chatPartnerPhoto, setChatPartnerPhoto] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [isPartnerTyping, setIsPartnerTyping] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const [sendOnEnter, setSendOnEnter] = useState(true);
    const [showEmoji, setShowEmoji] = useState(false);
    const bottomRef = useRef(null);
    const typingTimerRef = useRef(null);
    const conversationId = getConversationId(currentUser.uid, chatPartnerUid);

    // listen for messages (limited to recent for perf)
    useEffect(() => {
        const q = query(collection(db, "messages"), where("conversationId", "==", conversationId), orderBy('createdAt'));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            setMessages(msgs);
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            const unreadMsgs = snapshot.docs.filter(doc => doc.data().recipientId === currentUser.uid && !doc.data().read);
            if (unreadMsgs.length > 0) { const batch = writeBatch(db); unreadMsgs.forEach(doc => batch.update(doc.ref, { read: true })); await batch.commit(); }
        });
        return () => unsubscribe();
    }, [conversationId, currentUser.uid]);

    // typing indicator listener
    useEffect(() => {
        const tRef = doc(db, 'typing', conversationId);
        const unsub = onSnapshot(tRef, (snap) => {
            const d = snap.data();
            if (!d) return setIsPartnerTyping(false);
            const now = Date.now();
            if (d.uid === chatPartnerUid && d.typing && (now - new Date(d.ts).getTime() < 5000)) setIsPartnerTyping(true);
            else setIsPartnerTyping(false);
        });
        return () => unsub();
    }, [conversationId, chatPartnerUid]);

    // load chat partner profile (photo)
    useEffect(() => {
        if (!chatPartnerUid) return;
        try {
            const unsub = onSnapshot(doc(db, 'users', chatPartnerUid), (snap) => { if (snap.exists()) setChatPartnerPhoto(snap.data().photoURL || null); else setChatPartnerPhoto(null); });
            return () => unsub();
        } catch (e) { setChatPartnerPhoto(null); }
    }, [chatPartnerUid]);

    // outbox retry queue (attempt periodically)
    useEffect(() => {
        const tryFlush = async () => {
            try {
                const q = JSON.parse(localStorage.getItem('chatOutbox') || '[]');
                if (!q || !q.length) return;
                const remaining = [];
                for (const item of q) {
                    try {
                        await addDoc(collection(db, 'messages'), item);
                    } catch (err) { remaining.push(item); }
                }
                localStorage.setItem('chatOutbox', JSON.stringify(remaining));
            } catch (e) { console.error('flush outbox', e); }
        };
        const id = setInterval(tryFlush, 5000);
        tryFlush();
        return () => clearInterval(id);
    }, []);

    const setTyping = async (typing) => {
        const tRef = doc(db, 'typing', conversationId);
        try { await setDoc(tRef, { uid: currentUser.uid, typing, ts: new Date().toISOString(), conversationId }, { merge: true }); } catch (e) {}
    };

    const handleInputChange = (e) => {
        setNewMessage(e.target.value);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        setTyping(true);
        typingTimerRef.current = setTimeout(() => setTyping(false), 1500);
    };

    const handleAttach = (files) => {
        const list = Array.from(files || []);
        list.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => { setAttachments(prev => [...prev, { name: file.name, type: file.type, dataUrl: ev.target.result }]); };
            reader.readAsDataURL(file);
        });
    };

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        const text = (newMessage || '').trim();
        if (!text && attachments.length === 0) return;
        // Firestore rejects undefined values, so only include attachments when there are some
        const payload = { conversationId, senderId: currentUser.uid, recipientId: chatPartnerUid, text: text, read: false, delivered: false, createdAt: new Date().toISOString(), ...(attachments.length ? { attachments } : {}) };
        try {
            await addDoc(collection(db, 'messages'), payload);
            setNewMessage(''); setAttachments([]); setShowEmoji(false);
        } catch (err) {
            showToast('Message failed; queued for retry.', 'error');
            const q = JSON.parse(localStorage.getItem('chatOutbox') || '[]'); q.push(payload); localStorage.setItem('chatOutbox', JSON.stringify(q));
        }
        setTyping(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && sendOnEnter) { e.preventDefault(); handleSend(); }
    };

    const insertEmoji = (emoji) => { setNewMessage((s) => s + emoji); setShowEmoji(false); };

    const dayLabel = (iso) => {
        const d = new Date(iso);
        const today = new Date();
        const yest = new Date(Date.now() - 86400000);
        if (d.toDateString() === today.toDateString()) return 'Today';
        if (d.toDateString() === yest.toDateString()) return 'Yesterday';
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    return (
        <div className="bb-sidepanel" role="dialog" aria-modal="true" aria-label={`Chat with ${chatPartnerName}`}>
            <div className="bb-panel-head">
                <button onClick={onClose} aria-label="Close chat" className="icon-btn"><ChevronLeft /></button>
                {chatPartnerPhoto
                    ? <img src={chatPartnerPhoto} alt="" className="w-9 h-9 rounded-full object-cover" />
                    : <span className="avatar w-9 h-9 text-base">{(chatPartnerName || '?').charAt(0)}</span>}
                <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold truncate">{chatPartnerName}</div>
                    <div className="text-xs text-zinc-400 h-4" aria-live="polite">{isPartnerTyping ? 'Typing…' : ''}</div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5">
                {messages.length === 0 && <p className="text-center text-sm text-zinc-500 mt-10">Say hi to {chatPartnerName}. Messages stay in BlackBook, so nobody needs your number.</p>}
                {messages.map((msg, idx) => {
                    const isMe = msg.senderId === currentUser.uid;
                    const prev = messages[idx - 1];
                    const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
                    return (
                        <React.Fragment key={msg.id}>
                            {newDay && <div className="text-center text-xs text-zinc-500 pt-3 pb-1">{dayLabel(msg.createdAt)}</div>}
                            <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[80%] px-3.5 py-2.5 text-[15px] leading-snug ${isMe ? 'chat-bubble-me' : 'chat-bubble-them'}`}>
                                    {msg.text && <div className="whitespace-pre-wrap break-words">{msg.text}</div>}
                                    {msg.attachments && msg.attachments.map((a, i) => (a.type && a.type.startsWith('image/')
                                        ? <img key={i} src={a.dataUrl} alt={a.name} className="mt-2 rounded-lg max-w-full" />
                                        : <a key={i} href={a.dataUrl} target="_blank" rel="noreferrer" className="mt-2 block text-sm underline">{a.name}</a>))}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 px-1 text-xs text-zinc-500">
                                    <span>{formatTime(msg.createdAt)}</span>
                                    {isMe && <span>{msg.read ? 'Read' : (msg.delivered ? 'Delivered' : '')}</span>}
                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
                <div ref={bottomRef} />
            </div>
            <form onSubmit={handleSend} className="border-t border-zinc-800 p-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
                {showEmoji && (
                    <div className="flex gap-1 mb-2 fade-in">
                        {['👍', '🔥', '💯', '😊', '🙏', '✂️', '💈', '⏰'].map(e => <button key={e} type="button" onClick={() => insertEmoji(e)} className="w-10 h-10 rounded-lg text-xl hover:bg-zinc-900">{e}</button>)}
                    </div>
                )}
                {attachments.length > 0 && (
                    <div className="mb-2 flex gap-2 flex-wrap">
                        {attachments.map((a, i) => (a.type && a.type.startsWith('image/')
                            ? <img key={i} src={a.dataUrl} alt="" className="w-14 h-14 object-cover rounded-lg border border-zinc-800" />
                            : <span key={i} className="chip">{a.name}</span>))}
                        <button type="button" onClick={() => setAttachments([])} className="btn btn-ghost !min-h-[32px] !px-2 text-sm">Remove</button>
                    </div>
                )}
                <div className="flex items-end gap-1.5">
                    <input type="file" onChange={(e) => handleAttach(e.target.files)} className="sr-only" id={`attach-${conversationId}`} />
                    <label htmlFor={`attach-${conversationId}`} className="icon-btn cursor-pointer shrink-0" title="Attach a photo" aria-label="Attach a photo">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    </label>
                    <button type="button" onClick={() => setShowEmoji(s => !s)} aria-pressed={showEmoji} aria-label="Quick emoji" className="icon-btn shrink-0">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>
                    </button>
                    <textarea value={newMessage} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Message" aria-label="Message" rows={1} className="flex-1 min-w-0 resize-none max-h-32 bg-zinc-900 border border-zinc-800 text-white rounded-2xl px-4 py-2.5 text-[15px] leading-snug" />
                    <button type="submit" aria-label="Send message" disabled={!newMessage.trim() && attachments.length === 0} className="press shrink-0 w-11 h-11 rounded-full bg-gold text-black flex items-center justify-center disabled:opacity-40 [&>svg]:w-5 [&>svg]:h-5"><Send /></button>
                </div>
            </form>
        </div>
    );
}

// --- FIND A BARBER ---
// Barbers opt in from Shop Settings. Their public card lives in barberProfiles/{uid}
// (shop name, address, coordinates, hours; never email or phone), so the directory
// never reads private user records.
const PENDING_BARBER_KEY = 'bb_pending_barber';
const readPendingBarber = () => { try { return JSON.parse(sessionStorage.getItem(PENDING_BARBER_KEY) || 'null'); } catch (e) { return null; } };
const clearPendingBarber = () => { try { sessionStorage.removeItem(PENDING_BARBER_KEY); } catch (e) {} };
const barberLabel = (b) => (b && (b.shopName || b.displayName || b.firstName)) || 'Barber';

const haversineMiles = (a, b) => {
    const R = 3958.8, rad = (d) => d * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

// OpenStreetMap Nominatim: free but limited to 1 request/second, so only call it on an explicit submit
const geocodeAddress = async (q) => {
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`);
    if (!resp.ok) throw new Error('Location lookup failed. Try again in a moment.');
    const [hit] = await resp.json();
    return hit ? { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), label: hit.display_name } : null;
};

// Adds a client to a barber's roster, or links the entry the barber already made for them
const addToBarberRoster = async ({ barberId, clientUid, name, phone, email, source }) => {
    const existing = await getDocs(query(collection(db, 'clients'), where('userId', '==', barberId), where('email', '==', email)));
    if (existing.empty) {
        await addDoc(collection(db, 'clients'), { name: name || '', phone: phone || '', email, userId: barberId, clientUid, formula: source, createdAt: new Date().toISOString() });
    } else {
        try { await updateDoc(existing.docs[0].ref, { clientUid }); } catch (e) { console.warn('Could not link roster entry', e); }
    }
};

const prefersReducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
// Keyless OpenStreetMap tiles, darkened in CSS (.bb-tiles). Fine for light traffic; swap in a
// keyed provider (MapTiler, Stadia) here if the site outgrows OSM's tile usage policy.
const MAP_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function BarberMap({ barbers, origin, selectedId, onSelect, className = '' }) {
    const elRef = useRef(null);
    const mapRef = useRef(null);
    const layerRef = useRef(null);
    const markersRef = useRef({});
    const onSelectRef = useRef(onSelect);
    const selectedRef = useRef(selectedId);
    const frameRef = useRef(() => {});
    const framedRef = useRef(false);
    onSelectRef.current = onSelect;
    selectedRef.current = selectedId;

    const markActive = () => {
        Object.entries(markersRef.current).forEach(([id, m]) => {
            const el = m.getElement() && m.getElement().querySelector('.bb-pin');
            if (el) el.classList.toggle('is-active', id === selectedRef.current);
            m.setZIndexOffset(id === selectedRef.current ? 1000 : 0);
        });
    };

    useEffect(() => {
        if (!window.L || !elRef.current) return;
        const map = L.map(elRef.current, { zoomControl: false, scrollWheelZoom: false }).setView([39.5, -98.35], 4);
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        L.tileLayer(MAP_TILES, { attribution: TILE_ATTRIBUTION, maxZoom: 19, className: 'bb-tiles' }).addTo(map);
        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        // The container can get its real size after mount; framing before then zooms to the max
        const ro = new ResizeObserver(() => { map.invalidateSize({ pan: false }); if (!framedRef.current) frameRef.current(); });
        ro.observe(elRef.current);
        return () => { ro.disconnect(); map.remove(); mapRef.current = null; markersRef.current = {}; };
    }, []);

    // Rebuild pins when the barbers or the search origin change, then frame the result
    useEffect(() => {
        const map = mapRef.current, layer = layerRef.current;
        if (!map || !layer) return;
        layer.clearLayers();
        markersRef.current = {};
        barbers.forEach((b, i) => {
            const icon = L.divIcon({ className: '', html: `<div class="bb-pin" style="animation-delay:${Math.min(i, 12) * 45}ms"><span></span></div>`, iconSize: [28, 36], iconAnchor: [14, 34] });
            markersRef.current[b.id] = L.marker([b.lat, b.lng], { icon, title: barberLabel(b), riseOnHover: true })
                .on('click', () => onSelectRef.current && onSelectRef.current(b.id))
                .addTo(layer);
        });
        if (origin) L.marker([origin.lat, origin.lng], { icon: L.divIcon({ className: '', html: '<div class="bb-me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false, keyboard: false }).addTo(layer);
        // With an origin, frame it plus the closest few; otherwise frame everyone
        const pts = (origin ? barbers.slice(0, 4) : barbers).map(b => [b.lat, b.lng]);
        if (origin) pts.unshift([origin.lat, origin.lng]);
        frameRef.current = () => {
            map.invalidateSize({ pan: false });
            const size = map.getSize();
            if (!size.x || !size.y) return; // not laid out yet; the ResizeObserver retries
            if (pts.length === 1) map.setView(pts[0], origin ? 12 : 15);
            else if (pts.length > 1) map.fitBounds(pts, { padding: [36, 36], maxZoom: 14, animate: framedRef.current && !prefersReducedMotion() });
            framedRef.current = pts.length > 0;
        };
        frameRef.current();
        markActive();
    }, [barbers, origin]);

    // Selecting a barber lifts its pin and brings it into view
    useEffect(() => {
        markActive();
        const m = markersRef.current[selectedId];
        if (!m || !mapRef.current) return;
        const zoom = Math.max(mapRef.current.getZoom(), 13);
        if (prefersReducedMotion()) mapRef.current.setView(m.getLatLng(), zoom);
        else mapRef.current.flyTo(m.getLatLng(), zoom, { duration: 0.6 });
    }, [selectedId]);

    if (!window.L) return <div className={`${className} flex items-center justify-center text-zinc-500 text-sm bg-zinc-950`}>Map unavailable</div>;
    return <div ref={elRef} className={className} role="region" aria-label="Map of barbers" />;
}

function FindBarber({ myBarberIds = [], activeBarberId = null, onChoose, choosingId = null, heading = true }) {
    const [barbers, setBarbers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [origin, setOrigin] = useState(null);
    const [place, setPlace] = useState('');
    const [locating, setLocating] = useState(false);
    const [nameFilter, setNameFilter] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [servicesById, setServicesById] = useState({});
    const cardRefs = useRef({});

    useEffect(() => {
        getDocs(query(collection(db, 'barberProfiles'), where('listed', '==', true)))
            .then(snap => setBarbers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(b => Number.isFinite(b.lat) && Number.isFinite(b.lng))))
            .catch(e => { console.error('barberProfiles', e); showToast('Could not load barbers', 'error'); })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!selectedId || servicesById[selectedId]) return;
        getDocs(query(collection(db, 'services'), where('userId', '==', selectedId)))
            .then(snap => setServicesById(s => ({ ...s, [selectedId]: snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.active !== false) })))
            .catch(() => setServicesById(s => ({ ...s, [selectedId]: [] })));
    }, [selectedId]);

    const useMyLocation = () => {
        if (!navigator.geolocation) { showToast('Location is not available on this device', 'error'); return; }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => { setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'you' }); setLocating(false); },
            () => { setLocating(false); showToast('Location is blocked. Search a city or ZIP instead.', 'error'); },
            { timeout: 10000, maximumAge: 600000 }
        );
    };
    const searchPlace = async (e) => {
        e.preventDefault();
        const q = place.trim();
        if (!q) return;
        setLocating(true);
        try {
            const hit = await geocodeAddress(q);
            if (hit) setOrigin({ ...hit, label: q }); else showToast('No match for that place', 'error');
        } catch (err) { showToast(err.message, 'error'); }
        finally { setLocating(false); }
    };

    // The map shows everyone (nearest first once we know where you are); the name filter only narrows the list
    const ranked = useMemo(() => barbers
        .map(b => ({ ...b, distance: origin ? haversineMiles(origin, b) : null }))
        .sort((a, b) => origin ? a.distance - b.distance : barberLabel(a).localeCompare(barberLabel(b))), [barbers, origin]);
    const nf = nameFilter.trim().toLowerCase();
    const list = nf ? ranked.filter(b => [b.shopName, b.displayName, b.address].some(v => (v || '').toLowerCase().includes(nf))) : ranked;

    const focusBarber = (id) => {
        setSelectedId(id);
        const el = cardRefs.current[id];
        if (el) el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
    };

    return (
        <div className="space-y-4">
            {heading && (
                <div>
                    <h1 className="text-5xl text-white">Find a barber</h1>
                    <p className="text-zinc-400 mt-1">Barbers near you, with their menu and open times.</p>
                </div>
            )}
            <form onSubmit={searchPlace} className="flex gap-2">
                <input value={place} onChange={e => setPlace(e.target.value)} placeholder="City, ZIP, or address" aria-label="Search a location" className="flex-1 min-w-0 p-3 rounded-lg input-pimp text-sm" />
                <button type="submit" disabled={locating} className="press px-4 rounded-lg bg-gold text-black font-bold text-xs uppercase tracking-wider">Search</button>
            </form>
            <button type="button" onClick={useMyLocation} disabled={locating} className="press w-full py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" aria-hidden="true"></span>
                {locating ? 'Finding you…' : 'Use my location'}
            </button>
            <div className="relative isolate rounded-xl overflow-hidden border border-zinc-800">
                <BarberMap barbers={ranked} origin={origin} selectedId={selectedId} onSelect={focusBarber} className="h-64 md:h-80 w-full" />
                {origin && <div className="absolute top-2 left-2 z-[1000] bg-black/80 text-zinc-300 text-xs px-2 py-1 rounded max-w-[80%] truncate pointer-events-none">Near {origin.label}</div>}
            </div>
            <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold">{loading ? 'Loading barbers…' : `${list.length} barber${list.length === 1 ? '' : 's'}${origin ? ' · nearest first' : ''}`}</div>
                <input value={nameFilter} onChange={e => setNameFilter(e.target.value)} placeholder="Filter by name" aria-label="Filter barbers by name" className="w-36 p-2 rounded-lg input-pimp text-xs" />
            </div>
            {loading && <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />)}</div>}
            {!loading && list.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-zinc-800 rounded-xl fade-in">
                    <p className="text-zinc-400 text-sm">{barbers.length === 0 ? 'No barbers on the map yet.' : 'No barbers match that name.'}</p>
                    {barbers.length === 0 && <p className="text-zinc-600 text-xs mt-1">Barbers: add your shop address in Settings to show up here.</p>}
                </div>
            )}
            <div className="space-y-2 bb-stagger">
                {list.map((b, i) => {
                    const open = selectedId === b.id;
                    const mine = myBarberIds.includes(b.id);
                    const svcs = servicesById[b.id];
                    return (
                        <div key={b.id} ref={el => { cardRefs.current[b.id] = el; }} style={{ '--i': String(i) }} className={`bb-card bg-zinc-900 border border-zinc-800 rounded-xl ${open ? 'is-active' : ''}`}>
                            <button type="button" onClick={() => setSelectedId(cur => cur === b.id ? null : b.id)} aria-expanded={open} className="w-full text-left p-4 flex items-center gap-3">
                                {b.photoURL
                                    ? <img src={b.photoURL} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                                    : <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-gold font-bold shrink-0">{barberLabel(b).charAt(0)}</div>}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-bold truncate">{barberLabel(b)}</span>
                                        {mine && <span className="text-xs bg-gold/20 text-gold px-1.5 py-0.5 rounded uppercase font-bold shrink-0">{b.id === activeBarberId ? 'Your barber' : 'Saved'}</span>}
                                    </div>
                                    {b.shopName && b.displayName && <div className="text-zinc-400 text-xs truncate">{b.displayName}</div>}
                                    <div className="text-zinc-500 text-xs truncate">{b.address}</div>
                                </div>
                                <div className="text-right shrink-0">
                                    {b.distance != null && <div className="text-gold font-mono text-sm">{b.distance < 10 ? b.distance.toFixed(1) : Math.round(b.distance)} mi</div>}
                                    {b.shopOpen && b.shopClose && <div className="text-zinc-500 text-xs">{formatHM(b.shopOpen)}–{formatHM(b.shopClose)}</div>}
                                </div>
                            </button>
                            <div className={`bb-acc ${open ? 'open' : ''}`} aria-hidden={!open}>
                                <div>
                                    <div className="px-4 pb-4 space-y-3">
                                        <div className="border-t border-zinc-800 pt-3 space-y-1.5">
                                            {!svcs && <div className="text-zinc-500 text-xs">Loading services…</div>}
                                            {svcs && svcs.length === 0 && <div className="text-zinc-500 text-xs">No services listed yet.</div>}
                                            {svcs && svcs.slice(0, 6).map(s => (
                                                <div key={s.id} className="flex justify-between text-sm">
                                                    <span className="text-zinc-300 truncate mr-3">{s.name}</span>
                                                    <span className="text-gold font-mono shrink-0">${s.salePrice || s.price}{s.duration ? <span className="text-zinc-500 text-xs ml-2">{formatDuration(s.duration)}</span> : null}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <button type="button" tabIndex={open ? 0 : -1} onClick={() => onChoose && onChoose(b)} disabled={choosingId === b.id} className="press w-full py-3 rounded-lg bg-gold text-black font-bold uppercase text-sm tracking-wider">
                                            {choosingId === b.id ? 'Connecting…' : (b.id === activeBarberId ? 'Book now' : `Book with ${barberLabel(b)}`)}
                                        </button>
                                        <a tabIndex={open ? 0 : -1} href={`https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`} target="_blank" rel="noopener noreferrer" className="block text-center text-xs text-zinc-400 underline">Directions</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Public map at /find. Picking a barber remembers them and opens client sign-up.
function FindBarberPage({ onBook }) {
    usePageMeta('Find a barber near you: BlackBook', 'See barbers near you on a map with their menus, prices and open times, then book your cut.');
    return (
        <div className="bg-black text-white min-h-screen">
            <SiteNav current="/find" />
            <main id="main" tabIndex={-1} className="max-w-3xl mx-auto px-5 pt-8 pb-16 fade-in">
                <FindBarber onChoose={onBook} />
                <p className="text-center text-zinc-400 text-sm mt-12">Are you a barber? <Link to="/barbers" className="text-gold font-semibold underline underline-offset-2">Put your chair on the map</Link></p>
            </main>
            <SiteFooter />
        </div>
    );
}

// --- CLIENT DASHBOARD (FIXED TIME & COUPONS) ---
function ClientDashboard({ user }) {
    const [activeTab, setActiveTab] = useState(user.linkedBarberId && currentPath() !== '/find' ? 'book' : 'find');
    const [myBarbers, setMyBarbers] = useState([]); // [{ id, label }] for every barber this client has booked with
    const [choosingId, setChoosingId] = useState(null);
    const [userProfile, setUserProfile] = useState({});
    const [showUserSettings, setShowUserSettings] = useState(false);
    const [barberProfile, setBarberProfile] = useState(null);
    const [barberServices, setBarberServices] = useState([]);
    const [barberCoupons, setBarberCoupons] = useState([]);
    const [shopProducts, setShopProducts] = useState([]);
    const [newProfileImageFile, setNewProfileImageFile] = useState(null);
    const [newProfileImageUrl, setNewProfileImageUrl] = useState('');
    const [newProfileUploading, setNewProfileUploading] = useState(false);
    const [imageModalUrl, setImageModalUrl] = useState(null);
    const [orderItems, setOrderItems] = useState([]);
    const [ordering, setOrdering] = useState(false);
    const [shopNameEdit, setShopNameEdit] = useState('');
    const [pickupInstructionsEdit, setPickupInstructionsEdit] = useState('');
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [newProductName, setNewProductName] = useState('');
    const [newProductPrice, setNewProductPrice] = useState('');
    const [newProductDesc, setNewProductDesc] = useState('');
    const [newProductFile, setNewProductFile] = useState(null);
    const [newProductPreview, setNewProductPreview] = useState('');
    const [uploadingProduct, setUploadingProduct] = useState(false);
    const [lastPlacedOrder, setLastPlacedOrder] = useState(null);
    const [showPickupModal, setShowPickupModal] = useState(false);
    const [viewingOrder, setViewingOrder] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [selectedServices, setSelectedServices] = useState([]); // allow multiple services
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedTime, setSelectedTime] = useState("");
    const [availableSlots, setAvailableSlots] = useState([]);
    const [candidateSlots, setCandidateSlots] = useState([]);
    const [slotReasons, setSlotReasons] = useState({});
    
    // Coupon Logic
    const [couponCode, setCouponCode] = useState("");
    const [discountApplied, setDiscountApplied] = useState(null); // { type: 'fixed'|'percent', value: 10, code: 'SAVE10' }

    const [showChat, setShowChat] = useState(false);
    const [showSupport, setShowSupport] = useState(false);
    const [viewingApptClient, setViewingApptClient] = useState(null);
    const [reschedDate, setReschedDate] = useState("");
    const [reschedTime, setReschedTime] = useState("");
    const [editingAppointmentId, setEditingAppointmentId] = useState(null);
    const [showEditAppt, setShowEditAppt] = useState(false);
    // Cozy client features
    const [favorites, setFavorites] = useState([]);
    // Client settings / profile edit states
    const [editFirstName, setEditFirstName] = useState('');
    const [editLastName, setEditLastName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [notifEmail, setNotifEmail] = useState(true);
    const [notifSMS, setNotifSMS] = useState(false);
    const [notifPush, setNotifPush] = useState(true);
    const [reminderHours, setReminderHours] = useState(24);

    const isBillingExpired = userProfile && userProfile.billingNextDue && (new Date() > new Date(userProfile.billingNextDue));

    useEffect(() => {
        try {
            const key = `bb_favs_${user.uid}`;
            const raw = localStorage.getItem(key);
            if(raw) setFavorites(JSON.parse(raw));
        } catch(e) {}
    }, [user.uid]);

    useEffect(() => {
        // subscribe to user's profile for client-specific info (credits, plan, etc.)
        try {
            const uRef = doc(db, 'users', user.uid);
            const unsub = onSnapshot(uRef, d => { if (d.exists()) setUserProfile(d.data()); });
            return () => unsub && unsub();
        } catch (e) {
            // ignore
        }
    }, [user.uid]);

    // helper to normalize various date strings to YYYY-MM-DD for date inputs
    const toInputDate = (val) => {
        if(!val) return '';
        try {
            const d = new Date(val);
            if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
            return val;
        } catch(e) { return val; }
    };

    // initialize edit fields when profile loads
    useEffect(() => {
        if (userProfile) {
            setEditFirstName(userProfile.firstName || '');
            setEditLastName(userProfile.lastName || '');
            setEditPhone(userProfile.phone || userProfile.phoneNumber || '');
            const p = userProfile.preferences || {};
            setNotifEmail(p.notifications?.email ?? true);
            setNotifSMS(p.notifications?.sms ?? false);
            setNotifPush(p.notifications?.push ?? true);
            setReminderHours(p.reminderHours ?? 24);
        }
    }, [userProfile]);

    const saveClientSettings = async () => {
        try {
            const upd = {
                firstName: editFirstName || undefined,
                lastName: editLastName || undefined,
                phone: editPhone || undefined,
                preferences: {
                    notifications: { email: !!notifEmail, sms: !!notifSMS, push: !!notifPush },
                    reminderHours: Number(reminderHours) || 24,
                }
            };
            // remove undefined keys
            Object.keys(upd).forEach(k => { if (upd[k] === undefined) delete upd[k]; });

            // handle profile image upload
            if (newProfileImageFile) {
                try {
                    setNewProfileUploading(true);
                    const storage = getStorage();
                    const fileToUpload = await resizeImageFile(newProfileImageFile, 800, 0.85);
                    const key = `avatars/${user.uid}/${Date.now()}_${(fileToUpload.name || 'avatar').replace(/[^a-z0-9.\-]/gi, '_')}`;
                    const sRef = storageRef(storage, key);
                    const uploadTask = uploadBytesResumable(sRef, fileToUpload);
                    await new Promise((res, rej) => { uploadTask.on('state_changed', null, rej, res); });
                    const url = await getDownloadURL(sRef);
                    upd.photoURL = url;
                    upd.photoPath = key;
                } catch (upErr) {
                    console.error('Profile image upload failed', upErr);
                    showToast('Image upload failed', 'error');
                } finally { setNewProfileUploading(false); }
            }

            await updateDoc(doc(db, 'users', user.uid), { ...upd, updatedAt: new Date().toISOString() });

            // if client is linked to a barber, update their clients record(s) so barber roster shows avatar
            try {
                if (userProfile && userProfile.linkedBarberId) {
                    const q = query(collection(db, 'clients'), where('userId', '==', userProfile.linkedBarberId), where('email', '==', user.email));
                    const snap = await getDocs(q);
                    for (const d of snap.docs) {
                        const data = {};
                        if (upd.photoURL) data.photoURL = upd.photoURL;
                        if (upd.photoPath) data.photoPath = upd.photoPath;
                        if (Object.keys(data).length) await updateDoc(doc(db, 'clients', d.id), data);
                    }
                }
            } catch(e) { console.warn('Failed to update clients collection with photo', e); }

            showToast('Settings saved', 'success');
            setShowUserSettings(false);
            setNewProfileImageFile(null); setNewProfileImageUrl('');
        } catch (err) {
            showToast(err.message || 'Failed saving', 'error');
        }
    };

    const saveFavorite = (name) => {
        if(!name || selectedServices.length === 0) { showToast('Add services first', 'error'); return; }
        const key = `bb_favs_${user.uid}`;
        const items = selectedServices.map(s => ({ id: s.id, note: s.note || '' }));
        const fav = { id: Date.now() + Math.random(), name, items };
        const next = [fav, ...favorites];
        setFavorites(next);
        try { localStorage.setItem(key, JSON.stringify(next)); showToast('Saved favorite', 'success'); } catch(e) { showToast('Failed saving', 'error'); }
    };

    // helpers for time math
    const hhmmToMins = (t) => { if(!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const minsToHHMM = (mins) => { const h = Math.floor(mins / 60).toString().padStart(2, '0'); const m = (mins % 60).toString().padStart(2, '0'); return `${h}:${m}`; };

    const quickAddFavorite = (fav) => {
        const items = fav.items.map(it => barberServices.find(s => s.id === it.id)).filter(Boolean).map(s => ({ ...s, note: (fav.items.find(i=>i.id===s.id)?.note) || '' }));
        setSelectedServices(items);
        showToast('Added favorite', 'success');
    };

    useEffect(() => {
        const barberId = user.linkedBarberId;
        // Switching barbers: clear the previous barber's menu so it never shows under the new one
        setBarberProfile(null); setBarberServices([]); setBarberCoupons([]); setShopProducts([]); setAppointments([]);
        if (!barberId) return;
        getDoc(doc(db, "users", barberId)).then(docSnap => {
            if(docSnap.exists()) setBarberProfile(docSnap.data());
        });
        getDocs(query(collection(db, "services"), where("userId", "==", barberId))).then(snap => {
            setBarberServices(snap.docs.map(d => ({id: d.id, ...d.data()})));
        });
        getDocs(query(collection(db, "coupons"), where("userId", "==", barberId))).then(snap => {
            setBarberCoupons(snap.docs.map(d => d.data()));
        });
        const unsubProducts = onSnapshot(query(collection(db, "products"), where("userId", "==", barberId)), snap => setShopProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        // My appointments are matched by clientId. Bookings made before clientId existed
        // only carry a first name, so those still match by name (but never one tagged to another client).
        let mine = [], legacy = [];
        const publish = () => {
            const appts = [...mine, ...legacy.filter(a => !a.clientId)];
            appts.sort((a,b) => {
                const A = parseDateTimePST(a.date, a.time) || new Date(0);
                const B = parseDateTimePST(b.date, b.time) || new Date(0);
                return A - B;
            });
            setAppointments(appts);
        };
        const toList = (snap) => snap.docs.map(d => ({id: d.id, ...d.data()}));
        const unsubMine = onSnapshot(query(collection(db, "appointments"), where("userId", "==", barberId), where("clientId", "==", user.uid)), (snap) => { mine = toList(snap); publish(); }, (e) => console.error('appointments snapshot', e));
        const unsubLegacy = user.firstName
            ? onSnapshot(query(collection(db, "appointments"), where("userId", "==", barberId), where("clientName", "==", user.firstName)), (snap) => { legacy = toList(snap); publish(); }, (e) => console.error('legacy appointments snapshot', e))
            : () => {};
        return () => { unsubProducts(); unsubMine(); unsubLegacy(); };
    }, [user.uid, user.linkedBarberId, user.firstName]);

    // Names for the barber switcher. Older accounts only have linkedBarberId, so include it.
    const barberIdsKey = [...new Set([user.linkedBarberId, ...(user.barberIds || [])].filter(Boolean))].join(',');
    useEffect(() => {
        const ids = barberIdsKey ? barberIdsKey.split(',') : [];
        let alive = true;
        Promise.all(ids.map(id => getDoc(doc(db, 'users', id))
            .then(s => ({ id, label: s.exists() ? barberLabel(s.data()) : 'Barber' }))
            .catch(() => ({ id, label: 'Barber' }))))
            .then(list => { if (alive) setMyBarbers(list); });
        return () => { alive = false; };
    }, [barberIdsKey]);

    // Make a barber the active one; the first time, also put this client on that barber's roster
    const connectBarber = async (b) => {
        if (!b || !b.id) return;
        if (b.id === user.linkedBarberId) { setActiveTab('book'); return; }
        setChoosingId(b.id);
        try {
            await updateDoc(doc(db, 'users', user.uid), { linkedBarberId: b.id, barberIds: arrayUnion(...[user.linkedBarberId, b.id].filter(Boolean)), updatedAt: new Date().toISOString() });
            if (!barberIdsKey.split(',').includes(b.id)) {
                await addToBarberRoster({ barberId: b.id, clientUid: user.uid, name: user.firstName || userProfile.firstName, phone: user.phone || userProfile.phone, email: user.email, source: 'Booked via BlackBook map' });
            }
            setSelectedServices([]); setSelectedDate(''); setSelectedTime(''); setCouponCode(''); setDiscountApplied(null); setEditingAppointmentId(null);
            setActiveTab('book');
            showToast(`Booking with ${barberLabel(b)}`, 'success');
        } catch (e) { console.error('connectBarber', e); showToast('Could not switch barber', 'error'); }
        finally { setChoosingId(null); }
    };
    const switchBarber = (id) => { const m = myBarbers.find(x => x.id === id); if (m) connectBarber({ id, shopName: m.label }); };

    // Roster entries a barber typed in by hand don't know this client's account id, which chat needs.
    // Fill it in whenever the client signs in. Only entries matching this client's own email are touched.
    useEffect(() => {
        if (!barberIdsKey || !user.email) return;
        barberIdsKey.split(',').forEach(async (barberId) => {
            try {
                const snap = await getDocs(query(collection(db, 'clients'), where('userId', '==', barberId), where('email', '==', user.email)));
                for (const d of snap.docs) if (d.data().clientUid !== user.uid) await updateDoc(d.ref, { clientUid: user.uid });
            } catch (e) { console.warn('Could not link roster entry', e); }
        });
    }, [barberIdsKey, user.uid, user.email]);

    // Picked a barber on the public map, then logged in: carry that choice through
    useEffect(() => {
        const pending = readPendingBarber();
        if (!pending || !pending.id) return;
        clearPendingBarber();
        connectBarber({ id: pending.id, shopName: pending.name });
    }, []);

    // initialize shop edit fields when barberProfile loads
    useEffect(() => {
        if (barberProfile) {
            setShopNameEdit(barberProfile.shopName || '');
            setPickupInstructionsEdit(barberProfile.pickupInstructions || '');
        }
    }, [barberProfile]);

    // GENERATE TIME SLOTS (exclude already-taken slots)
    useEffect(() => {
        if (selectedDate && barberProfile) {
            const { shopOpen, shopClose, slotDuration } = barberProfile;
            const slots = [];
                // Helper to convert "HH:MM" to minutes from midnight
                const toMins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
                // Helper to convert minutes to "HH:MM"
                const toTime = (mins) => {
                    const h = Math.floor(mins / 60).toString().padStart(2, '0');
                    const m = (mins % 60).toString().padStart(2, '0');
                    return `${h}:${m}`;
                };

                const granularity = barberProfile.slotGranularity || 5; // minutes between possible starts
                let current = toMins(shopOpen || "09:00");
                const end = toMins(shopClose || "17:00");

                // generate candidate start times by granularity
                while (current < end) {
                    slots.push(toTime(current));
                    current += granularity;
                }

            // Realtime listener: update available slots when appointments for that date change
            const barberId = user.linkedBarberId;
            const q = query(collection(db, "appointments"), where("userId", "==", barberId), where("date", "==", selectedDate));
            const unsub = onSnapshot(q, (snap) => {
                const buffer = barberProfile.breakMinutes || 5;
                const selectedTotal = selectedServices && selectedServices.length > 0 ? selectedServices.reduce((sum, s) => sum + (s.duration || barberProfile.slotDuration || 60), 0) : (barberProfile.slotDuration || 60);

                // build taken ranges from existing appointments (exclude cancelled)
                const takenRanges = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a && a.status !== 'cancelled' && a.time).map(a => {
                    const apptStart = toMins(a.time);
                    let apptDur = a.totalDuration || 0;
                    if (!apptDur && a.services && Array.isArray(a.services)) apptDur = a.services.reduce((sum, s) => sum + (s.duration || 0), 0);
                    if (!apptDur) apptDur = barberProfile.slotDuration || 60;
                    return { start: Math.max(0, apptStart - buffer), end: apptStart + apptDur + buffer, apptId: a.id };
                });

                // Build break ranges (lunch + any configured shopBreaks)
                const lunchStartMins = barberProfile.lunchStart ? toMins(barberProfile.lunchStart) : null;
                const lunchEndMins = barberProfile.lunchEnd ? toMins(barberProfile.lunchEnd) : null;
                const breakRanges = [];
                if (lunchStartMins !== null && lunchEndMins !== null) breakRanges.push({ start: lunchStartMins, end: lunchEndMins, reason: 'break', label: 'Lunch' });
                const configuredBreaks = barberProfile.shopBreaks || [];
                if (Array.isArray(configuredBreaks)) {
                    configuredBreaks.forEach(b => {
                        try {
                            if (b && b.start && b.end) {
                                const s = toMins(b.start); const e = toMins(b.end);
                                if (!isNaN(s) && !isNaN(e)) breakRanges.push({ start: s, end: e, reason: 'break', label: b.label || '' });
                            }
                        } catch(e) {}
                    });
                }

                // For each candidate slot compute a reason: 'available'|'conflict'|'break'|'too_late'
                const reasons = {};
                const candidates = slots.map(slot => {
                    const start = toMins(slot);
                    const endMin = start + selectedTotal;
                    let reason = 'available';
                    if (endMin > toMins(shopClose || "17:00")) {
                        reason = 'too_late';
                    }
                    // check breaks first
                    if (reason === 'available') {
                        for (const br of breakRanges) {
                            if (start < br.end && endMin > br.start) { reason = 'break'; break; }
                        }
                    }
                    // then check appointment conflicts
                    if (reason === 'available') {
                        for (const r of takenRanges) {
                            if (start < r.end && r.start < endMin) { reason = 'conflict'; break; }
                        }
                    }
                    reasons[slot] = reason;
                    return slot;
                });

                const available = candidates.filter(s => reasons[s] === 'available');
                setCandidateSlots(candidates);
                setSlotReasons(reasons);
                setAvailableSlots(available);
            }, (err) => {
                setAvailableSlots(slots);
                setCandidateSlots(slots);
                setSlotReasons({});
            });
            return () => unsub();
        } else {
            setAvailableSlots([]);
            setCandidateSlots([]);
            setSlotReasons({});
        }
    }, [selectedDate, barberProfile, user.linkedBarberId, selectedServices]);

    const applyCoupon = () => {
        if(!couponCode) return;
        const found = barberCoupons.find(c => c.code === couponCode.toUpperCase());
        if(found) {
            setDiscountApplied(found);
            showToast(`Coupon Applied: ${found.code}`, 'success');
        } else {
            showToast("Invalid Coupon Code", 'error');
            setDiscountApplied(null);
        }
    };

    const handleBook = async () => {
        if(selectedServices.length === 0 || !selectedDate || !selectedTime) { showToast("Please select all details.", 'error'); return; }

        const baseTotal = selectedServices.reduce((sum, s) => sum + (s.salePrice || s.price || 0), 0);
        let finalPrice = baseTotal;
        if (discountApplied) {
            if (discountApplied.type === 'fixed') finalPrice -= discountApplied.value;
            else if (discountApplied.type === 'percent') finalPrice -= (finalPrice * (discountApplied.value / 100));
        }
        const tipAmount = 0;
        finalPrice = Math.max(0, finalPrice + tipAmount);

        const totalDuration = selectedServices.reduce((sum, s) => sum + (s.duration || barberProfile?.slotDuration || 60), 0);
        const payload = {
            userId: user.linkedBarberId,
            clientId: user.uid,
            clientEmail: user.email || '',
            clientName: user.firstName,
            services: selectedServices.map(s => ({ id: s.id, name: s.name, price: s.price, salePrice: s.salePrice || null, note: s.note || '' })),
            totalDuration,
            price: finalPrice,
            originalPrice: baseTotal,
            tipPercent: 0,
            tipAmount: tipAmount,
            date: selectedDate,
            time: selectedTime,
            status: 'booked',
            bookedByClient: true,
            coupon: discountApplied ? discountApplied.code : null,
        };

        try {
            // Prevent double-booking: check if another non-cancelled appt exists at this barber/date/time
            const conflictQ = query(collection(db, "appointments"), where("userId", "==", user.linkedBarberId), where("date", "==", selectedDate), where("time", "==", selectedTime));
            const conflictSnap = await getDocs(conflictQ);
            const conflicts = conflictSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.status !== 'cancelled');
            if (conflicts.length > 0) {
                // If editing, allow if the only conflict is the appointment being edited
                if (!(editingAppointmentId && conflicts.length === 1 && conflicts[0].id === editingAppointmentId)) {
                    showToast('Time slot already taken. Pick another slot.', 'error');
                    return;
                }
            }
            if (editingAppointmentId) {
                await updateDoc(doc(db, 'appointments', editingAppointmentId), { ...payload, updatedAt: new Date().toISOString(), lastModifiedBy: user.uid });
                showToast('Appointment updated', 'success');
                setEditingAppointmentId(null);
            } else {
                await addDoc(collection(db, "appointments"), { ...payload, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastModifiedBy: user.uid });
                showToast("Appointment Requested!", 'success');
            }
            setSelectedServices([]); setSelectedDate(""); setSelectedTime(""); setCouponCode(""); setDiscountApplied(null); setActiveTab('history');
        } catch (err) {
            showToast(err.message || 'Error', 'error');
        }
    };

    const nowPST = getNowPST();
    const upcomingAppts = appointments.filter(a => {
        if (a.status === 'cancelled') return false;
        const dt = parseDateTimePST(a.date, a.time);
        return dt && dt >= nowPST;
    });
    const pastAppts = appointments.filter(a => {
        if (a.status === 'cancelled') return false;
        const dt = parseDateTimePST(a.date, a.time);
        return dt && dt < nowPST;
    });

    // Helper to render price with potential discount
    const renderPrice = () => {
        if(!selectedServices || selectedServices.length === 0) return null;
        const baseTotal = selectedServices.reduce((sum, s) => sum + (s.salePrice || s.price || 0), 0);
        if(!discountApplied) return <span className="text-gold font-mono text-xl">${baseTotal.toFixed(2)}</span>;

        let final = baseTotal;
        if (discountApplied.type === 'fixed') final -= discountApplied.value;
        else final -= (final * (discountApplied.value / 100));

        return (
            <div className="flex flex-col items-end">
                <span className="text-zinc-500 line-through text-xs">${baseTotal.toFixed(2)}</span>
                <span className="text-green-500 font-mono text-xl">${Math.max(0, final).toFixed(2)}</span>
            </div>
        );
    };

    const clientTabs = [
        { id: 'book', label: 'Book', icon: <CalendarIcon /> },
        { id: 'history', label: 'Visits', icon: <ClockIcon /> },
        { id: 'find', label: 'Find', icon: <PinIcon /> },
        { id: 'shop', label: 'Shop', icon: <ShopIcon /> },
    ];
    const currentTitle = (clientTabs.find(t => t.id === activeTab) || {}).label || '';
    const barberName = barberProfile ? barberLabel(barberProfile) : 'your barber';
    const serviceList = (a) => a.service || (a.services ? a.services.map(s => s.name).join(', ') : '');
    const apptPrice = (a) => Number(a.price || (a.services ? a.services.reduce((s, x) => s + (x.salePrice || x.price || 0), 0) : 0));
    const longDate = (d) => (parseDatePST(d) || new Date()).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    // Two weeks of days to tap through instead of a bare date picker
    const dayStrip = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(Date.now() + i * 86400000);
        const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d);
        const local = parseDatePST(key) || d;
        return { key, wd: i === 0 ? 'Today' : local.toLocaleDateString('en-US', { weekday: 'short' }), day: local.getDate(), mon: local.toLocaleDateString('en-US', { month: 'short' }) };
    });
    const selectedTotalMins = selectedServices.reduce((sum, s) => sum + (s.duration || barberProfile?.slotDuration || 60), 0);
    const nextAppt = upcomingAppts[0];
    const openEditFromView = (appt) => {
        const svcArr = (appt.services && Array.isArray(appt.services)) ? appt.services.map(s => {
            const found = barberServices.find(b => b.id === s.id);
            return found ? { ...found, note: s.note || '', id: found.id } : ({ id: s.id || null, name: s.name, price: s.price || s.salePrice || 0, note: s.note || '' });
        }) : [];
        setSelectedServices(svcArr);
        setSelectedDate(toInputDate(appt.date));
        setSelectedTime(appt.time || '');
        setEditingAppointmentId(appt.id);
        setViewingApptClient(null);
        setShowEditAppt(true);
    };

    return (
        <div className="bb-app">
            {isBillingExpired && (
                <div className="bb-overlay" style={{ zIndex: 70 }}>
                    <div role="alertdialog" aria-modal="true" aria-label="Payment overdue" className="bb-sheet">
                        <h3 className="text-[28px] text-white">Payment overdue</h3>
                        <p className="text-zinc-400 mt-2">Your monthly payment didn't go through. Pay now to keep booking.</p>
                        <div className="mt-6 flex gap-2">
                            <button onClick={() => setShowSupport(true)} className="btn btn-secondary flex-1">Contact support</button>
                            <button onClick={() => { window.location.href = '/#/plans'; }} className="btn btn-primary flex-1">Pay now</button>
                        </div>
                    </div>
                </div>
            )}

            <header className="bb-topbar">
                <div className="flex-1 min-w-0">
                    <span className="logo text-[26px] min-[900px]:hidden">Black<span className="text-gold">Book</span></span>
                    <h1 className="hidden min-[900px]:block text-3xl text-white">{currentTitle}</h1>
                </div>
                {user.linkedBarberId && <button onClick={() => setShowChat(true)} aria-label={`Message ${barberName}`} title={`Message ${barberName}`} className="icon-btn"><MessageIcon /></button>}
                <button onClick={() => setShowSupport(true)} aria-label="Help and support" title="Help and support" className="icon-btn"><SupportIcon /></button>
                <button onClick={() => setShowUserSettings(true)} aria-label="Account settings" title="Account settings" className="icon-btn">
                    {userProfile?.photoURL
                        ? <img src={userProfile.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
                        : <span className="avatar w-8 h-8 text-sm">{(userProfile?.firstName || 'U').charAt(0)}</span>}
                </button>
                <button onClick={() => signOut(auth)} aria-label="Sign out" title="Sign out" className="icon-btn"><LogOut /></button>
            </header>

            <main className="bb-main">
                {activeTab === 'book' && !user.linkedBarberId && (
                    <div className="fade-in space-y-6">
                        <div>
                            <h2 className="text-4xl text-white">Hi {userProfile?.firstName || 'there'}</h2>
                            <p className="text-zinc-400 mt-1">Pick a barber to see their menu and open times.</p>
                        </div>
                        <div className="panel p-8 text-center">
                            <span className="w-12 h-12 rounded-full bg-gold/10 text-gold inline-flex items-center justify-center mb-3"><PinIcon /></span>
                            <p className="text-white font-semibold">You haven't picked a barber yet</p>
                            <p className="text-zinc-400 text-sm mt-1">Find one near you on the map, then book in a couple of taps.</p>
                            <button onClick={() => setActiveTab('find')} className="btn btn-primary mt-5">Find a barber</button>
                        </div>
                    </div>
                )}

                {activeTab === 'find' && (
                    <div className="fade-in">
                        <FindBarber myBarberIds={myBarbers.map(m => m.id)} activeBarberId={user.linkedBarberId} onChoose={connectBarber} choosingId={choosingId} heading={false} />
                    </div>
                )}

                {activeTab === 'book' && user.linkedBarberId && (
                    <div className="fade-in space-y-7">
                        <div className="flex items-end justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="text-4xl text-white">Hi {userProfile?.firstName || 'there'}</h2>
                                <div className="mt-1 flex items-center gap-2 text-zinc-400 flex-wrap">
                                    <span>Booking with</span>
                                    {myBarbers.length > 1 ? (
                                        <select value={user.linkedBarberId} onChange={e => switchBarber(e.target.value)} aria-label="Switch barber" className="h-8 pl-2 pr-7 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-semibold">
                                            {myBarbers.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                        </select>
                                    ) : <span className="text-white font-semibold">{barberProfile ? barberName : '…'}</span>}
                                    <button onClick={() => setActiveTab('find')} className="text-gold font-semibold underline underline-offset-2">Find another</button>
                                </div>
                            </div>
                            {(userProfile?.credits || 0) > 0 && <span className="chip chip-gold shrink-0">{userProfile.credits} points</span>}
                        </div>

                        {nextAppt && (
                            <button onClick={() => { setViewingApptClient(nextAppt); setReschedDate(nextAppt.date); setReschedTime(nextAppt.time || ''); }} className="ticket block w-full text-left press" aria-label="Your next appointment, open details">
                                <div className="ticket-top flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-sm ticket-muted font-semibold">Your next cut</div>
                                        <div className="ticket-display text-[40px] mt-1">{longDate(nextAppt.date)}</div>
                                        <div className="ticket-display text-2xl">{nextAppt.time ? formatHM(nextAppt.time) : ''}</div>
                                    </div>
                                    <span className="ticket-stamp mt-1">Booked</span>
                                </div>
                                <div className="ticket-bottom flex items-end justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="font-semibold truncate">{serviceList(nextAppt)}</div>
                                        <div className="text-sm ticket-muted">with {barberName}. Tap to change or cancel.</div>
                                    </div>
                                    <div className="ticket-display text-3xl shrink-0">${apptPrice(nextAppt).toFixed(0)}</div>
                                </div>
                            </button>
                        )}

                        <section>
                            <div className="flex items-baseline justify-between gap-3 mb-3">
                                <h3 className="text-2xl text-white">1. Choose services</h3>
                                {selectedServices.length > 0 && <button onClick={() => { const name = prompt('Name this combo, like "Usual"'); if (name) saveFavorite(name); }} className="text-sm text-gold font-semibold">Save as combo</button>}
                            </div>
                            {favorites.length > 0 && (
                                <div className="flex gap-2 flex-wrap mb-3">
                                    {favorites.map(f => <button key={f.id} onClick={() => quickAddFavorite(f)} className="chip !h-8 !px-3 hover:!text-white">{f.name}</button>)}
                                </div>
                            )}
                            {barberServices.length === 0 ? (
                                <div className="panel p-6 text-sm text-zinc-400">{barberProfile ? `${barberName} hasn't added services yet. Message them to book.` : 'Loading the menu…'}</div>
                            ) : (
                                <div className="ledger">
                                    {barberServices.filter(s => s.active !== false).map(svc => {
                                        const selected = !!selectedServices.find(s => s.id === svc.id);
                                        const onSale = svc.salePrice && Number(svc.salePrice) < Number(svc.price);
                                        return (
                                            <button key={svc.id} aria-pressed={selected} onClick={() => {
                                                setDiscountApplied(null); setCouponCode("");
                                                if (selected) setSelectedServices(prev => prev.filter(x => x.id !== svc.id));
                                                else setSelectedServices(prev => [...prev, { ...svc, note: '' }]);
                                            }} className={`ledger-row ${selected ? '!bg-zinc-800/60' : ''}`}>
                                                <span className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-gold border-gold text-black' : 'border-zinc-600 text-transparent'}`}><Check /></span>
                                                <span className="flex-1 min-w-0">
                                                    <span className="flex items-center gap-2"><span className="text-white font-semibold truncate">{svc.name}</span>{svc.recommended && <span className="chip chip-gold !h-5 !px-2 shrink-0">Popular</span>}</span>
                                                    <span className="block text-sm text-zinc-400 truncate">{formatDuration(Number(svc.duration || svc.durationMinutes || 60))}{svc.description ? `. ${svc.description}` : ''}</span>
                                                </span>
                                                <span className="text-right shrink-0">
                                                    <span className="block num text-xl text-white">${onSale ? svc.salePrice : svc.price}</span>
                                                    {onSale && <span className="block text-xs text-zinc-500 line-through">${svc.price}</span>}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {selectedServices.length > 0 && (
                            <section className="fade-in">
                                <h3 className="text-2xl text-white mb-3">2. Pick a day</h3>
                                <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1" role="listbox" aria-label="Day">
                                    {dayStrip.map(d => {
                                        const on = selectedDate === d.key;
                                        return (
                                            <button key={d.key} role="option" aria-selected={on} onClick={() => { setSelectedDate(d.key); setSelectedTime(""); }} className={`shrink-0 w-[60px] py-2 rounded-xl border text-center transition-colors ${on ? 'bg-gold border-gold text-black' : 'bg-zinc-900 border-zinc-800 text-white hover:border-zinc-600'}`}>
                                                <span className={`block text-xs font-semibold ${on ? 'text-black/70' : 'text-zinc-400'}`}>{d.wd}</span>
                                                <span className="block num text-2xl leading-tight">{d.day}</span>
                                                <span className={`block text-xs ${on ? 'text-black/70' : 'text-zinc-500'}`}>{d.mon}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <label className="mt-3 inline-flex items-center gap-2 text-sm text-zinc-400">Later date
                                    <input type="date" value={selectedDate || ''} min={dayStrip[0].key} onChange={e => { setSelectedDate(e.target.value); setSelectedTime(""); }} className="h-9 px-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white" />
                                </label>
                            </section>
                        )}

                        {selectedServices.length > 0 && selectedDate && (
                            <section className="fade-in">
                                <h3 className="text-2xl text-white mb-1">3. Pick a time</h3>
                                <p className="text-sm text-zinc-400 mb-3">{longDate(selectedDate)}, for about {formatDuration(selectedTotalMins)}</p>
                                {availableSlots.length > 0 ? (
                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                        {availableSlots.map(time => (
                                            <button key={time} aria-pressed={selectedTime === time} onClick={() => setSelectedTime(time)} className={`h-11 rounded-lg border text-sm font-bold transition-colors ${selectedTime === time ? 'bg-gold text-black border-gold' : 'bg-zinc-900 text-white border-zinc-800 hover:border-zinc-600'}`}>
                                                {formatHM(time)}
                                            </button>
                                        ))}
                                    </div>
                                ) : <div className="panel p-5 text-sm text-zinc-400">No open times that day. Try another day.</div>}
                            </section>
                        )}

                        {selectedServices.length > 0 && selectedDate && selectedTime && (() => {
                            const baseTotal = selectedServices.reduce((sum, s) => sum + Number(s.salePrice || s.price || 0), 0);
                            let finalTotal = baseTotal;
                            if (discountApplied) finalTotal = discountApplied.type === 'fixed' ? baseTotal - discountApplied.value : baseTotal - baseTotal * (discountApplied.value / 100);
                            finalTotal = Math.max(0, finalTotal);
                            const endHH = minsToHHMM(hhmmToMins(selectedTime) + selectedTotalMins);
                            return (
                                <section className="fade-in">
                                    <h3 className="text-2xl text-white mb-3">4. Confirm</h3>
                                    <div className="ticket">
                                        <div className="ticket-top">
                                            <div className="text-sm ticket-muted font-semibold">{barberName}</div>
                                            <div className="ticket-display text-[40px] mt-1">{longDate(selectedDate)}</div>
                                            <div className="ticket-display text-2xl">{formatHM(selectedTime)} to {formatHM(endHH)}</div>
                                            <div className="mt-4 space-y-3">
                                                {selectedServices.map(s => (
                                                    <div key={s.id}>
                                                        <div className="flex justify-between gap-3 font-semibold"><span>{s.name}</span><span>${Number(s.salePrice || s.price || 0).toFixed(0)}</span></div>
                                                        <input placeholder="Note for your barber, like 'fade on the sides'" aria-label={`Note for ${s.name}`} value={s.note || ''} onChange={(e) => { const v = e.target.value; setSelectedServices(prev => prev.map(x => x.id === s.id ? { ...x, note: v } : x)); }} className="w-full h-9 mt-1.5 px-2.5 rounded-md text-sm" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="ticket-bottom space-y-3">
                                            <div className="flex gap-2">
                                                <input type="text" placeholder="Coupon code" aria-label="Coupon code" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} className="flex-1 min-w-0 h-10 px-3 rounded-md text-sm font-semibold tracking-wide" />
                                                <button onClick={applyCoupon} className="h-10 px-4 rounded-md border border-[rgba(26,23,20,0.35)] font-semibold text-sm">Apply</button>
                                            </div>
                                            <div className="flex items-baseline justify-between">
                                                <span className="font-semibold">Total{discountApplied ? ` with ${discountApplied.code}` : ''}</span>
                                                <span className="text-right">
                                                    {discountApplied && <span className="ticket-muted line-through mr-2">${baseTotal.toFixed(2)}</span>}
                                                    <span className="ticket-display text-3xl">${finalTotal.toFixed(2)}</span>
                                                </span>
                                            </div>
                                            <p className="text-xs ticket-muted">You pay at the shop. Cancel or move it any time from Visits.</p>
                                            <button onClick={handleBook} className="press w-full h-12 rounded-lg bg-ink text-bone font-bold text-[15px]">Book {formatHM(selectedTime)} with {barberName}</button>
                                        </div>
                                    </div>
                                </section>
                            );
                        })()}
                    </div>
                )}

                {activeTab === 'shop' && (
                    <div className="fade-in space-y-6">
                        <div>
                            <h2 className="text-3xl text-white min-[900px]:hidden">Shop</h2>
                            <p className="text-sm text-zinc-400">{user.linkedBarberId ? `Reserve products from ${barberName} and pick them up at your next visit. No payment now.` : 'Pick a barber first to see what they sell.'}</p>
                        </div>
                        {user.linkedBarberId && shopProducts.length === 0 && <div className="panel p-6 text-sm text-zinc-400">{barberName} isn't selling anything here yet.</div>}
                        {shopProducts.length > 0 && (
                            <div className="ledger">
                                {shopProducts.map(prod => {
                                    const inOrder = orderItems.find(i => i.productId === prod.id);
                                    const soldOut = prod.stock === 0;
                                    return (
                                        <div key={prod.id} className="ledger-row">
                                            {prod.imageUrl
                                                ? <button onClick={() => setImageModalUrl(prod.imageUrl)} aria-label={`See photo of ${prod.name}`} className="shrink-0"><img src={prod.imageUrl} alt="" className="w-14 h-14 object-cover rounded-lg" /></button>
                                                : <div className="w-14 h-14 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-600 shrink-0"><ShopIcon /></div>}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white font-semibold truncate">{prod.name}</div>
                                                <div className="text-sm text-zinc-400 truncate">{soldOut ? 'Sold out' : (prod.description || ' ')}</div>
                                            </div>
                                            <div className="num text-xl text-white shrink-0">${Number(prod.price || 0).toFixed(2).replace(/\.00$/, '')}</div>
                                            <button disabled={soldOut} onClick={() => {
                                                setOrderItems(prev => {
                                                    const found = prev.find(i => i.productId === prod.id);
                                                    if (found) return prev.map(i => i.productId === prod.id ? { ...i, qty: i.qty + 1 } : i);
                                                    return [...prev, { productId: prod.id, name: prod.name, price: prod.price || 0, qty: 1 }];
                                                });
                                            }} className="btn btn-secondary !min-h-[36px] !px-3 text-sm shrink-0">{inOrder ? `Add (${inOrder.qty})` : 'Add'}</button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {orderItems.length > 0 && (
                            <div className="panel p-4 space-y-3 fade-in">
                                <h3 className="text-2xl text-white">Your pickup order</h3>
                                <div className="space-y-2">
                                    {orderItems.map(it => (
                                        <div key={it.productId} className="flex items-center gap-3">
                                            <span className="flex-1 min-w-0 truncate text-white">{it.name}</span>
                                            <span className="flex items-center rounded-lg border border-zinc-800">
                                                <button onClick={() => setOrderItems(prev => prev.map(p => p.productId === it.productId ? { ...p, qty: Math.max(0, p.qty - 1) } : p).filter(p => p.qty > 0))} aria-label={`One less ${it.name}`} className="w-9 h-9 text-lg text-zinc-300">−</button>
                                                <span className="w-6 text-center text-white font-semibold">{it.qty}</span>
                                                <button onClick={() => setOrderItems(prev => prev.map(p => p.productId === it.productId ? { ...p, qty: p.qty + 1 } : p))} aria-label={`One more ${it.name}`} className="w-9 h-9 text-lg text-zinc-300">+</button>
                                            </span>
                                            <span className="num text-lg text-white w-16 text-right">${(it.price * it.qty).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-baseline justify-between border-t border-zinc-800 pt-3">
                                    <span className="text-zinc-400">Total, paid at pickup</span>
                                    <span className="num text-2xl text-gold">${orderItems.reduce((s, i) => s + (i.price * i.qty), 0).toFixed(2)}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setOrderItems([])} className="btn btn-secondary">Clear</button>
                                    <button disabled={ordering} onClick={async () => {
                                        if (orderItems.length === 0) { showToast('Add something first', 'error'); return; }
                                        setOrdering(true);
                                        try {
                                            const total = orderItems.reduce((s,i)=>s+(i.price*i.qty),0);
                                            const orderData = { clientId: user.uid, barberId: user.linkedBarberId, items: orderItems.map(i=>({ productId: i.productId, name: i.name, price: i.price, qty: i.qty })), total, status: 'pickup_requested', pickupInstructions: barberProfile?.pickupInstructions || '', createdAt: new Date().toISOString() };
                                            const docRef = await addDoc(collection(db, 'pickupOrders'), orderData);
                                            setLastPlacedOrder({ id: docRef.id, ...orderData });
                                            setShowPickupModal(true);
                                            showToast('Order reserved for pickup', 'success');
                                            setOrderItems([]);
                                        } catch(e) { console.error(e); showToast("Couldn't place the order. Try again.", 'error'); }
                                        setOrdering(false);
                                    }} className="btn btn-primary flex-1">{ordering ? 'Reserving…' : 'Reserve for pickup'}</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="fade-in space-y-7">
                        <section>
                            <h2 className="text-3xl text-white mb-3">Coming up</h2>
                            {upcomingAppts.length === 0 ? (
                                <div className="panel p-6 text-center">
                                    <p className="text-zinc-400 text-sm">Nothing booked.</p>
                                    {user.linkedBarberId && <button onClick={() => setActiveTab('book')} className="btn btn-primary mt-4">Book a cut</button>}
                                </div>
                            ) : (
                                <div className="ledger">
                                    {upcomingAppts.map(appt => (
                                        <button key={appt.id} onClick={() => { setViewingApptClient(appt); setReschedDate(appt.date); setReschedTime(appt.time || ''); }} className="ledger-row">
                                            <span className="w-[68px] shrink-0"><span className="block num text-xl text-white leading-none">{appt.time ? formatHM(appt.time) : ''}</span><span className="block text-xs text-zinc-500 mt-1">{longDate(appt.date)}</span></span>
                                            <span className="flex-1 min-w-0 text-left"><span className="block text-white font-semibold truncate">{serviceList(appt) || 'Appointment'}</span><span className="block text-sm text-zinc-400 truncate">with {barberName}</span></span>
                                            <span className="num text-lg text-white shrink-0">${apptPrice(appt).toFixed(0)}</span>
                                            <span className="text-zinc-600 shrink-0"><ChevronRight /></span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </section>
                        <section>
                            <h2 className="text-3xl text-white mb-3">Past cuts</h2>
                            {pastAppts.length === 0 ? <p className="text-sm text-zinc-500">Your past visits show up here.</p> : (
                                <div className="ledger">
                                    {pastAppts.slice().reverse().map(appt => (
                                        <div key={appt.id} className="ledger-row">
                                            <span className="w-[68px] shrink-0 text-sm text-zinc-400">{longDate(appt.date)}</span>
                                            <span className="flex-1 min-w-0 text-zinc-300 truncate">{serviceList(appt) || 'Appointment'}</span>
                                            {appt.status === 'completed' && <span className="text-green-400 text-sm font-semibold flex items-center gap-1 shrink-0 [&_svg]:w-4 [&_svg]:h-4"><Check /> Done</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </main>

            <nav className="bb-tabbar" aria-label="Sections">
                <div className="bb-tabbar-brand"><span className="logo text-3xl">Black<span className="text-gold">Book</span></span></div>
                {clientTabs.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} aria-current={activeTab === t.id ? 'page' : undefined} className={`bb-tab ${activeTab === t.id ? 'is-active' : ''}`}>{t.icon}<span>{t.label}</span></button>
                ))}
            </nav>

            {imageModalUrl && (
                <div className="bb-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setImageModalUrl(null); }}>
                    <div className="relative max-w-[92vw] max-h-[88vh] m-auto">
                        <img src={imageModalUrl} alt="Product" className="max-w-full max-h-[80vh] rounded-xl" />
                        <button onClick={() => setImageModalUrl(null)} aria-label="Close photo" className="icon-btn absolute top-2 right-2 bg-black/70 !text-white"><XIcon /></button>
                    </div>
                </div>
            )}

            {showPickupModal && lastPlacedOrder && (
                <Sheet title="Reserved" onClose={() => setShowPickupModal(false)} footer={<>
                    <button onClick={() => { setShowPickupModal(false); setViewingOrder(lastPlacedOrder); }} className="btn btn-secondary flex-1">See order</button>
                    <button onClick={() => setShowPickupModal(false)} className="btn btn-primary flex-1">Done</button>
                </>}>
                    <p className="text-zinc-300">{lastPlacedOrder.pickupInstructions || `${barberName} has your order. Pick it up and pay at your next visit.`}</p>
                </Sheet>
            )}

            {viewingOrder && (
                <Sheet title="Your order" onClose={() => setViewingOrder(null)}>
                    <div className="ledger">
                        {viewingOrder.items && viewingOrder.items.map((it, i) => (
                            <div key={i} className="px-4 py-3 flex justify-between gap-3"><span className="text-white">{it.name} <span className="text-zinc-500">×{it.qty}</span></span><span className="num text-lg text-white">${(it.price * it.qty).toFixed(2)}</span></div>
                        ))}
                    </div>
                    <p className="text-sm text-zinc-400 mt-4">Pickup: {viewingOrder.pickupInstructions || 'at your next visit'}</p>
                    <p className="text-xs text-zinc-600 mt-2">Order {viewingOrder.id}</p>
                </Sheet>
            )}

            {viewingApptClient && (
                <Sheet title={longDate(viewingApptClient.date)} onClose={() => setViewingApptClient(null)}>
                    <p className="-mt-3 mb-4 text-zinc-400">{viewingApptClient.time ? formatHM(viewingApptClient.time) : ''} with {barberName}</p>
                    <div className="ledger">
                        {(viewingApptClient.services && viewingApptClient.services.length > 0) ? viewingApptClient.services.map((s, i) => (
                            <div key={i} className="px-4 py-3 flex justify-between gap-3">
                                <div className="min-w-0"><div className="text-white font-semibold">{s.name}</div>{s.note && <div className="text-sm text-zinc-400">{s.note}</div>}</div>
                                <div className="num text-lg text-white shrink-0">${Number(s.salePrice || s.price || 0).toFixed(0)}</div>
                            </div>
                        )) : <div className="px-4 py-3 text-white">{viewingApptClient.service || 'Appointment'}</div>}
                    </div>
                    <div className="mt-5">
                        <span className="field-label">Move it</span>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                            <input type="date" value={reschedDate} onChange={e => setReschedDate(e.target.value)} aria-label="New date" className={inputCls} />
                            <input type="time" value={reschedTime} onChange={e => setReschedTime(e.target.value)} aria-label="New time" className={`${inputCls} w-32`} />
                        </div>
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-2">
                        <button onClick={() => openEditFromView(viewingApptClient)} className="btn btn-secondary">Change services</button>
                        <button onClick={async () => {
                            if (!reschedDate || !reschedTime) { showToast('Pick a new date and time', 'error'); return; }
                            try {
                                const q = query(collection(db, "appointments"), where("userId", "==", user.linkedBarberId), where("date", "==", reschedDate), where("time", "==", reschedTime));
                                const snap = await getDocs(q);
                                const conflicts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.status !== 'cancelled');
                                if (conflicts.length > 0 && !(conflicts.length === 1 && conflicts[0].id === viewingApptClient.id)) { showToast('That time is taken. Pick another.', 'error'); return; }
                                await updateDoc(doc(db, 'appointments', viewingApptClient.id), { date: reschedDate, time: reschedTime, updatedAt: new Date().toISOString(), lastModifiedBy: user.uid });
                                showToast('Appointment moved', 'success'); setViewingApptClient(null);
                            } catch(e){ showToast("Couldn't move it. Try again.", 'error'); }
                        }} className="btn btn-primary">Move appointment</button>
                        <button onClick={async () => { if (await showConfirm({ message: 'Cancel appointment?' })) { try { await updateDoc(doc(db, 'appointments', viewingApptClient.id), { status: 'cancelled', updatedAt: new Date().toISOString(), lastModifiedBy: user.uid }); showToast('Appointment cancelled', 'success'); setViewingApptClient(null); } catch(e){ showToast("Couldn't cancel. Try again.", 'error'); } } }} className="btn btn-danger col-span-2">Cancel appointment</button>
                    </div>
                </Sheet>
            )}

            {showChat && <ChatWindow currentUser={user} chatPartnerUid={user.linkedBarberId} chatPartnerName={barberName} onClose={() => setShowChat(false)} />}
            {showSupport && <SupportModal user={user} onClose={() => setShowSupport(false)} />}

            {showUserSettings && (
                <Sheet title="Your account" onClose={() => setShowUserSettings(false)} footer={<>
                    <button onClick={() => setShowUserSettings(false)} className="btn btn-secondary flex-1">Cancel</button>
                    <button onClick={saveClientSettings} disabled={newProfileUploading} className="btn btn-primary flex-1">{newProfileUploading ? 'Uploading…' : 'Save'}</button>
                </>}>
                    <div className="space-y-5">
                        <div className="flex items-center gap-4">
                            {newProfileImageUrl || userProfile.photoURL
                                ? <img src={newProfileImageUrl || userProfile.photoURL} alt="" className="w-16 h-16 rounded-full object-cover border border-zinc-800" />
                                : <span className="avatar w-16 h-16 text-2xl">{(editFirstName || 'U').charAt(0)}</span>}
                            <div className="flex flex-wrap gap-2">
                                <label className="btn btn-secondary !min-h-[36px] !px-3 text-sm cursor-pointer">
                                    {userProfile.photoURL || newProfileImageUrl ? 'Change photo' : 'Add photo'}
                                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) { setNewProfileImageFile(f); setNewProfileImageUrl(URL.createObjectURL(f)); } }} />
                                </label>
                                {(userProfile.photoURL || newProfileImageUrl) && (
                                    <button type="button" onClick={async () => {
                                        if (!userProfile?.photoPath) { setNewProfileImageFile(null); setNewProfileImageUrl(''); return; }
                                        if (!await showConfirm({ message: 'Remove profile photo?' })) return;
                                        try { await deleteObject(storageRef(getStorage(), userProfile.photoPath)); } catch (e) { console.warn('Failed deleting avatar from storage', e); }
                                        try { await updateDoc(doc(db, 'users', user.uid), { photoURL: '', photoPath: '', updatedAt: new Date().toISOString() }); } catch(e){}
                                        try {
                                            if (userProfile && userProfile.linkedBarberId) {
                                                const q = query(collection(db, 'clients'), where('userId', '==', userProfile.linkedBarberId), where('email', '==', user.email));
                                                const snap = await getDocs(q);
                                                for (const d of snap.docs) await updateDoc(doc(db, 'clients', d.id), { photoURL: '', photoPath: '' });
                                            }
                                        } catch(e){ console.warn('Failed clearing client records', e); }
                                        setNewProfileImageFile(null); setNewProfileImageUrl('');
                                        showToast('Profile photo removed', 'success');
                                    }} className="btn btn-ghost !min-h-[36px] !px-3 text-sm">Remove</button>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="First name"><input value={editFirstName} onChange={e => setEditFirstName(e.target.value)} className={inputCls} /></Field>
                            <Field label="Last name"><input value={editLastName} onChange={e => setEditLastName(e.target.value)} className={inputCls} /></Field>
                        </div>
                        <Field label="Phone"><input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} className={inputCls} /></Field>
                        <div>
                            <span className="field-label">Remind me by</span>
                            <div className="flex flex-wrap gap-x-5 gap-y-2">
                                <label className="flex items-center gap-2 text-white"><input type="checkbox" checked={notifEmail} onChange={e => setNotifEmail(e.target.checked)} className="w-5 h-5" /> Email</label>
                                <label className="flex items-center gap-2 text-white"><input type="checkbox" checked={notifSMS} onChange={e => setNotifSMS(e.target.checked)} className="w-5 h-5" /> Text</label>
                                <label className="flex items-center gap-2 text-white"><input type="checkbox" checked={notifPush} onChange={e => setNotifPush(e.target.checked)} className="w-5 h-5" /> Push</label>
                            </div>
                        </div>
                        <Field label="How early">
                            <select value={reminderHours} onChange={e => setReminderHours(e.target.value)} className={inputCls}>
                                <option value={1}>1 hour before</option>
                                <option value={6}>6 hours before</option>
                                <option value={24}>1 day before</option>
                                <option value={48}>2 days before</option>
                            </select>
                        </Field>
                        <p className="text-xs text-zinc-500">Saved combos live on this device only.</p>
                    </div>
                </Sheet>
            )}

            {showEditAppt && (
                <Sheet title="Change appointment" onClose={() => { setShowEditAppt(false); setEditingAppointmentId(null); }} footer={<>
                    <button onClick={() => { setShowEditAppt(false); setEditingAppointmentId(null); }} className="btn btn-secondary flex-1">Cancel</button>
                    <button onClick={async () => {
                        if (!editingAppointmentId) { showToast('No appointment selected', 'error'); return; }
                        if (!selectedDate || !selectedTime) { showToast('Pick a date and time', 'error'); return; }
                        try {
                            const totalDuration = selectedServices && selectedServices.length > 0 ? selectedServices.reduce((sum, s) => sum + (s.duration || barberProfile?.slotDuration || 60), 0) : (barberProfile?.slotDuration || 60);
                            const q = query(collection(db, "appointments"), where("userId", "==", user.linkedBarberId), where("date", "==", selectedDate), where("time", "==", selectedTime));
                            const snap = await getDocs(q);
                            const conflicts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.status !== 'cancelled');
                            if (conflicts.length > 0 && !(conflicts.length === 1 && conflicts[0].id === editingAppointmentId)) { showToast('That time is taken. Pick another.', 'error'); return; }
                            const servicesPayload = selectedServices.map(s => ({ id: s.id || null, name: s.name, price: s.price, salePrice: s.salePrice || null, note: s.note || '' }));
                            await updateDoc(doc(db, 'appointments', editingAppointmentId), { services: servicesPayload, totalDuration, date: selectedDate, time: selectedTime, updatedAt: new Date().toISOString(), lastModifiedBy: user.uid });
                            showToast('Appointment updated', 'success');
                            setShowEditAppt(false);
                            setEditingAppointmentId(null);
                            setSelectedServices([]); setSelectedDate(''); setSelectedTime('');
                        } catch (e) { showToast("Couldn't update it. Try again.", 'error'); }
                    }} className="btn btn-primary flex-1">Save changes</button>
                </>}>
                    <div className="ledger">
                        {selectedServices.map((s, i) => (
                            <div key={i} className="px-4 py-3">
                                <div className="flex justify-between gap-3"><span className="text-white font-semibold">{s.name}</span><span className="num text-lg text-white">${Number(s.salePrice || s.price || 0).toFixed(0)}</span></div>
                                <input placeholder="Note for your barber" aria-label={`Note for ${s.name}`} value={s.note || ''} onChange={(e) => { const v = e.target.value; setSelectedServices(prev => prev.map(x => x === s ? { ...x, note: v } : x)); }} className={`${inputCls} !h-9 mt-2 text-sm`} />
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-2 mt-4">
                        <Field label="Date"><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className={inputCls} /></Field>
                        <Field label="Time"><input type="time" value={selectedTime} onChange={e => setSelectedTime(e.target.value)} className={`${inputCls} w-32`} /></Field>
                    </div>
                </Sheet>
            )}
        </div>
    );
}

// --- LOGIN SCREEN (With Home Button) ---
function LoginScreen({ onBack, initialMode, startRegister = false }) {
    const [isLogin, setIsLogin] = useState(!startRegister); const [isReset, setIsReset] = useState(false); const [signupStep, setSignupStep] = useState(1); const [selectedPlan, setSelectedPlan] = useState('free');
    const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [firstName, setFirstName] = useState(""); const [phone, setPhone] = useState(""); const [referralCode, setReferralCode] = useState("");
    const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [pendingBarber] = useState(() => readPendingBarber()); // chosen on the public map before signing up
    const plansRef = useRef(null);
    const scrollPlans = (dir = 1) => {
        const el = plansRef.current;
        if (!el) return;
        // scroll by one card width (approx)
        const card = el.querySelector('[data-plan-card]');
        const step = (card ? card.offsetWidth : el.clientWidth) + 12;
        el.scrollBy({ left: dir * step, behavior: 'smooth' });
    };
    const handleKeyNav = (e) => {
        if (e.key === 'ArrowLeft') scrollPlans(-1);
        if (e.key === 'ArrowRight') scrollPlans(1);
    };
    useEffect(() => { window.addEventListener('keydown', handleKeyNav); return () => window.removeEventListener('keydown', handleKeyNav); }, []);
    // Initialize isClientMode based on the passed 'initialMode' prop ('client' -> true, 'barber' -> false)
    const [isClientMode, setIsClientMode] = useState(initialMode === 'client');

    // Invite links (?ref=CODE) are for new clients: open sign-up and show who sent the invite
    const [inviteName, setInviteName] = useState('');
    useEffect(() => {
        const refCode = new URLSearchParams(window.location.search).get('ref');
        if (!refCode) return;
        setIsClientMode(true); setIsLogin(false); setReferralCode(refCode);
        (async () => {
            try {
                const codeSnap = await getDoc(doc(db, 'referralCodes', refCode.trim().toUpperCase()));
                const card = await getDoc(doc(db, 'barberProfiles', codeSnap.exists() ? codeSnap.data().barberId : refCode.trim()));
                if (card.exists()) setInviteName(barberLabel(card.data()));
            } catch (e) { /* the code is still checked at sign-up */ }
        })();
    }, []);
    // Keep the address bar and tab title in step with the form, so /login and /signup are real pages
    const formPath = isLogin || isReset ? '/login' : isClientMode ? '/signup' : '/barbers/signup';
    useEffect(() => {
        document.title = `${isLogin || isReset ? 'Log in' : isClientMode ? 'Create an account' : 'Barber sign-up'}: BlackBook`;
        if (window.location.search || window.location.hash) return; // invite links keep their ?ref
        if (window.location.pathname !== formPath) history.replaceState(null, '', formPath);
    }, [formPath]);
    const handleReset = async (e) => { e.preventDefault(); if(!email) { setError("Please enter your email."); return; } setLoading(true); try { await sendPasswordResetEmail(auth, email); setMessage("Link sent."); } catch (err) { setError(err.message); } setLoading(false); };
            const handleInitialSubmit = async (e) => {
                e.preventDefault(); setError("");
                if (isLogin) {
                    setLoading(true);
                    try { await signInWithEmailAndPassword(auth, email, password); }
                    catch (err) { setError(err.message.replace("Firebase: ", "")); setLoading(false); }
                    return;
                }

                // Registration flow
                if (password.length < 6) { setError("Password too short."); return; }

                // Client registration: a referral code links your barber; without one you can pick from the map
                if (isClientMode) {
                    if (!firstName || !phone) { setError("Name and phone are required."); return; }
                    setLoading(true);
                    try {
                        let linkedBarberId = null, source = "Joined via Invite";
                        const code = referralCode.trim();
                        if (code) {
                            // Custom codes live in referralCodes. A barber's default code is their account id,
                            // which has a public card in barberProfiles once they've opened their dashboard.
                            const codeSnap = await getDoc(doc(db, "referralCodes", code.toUpperCase()));
                            if (codeSnap.exists()) linkedBarberId = codeSnap.data().barberId;
                            else { const pSnap = await getDoc(doc(db, "barberProfiles", code)); if (pSnap.exists()) linkedBarberId = code; }
                        } else if (pendingBarber) {
                            linkedBarberId = pendingBarber.id; source = "Booked via BlackBook map";
                        }
                        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                        const clientUid = userCredential.user.uid;
                        // Signed in now, so a barber's account record can be checked for codes the public lookups missed
                        let unmatchedCode = false;
                        if (code && !linkedBarberId) {
                            try { const uSnap = await getDoc(doc(db, "users", code)); if (uSnap.exists() && uSnap.data().role === 'barber') linkedBarberId = code; } catch (e) { /* not a barber id */ }
                            unmatchedCode = !linkedBarberId;
                        }
                        if (unmatchedCode) showToast("That referral code didn't match a barber. You can pick one on the map.", 'error', 6000);
                        await setDoc(doc(db, "users", clientUid), { email, firstName, phone, joined: new Date().toISOString(), role: "client", linkedBarberId, barberIds: linkedBarberId ? [linkedBarberId] : [] });
                        if (linkedBarberId) await addToBarberRoster({ barberId: linkedBarberId, clientUid, name: firstName, phone, email, source });
                        clearPendingBarber();
                    } catch (err) { setError(err.message.replace("Firebase: ", "")); setLoading(false); }
                    return;
                }

                // Barber registration: go to full Plans page (separate route)
                if (!isClientMode && signupStep === 1) {
                    // validate basic fields before moving to plan step
                    if (!firstName || !phone) { setError("All fields required."); return; }
                    // check if email already exists in Firebase Auth; if so, block progression
                    try {
                        const methods = await fetchSignInMethodsForEmail(auth, email);
                        if (methods && methods.length) { setError('Email already in use. Please log in or use a different email.'); return; }
                    } catch (chkErr) {
                        console.warn('Email existence check failed', chkErr);
                        // allow progression on error but surface a warning
                    }
                    const signupData = { firstName, phone, email, password, businessName: '', referralCode };
                    try { history.pushState({ signupData }, '', '#/plans'); window.dispatchEvent(new Event('hashchange')); } catch(e) { window.location.hash = '#/plans'; }
                    return;
                }

                
            };
    const handleBarberSignup = async () => {
        setLoading(true);
        let initialCredits = 0;
        if (selectedPlan === 'pro') initialCredits = 500;
        if (selectedPlan === 'mogul') initialCredits = 1500;
        // basic and free start with 0 credits
        const storedPlan = selectedPlan === 'free' ? 'free_trial' : selectedPlan; // map UI 'free' -> stored 'free_trial'
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const userDoc = {
                email,
                firstName,
                phone,
                joined: new Date().toISOString(),
                role: "barber",
                plan: storedPlan,
                credits: initialCredits,
                shopOpen: "09:00",
                shopClose: "17:00",
                lunchStart: "",
                lunchEnd: "",
                slotDuration: 60
            };
            if (storedPlan === 'free_trial') {
                userDoc.trialStartDate = new Date().toISOString();
                userDoc.trialLengthDays = 90;
            }
            await setDoc(doc(db, "users", userCredential.user.uid), userDoc);
        } catch (err) {
            console.error('handleBarberSignup error', err);
            setError(err.message);
            setSignupStep(1);
            setLoading(false);
        }
    };

    const heading = isReset ? 'Reset your password'
        : isLogin ? 'Welcome back'
        : isClientMode ? 'Book your next cut' : 'Put your chair on BlackBook';
    const subheading = isReset ? "Enter your email and we'll send you a link."
        : isLogin ? 'Log in to book a cut or run your chair.'
        : isClientMode ? 'Create a free account. It takes a minute.' : 'Create your account, then pick a plan.';

    return (
        <div className="min-h-screen min-h-[100dvh] w-full grid min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] bg-black">
            <aside className="hidden min-[900px]:flex relative overflow-hidden flex-col justify-between p-12 border-r border-zinc-800">
                <Photo photo={PHOTOS.beard} sizes="50vw" className="!absolute inset-0" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.55),rgba(0,0,0,0.35)_40%,rgba(0,0,0,0.9))]" aria-hidden="true" />
                <Link to="/" className="relative logo text-3xl self-start" aria-label="BlackBook home">Black<span className="text-gold">Book</span></Link>
                <div className="relative">
                    <p className="font-display font-black text-[88px] leading-[0.88] text-white">Every chair.<br />One book.</p>
                    <p className="text-zinc-300 mt-6 max-w-sm text-lg">Clients find a barber and book in seconds. Barbers run their whole day from one place.</p>
                </div>
                <span className="relative text-sm text-zinc-400">© {new Date().getFullYear()} BlackBook</span>
            </aside>

            <div className="flex flex-col px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-10 min-[900px]:px-16 min-[900px]:justify-center">
                <div className="flex items-center justify-between mb-10 min-[900px]:absolute min-[900px]:top-8 min-[900px]:right-10 min-[900px]:mb-0">
                    {onBack ? <button onClick={onBack} className="btn btn-ghost !px-0 -ml-1"><ChevronLeft /> Back</button> : <span />}
                    <Link to="/" className="logo text-2xl min-[900px]:hidden" aria-label="BlackBook home">Black<span className="text-gold">Book</span></Link>
                </div>

                <div className="w-full max-w-sm mx-auto min-[900px]:mx-0 fade-in">
                    <h1 className="text-5xl text-white">{heading}</h1>
                    <p className="text-zinc-400 mt-2">{subheading}</p>

                    {isReset ? (
                        <form onSubmit={handleReset} className="space-y-4 mt-8">
                            <Field label="Email"><input type="email" autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
                            {message && <p role="status" className="text-green-400 text-sm">{message === 'Link sent.' ? 'Check your inbox for the reset link.' : message}</p>}
                            {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
                            <button type="submit" disabled={loading} className="btn btn-primary w-full">{loading ? 'Sending…' : 'Send reset link'}</button>
                            <button type="button" onClick={() => { setIsReset(false); setError(""); setMessage(""); }} className="btn btn-ghost w-full">Back to log in</button>
                        </form>
                    ) : (
                        <>
                            {!isLogin && (
                                <div className="mt-8 grid grid-cols-2 p-1 rounded-xl bg-zinc-900 border border-zinc-800" role="radiogroup" aria-label="Account type">
                                    {[[true, "I'm booking"], [false, "I'm a barber"]].map(([client, label]) => (
                                        <button key={label} type="button" role="radio" aria-checked={isClientMode === client} onClick={() => { setIsClientMode(client); setError(""); }} className={`h-10 rounded-lg text-sm font-semibold transition-colors ${isClientMode === client ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>{label}</button>
                                    ))}
                                </div>
                            )}

                            <form onSubmit={handleInitialSubmit} className="space-y-4 mt-6">
                                {isClientMode && !isLogin && ((pendingBarber && !referralCode) || inviteName) && (
                                    <div className="fade-in panel px-4 py-3 text-sm text-zinc-300 flex items-center gap-2"><span className="text-gold [&>svg]:w-4 [&>svg]:h-4"><PinIcon /></span>{inviteName ? <>Invited by <span className="text-white font-semibold">{inviteName}</span></> : <>Booking with <span className="text-white font-semibold">{pendingBarber.name || 'your barber'}</span></>}</div>
                                )}
                                {!isLogin && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="First name"><input type="text" autoComplete="given-name" className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></Field>
                                        <Field label="Phone"><input type="tel" autoComplete="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field>
                                    </div>
                                )}
                                <Field label="Email"><input type="email" autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
                                <Field label="Password" hint={!isLogin ? 'At least 6 characters' : undefined}>
                                    <div className="relative">
                                        <input type={passwordVisible ? "text" : "password"} autoComplete={isLogin ? 'current-password' : 'new-password'} className={`${inputCls} pr-16`} value={password} onChange={(e) => setPassword(e.target.value)} required />
                                        <button type="button" onClick={() => setPasswordVisible(v => !v)} aria-label={passwordVisible ? 'Hide password' : 'Show password'} className="absolute right-1 top-1/2 -translate-y-1/2 h-9 px-3 rounded-md text-sm font-semibold text-zinc-400 hover:text-white">{passwordVisible ? 'Hide' : 'Show'}</button>
                                    </div>
                                </Field>
                                {isClientMode && !isLogin && (
                                    <Field label="Barber's referral code" hint={pendingBarber ? 'Optional' : "Optional. No code? Pick a barber on the map after you sign up."}>
                                        <input type="text" className={`${inputCls} uppercase font-semibold tracking-wide`} value={referralCode} onChange={(e) => setReferralCode(e.target.value)} />
                                    </Field>
                                )}

                                {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

                                <button type="submit" disabled={loading} className="btn btn-primary w-full !min-h-[48px]">{loading ? 'One moment…' : isLogin ? 'Log in' : isClientMode ? 'Create account' : 'Continue to plans'}</button>
                            </form>

                            <div className="mt-6 flex items-center justify-between text-sm">
                                <button onClick={() => { setIsLogin(!isLogin); setError(""); }} className="text-zinc-300 hover:text-white">{isLogin ? <>New here? <span className="text-gold font-semibold">Create an account</span></> : <>Have an account? <span className="text-gold font-semibold">Log in</span></>}</button>
                                {isLogin && <button onClick={() => setIsReset(true)} className="text-zinc-400 hover:text-white">Forgot password?</button>}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- ADMIN DASHBOARD ---
function AdminDashboard({ adminUser }) {
    const [users, setUsers] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null); 
    const [view, setView] = useState('barbers'); // barbers, clients, support
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Edit Modal
    const [editingUser, setEditingUser] = useState(null);
    const [editBillingDays, setEditBillingDays] = useState(30);
    const [editBillingMode, setEditBillingMode] = useState('extend'); // extend | set
    
    // Support Modal
    const [activeTicket, setActiveTicket] = useState(null);
    const [replyText, setReplyText] = useState("");
    // Admin enhancements
    const [showActivity, setShowActivity] = useState(false);
    const [adminLogs, setAdminLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [showRolesPanel, setShowRolesPanel] = useState(false);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [showAuditExport, setShowAuditExport] = useState(false);
    // Discounts management state
    const [discounts, setDiscounts] = useState([]);
    const [discountsLoading, setDiscountsLoading] = useState(true);
    const [newDiscount, setNewDiscount] = useState({ code: '', type: 'free', value: 0, planId: '' });
    // (license keys removed per admin request)
    // Additional analytics state
    const [bookingsCount30, setBookingsCount30] = useState(0);
    const [monthlyRevenue, setMonthlyRevenue] = useState(0);
    const [avgBookingValue, setAvgBookingValue] = useState(0);
    const [weeklySignups, setWeeklySignups] = useState(0);
    const [signupSeries, setSignupSeries] = useState([]); // last 7 days series
    const cannedReplies = [
        'Thanks — we\'re looking into this.',
        'Resolved: please verify and confirm.',
        'We need more info. Please send screenshots.'
    ];

    useEffect(() => {
        const fetchData = async () => {
            try {
                const snapUsers = await getDocs(collection(db, "users"));
                setUsers(snapUsers.docs.map(d => ({id: d.id, ...d.data()})));
                setLoading(false);
            } catch(e) { console.error(e); setError("Admin Access Denied."); setLoading(false); }
        };
        fetchData();
        const unsubTickets = onSnapshot(query(collection(db, "tickets")), (snapshot) => {
            const t = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            t.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
            setTickets(t);
        }, (e) => console.error('tickets snapshot', e));
        const unsubDiscounts = onSnapshot(query(collection(db, 'discountCodes'), orderBy('createdAt', 'desc')), (snap) => {
            setDiscounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setDiscountsLoading(false);
        }, (e) => { console.error('discounts snapshot', e); setDiscountsLoading(false); });
        return () => { unsubTickets(); unsubDiscounts(); };
    }, []);

    const fetchAdminLogs = async () => {
        setLoadingLogs(true);
        try {
            const qLogs = query(collection(db, 'adminLogs'), orderBy('createdAt', 'desc'), limit(500));
            const snap = await getDocs(qLogs);
            setAdminLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
        setLoadingLogs(false);
    };

    const exportLogsCSV = (logs) => {
        const rows = [['timestamp','actor','action','details']];
        logs.forEach(l => rows.push([l.createdAt || '', l.actor || '', l.action || '', (l.details && JSON.stringify(l.details)) || '']));
        const csv = rows.map(r => r.map(c => '"' + String(c || '').replace(/"/g,'""') + '"').join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `admin_logs_${Date.now()}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    };

    // Admin helpers: user billing adjustments

    const grantDurationToUser = async (userId, days = 30, mode = 'extend') => {
        if (!userId) { showToast('No user selected', 'error'); return; }
        try {
            const userRef = doc(db, 'users', userId);
            const snap = await getDoc(userRef);
            const now = new Date();
            let newDue;
            const dms = (parseInt(days) || 0) * 24 * 60 * 60 * 1000;
            if (mode === 'extend' && snap.exists() && snap.data().billingNextDue) {
                const cur = new Date(snap.data().billingNextDue);
                newDue = new Date(Math.max(cur.getTime(), now.getTime()) + dms);
            } else {
                newDue = new Date(now.getTime() + dms);
            }
            await updateDoc(userRef, { billingNextDue: newDue.toISOString(), billingUpdatedAt: new Date().toISOString() });
            showToast('Billing updated', 'success');
        } catch (e) { console.error(e); showToast('Failed updating billing', 'error'); }
    };

    const formatTimeLeft = (iso) => {
        if (!iso) return '—';
        try {
            const due = new Date(iso);
            const now = new Date();
            const diff = due - now;
            if (diff <= 0) return 'Due';
            const days = Math.floor(diff / (24*60*60*1000));
            const hours = Math.floor((diff % (24*60*60*1000)) / (60*60*1000));
            const mins = Math.floor((diff % (60*60*1000)) / (60*1000));
            const parts = [];
            if (days > 0) parts.push(`${days}d`);
            if (hours > 0) parts.push(`${hours}h`);
            parts.push(`${mins}m`);
            return parts.join(' ');
        } catch (e) { return '—'; }
    };

    // Fetch bookings/payments and compute analytics where possible
    useEffect(() => {
        const computeAnalytics = async () => {
            try {
                // Weekly signups from users' createdAt if present
                if (users && users.length) {
                    const now = Date.now();
                    const weekMs = 7 * 24 * 60 * 60 * 1000;
                    const recent = users.filter(u => u.createdAt && (now - new Date(u.createdAt).getTime()) <= weekMs).length;
                    setWeeklySignups(recent);

                    // build signup series for last 7 days
                    const days = Array.from({length:7}, (_,i)=>{ const d = new Date(); d.setDate(d.getDate() - (6-i)); return d; });
                    const series = days.map(day => {
                        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
                        const end = start + 24*60*60*1000;
                        return users.filter(u => u.createdAt && (new Date(u.createdAt).getTime() >= start && new Date(u.createdAt).getTime() < end)).length;
                    });
                    setSignupSeries(series);
                }

                // Try to read bookings collection if present
                try {
                    const snap = await getDocs(collection(db, 'bookings'));
                    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    const now = Date.now();
                    const days30 = 30 * 24 * 60 * 60 * 1000;
                    const recent30 = all.filter(b => b.createdAt && (now - new Date(b.createdAt).getTime()) <= days30);
                    setBookingsCount30(recent30.length);
                    const amounts = recent30.map(r => Number(r.amount || r.price || 0)).filter(v => !isNaN(v));
                    const total = amounts.reduce((s,a) => s + a, 0);
                    setAvgBookingValue(amounts.length ? (total / amounts.length) : 0);
                } catch(e){ console.debug('No bookings collection or fetch failed', e); }

                // Try to read payments/transactions for revenue
                try {
                    const snap = await getDocs(collection(db, 'payments'));
                    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    const now = new Date();
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
                    const revenue = all.filter(p => p.createdAt && new Date(p.createdAt).getTime() >= monthStart).reduce((s,p) => s + Number(p.amount || 0), 0);
                    setMonthlyRevenue(revenue || 0);
                } catch(e){ console.debug('No payments collection or fetch failed', e); }
            } catch(e) { console.error('Analytics compute failed', e); }
        };
        computeAnalytics();
    }, [users]);

    const changeUserRole = async (uid, newRole) => {
        try { await updateDoc(doc(db, 'users', uid), { role: newRole }); setUsers(users.map(u => u.id === uid ? { ...u, role: newRole } : u)); showToast('Role updated', 'success'); }
        catch(e){ showToast('Failed to update role', 'error'); }
    };

    const assignTicketToAdmin = async (ticketId) => {
        try { await updateDoc(doc(db, 'tickets', ticketId), { assignedTo: adminUser.email }); setTickets(tickets.map(t => t.id === ticketId ? { ...t, assignedTo: adminUser.email } : t)); showToast('Assigned', 'success'); }
        catch(e){ showToast('Assign failed', 'error'); }
    };

    const replyWithCanned = async (ticket, template) => {
        if(!ticket) return;
        const newMsg = { sender: 'admin', text: template, time: new Date().toISOString() };
        const updated = [...(ticket.messages||[]), newMsg];
        try { await updateDoc(doc(db, 'tickets', ticket.id), { messages: updated, status: 'replied' }); showToast('Replied', 'success'); }
        catch(e){ showToast('Reply failed', 'error'); }
    };

    const filteredUsers = users.filter(u => 
        (view === 'barbers' ? u.role === 'barber' : u.role === 'client') &&
        (u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || u.firstName?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const barbersCount = users.filter(u => u.role === 'barber').length;
    const clientsCount = users.filter(u => u.role === 'client').length;
    const openTicketsCount = tickets.filter(t => t.status === 'open').length;

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        try {
            const { id, ...fields } = editingUser;
            await updateDoc(doc(db, "users", id), fields);
            setUsers(users.map(u => u.id === editingUser.id ? editingUser : u));
            setEditingUser(null);
            showToast("Updated.", 'success');
        } catch(e) { showToast("Failed.", 'error'); }
    };

    const handleDeleteUser = async (uid) => { if(await showConfirm({ title: 'Danger', message: 'Delete user?' })) { await deleteDoc(doc(db, "users", uid)); setUsers(users.filter(u => u.id !== uid)); } };
    const handleResetPassword = async (email) => { if(await showConfirm({ message: `Reset ${email}?` })) { await sendPasswordResetEmail(auth, email); showToast("Sent.", 'success'); } };

    const sendAdminReply = async (e) => {
        e.preventDefault();
        if(!replyText || !activeTicket) return;
        const newMsg = { sender: 'admin', text: replyText, time: new Date().toISOString() };
        const live = tickets.find(t => t.id === activeTicket.id) || activeTicket; // latest messages, not the copy from when it was opened
        const updatedMessages = [...(live.messages || []), newMsg];
        await updateDoc(doc(db, "tickets", activeTicket.id), { messages: updatedMessages, status: 'replied' });
        setReplyText("");
        // Optimistic update locally not needed as snapshot handles it
    };

    // --- Discounts management actions ---
    const createDiscount = async () => {
        const code = (newDiscount.code || '').toUpperCase().trim();
        if (!code) { showToast('Enter a code', 'error'); return; }
        try {
            await addDoc(collection(db, 'discountCodes'), { code, type: newDiscount.type || 'free', value: Number(newDiscount.value) || 0, planId: newDiscount.planId || '', active: true, createdAt: new Date().toISOString() });
            setNewDiscount({ code: '', type: 'free', value: 0, planId: '' });
            showToast('Discount created', 'success');
        } catch (e) { console.error(e); showToast('Create failed', 'error'); }
    };

    const toggleDiscountActive = async (id, current) => {
        try { await updateDoc(doc(db, 'discountCodes', id), { active: !current }); showToast('Updated', 'success'); }
        catch(e){ console.error(e); showToast('Update failed', 'error'); }
    };

    const deleteDiscount = async (id) => {
        if (!id) return;
        if (!(await showConfirm({ title: 'Delete Code', message: 'Delete this discount code?' }))) return;
        try { await deleteDoc(doc(db, 'discountCodes', id)); showToast('Deleted', 'success'); }
        catch(e){ console.error(e); showToast('Delete failed', 'error'); }
    };

    if (selectedUser) return (
        <div className="relative min-h-screen">
            <div className="fixed top-0 inset-x-0 z-[45] h-9 bg-oxblood text-white text-sm flex items-center justify-between px-4">
                <span className="truncate">Viewing as <strong>{selectedUser.firstName || selectedUser.email}</strong>. Anything you change is real.</span>
                <button onClick={() => setSelectedUser(null)} className="font-semibold underline underline-offset-2 shrink-0 ml-3">Exit</button>
            </div>
            <Dashboard user={{uid: selectedUser.id}} isGhost={true} />
        </div>
    );
    if (error) return <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center"><div className="panel p-8 max-w-sm"><h2 className="text-3xl text-white">No access</h2><p className="text-zinc-400 mt-2">{error}</p><button onClick={() => signOut(auth)} className="btn btn-secondary mt-5">Sign out</button></div></div>;

    const adminTabs = [
        { id: 'barbers', label: 'Barbers', icon: <Scissors /> },
        { id: 'clients', label: 'Clients', icon: <Users /> },
        { id: 'support', label: 'Support', icon: <SupportIcon />, badge: openTicketsCount },
        { id: 'discounts', label: 'Discounts', icon: <DollarSign /> },
        { id: 'analytics', label: 'Analytics', icon: <ListIcon /> },
        { id: 'activity', label: 'Activity', icon: <ClockIcon /> },
        { id: 'roles', label: 'Roles', icon: <UserIcon /> },
    ];
    const planName = (p) => ({ free_trial: 'Free trial', free: 'Free trial', basic: 'Basic', pro: 'Pro', mogul: 'Mogul' }[p] || 'Free trial');
    const title = (adminTabs.find(t => t.id === view) || {}).label || 'Control center';
    const openTicket = activeTicket && tickets.find(t => t.id === activeTicket.id) || activeTicket;

    return (
        <div className="bb-app">
            <header className="bb-topbar">
                <div className="flex-1 min-w-0 flex items-center gap-3">
                    <span className="logo text-[26px] min-[900px]:hidden">Black<span className="text-gold">Book</span></span>
                    <h1 className="hidden min-[900px]:block text-3xl text-white">{title}</h1>
                </div>
                <span className="chip !text-red-300 !border-red-900">Admin</span>
                <button onClick={() => signOut(auth)} aria-label="Sign out" title="Sign out" className="icon-btn"><LogOut /></button>
            </header>

            <main className="bb-main">
                {(view === 'barbers' || view === 'clients') && (
                    <div className="fade-in space-y-5">
                        <div>
                            <h2 className="text-3xl text-white min-[900px]:hidden">{title}</h2>
                            <p className="text-sm text-zinc-400">{view === 'barbers' ? `${barbersCount} barbers` : `${clientsCount} clients`} with an account.</p>
                        </div>
                        <input type="search" placeholder="Search name or email" aria-label="Search users" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={inputCls} />
                        {loading ? <div className="panel p-6 text-zinc-400">Loading…</div> : filteredUsers.length === 0 ? <div className="panel p-6 text-zinc-400">No one matches that search.</div> : (
                            <div className="ledger">
                                {filteredUsers.map(u => (
                                    <div key={u.id} className="ledger-row !py-3">
                                        {u.photoURL ? <img src={u.photoURL} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} /> : <span className="avatar w-11 h-11 text-lg">{(u.firstName || u.email || '?').charAt(0)}</span>}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-white font-semibold truncate">{u.firstName || 'No name'}</div>
                                            <div className="text-sm text-zinc-400 truncate">{u.email}</div>
                                            {u.role === 'barber' && (
                                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                    <span className="chip chip-gold !h-5 !px-2">{planName(u.plan)}</span>
                                                    <span className="chip !h-5 !px-2">{u.credits || 0} credits</span>
                                                    {u.billingNextDue && <span className={`chip !h-5 !px-2 ${formatTimeLeft(u.billingNextDue) === 'Due' ? '!text-red-400' : ''}`}>{formatTimeLeft(u.billingNextDue) === 'Due' ? 'Payment due' : `Renews in ${formatTimeLeft(u.billingNextDue).split(' ')[0]}`}</span>}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 -mr-2">
                                            {u.role === 'barber' && <button onClick={() => setSelectedUser(u)} aria-label={`View BlackBook as ${u.firstName || u.email}`} title="View as this barber" className="icon-btn"><Eye /></button>}
                                            <button onClick={() => setEditingUser(u)} aria-label={`Edit ${u.firstName || u.email}`} title="Edit" className="icon-btn"><EditIcon /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {view === 'support' && (
                    <div className="fade-in space-y-5">
                        <div>
                            <h2 className="text-3xl text-white min-[900px]:hidden">Support</h2>
                            <p className="text-sm text-zinc-400">{openTicketsCount} open ticket{openTicketsCount === 1 ? '' : 's'}.</p>
                        </div>
                        {tickets.length === 0 ? <div className="panel p-6 text-zinc-400">No tickets yet.</div> : (
                            <div className="ledger">
                                {tickets.map(t => {
                                    const last = t.messages && t.messages.length ? t.messages[t.messages.length - 1] : null;
                                    return (
                                        <button key={t.id} onClick={() => setActiveTicket(t)} className="ledger-row !items-start">
                                            <span className="flex-1 min-w-0">
                                                <span className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'open' ? 'bg-gold' : t.status === 'replied' ? 'bg-zinc-500' : 'bg-zinc-700'}`} aria-hidden="true" /><span className="text-white font-semibold truncate">{t.subject}</span></span>
                                                <span className="block text-sm text-zinc-400 truncate mt-0.5">{t.userName || 'Unknown'}, {t.userEmail}</span>
                                                <span className="block text-sm text-zinc-500 truncate">{last ? `${last.sender === 'admin' ? 'You: ' : ''}${last.text}` : (t.description || '')}</span>
                                            </span>
                                            <span className="text-right shrink-0">
                                                <span className={`chip !h-5 !px-2 ${t.status === 'open' ? 'chip-gold' : ''}`}>{t.status === 'open' ? 'Open' : t.status === 'replied' ? 'Replied' : 'Closed'}</span>
                                                <span className="block text-xs text-zinc-500 mt-1.5">{t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {view === 'discounts' && (
                    <div className="fade-in space-y-6">
                        <div>
                            <h2 className="text-3xl text-white min-[900px]:hidden">Discounts</h2>
                            <p className="text-sm text-zinc-400">Codes barbers can enter when they pick a plan. "Free" activates the plan with no payment.</p>
                        </div>
                        <div className="panel p-4 space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <Field label="Code"><input value={newDiscount.code} onChange={e => setNewDiscount(s => ({...s, code: e.target.value.toUpperCase()}))} placeholder="FREEPRO" className={`${inputCls} font-semibold`} /></Field>
                                <Field label="Type">
                                    <select value={newDiscount.type} onChange={e => setNewDiscount(s => ({...s, type: e.target.value}))} className={inputCls}><option value="free">Free</option><option value="fixed">Dollars off</option><option value="percent">Percent off</option></select>
                                </Field>
                                <Field label="Amount"><input type="number" inputMode="decimal" value={newDiscount.value} onChange={e => setNewDiscount(s => ({...s, value: e.target.value}))} disabled={newDiscount.type === 'free'} className={inputCls} /></Field>
                                <Field label="Only for plan">
                                    <select value={newDiscount.planId} onChange={e => setNewDiscount(s => ({...s, planId: e.target.value}))} className={inputCls}><option value="">Any plan</option><option value="basic">Basic</option><option value="pro">Pro</option><option value="mogul">Mogul</option></select>
                                </Field>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setNewDiscount({ code: '', type: 'free', value: 0, planId: '' })} className="btn btn-ghost">Clear</button>
                                <button onClick={createDiscount} className="btn btn-primary">Create code</button>
                            </div>
                        </div>
                        {discountsLoading ? <div className="text-zinc-400">Loading codes…</div> : discounts.length === 0 ? <div className="panel p-6 text-zinc-400">No discount codes yet.</div> : (
                            <div className="ledger">
                                {discounts.map(d => (
                                    <div key={d.id} className="ledger-row">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-gold tracking-wide">{d.code}</div>
                                            <div className="text-sm text-zinc-400">{d.type === 'free' ? 'Free plan' : d.type === 'fixed' ? `$${d.value} off` : `${d.value}% off`}{d.planId ? `, ${planName(d.planId)} only` : ''}{d.createdAt ? `. Created ${new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</div>
                                        </div>
                                        <label className="flex items-center gap-2 text-sm text-white shrink-0 cursor-pointer"><input type="checkbox" checked={!!d.active} onChange={() => toggleDiscountActive(d.id, d.active)} className="w-5 h-5" />{d.active ? 'Active' : 'Off'}</label>
                                        <button onClick={() => deleteDiscount(d.id)} aria-label={`Delete code ${d.code}`} className="icon-btn -mr-2 shrink-0 hover:!text-red-400"><TrashIcon /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {view === 'analytics' && (
                    <div className="fade-in space-y-6">
                        <h2 className="text-3xl text-white min-[900px]:hidden">Analytics</h2>
                        <div className="panel grid grid-cols-2 sm:grid-cols-4 divide-x divide-zinc-800">
                            {[['Users', users.length, `${weeklySignups} joined this week`], ['Barbers', barbersCount, `${clientsCount} clients`], ['Bookings, 30 days', bookingsCount30, `$${avgBookingValue.toFixed(0)} average`], ['Revenue this month', `$${monthlyRevenue.toFixed(0)}`, 'From payments']].map(([label, value, sub]) => (
                                <div key={label} className="p-4">
                                    <div className="text-xs text-zinc-400">{label}</div>
                                    <div className="num text-3xl text-white">{value}</div>
                                    <div className="text-xs text-zinc-500">{sub}</div>
                                </div>
                            ))}
                        </div>
                        <div className="panel p-4">
                            <div className="flex items-baseline justify-between mb-3"><h3 className="text-2xl text-white">Sign-ups, last 7 days</h3><span className="text-sm text-zinc-400">{signupSeries.reduce((a, b) => a + b, 0)} total</span></div>
                            <div className="flex items-end gap-2 h-32">
                                {(signupSeries.length ? signupSeries : [0, 0, 0, 0, 0, 0, 0]).map((v, i) => {
                                    const max = Math.max(...signupSeries, 1);
                                    const day = new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString('en-US', { weekday: 'narrow' });
                                    return (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                                            <span className="text-xs text-zinc-400">{v || ''}</span>
                                            <div className="w-full rounded-t-md bg-gold" style={{ height: `${Math.max(3, (v / max) * 100)}%`, opacity: v ? 1 : 0.25 }} />
                                            <span className="text-xs text-zinc-500">{day}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {view === 'activity' && (
                    <div className="fade-in space-y-5">
                        <div className="flex items-end justify-between gap-3 flex-wrap">
                            <div>
                                <h2 className="text-3xl text-white min-[900px]:hidden">Activity</h2>
                                <p className="text-sm text-zinc-400">The last 500 admin actions.</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={fetchAdminLogs} className="btn btn-secondary">{loadingLogs ? 'Loading…' : 'Load activity'}</button>
                                <button onClick={() => exportLogsCSV(adminLogs)} disabled={adminLogs.length === 0} className="btn btn-primary">Export CSV</button>
                            </div>
                        </div>
                        {adminLogs.length === 0 ? <div className="panel p-6 text-zinc-400">{loadingLogs ? 'Loading…' : 'Nothing loaded yet. Tap Load activity.'}</div> : (
                            <div className="ledger">
                                {adminLogs.map(l => (
                                    <div key={l.id} className="px-4 py-3">
                                        <div className="flex justify-between gap-3 text-sm"><span className="text-white font-semibold">{l.action}</span><span className="text-zinc-500 shrink-0">{l.createdAt ? new Date(l.createdAt).toLocaleString() : ''}</span></div>
                                        <div className="text-sm text-zinc-400">{l.actor || 'system'}</div>
                                        {l.details && <div className="text-xs text-zinc-500 mt-1 break-all">{JSON.stringify(l.details)}</div>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {view === 'roles' && (
                    <div className="fade-in space-y-5">
                        <div>
                            <h2 className="text-3xl text-white min-[900px]:hidden">Roles</h2>
                            <p className="text-sm text-zinc-400">Switch someone between client and barber. Admin access only comes from the support email.</p>
                        </div>
                        <div className="ledger">
                            {users.map(u => (
                                <div key={u.id} className="ledger-row !py-3">
                                    <div className="flex-1 min-w-0"><div className="text-white font-semibold truncate">{u.firstName || u.email}</div><div className="text-sm text-zinc-400 truncate">{u.email}</div></div>
                                    <select value={u.role || 'client'} onChange={(e) => changeUserRole(u.id, e.target.value)} aria-label={`Role for ${u.firstName || u.email}`} className={`${inputCls} !w-32 !h-10 shrink-0`}>
                                        <option value="client">Client</option>
                                        <option value="barber">Barber</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            <nav className="bb-tabbar" aria-label="Sections">
                <div className="bb-tabbar-brand"><span className="logo text-3xl">Black<span className="text-gold">Book</span></span><div className="text-xs text-zinc-500 mt-1">Control center</div></div>
                {adminTabs.map(t => (
                    <button key={t.id} onClick={() => setView(t.id)} aria-current={view === t.id ? 'page' : undefined} className={`bb-tab ${view === t.id ? 'is-active' : ''}`}>{t.icon}<span className="truncate">{t.label}</span>{t.badge > 0 && <span className="tab-badge">{t.badge}</span>}</button>
                ))}
            </nav>

            {openTicket && (
                <Sheet title={openTicket.subject || 'Ticket'} wide onClose={() => setActiveTicket(null)}>
                    <p className="-mt-3 mb-4 text-sm text-zinc-400">{openTicket.userName}, {openTicket.userEmail}</p>
                    <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                        {(openTicket.messages || []).map((m, i) => (
                            <div key={i} className={`max-w-[85%] px-3.5 py-2.5 text-[15px] ${m.sender === 'admin' ? 'chat-bubble-me ml-auto' : 'chat-bubble-them'}`}>
                                <p>{m.text}</p><span className="block text-xs opacity-60 mt-1">{formatTime(m.time)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                        {cannedReplies.map(r => <button key={r} onClick={() => replyWithCanned(openTicket, r)} className="chip !h-8 !px-3 hover:!text-white">{r}</button>)}
                    </div>
                    <form onSubmit={sendAdminReply} className="flex gap-2 mt-3">
                        <input className={`${inputCls} flex-1`} placeholder="Write a reply" aria-label="Reply" value={replyText} onChange={e => setReplyText(e.target.value)} />
                        <button type="submit" disabled={!replyText} className="btn btn-primary">Send</button>
                    </form>
                    {openTicket.status !== 'closed' && <button onClick={async () => { await updateDoc(doc(db, "tickets", openTicket.id), { status: 'closed' }); setActiveTicket(null); showToast('Ticket closed', 'success'); }} className="btn btn-secondary w-full mt-3">Close ticket</button>}
                </Sheet>
            )}

            {editingUser && (
                <Sheet title={editingUser.firstName || editingUser.email || 'Edit user'} wide onClose={() => setEditingUser(null)}>
                    <form onSubmit={handleUpdateUser} className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="First name"><input value={editingUser.firstName || ''} onChange={(e) => setEditingUser({...editingUser, firstName: e.target.value})} className={inputCls} /></Field>
                            <Field label="Phone"><input value={editingUser.phone || ''} onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})} className={inputCls} /></Field>
                            <Field label="Email" hint="Changes the profile only, not the login" className="sm:col-span-2"><input value={editingUser.email || ''} onChange={(e) => setEditingUser({...editingUser, email: e.target.value})} className={inputCls} /></Field>
                            <Field label="Plan"><select value={editingUser.plan || 'free_trial'} onChange={(e) => setEditingUser({...editingUser, plan: e.target.value})} className={inputCls}><option value="free_trial">Free trial</option><option value="basic">Basic</option><option value="pro">Pro</option><option value="mogul">Mogul</option></select></Field>
                            <Field label="Promo credits"><input type="number" value={editingUser.credits || 0} onChange={(e) => setEditingUser({...editingUser, credits: parseInt(e.target.value) || 0})} className={inputCls} /></Field>
                        </div>

                        <section className="border-t border-zinc-800 pt-5 space-y-3">
                            <h4 className="text-2xl font-display font-extrabold text-white">Billing</h4>
                            <p className="text-sm text-zinc-400">Next charge: <span className="text-white">{editingUser.billingNextDue ? new Date(editingUser.billingNextDue).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'not set'}</span>{editingUser.billingNextDue ? ` (${formatTimeLeft(editingUser.billingNextDue)})` : ''}</p>
                            <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-end">
                                <Field label="Days"><input type="number" min="0" value={editBillingDays} onChange={e => setEditBillingDays(e.target.value)} className={inputCls} /></Field>
                                <Field label="How"><select value={editBillingMode} onChange={e => setEditBillingMode(e.target.value)} className={inputCls}><option value="extend">Add to current date</option><option value="set">Count from today</option></select></Field>
                                <button type="button" onClick={async () => { await grantDurationToUser(editingUser.id, editBillingDays, editBillingMode); const snap = await getDoc(doc(db,'users', editingUser.id)); if (snap.exists()) setEditingUser({ id: snap.id, ...snap.data() }); }} className="btn btn-secondary">Apply</button>
                            </div>
                        </section>

                        <section className="border-t border-zinc-800 pt-5 space-y-3">
                            <h4 className="text-2xl font-display font-extrabold text-white">Account</h4>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => handleResetPassword(editingUser.email)} className="btn btn-secondary">Send password reset</button>
                                <button type="button" onClick={() => { handleDeleteUser(editingUser.id); setEditingUser(null); }} className="btn btn-danger">Delete user</button>
                            </div>
                        </section>

                        <div className="flex gap-2 border-t border-zinc-800 pt-5">
                            <button type="button" onClick={() => setEditingUser(null)} className="btn btn-secondary flex-1">Cancel</button>
                            <button type="submit" className="btn btn-primary flex-1">Save changes</button>
                        </div>
                    </form>
                </Sheet>
            )}
        </div>
    );
}

// --- DASHBOARD (Shared for Barber/Client) ---
function Dashboard({ user, isGhost = false }) {
    const [activeTab, setActiveTab] = useState('schedule');
    const [userProfile, setUserProfile] = useState({});
    const [showSupport, setShowSupport] = useState(false);

    // FULL DASHBOARD IMPLEMENTATION
    const [clients, setClients] = useState([]);
    const [rosterQuery, setRosterQuery] = useState("");
    const [rosterSort, setRosterSort] = useState('name');
    const [appointments, setAppointments] = useState([]);
    const [services, setServices] = useState([]);
    const [coupons, setCoupons] = useState([]);
    const [products, setProducts] = useState([]);
    const [viewDate, setViewDate] = useState(() => getTodayPSTString()); 
    const [editingClient, setEditingClient] = useState(null);
    const [editingAppt, setEditingAppt] = useState(null);
    const [viewingAppt, setViewingAppt] = useState(null);
    const [shopSettings, setShopSettings] = useState({ shopOpen: "09:00", shopClose: "17:00", lunchStart: "", lunchEnd: "", slotDuration: 60, slotGranularity: 5, breakMinutes: 5 });
    const [customCode, setCustomCode] = useState("");
    const [geoFor, setGeoFor] = useState(""); // the address the saved coordinates belong to
    const [geocoding, setGeocoding] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [sendingEmailTo, setSendingEmailTo] = useState(null);
    const [moneyFilter, setMoneyFilter] = useState('all');
    const [chattingWith, setChattingWith] = useState(null);
    const [unreadCounts, setUnreadCounts] = useState({});
    const [unreadByEmail, setUnreadByEmail] = useState({});
    const senderEmailCache = useRef({});
    
    const [newServiceName, setNewServiceName] = useState("");
    const [newServicePrice, setNewServicePrice] = useState("");
    const [newSalePrice, setNewSalePrice] = useState(""); 
    const [newServiceDuration, setNewServiceDuration] = useState("");
    const [newBreakStart, setNewBreakStart] = useState("");
    const [newBreakEnd, setNewBreakEnd] = useState("");
    const [newBreakLabel, setNewBreakLabel] = useState("");
    const [newServiceDesc, setNewServiceDesc] = useState("");
    const [newServiceCategory, setNewServiceCategory] = useState("");
    const [newServiceRecommended, setNewServiceRecommended] = useState(false);
    const [newServiceActive, setNewServiceActive] = useState(true);
    const [editingServiceId, setEditingServiceId] = useState(null);
    const [newCouponCode, setNewCouponCode] = useState("");
    const [newCouponType, setNewCouponType] = useState("fixed"); 
    const [newCouponValue, setNewCouponValue] = useState("");
    const [showAddServiceModal, setShowAddServiceModal] = useState(false);
    const [showCreateCouponModal, setShowCreateCouponModal] = useState(false);

    // Products management
    const [newProductName, setNewProductName] = useState("");
    const [newProductPrice, setNewProductPrice] = useState("");
    const [newProductStock, setNewProductStock] = useState("");
    const [newProductDesc, setNewProductDesc] = useState("");
        const [newProductImageFile, setNewProductImageFile] = useState(null);
        const [newProductImageUrl, setNewProductImageUrl] = useState('');
        const [newProductUploading, setNewProductUploading] = useState(false);
    const [editingProductId, setEditingProductId] = useState(null);
        const [showAddProductModalAdmin, setShowAddProductModalAdmin] = useState(false);

    const [promoText, setPromoText] = useState("Yo {name}, got a spot open. Want it?");
    const [promoSubject, setPromoSubject] = useState("");
    const [isBlasting, setIsBlasting] = useState(false);
    const [blastLogs, setBlastLogs] = useState([]);
    const [selectedClients, setSelectedClients] = useState([]);
    const logsEndRef = useRef(null);

    useEffect(() => {
        const unsubUser = onSnapshot(doc(db, "users", user.uid), (doc) => { if (doc.exists()) { const data = doc.data(); setUserProfile(data); setShopSettings({ shopOpen: data.shopOpen || "09:00", shopClose: data.shopClose || "17:00", lunchStart: data.lunchStart || "", lunchEnd: data.lunchEnd || "", slotDuration: data.slotDuration || 60, slotGranularity: data.slotGranularity || 5, breakMinutes: data.breakMinutes || 5, shopName: data.shopName || "", shopAddress: data.shopAddress || "", shopLat: Number.isFinite(data.shopLat) ? data.shopLat : null, shopLng: Number.isFinite(data.shopLng) ? data.shopLng : null, listed: !!data.listed }); setGeoFor(Number.isFinite(data.shopLat) ? (data.shopAddress || "").trim() : ""); setCustomCode(data.referralCode || user.uid); } });
        const qClients = query(collection(db, "clients"), where("userId", "==", user.uid)); const unsubClients = onSnapshot(qClients, (snapshot) => setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const qAppts = query(collection(db, "appointments"), where("userId", "==", user.uid)); const unsubAppts = onSnapshot(qAppts, (snapshot) => { const apptList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); apptList.sort((a, b) => (a.date || '').localeCompare(b.date || '') || ((a.time || '').localeCompare(b.time || ''))); setAppointments(apptList); });
        const qServices = query(collection(db, "services"), where("userId", "==", user.uid)); const unsubServices = onSnapshot(qServices, (snapshot) => setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const qCoupons = query(collection(db, "coupons"), where("userId", "==", user.uid)); const unsubCoupons = onSnapshot(qCoupons, (snapshot) => setCoupons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const qProducts = query(collection(db, "products"), where("userId", "==", user.uid)); const unsubProducts = onSnapshot(qProducts, (snapshot) => setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const qUnread = query(collection(db, "messages"), where("recipientId", "==", user.uid), where("read", "==", false));
        const unsubUnread = onSnapshot(qUnread, async (snapshot) => {
            const counts = {}; snapshot.docs.forEach(doc => { const senderId = doc.data().senderId; counts[senderId] = (counts[senderId] || 0) + 1; }); setUnreadCounts(counts);
            // Messages carry the sender's uid but older roster entries only have an email, so resolve uid -> email
            const cache = senderEmailCache.current;
            await Promise.all(Object.keys(counts).filter(uid => !(uid in cache)).map(async uid => {
                try { const s = await getDoc(doc(db, 'users', uid)); cache[uid] = s.exists() ? (s.data().email || '').toLowerCase() : ''; } catch (e) { cache[uid] = ''; }
            }));
            const byEmail = {}; Object.entries(counts).forEach(([uid, n]) => { const em = cache[uid]; if (em) byEmail[em] = (byEmail[em] || 0) + n; }); setUnreadByEmail(byEmail);
        });
        return () => { unsubUser(); unsubClients(); unsubAppts(); unsubServices(); unsubCoupons(); try{ unsubProducts(); }catch(e){}; unsubUnread(); };
    }, [user.uid]);

    // Every barber needs a public card so invite links work for signed-out visitors.
    // Create a minimal, unlisted one if this barber has never saved Shop settings.
    useEffect(() => {
        if (isGhost || userProfile.role !== 'barber') return;
        const ref = doc(db, 'barberProfiles', user.uid);
        getDoc(ref).then(s => {
            if (!s.exists()) return setDoc(ref, { displayName: userProfile.firstName || '', shopName: userProfile.shopName || '', address: '', lat: null, lng: null, photoURL: userProfile.photoURL || '', shopOpen: userProfile.shopOpen || '09:00', shopClose: userProfile.shopClose || '17:00', listed: false, updatedAt: new Date().toISOString() });
        }).catch(e => console.warn('Could not create public barber card', e));
    }, [user.uid, userProfile.role, isGhost]);

    const saveClient = async (e) => { e.preventDefault(); const data = { name: editingClient.name, phone: editingClient.phone, email: editingClient.email || "", formula: editingClient.formula, userId: user.uid, updatedAt: new Date().toISOString() }; if (editingClient.id) await updateDoc(doc(db, "clients", editingClient.id), data); else await addDoc(collection(db, "clients"), { ...data, createdAt: new Date().toISOString() }); setEditingClient(null); };
    const deleteClient = async () => { if (await showConfirm({ message: 'Delete client?' })) { await deleteDoc(doc(db, "clients", editingClient.id)); setEditingClient(null); } };
    const saveAppt = async (e) => {
        e.preventDefault();
        try {
            const base = {
                clientName: editingAppt.clientName,
                date: editingAppt.date,
                time: editingAppt.time,
                userId: user.uid,
                status: editingAppt.status || 'booked'
            };

            // If services array provided, use it; otherwise fall back to single service field
            let servicesPayload = null;
            if (editingAppt.services && Array.isArray(editingAppt.services)) {
                servicesPayload = editingAppt.services.map(s => ({ id: s.id || null, name: s.name, price: s.price || s.salePrice || 0, salePrice: s.salePrice || null, note: s.note || '' }));
            } else if (editingAppt.service) {
                servicesPayload = [{ name: editingAppt.service, price: parseFloat(editingAppt.price) || 0 }];
            }

            const originalPrice = servicesPayload ? servicesPayload.reduce((sum, s) => sum + (s.salePrice || s.price || 0), 0) : (parseFloat(editingAppt.price) || 0);
            // compute totalDuration from services or fallback
            let totalDuration = 0;
            if (servicesPayload) totalDuration = servicesPayload.reduce((sum, s) => sum + (s.duration || s.minutes || 0), 0) || shopSettings.slotDuration;
            else totalDuration = parseInt(editingAppt.totalDuration) || shopSettings.slotDuration;
            const payload = { ...base, service: editingAppt.service || null, price: parseFloat(editingAppt.price) || 0, originalPrice, totalDuration };
            if (servicesPayload) payload.services = servicesPayload;

            if (editingAppt.id) await updateDoc(doc(db, "appointments", editingAppt.id), { ...payload, updatedAt: new Date().toISOString(), lastModifiedBy: user.uid });
            else await addDoc(collection(db, "appointments"), { ...payload, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastModifiedBy: user.uid });
            setEditingAppt(null);
            showToast('Saved appointment', 'success');
        } catch (err) {
            showToast(err.message || 'Failed saving', 'error');
        }
    };
    const toggleApptStatus = async (appt, e) => { e.stopPropagation(); try { await updateDoc(doc(db, "appointments", appt.id), { status: appt.status === 'completed' ? 'booked' : 'completed', updatedAt: new Date().toISOString(), lastModifiedBy: user.uid }); } catch(err) { showToast(err.message || 'Error', 'error'); } };
    const deleteAppt = async () => { if (await showConfirm({ message: 'Cancel appointment?' })) { await deleteDoc(doc(db, "appointments", editingAppt.id)); setEditingAppt(null); } };
    const changeDate = (days) => {
        // Parse current viewDate as a PST date, add days in local Date arithmetic, then format back to PST string
        const base = parseDatePST(viewDate) || parseDatePST(getTodayPSTString()) || new Date();
        base.setDate(base.getDate() + days);
        const pstStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(base);
        setViewDate(pstStr);
    };
    const addService = async () => {
        if(!newServiceName || !newServicePrice) return;
        const duration = parseInt(newServiceDuration) || shopSettings.slotDuration || 60;
        const payload = { userId: user.uid, name: newServiceName, price: parseFloat(newServicePrice), salePrice: newSalePrice ? parseFloat(newSalePrice) : null, duration, description: newServiceDesc || '', category: newServiceCategory || '', recommended: !!newServiceRecommended, active: !!newServiceActive };
        try {
            if (editingServiceId) {
                await updateDoc(doc(db, "services", editingServiceId), payload);
                setEditingServiceId(null);
                showToast('Service updated', 'success');
            } else {
                await addDoc(collection(db, "services"), payload);
                showToast('Service added', 'success');
            }
            setNewServiceName(""); setNewServicePrice(""); setNewSalePrice(""); setNewServiceDuration(""); setNewServiceDesc(""); setNewServiceCategory(""); setNewServiceRecommended(false); setNewServiceActive(true);
        } catch (err) {
            showToast(err.message || 'Failed saving service', 'error');
        }
    };
    const deleteService = async (id) => { if(await showConfirm({ message: 'Delete service?' })) await deleteDoc(doc(db, "services", id)); };
    const addCoupon = async () => { if(!newCouponCode || !newCouponValue) return; await addDoc(collection(db, "coupons"), { userId: user.uid, code: newCouponCode.toUpperCase(), type: newCouponType, value: parseFloat(newCouponValue) }); setNewCouponCode(""); setNewCouponValue(""); };
    const deleteCoupon = async (id) => { if(await showConfirm({ message: 'Delete coupon?' })) await deleteDoc(doc(db, "coupons", id)); };
    const addProduct = async () => {
        if(!newProductName || !newProductPrice) return;
        const payload = { userId: user.uid, name: newProductName, price: parseFloat(newProductPrice), stock: newProductStock ? parseInt(newProductStock) : null, description: newProductDesc || '', createdAt: new Date().toISOString() };
        try {
            // If an image file is present, upload to Firebase Storage first
            if (newProductImageFile) {
                try {
                    setNewProductUploading(true);
                    const storage = getStorage();
                    const fileToUpload = await resizeImageFile(newProductImageFile, 1200, 0.8);
                    const key = `products/${user.uid}/${Date.now()}_${(fileToUpload.name || 'img').replace(/[^a-z0-9.\-]/gi, '_')}`;
                    const sRef = storageRef(storage, key);
                    const uploadTask = uploadBytesResumable(sRef, fileToUpload);
                    await new Promise((res, rej) => { uploadTask.on('state_changed', null, rej, res); });
                    const url = await getDownloadURL(sRef);
                    payload.imageUrl = url;
                    payload.imagePath = key;
                } catch (upErr) {
                    console.error('Image upload failed', upErr);
                    showToast('Image upload failed', 'error');
                } finally { setNewProductUploading(false); }
            }

            if (editingProductId) { await updateDoc(doc(db, 'products', editingProductId), payload); setEditingProductId(null); showToast('Product updated', 'success'); }
            else { await addDoc(collection(db, 'products'), payload); showToast('Product added', 'success'); }
            setNewProductName(''); setNewProductPrice(''); setNewProductStock(''); setNewProductDesc(''); setNewProductImageFile(null); setNewProductImageUrl('');
        } catch(e) { showToast('Failed saving product', 'error'); }
    };
    const deleteProduct = async (id) => {
        if (!await showConfirm({ message: 'Delete product?' })) return;
        try {
            const pSnap = await getDoc(doc(db, 'products', id));
            if (pSnap.exists()) {
                const pdata = pSnap.data();
                if (pdata && pdata.imagePath) {
                    try {
                        const storage = getStorage();
                        await deleteObject(storageRef(storage, pdata.imagePath));
                    } catch (e) { console.warn('Failed deleting product image', e); }
                }
            }
            await deleteDoc(doc(db, 'products', id));
        } catch (err) { showToast('Failed deleting product', 'error'); }
    };
    // The email function requires the barber's ID token; sender name, booking link and credit
    // charges are all resolved server-side from the barber's profile.
    const sendEmailRequest = async (payload) => {
        const idToken = await auth.currentUser.getIdToken();
        // Only the previous backend reads barberName/bookingLink; the current one ignores them
        const legacyFields = { barberName: userProfile.firstName || "Your Barber", bookingLink: `${window.location.origin}/?ref=${userProfile.referralCode || user.uid}` };
        const response = await fetch(FIREBASE_EMAIL_URL, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` }, body: JSON.stringify({ ...legacyFields, ...payload }) });
        const data = await response.json().catch(() => ({}));
        return { ok: response.ok, status: response.status, error: data.error };
    };
    const handleEmail = async (client) => {
        if(userProfile.plan === 'free_trial') { showToast("Upgrade required.", 'error'); return; }
        if(!client.email) return;
        if (!await showConfirm({ message: 'Send invite code?' })) return;
        setSendingEmailTo(client.id);
        try {
            const r = await sendEmailRequest({ email: client.email });
            if (r.ok) showToast(`Invite sent!`, 'success');
            else showToast(`Invite failed: ${r.error || r.status}`, 'error');
        } catch (err) {
            console.error('Invite error', err);
            showToast("Error sending invite.", 'error');
        } finally { setSendingEmailTo(null); }
    };
    const handleBlastAll = async () => {
        if (selectedClients.length === 0) { showToast("Select clients.", 'error'); return; }
        const clientsToEmail = clients.filter(c => selectedClients.includes(c.id) && c.email);
        if (clientsToEmail.length === 0) { showToast("No valid emails.", 'error'); return; }
        if (!promoSubject) { showToast("Enter subject.", 'error'); return; }
        const cost = clientsToEmail.length;
        const currentCredits = userProfile.credits || 0;
        if (currentCredits < cost) { showToast(`Insufficient credits!`, 'error'); return; }
        if (!await showConfirm({ message: `Send to ${clientsToEmail.length} clients? Cost: ${cost} credits.` })) return;
        setIsBlasting(true);
        setBlastLogs(["Initializing...", `Sending ${cost} emails (1 credit each)`, "--------------------"]);
        let sent = 0;
        for (const client of clientsToEmail) {
            setBlastLogs(prev => [...prev, `Sending to ${client.name}...`]);
            try {
                const r = await sendEmailRequest({ email: client.email, isPromo: true, subject: promoSubject, messageBody: promoText.replaceAll("{name}", client.name || '') });
                if (r.ok) { sent++; setBlastLogs(prev => [...prev, `   > SENT ✅`]); }
                else {
                    setBlastLogs(prev => [...prev, `   > FAILED (${r.error || r.status})`]);
                    if (r.status === 401 || r.status === 402) break;
                }
            } catch(e) {
                console.error('Blast error', e);
                setBlastLogs(prev => [...prev, `   > ERROR`]);
            }
            await new Promise(r => setTimeout(r, 500));
        }
        setBlastLogs(prev => [...prev, `DONE. ${sent} sent, ${sent} credits used.`]);
        setTimeout(() => { setIsBlasting(false); setSelectedClients([]); setPromoSubject(""); }, 2000);
    };
    const findShopOnMap = async () => {
        const addr = (shopSettings.shopAddress || '').trim();
        if (!addr) { showToast('Enter your shop address first', 'error'); return null; }
        setGeocoding(true);
        try {
            const hit = await geocodeAddress(addr);
            if (!hit) { showToast("Couldn't find that address. Include the city and state.", 'error'); return null; }
            setShopSettings(s => ({ ...s, shopLat: hit.lat, shopLng: hit.lng }));
            setGeoFor(addr);
            return hit;
        } catch (e) { showToast(e.message, 'error'); return null; }
        finally { setGeocoding(false); }
    };
    const saveSettings = async () => {
        try {
            // Resolve the address to coordinates if it changed since the last lookup
            let settings = { ...shopSettings };
            const addr = (settings.shopAddress || '').trim();
            if (addr && (geoFor !== addr || !Number.isFinite(settings.shopLat))) {
                const hit = await findShopOnMap();
                if (hit) settings = { ...settings, shopLat: hit.lat, shopLng: hit.lng };
                else if (settings.listed) return; // can't list a shop we couldn't place
                else settings = { ...settings, shopLat: null, shopLng: null }; // old pin no longer matches the address
            }
            if (!addr) settings = { ...settings, shopLat: null, shopLng: null };
            const listed = !!(settings.listed && addr && Number.isFinite(settings.shopLat));
            let finalCode = userProfile.referralCode;
            if (customCode && customCode !== userProfile.referralCode) {
                const normalized = customCode.trim().toUpperCase();
                const codeRef = doc(db, "referralCodes", normalized);
                const codeSnap = await getDoc(codeRef);
                if (codeSnap.exists() && codeSnap.data().barberId !== user.uid) { showToast("Code taken.", 'error'); return; }
                // remove previous mapping if present and different
                const oldCode = userProfile.referralCode;
                if (oldCode && oldCode !== normalized && oldCode !== user.uid) {
                    try { await deleteDoc(doc(db, 'referralCodes', oldCode)); } catch(e) { console.debug('Old referral delete failed', e); }
                }
                await setDoc(codeRef, { barberId: user.uid }); finalCode = normalized;
            }
            await updateDoc(doc(db, "users", user.uid), { ...settings, shopAddress: addr, listed, referralCode: finalCode || user.uid });
            // Public card for the Find-a-barber map: only what a client needs to choose and book
            await setDoc(doc(db, 'barberProfiles', user.uid), {
                displayName: userProfile.firstName || '',
                shopName: settings.shopName || '',
                address: listed ? addr : '',
                lat: listed ? settings.shopLat : null,
                lng: listed ? settings.shopLng : null,
                photoURL: userProfile.photoURL || '',
                shopOpen: settings.shopOpen,
                shopClose: settings.shopClose,
                listed,
                updatedAt: new Date().toISOString(),
            });
            showToast(listed ? "Saved. You're on the map." : "Saved!", 'success');
            setShowSettings(false);
        } catch(e) { showToast("Error saving.", 'error'); }
    };
    // UPDATED CHAT OPEN HANDLER
    // Chat needs the client's account id. Clients link it to their roster entry when they sign up
    // or log in, so a missing id means they haven't used BlackBook yet.
    const openChat = (client) => {
        if (client.clientUid) { setChattingWith({ uid: client.clientUid, name: client.name }); return; }
        showToast(`${client.name || 'This client'} hasn't logged in to BlackBook yet. Send them an invite first.`, 'info', 5000);
    };

    const dailyAppts = appointments.filter(a => a.date === viewDate);
    // Roster filtering & sorting
    const filteredClients = (clients || []).filter(c => {
        const q = rosterQuery.trim().toLowerCase();
        if (!q) return true;
        return (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q) || ((c.email||'').toLowerCase().includes(q));
    }).slice();
    if (rosterSort === 'name') filteredClients.sort((a,b) => (a.name||'').localeCompare(b.name||''));
    // Helpers for opportunity calculation
    const toMinsLocal = (t) => { if(!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const mergeRanges = (ranges) => {
        const sorted = (ranges || []).slice().sort((a,b) => a.start - b.start);
        const out = [];
        for (const r of sorted) {
            if (!r) continue;
            if (out.length === 0) { out.push({ start: r.start, end: r.end }); continue; }
            const last = out[out.length-1];
            if (r.start <= last.end) last.end = Math.max(last.end, r.end);
            else out.push({ start: r.start, end: r.end });
        }
        return out;
    };

    const avgDuration = services && services.length > 0 ? Math.max(1, Math.round(services.reduce((s, v) => s + (v.duration || shopSettings.slotDuration || 60), 0) / services.length)) : (shopSettings.slotDuration || 60);
    const avgPrice = services && services.length > 0 ? (services.reduce((s, v) => s + (v.salePrice || v.price || 0), 0) / services.length) : 0;

    // Build busy ranges from appointments (exclude cancelled)
    const bufferMin = shopSettings.breakMinutes || 5;
    const apptRanges = dailyAppts.filter(a => a.status !== 'cancelled' && a.time).map(a => {
        const start = toMinsLocal(a.time) || 0;
        let dur = a.totalDuration || 0;
        if (!dur && a.services && Array.isArray(a.services)) dur = a.services.reduce((s, it) => s + (it.duration || 0), 0);
        if (!dur) dur = shopSettings.slotDuration || 60;
        return { start: Math.max(0, start - bufferMin), end: start + dur + bufferMin };
    });

    // Break ranges (lunch + optional custom breaks stored on userProfile)
    const breakRanges = [];
    if (shopSettings.lunchStart && shopSettings.lunchEnd) {
        const ls = toMinsLocal(shopSettings.lunchStart); const le = toMinsLocal(shopSettings.lunchEnd);
        if (!isNaN(ls) && !isNaN(le)) breakRanges.push({ start: ls, end: le });
    }
    const configuredBreaks = userProfile.shopBreaks || [];
    if (Array.isArray(configuredBreaks)) configuredBreaks.forEach(b => { try { if (b && b.start && b.end) { const s = toMinsLocal(b.start); const e = toMinsLocal(b.end); if (!isNaN(s) && !isNaN(e)) breakRanges.push({ start: s, end: e }); } } catch(e){} });

    const busyMerged = mergeRanges([...apptRanges, ...breakRanges]);
    const openMin = toMinsLocal(shopSettings.shopOpen || '09:00');
    const closeMin = toMinsLocal(shopSettings.shopClose || '17:00');
    const totalOpenMin = Math.max(0, (closeMin || 0) - (openMin || 0));
    // Clip busy ranges to shop hours and sum
    let busyMin = 0;
    for (const r of busyMerged) {
        const a = Math.max(r.start, openMin);
        const b = Math.min(r.end, closeMin);
        if (b > a) busyMin += (b - a);
    }
    const freeMinutes = Math.max(0, totalOpenMin - busyMin);
    const potentialSlots = avgDuration > 0 ? Math.floor(freeMinutes / avgDuration) : 0;
    const opportunityMoney = potentialSlots * (avgPrice || 0);
    const displayDate = (parseDatePST(viewDate) || new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date()))).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const today = getTodayPSTString();
    // moneyToday should reflect the currently selected view date so the Money tab matches the list
    const moneyToday = appointments.filter(a => a.status === 'completed' && a.date === viewDate).reduce((sum, a) => sum + (parseFloat(a.price) || 0), 0);
    // Use the selected view date as the reference for week/month calculations so the Money tab matches the view
    const refDate = parseDatePST(viewDate) || getNowPST();
    const weekStart = new Date(refDate); weekStart.setDate(refDate.getDate() - refDate.getDay()); weekStart.setHours(0,0,0,0);
    const monthStart = new Date(refDate); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const moneyWeek = appointments.filter(a => a.status === 'completed' && parseDatePST(a.date) >= weekStart).reduce((sum, a) => sum + (parseFloat(a.price) || 0), 0);
    const moneyMonth = appointments.filter(a => a.status === 'completed' && parseDatePST(a.date) >= monthStart).reduce((sum, a) => sum + (parseFloat(a.price) || 0), 0);

    // Additional analytics
    const pendingMoney = appointments.filter(a => a.status === 'booked').reduce((s,a) => s + (parseFloat(a.price) || 0), 0);
    const allCompleted = appointments.filter(a => a.status === 'completed');
    const completedTotalAll = allCompleted.reduce((s,a) => s + (parseFloat(a.price) || 0), 0);
    const completedCount = allCompleted.length;
    const avgTicket = completedCount ? (completedTotalAll / completedCount) : 0;
    const relevantBookings = appointments.filter(a => ['booked','completed'].includes(a.status));
    const conversionRate = relevantBookings.length ? Math.round((completedCount / relevantBookings.length) * 100) : 0;

    // Top services (by revenue, splitting appointment price across services if needed)
    const serviceRevenueMap = {};
    for (const a of allCompleted) {
        if (a.services && Array.isArray(a.services) && a.services.length > 0) {
            const share = (parseFloat(a.price) || 0) / a.services.length;
            a.services.forEach(s => { const name = s.name || s.service || 'Service'; serviceRevenueMap[name] = (serviceRevenueMap[name] || 0) + share; });
        } else if (a.service) {
            const name = a.service || 'Service'; serviceRevenueMap[name] = (serviceRevenueMap[name] || 0) + (parseFloat(a.price) || 0);
        }
    }
    const topServices = Object.keys(serviceRevenueMap).map(k => ({ name: k, revenue: serviceRevenueMap[k] })).sort((a,b) => b.revenue - a.revenue).slice(0,3);

    // CSV export helper for money tab
    const downloadCSV = (rows = []) => {
        if (!rows || rows.length === 0) { showToast('No rows to export', 'error'); return; }
        const cols = ['date','time','clientName','services','price','tipAmount','status'];
        const csv = [cols.join(',')].concat(rows.map(r => {
            const services = r.services && Array.isArray(r.services) ? r.services.map(s => s.name).join('|') : (r.service || '');
            const vals = [r.date||'', r.time||'', (r.clientName||'').replace(/,/g,' '), `"${services.replace(/"/g,'""')}"`, (r.price||0), (r.tipAmount||0), r.status||''];
            return vals.join(',');
        })).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `appointments_${viewDate || 'export'}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    };

    // Money list for selected viewDate and filter
    const moneyList = dailyAppts.filter(a => a.status !== 'cancelled' && (moneyFilter === 'all' || (moneyFilter === 'completed' && a.status === 'completed') || (moneyFilter === 'booked' && a.status === 'booked')));
    const moneyListTotal = moneyList.reduce((s,a) => s + (a.price || 0), 0);

    const canChat = ['pro', 'mogul'].includes(userProfile.plan);
    const canEmailBlast = ['pro', 'mogul'].includes(userProfile.plan); 
    const canBuildMenu = ['pro', 'mogul'].includes(userProfile.plan);
    const isAmbassador = userProfile.plan === 'mogul';
    const planLabel = { free_trial: 'Free trial', basic: 'Basic', pro: 'Pro', mogul: 'Mogul' }[userProfile.plan] || 'Free trial';
    const barberTabs = [
        { id: 'schedule', label: 'Schedule', icon: <CalendarIcon /> },
        { id: 'clients', label: 'Clients', icon: <Users /> },
        { id: 'money', label: 'Money', icon: <DollarSign /> },
        canChat && { id: 'inbox', label: 'Chat', icon: <MessageIcon />, badge: Object.values(unreadCounts).reduce((a, b) => a + b, 0) },
        canEmailBlast && { id: 'marketing', label: 'Promos', icon: <Megaphone /> },
        canBuildMenu && { id: 'menu', label: 'Menu', icon: <ListIcon /> },
        { id: 'shop', label: 'Shop', icon: <ShopIcon /> },
    ].filter(Boolean);
    const currentTitle = showSettings ? 'Shop settings' : ((barberTabs.find(t => t.id === activeTab) || {}).label || '');
    const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
    // client.userId is the barber's uid, so match unread messages on the client's own uid or email
    const unreadFor = (c) => (c.clientUid && unreadCounts[c.clientUid]) || unreadByEmail[(c.email || '').toLowerCase()] || 0;
    // Settings map preview; memoized so typing elsewhere doesn't re-drop the pin
    const shopPreview = useMemo(() => Number.isFinite(shopSettings.shopLat)
        ? [{ id: 'me', lat: shopSettings.shopLat, lng: shopSettings.shopLng, shopName: shopSettings.shopName }]
        : [], [shopSettings.shopLat, shopSettings.shopLng]);

    // Time-left until next billing charge (human readable, updates every minute)
    const [timeLeft, setTimeLeft] = useState(null);
    useEffect(() => {
        if (!userProfile || !userProfile.billingNextDue) { setTimeLeft(null); return; }
        let mounted = true;
        const update = () => {
            try {
                const due = new Date(userProfile.billingNextDue);
                const now = new Date();
                const diff = due - now;
                if (diff <= 0) {
                    if (mounted) setTimeLeft('Due');
                    return;
                }
                const days = Math.floor(diff / (24 * 60 * 60 * 1000));
                const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
                const parts = [];
                if (days > 0) parts.push(`${days}d`);
                parts.push(`${hours}h`);
                parts.push(`${mins}m`);
                if (mounted) setTimeLeft(parts.join(' '));
            } catch (e) {
                if (mounted) setTimeLeft(null);
            }
        };
        update();
        const id = setInterval(update, 60 * 1000);
        return () => { mounted = false; clearInterval(id); };
    }, [userProfile && userProfile.billingNextDue]);

    return (
        <div className={`bb-app ${isGhost ? 'pt-9' : ''}`}>
            {!isGhost && (
                <header className="bb-topbar">
                    <div className="flex-1 min-w-0">
                        <span className="logo text-[26px] min-[900px]:hidden">Black<span className="text-gold">Book</span></span>
                        <h1 className="hidden min-[900px]:block text-3xl text-white">{currentTitle}</h1>
                    </div>
                    <span className="chip chip-gold">{planLabel}</span>
                    {timeLeft && timeLeft !== 'Due' && <span className="chip hidden sm:inline-flex" title={`Next charge in ${timeLeft}`}>Renews in {timeLeft.split(' ')[0]}</span>}
                    <button onClick={() => setShowSettings(s => !s)} aria-label="Shop settings" title="Shop settings" aria-pressed={showSettings} className={`icon-btn ${showSettings ? '!text-gold' : ''}`}><SettingsIcon /></button>
                    <button onClick={() => setShowSupport(true)} aria-label="Help and support" title="Help and support" className="icon-btn"><SupportIcon /></button>
                    <button onClick={() => signOut(auth)} aria-label="Sign out" title="Sign out" className="icon-btn"><LogOut /></button>
                </header>
            )}

            <main className="bb-main">
                {showSettings ? (
                    <div className="fade-in space-y-8 max-w-2xl">
                        <h2 className="text-3xl text-white min-[900px]:hidden">Shop settings</h2>

                        <section className="space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-2xl text-white">On the map</h3>
                                    <p className="text-sm text-zinc-400 mt-1">Let nearby clients find your shop and book you. They see your shop name, address, hours and menu, never your phone or email.</p>
                                </div>
                                <label className="flex items-center gap-2 shrink-0 cursor-pointer pt-1">
                                    <input type="checkbox" checked={!!shopSettings.listed} onChange={(e) => setShopSettings({ ...shopSettings, listed: e.target.checked })} className="w-5 h-5" />
                                    <span className="text-white font-semibold">{shopSettings.listed ? 'Listed' : 'Hidden'}</span>
                                </label>
                            </div>
                            <Field label="Shop name"><input value={shopSettings.shopName || ''} onChange={(e) => setShopSettings({ ...shopSettings, shopName: e.target.value })} placeholder="Fresh Fades" className={inputCls} /></Field>
                            <Field label="Shop address" hint="Street, city and state, so the map pin lands on your door.">
                                <div className="flex gap-2">
                                    <input value={shopSettings.shopAddress || ''} onChange={(e) => setShopSettings({ ...shopSettings, shopAddress: e.target.value })} placeholder="2101 Telegraph Ave, Oakland, CA" className={`${inputCls} flex-1 min-w-0`} />
                                    <button type="button" onClick={findShopOnMap} disabled={geocoding} className="btn btn-secondary shrink-0">{geocoding ? 'Finding…' : 'Find on map'}</button>
                                </div>
                            </Field>
                            {shopPreview.length > 0 && geoFor === (shopSettings.shopAddress || '').trim() && (
                                <div className="relative isolate rounded-xl overflow-hidden border border-zinc-800 fade-in">
                                    <BarberMap barbers={shopPreview} className="h-44 w-full" />
                                </div>
                            )}
                        </section>

                        <section className="space-y-4 border-t border-zinc-800 pt-6">
                            <h3 className="text-2xl text-white">Hours</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Opens"><input type="time" value={shopSettings.shopOpen} onChange={(e) => setShopSettings({...shopSettings, shopOpen: e.target.value})} className={inputCls} /></Field>
                                <Field label="Closes"><input type="time" value={shopSettings.shopClose} onChange={(e) => setShopSettings({...shopSettings, shopClose: e.target.value})} className={inputCls} /></Field>
                                <Field label="Lunch starts" hint="Optional"><input type="time" value={shopSettings.lunchStart || ''} onChange={(e) => setShopSettings({...shopSettings, lunchStart: e.target.value})} className={inputCls} /></Field>
                                <Field label="Lunch ends"><input type="time" value={shopSettings.lunchEnd || ''} onChange={(e) => setShopSettings({...shopSettings, lunchEnd: e.target.value})} className={inputCls} /></Field>
                            </div>
                        </section>

                        <section className="space-y-4 border-t border-zinc-800 pt-6">
                            <div>
                                <h3 className="text-2xl text-white">Booking slots</h3>
                                <p className="text-sm text-zinc-400 mt-1">How online bookings fit into your day.</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Field label="Default length" hint="Used when a service has no time set">
                                    <select value={shopSettings.slotDuration} onChange={(e) => setShopSettings({...shopSettings, slotDuration: parseInt(e.target.value)})} className={inputCls}>
                                        <option value="15">15 min</option><option value="30">30 min</option><option value="45">45 min</option><option value="60">1 hour</option><option value="90">90 min</option>
                                    </select>
                                </Field>
                                <Field label="Start times every" hint="Minutes between possible start times"><input type="number" inputMode="numeric" value={shopSettings.slotGranularity || 5} onChange={(e) => setShopSettings({...shopSettings, slotGranularity: parseInt(e.target.value) || 5})} className={inputCls} /></Field>
                                <Field label="Gap between clients" hint="Minutes to clean up"><input type="number" inputMode="numeric" value={shopSettings.breakMinutes || 5} onChange={(e) => setShopSettings({...shopSettings, breakMinutes: parseInt(e.target.value) || 5})} className={inputCls} /></Field>
                            </div>
                        </section>

                        <section className="space-y-4 border-t border-zinc-800 pt-6">
                            <div>
                                <h3 className="text-2xl text-white">Referral code</h3>
                                <p className="text-sm text-zinc-400 mt-1">Clients type this when they sign up to land on your roster.</p>
                            </div>
                            <input type="text" value={customCode} onChange={(e) => setCustomCode(e.target.value.toUpperCase())} aria-label="Referral code" className={`${inputCls} font-bold tracking-wider`} placeholder="MARCUS" />
                        </section>

                        <div className="flex gap-2 border-t border-zinc-800 pt-6">
                            <button onClick={() => setShowSettings(false)} className="btn btn-secondary">Cancel</button>
                            <button onClick={saveSettings} disabled={geocoding} className="btn btn-primary flex-1 sm:flex-none sm:min-w-[180px]">Save settings</button>
                        </div>
                    </div>
                ) : (
                    <>
                        {activeTab === 'schedule' && (
                            <div className="fade-in space-y-5">
                                {userProfile.role && !userProfile.listed && !isGhost && (
                                    <button onClick={() => setShowSettings(true)} className="press w-full panel p-4 text-left flex items-center gap-3">
                                        <span className="w-10 h-10 rounded-full bg-gold/10 text-gold flex items-center justify-center shrink-0 [&>svg]:w-5 [&>svg]:h-5"><PinIcon /></span>
                                        <span className="flex-1 min-w-0"><span className="block text-white font-semibold">Get found by new clients</span><span className="block text-zinc-400 text-sm">Add your shop address to show up on the BlackBook map.</span></span>
                                        <span className="text-zinc-500"><ChevronRight /></span>
                                    </button>
                                )}

                                <div className="flex items-end justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm text-zinc-400">{viewDate === today ? 'Today' : viewDate < today ? 'Past day' : 'Coming up'}</p>
                                        <h2 className="text-4xl text-white leading-none truncate">{displayDate}</h2>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button onClick={() => changeDate(-1)} aria-label="Previous day" className="icon-btn border border-zinc-800"><ChevronLeft /></button>
                                        {viewDate !== today && <button onClick={() => setViewDate(today)} className="btn btn-secondary !min-h-[40px] !px-3 text-sm">Today</button>}
                                        <button onClick={() => changeDate(1)} aria-label="Next day" className="icon-btn border border-zinc-800"><ChevronRight /></button>
                                    </div>
                                </div>

                                <div className="panel grid grid-cols-3 divide-x divide-zinc-800">
                                    <div className="p-3 sm:p-4">
                                        <div className="text-xs text-zinc-400">Booked</div>
                                        <div className="num text-2xl text-white">${dailyAppts.filter(a => a.status !== 'cancelled').reduce((s, a) => s + (a.price || 0), 0).toFixed(0)}</div>
                                    </div>
                                    <div className="p-3 sm:p-4">
                                        <div className="text-xs text-zinc-400">Open time</div>
                                        <div className="num text-2xl text-white">{formatDuration(freeMinutes)}</div>
                                    </div>
                                    <div className="p-3 sm:p-4">
                                        <div className="text-xs text-zinc-400">Could still earn</div>
                                        <div className="num text-2xl text-gold">${opportunityMoney.toFixed(0)}</div>
                                        <div className="text-xs text-zinc-500">{potentialSlots} open slot{potentialSlots === 1 ? '' : 's'}</div>
                                    </div>
                                </div>

                                {dailyAppts.length === 0 ? (
                                    <div className="panel p-8 text-center">
                                        <p className="text-white font-semibold">Nothing booked {viewDate === today ? 'today' : 'this day'}</p>
                                        <p className="text-zinc-400 text-sm mt-1">Add a walk-in, or send clients your booking link to fill the chair.</p>
                                        <button onClick={() => setEditingAppt({ date: viewDate, time: "12:00", clientName: "", service: "", price: "" })} className="btn btn-primary mt-5"><PlusIcon /> New booking</button>
                                    </div>
                                ) : (
                                    <div className="ledger">
                                        {dailyAppts.map(appt => {
                                            const isDone = appt.status === 'completed';
                                            const isCancelled = appt.status === 'cancelled';
                                            const apptTotal = appt.totalDuration || (appt.services && Array.isArray(appt.services) ? appt.services.reduce((s, it) => s + (it.duration || 0), 0) : shopSettings.slotDuration);
                                            const serviceNames = appt.services && appt.services.length > 0 ? appt.services.map(s => s.name).join(', ') : (appt.service || 'Service');
                                            return (
                                                <div key={appt.id} role="button" tabIndex={0} onClick={() => setViewingAppt(appt)} onKeyDown={(e) => { if (e.key === 'Enter') setViewingAppt(appt); }} className="ledger-row cursor-pointer">
                                                    <div className="w-[68px] shrink-0">
                                                        <div className={`num text-xl leading-none ${isCancelled ? 'line-through text-zinc-600' : 'text-white'}`}>{appt.time ? formatHM(appt.time) : '—'}</div>
                                                        <div className="text-xs text-zinc-500 mt-1">{formatDuration(apptTotal)}</div>
                                                    </div>
                                                    <div className={`flex-1 min-w-0 ${isCancelled ? 'opacity-50' : ''}`}>
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className="font-semibold text-white truncate">{appt.clientName || 'Walk-in'}</span>
                                                            {isCancelled ? <span className="chip !h-5 !px-2 shrink-0 !text-red-400 !border-red-900">Cancelled</span>
                                                                : appt.bookedByClient && <span className="chip !h-5 !px-2 shrink-0">Online</span>}
                                                        </div>
                                                        <div className="text-sm text-zinc-400 truncate">{serviceNames}</div>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <span className={`num text-lg ${isCancelled ? 'text-zinc-600 line-through' : isDone ? 'text-green-400' : 'text-white'}`}>${(appt.price || 0).toFixed(0)}</span>
                                                        {isCancelled ? (
                                                            <span className="w-9" aria-hidden="true" />
                                                        ) : (
                                                            <button onClick={(e) => toggleApptStatus(appt, e)} aria-label={isDone ? `Mark ${appt.clientName || 'appointment'} as not done` : `Mark ${appt.clientName || 'appointment'} as done`} aria-pressed={isDone} className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${isDone ? 'bg-green-500 border-green-500 text-black' : 'border-zinc-700 text-zinc-500 hover:border-green-500 hover:text-green-400'}`}><Check /></button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <button onClick={() => setEditingAppt({ date: viewDate, time: "12:00", clientName: "", service: "", price: "" })} aria-label="New booking" title="New booking" className="press fixed z-30 right-4 bottom-[calc(84px+env(safe-area-inset-bottom))] min-[900px]:bottom-8 min-[900px]:right-8 h-14 w-14 rounded-full bg-gold text-black flex items-center justify-center shadow-[0_10px_28px_rgba(0,0,0,0.7)]"><PlusIcon /></button>
                            </div>
                        )}
                        {activeTab === 'money' && (
                            <div className="fade-in space-y-6">
                                <div>
                                    <h2 className="text-3xl text-white min-[900px]:hidden">Money</h2>
                                    <p className="text-sm text-zinc-400">Completed appointments, counted up to {displayDate}.</p>
                                </div>

                                <div className="panel grid grid-cols-3 divide-x divide-zinc-800">
                                    {[['That day', moneyToday], ['That week', moneyWeek], ['That month', moneyMonth]].map(([label, v]) => (
                                        <div key={label} className="p-3 sm:p-4">
                                            <div className="text-xs text-zinc-400">{label}</div>
                                            <div className="num text-3xl text-white">${v.toFixed(0)}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="ledger">
                                    <div className="ledger-row">
                                        <div className="flex-1"><div className="text-white font-semibold">Still to collect</div><div className="text-sm text-zinc-400">Booked but not marked done yet</div></div>
                                        <div className="num text-2xl text-gold">${pendingMoney.toFixed(0)}</div>
                                    </div>
                                    <div className="ledger-row">
                                        <div className="flex-1"><div className="text-white font-semibold">Average ticket</div><div className="text-sm text-zinc-400">Across {completedCount || 0} completed appointment{completedCount === 1 ? '' : 's'}</div></div>
                                        <div className="num text-2xl text-white">${avgTicket.toFixed(2)}</div>
                                    </div>
                                    <div className="ledger-row">
                                        <div className="flex-1"><div className="text-white font-semibold">Show-up rate</div><div className="text-sm text-zinc-400">Completed out of everything booked</div></div>
                                        <div className="num text-2xl text-white">{conversionRate}%</div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-2xl text-white mb-3">Top services</h3>
                                    {topServices.length === 0 ? (
                                        <div className="panel p-6 text-sm text-zinc-400">Mark appointments as done and your best earners show up here.</div>
                                    ) : (
                                        <div className="ledger">
                                            {topServices.map(s => (
                                                <div key={s.name} className="px-4 py-3">
                                                    <div className="flex items-baseline justify-between gap-3">
                                                        <span className="text-white truncate">{s.name}</span>
                                                        <span className="num text-xl text-white">${s.revenue.toFixed(0)}</span>
                                                    </div>
                                                    <div className="mt-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden"><div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(4, (s.revenue / topServices[0].revenue) * 100)}%` }} /></div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {isAmbassador && <p className="text-sm text-zinc-400 flex items-center gap-2"><span className="text-gold"><Crown /></span>Mogul ambassador: your referrals are active.</p>}
                            </div>
                        )}
                        {activeTab === 'shop' && (
                            <div className="fade-in space-y-5">
                                <div className="flex items-end justify-between gap-3 flex-wrap">
                                    <div>
                                        <h2 className="text-3xl text-white min-[900px]:hidden">Shop</h2>
                                        <p className="text-sm text-zinc-400">Products clients can reserve and pick up at your chair.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setShowCreateCouponModal(true)} className="btn btn-secondary">New coupon</button>
                                        <button onClick={() => { setEditingProductId(null); setNewProductName(''); setNewProductPrice(''); setNewProductStock(''); setNewProductDesc(''); setNewProductImageUrl(''); setNewProductImageFile(null); setShowAddProductModalAdmin(true); }} className="btn btn-primary"><PlusIcon /> Add product</button>
                                    </div>
                                </div>

                                {showAddProductModalAdmin && (() => {
                                    const closeProduct = () => { setShowAddProductModalAdmin(false); setEditingProductId(null); setNewProductName(''); setNewProductPrice(''); setNewProductStock(''); setNewProductDesc(''); setNewProductImageUrl(''); setNewProductImageFile(null); };
                                    return (
                                        <Sheet title={editingProductId ? 'Edit product' : 'Add product'} onClose={closeProduct} footer={<>
                                            <button onClick={closeProduct} className="btn btn-secondary flex-1">Cancel</button>
                                            <button onClick={async () => { await addProduct(); setShowAddProductModalAdmin(false); }} disabled={newProductUploading || !newProductName || !newProductPrice} className="btn btn-primary flex-1">{newProductUploading ? 'Uploading…' : (editingProductId ? 'Save product' : 'Add product')}</button>
                                        </>}>
                                            <div className="space-y-4">
                                                <Field label="Name"><input value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="Matte pomade" className={inputCls} /></Field>
                                                <Field label="Description" hint="Optional. One line on what it's for."><textarea value={newProductDesc} onChange={(e) => setNewProductDesc(e.target.value)} rows={2} className={areaCls} /></Field>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <Field label="Price ($)"><input type="number" inputMode="decimal" value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)} placeholder="18" className={inputCls} /></Field>
                                                    <Field label="In stock" hint="Blank if you don't count it"><input type="number" inputMode="numeric" value={newProductStock} onChange={(e) => setNewProductStock(e.target.value)} className={inputCls} /></Field>
                                                </div>
                                                <Field label="Photo" hint="Optional">
                                                    <div className="flex items-center gap-3">
                                                        {newProductImageUrl ? <img src={newProductImageUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-zinc-800" /> : <div className="w-16 h-16 rounded-lg bg-zinc-950 border border-dashed border-zinc-700" />}
                                                        <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files && e.target.files[0]; setNewProductImageFile(f || null); if (f) setNewProductImageUrl(URL.createObjectURL(f)); }} className="min-w-0 text-sm text-zinc-400 file:mr-3 file:h-10 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:text-white file:font-semibold" />
                                                    </div>
                                                </Field>
                                            </div>
                                        </Sheet>
                                    );
                                })()}

                                {products.length === 0 ? (
                                    <div className="panel p-8 text-center">
                                        <p className="text-white font-semibold">No products yet</p>
                                        <p className="text-zinc-400 text-sm mt-1">Add the pomades, oils and tools you sell so clients can reserve them before they come in.</p>
                                    </div>
                                ) : (
                                    <div className="ledger">
                                        {products.map(p => (
                                            <div key={p.id} className="ledger-row">
                                                {p.imageUrl
                                                    ? <img src={p.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                                                    : <div className="w-14 h-14 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-600 shrink-0"><ShopIcon /></div>}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-white font-semibold truncate">{p.name}</div>
                                                    <div className="text-sm text-zinc-400 truncate">{p.description || ' '}</div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="num text-xl text-white">${Number(p.price || 0).toFixed(2).replace(/\.00$/, '')}</div>
                                                    <div className={`text-xs ${p.stock === 0 ? 'text-red-400' : 'text-zinc-500'}`}>{p.stock == null || p.stock === '' ? 'Not counted' : p.stock === 0 ? 'Sold out' : `${p.stock} left`}</div>
                                                </div>
                                                <div className="flex shrink-0 -mr-2">
                                                    <button onClick={() => { setEditingProductId(p.id); setNewProductName(p.name || ''); setNewProductPrice(p.price || ''); setNewProductStock(p.stock ?? ''); setNewProductDesc(p.description || ''); setNewProductImageUrl(p.imageUrl || ''); setNewProductImageFile(null); setShowAddProductModalAdmin(true); }} aria-label={`Edit ${p.name}`} className="icon-btn"><EditIcon /></button>
                                                    <button onClick={() => deleteProduct(p.id)} aria-label={`Delete ${p.name}`} className="icon-btn hover:!text-red-400"><TrashIcon /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'clients' && (
                            <div className="fade-in space-y-5">
                                <div className="flex items-end justify-between gap-3">
                                    <div>
                                        <h2 className="text-3xl text-white min-[900px]:hidden">Clients</h2>
                                        <p className="text-sm text-zinc-400">{clients.length} client{clients.length === 1 ? '' : 's'}{userProfile.plan === 'free_trial' ? ' of 100 on the free trial' : ''}</p>
                                    </div>
                                    <button onClick={() => setEditingClient({ name: "", phone: "", email: "", formula: "" })} className="btn btn-primary shrink-0"><PlusIcon /> Add client</button>
                                </div>
                                <input type="search" value={rosterQuery} onChange={e => setRosterQuery(e.target.value)} placeholder="Search name, phone or email" aria-label="Search clients" className={inputCls} />
                                {filteredClients.length === 0 ? (
                                    <div className="panel p-8 text-center">
                                        <p className="text-white font-semibold">{clients.length === 0 ? 'No clients yet' : 'No one matches that search'}</p>
                                        <p className="text-zinc-400 text-sm mt-1">{clients.length === 0 ? 'Add clients yourself, or share your booking link and they land here when they sign up.' : 'Try a first name or the last digits of a phone number.'}</p>
                                    </div>
                                ) : (
                                    <div className="ledger">
                                        {filteredClients.map(client => (
                                            <div key={client.id} className="ledger-row !py-3">
                                                <button onClick={() => setEditingClient(client)} className="flex items-center gap-3 flex-1 min-w-0 text-left" aria-label={`Edit ${client.name}`}>
                                                    {client.photoURL
                                                        ? <img src={client.photoURL} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                                                        : <span className="avatar w-11 h-11 text-lg">{(client.name || '').charAt(0) || '?'}</span>}
                                                    <span className="min-w-0">
                                                        <span className="block text-white font-semibold truncate">{client.name || 'No name'}</span>
                                                        <span className="block text-sm text-zinc-400 truncate">{client.phone || client.email || 'No contact info'}</span>
                                                        {client.formula && <span className="block text-sm text-zinc-500 truncate">{client.formula}</span>}
                                                    </span>
                                                </button>
                                                {client.email && userProfile.plan !== 'free_trial' && (
                                                    <button onClick={() => handleEmail(client)} disabled={sendingEmailTo === client.id} className="btn btn-secondary !min-h-[36px] !px-3 text-sm shrink-0">{sendingEmailTo === client.id ? <Spinner /> : 'Invite'}</button>
                                                )}
                                                <button onClick={async () => { if (await showConfirm({ message: 'Delete client?' })) { try { await deleteDoc(doc(db, 'clients', client.id)); showToast('Client deleted', 'success'); } catch(err){ showToast("Couldn't delete that client", 'error'); } } }} aria-label={`Delete ${client.name}`} className="icon-btn -mr-2 shrink-0 hover:!text-red-400"><TrashIcon /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'inbox' && (
                            <div className="fade-in space-y-5">
                                <div>
                                    <h2 className="text-3xl text-white min-[900px]:hidden">Chat</h2>
                                    <p className="text-sm text-zinc-400">Clients with a BlackBook account can message you here.</p>
                                </div>
                                <div className="ledger">
                                    {clients.slice().sort((a, b) => {
                                        const aCount = unreadFor(a);
                                        const bCount = unreadFor(b);
                                        if (bCount !== aCount) return bCount - aCount;
                                        return (a.name || '').localeCompare(b.name || '');
                                    }).map(client => {
                                        const unreadCount = unreadFor(client);
                                        return (
                                            <button key={client.id} onClick={() => openChat(client)} className="ledger-row">
                                                <span className="relative shrink-0">
                                                    {client.photoURL
                                                        ? <img src={client.photoURL} alt="" className="w-11 h-11 rounded-full object-cover" />
                                                        : <span className="avatar w-11 h-11 text-lg">{(client.name || '').charAt(0) || '?'}</span>}
                                                    {unreadCount > 0 && <span className="badge-num">{unreadCount}</span>}
                                                </span>
                                                <span className="flex-1 min-w-0">
                                                    <span className={`block truncate ${unreadCount ? 'text-white font-bold' : 'text-white font-semibold'}`}>{client.name}</span>
                                                    <span className={`block text-sm truncate ${unreadCount ? 'text-gold' : 'text-zinc-500'}`}>{unreadCount ? `${unreadCount} new message${unreadCount === 1 ? '' : 's'}` : client.email ? 'Open conversation' : 'No email, so no account yet'}</span>
                                                </span>
                                                <span className="text-zinc-600"><ChevronRight /></span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {activeTab === 'marketing' && (() => {
                            const emailable = clients.filter(c => c.email);
                            const toggleClient = (id) => setSelectedClients(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
                            return (
                            <div className="fade-in space-y-5">
                                <div className="flex items-end justify-between gap-3">
                                    <div>
                                        <h2 className="text-3xl text-white min-[900px]:hidden">Promos</h2>
                                        <p className="text-sm text-zinc-400">Email the clients you pick. Each email uses 1 credit.</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-xs text-zinc-400">Credits</div>
                                        <div className="num text-3xl text-gold leading-none">{userProfile.credits || 0}</div>
                                    </div>
                                </div>
                                <div className="grid gap-6 min-[900px]:grid-cols-2">
                                    <div className="space-y-4">
                                        <Field label="Subject"><input value={promoSubject} onChange={(e) => setPromoSubject(e.target.value)} placeholder="Open chairs this Friday" className={inputCls} /></Field>
                                        <Field label="Message" hint="Type {name} and each client sees their own first name."><textarea rows={5} value={promoText} onChange={(e) => setPromoText(e.target.value)} className={areaCls} /></Field>
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="field-label !mb-0">Send to</span>
                                                <span className="flex gap-1">
                                                    <button onClick={() => setSelectedClients(emailable.map(c => c.id))} className="btn btn-ghost !min-h-[32px] !px-2 text-sm">Everyone</button>
                                                    <button onClick={() => setSelectedClients([])} className="btn btn-ghost !min-h-[32px] !px-2 text-sm">No one</button>
                                                </span>
                                            </div>
                                            <div className="ledger max-h-72 overflow-y-auto">
                                                {clients.length === 0 && <div className="p-4 text-sm text-zinc-400">Add clients first, then come back to send a promo.</div>}
                                                {clients.map(client => (
                                                    <label key={client.id} className={`ledger-row !py-3 cursor-pointer ${client.email ? '' : 'opacity-50 cursor-not-allowed'}`}>
                                                        <input type="checkbox" disabled={!client.email} checked={selectedClients.includes(client.id)} onChange={() => toggleClient(client.id)} className="w-5 h-5 shrink-0" />
                                                        <span className="flex-1 min-w-0 truncate text-white">{client.name}</span>
                                                        <span className="text-sm text-zinc-500 truncate max-w-[45%]">{client.email || 'No email'}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <button onClick={handleBlastAll} disabled={selectedClients.length === 0} className="btn btn-primary w-full"><Send /> {selectedClients.length > 0 ? `Send to ${selectedClients.length} (${selectedClients.length} credit${selectedClients.length === 1 ? '' : 's'})` : 'Pick who gets it'}</button>
                                    </div>
                                    <div>
                                        <span className="field-label">Preview</span>
                                        <div className="rounded-xl overflow-hidden border border-zinc-800">
                                            <div className="bg-zinc-950 px-4 py-2.5 text-sm text-zinc-400 border-b border-zinc-800 truncate">Subject: <span className="text-white">{promoSubject || 'No subject yet'}</span></div>
                                            <div className="bg-[#1a1a1a] p-6">
                                                <div className="logo text-2xl text-center mb-5">Black<span className="text-gold">Book</span></div>
                                                <p className="text-zinc-300 text-[15px] whitespace-pre-wrap leading-relaxed">{promoText.replaceAll("{name}", "Jordan") || "Your message shows here."}</p>
                                                <div className="mt-6 text-center"><span className="inline-block bg-gold text-black font-bold py-2.5 px-5 rounded text-sm">Book appointment</span></div>
                                                <p className="mt-6 pt-4 border-t border-zinc-800 text-xs text-zinc-500 text-center">Sent because you're a client of {userProfile.firstName || 'your barber'}.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            );
                        })()}
                        {activeTab === 'menu' && (() => {
                            const resetService = () => { setEditingServiceId(null); setNewServiceName(''); setNewServicePrice(''); setNewSalePrice(''); setNewServiceDuration(''); setNewServiceDesc(''); setNewServiceCategory(''); setNewServiceRecommended(false); setNewServiceActive(true); };
                            const closeService = () => { setShowAddServiceModal(false); resetService(); };
                            return (
                            <div className="fade-in space-y-6">
                                <div className="flex items-end justify-between gap-3 flex-wrap">
                                    <div>
                                        <h2 className="text-3xl text-white min-[900px]:hidden">Menu</h2>
                                        <p className="text-sm text-zinc-400">What clients can book, with prices and how long each takes.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setShowCreateCouponModal(true)} className="btn btn-secondary">New coupon</button>
                                        <button onClick={() => { resetService(); setShowAddServiceModal(true); }} className="btn btn-primary"><PlusIcon /> Add service</button>
                                    </div>
                                </div>

                                {showAddServiceModal && (
                                    <Sheet title={editingServiceId ? 'Edit service' : 'Add service'} onClose={closeService} footer={<>
                                        <button onClick={closeService} className="btn btn-secondary flex-1">Cancel</button>
                                        <button onClick={async () => { await addService(); setShowAddServiceModal(false); }} disabled={!newServiceName || !newServicePrice} className="btn btn-primary flex-1">{editingServiceId ? 'Save service' : 'Add service'}</button>
                                    </>}>
                                        <div className="space-y-4">
                                            <Field label="Name"><input value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} placeholder="Skin fade" className={inputCls} /></Field>
                                            <Field label="Description" hint="Optional"><textarea rows={2} value={newServiceDesc} onChange={(e) => setNewServiceDesc(e.target.value)} className={areaCls} /></Field>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Field label="Price ($)"><input type="number" inputMode="decimal" value={newServicePrice} onChange={(e) => setNewServicePrice(e.target.value)} placeholder="40" className={inputCls} /></Field>
                                                <Field label="Sale price ($)" hint="Optional"><input type="number" inputMode="decimal" value={newSalePrice} onChange={(e) => setNewSalePrice(e.target.value)} className={inputCls} /></Field>
                                                <Field label="Takes (minutes)"><input type="number" inputMode="numeric" value={newServiceDuration} onChange={(e) => setNewServiceDuration(e.target.value)} placeholder={String(shopSettings.slotDuration || 45)} className={inputCls} /></Field>
                                                <Field label="Category" hint="Optional"><input value={newServiceCategory} onChange={(e) => setNewServiceCategory(e.target.value)} placeholder="Cuts" className={inputCls} /></Field>
                                            </div>
                                            <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1">
                                                <label className="flex items-center gap-2 text-white cursor-pointer"><input type="checkbox" checked={newServiceRecommended} onChange={(e) => setNewServiceRecommended(e.target.checked)} className="w-5 h-5" /> Recommend it to clients</label>
                                                <label className="flex items-center gap-2 text-white cursor-pointer"><input type="checkbox" checked={newServiceActive} onChange={(e) => setNewServiceActive(e.target.checked)} className="w-5 h-5" /> Clients can book it</label>
                                            </div>
                                        </div>
                                    </Sheet>
                                )}

                                {services.length === 0 ? (
                                    <div className="panel p-8 text-center">
                                        <p className="text-white font-semibold">Your menu is empty</p>
                                        <p className="text-zinc-400 text-sm mt-1">Add your first service so clients can book it online.</p>
                                    </div>
                                ) : (
                                    <div className="ledger">
                                        {services.map(svc => {
                                            const onSale = svc.salePrice && Number(svc.salePrice) < Number(svc.price);
                                            return (
                                                <div key={svc.id} className={`ledger-row ${svc.active === false ? 'opacity-60' : ''}`}>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-white font-semibold">{svc.name}</span>
                                                            {svc.recommended && <span className="chip chip-gold !h-5 !px-2">Recommended</span>}
                                                            {svc.active === false && <span className="chip !h-5 !px-2">Hidden</span>}
                                                        </div>
                                                        <div className="text-sm text-zinc-400 truncate">{formatDuration(Number(svc.duration || shopSettings.slotDuration))}{svc.category ? `, ${svc.category}` : ''}{svc.description ? `. ${svc.description}` : ''}</div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="num text-xl text-white">${onSale ? svc.salePrice : svc.price}</div>
                                                        {onSale && <div className="text-xs text-zinc-500 line-through">${svc.price}</div>}
                                                    </div>
                                                    <div className="flex shrink-0 -mr-2">
                                                        <button onClick={() => { setNewServiceName(svc.name); setNewServicePrice(svc.price); setNewSalePrice(svc.salePrice || ''); setNewServiceDuration(svc.duration || shopSettings.slotDuration); setNewServiceDesc(svc.description || ''); setNewServiceCategory(svc.category || ''); setNewServiceRecommended(!!svc.recommended); setNewServiceActive(svc.active !== false); setEditingServiceId(svc.id); setShowAddServiceModal(true); }} aria-label={`Edit ${svc.name}`} className="icon-btn"><EditIcon /></button>
                                                        <button onClick={() => deleteService(svc.id)} aria-label={`Delete ${svc.name}`} className="icon-btn hover:!text-red-400"><TrashIcon /></button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div>
                                    <h3 className="text-2xl text-white mb-3">Coupons</h3>
                                    {coupons.length === 0 ? (
                                        <div className="panel p-5 text-sm text-zinc-400">No coupons yet. Clients enter a coupon code when they book to get money off.</div>
                                    ) : (
                                        <div className="ledger">
                                            {coupons.map(cp => (
                                                <div key={cp.id} className="ledger-row">
                                                    <span className="font-bold tracking-wide text-gold flex-1">{cp.code}</span>
                                                    <span className="text-zinc-300">{cp.type === 'fixed' ? `$${cp.value} off` : `${cp.value}% off`}</span>
                                                    <button onClick={() => deleteCoupon(cp.id)} aria-label={`Delete coupon ${cp.code}`} className="icon-btn -mr-2 hover:!text-red-400"><TrashIcon /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            );
                        })()}
                    </>
                )}
            </main>

            <nav className="bb-tabbar" aria-label="Sections">
                <div className="bb-tabbar-brand"><span className="logo text-3xl">Black<span className="text-gold">Book</span></span></div>
                {barberTabs.map(t => {
                    const active = activeTab === t.id && !showSettings;
                    return (
                        <button key={t.id} onClick={() => { setActiveTab(t.id); setShowSettings(false); }} aria-current={active ? 'page' : undefined} className={`bb-tab ${active ? 'is-active' : ''}`}>
                            {t.icon}<span className="truncate">{t.label}</span>{t.badge > 0 && <span className="tab-badge" aria-label={`${t.badge} unread`}>{t.badge}</span>}
                        </button>
                    );
                })}
            </nav>

            {isBlasting && (
                <div className="bb-overlay">
                    <div role="dialog" aria-modal="true" aria-label="Sending promo" className="bb-sheet">
                        <h3 className="text-[28px] text-white">Sending promo</h3>
                        <p className="text-sm text-zinc-400 mt-1">Keep this open until it says done.</p>
                        <div className="mt-4 max-h-72 overflow-y-auto ledger text-sm" aria-live="polite">
                            {blastLogs.filter(l => !/^-+$/.test(l.trim())).map((log, i) => (
                                <div key={i} className={`px-4 py-2 ${log.includes('SENT') ? 'text-green-400' : /FAILED|ERROR/.test(log) ? 'text-red-400' : 'text-zinc-300'}`}>{log.replace(/^\s*>\s*/, '').replace(' ✅', '')}</div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                    </div>
                </div>
            )}

            {chattingWith && ( <ChatWindow currentUser={user} chatPartnerUid={chattingWith.uid} chatPartnerName={chattingWith.name} onClose={() => setChattingWith(null)} /> )}

            {showSupport && <SupportModal user={user} onClose={() => setShowSupport(false)} />}

            {showCreateCouponModal && (
                <Sheet title="New coupon" onClose={() => setShowCreateCouponModal(false)} footer={<>
                    <button onClick={() => setShowCreateCouponModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                    <button onClick={async () => { await addCoupon(); setShowCreateCouponModal(false); }} disabled={!newCouponCode || !newCouponValue} className="btn btn-primary flex-1">Create coupon</button>
                </>}>
                    <div className="space-y-4">
                        <Field label="Code" hint="What clients type at checkout"><input value={newCouponCode} onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())} placeholder="SAVE10" className={`${inputCls} font-bold tracking-wider`} /></Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Discount type">
                                <select value={newCouponType} onChange={(e) => setNewCouponType(e.target.value)} className={inputCls}><option value="fixed">Dollars off</option><option value="percent">Percent off</option></select>
                            </Field>
                            <Field label={newCouponType === 'percent' ? 'Percent' : 'Dollars'}><input type="number" inputMode="decimal" value={newCouponValue} onChange={(e) => setNewCouponValue(e.target.value)} placeholder={newCouponType === 'percent' ? '10' : '5'} className={inputCls} /></Field>
                        </div>
                    </div>
                </Sheet>
            )}

            {editingAppt && (() => {
                const picked = editingAppt.services && Array.isArray(editingAppt.services) ? editingAppt.services : [];
                const toggleSvc = (svc) => {
                    const has = picked.find(x => x.id === svc.id);
                    const arr = has ? picked.filter(x => x.id !== svc.id) : [...picked, { ...svc, note: '' }];
                    setEditingAppt({ ...editingAppt, services: arr, price: arr.reduce((sum, it) => sum + Number(it.salePrice || it.price || 0), 0) });
                };
                return (
                    <Sheet title={editingAppt.id ? 'Edit appointment' : 'New booking'} onClose={() => setEditingAppt(null)}>
                        <form onSubmit={saveAppt} className="space-y-4">
                            <Field label="Client" hint="Pick from your clients or type any name, walk-ins too">
                                <input value={editingAppt.clientName} onChange={e => setEditingAppt({...editingAppt, clientName: e.target.value})} className={inputCls} placeholder="Walk-in" list="client-options" autoComplete="off" />
                                <datalist id="client-options">{clients.map(c => <option key={c.id} value={c.name} />)}</datalist>
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Date"><input type="date" value={editingAppt.date} onChange={e => setEditingAppt({...editingAppt, date: e.target.value})} className={inputCls} /></Field>
                                <Field label="Time"><input type="time" value={editingAppt.time} onChange={e => setEditingAppt({...editingAppt, time: e.target.value})} className={inputCls} /></Field>
                            </div>
                            {services.length > 0 && (
                                <div>
                                    <span className="field-label">Services</span>
                                    <div className="flex gap-2 flex-wrap">
                                        {services.map(svc => {
                                            const on = !!picked.find(x => x.id === svc.id);
                                            return <button key={svc.id} type="button" aria-pressed={on} onClick={() => toggleSvc(svc)} className={`h-9 px-3 rounded-full border text-sm font-semibold transition-colors ${on ? 'bg-gold border-gold text-black' : 'border-zinc-700 text-zinc-200 hover:border-zinc-500'}`}>{svc.name}</button>;
                                        })}
                                    </div>
                                    {picked.length > 0 && (
                                        <div className="ledger mt-3">
                                            {picked.map(s => (
                                                <div key={s.id || s.name} className="px-4 py-3">
                                                    <div className="flex justify-between gap-3"><span className="text-white font-semibold">{s.name}</span><span className="num text-lg text-white">${s.salePrice || s.price || 0}</span></div>
                                                    <input value={s.note || ''} onChange={(e) => setEditingAppt(prev => ({...prev, services: prev.services.map(x => x.id === s.id ? {...x, note: e.target.value} : x)}))} placeholder="Note, like 'keep length on top'" aria-label={`Note for ${s.name}`} className={`${inputCls} !h-9 mt-2 text-sm`} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="grid grid-cols-[1fr_120px] gap-3">
                                <Field label={picked.length ? 'Extra service' : 'Service'} hint={picked.length ? 'Optional' : undefined}><input value={editingAppt.service || ''} onChange={e => setEditingAppt({...editingAppt, service: e.target.value})} className={inputCls} placeholder="Kid's cut" /></Field>
                                <Field label="Price ($)"><input type="number" inputMode="decimal" value={editingAppt.price || ''} onChange={e => setEditingAppt({...editingAppt, price: e.target.value})} className={`${inputCls} text-right font-bold`} placeholder="0" /></Field>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setEditingAppt(null)} className="btn btn-secondary flex-1">Cancel</button>
                                <button type="submit" className="btn btn-primary flex-1">{editingAppt.id ? 'Save changes' : 'Book it'}</button>
                            </div>
                            {editingAppt.id && <button type="button" onClick={deleteAppt} className="btn btn-danger w-full">Delete appointment</button>}
                        </form>
                    </Sheet>
                );
            })()}

            {viewingAppt && (
                <Sheet title={viewingAppt.clientName || 'Walk-in'} onClose={() => setViewingAppt(null)} footer={<>
                    <button onClick={async () => { if (await showConfirm({ message: 'Delete appointment?' })) { try { await deleteDoc(doc(db, 'appointments', viewingAppt.id)); showToast('Appointment deleted', 'success'); setViewingAppt(null); } catch(e){ showToast("Couldn't delete it. Try again.", 'error'); } } }} aria-label="Delete appointment" className="btn btn-danger !px-3"><TrashIcon /></button>
                    <button onClick={() => { setEditingAppt(viewingAppt); setViewingAppt(null); }} className="btn btn-secondary flex-1">Edit</button>
                    {viewingAppt.status !== 'cancelled' && <button onClick={async (e) => { await toggleApptStatus(viewingAppt, e); setViewingAppt(null); }} className="btn btn-primary flex-1">{viewingAppt.status === 'completed' ? 'Mark not done' : 'Mark done'}</button>}
                </>}>
                    <div className="-mt-3 mb-4 text-zinc-400">
                        {(parseDatePST(viewingAppt.date) || new Date()).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}, {viewingAppt.time ? formatHM(viewingAppt.time) : ''}
                        {viewingAppt.status === 'completed' && <span className="chip !h-5 !px-2 ml-2 !text-green-400">Done</span>}
                        {viewingAppt.status === 'cancelled' && <span className="chip !h-5 !px-2 ml-2 !text-red-400">Cancelled</span>}
                    </div>
                    <div className="ledger">
                        {(viewingAppt.services && viewingAppt.services.length > 0) ? viewingAppt.services.map((s, i) => (
                            <div key={i} className="px-4 py-3 flex justify-between gap-3">
                                <div className="min-w-0"><div className="text-white font-semibold">{s.name}</div>{s.note && <div className="text-sm text-zinc-400">{s.note}</div>}</div>
                                <div className="num text-lg text-white shrink-0">${Number(s.salePrice || s.price || 0).toFixed(0)}</div>
                            </div>
                        )) : <div className="px-4 py-3 text-white">{viewingAppt.service || 'No service listed'}</div>}
                        <div className="px-4 py-3 flex justify-between items-baseline bg-zinc-950">
                            <span className="text-zinc-400">Total</span>
                            <span className="num text-2xl text-gold">${Number(viewingAppt.price || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </Sheet>
            )}

            {editingClient && (
                <Sheet title={editingClient.id ? 'Edit client' : 'New client'} onClose={() => setEditingClient(null)}>
                    <form onSubmit={saveClient} className="space-y-4">
                        <Field label="Name"><input value={editingClient.name} onChange={e => setEditingClient({...editingClient, name: e.target.value})} className={inputCls} required /></Field>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Phone"><input value={editingClient.phone} onChange={e => setEditingClient({...editingClient, phone: e.target.value})} type="tel" className={inputCls} /></Field>
                            <Field label="Email" hint="Needed for invites and promos"><input value={editingClient.email || ""} onChange={e => setEditingClient({...editingClient, email: e.target.value})} type="email" className={inputCls} /></Field>
                        </div>
                        <Field label="Cut notes" hint="Guard numbers, products, anything you want to remember"><textarea rows={3} value={editingClient.formula} onChange={e => setEditingClient({...editingClient, formula: e.target.value})} className={areaCls} placeholder="#1 on the sides, scissor top" /></Field>
                        <div className="flex gap-2 pt-2">
                            <button type="button" onClick={() => setEditingClient(null)} className="btn btn-secondary flex-1">Cancel</button>
                            <button type="submit" className="btn btn-primary flex-1">{editingClient.id ? 'Save client' : 'Add client'}</button>
                        </div>
                        {editingClient.id && <button type="button" onClick={deleteClient} className="btn btn-danger w-full">Delete client</button>}
                    </form>
                </Sheet>
            )}
        </div>
    );
}

// --- LANDING PAGE (UPDATED) ---
// =====================================================================
// PUBLIC WEBSITE: home, for barbers, find a barber, privacy, terms
// Real URLs (Firebase Hosting rewrites every path to this page), GSAP for motion,
// Lenis for smooth scrolling. Everything still reads and works with motion off.
// =====================================================================

// Photography: Unsplash License (free for commercial use, no permission needed).
// Credited in the footer as well.
const PHOTOS = {
    hero:   { id: 'photo-1705976062088-5433328c2dcd', by: 'César Badilla Miranda', alt: 'A barber trimming a reclined client\'s beard in a dim shop' }, // unsplash.com/photos/t34TLxxmwws
    shop:   { id: 'photo-1585747860715-2ba37e788b70', by: 'Nathon Oski', alt: 'Black leather barber chairs under warm lamps against a brick wall' },  // unsplash.com/photos/EW_rqoSdDes
    barber: { id: 'photo-1693755807658-17ce5331aacb', by: 'Reza Ghaemi', alt: 'A barber in a white shirt cutting a client\'s hair' },                  // unsplash.com/photos/5P-eClxMg1s
    tools:  { id: 'photo-1621605815971-fbc98d665033', by: 'Andrea Donato', alt: 'Clippers, scissors, a comb and grooming products on a slate board' }, // unsplash.com/photos/MNu0n-3BIKs
    sign:   { id: 'photo-1633121050918-ab208f1508b7', by: 'Julien Orliac', alt: 'A barbershop sign and striped pole on a brick building' },             // unsplash.com/photos/gzobGDzh4ww
    beard:  { id: 'photo-1532710093739-9470acff878f', by: 'Arthur Humeau', alt: 'Black and white photo of a barber shaping a client\'s beard' },        // unsplash.com/photos/Twd3yaqA2NM
};
const photoUrl = (id, w) => `https://images.unsplash.com/${id}?auto=format&fit=crop&q=70&w=${w}`;

function Photo({ photo, sizes = '100vw', className = '', eager = false, ratio, reveal = false, focus }) {
    const [failed, setFailed] = useState(false);
    return (
        <div className={`photo-grade relative overflow-hidden bg-zinc-900 ${className}`} style={ratio ? { aspectRatio: ratio } : undefined} data-reveal={reveal ? 'photo' : undefined}>
            {!failed && (
                <img src={photoUrl(photo.id, 1280)} srcSet={[640, 960, 1280, 1920, 2400].map(w => `${photoUrl(photo.id, w)} ${w}w`).join(', ')}
                    sizes={sizes} alt={photo.alt} loading={eager ? 'eager' : 'lazy'} fetchpriority={eager ? 'high' : undefined} decoding="async"
                    onError={() => setFailed(true)} className="absolute inset-0 w-full h-full object-cover" style={focus ? { objectPosition: focus } : undefined} />
            )}
        </div>
    );
}

// ---- routing ----
const currentPath = () => {
    // old hash links keep working
    if (window.location.hash.startsWith('#/find')) return '/find';
    if (window.location.hash.startsWith('#/pricing')) return '/barbers';
    return (window.location.pathname.replace(/\/+$/, '') || '/').toLowerCase();
};
const navigate = (to, { replace = false } = {}) => {
    const [toPath, id] = to.split('#');
    const samePage = !toPath || toPath === window.location.pathname;
    if (to !== window.location.pathname + window.location.search + window.location.hash) history[replace ? 'replaceState' : 'pushState'](null, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
    if (id && samePage) scrollToId(id); // a new page scrolls to its own anchor once it has rendered
    else window.scrollTo(0, 0);
};
// Real links (crawlable, open in a new tab), handled in-page for normal clicks
function Link({ to, className = '', children, ...rest }) {
    if (/^(mailto:|https?:)/.test(to)) return <a href={to} className={className} {...rest}>{children}</a>;
    return <a href={to} className={className} onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault(); navigate(to);
    }} {...rest}>{children}</a>;
}
function usePageMeta(title, description) {
    useEffect(() => {
        document.title = title;
        const d = document.querySelector('meta[name="description"]'); if (d && description) d.setAttribute('content', description);
        const c = document.querySelector('link[rel="canonical"]'); if (c) c.setAttribute('href', 'https://blackbookcrm.org' + (window.location.pathname === '/' ? '/' : window.location.pathname));
    }, [title, description]);
}

// ---- motion ----
// One place that starts Lenis + GSAP for a page and tears it all down when the page goes away.
// With reduced motion there is no smooth scrolling and no animation: content is simply there.
function useSiteMotion(scopeRef, setup) {
    React.useLayoutEffect(() => {
        const g = window.gsap, ST = window.ScrollTrigger;
        if (!g || !ST || !scopeRef.current || prefersReducedMotion()) return;
        g.registerPlugin(ST);
        let lenis = null;
        const tick = (t) => lenis && lenis.raf(t * 1000);
        if (window.Lenis) {
            lenis = new window.Lenis({ lerp: 0.12, smoothWheel: true }); // touch keeps native scrolling
            lenis.on('scroll', ST.update);
            g.ticker.add(tick);
            g.ticker.lagSmoothing(0);
            window.__lenis = lenis;
        }
        const ctx = g.context(() => setup(g, ST), scopeRef);
        const refresh = () => ST.refresh();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
        window.addEventListener('load', refresh);
        return () => {
            window.removeEventListener('load', refresh);
            ctx.revert();
            g.ticker.remove(tick);
            if (lenis) { lenis.destroy(); if (window.__lenis === lenis) window.__lenis = null; }
        };
    }, []);
}
// Shared reveals: headings word by word, blocks rise, photos open like a shutter while drifting
function revealOnScroll(g) {
    g.utils.toArray('[data-reveal="words"]').forEach(el => g.from(el.querySelectorAll('.split-i'), { yPercent: 115, duration: 0.9, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: el, start: 'top 86%', once: true } }));
    g.utils.toArray('[data-reveal="up"]').forEach(el => g.from(el, { y: 26, autoAlpha: 0, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }));
    g.utils.toArray('[data-reveal="photo"]').forEach(el => {
        g.from(el, { clipPath: 'inset(16% 0% 16% 0%)', duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
        const img = el.querySelector('img');
        if (img) g.fromTo(img, { yPercent: -5, scale: 1.12 }, { yPercent: 5, scale: 1.12, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
}
const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (window.__lenis) window.__lenis.scrollTo(el, { offset: -72 });
    else el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
};

// Heading split into words for the reveal. Screen readers get the plain sentence.
function SplitWords({ text, as: Tag = 'h2', className = '', reveal = true }) {
    const lines = text.split('|');
    return (
        <Tag className={className} data-reveal={reveal ? 'words' : undefined}>
            <span className="sr-only">{lines.join(' ')}</span>
            <span aria-hidden="true">
                {lines.map((line, li) => (
                    <span key={li} className="block">
                        {line.trim().split(' ').map((w, i, arr) => (
                            <React.Fragment key={i}><span className="split-w"><span className="split-i">{w}</span></span>{i < arr.length - 1 ? ' ' : ''}</React.Fragment>
                        ))}
                    </span>
                ))}
            </span>
        </Tag>
    );
}

const MenuIcon = () => <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
const Icon = ({ name }) => <iconify-icon icon={`solar:${name}`} aria-hidden="true"></iconify-icon>;

function SiteNav({ current }) {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        const close = () => setOpen(false);
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('popstate', close); window.addEventListener('keydown', onKey);
        return () => { window.removeEventListener('popstate', close); window.removeEventListener('keydown', onKey); };
    }, []);
    const links = [['/find', 'Find a barber'], ['/barbers', 'For barbers']];
    return (
        <header className="site-nav">
            <a href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById('main'); if (m) { m.focus({ preventScroll: true }); scrollToId('main'); } }} className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[1200] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-gold focus:text-black focus:font-bold">Skip to content</a>
            <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-4">
                <Link to="/" className="logo text-[28px] mr-auto" aria-label="BlackBook home">Black<span className="text-gold">Book</span></Link>
                <nav aria-label="Main" className="hidden md:flex items-center gap-1">
                    {links.map(([to, label]) => <Link key={to} to={to} aria-current={current === to ? 'page' : undefined} className={`site-link ${current === to ? 'is-current' : ''}`}>{label}</Link>)}
                    <Link to="/login" className="site-link">Log in</Link>
                </nav>
                <Link to="/find" className="btn btn-primary !min-h-[40px] !px-4 text-[15px]">Book a cut</Link>
                <button className="icon-btn md:hidden -mr-2" aria-expanded={open} aria-controls="site-menu" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(o => !o)}>{open ? <XIcon /> : <MenuIcon />}</button>
            </div>
            <div id="site-menu" className={`site-menu md:hidden ${open ? 'is-open' : ''}`}>
                <div>
                    <nav aria-label="Menu" className="px-5 pb-6 pt-1">
                        {[...links, ['/login', 'Log in'], ['/signup', 'Create an account']].map(([to, label]) => (
                            <Link key={to} to={to} tabIndex={open ? 0 : -1} aria-current={current === to ? 'page' : undefined} className="site-menu-link">{label}</Link>
                        ))}
                    </nav>
                </div>
            </div>
        </header>
    );
}

function SiteFooter() {
    const cols = [
        ['Clients', [['/find', 'Find a barber'], ['/signup', 'Create an account'], ['/login', 'Log in']]],
        ['Barbers', [['/barbers', 'What you get'], ['/barbers#pricing', 'Pricing'], ['/barbers/signup', 'Start free']]],
        ['BlackBook', [['/privacy', 'Privacy'], ['/terms', 'Terms'], ['mailto:support@blackbookcrm.org', 'Support']]],
    ];
    return (
        <footer className="border-t border-zinc-900 px-5 sm:px-8 pt-14 pb-[calc(40px+env(safe-area-inset-bottom))]">
            <div className="max-w-6xl mx-auto grid gap-10 grid-cols-2 sm:grid-cols-[1.6fr_1fr_1fr_1fr]">
                <div className="col-span-2 sm:col-span-1">
                    <Link to="/" className="logo text-3xl" aria-label="BlackBook home">Black<span className="text-gold">Book</span></Link>
                    <p className="text-zinc-400 mt-3 max-w-xs">Find a barber and book the chair. Barbers run the whole shop from their phone.</p>
                </div>
                {cols.map(([title, links]) => (
                    <div key={title}>
                        <h2 className="text-xl text-white mb-3">{title}</h2>
                        <ul className="space-y-2">{links.map(([to, label]) => <li key={to}><Link to={to} className="text-zinc-400 hover:text-white">{label}</Link></li>)}</ul>
                    </div>
                ))}
            </div>
            <div className="max-w-6xl mx-auto mt-12 pt-6 border-t border-zinc-900 flex flex-col sm:flex-row gap-2 justify-between text-sm text-zinc-500">
                <span>© {new Date().getFullYear()} BlackBook</span>
                <span>Photos by {Object.values(PHOTOS).map(p => p.by).join(', ')} on Unsplash.</span>
            </div>
        </footer>
    );
}

function Faq({ items }) {
    return (
        <div className="ledger">
            {items.map(item => (
                <details key={item.q} className="group">
                    <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none text-white font-semibold text-[17px] [&::-webkit-details-marker]:hidden">
                        {item.q}
                        <span className="text-zinc-500 transition-transform duration-200 group-open:rotate-90 shrink-0"><ChevronRight /></span>
                    </summary>
                    <p className="px-5 pb-5 -mt-1 text-zinc-400 max-w-2xl">{item.a}</p>
                </details>
            ))}
        </div>
    );
}

// The coming Friday, so sample tickets look like a real next appointment
const sampleFriday = () => { const d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };

// ---------- HOME ----------
function LandingPage() {
    const root = useRef(null);
    usePageMeta('BlackBook: find a barber and book the chair', 'Find a barber near you, see their menu and open times, and book in seconds. Free for clients.');
    const day = sampleFriday();

    useSiteMotion(root, (g, ST) => {
        // Arrival: the photo settles, the headline rises word by word, then the ticket is set down.
        // Nav and buttons are never hidden, so the page is usable from the first frame.
        const tl = g.timeline({ defaults: { ease: 'expo.out' } });
        tl.from('.hero-photo img', { scale: 1.14, duration: 1.8 }, 0)
          .from('.hero-title .split-i', { yPercent: 115, duration: 1, stagger: 0.07 }, 0.05)
          .from('.hero-sub', { y: 18, autoAlpha: 0, duration: 0.8 }, 0.45)
          .from('.hero-cta', { y: 14, duration: 0.8 }, 0.5)
          .from('.hero-ticket', { y: 80, rotation: -14, autoAlpha: 0, duration: 1.2 }, 0.55);

        // The ticket leans toward a mouse pointer (never on touch)
        let untilt = null;
        const hero = root.current.querySelector('.hero');
        const ticket = root.current.querySelector('.hero-tilt'); // a wrapper, so the tilt never fights the arrival tween
        if (hero && ticket && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            g.set(ticket, { transformPerspective: 900 });
            const rx = g.quickTo(ticket, 'rotationX', { duration: 0.7, ease: 'power3' });
            const ry = g.quickTo(ticket, 'rotationY', { duration: 0.7, ease: 'power3' });
            const move = (e) => { const r = hero.getBoundingClientRect(); rx(((e.clientY - r.top) / r.height - 0.5) * -8); ry(((e.clientX - r.left) / r.width - 0.5) * 10); };
            const reset = () => { rx(0); ry(0); };
            hero.addEventListener('pointermove', move); hero.addEventListener('pointerleave', reset); window.addEventListener('blur', reset);
            untilt = () => { hero.removeEventListener('pointermove', move); hero.removeEventListener('pointerleave', reset); window.removeEventListener('blur', reset); };
        }

        revealOnScroll(g);
        // How it works: on wide screens the section holds still while the ticket fills in step by step
        const mm = g.matchMedia();
        mm.add('(min-width: 900px)', () => {
            const steps = g.utils.toArray('.how-step');
            const tl = g.timeline({ scrollTrigger: { trigger: '.how-pin', start: 'top top', end: '+=1500', pin: true, scrub: 0.6 } });
            tl.set(steps, { opacity: 0.32 })
              .to(steps[0], { opacity: 1, duration: 0.2 })
              .from('.how-f1', { autoAlpha: 0, y: 16, stagger: 0.12, duration: 0.6 })
              .to(steps[0], { opacity: 0.32, duration: 0.2 }, '+=0.35').to(steps[1], { opacity: 1, duration: 0.2 }, '<')
              .from('.how-f2', { clipPath: 'inset(0% 100% 0% 0%)', duration: 0.9, ease: 'none' })
              .to(steps[1], { opacity: 0.32, duration: 0.2 }, '+=0.35').to(steps[2], { opacity: 1, duration: 0.2 }, '<')
              .from('.how-stamp', { scale: 1.9, rotation: -16, autoAlpha: 0, duration: 0.5, ease: 'back.out(2.2)' })
              .to({}, { duration: 0.5 });
        });
        mm.add('(max-width: 899px)', () => {
            g.from('.how-stamp', { scale: 1.9, rotation: -16, autoAlpha: 0, duration: 0.6, ease: 'back.out(2.2)', scrollTrigger: { trigger: '.how-ticket', start: 'top 70%', once: true } });
        });
        // Map teaser: pins drop in one by one, then the nearest barber card slides up
        g.from('.teaser-pin', { y: -18, autoAlpha: 0, duration: 0.5, ease: 'expo.out', stagger: 0.09, scrollTrigger: { trigger: '.teaser', start: 'top 75%', once: true } });
        g.from('.teaser-card', { y: 24, autoAlpha: 0, duration: 0.7, ease: 'expo.out', delay: 0.5, scrollTrigger: { trigger: '.teaser', start: 'top 75%', once: true } });
        return untilt; // gsap.context runs this on revert
    });

    const clientFaq = [
        { q: 'Do I pay to use BlackBook?', a: 'No. BlackBook is free for clients. You pay your barber at the shop, the same as always.' },
        { q: 'How do I find a barber?', a: 'Open the map to see barbers near you with their menus and open times. If your barber sent you an invite link or code, use it to connect straight to them.' },
        { q: 'Can I move or cancel an appointment?', a: 'Yes. Open Visits, tap the appointment, and pick a new time or cancel it.' },
        { q: 'Do I need to download an app?', a: 'No. BlackBook runs in your phone\'s browser. You can add it to your home screen so it opens like an app.' },
    ];

    return (
        <div ref={root} className="bg-black text-white">
            <SiteNav current="/" />
            <main id="main" tabIndex={-1}>
                {/* HERO */}
                <section className="hero relative min-h-[calc(100svh-64px)] flex items-end overflow-hidden">
                    <Photo photo={PHOTOS.hero} eager focus="68% 40%" className="hero-photo !absolute inset-0" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.25)_0%,rgba(0,0,0,0.55)_45%,#000_100%)]" aria-hidden="true" />
                    <div className="relative w-full max-w-6xl mx-auto px-5 sm:px-8 pb-12 sm:pb-16 pt-24 grid gap-10 min-[900px]:grid-cols-[1.25fr_0.75fr] items-end">
                        <div>
                            <SplitWords as="h1" reveal={false} text="Find your barber.|Book the chair." className="hero-title font-display font-black text-[60px] sm:text-[96px] min-[1100px]:text-[116px] leading-[0.86] text-white" />
                            <p className="hero-sub mt-6 text-lg text-zinc-200 max-w-md">See barbers near you, check their menu and open times, and book in seconds. Already have a barber? Go straight to their book.</p>
                            <div className="hero-cta mt-8 max-w-md">
                                <Link to="/find" className="press flex items-center gap-3 h-14 pl-4 pr-1.5 rounded-xl bg-black/70 backdrop-blur border border-zinc-600 hover:border-gold transition-colors">
                                    <span className="text-gold text-xl"><Icon name="map-point-bold" /></span>
                                    <span className="flex-1 text-zinc-300">Barbers near you</span>
                                    <span className="h-11 px-5 rounded-lg bg-gold text-black font-bold flex items-center">Search</span>
                                </Link>
                                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
                                    <Link to="/signup" className="text-white font-semibold underline underline-offset-4 decoration-zinc-500 hover:decoration-gold">Book with my barber</Link>
                                    <Link to="/barbers" className="text-zinc-300 hover:text-white underline underline-offset-4 decoration-zinc-600">I'm a barber</Link>
                                </div>
                            </div>
                        </div>
                        <div className="hidden min-[900px]:block" aria-hidden="true">
                            <div className="hero-tilt max-w-[380px] ml-auto"><div className="hero-ticket ticket">
                                <div className="ticket-top flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-sm ticket-muted font-semibold">Your next cut</div>
                                        <div className="ticket-display text-[52px] mt-1">{day}</div>
                                        <div className="ticket-display text-3xl">3:15PM</div>
                                    </div>
                                    <span className="ticket-stamp mt-1">Booked</span>
                                </div>
                                <div className="ticket-bottom flex items-end justify-between gap-3">
                                    <div><div className="font-semibold">Skin fade, lineup</div><div className="text-sm ticket-muted">at Fresh Fades, 0.4 mi away</div></div>
                                    <div className="ticket-display text-4xl">$55</div>
                                </div>
                            </div></div>
                        </div>
                    </div>
                </section>

                {/* HOW IT WORKS: a real sequence, so the steps are numbered */}
                <section className="how border-t border-zinc-900">
                    <div className="how-pin">
                        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 min-[900px]:py-0 min-[900px]:h-screen grid gap-12 min-[900px]:grid-cols-2 items-center">
                            <div>
                                <SplitWords text="Three taps|to the chair." className="text-5xl sm:text-7xl text-white" />
                                <ol className="ledger mt-8">
                                    {[['Find your barber', 'Search the map, or open the invite link your barber sent you.'],
                                      ['Pick a time', 'See the times that are really open and tap the one that suits you.'],
                                      ['You\'re in the book', 'Your barber sees it straight away. Move or cancel it from your phone.']].map(([t, d], i) => (
                                        <li key={t} className="how-step flex gap-4 px-5 py-5">
                                            <span className="num text-4xl text-gold w-7 shrink-0 leading-none">{i + 1}</span>
                                            <span><span className="block text-white font-semibold text-lg">{t}</span><span className="block text-zinc-400">{d}</span></span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                            <div className="how-ticket ticket max-w-[400px] w-full mx-auto rotate-[2deg]" aria-hidden="true">
                                <div className="ticket-top">
                                    <div className="text-sm ticket-muted font-semibold">Booking</div>
                                    <div className="how-f1 ticket-display text-[48px] mt-1">Fresh Fades</div>
                                    <div className="how-f1 text-sm ticket-muted">Skin fade with Marcus, 0.4 mi away</div>
                                    <div className="how-f2 block ticket-display text-3xl mt-4">{day}, 3:15PM</div>
                                </div>
                                <div className="ticket-bottom flex items-end justify-between gap-3">
                                    <div><div className="font-semibold">See you there</div><div className="text-sm ticket-muted">Change or cancel any time</div></div>
                                    <span className="how-stamp ticket-stamp !text-base !h-9 !px-3">Booked</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* THE MAP */}
                <section className="border-t border-zinc-900 px-5 sm:px-8 py-20 sm:py-28">
                    <div className="max-w-6xl mx-auto grid gap-12 min-[900px]:grid-cols-2 items-center">
                        <div>
                            <SplitWords text="Every good chair nearby,|on one map." className="text-5xl sm:text-6xl text-white" />
                            <p data-reveal="up" className="text-zinc-400 mt-5 max-w-md text-lg">See who's close, what they charge and when they're free. Tap a barber, pick a time, done. No calling around, no waiting on texts back.</p>
                            <div data-reveal="up"><Link to="/find" className="btn btn-primary mt-7">Open the map</Link></div>
                        </div>
                        <div className="teaser bb-mapbg relative h-80 sm:h-96 rounded-2xl border border-zinc-800 overflow-hidden" aria-hidden="true">
                            <div className="absolute -inset-x-4 top-[38%] h-[3px] bg-zinc-800 rotate-[-8deg]" />
                            <div className="absolute -inset-y-4 left-[58%] w-[3px] bg-zinc-800 rotate-[12deg]" />
                            <div className="absolute -inset-x-4 top-[74%] h-[2px] bg-zinc-800/70 rotate-[4deg]" />
                            {[{ l: '20%', t: '20%' }, { l: '66%', t: '12%' }, { l: '38%', t: '48%' }, { l: '80%', t: '50%' }, { l: '12%', t: '60%' }].map((p, i) => (
                                <div key={i} className="teaser-pin absolute" style={{ left: p.l, top: p.t }}><div className="bb-pin !animate-none"><span></span></div></div>
                            ))}
                            <div className="absolute" style={{ left: '50%', top: '38%' }}><div className="bb-me" /></div>
                            <div className="teaser-card absolute left-3 right-3 bottom-3 p-3 rounded-xl bg-black/90 border border-zinc-800 flex items-center gap-3">
                                <span className="avatar w-10 h-10">F</span>
                                <div className="flex-1 min-w-0"><div className="text-white font-semibold truncate">Fresh Fades</div><div className="text-zinc-500 text-sm">0.4 mi, open until 7PM</div></div>
                                <span className="px-3 py-1.5 rounded-md bg-gold text-black text-sm font-bold">Book</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* FOR BARBERS */}
                <section className="border-t border-zinc-900 px-5 sm:px-8 py-20 sm:py-28">
                    <div className="max-w-6xl mx-auto grid gap-12 min-[900px]:grid-cols-[0.9fr_1.1fr] items-center">
                        <Photo photo={PHOTOS.barber} reveal ratio="4 / 5" sizes="(min-width: 900px) 45vw, 100vw" className="rounded-2xl" />
                        <div>
                            <SplitWords text="Barbers, run the whole|chair from your phone." className="text-5xl sm:text-6xl text-white" />
                            <ul data-reveal="up" className="ledger mt-8">
                                {[['calendar-mark-bold-duotone', 'Your day on one screen, walk-ins included'],
                                  ['notebook-bold-duotone', 'Notes on every client\'s cut, guard and product'],
                                  ['wallet-money-bold-duotone', 'What you made today, this week and this month'],
                                  ['map-point-bold-duotone', 'A spot on the map so new clients find you']].map(([icon, t]) => (
                                    <li key={t} className="flex items-center gap-4 px-5 py-4 text-zinc-200"><span className="text-gold text-2xl shrink-0"><Icon name={icon} /></span>{t}</li>
                                ))}
                            </ul>
                            <div data-reveal="up" className="mt-7 flex flex-wrap gap-3">
                                <Link to="/barbers" className="btn btn-primary">See what barbers get</Link>
                                <Link to="/barbers#pricing" className="btn btn-secondary">Pricing</Link>
                            </div>
                        </div>
                    </div>
                </section>

                {/* HOME SCREEN: a real sequence of steps */}
                <section className="border-t border-zinc-900 px-5 sm:px-8 py-20 sm:py-28">
                    <div className="max-w-6xl mx-auto grid gap-10 min-[900px]:grid-cols-2 items-start">
                        <div>
                            <SplitWords text="Keep it on your|home screen." className="text-5xl sm:text-6xl text-white" />
                            <p data-reveal="up" className="text-zinc-400 mt-5 max-w-md text-lg">No app store. Add BlackBook to your phone and it opens full screen like any other app.</p>
                        </div>
                        <ol data-reveal="up" className="ledger">
                            {['Open blackbookcrm.org in Safari or Chrome.', 'Tap Share, or the ⋮ menu on Android.', 'Choose Add to Home Screen, then Add.'].map((step, i) => (
                                <li key={i} className="flex items-center gap-4 px-5 py-5"><span className="num text-3xl text-gold w-6 text-center">{i + 1}</span><span className="text-zinc-200">{step}</span></li>
                            ))}
                        </ol>
                    </div>
                </section>

                {/* QUESTIONS */}
                <section className="border-t border-zinc-900 px-5 sm:px-8 py-20 sm:py-28">
                    <div className="max-w-3xl mx-auto">
                        <SplitWords text="Questions" className="text-5xl sm:text-6xl text-white mb-8" />
                        <Faq items={clientFaq} />
                        <p className="text-zinc-400 mt-6">Barber questions are on the <Link to="/barbers#faq" className="text-gold underline underline-offset-2">for barbers page</Link>.</p>
                    </div>
                </section>

                {/* CLOSING */}
                <section className="relative overflow-hidden border-t border-zinc-900">
                    <Photo photo={PHOTOS.sign} className="!absolute inset-0" />
                    <div className="absolute inset-0 bg-black/70" aria-hidden="true" />
                    <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-28 sm:py-40">
                        <SplitWords text="Your next cut is|two taps away." className="font-display font-black text-[56px] sm:text-[100px] leading-[0.88] text-white max-w-4xl" />
                        <div data-reveal="up" className="mt-9 flex flex-wrap gap-3">
                            <Link to="/find" className="btn btn-primary !min-h-[52px] !px-6 text-base">Find a barber</Link>
                            <Link to="/barbers" className="btn btn-secondary !min-h-[52px] !px-6 text-base !bg-black/50">I'm a barber</Link>
                        </div>
                    </div>
                </section>
            </main>
            <SiteFooter />
        </div>
    );
}

// ---------- FOR BARBERS ----------
const PRICING = [
    { id: 'free', name: 'Free trial', price: '$0', per: 'for 90 days', note: 'Then $5 a month', limit: 'Up to 100 clients', points: ['Online booking and your schedule', 'Client notes', 'Money for the day, week and month', 'Your shop on the map', 'Product shop with pickup orders', 'Invite links and invite emails'] },
    { id: 'basic', name: 'Basic', price: '$5', per: 'a month', note: 'Billed every 30 days', limit: 'Up to 100 clients', points: ['Everything in the free trial', 'Keeps running after the 90 days'] },
    { id: 'pro', name: 'Pro', price: '$19', per: 'a month', note: 'Billed every 30 days', limit: 'Unlimited clients', featured: true, points: ['Everything in Basic', 'Chat with your clients', 'Your own service menu and coupons', 'Promo emails, with 500 credits to start'] },
    { id: 'mogul', name: 'Mogul', price: '$30', per: 'a month', note: 'Billed every 30 days', limit: 'Unlimited clients', points: ['Everything in Pro', '1,500 promo credits to start', 'Priority support', 'Early access to new features'] },
];

// Small, honest product screens built from the app's real components and example data
function TourScreen({ which }) {
    if (which === 'schedule') return (
        <div className="p-4 space-y-3">
            <div><div className="text-xs text-zinc-400">Today</div><div className="font-display font-extrabold text-3xl text-white leading-none">{sampleFriday()}</div></div>
            <div className="panel grid grid-cols-3 divide-x divide-zinc-800 text-white">
                {[['Booked', '$105'], ['Open', '7h'], ['Could earn', '$378']].map(([l, v], i) => <div key={l} className="p-2.5"><div className="text-[11px] text-zinc-400">{l}</div><div className={`num text-xl ${i === 2 ? 'text-gold' : ''}`}>{v}</div></div>)}
            </div>
            <div className="ledger">
                {[['9:30AM', 'Devon Price', 'Skin fade', '$40', true], ['11:00AM', 'Jordan', 'Classic cut, lineup', '$50', false], ['2:00PM', 'Chris Lee', 'Beard trim', '$15', false]].map(([t, n, s, p, done]) => (
                    <div key={t} className="flex items-center gap-3 px-3 py-2.5">
                        <span className="num text-base text-white w-14">{t}</span>
                        <span className="flex-1 min-w-0"><span className="block text-white text-sm font-semibold truncate">{n}</span><span className="block text-zinc-400 text-xs truncate">{s}</span></span>
                        <span className={`num text-base ${done ? 'text-green-400' : 'text-white'}`}>{p}</span>
                    </div>
                ))}
            </div>
        </div>
    );
    if (which === 'clients') return (
        <div className="p-4 space-y-3">
            <div className="font-display font-extrabold text-3xl text-white leading-none">Clients</div>
            <div className="ledger">
                {[['Jordan Reed', 'Skin fade #1 sides, scissor top'], ['Mia Torres', 'Shape-up only, sensitive skin'], ['Devon Price', 'Taper, keep length on top'], ['Alex Kim', 'Buzz #2, beard oil']].map(([n, f]) => (
                    <div key={n} className="flex items-center gap-3 px-3 py-2.5">
                        <span className="avatar w-9 h-9 text-sm">{n.charAt(0)}</span>
                        <span className="min-w-0"><span className="block text-white text-sm font-semibold">{n}</span><span className="block text-zinc-400 text-xs truncate">{f}</span></span>
                    </div>
                ))}
            </div>
        </div>
    );
    if (which === 'money') return (
        <div className="p-4 space-y-3">
            <div className="font-display font-extrabold text-3xl text-white leading-none">Money</div>
            <div className="panel grid grid-cols-3 divide-x divide-zinc-800 text-white">
                {[['Day', '$105'], ['Week', '$640'], ['Month', '$2,310']].map(([l, v]) => <div key={l} className="p-2.5"><div className="text-[11px] text-zinc-400">{l}</div><div className="num text-xl">{v}</div></div>)}
            </div>
            <div className="ledger">
                {[['Skin fade', 1240, 100], ['Classic cut', 690, 56], ['Beard trim', 380, 31]].map(([n, v, w]) => (
                    <div key={n} className="px-3 py-2.5"><div className="flex justify-between text-sm"><span className="text-white">{n}</span><span className="num text-white">${v}</span></div><div className="mt-1.5 h-1 rounded-full bg-zinc-800"><div className="h-full rounded-full bg-gold" style={{ width: `${w}%` }} /></div></div>
                ))}
            </div>
        </div>
    );
    return (
        <div className="p-4 space-y-3">
            <div className="font-display font-extrabold text-3xl text-white leading-none">On the map</div>
            <div className="bb-mapbg relative h-44 rounded-xl border border-zinc-800 overflow-hidden">
                {[{ l: '22%', t: '25%' }, { l: '62%', t: '18%' }, { l: '45%', t: '55%' }].map((p, i) => <div key={i} className="absolute" style={{ left: p.l, top: p.t }}><div className="bb-pin !animate-none"><span></span></div></div>)}
                <div className="absolute" style={{ left: '30%', top: '45%' }}><div className="bb-me" /></div>
            </div>
            <div className="panel p-3 flex items-center gap-3"><span className="avatar w-9 h-9 text-sm">F</span><span className="flex-1"><span className="block text-white text-sm font-semibold">Fresh Fades</span><span className="block text-zinc-400 text-xs">Listed, 3 new clients this week</span></span></div>
        </div>
    );
}

function BarbersPage() {
    const root = useRef(null);
    const [active, setActive] = useState(0);
    usePageMeta('For barbers: BlackBook', 'Online booking, client notes, earnings and a spot on the map. Start free for 90 days, then from $5 a month.');
    const tour = [
        { id: 'schedule', title: 'Your day on one screen', body: 'Online bookings and walk-ins land in one list. See what\'s booked, how much open time is left and what it could still earn. Tap once to mark a cut done.' },
        { id: 'clients', title: 'Remember every cut', body: 'Keep notes on guard numbers, products and preferences for every client, so the fourth visit goes as well as the first.' },
        { id: 'money', title: 'Know what you made', body: 'Your takings for the day, the week and the month, your average ticket, and which services earn the most.' },
        { id: 'map', title: 'Get found by new clients', body: 'Add your shop address and you show up on the BlackBook map with your menu and hours. Clients book you straight from there.' },
    ];
    const barberFaq = [
        { q: 'Is there a contract?', a: 'No. Paid plans run 30 days at a time and you can stop whenever you like.' },
        { q: 'How do my clients book me?', a: 'Send them your invite link or referral code, or let them find you on the map once you add your shop address. Either way they land on your roster.' },
        { q: 'Do clients pay through BlackBook?', a: 'No. Clients pay you at the shop, and BlackBook doesn\'t take a cut of your cuts.' },
        { q: 'Can I bring my existing clients?', a: 'Yes. Add them to your roster with their notes, then send each one an invite so they can book themselves.' },
        { q: 'What are promo credits?', a: 'One credit sends one promo email to one client. Pro starts with 500 credits and Mogul with 1,500.' },
    ];

    useEffect(() => {
        const h = window.location.hash;
        const id = h.startsWith('#/pricing') ? 'pricing' : h.slice(1);
        if (id) setTimeout(() => scrollToId(id), 300);
    }, []);

    // Product tour: on wide screens the phone stays put and shows the step you're reading.
    // An observer (not ScrollTrigger) so this still works with reduced motion.
    useEffect(() => {
        if (!('IntersectionObserver' in window) || !root.current) return;
        const steps = [...root.current.querySelectorAll('.tour-step')];
        const io = new IntersectionObserver((entries) => entries.forEach(e => { if (e.isIntersecting) setActive(steps.indexOf(e.target)); }), { rootMargin: '-45% 0px -45% 0px' });
        steps.forEach(s => io.observe(s));
        return () => io.disconnect();
    }, []);

    useSiteMotion(root, (g) => {
        const tl = g.timeline({ defaults: { ease: 'expo.out' } });
        tl.from('.bh-title .split-i', { yPercent: 115, duration: 1, stagger: 0.07 }, 0.05)
          .from('.bh-sub', { y: 18, autoAlpha: 0, duration: 0.8 }, 0.4)
          .from('.bh-photo', { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.4 }, 0.1)
          .from('.bh-photo img', { scale: 1.2, duration: 1.8 }, 0.1)
          .from('.bh-card', { y: 40, autoAlpha: 0, duration: 1 }, 0.7);
        revealOnScroll(g);
        g.from('.price-col', { y: 30, autoAlpha: 0, duration: 0.8, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: '.pricing-grid', start: 'top 82%', once: true } });
    });

    return (
        <div ref={root} className="bg-black text-white">
            <SiteNav current="/barbers" />
            <main id="main" tabIndex={-1}>
                <section className="px-5 sm:px-8 pt-10 sm:pt-16 pb-16 sm:pb-24">
                    <div className="max-w-6xl mx-auto grid gap-10 min-[900px]:grid-cols-[1.1fr_0.9fr] items-center">
                        <div>
                            <SplitWords as="h1" reveal={false} text="Your chair,|fully booked." className="bh-title font-display font-black text-[60px] sm:text-[96px] min-[1100px]:text-[112px] leading-[0.86] text-white" />
                            <p className="bh-sub mt-6 text-lg text-zinc-300 max-w-md">Online booking, client notes, your earnings and a spot on the map, all from your phone. Start free for 90 days, no card needed.</p>
                            <div className="mt-8 flex flex-wrap gap-3">
                                <Link to="/barbers/signup" className="btn btn-primary !min-h-[52px] !px-6 text-base">Start free</Link>
                                <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollToId('pricing'); }} className="btn btn-secondary !min-h-[52px] !px-6 text-base">See pricing</a>
                            </div>
                        </div>
                        <div className="relative">
                            <Photo photo={PHOTOS.shop} eager ratio="4 / 5" sizes="(min-width: 900px) 42vw, 100vw" className="bh-photo rounded-2xl" />
                            <div className="bh-card absolute -bottom-6 -left-4 sm:-left-8 w-[260px] panel !bg-black/90 backdrop-blur p-4 shadow-[0_20px_40px_rgba(0,0,0,0.6)]" aria-hidden="true">
                                <div className="text-xs text-zinc-400">Today</div>
                                <div className="num text-3xl text-white">$105 booked</div>
                                <div className="mt-2 text-sm text-zinc-400">3 cuts, 7 hours still open</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* PRODUCT TOUR */}
                <section className="border-t border-zinc-900 px-5 sm:px-8 py-20 sm:py-28">
                    <div className="max-w-6xl mx-auto">
                        <SplitWords text="Everything you do in a day,|in one book." className="text-5xl sm:text-6xl text-white max-w-3xl" />
                        <div className="mt-12 grid gap-10 min-[900px]:grid-cols-[1fr_340px] min-[900px]:gap-20">
                            <div>
                                {tour.map((s, i) => (
                                    <div key={s.id} className="tour-step min-[900px]:min-h-[70vh] flex flex-col justify-center py-6 min-[900px]:py-0">
                                        <span className="num text-3xl text-gold">{String(i + 1).padStart(2, '0')}</span>
                                        <h3 className={`text-4xl sm:text-5xl mt-2 transition-colors duration-300 ${active === i ? 'text-white' : 'min-[900px]:text-zinc-600 text-white'}`}>{s.title}</h3>
                                        <p className="text-zinc-400 text-lg mt-3 max-w-md">{s.body}</p>
                                        <div className="min-[900px]:hidden mt-6 phone-frame mx-auto"><TourScreen which={s.id} /></div>
                                    </div>
                                ))}
                            </div>
                            <div className="hidden min-[900px]:block">
                                <div className="sticky top-[calc(50vh-300px)]">
                                    <div className="phone-frame phone-stage" aria-label="Example screens from the barber app" role="img">
                                        {tour.map((s, i) => <div key={s.id} className={`tour-screen ${active === i ? 'is-active' : ''}`}><TourScreen which={s.id} /></div>)}
                                    </div>
                                    <p className="text-center text-sm text-zinc-500 mt-4">Example data</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* WHAT'S INCLUDED */}
                <section className="border-t border-zinc-900 px-5 sm:px-8 py-20 sm:py-28">
                    <div className="max-w-6xl mx-auto grid gap-12 min-[900px]:grid-cols-[0.9fr_1.1fr] items-start">
                        <div className="min-[900px]:sticky min-[900px]:top-24">
                            <SplitWords text="The rest of|the toolkit." className="text-5xl sm:text-6xl text-white" />
                            <Photo photo={PHOTOS.tools} reveal ratio="4 / 3" sizes="(min-width: 900px) 40vw, 100vw" className="rounded-2xl mt-8" />
                        </div>
                        <ul data-reveal="up" className="ledger">
                            {[['link-round-bold-duotone', 'Invite links and codes', 'Clients who sign up with your link land straight on your roster.'],
                              ['chat-round-dots-bold-duotone', 'Chat', 'Message clients inside BlackBook, so nobody needs your personal number. Pro and Mogul.'],
                              ['letter-bold-duotone', 'Promo emails', 'Fill a slow afternoon by emailing the clients you pick. Pro and Mogul.'],
                              ['list-check-bold-duotone', 'Your service menu', 'Prices, times and sale prices for every service, with coupons for regulars. Pro and Mogul.'],
                              ['bag-4-bold-duotone', 'Product shop', 'List pomades, oils and tools. Clients reserve them and pay at pickup.'],
                              ['clock-circle-bold-duotone', 'Hours that run themselves', 'Set your hours, lunch and the gap between clients, and only real open times are offered.']].map(([icon, t, d]) => (
                                <li key={t} className="flex gap-4 px-5 py-5">
                                    <span className="text-gold text-2xl shrink-0 mt-0.5"><Icon name={icon} /></span>
                                    <span><span className="block text-white font-semibold text-lg">{t}</span><span className="block text-zinc-400">{d}</span></span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* PRICING */}
                <section id="pricing" className="border-t border-zinc-900 px-5 sm:px-8 py-20 sm:py-28 scroll-mt-16">
                    <div className="max-w-6xl mx-auto">
                        <SplitWords text="Simple pricing." className="text-5xl sm:text-6xl text-white" />
                        <p data-reveal="up" className="text-zinc-400 mt-4 text-lg max-w-xl">Start with 90 days free. Paid plans run 30 days at a time through PayPal, with no contract.</p>
                        <div className="pricing-grid mt-10 grid gap-3 sm:grid-cols-2 min-[1100px]:grid-cols-4">
                            {PRICING.map(p => (
                                <div key={p.id} className={`price-col panel p-6 flex flex-col ${p.featured ? '!border-gold shadow-[inset_0_3px_0_var(--gold)]' : ''}`}>
                                    <div className="flex items-center justify-between"><h3 className="text-2xl text-white">{p.name}</h3>{p.featured && <span className="chip chip-gold">Recommended</span>}</div>
                                    <div className="mt-4"><span className="num text-6xl text-white leading-none">{p.price}</span> <span className="text-zinc-400">{p.per}</span></div>
                                    <div className="text-sm text-zinc-500 mt-1">{p.note}</div>
                                    <div className="text-sm text-zinc-300 mt-4">{p.limit}</div>
                                    <ul className="mt-3 space-y-2 text-zinc-400 flex-1">
                                        {p.points.map(pt => <li key={pt} className="flex gap-2"><span className="text-gold mt-1 [&>svg]:w-3.5 [&>svg]:h-3.5 shrink-0"><Check /></span>{pt}</li>)}
                                    </ul>
                                    <Link to="/barbers/signup" className={`btn mt-6 ${p.featured ? 'btn-primary' : 'btn-secondary'}`}>{p.id === 'free' ? 'Start free' : `Choose ${p.name}`}</Link>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="faq" className="border-t border-zinc-900 px-5 sm:px-8 py-20 sm:py-28 scroll-mt-16">
                    <div className="max-w-3xl mx-auto">
                        <SplitWords text="Barber questions" className="text-5xl sm:text-6xl text-white mb-8" />
                        <Faq items={barberFaq} />
                    </div>
                </section>

                <section className="relative overflow-hidden border-t border-zinc-900">
                    <Photo photo={PHOTOS.beard} className="!absolute inset-0" />
                    <div className="absolute inset-0 bg-black/70" aria-hidden="true" />
                    <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-28 sm:py-40">
                        <SplitWords text="Put your chair|on BlackBook." className="font-display font-black text-[56px] sm:text-[100px] leading-[0.88] text-white max-w-4xl" />
                        <div data-reveal="up" className="mt-9"><Link to="/barbers/signup" className="btn btn-primary !min-h-[52px] !px-6 text-base">Start free for 90 days</Link></div>
                    </div>
                </section>
            </main>
            <SiteFooter />
        </div>
    );
}

// ---------- PRIVACY AND TERMS ----------
const LEGAL_UPDATED = 'November 1, 2026';
const LEGAL = {
    privacy: {
        title: 'Privacy policy',
        intro: 'This explains what BlackBook collects, why, and who can see it. In short: we use your information to run bookings between you and your barber, we don\'t sell it, and we don\'t run advertising trackers.',
        sections: [
            ['What we collect', [
                'Account details: your name, email address and phone number. Passwords are handled by Google Firebase Authentication; we never see them.',
                'An optional profile photo.',
                'For barbers: shop name and hours, your service menu and prices, products, coupons, and the client list and notes you enter. If you list your shop on the map, its address and map location.',
                'Bookings, chat messages and support questions.',
                'For paid plans: your plan and payment status. Card and bank details are handled by PayPal and never reach us.',
            ]],
            ['Location', [
                '"Use my location" asks your browser for your position only to sort barbers by distance. It isn\'t saved.',
                'Places you search for and shop addresses barbers enter are sent to OpenStreetMap\'s Nominatim service to find them on the map.',
            ]],
            ['Who can see what', [
                'Your barber sees your name, contact details, appointments, messages, and any notes they keep about your cuts.',
                'Barbers who list their shop share their shop name, address, hours, menu, products and photo publicly on the map. Nothing else about their account is public.',
                'Clients can see open times at barbers they\'ve connected to.',
                'BlackBook support can see account information to help you and to keep the service running.',
                'We don\'t sell personal information or share it for advertising.',
            ]],
            ['Emails', [
                'Barbers can send invite and promotional emails to clients on their roster. These are sent through our email provider, Infobip. Barbers must only email clients who are happy to hear from them.',
            ]],
            ['Services we rely on', [
                'Google Firebase (hosting, database, sign-in and file storage), PayPal (payments), Infobip (email), OpenStreetMap (maps and address lookup).',
                'Loading this site also requests fonts from Google Fonts, photos from Unsplash, icons from Iconify, and code libraries from unpkg, jsDelivr and cdnjs. Those services see your IP address like any website you visit.',
            ]],
            ['Keeping and deleting your information', [
                'We keep your account while you use BlackBook. Email support@blackbookcrm.org to have your account deleted.',
                'Notes and roster entries a barber keeps about you belong to that barber\'s records; ask them, or us, to remove them.',
            ]],
            ['Security', [
                'Data is stored with Google Firebase and protected by access rules that only let each person reach their own information.',
            ]],
            ['Children', [
                'BlackBook isn\'t meant for children under 13, and we don\'t knowingly collect their information.',
            ]],
            ['Changes and contact', [
                'If this policy changes, the date at the top changes too. Questions go to support@blackbookcrm.org.',
            ]],
        ],
    },
    terms: {
        title: 'Terms of use',
        intro: 'These terms cover using BlackBook, whether you book cuts or give them. Using BlackBook means you agree to them.',
        sections: [
            ['Your account', [
                'Give accurate details and keep your password to yourself. You\'re responsible for what happens under your account.',
                'Barbers must have the right to offer the services they list.',
            ]],
            ['Bookings', [
                'A booking is an agreement between a client and a barber. The barber provides the service and sets their own prices and cancellation policy. Clients pay barbers directly; BlackBook isn\'t part of that payment.',
                'Please show up for what you book, and cancel in the app if you can\'t.',
            ]],
            ['Paid plans', [
                'Barber plans are paid through PayPal and run 30 days at a time. If a payment isn\'t made, paid features pause until it is.',
                'You can stop at any time. We don\'t refund partial periods unless the law requires it.',
                'We may change prices with notice before your next period starts.',
            ]],
            ['Promotional emails', [
                'Only email clients who have agreed to hear from you, and follow the email laws where you and they live. Each email includes your name so clients know who sent it.',
            ]],
            ['Fair use', [
                'Don\'t misuse BlackBook: no spam, no harassment, no attempts to get into other people\'s accounts or data, and nothing illegal.',
                'We may suspend accounts that break these rules.',
            ]],
            ['Your content', [
                'You own what you put into BlackBook, like your menu, photos and notes. You let us store and display it to run the service.',
            ]],
            ['The service', [
                'We work to keep BlackBook running and accurate but can\'t promise it will always be available or error-free.',
                'To the extent the law allows, BlackBook isn\'t liable for indirect losses such as missed appointments or lost earnings.',
            ]],
            ['Changes and contact', [
                'We may update these terms; the date at the top shows the latest version. Questions go to support@blackbookcrm.org.',
            ]],
        ],
    },
};

function LegalPage({ kind }) {
    const doc = LEGAL[kind] || LEGAL.privacy;
    const root = useRef(null);
    usePageMeta(`${doc.title}: BlackBook`, doc.intro);
    useSiteMotion(root, (g) => { g.from('.legal-title .split-i', { yPercent: 115, duration: 0.9, ease: 'expo.out', stagger: 0.06 }); });
    return (
        <div ref={root} className="bg-black text-white min-h-screen">
            <SiteNav current={`/${kind}`} />
            <main id="main" tabIndex={-1} className="px-5 sm:px-8 pt-12 pb-24">
                <article className="max-w-2xl mx-auto">
                    <SplitWords as="h1" reveal={false} text={doc.title} className="legal-title text-6xl sm:text-7xl text-white" />
                    <p className="text-sm text-zinc-500 mt-3">Last updated {LEGAL_UPDATED}</p>
                    <p className="text-lg text-zinc-300 mt-6">{doc.intro}</p>
                    {doc.sections.map(([h, paras]) => (
                        <section key={h} className="mt-10">
                            <h2 className="text-3xl text-white">{h}</h2>
                            <ul className="mt-3 space-y-3 text-zinc-300 leading-relaxed list-disc pl-5 marker:text-zinc-600">{paras.map((p, i) => <li key={i}>{p}</li>)}</ul>
                        </section>
                    ))}
                    <p className="mt-12 text-zinc-400">See also our <Link to={kind === 'privacy' ? '/terms' : '/privacy'} className="text-gold underline underline-offset-2">{kind === 'privacy' ? 'terms of use' : 'privacy policy'}</Link>.</p>
                </article>
            </main>
            <SiteFooter />
        </div>
    );
}

// --- PLANS PAGE (Full screen, navigated to via #/plans with signupData in history.state) ---
function PlansPage({ signupData = {}, onDone, onBack }) {
    const [selectedPlan, setSelectedPlan] = useState('free');
    const [expanded, setExpanded] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [discountCode, setDiscountCode] = useState('');
    const [discountApplying, setDiscountApplying] = useState(false);
    const [discountApplied, setDiscountApplied] = useState(null);

    const validateDiscount = async (code) => {
        if (!code || !code.trim()) return { ok: false, error: 'Enter a discount code' };
        setDiscountApplying(true);
        try {
            const normalized = (code || '').toUpperCase().trim();
            const q = query(collection(db, 'discountCodes'), where('code', '==', normalized), where('active', '==', true), limit(1));
            const snap = await getDocs(q);
            if (snap.empty) return { ok: false, error: 'Invalid code' };
            const d = snap.docs[0];
            const data = { id: d.id, ...d.data() };
            setDiscountApplied(data);
            return { ok: true, data };
        } catch (e) {
            // Codes are only readable by admin now; activating a plan from the browser isn't allowed
            return { ok: false, error: "Codes can't be checked here yet. Email support@blackbookcrm.org with your code and we'll apply it." };
        } finally { setDiscountApplying(false); }
    };

    const plans = [
        {
            id: 'free',
            title: 'Free Trial (Basic)',
            price: '90 days',
            note: 'Then $5/mo',
            rosterLimit: '100 Clients',
            tagline: 'The Essentials — ideal for barbers just starting out or with an exclusive clientele.',
            tabs: [
                { name: 'Book (Schedule)', what: 'Full access to the calendar.', benefit: 'Clients can book their own slots based on the barber\'s hours. Eliminates "You free at 4?" messages. Includes conflict detection to prevent double-booking.' },
                { name: 'Money (Revenue Stats)', what: 'Visual graphs and lists of completed appointments.', benefit: 'Tracks income Daily, Weekly, and Monthly so barbers can set income goals and see cash vs digital payments.' },
                { name: 'Shop (Products & Pickup)', what: 'List products clients can reserve and pick up.', benefit: 'Extra revenue from pomades, oils and tools.' }
            ],
            features: [ 'CRM: names, phones, emails, and formula notes', 'Referral Codes (invite links for quick onboarding)' ],
            limitation: 'Hard cap at 100 profiles. Upgrade to grow further.'
        },
        {
            id: 'basic',
            title: 'Basic',
            price: '$5/mo',
            note: '',
            rosterLimit: '100 Clients',
            tagline: 'The Essentials — same feature set as Free Trial after conversion.',
            tabs: [
                { name: 'Book (Schedule)', what: 'Full calendar access.', benefit: 'Clients can self-book; conflict detection included.' },
                { name: 'Money (Revenue Stats)', what: 'Income reporting and graphs.', benefit: 'Track daily/weekly/monthly revenue.' },
                { name: 'Shop (Products & Pickup)', what: 'List products clients can reserve and pick up.', benefit: 'Extra revenue from pomades, oils and tools.' }
            ],
            features: [ 'CRM with 100-client limit', 'Referral Codes' ],
            limitation: '100-profile cap.'
        },
        {
            id: 'pro',
            title: 'Pro',
            price: '$19/mo',
            note: '',
            rosterLimit: 'Unlimited',
            tagline: 'The Professional — for the busy barber who needs communication and extra revenue streams.',
            tabs: [
                { name: 'Book (Schedule)', what: 'Full calendar access.', benefit: 'Unlimited clients can book based on hours.' },
                { name: 'Money (Revenue Stats)', what: 'Advanced revenue reporting.', benefit: 'Deeper insights into income and ticket value.' },
                { name: 'Menu (Services)', what: 'Your own services with prices, durations, sale prices and coupons.', benefit: 'Clients see real prices and the calendar blocks the right amount of time.' },
                { name: 'Shop (Products & Pickup)', what: 'List products clients can reserve and pick up.', benefit: 'Extra revenue from pomades, oils and tools.' },
                { name: 'Chat (1:1 Messaging)', what: 'Private in-app messaging between barber and client.', benefit: 'Keeps business chats out of personal SMS; centralized communication.' },
                { name: 'Promo (Marketing Blasts)', what: 'Mass email/marketing terminal to roster or groups.', benefit: 'Fill empty slots quickly with targeted blasts.' }
            ],
            features: [ 'Unlimited roster', '500 starting credits on signup', 'Promo (marketing blasts)' ],
            limitation: ''
        },
        {
            id: 'mogul',
            title: 'Mogul',
            price: '$30/mo',
            note: '',
            rosterLimit: 'Unlimited',
            tagline: 'The CEO — for barbers building a brand.',
            tabs: [
                { name: 'Book (Schedule)', what: 'Full calendar access.', benefit: 'Same as Pro.' },
                { name: 'Money (Revenue Stats)', what: 'Advanced revenue reporting.', benefit: 'Same as Pro.' },
                { name: 'Menu (Services)', what: 'Full service management.', benefit: 'Same as Pro.' },
                { name: 'Chat (1:1 Messaging)', what: 'Private in-app messaging.', benefit: 'Same as Pro.' },
                { name: 'Shop (Products & Pickup)', what: 'Digital storefront for listing products and add-ons available for client pickup.', benefit: 'Add passive revenue: clients can purchase products when booking or add them to an appointment for easy pickup.' },
                { name: 'Promo (Marketing Blasts)', what: 'Mass email/marketing terminal to roster or groups.', benefit: 'Fill empty slots quickly with targeted blasts.' },
                { name: 'First Access', what: 'Early access to new features.', benefit: 'New tools and premium features arrive earlier for Mogul users.' },
                { name: 'Priority Support', what: 'Faster, prioritized support routing.', benefit: 'Tickets appear at top in admin and get faster attention.' }
            ],
            features: [ 'All Pro features', '1500 starting credits on signup', 'Promo tools', 'Priority support' ],
            limitation: ''
        }
    ];

    const handleConfirm = async () => {
        setError('');
        setLoading(true);
        try {
            // If user is already authenticated, use their account information instead
            const currentUser = auth.currentUser;

            // If a free discount code has been applied, activate the plan immediately without payment
            if (discountApplied && discountApplied.type === 'free') {
                if (discountApplied.planId && discountApplied.planId !== selectedPlan) {
                    throw new Error('Discount code not valid for this plan.');
                }
                if (!currentUser) {
                    if (!signupData?.email || !signupData?.password) throw new Error('Missing signup information.');
                    const userCredential = await createUserWithEmailAndPassword(auth, signupData.email, signupData.password);
                    const userDoc = {
                        email: signupData.email,
                        firstName: signupData.firstName || '',
                        phone: signupData.phone || '',
                        joined: new Date().toISOString(),
                        role: 'barber',
                        plan: selectedPlan === 'free' ? 'free_trial' : selectedPlan,
                        billingConfirmed: true,
                        billingNextDue: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
                        provider: 'discount',
                        credits: selectedPlan === 'pro' ? 500 : selectedPlan === 'mogul' ? 1500 : 0,
                        shopOpen: '09:00', shopClose: '17:00', lunchStart: '', lunchEnd: '', slotDuration: 60
                    };
                    await setDoc(doc(db, 'users', userCredential.user.uid), userDoc);
                    showToast('Discount applied — plan activated', 'success');
                    onDone && onDone();
                    setLoading(false);
                    return;
                } else {
                    const uid = currentUser.uid;
                    const userDoc = {
                        plan: selectedPlan === 'free' ? 'free_trial' : selectedPlan,
                        billingConfirmed: true,
                        billingNextDue: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
                        provider: 'discount',
                        credits: selectedPlan === 'pro' ? 500 : selectedPlan === 'mogul' ? 1500 : 0,
                        updatedAt: new Date().toISOString()
                    };
                    await updateDoc(doc(db, 'users', uid), userDoc);
                    showToast('Discount applied — plan activated', 'success');
                    onDone && onDone();
                    setLoading(false);
                    return;
                }
            }

            if (!currentUser) {
                if (!signupData?.email || !signupData?.password) throw new Error('Missing signup information.');
            }

            // If free trial, create account immediately
            if (selectedPlan === 'free') {
                const storedPlan = 'free_trial';
                if (currentUser) {
                    const uid = currentUser.uid;
                    const userDoc = {
                        plan: storedPlan,
                        trialStartDate: new Date().toISOString(),
                        trialLengthDays: 90,
                        billingConfirmed: false
                    };
                    await updateDoc(doc(db, 'users', uid), { ...userDoc, updatedAt: new Date().toISOString() });
                    showToast('Trial activated for your account', 'success');
                    onDone && onDone();
                    setLoading(false);
                    return;
                } else {
                    const userCredential = await createUserWithEmailAndPassword(auth, signupData.email, signupData.password);
                    const userDoc = {
                        email: signupData.email,
                        firstName: signupData.firstName || '',
                        phone: signupData.phone || '',
                        joined: new Date().toISOString(),
                        role: 'barber',
                        plan: storedPlan,
                        credits: 0,
                        shopOpen: '09:00', shopClose: '17:00', lunchStart: '', lunchEnd: '', slotDuration: 60,
                        trialStartDate: new Date().toISOString(),
                        trialLengthDays: 90,
                        billingConfirmed: false
                    };
                    await setDoc(doc(db, 'users', userCredential.user.uid), userDoc);
                    showToast('Account created. Welcome!', 'success');
                    onDone && onDone();
                    setLoading(false);
                    return;
                }
            }

            // Paid plans: create the account first (unpaid), then check out as that signed-in user,
            // so the password never leaves the browser. Until payment lands they see "Payment Required".
            let payer = currentUser;
            if (!payer) {
                const userCredential = await createUserWithEmailAndPassword(auth, signupData.email, signupData.password);
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    email: signupData.email,
                    firstName: signupData.firstName || '',
                    phone: signupData.phone || '',
                    joined: new Date().toISOString(),
                    role: 'barber',
                    plan: selectedPlan,
                    billingConfirmed: false,
                    credits: 0,
                    shopOpen: '09:00', shopClose: '17:00', lunchStart: '', lunchEnd: '', slotDuration: 60
                });
                payer = userCredential.user;
            }
            const idToken = await payer.getIdToken();
            const pResp = await fetch('https://api-6hszbgalfq-uc.a.run.app/createPayPalOrderExisting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
                body: JSON.stringify({ planId: selectedPlan })
            });
            if (!pResp.ok) {
                const body = await pResp.json().catch(() => ({}));
                throw new Error(body.error || 'Failed to create payment');
            }
            const data = await pResp.json();
            try { sessionStorage.setItem('pendingPaymentId', data.pendingId || ''); } catch (e) {}
            const approval = data.approval_url || data.approvalUrl || data.approval || '';
            if (approval) {
                window.location.href = approval;
                setLoading(false);
                return;
            }
            // fallback to configured checkout URL (if you have a hosted PayPal flow)
            const PAYPAL_BASE = window.PAYPAL_CHECKOUT_URL || '';
            if (PAYPAL_BASE) {
                const url = PAYPAL_BASE + (PAYPAL_BASE.includes('?') ? '&' : '?') + 'pendingId=' + encodeURIComponent(data.pendingId || '') + '&plan=' + encodeURIComponent(selectedPlan);
                window.location.href = url; setLoading(false); return;
            }
            throw new Error('No approval URL returned from PayPal');

        } catch (err) {
            console.error('PlansPage signup/payment error', err);
            // This page may already be unmounted (new account switches to the dashboard), so toast too
            setError(err.message || 'Signup or payment failed');
            showToast(err.message || 'Signup or payment failed', 'error');
        }
        setLoading(false);
    };

    const chosen = plans.find(p => p.id === selectedPlan) || plans[0];
    return (
        <div className="min-h-screen w-full bg-black px-5 sm:px-8 pt-[calc(env(safe-area-inset-top)+16px)] pb-36">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between h-12">
                    <button onClick={() => { onBack ? onBack() : history.back(); }} className="btn btn-ghost !px-0 -ml-1"><ChevronLeft /> Back</button>
                    <span className="logo text-2xl">Black<span className="text-gold">Book</span></span>
                </div>
                <h1 className="text-5xl sm:text-6xl text-white mt-6">Pick your plan</h1>
                <p className="text-zinc-400 mt-2 max-w-lg">Start free for 90 days, or go straight to the tools you need. Month to month, cancel any time.</p>

                <div className="mt-8 grid gap-3 sm:grid-cols-2 min-[1100px]:grid-cols-4" role="radiogroup" aria-label="Plans">
                    {plans.map(p => {
                        const on = selectedPlan === p.id;
                        const sections = p.tabs.map(t => t.name.split(' (')[0]);
                        return (
                            <button key={p.id} role="radio" aria-checked={on} onClick={() => setSelectedPlan(p.id)} className={`plan-tile text-left rounded-xl p-5 flex flex-col ${on ? 'plan-primary' : ''}`}>
                                <span className="flex items-center justify-between gap-3">
                                    <span className="text-white font-semibold">{p.title.replace(' (Basic)', '')}</span>
                                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${on ? 'border-gold' : 'border-zinc-600'}`}>{on && <span className="w-2.5 h-2.5 rounded-full bg-gold" />}</span>
                                </span>
                                <span className="num text-5xl text-white mt-3 leading-none">{p.price.replace('/mo', '')}<span className="text-xl text-zinc-400">{p.price.includes('/mo') ? '/mo' : ''}</span></span>
                                <span className="text-sm text-zinc-400 mt-1 h-5">{p.note || (p.id === 'free' ? '' : 'Billed monthly')}</span>
                                <span className="text-sm text-zinc-300 mt-4">{p.rosterLimit === 'Unlimited' ? 'Unlimited clients' : `Up to ${p.rosterLimit.toLowerCase()}`}</span>
                                <ul className="mt-3 space-y-1.5 text-sm text-zinc-400">
                                    {sections.map(s => <li key={s} className="flex items-center gap-2"><span className="text-gold [&>svg]:w-3.5 [&>svg]:h-3.5"><Check /></span>{s}</li>)}
                                </ul>
                            </button>
                        );
                    })}
                </div>

                <button onClick={() => setExpanded(s => ({ ...s, [chosen.id]: !s[chosen.id] }))} aria-expanded={!!expanded[chosen.id]} className="mt-6 text-sm text-zinc-300 underline underline-offset-4 decoration-zinc-600">{expanded[chosen.id] ? 'Hide' : 'Show'} what each part of {chosen.title.replace(' (Basic)', '')} does</button>
                <div className={`bb-acc ${expanded[chosen.id] ? 'open' : ''}`}>
                    <div>
                        <div className="ledger mt-3 max-w-3xl">
                            {chosen.tabs.map(t => (
                                <div key={t.name} className="px-4 py-3">
                                    <div className="text-white font-semibold">{t.name}</div>
                                    <div className="text-sm text-zinc-400">{t.what} {t.benefit}</div>
                                </div>
                            ))}
                            {chosen.limitation && <div className="px-4 py-3 text-sm text-zinc-400">{chosen.limitation}</div>}
                        </div>
                    </div>
                </div>

                <div className="mt-8 max-w-md">
                    <Field label="Discount code" hint={discountApplied ? `${discountApplied.code} applied${discountApplied.type === 'free' ? ': this plan is free' : ''}.` : 'Optional'}>
                        <div className="flex gap-2">
                            <input value={discountCode} onChange={e => setDiscountCode(e.target.value.toUpperCase())} className={`${inputCls} flex-1 font-semibold tracking-wide`} />
                            <button onClick={async () => {
                                setError('');
                                const resp = await validateDiscount(discountCode);
                                if (!resp.ok) { setError(resp.error || 'That code is not valid'); setDiscountApplied(null); } else { showToast('Discount applied', 'success'); }
                            }} disabled={discountApplying || !discountCode} className="btn btn-secondary">{discountApplying ? 'Checking…' : 'Apply'}</button>
                        </div>
                    </Field>
                </div>
                {error && <p role="alert" className="text-red-400 text-sm mt-3">{error}</p>}
            </div>

            <div className="fixed bottom-0 inset-x-0 z-30 bg-black/90 backdrop-blur-md border-t border-zinc-800 px-5 sm:px-8 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
                <div className="max-w-6xl mx-auto flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="text-white font-semibold truncate">{chosen.title.replace(' (Basic)', '')}</div>
                        <div className="text-sm text-zinc-400 truncate">{discountApplied && discountApplied.type === 'free' ? 'Free with your code' : chosen.id === 'free' ? 'Free for 90 days' : `${chosen.price}, paid with PayPal`}</div>
                    </div>
                    <button onClick={handleConfirm} disabled={loading} className="btn btn-primary !min-h-[48px] !px-6 shrink-0">{loading ? 'One moment…' : chosen.id === 'free' || (discountApplied && discountApplied.type === 'free') ? 'Start now' : 'Continue to payment'}</button>
                </div>
            </div>
        </div>
    );
}

// Shown for any address the site doesn't have
function NotFoundPage() {
    usePageMeta('Page not found: BlackBook', 'This page is not on BlackBook.');
    return (
        <div className="bg-black text-white min-h-screen flex flex-col">
            <SiteNav current="" />
            <main id="main" tabIndex={-1} className="flex-1 max-w-6xl w-full mx-auto px-5 sm:px-8 py-24">
                <h1 className="font-display font-black text-[64px] sm:text-[96px] leading-[0.88] text-white">This page isn't<br />in the book.</h1>
                <p className="text-zinc-400 text-lg mt-6 max-w-md">The link may be old or mistyped. Start from the home page, or find a barber on the map.</p>
                <div className="mt-8 flex flex-wrap gap-3">
                    <Link to="/" className="btn btn-primary">Go to the home page</Link>
                    <Link to="/find" className="btn btn-secondary">Find a barber</Link>
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}

// --- ROOT ---
// Public pages have real addresses; Firebase Hosting serves this page for every path.
// The barber plan step is still #/plans, with the sign-up details held in history.state.
const AUTH_PATHS = ['/login', '/signup', '/barbers/signup'];
function Root() {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const readLoc = () => ({ path: currentPath(), hash: window.location.hash || '', signupData: window.history.state?.signupData || null });
    const [loc, setLoc] = useState(readLoc);
    const signedIn = useRef(false);

    useEffect(() => {
        const sync = () => setLoc(readLoc());
        window.addEventListener('hashchange', sync);
        window.addEventListener('popstate', sync);
        return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
    }, []);

    useEffect(() => onAuthStateChanged(auth, (currentUser) => {
        // Signed in from a form or an invite link: the app lives at /. Signed out: back to the home page.
        const onForm = AUTH_PATHS.includes(currentPath()) || new URLSearchParams(window.location.search).has('ref');
        if (currentUser ? onForm : signedIn.current) navigate('/', { replace: true });
        signedIn.current = !!currentUser;
        setUser(currentUser);
        setAuthLoading(false);
    }), []);

    if (authLoading) return <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4" role="status" aria-label="Loading"><span className="logo text-3xl">Black<span className="text-gold">Book</span></span><div className="w-28 h-0.5 bg-zinc-800 rounded overflow-hidden"><div className="h-full w-2/5 bg-gold rounded" style={{ animation: 'bbLoad 1.1s ease-in-out infinite' }} /></div></div>;

    const page = (el) => <div id="app">{el}<Toasts/><ConfirmModal/></div>;
    const { path, hash, signupData } = loc;

    // Privacy and terms are readable whether or not you're signed in
    if (path === '/privacy' || path === '/terms') return page(<LegalPage key={path} kind={path.slice(1)} />);

    if (user) {
        // Ensure email check is case-insensitive
        const isAdmin = !!(user.email && user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim());
        return page(isAdmin ? <AdminDashboard adminUser={user} /> : <RoleRouter user={user} />);
    }

    // Barber sign-up, step two: pick a plan
    if (hash.startsWith('#/plans')) return page(<PlansPage signupData={signupData} onDone={() => navigate('/', { replace: true })} />);

    if (path === '/find') return page(<FindBarberPage onBook={(b) => { try { sessionStorage.setItem(PENDING_BARBER_KEY, JSON.stringify({ id: b.id, name: barberLabel(b) })); } catch (e) {} navigate('/signup'); }} />);
    // Invite links (/?ref=CODE) open client sign-up
    if (path === '/signup' || new URLSearchParams(window.location.search).has('ref')) return page(<LoginScreen key="signup" initialMode="client" startRegister onBack={() => navigate('/')} />);
    if (path === '/login') return page(<LoginScreen key="login" initialMode="client" onBack={() => navigate('/')} />);
    if (path === '/barbers/signup') return page(<LoginScreen key="barber-signup" initialMode="barber" startRegister onBack={() => navigate('/barbers')} />);
    if (path === '/barbers') return page(<BarbersPage />);
    if (path === '/') return page(<LandingPage />);
    return page(<NotFoundPage />);
}

function RoleRouter({ user }) {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [profileError, setProfileError] = useState(null);
    const [showPlansModal, setShowPlansModal] = useState(false);

    function PaymentPending({ profile }) {
        const planName = { basic: 'Basic', pro: 'Pro', mogul: 'Mogul' }[profile.plan] || profile.plan;
        return (
            <div className="min-h-screen bg-black flex flex-col px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-10">
                <div className="flex items-center justify-between h-12 max-w-md w-full mx-auto">
                    <span className="logo text-2xl">Black<span className="text-gold">Book</span></span>
                    <button onClick={() => signOut(auth)} className="btn btn-ghost !px-0">Sign out</button>
                </div>
                <div className="flex-1 flex items-center">
                    <div className="max-w-md w-full mx-auto">
                        <h1 className="text-5xl text-white">Waiting on payment</h1>
                        <p className="text-zinc-400 mt-3">Your account is set up on the {planName} plan. Your dashboard opens as soon as PayPal confirms the payment, usually within a minute.</p>
                        <div className="mt-8 flex flex-col gap-2">
                            <button onClick={() => window.location.reload()} className="btn btn-primary w-full">Check again</button>
                            <button onClick={() => setShowPlansModal(true)} className="btn btn-secondary w-full">Change plan or pay again</button>
                            <a href="mailto:support@blackbookcrm.org" className="btn btn-ghost w-full">Email support</a>
                        </div>
                    </div>
                </div>
                {showPlansModal && (
                    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black">
                        <PlansPage signupData={{}} onBack={() => setShowPlansModal(false)} onDone={() => { setShowPlansModal(false); }} />
                    </div>
                )}
            </div>
        );
    }

    useEffect(() => {
        let missingTimer = null;
        const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                clearTimeout(missingTimer); missingTimer = null;
                setUserData(docSnap.data());
                setProfileError(null);
                setLoading(false);
            } else if (!missingTimer) {
                // A new account's profile is written just after sign-up, so give it a moment to arrive
                missingTimer = setTimeout(() => {
                    console.error("User profile document missing for UID:", user.uid);
                    setProfileError("Profile Not Found. Please contact support.");
                    setLoading(false);
                }, 6000);
            }
        }, (err) => {
            console.error("Error fetching user profile:", err);
            setProfileError("Error loading profile. Check your connection.");
            setLoading(false);
        });
        return () => { clearTimeout(missingTimer); unsub(); };
    }, [user]);

    if (loading) return <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4" role="status" aria-label="Loading your account"><span className="logo text-3xl">Black<span className="text-gold">Book</span></span><div className="w-28 h-0.5 bg-zinc-800 rounded overflow-hidden"><div className="h-full w-2/5 bg-gold rounded" style={{ animation: 'bbLoad 1.1s ease-in-out infinite' }} /></div></div>;
    
    if (profileError) return <div className="min-h-screen bg-black flex items-center justify-center p-6"><div className="panel p-8 max-w-sm text-center"><h2 className="text-3xl text-white">Something is off with your account</h2><p className="text-zinc-400 mt-2">{profileError}</p><div className="mt-6 flex gap-2 justify-center"><button onClick={() => window.location.reload()} className="btn btn-primary">Try again</button><button onClick={() => signOut(auth)} className="btn btn-secondary">Sign out</button></div></div></div>;

    const fullUserProfile = { ...userData, uid: user.uid, email: user.email };
    // If barber and plan requires payment, ensure billingConfirmed is true before allowing dashboard access
    const paidPlans = ['basic', 'pro', 'mogul'];
    if (userData?.role === 'barber' && paidPlans.includes(userData.plan) && userData.billingConfirmed !== true && userData.plan !== 'free_trial') {
        return <PaymentPending profile={fullUserProfile} />;
    }
    if (userData?.role === 'client') return <ClientDashboard user={fullUserProfile} />;
    return <Dashboard user={fullUserProfile} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ErrorBoundary><Root /></ErrorBoundary>);
try { document.getElementById('app-loader')?.remove(); } catch(e){}
    