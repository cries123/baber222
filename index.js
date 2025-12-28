const functions = require("firebase-functions");
const https = require("https");
const cors = require("cors")({ origin: true });
const admin = require('firebase-admin');
const crypto = require('crypto');
const express = require('express');
const app = express();

admin.initializeApp();
const db = admin.firestore();

// capture raw body for webhook signature verification
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true, verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(cors);

// Simple request logger to help diagnose routing issues
app.use((req, res, next) => {
	try { console.log('REQ', new Date().toISOString(), req.method, req.path, req.ip); } catch (e) {}
	next();
});

// Root health endpoint
app.get('/', (req, res) => {
	res.json({ ok: true, message: 'BlackBook API root', routes: ['/diagPayPal','/createPayPalOrder','/paypalReturn','/createPending','/createSquareLink','/squareWebhook'] });
});

// --- CONFIGURATION ---
const INFOBIP_HOSTNAME = "558qry.api.infobip.com";
const INFOBIP_API_KEY = "891bfe15cb806c4c4665c70d7fefda01-93eb3b77-cdcb-46d3-819c-9a48c9ce8b40";
const SENDER_EMAIL = "support@blackbookcrm.org";

// --- HELPER TO SEND EMAIL VIA INFOBIP ---
const sendInfobipEmail = (toEmail, subject, htmlContent) => {
	return new Promise((resolve, reject) => {
		const boundary = "----BlackBookBoundary" + Date.now().toString(16);
    
		const bodyParts = [
			`--${boundary}`,
			'Content-Disposition: form-data; name="from"',
			'',
			SENDER_EMAIL,
			`--${boundary}`,
			'Content-Disposition: form-data; name="to"',
			'',
			toEmail,
			`--${boundary}`,
			'Content-Disposition: form-data; name="subject"',
			'',
			subject,
			`--${boundary}`,
			'Content-Disposition: form-data; name="html"',
			'',
			htmlContent,
			`--${boundary}--`
		];

		const payload = bodyParts.join('\r\n');

		const options = {
			hostname: INFOBIP_HOSTNAME,
			path: "/email/2/send",
			method: "POST",
			headers: {
				"Authorization": `App ${INFOBIP_API_KEY}`,
				"Content-Type": `multipart/form-data; boundary=${boundary}`,
				"Content-Length": Buffer.byteLength(payload)
			}
		};

		const req = https.request(options, (res) => {
			let data = "";
			res.on("data", (chunk) => { data += chunk; });
			res.on("end", () => {
				if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
				else reject(new Error(`Infobip Error: ${data}`));
			});
		});

		req.on("error", (e) => reject(e));
		req.write(payload);
		req.end();
	});
};

// --- FUNCTION: EMAIL ADVERTISER & INVITES (Restored & Protected) ---
app.post('/sendInvite', async (req, res) => {
	if (!req.body) return res.status(400).send('Bad Request');

	const { email, barberName, bookingLink, isPromo, subject, messageBody, referralCode } = req.body;

	try {
		let emailHtml;
		let finalSubject;

		if (isPromo) {
			finalSubject = subject || `Update from ${barberName}`;
			emailHtml = `
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
							<tr><td class="sender-info">Update from <strong>${barberName}</strong></td></tr>
							<tr>
								<td class="content">
									<span class="message-headline">${subject || "Important Update"}</span>
									<div class="message-body">${messageBody.replace(/\n/g, '<br>')}</div>
									<div class="button-wrapper"><a href="${bookingLink}" class="btn">Book Appointment</a></div>
								</td>
							</tr>
							<tr><td class="footer">You received this because you are a client of ${barberName}.<br>Powered by Blackbook CRM</td></tr>
						</table>
					</div>
				</body>
				</html>
			`;
		} else {
			finalSubject = `Invitation from ${barberName}`;

			const baseLink = bookingLink || 'https://blackbook.app/';
			const inviteLink = baseLink + (baseLink.includes('?') ? '&' : (baseLink.endsWith('/') ? '?' : '/?')) + 'ref=' + encodeURIComponent(referralCode || '');

			emailHtml = `
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
									<h1>Book <span class="barber-highlight">${barberName}</span> In One Tap.</h1>
									<p><span class="barber-highlight">${barberName}</span> wants you to sign up for more convenient booking, modifying and rescheduling appointments, and to have direct contact with them.</p>
									${referralCode ? `<p style="color:#dddddd; font-size:14px; margin-top:12px;">When you sign up, use referral code <strong style="color:#FFD700;">${referralCode}</strong> to automatically connect to ${barberName}.</p>` : ''}
									<a href="${inviteLink}" class="btn" target="_blank" rel="noopener noreferrer">Sign Up & Connect</a>
								</td>
							</tr>
						</table>
					</div>
				</body>
				</html>
			`;
		}

		// send email (templates above omitted here to keep patch small — original HTML templates remain in file)
		await sendInfobipEmail(email, finalSubject, emailHtml);
		res.status(200).json({ success: true });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: error.message });
	}
});

