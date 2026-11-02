const functions = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const admin = require('firebase-admin');
const crypto = require('crypto');
const express = require('express');

admin.initializeApp();
const db = admin.firestore();
const { FieldValue } = admin.firestore;

// --- CONFIGURATION ---
// Secrets live in Google Secret Manager, never in source. Set them with:
//   firebase functions:secrets:set INFOBIP_API_KEY
//   firebase functions:secrets:set PAYPAL_CLIENT_ID
//   firebase functions:secrets:set PAYPAL_SECRET
const INFOBIP_API_KEY = defineSecret('INFOBIP_API_KEY');
const PAYPAL_CLIENT_ID = defineSecret('PAYPAL_CLIENT_ID');
const PAYPAL_SECRET = defineSecret('PAYPAL_SECRET');

const INFOBIP_HOSTNAME = "558qry.api.infobip.com";
const SENDER_EMAIL = "support@blackbookcrm.org";
const SITE_URL = "https://blackbookcrm.org/";
const PAYPAL_BASE = process.env.PAYPAL_BASE || 'https://api-m.paypal.com';

const PLAN_PRICING = { basic: 500, pro: 1900, mogul: 3000 }; // cents
const PLAN_CREDITS = { pro: 500, mogul: 1500 };
const BILLING_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

const ALLOWED_ORIGINS = [
	'https://blackbookcrm.org',
	'https://www.blackbookcrm.org',
	'https://barbertemp-7640a.web.app',
	'https://barbertemp-7640a.firebaseapp.com',
];
const cors = require("cors")({
	origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)),
});

// --- HELPERS ---
const escapeHtml = (s) => String(s == null ? '' : s)
	.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const isEmail = (s) => typeof s === 'string' && s.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);

// Verifies the Firebase ID token in "Authorization: Bearer <token>" and sets req.user
const requireUser = async (req, res, next) => {
	const header = req.get('Authorization') || '';
	if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in required' });
	try {
		req.user = await admin.auth().verifyIdToken(header.slice(7));
		next();
	} catch (e) {
		return res.status(401).json({ error: 'Invalid or expired session' });
	}
};

const sendInfobipEmail = async (toEmail, subject, htmlContent) => {
	const form = new FormData();
	form.append('from', SENDER_EMAIL);
	form.append('to', toEmail);
	form.append('subject', subject);
	form.append('html', htmlContent);
	const resp = await fetch(`https://${INFOBIP_HOSTNAME}/email/2/send`, {
		method: 'POST',
		headers: { 'Authorization': `App ${INFOBIP_API_KEY.value()}` },
		body: form,
	});
	const text = await resp.text();
	if (!resp.ok) throw new Error(`Infobip Error (${resp.status}): ${text}`);
	return text;
};

