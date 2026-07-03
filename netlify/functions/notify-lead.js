// Sends an immediate email notification to BlueVector plus the local rep
// matching the homeowner's selected service area. Fires right after a
// successful HubSpot submission (see script.js) — the lead is already saved
// in HubSpot regardless of what happens here, so this is a best-effort add-on.

const BLUEVECTOR_EMAIL = 'braxton.williams.business@outlook.com';

// Local reps by market. Update here as contact info changes or new markets
// come online — no other code needs to change.
const REPS = {
  central_florida: { name: 'Cameron Williams', email: 'cameronfwilliams23@gmail.com' },
  columbus_oh: { name: 'Wes Wats', email: null }, // email pending
  russellville_ar: { name: 'Thomas Lupo', email: 'thomasthomaslupo@gmail.com' },
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const {
    firstName = '',
    lastName = '',
    email = '',
    phone = '',
    areaKey = '',
    areaLabel = '',
    preferredTime = '',
    message = '',
  } = data;

  const rep = REPS[areaKey];

  const summaryText = [
    `New consult request — ${areaLabel || areaKey}`,
    '',
    `Name: ${firstName} ${lastName}`.trim(),
    `Email: ${email}`,
    `Phone: ${phone}`,
    `Area: ${areaLabel || areaKey}`,
    `Preferred time: ${preferredTime || 'Not specified'}`,
    `Notes: ${message || '—'}`,
    '',
    rep
      ? rep.email
        ? `Routed to: ${rep.name} <${rep.email}>`
        : `Routed to: ${rep.name} — email not on file yet, notify by phone for now.`
      : 'No rep matched for this area — please follow up manually.',
  ].join('\n');

  const recipients = [BLUEVECTOR_EMAIL];
  if (rep && rep.email) recipients.push(rep.email);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BlueVector Leads <onboarding@resend.dev>',
        to: recipients,
        subject: `New consult request — ${areaLabel || areaKey}`,
        text: summaryText,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { statusCode: 502, body: `Email send failed: ${errText}` };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: 'Server error sending notification email' };
  }
};