// --- Create Square Payment Link ---
app.post('/createSquareLink', async (req, res) => {
	try {
		const { signupData, planId } = req.body || {};
		if (!signupData || !planId) return res.status(400).json({ error: 'Missing signupData or planId' });

		// Map plan to amount in cents (USD)
		const planPricing = { basic: 500, pro: 1900, mogul: 3000 };
		const amount = planPricing[planId];
		if (!amount) return res.status(400).json({ error: 'Invalid planId' });

		const pendingId = crypto.randomBytes(12).toString('hex');
		const safeSignupData = Object.assign({}, signupData);
		const hadPassword = !!safeSignupData.password;
		delete safeSignupData.password; // do not store plaintext password

		const pendingDoc = {
			signupData: safeSignupData,
			hasPassword: hadPassword,
			planId,
			amountCents: amount,
			currency: 'USD',
			status: 'pending',
			createdAt: new Date().toISOString()
		};

		await db.collection('pendingPayments').doc(pendingId).set(pendingDoc);

		// Create Square payment link (Payment Links API)
		const squareCfg = {};
		const SQUARE_ACCESS_TOKEN = squareCfg.access_token || process.env.SQUARE_ACCESS_TOKEN;
		const REDIRECT_URL = squareCfg.redirect_url || process.env.SQUARE_REDIRECT_URL || '';
		if (!SQUARE_ACCESS_TOKEN) return res.status(500).json({ error: 'Square access token not configured' });

		const payload = JSON.stringify({
			idempotency_key: pendingId,
			quick_pay: {
				name: `BlackBook Plan - ${planId}`,
				price_money: { amount: amount, currency: 'USD' }
			},
			checkout_options: {
				redirect_url: REDIRECT_URL ? `${REDIRECT_URL}?pendingId=${pendingId}` : undefined
			}
		});

		const options = {
			hostname: 'connect.squareup.com',
			path: '/v2/online-checkout/payment-links',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`
			}
		};

		const sqReq = https.request(options, (sqRes) => {
			let data = '';
			sqRes.on('data', (chunk) => data += chunk);
			sqRes.on('end', async () => {
				try {
					const parsed = JSON.parse(data);
					const checkoutUrl = parsed && parsed.payment_link && (parsed.payment_link.url || parsed.payment_link.checkout_url || parsed.payment_link.uri);
					// Save link info
					await db.collection('pendingPayments').doc(pendingId).update({ squareResponse: parsed, checkoutUrl });
					return res.json({ checkout_url: checkoutUrl, pendingId });
				} catch (e) {
					console.error('Square response parse error', e, data);
					return res.status(500).json({ error: 'Failed to create payment link' });
				}
			});
		});

		sqReq.on('error', (e) => {
			console.error('Square request error', e);
			return res.status(500).json({ error: 'Square request failed' });
		});

		sqReq.write(payload);
		sqReq.end();

	} catch (err) {
		console.error(err);
		res.status(500).json({ error: err.message });
	}
});

// --- Create pending payment-only record (fallback for alternative checkout flows) ---
app.post('/createPending', async (req, res) => {
	try {
		const { signupData, planId } = req.body || {};
		if (!signupData || !planId) return res.status(400).json({ error: 'Missing signupData or planId' });

		const planPricing = { basic: 500, pro: 1900, mogul: 3000 };
		const amount = planPricing[planId];
		if (!amount) return res.status(400).json({ error: 'Invalid planId' });

		const pendingId = crypto.randomBytes(12).toString('hex');
		const safeSignupData = Object.assign({}, signupData);
		delete safeSignupData.password;

		const pendingDoc = {
			signupData: safeSignupData,
			planId,
			amountCents: amount,
			currency: 'USD',
			status: 'pending',
			createdAt: new Date().toISOString()
		};

		await db.collection('pendingPayments').doc(pendingId).set(pendingDoc);
		return res.json({ pendingId });
	} catch (err) {
		console.error('createPending error', err);
		return res.status(500).json({ error: err.message || 'createPending failed' });
	}
});

// --- Create PayPal Order and pending record ---
app.post('/createPayPalOrder', async (req, res) => {
	try {
		const { signupData, planId } = req.body || {};
		if (!signupData || !planId) return res.status(400).json({ error: 'Missing signupData or planId' });

		const planPricing = { basic: 500, pro: 1900, mogul: 3000 };
		const amount = planPricing[planId];
		if (!amount) return res.status(400).json({ error: 'Invalid planId' });

		// create pending record
		const pendingId = crypto.randomBytes(12).toString('hex');
		const safeSignupData = Object.assign({}, signupData);
		const hadPassword = !!safeSignupData.password;
		delete safeSignupData.password;

		const pendingDoc = {
			signupData: safeSignupData,
			hasPassword: hadPassword,
			planId,
			amountCents: amount,
			currency: 'USD',
			status: 'pending',
			createdAt: new Date().toISOString()
		};

		await db.collection('pendingPayments').doc(pendingId).set(pendingDoc);

		// PayPal credentials (use environment variables in v7+)
		const paypalCfg = {};
		const PAYPAL_CLIENT_ID = paypalCfg.client_id || process.env.PAYPAL_CLIENT_ID || 'AYmjMdhQIqRXRcQhexGeVerxq2fdtRD0t3_hIF04jYT8oeDFSCdCDJ3emirVPqsRIT-sxnJruKkKEI05';
		const PAYPAL_SECRET = paypalCfg.secret || process.env.PAYPAL_SECRET || 'EC527MWfy-lpLCO5ttVlpQrtrD6LXMfLmsmtpopxqUrRa1RMm9RxNlsmKrn_UXo0V9lBPQpZ-bAWZKHZ';
		const PAYPAL_BASE = paypalCfg.base || process.env.PAYPAL_BASE || 'https://api-m.paypal.com';
		const RETURN_BASE = paypalCfg.return_url || process.env.PAYPAL_RETURN_URL || '';

		// get access token
		const authPayload = 'grant_type=client_credentials';
		const authOptions = {
			hostname: PAYPAL_BASE.replace(/^https?:\/\//,''),
			path: '/v1/oauth2/token',
			method: 'POST',
			headers: {
				'Authorization': 'Basic ' + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64'),
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		};

		const getAccessToken = () => new Promise((resolve, reject) => {
			const aReq = https.request(authOptions, (aRes) => {
				let raw = '';
				aRes.on('data', (c) => raw += c);
				aRes.on('end', () => {
					try {
						if (aRes.statusCode < 200 || aRes.statusCode >= 300) {
							return reject(new Error(`PayPal token request failed (${aRes.statusCode}): ${raw}`));
						}
						const d = JSON.parse(raw);
						if (!d.access_token) return reject(new Error('No access_token in PayPal response: ' + raw));
						resolve(d.access_token);
					} catch (e) { reject(new Error('Invalid JSON from PayPal token: ' + e.message + ' -- ' + raw)); }
				});
			});
			aReq.on('error', (e) => reject(e));
			aReq.write(authPayload);
			aReq.end();
		});

		const token = await getAccessToken();

		// create order
		const orderPayload = JSON.stringify({
			intent: 'CAPTURE',
			purchase_units: [{ amount: { currency_code: 'USD', value: (amount/100).toFixed(2) }, custom_id: pendingId }],
			application_context: {
				return_url: RETURN_BASE ? `${RETURN_BASE}?pendingId=${pendingId}` : `${req.protocol}://${req.get('host')}/paypalReturn?pendingId=${pendingId}`,
				cancel_url: `${req.protocol}://${req.get('host')}/plans?pendingId=${pendingId}`
			}
		});

		const orderOptions = {
			hostname: PAYPAL_BASE.replace(/^https?:\/\//,''),
			path: '/v2/checkout/orders',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			}
		};

		const createOrder = () => new Promise((resolve, reject) => {
			const oReq = https.request(orderOptions, (oRes) => {
				let data = '';
				oRes.on('data', (c) => data += c);
				oRes.on('end', async () => {
					try {
						if (oRes.statusCode < 200 || oRes.statusCode >= 300) {
							return reject(new Error(`PayPal create order failed (${oRes.statusCode}): ${data}`));
						}
						const parsed = JSON.parse(data);
						const link = (parsed.links || []).find(l => l.rel === 'approve');
						await db.collection('pendingPayments').doc(pendingId).update({ paypalResponse: parsed, paypalOrderId: parsed.id, updatedAt: new Date().toISOString() });
						resolve({ approval_url: link ? link.href : null, order: parsed });
					} catch (e) { reject(new Error('Invalid JSON from PayPal order: ' + e.message + ' -- ' + data)); }
				});
			});
			oReq.on('error', (e) => reject(e));
			oReq.write(orderPayload);
			oReq.end();
		});

		const { approval_url, order } = await createOrder();
		if (!approval_url) return res.status(500).json({ error: 'No approval URL from PayPal' });
		return res.json({ approval_url, pendingId, orderId: order.id });

	} catch (err) {
		console.error('createPayPalOrder error', err);
		return res.status(500).json({ error: err.message || 'createPayPalOrder failed' });
	}
});

