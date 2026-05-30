const fs = require('fs');

const fieldDefs = [{"name":"appointment_order_number","label":"Appointment Order Number","data_type":"number","sort_order":0,"required":false,"id":2},{"name":"emergency_contact","label":"Emergency Contact","data_type":"string","sort_order":10,"required":false,"id":1},{"name":"retirement_date","label":"Retirement Date","data_type":"date","sort_order":15,"required":false,"id":4},{"name":"home_address","label":"Home Address","data_type":"text","sort_order":20,"required":false,"id":3}];

function isEmergencyContactField(name, label) {
  const joined = `${name} ${label}`.toLowerCase();
  return (joined.includes('emergency') || joined.includes('emergancy')) && joined.includes('contact');
}

function normalizePhoneValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const digitsOnly = raw.replace(/\D+/g, '');
  const withoutPrefix = digitsOnly.replace(/^91/, '');
  if (!withoutPrefix) return '+91';
  return `+91${withoutPrefix}`;
}

function escAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderCustomFieldsHtml(fieldDefs, extra) {
  if (!Array.isArray(fieldDefs) || fieldDefs.length === 0) return '';

  const defs = [...fieldDefs]
    .filter((d) => d && d.name)
    .sort((a, b) => {
      const ao = Number.isFinite(a.sort_order) ? a.sort_order : 0;
      const bo = Number.isFinite(b.sort_order) ? b.sort_order : 0;
      if (ao !== bo) return ao - bo;
      return String(a.label || a.name).localeCompare(String(b.label || b.name));
    });

  return defs
    .map((def) => {
      const name = String(def.name);
      const label = String(def.label || def.name);
      const required = !!def.required;
      const dataType = String(def.data_type || 'string');
      const isEmergency = isEmergencyContactField(name, label);
      const effectiveType = dataType === 'phone' || isEmergency ? 'phone' : dataType;
      const currentValue = extra && typeof extra === 'object' ? extra[name] : undefined;
      return 'ok';
    }).join('');
}

try {
  console.log(renderCustomFieldsHtml(fieldDefs, {}));
} catch(e) {
  console.log('ERROR:', e);
}
