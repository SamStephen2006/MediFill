// Medicine interaction database
// In production, this should come from a medical API (e.g., RxNorm, OpenFDA)
// This is an expanded local fallback

export interface InteractionInfo {
  medicines: string[];
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
}

// Map of medicine name (lowercase) -> list of interacting medicine names (lowercase)
export const MEDICINE_INTERACTIONS: Record<string, string[]> = {
  'aspirin': ['warfarin', 'ibuprofen', 'naproxen', 'clopidogrel', 'heparin'],
  'warfarin': ['aspirin', 'ibuprofen', 'paracetamol', 'naproxen', 'vitamin k', 'amiodarone'],
  'ibuprofen': ['aspirin', 'warfarin', 'lisinopril', 'naproxen', 'methotrexate'],
  'paracetamol': ['warfarin', 'alcohol'],
  'lisinopril': ['ibuprofen', 'potassium supplements', 'spironolactone'],
  'simvastatin': ['clarithromycin', 'erythromycin', 'amiodarone', 'grapefruit'],
  'clarithromycin': ['simvastatin', 'atorvastatin'],
  'erythromycin': ['simvastatin', 'atorvastatin'],
  'potassium supplements': ['lisinopril', 'spironolactone'],
  'metformin': ['alcohol', 'contrast dye'],
  'levothyroxine': ['calcium supplements', 'iron supplements', 'antacids'],
  'calcium supplements': ['levothyroxine', 'iron supplements'],
  'iron supplements': ['levothyroxine', 'calcium supplements', 'antacids'],
  'naproxen': ['aspirin', 'warfarin', 'ibuprofen', 'lisinopril'],
  'clopidogrel': ['aspirin', 'omeprazole'],
  'omeprazole': ['clopidogrel', 'methotrexate'],
  'atorvastatin': ['clarithromycin', 'erythromycin', 'grapefruit'],
  'amiodarone': ['warfarin', 'simvastatin', 'digoxin'],
  'digoxin': ['amiodarone', 'verapamil'],
  'verapamil': ['digoxin', 'metoprolol'],
  'metoprolol': ['verapamil', 'insulin'],
  'insulin': ['metoprolol', 'alcohol'],
  'spironolactone': ['lisinopril', 'potassium supplements'],
  'methotrexate': ['ibuprofen', 'omeprazole'],
  'antacids': ['levothyroxine', 'iron supplements'],
};

// Severity mapping for specific pairs
export const INTERACTION_SEVERITY: InteractionInfo[] = [
  {
    medicines: ['warfarin', 'aspirin'],
    severity: 'severe',
    description: 'Greatly increases risk of bleeding. Consult your doctor immediately.',
  },
  {
    medicines: ['warfarin', 'ibuprofen'],
    severity: 'severe',
    description: 'NSAIDs increase anticoagulant effect and risk of GI bleeding.',
  },
  {
    medicines: ['simvastatin', 'clarithromycin'],
    severity: 'severe',
    description: 'Risk of rhabdomyolysis (muscle breakdown). Avoid combination.',
  },
  {
    medicines: ['lisinopril', 'potassium supplements'],
    severity: 'moderate',
    description: 'Risk of hyperkalemia (high potassium). Monitor levels closely.',
  },
  {
    medicines: ['levothyroxine', 'calcium supplements'],
    severity: 'mild',
    description: 'Calcium reduces thyroid hormone absorption. Take 4 hours apart.',
  },
  {
    medicines: ['metformin', 'alcohol'],
    severity: 'moderate',
    description: 'Increases risk of lactic acidosis. Limit alcohol consumption.',
  },
  {
    medicines: ['clopidogrel', 'omeprazole'],
    severity: 'moderate',
    description: 'Omeprazole reduces effectiveness of clopidogrel. Consider alternative PPI.',
  },
];

/**
 * Find all medicines in the user's list that interact with a given medicine name.
 */
export function findInteractionsForMedicine(
  medicineName: string,
  existingMedicineNames: string[]
): string[] {
  const normalized = medicineName.trim().toLowerCase();
  const interactingNames = MEDICINE_INTERACTIONS[normalized] || [];

  return existingMedicineNames.filter((name) =>
    interactingNames.includes(name.toLowerCase())
  );
}

/**
 * Get interaction severity between two medicines.
 */
export function getInteractionSeverity(
  med1: string,
  med2: string
): InteractionInfo | undefined {
  const a = med1.toLowerCase();
  const b = med2.toLowerCase();

  return INTERACTION_SEVERITY.find(
    (info) =>
      (info.medicines.includes(a) && info.medicines.includes(b))
  );
}