const paypalToken = async () => {
	const basic = Buffer.from(`${PAYPAL_CLIENT_ID.value()}:${PAYPAL_SECRET.value()}`).toString('base64');
	const resp = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
		method: 'POST',
		headers: { 'Authorization': `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
		body: 'grant_type=client_credentials',
	});
	const data = await resp.json().catch(() => ({}));
	if (!resp.ok || !data.access_token) throw new Error(`PayPal token request failed (${resp.status})`);
	return data.access_token;
};

const paypalApi = async (method, path, body) => {
	const token = await paypalToken();
	const resp = await fetch(`${PAYPAL_BASE}${path}`, {
		method,
		headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	});
	const data = await resp.json().catch(() => ({}));
	return { ok: resp.ok, status: resp.status, data };
};

// Only a capture PayPal itself reports as COMPLETED, for the exact amount we priced, counts as paid
const captureMatchesPending = (capture, pending) => {
	if (!capture || capture.status !== 'COMPLETED') return false;
	const amt = capture.amount || {};
	return amt.currency_code === 'USD' && Math.round(parseFloat(amt.value) * 100) === pending.amountCents;
};

// Grants the purchased plan. Safe to call twice (capture page and webhook can race).
const provisionPending = async (docRef, pending, extra) => {
	const signupData = pending.signupData || {};
	const planId = pending.planId;
	let uid = pending.existingUid || null;

	// Legacy pending records (created before accounts were made up front) carry signup data instead of a uid
	if (!uid && signupData.email) {
		try { uid = (await admin.auth().getUserByEmail(signupData.email)).uid; } catch (e) { /* not found */ }
		if (!uid) {
			const userRecord = await admin.auth().createUser({
				email: signupData.email,
				password: crypto.randomBytes(18).toString('base64'),
				displayName: signupData.firstName || undefined,
			});
			uid = userRecord.uid;
			try {
				const resetLink = await admin.auth().generatePasswordResetLink(signupData.email);
				await sendInfobipEmail(signupData.email, 'Set your BlackBook password', `<p>Your payment went through. <a href="${escapeHtml(resetLink)}">Set your password</a> to sign in.</p>`);
			} catch (e) { console.warn('Failed to send password setup link', e); }
		}
	}
	if (!uid) throw new Error('Could not resolve account for pending payment');

	const userRef = db.collection('users').doc(uid);
	await db.runTransaction(async (tx) => {
		const snap = await tx.get(userRef);
		const cur = snap.exists ? snap.data() : {};
		const now = Date.now();
		const curDue = cur.billingNextDue ? new Date(cur.billingNextDue).getTime() : 0;
		const upd = {
			plan: planId,
			billingConfirmed: true,
			billingNextDue: new Date(Math.max(now, curDue || 0) + BILLING_PERIOD_MS).toISOString(),
			provider: 'paypal',
			credits: Math.max(cur.credits || 0, PLAN_CREDITS[planId] || 0),
			billingUpdatedAt: new Date(now).toISOString(),
		};
		if (!snap.exists) {
			Object.assign(upd, {
				email: signupData.email || '', firstName: signupData.firstName || '', phone: signupData.phone || '',
				joined: new Date(now).toISOString(), role: 'barber',
				shopOpen: '09:00', shopClose: '17:00', lunchStart: '', lunchEnd: '', slotDuration: 60,
			});
		}
		tx.set(userRef, upd, { merge: true });
	});

	try { await admin.auth().setCustomUserClaims(uid, { plan: planId, billingConfirmed: true }); }
	catch (e) { console.warn('Failed to set custom claims', e); }

	await docRef.update({
		processed: true,
		processedAt: new Date().toISOString(),
		provisionedUid: uid,
		'signupData.password': FieldValue.delete(),
		...extra,
	});
	return uid;
};

// --- EMAIL TEMPLATES ---
const promoEmailHtml = ({ barberName, subject, messageBody, bookingLink }) => `
<!DOCTYPE html>
<html>
<head>
	<style>
		body { margin: 0; padding: 0; background-color: #121212; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
		.wrapper { width: 100%; table-layout: fixed; background-color: #121212; padding: 40px 0; }
		.main { background-color: #1a1a1a; margin: 0 auto; width: 100%; max-width: 550px; border-radius: 16px; border: 1px solid #333333; overflow: hidden; }
		.header { padding: 30px 0; text-align: center; border-bottom: 1px solid #2a2a2a; }
		.logo { font-size: 24px; font-weight: 900; color: #FFFFFF; letter-spacing: 2px; text-transform: uppercase; }
		.logo span { color: #FFD700; }
		.sender-info { background-color: #222222; padding: 10px; text-align: center; color: #888888; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; border-bottom: 1px solid #333; }
		.sender-info strong { color: #FFD700; }
		.content { padding: 40px 30px; text-align: left; color: #e0e0e0; }
		.message-body { font-size: 16px; line-height: 1.8; color: #dddddd; white-space: pre-line; }
		.message-headline { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 20px; display: block; }
		.button-wrapper { text-align: center; margin-top: 40px; padding-top: 30px; border-top: 1px solid #333; }
		.btn { display: inline-block; background-color: #FFD700; color: #000000 !important; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
		.footer { padding: 30px; text-align: center; font-size: 11px; color: #555555; background-color: #151515; }
	</style>
</head>
<body>
	<div class="wrapper">
		<table class="main" align="center">
			<tr><td class="header"><div class="logo">BLACK<span>BOOK</span></div></td></tr>
			<tr><td class="sender-info">Update from <strong>${escapeHtml(barberName)}</strong></td></tr>
			<tr>
				<td class="content">
					<span class="message-headline">${escapeHtml(subject || "Important Update")}</span>
					<div class="message-body">${escapeHtml(messageBody).replace(/\n/g, '<br>')}</div>
					<div class="button-wrapper"><a href="${escapeHtml(bookingLink)}" class="btn">Book Appointment</a></div>
				</td>
			</tr>
			<tr><td class="footer">You received this because you are a client of ${escapeHtml(barberName)}.<br>Powered by Blackbook CRM</td></tr>
		</table>
	</div>
</body>
</html>
`;

const inviteEmailHtml = ({ barberName, referralCode, bookingLink }) => `
<!DOCTYPE html>
<html>
<head>
	<style>
		body { margin: 0; padding: 0; background-color: #121212; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
		.wrapper { width: 100%; table-layout: fixed; background-color: #121212; padding: 40px 0; }
		.main { background-color: #1a1a1a; margin: 0 auto; width: 100%; max-width: 550px; border-radius: 16px; border: 1px solid #333333; overflow: hidden; }
		.header { padding: 40px 0 20px 0; text-align: center; }
		.logo { font-size: 28px; font-weight: 900; color: #FFFFFF; letter-spacing: 2px; text-transform: uppercase; }
		.logo span { color: #FFD700; }
		.hero-image { width: 100%; height: 200px; background-color: #222; background-image: url('https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80'); background-size: cover; background-position: center; border-bottom: 2px solid #FFD700; }
		.content { padding: 40px; text-align: center; }
		h1 { color: #FFFFFF; font-size: 24px; margin: 0; font-weight: 700; }
		p { color: #BBBBBB; font-size: 16px; line-height: 1.6; margin-top: 20px; }
		.barber-highlight { color: #FFD700; font-weight: 700; }
		.btn { display: inline-block; background-color: #FFD700; color: #000000 !important; text-decoration: none; padding: 18px 35px; border-radius: 8px; font-weight: 800; font-size: 15px; margin-top: 30px; text-transform: uppercase; letter-spacing: 1px; }
		.footer { padding: 30px; text-align: center; font-size: 12px; color: #666666; }
	</style>
</head>
<body>
	<div class="wrapper">
		<table class="main" align="center">
			<tr><td class="header"><div class="logo">BLACK<span>BOOK</span></div></td></tr>
			<tr><td><div class="hero-image"></div></td></tr>
			<tr>
				<td class="content">
					<h1>Book <span class="barber-highlight">${escapeHtml(barberName)}</span> In One Tap.</h1>
					<p><span class="barber-highlight">${escapeHtml(barberName)}</span> wants you to sign up for more convenient booking, modifying and rescheduling appointments, and to have direct contact with them.</p>
					<p style="color:#dddddd; font-size:14px; margin-top:12px;">When you sign up, use referral code <strong style="color:#FFD700;">${escapeHtml(referralCode)}</strong> to automatically connect to ${escapeHtml(barberName)}.</p>
					<a href="${escapeHtml(bookingLink)}" class="btn" target="_blank" rel="noopener noreferrer">Sign Up & Connect</a>
				</td>
			</tr>
		</table>
	</div>
</body>
</html>
`;

// --- FUNCTION: EMAIL INVITES & PROMOS ---
// Signed-in barbers only, to addresses on their own roster. Sender name and link come from
// the barber's profile, not the request, so this can't be used to send arbitrary mail.
const handleSendInvite = async (req, res) => {
	const { email, isPromo } = req.body || {};
	const subject = String((req.body && req.body.subject) || '').slice(0, 150);
	const messageBody = String((req.body && req.body.messageBody) || '').slice(0, 5000);
	if (!isEmail(email)) return res.status(400).json({ error: 'Invalid email' });

	const uid = req.user.uid;
	const userRef = db.collection('users').doc(uid);
	const profileSnap = await userRef.get();
	const profile = profileSnap.exists ? profileSnap.data() : {};
	if (profile.role !== 'barber') return res.status(403).json({ error: 'Barber account required' });
	if (profile.plan === 'free_trial') return res.status(403).json({ error: 'Upgrade required' });
	if (isPromo && !['pro', 'mogul'].includes(profile.plan)) return res.status(403).json({ error: 'Pro plan required for promos' });

	const onRoster = await db.collection('clients').where('userId', '==', uid).where('email', '==', email).limit(1).get();
	if (onRoster.empty) return res.status(403).json({ error: 'Recipient is not on your roster' });

	const barberName = profile.firstName || 'Your Barber';
	const referralCode = profile.referralCode || uid;
	const bookingLink = `${SITE_URL}?ref=${encodeURIComponent(referralCode)}`;

	// Promos cost 1 credit, charged here so it can't be skipped from the browser
	if (isPromo) {
		if (!subject) return res.status(400).json({ error: 'Subject required' });
		try {
			await db.runTransaction(async (tx) => {
				const snap = await tx.get(userRef);
				if (((snap.data() || {}).credits || 0) < 1) throw Object.assign(new Error('Insufficient credits'), { code: 402 });
				tx.update(userRef, { credits: FieldValue.increment(-1) });
			});
		} catch (e) {
			if (e.code === 402) return res.status(402).json({ error: e.message });
			throw e;
		}
	}

	try {
		const finalSubject = isPromo ? subject : `Invitation from ${barberName}`;
		const html = isPromo
			? promoEmailHtml({ barberName, subject, messageBody, bookingLink })
			: inviteEmailHtml({ barberName, referralCode, bookingLink });
		await sendInfobipEmail(email, finalSubject, html);
		res.status(200).json({ success: true });
	} catch (error) {
		console.error('sendInvite failed', error);
		if (isPromo) { try { await userRef.update({ credits: FieldValue.increment(1) }); } catch (e) { console.error('Credit refund failed', e); } }
		res.status(502).json({ error: 'Email provider failed' });
	}
};

// --- API APP ---
const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '100kb' }));
app.use(cors);

app.use((req, res, next) => {
	try { console.log('REQ', new Date().toISOString(), req.method, req.path, req.ip); } catch (e) {}
	next();
});

app.get('/', (req, res) => {
	res.json({ ok: true, message: 'BlackBook API root' });
});

app.post('/sendInvite', requireUser, handleSendInvite);

// --- Create PayPal Order for a signed-in barber ---
// Accounts are created before checkout, so no passwords or signup data ever pass through here.
app.post('/createPayPalOrderExisting', requireUser, async (req, res) => {
	try {
		const uid = req.user.uid;
		const { planId } = req.body || {};
		const amount = PLAN_PRICING[planId];
		if (!amount) return res.status(400).json({ error: 'Invalid planId' });

		const pendingId = crypto.randomBytes(12).toString('hex');
		const docRef = db.collection('pendingPayments').doc(pendingId);
		await docRef.set({
			signupData: { email: req.user.email || '' },
			existingUid: uid,
			planId,
			amountCents: amount,
			currency: 'USD',
			status: 'pending',
			createdAt: new Date().toISOString()
		});

		const order = await paypalApi('POST', '/v2/checkout/orders', {
			intent: 'CAPTURE',
			purchase_units: [{ amount: { currency_code: 'USD', value: (amount / 100).toFixed(2) }, custom_id: pendingId }],
			application_context: {
				// PayPal returns the buyer to this server so it can capture and provision
				return_url: `${req.protocol}://${req.get('host')}/paypalReturn?pendingId=${pendingId}`,
				cancel_url: `${SITE_URL}#/plans`
			}
		});
		if (!order.ok) throw new Error(`PayPal create order failed (${order.status})`);

		const link = (order.data.links || []).find(l => l.rel === 'approve');
		await docRef.update({ paypalOrderId: order.data.id, updatedAt: new Date().toISOString() });
		if (!link) return res.status(500).json({ error: 'No approval URL from PayPal' });
		return res.json({ approval_url: link.href, pendingId, orderId: order.data.id });
	} catch (err) {
		console.error('createPayPalOrderExisting error', err);
		return res.status(500).json({ error: 'Could not start checkout' });
	}
});

// PayPal return page - shows status while it calls /paypalCapture
app.get('/paypalReturn', (req, res) => {
	const orderId = String(req.query.token || req.query.orderId || '');
	const pendingId = String(req.query.pendingId || '');
	if (!orderId || !pendingId) return res.status(400).send('Missing orderId or pendingId');

	// JSON-encode (and neutralize "<") so query values can't break out of the script
	const payload = JSON.stringify({ orderId, pendingId }).replace(/</g, '\\u003c');
	const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Finalizing payment...</title></head><body style="background:#000;color:#fff;font-family:Inter,Arial,Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="max-width:420px;padding:24px;border-radius:12px;background:#0b0b0b;border:1px solid #222;text-align:center"><h2 style="color:#ffd700">Finalizing payment</h2><p style="color:#cfcfcf">Please wait while we finalize your purchase. Do not close this window.</p><div id="status" style="margin-top:16px;color:#9ca3af">Starting...</div><script>
		(async function(){
			const statusEl = document.getElementById('status');
			const show = (title, color, detail) => {
				statusEl.textContent = '';
				const strong = document.createElement('strong'); strong.style.color = color; strong.textContent = title; statusEl.appendChild(strong);
				if (detail) { const d = document.createElement('div'); d.style.cssText = 'color:#fca5a5;margin-top:8px'; d.textContent = detail; statusEl.appendChild(d); }
			};
			try {
				statusEl.textContent = 'Contacting server to capture payment...';
				const resp = await fetch('/paypalCapture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(${payload}) });
				const data = await resp.json();
				if (resp.ok && data && data.ok) {
					show('Payment completed — your plan is active', '#86efac');
					setTimeout(()=>{ window.location.href = '${SITE_URL}'; }, 2200);
				} else {
					show('Error finalizing payment:', '#f87171', (data && data.error) || 'Unknown error');
				}
			} catch (e) {
				show('Network error finalizing payment', '#f87171', e.message);
			}
		})();
	</script><div style="margin-top:12px"><a href="${SITE_URL}" style="color:#9ca3af">Return to site</a></div></div></body></html>`;

	res.set('Content-Type', 'text/html');
	return res.status(200).send(html);
});

// Capture a PayPal order and provision the plan (called by the return page)
app.post('/paypalCapture', async (req, res) => {
	try {
		const { orderId, pendingId } = req.body || {};
		if (!orderId || !pendingId) return res.status(400).json({ ok: false, error: 'Missing orderId or pendingId' });

		const docRef = db.collection('pendingPayments').doc(String(pendingId));
		const docSnap = await docRef.get();
		if (!docSnap.exists) return res.status(400).json({ ok: false, error: 'Pending payment not found' });
		const pending = docSnap.data();
		if (pending.processed) return res.json({ ok: true, message: 'already processed' });
		// The order must be the one created for this pending record, or a cheap order could unlock a pricier plan
		if (!pending.paypalOrderId || pending.paypalOrderId !== orderId) return res.status(400).json({ ok: false, error: 'Order does not match this payment' });

		const orderPath = `/v2/checkout/orders/${encodeURIComponent(orderId)}`;
		let result = await paypalApi('POST', `${orderPath}/capture`);
		// Reloaded page or webhook got there first: read the order instead of capturing twice
		if (!result.ok) result = await paypalApi('GET', orderPath);

		const unit = (result.data.purchase_units || [])[0] || {};
		const capture = ((unit.payments || {}).captures || [])[0];
		if (!captureMatchesPending(capture, pending)) return res.status(400).json({ ok: false, error: 'Payment not completed' });

		const uid = await provisionPending(docRef, pending, { method: 'capture', paypalCaptureId: capture.id, status: 'completed' });
		return res.json({ ok: true, message: 'Payment captured and plan activated', uid });
	} catch (err) {
		console.error('paypalCapture error', err);
		return res.status(500).json({ ok: false, error: 'Could not finalize payment' });
	}
});

// --- PayPal Webhook (backup provisioning) ---
// The webhook body is never trusted: we re-read the capture from PayPal with our own credentials,
// so a forged event can't activate a plan.
app.post('/paypalWebhook', async (req, res) => {
	try {
		const body = req.body || {};
		console.log('PayPal Webhook:', body.event_type);
		if (body.event_type !== 'PAYMENT.CAPTURE.COMPLETED') return res.status(200).send('ignored');

		const captureId = body.resource && body.resource.id;
		if (!captureId) return res.status(200).send('ignored');

		const verified = await paypalApi('GET', `/v2/payments/captures/${encodeURIComponent(captureId)}`);
		if (!verified.ok) return res.status(200).send('unverified');
		const capture = verified.data;
		const pendingId = capture.custom_id;
		if (!pendingId) return res.status(200).send('ignored');

		const docRef = db.collection('pendingPayments').doc(String(pendingId));
		const docSnap = await docRef.get();
		if (!docSnap.exists) return res.status(200).send('unknown');
		const pending = docSnap.data();
		if (pending.processed) return res.status(200).send('already processed');
		if (!captureMatchesPending(capture, pending)) return res.status(200).send('amount mismatch');

		await provisionPending(docRef, pending, { method: 'webhook', paypalCaptureId: capture.id, status: 'completed' });
		return res.status(200).send('received');
	} catch (err) {
		console.error('PayPal Webhook Error:', err);
		return res.status(500).send('error');
	}
});

exports.api = functions.https.onRequest({ secrets: [INFOBIP_API_KEY, PAYPAL_CLIENT_ID, PAYPAL_SECRET] }, app);

// The frontend calls the top-level `sendInvite` function URL, so expose just that route there.
const inviteApp = express();
inviteApp.use(express.json({ limit: '100kb' }));
inviteApp.use(cors);
inviteApp.post(['/', '/sendInvite'], requireUser, handleSendInvite);
exports.sendInvite = functions.https.onRequest({ secrets: [INFOBIP_API_KEY] }, inviteApp);
