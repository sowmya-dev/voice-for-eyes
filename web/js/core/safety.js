// The rule engine. Every plan passes through evaluate() before it is spoken, including replays and cloud answers.
// Plan = { intent, aspect, medicine: bool, segments: [{ id, slots }] }
import { classify } from './expiry.js';

const seg = (id, slots = {}) => ({ id, slots });
const DOSAGE = new Set(['dose.printed']);
const DAYS_LEFT = ['expiry.days_left', 'expiry.day_left', 'expiry.today'];
const DROP_WHEN_EXPIRED = new Set(['dose.printed', 'dose.none', 'dose.withheld', 'id.confirm_doctor', 'expiry.in', 'expiry.in_one', 'took.ack',
  ...DAYS_LEFT, 'expiry.good_month', 'expiry.good_months', 'expiry.good_year', 'expiry.good_years']);
const FIRST = new Set(['safety.emergency', 'dial.trying', 'dial.manual', 'help.unwell']);

export function evaluate(plan, label, today) {
  const removed = [];
  const window = plan.medicine ? classify(label?.expiry, today) : 'unknown';

  // Label-only: a dosage or expiry value must be exactly what was accepted from the label.
  let segments = plan.segments.filter((s) => {
    const fromLabel = s.id === 'dose.printed' ? s.slots.text === label?.dosage
      : s.id === 'expiry.date' ? s.slots.year === label?.expiry?.year && s.slots.month === label?.expiry?.month
        : true;
    if (!fromLabel) removed.push(s.id);
    return fromLabel;
  });

  const drop = (test) => {
    segments = segments.filter((s) => {
      if (!test(s)) return true;
      removed.push(s.id);
      return false;
    });
  };

  if (window === 'expired') {
    drop((s) => DROP_WHEN_EXPIRED.has(s.id));
    // An expired medicine gets no purpose either: "a fever tablet" would invite its use.
    segments = segments.map((s) => (s.id === 'id.purpose' ? seg('id.name', { name: s.slots.name }) : s));
    if (plan.aspect === 'took' || plan.aspect === 'took_more') segments.unshift(seg('doctor.now'));
    const lead = segments.filter((s) => FIRST.has(s.id));
    segments = [...lead, seg('warn.expired'), ...segments.filter((s) => !FIRST.has(s.id))];
  } else if (window === 'unknown' && segments.some((s) => DOSAGE.has(s.id))) {
    // Dosage is never read while the expiry is unclear.
    drop((s) => DOSAGE.has(s.id));
    segments.push(seg('dose.withheld'));
  } else if (window === 'week' || window === 'month') {
    // The notice comes before other medicine details, but never before help instructions.
    const at = segments.reduce((i, s, n) => (FIRST.has(s.id) ? n + 1 : i), 0);
    // An expiry answer that says the days left already gives the notice.
    if (!segments.some((s) => DAYS_LEFT.includes(s.id))) segments.splice(at, 0, seg(`notice.${window}`));
    drop((s) => s.id === 'expiry.in' || s.id === 'expiry.in_one');
  }

  const expired = window === 'expired' ? true : window === 'unknown' ? 'unknown' : false;
  const requiresConfirmation = expired === true || plan.intent === 'dose';
  return { plan: { ...plan, segments }, window, expired, removed, requiresConfirmation };
}

// A cloud answer that talks about medicine or doses is not spoken.
const MEDICAL_ADVICE = /\b(\d+\s*(mg|mcg|ml)|dos(e|es|age)|tablets?|capsules?|pills?|medicines?|medication|antibiotic|paracetamol|ibuprofen|safe to take)\b|गोली|दवा|खुराक|మాత్ర|మందు|ಮಾತ್ರೆ|ಔಷಧ/iu;
export const isMedicalAdvice = (text) => MEDICAL_ADVICE.test(text);