// PayPal return handler - capture the order and process pending
app.get('/paypalReturn', async (req, res) => {
	try {
		const { token, pendingId } = req.query || {};
		const orderId = token || req.query.orderId || req.query.token;
		if (!orderId || !pendingId) return res.status(400).send('Missing orderId or pendingId');

		const paypalCfg = {};
		const PAYPAL_CLIENT_ID = paypalCfg.client_id || process.env.PAYPAL_CLIENT_ID || 'AYmjMdhQIqRXRcQhexGeVerxq2fdtRD0t3_hIF04jYT8oeDFSCdCDJ3emirVPqsRIT-sxnJruKkKEI05';
		const PAYPAL_SECRET = paypalCfg.secret || process.env.PAYPAL_SECRET || 'EC527MWfy-lpLCO5ttVlpQrtrD6LXMfLmsmtpopxqUrRa1RMm9RxNlsmKrn_UXo0V9lBPQpZ-bAWZKHZ';
		const PAYPAL_BASE = paypalCfg.base || process.env.PAYPAL_BASE || 'https://api-m.paypal.com';

		const authPayload = 'grant_type=client_credentials';
		const authOptions = {
			hostname: PAYPAL_BASE.replace(/^https?:\/\//,''),
			path: '/v1/oauth2/token',
			method: 'POST',
			headers: {
				'Authorization': 'Basic ' + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64'),
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		};

		const getAccessTokenReturn = () => new Promise((resolve, reject) => {
			const aReq = https.request(authOptions, (aRes) => {
				let raw = '';
				aRes.on('data', (c) => raw += c);
				aRes.on('end', () => {
					try { const d = JSON.parse(raw); resolve(d.access_token); } catch (e) { reject(e); }
				});
			});
			aReq.on('error', (e) => reject(e));
			aReq.write(authPayload);
			aReq.end();
		});

		const accessToken = await getAccessTokenReturn();

		// capture
		const captureOptions = {
			hostname: PAYPAL_BASE.replace(/^https?:\/\//,''),
			path: `/v2/checkout/orders/${orderId}/capture`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${accessToken}`
			}
		};

		const capture = () => new Promise((resolve, reject) => {
			const cReq = https.request(captureOptions, (cRes) => {
				let data = '';
				cRes.on('data', (c) => data += c);
				cRes.on('end', () => {
					try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
				});
			});
			cReq.on('error', (e) => reject(e));
			cReq.end();
		});

		const capResp = await capture();
		const status = capResp.status || (capResp.purchase_units && capResp.purchase_units[0] && capResp.purchase_units[0].payments && capResp.purchase_units[0].payments.captures && capResp.purchase_units[0].payments.captures[0] && capResp.purchase_units[0].payments.captures[0].status);

		if (status && status.toUpperCase() === 'COMPLETED') {
			// process pending payment similar to Square webhook
			const docRef = db.collection('pendingPayments').doc(pendingId);
			const docSnap = await docRef.get();
			if (!docSnap.exists) {
				console.warn('Pending payment not found for', pendingId);
				return res.status(200).send('ok');
			}
			const pending = docSnap.data();
			if (pending.processed) return res.status(200).send('already processed');

			const signupData = pending.signupData || {};
			let createdUid = null;
			try {
				const tempPassword = crypto.randomBytes(12).toString('base64').slice(0,12);
				const userRecord = await admin.auth().createUser({ email: signupData.email, password: tempPassword, displayName: signupData.firstName || undefined });
				createdUid = userRecord.uid;
				try {
					const resetLink = await admin.auth().generatePasswordResetLink(signupData.email);
					await sendInfobipEmail(signupData.email, 'Set your BlackBook password', `<p>Set your password: <a href="${resetLink}">Set password</a></p>`);
				} catch (linkErr) { console.warn('Failed to create/send reset link', linkErr); }
			} catch (e) {
				console.warn('Auth createUser error', e.message);
				try {
					const userByEmail = await admin.auth().getUserByEmail(signupData.email);
					createdUid = userByEmail.uid;
					if (!pending.hasPassword) {
						try {
							const resetLink = await admin.auth().generatePasswordResetLink(signupData.email);
							await sendInfobipEmail(signupData.email, 'Set your BlackBook password', `<p>Set your password: <a href="${resetLink}">Set password</a></p>`);
						} catch (err2) { console.warn('reset link send failed', err2); }
					}
				} catch (ee) { console.error('Failed to create or locate user', ee); }
			}

			if (createdUid) {
				const planId = pending.planId;
				const userDoc = {
					email: signupData.email,
					firstName: signupData.firstName || '',
					phone: signupData.phone || '',
					joined: new Date().toISOString(),
					role: 'barber',
					plan: planId === 'free' ? 'free_trial' : planId,
					billingConfirmed: true,
					credits: planId === 'pro' ? 500 : planId === 'mogul' ? 1500 : 0,
					shopOpen: '09:00', shopClose: '17:00', lunchStart: '', lunchEnd: '', slotDuration: 60
				};
				if (planId === 'free') { userDoc.trialStartDate = new Date().toISOString(); userDoc.trialLengthDays = 90; }
				await db.collection('users').doc(createdUid).set(userDoc, { merge: true });
			}

			await docRef.update({ processed: true, processedAt: new Date().toISOString(), paypalCapture: capResp });
			// redirect user to a success page or dashboard
			return res.redirect('/');
		}

		return res.status(200).send('Payment not completed');
	} catch (err) {
		console.error('paypalReturn error', err);
		return res.status(500).send('error');
	}
});

// --- Diagnostic endpoint: check PayPal token retrieval ---
app.get('/diagPayPal', async (req, res) => {
	try {
		const paypalCfg = {};
		const PAYPAL_CLIENT_ID = paypalCfg.client_id || process.env.PAYPAL_CLIENT_ID || null;
		const PAYPAL_SECRET = paypalCfg.secret || process.env.PAYPAL_SECRET || null;
		const PAYPAL_BASE = paypalCfg.base || process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com';

		if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) return res.status(400).json({ ok: false, message: 'Missing PayPal client_id or secret in env/config' });

		const authPayload = 'grant_type=client_credentials';
		const authOptions = {
			hostname: PAYPAL_BASE.replace(/^https?:\/\//,''),
			path: '/v1/oauth2/token',
			method: 'POST',
			headers: {
				'Authorization': 'Basic ' + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64'),
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		};

		const check = () => new Promise((resolve, reject) => {
			const aReq = https.request(authOptions, (aRes) => {
				let raw = '';
				aRes.on('data', (c) => raw += c);
				aRes.on('end', () => resolve({ statusCode: aRes.statusCode, body: raw }));
			});
			aReq.on('error', (e) => reject(e));
			aReq.write(authPayload);
			aReq.end();
		});

		const result = await check();
		let parsed = null;
		try { parsed = JSON.parse(result.body); } catch (e) { /* ignore */ }
		return res.json({ ok: result.statusCode >= 200 && result.statusCode < 300, statusCode: result.statusCode, body: parsed || result.body });
	} catch (err) {
		console.error('diagPayPal error', err);
		return res.status(500).json({ ok: false, error: err.message });
	}
});

// --- Runtime env diagnostic (no secret values returned) ---
app.get('/diagEnv', (req, res) => {
	try {
		const base = process.env.PAYPAL_BASE || null;
		const cid = process.env.PAYPAL_CLIENT_ID || null;
		const csec = process.env.PAYPAL_SECRET || null;
		return res.json({
			ok: true,
			PAYPAL_BASE: base,
			client_len: cid ? cid.length : 0,
			secret_len: csec ? csec.length : 0,
			client_preview: cid ? cid.slice(0, 8) : null
		});
	} catch (err) {
		console.error('diagEnv error', err);
		return res.status(500).json({ ok: false, error: err.message });
	}
});

// --- Runtime PayPal credential hash (safe) ---
app.get('/diagPayPalHash', (req, res) => {
	try {
		const cid = process.env.PAYPAL_CLIENT_ID || null;
		const csec = process.env.PAYPAL_SECRET || null;
		if (!cid || !csec) return res.status(400).json({ ok: false, message: 'Missing PAYPAL_CLIENT_ID or PAYPAL_SECRET' });
		const combo = `${cid}:${csec}`;
		const hash = crypto.createHash('sha256').update(combo, 'utf8').digest('hex');
		const b64 = Buffer.from(combo, 'utf8').toString('base64');
		return res.json({ ok: true, combo_len: combo.length, sha256: hash, auth_b64_prefix: b64.slice(0,8) });
	} catch (err) {
		console.error('diagPayPalHash error', err);
		return res.status(500).json({ ok: false, error: err.message });
	}
});


// --- Square Webhook Handler ---
app.post('/squareWebhook', async (req, res) => {
	try {
		const squareCfg = {};
		const signatureKey = squareCfg.webhook_key || process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '';
		const signatureHeader = req.get('x-square-signature') || req.get('x-square-hmacsha256');
		const rawBody = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body));

		// Verify signature if key is provided
		if (signatureKey && signatureHeader) {
			const computed = crypto.createHmac('sha256', signatureKey).update(rawBody).digest('base64');
			const sigBuf = Buffer.from(signatureHeader, 'utf8');
			const compBuf = Buffer.from(computed, 'utf8');
			if (sigBuf.length !== compBuf.length || !crypto.timingSafeEqual(sigBuf, compBuf)) {
				console.warn('Invalid Square webhook signature');
				return res.status(401).send('Invalid signature');
			}
		}

		const payload = req.body;
		const payment = payload?.data?.object?.payment || payload?.data?.object || null;
		let pendingId = null;
		if (payment) {
			pendingId = payment.order_id || payment.reference_id || payment.order?.reference_id || payment.id;
		}

		if (!pendingId && req.query && req.query.pendingId) pendingId = req.query.pendingId;

		const eventType = payload?.type || payload?.event_type || '';
		console.log('Square webhook event', eventType, 'pendingId', pendingId);

		if (pendingId) {
			const docRef = db.collection('pendingPayments').doc(pendingId);
			const docSnap = await docRef.get();
			if (!docSnap.exists) {
				console.warn('Pending payment not found for', pendingId);
				return res.status(200).send('ok');
			}
			const pending = docSnap.data();
			if (pending.processed) return res.status(200).send('already processed');

			const paid = (payment && (payment.status === 'COMPLETED' || payment.status === 'CAPTURED' || payment.status === 'COMPLETED_BY_CARD'));
			if (!paid) {
				await docRef.update({ lastWebhook: payload, updatedAt: new Date().toISOString() });
				return res.status(200).send('ignored');
			}

			const signupData = pending.signupData || {};
			let createdUid = null;
			try {
				// create user with temporary password then prompt for reset
				const tempPassword = crypto.randomBytes(12).toString('base64').slice(0,12);
				const userRecord = await admin.auth().createUser({ email: signupData.email, password: tempPassword, displayName: signupData.firstName || undefined });
				createdUid = userRecord.uid;
				try {
					const resetLink = await admin.auth().generatePasswordResetLink(signupData.email);
					await sendInfobipEmail(signupData.email, 'Set your BlackBook password', `<p>Set your password: <a href="${resetLink}">Set password</a></p>`);
				} catch (linkErr) {
					console.warn('Failed to create/send reset link', linkErr);
				}
			} catch (e) {
				console.warn('Auth createUser error', e.message);
				try {
					const userByEmail = await admin.auth().getUserByEmail(signupData.email);
					createdUid = userByEmail.uid;
					if (!pending.hasPassword) {
						try {
							const resetLink = await admin.auth().generatePasswordResetLink(signupData.email);
							await sendInfobipEmail(signupData.email, 'Set your BlackBook password', `<p>Set your password: <a href="${resetLink}">Set password</a></p>`);
						} catch (err2) { console.warn('reset link send failed', err2); }
					}
				} catch (ee) {
					console.error('Failed to create or locate user', ee);
				}
			}

			if (createdUid) {
				const planId = pending.planId;
				const userDoc = {
					email: signupData.email,
					firstName: signupData.firstName || '',
					phone: signupData.phone || '',
					joined: new Date().toISOString(),
					role: 'barber',
					plan: planId === 'free' ? 'free_trial' : planId,
					billingConfirmed: true,
					credits: planId === 'pro' ? 500 : planId === 'mogul' ? 1500 : 0,
					shopOpen: '09:00', shopClose: '17:00', lunchStart: '', lunchEnd: '', slotDuration: 60
				};
				if (planId === 'free') { userDoc.trialStartDate = new Date().toISOString(); userDoc.trialLengthDays = 90; }
				await db.collection('users').doc(createdUid).set(userDoc, { merge: true });
			}

			await docRef.update({ processed: true, processedAt: new Date().toISOString(), paymentPayload: payload });
		}

		res.status(200).send('ok');
	} catch (err) {
		console.error('squareWebhook error', err);
		res.status(500).send('error');
	}
});

// --- PayPal Webhook Handler (Backup for reliable provisioning) ---
app.post('/paypalWebhook', async (req, res) => {
	try {
		const body = req.body || {};
		const eventType = body.event_type;
		const resource = body.resource;

		console.log('PayPal Webhook:', eventType);

		if (eventType === 'PAYMENT.CAPTURE.COMPLETED' || eventType === 'CHECKOUT.ORDER.APPROVED' || eventType === 'PAYMENT.CAPTURE.DENIED') {
			let pendingId = resource && resource.custom_id;
			if (!pendingId && resource && resource.purchase_units && resource.purchase_units[0]) {
				pendingId = resource.purchase_units[0].custom_id;
			}

			if (pendingId) {
				const docRef = db.collection('pendingPayments').doc(pendingId);
				const docSnap = await docRef.get();

				if (docSnap.exists) {
					const pending = docSnap.data();
					if (!pending.processed) {
						console.log('Processing user creation via Webhook for:', pendingId);
						const signupData = pending.signupData || {};
						const planId = pending.planId;

						let createdUid = null;
						try {
							const tempPassword = crypto.randomBytes(12).toString('base64').slice(0, 12);
							const userRecord = await admin.auth().createUser({
								email: signupData.email,
								password: tempPassword,
								displayName: signupData.firstName
							});
							createdUid = userRecord.uid;

							try {
								const resetLink = await admin.auth().generatePasswordResetLink(signupData.email);
								await sendInfobipEmail(signupData.email, 'Set your BlackBook password', `<p>Set your password: <a href="${resetLink}">Set password</a></p>`);
							} catch (e) { console.warn('Email send fail', e); }

						} catch (e) {
							try {
								const userByEmail = await admin.auth().getUserByEmail(signupData.email);
								createdUid = userByEmail.uid;
							} catch (ee) { console.error('User creation failed', ee); }
						}

						if (createdUid) {
							const userDoc = {
								email: signupData.email,
								firstName: signupData.firstName || '',
								phone: signupData.phone || '',
								joined: new Date().toISOString(),
								role: 'barber',
								plan: planId === 'free' ? 'free_trial' : planId,
								billingConfirmed: true,
								credits: planId === 'pro' ? 500 : planId === 'mogul' ? 1500 : 0,
								shopOpen: '09:00', shopClose: '17:00', lunchStart: '', lunchEnd: '', slotDuration: 60,
								provider: 'paypal'
							};
							if (planId === 'free') { userDoc.trialStartDate = new Date().toISOString(); userDoc.trialLengthDays = 90; }
							await db.collection('users').doc(createdUid).set(userDoc, { merge: true });
						}

						await docRef.update({ processed: true, processedAt: new Date().toISOString(), method: 'webhook', webhookPayload: body });
					} else {
						console.log('Payment already processed by return handler.');
					}
				}
			}
		}

		res.status(200).send('received');
	} catch (err) {
		console.error('PayPal Webhook Error:', err);
		res.status(500).send('error');
	}
});

// Export Express app as a single Cloud Function
exports.api = functions.https.onRequest(app);
