// Bundled ingredient table. A purpose is stated only from here.
// shortcut: a small demo list; a pharmacist must review it and extend it before real use.
export const INGREDIENTS = {
  paracetamol: 'fever',
  acetaminophen: 'fever',
  cetirizine: 'allergy',
  levocetirizine: 'allergy',
  loratadine: 'allergy',
  pantoprazole: 'acidity',
  omeprazole: 'acidity',
  rabeprazole: 'acidity',
  ibuprofen: 'pain',
  azithromycin: 'antibiotic',
  amoxicillin: 'antibiotic',
  metformin: 'sugar',
  amlodipine: 'pressure',
  telmisartan: 'pressure',
};

export const purposeFor = (ingredient) => INGREDIENTS[ingredient] ?? null;

// Returns the single listed ingredient in the text. Combinations give null, so no purpose is guessed.
export function findIngredient(text) {
  const words = new Set(String(text).toLowerCase().split(/[^a-z]+/));
  const found = Object.keys(INGREDIENTS).filter((name) => words.has(name));
  return found.length === 1 ? found[0] : null;
}
