require('dotenv').config();
const fs = require('fs');
const { Resend } = require('resend');
const key = process.env.Resend_key;

// Load JSON
let bangla = JSON.parse(fs.readFileSync("json/bangla.json", "utf-8"));
let phy    = JSON.parse(fs.readFileSync("json/phy.json", "utf-8"));
let chem   = JSON.parse(fs.readFileSync("json/chem.json", "utf-8"));

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

let tips = [getRandom(bangla), getRandom(chem), getRandom(phy)];

// ---------- CHEMICAL / MATH NOTATION PARSER ----------
function parseNotation(str) {
  if (typeof str !== 'string') return str;

  str = str.replace(/\^([^^]+)\^/g, '<sup>$1</sup>');
  str = str.replace(/\^(\w)/g, '<sup>$1</sup>');

  str = str.replace(/\_([^_]+)\_/g, '<sub>$1</sub>');

  str = str.replace(/<=>/g, '⇌');

  str = str.replace(/=([^=]+)=([^=]+)=>([^=]*)/g, (_, above, below, rest) => {
    return `<span style="display:inline-block; text-align:center; line-height:1.2;">
      <span style="font-size:0.8em; display:block;">${above}</span>
      <span style="font-size:1.2em;">→</span>
      <span style="font-size:0.8em; display:block;">${below}</span>
    </span>${rest.slice(1)}`;
  });

  str = str.replace(/=([^=]+)=>([^=]*)/g, (_, above, rest) => {
    return `<span style="display:inline-block; text-align:center;">
      <span style="font-size:0.8em; display:block;">${above}</span>
      <span style="font-size:1.2em;">→</span>
    </span>${rest.slice(1)}`;
  });

  str = str.replace(/==>/g, '→');

  return str;
}

