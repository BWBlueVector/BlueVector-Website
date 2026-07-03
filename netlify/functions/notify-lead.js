// Sends an immediate email notification to BlueVector plus the local rep
// matching the homeowner's selected service area. Fires right after a
// successful HubSpot submission (see script.js) — the lead is already saved
// in HubSpot regardless of what happens here, so this is a best-effort add-on.

const BLUEVECTOR_EMAIL = 'braxton.williams.business@outlook.com';

// Local reps by market. Update here as contact info changes or new markets
// come online — no other code needs to change.
const REPS = {
  central_florida: { name: 'Cameron Williams', email: 'cameronfwilliams23@gmail.com' },
  columbus_oh: { name: 'Wes Wats', email: 'wwatts2424@gmail.com' },
  russellville_ar: { name: 'Thomas Lupo', email: 'thomasthomaslupo@gmail.com' },
};

// Fixed daily slots the form offers. Consults run ~2 hours.
const TIME_SLOTS = {
  '10:00 AM': { hour: 10, minute: 0 },
  '2:00 PM': { hour: 14, minute: 0 },
  '4:00 PM': { hour: 16, minute: 0 },
};
const CONSULT_DURATION_HOURS = 2;

function icsEscape(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Builds a floating-local-time .ics invite (no timezone conversion — the
// rep lives in the market they're being sent, so the literal wall-clock
// time is what matters). This is a convenience add-to-calendar attachment,
// not a real-time availability check — the copy on the form already tells
// homeowners the rep will confirm or reschedule.
function buildIcs({ date, time, areaLabel, firstName, lastName }) {
  const slot = TIME_SLOTS[time];
  if (!date || !slot) return null;

  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;

  const pad = (n) => String(n).padStart(2, '0');
  const startStr = `${year}${pad(month)}${pad(day)}T${pad(slot.hour)}${pad(slot.minute)}00`;

  const endDate = new Date(year, month - 1, day, slot.hour + CONSULT_DURATION_HOURS, slot.minute);
  const endStr = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;

  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@bluevectorleads.netlify.app`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BlueVector Leads//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${icsEscape(`Bath & Shower Consult - ${firstName} ${lastName}`)}`,
    `DESCRIPTION:${icsEscape('Requested via the BlueVector website. Confirm with the homeowner before treating this as booked.')}`,
    `LOCATION:${icsEscape(areaLabel)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

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
    preferredDate = '',
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
    `Requested: ${preferredDate || 'Not specified'} at ${preferredTime || 'Not specified'} (unconfirmed — please contact the homeowner to lock this in or reschedule)`,
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

  const ics = buildIcs({ date: preferredDate, time: preferredTime, areaLabel: areaLabel || areaKey, firstName, lastName });

  const emailPayload = {
    from: 'BlueVector Leads <onboarding@resend.dev>',
    to: recipients,
    subject: `New consult request — ${areaLabel || areaKey}`,
    text: summaryText,
  };

  if (ics) {
    emailPayload.attachments = [
      {
        filename: 'consult-request.ics',
        content: Buffer.from(ics).toString('base64'),
      },
    ];
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
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