// ---------- EMAIL RENDERER (light theme) ----------
function renderEmail(data) {
  const subjectColors = [
    { accent: '#2563eb', label: 'বাংলা',    icon: '✦' },
    { accent: '#0d9488', label: 'Chemistry', icon: '⬡' },
    { accent: '#7c3aed', label: 'Physics',   icon: '◎' }
  ];

  function pill(text, color) {
    return `<span style="display:inline-block;background:${color}10;color:${color};border:1px solid ${color}40;border-radius:3px;padding:1px 7px;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;font-family:'Courier New', monospace;">${text}</span>`;
  }

  function renderValue(value, depth = 0) {
    if (Array.isArray(value)) {
      return value.map(item => `
        <tr><td style="padding:2px 0 2px 14px; border-left:1px solid #d1d5db;">
          ${renderValue(item, depth + 1)}
        </td></tr>
      `).join('');
    }

    if (typeof value === 'object' && value !== null) {
      const rows = Object.entries(value).map(([k, v]) => `
        <tr>
          <td style="padding:5px 10px 5px 0;color:#6b7280;font-size:11px;font-family:'Courier New', monospace;letter-spacing:0.05em;white-space:nowrap;vertical-align:top;border-bottom:1px solid #e5e7eb;">${k}</td>
          <td style="padding:5px 0 5px 10px;color:#1f2937;font-size:13px;line-height:1.6;border-bottom:1px solid #e5e7eb;">${renderValue(v, depth + 1)}</td>
        </tr>
      `).join('');
      return `<table width="100%" style="border-collapse:collapse;">${rows}</table>`;
    }

    // Primitive: apply notation parser, then highlight numbers
    const str = String(value);
    const parsed = parseNotation(str);
    const highlighted = parsed.replace(
      /(\b\d[\d.,/^×·\s]*[a-zA-Zα-ωΑ-Ω²³⁻⁰¹²³⁴⁵⁶⁷⁸⁹]*\b)/g,
      '<span style="color:#2563eb;font-family:\'Courier New\',monospace;font-size:12px;">$1</span>'
    );
    return highlighted;
  }

  function renderCard(item, index) {
    const theme = subjectColors[index] || subjectColors[0];
    const accent = theme.accent;

    let cardTitle = '';
    let cardContent = item;

    if (typeof item === 'object' && !Array.isArray(item)) {
      const keys = Object.keys(item);
      if (keys.length === 1) {
        cardTitle = keys[0];
        cardContent = item[keys[0]];
      }
    }

    return `
    <tr><td style="padding:0 0 16px 0;">
      <table width="100%" style="background:#ffffff;border:1px solid #e5e7eb;border-top:2px solid ${accent};border-collapse:collapse;">
        <tr><td style="padding:12px 16px 10px; border-bottom:1px solid #f3f4f6;">
          <table width="100%">
            <tr>
              <td><span style="color:${accent};font-size:11px;font-family:'Courier New', monospace;letter-spacing:0.12em;text-transform:uppercase;">${theme.icon} ${theme.label}</span></td>
              <td align="right"><span style="color:#9ca3af;font-size:20px;font-family:'Courier New', monospace;">${String(index + 1).padStart(2, '0')}</span></td>
            </tr>
          </table>
          ${cardTitle ? `<div style="margin-top:6px;color:#111827;font-size:15px;font-weight:bold;font-family:Georgia, 'Times New Roman', serif;line-height:1.4;">${cardTitle}</div>` : ''}
        </td></tr>
        <tr><td style="padding:14px 16px;">${renderValue(cardContent)}</td></tr>
      </table>
    </td></tr>`;
  }

  const date = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const cards = Array.isArray(data) ? data.map((item, i) => renderCard(item, i)).join('') : renderCard(data, 0);

  return `
  <table width="100%" style="background:#f9fafb; margin:0; padding:0;">
    <tr><td align="center" style="padding:24px 12px;">
      <table width="600" style="max-width:600px; border-collapse:collapse;">
        <tr><td style="padding:0 0 20px 0;">
          <table width="100%" style="background:#ffffff;border:1px solid #e5e7eb;border-collapse:collapse;">
            <tr><td style="padding:20px 20px 16px;">
              <table width="100%">
                <tr>
                  <td><div style="color:#6b7280;font-size:11px;font-family:'Courier New', monospace;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:6px;">Daily Revision</div><div style="color:#111827;font-size:22px;font-weight:bold;font-family:Georgia, 'Times New Roman', serif;letter-spacing:0.02em;">StudyStudio</div></td>
                  <td align="right" style="vertical-align:bottom;"><div style="color:#9ca3af;font-size:11px;font-family:'Courier New', monospace;letter-spacing:0.06em;">${date}</div></td>
                </tr>
              </table>
            </td></tr>
            <tr><td style="padding:0 20px;"><table width="100%"><tr><td style="height:1px; background:linear-gradient(to right,#2563eb,#e5e7eb,#f9fafb);"></td></tr></table></td></tr>
            <tr><td style="padding:10px 20px 16px;"><span style="color:#6b7280;font-size:11px;font-family:'Courier New', monospace;font-style:italic;">3 topics · random selection</span></td></tr>
          </table>
        </td></tr>
        ${cards}
        <tr><td style="padding:4px 0 0 0; text-align:center;"><span style="color:#cbd5e1;font-size:10px;font-family:'Courier New', monospace;letter-spacing:0.1em;">STUDYSTUDIO · DAILY REMINDER · AUTO-GENERATED</span></td></tr>
      </table>
    </td></tr>
  </table>`;
}

let body = renderEmail(tips);

// Send Email
const resend = new Resend(key);

(async function () {
  const { data, error } = await resend.emails.send({
    from: 'Reminder <reminder@email.kirtasehidayah.app>',
    to: ['zabir.sgc@gmail.com'],
    subject: `Daily Reminder ${new Date().toLocaleDateString()}`,
    html: body,
  });
  if (error) return console.error(error);
  console.log(data);
})();