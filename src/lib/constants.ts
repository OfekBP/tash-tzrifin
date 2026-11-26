export const categories = ['service', 'holidays','financial', 'service-relief', 'lone-soldier', 'family', 'health', 'equipment', 'housing', 'work', 'special', 'other'] as const;

export const docTypeLabels = {
  ownership: 'אישור בעלות חשבון',
  statement: 'עובר ושב',
  credit: 'פירוט כרטיס אשראי',
  balance: 'ריכוז יתרות',
} as const;

/**
 * איך מזהים ברשימת המסמכים של זכות אישור בנקאי שיש לו הדרכה בעמודי הבנקים.
 * מספיק שאחד הביטויים מופיע בשם המסמך (למשל "תדפיסי עו״ש של החייל" ← statement).
 */
export const docTypeMatch: Record<keyof typeof docTypeLabels, string[]> = {
  balance: ['ריכוז יתרות'],
  credit: ['כרטיסי אשראי', 'כרטיס אשראי', 'פירוט אשראי'],
  statement: ['עו״ש', 'עובר ושב'],
  ownership: ['בעלות חשבון'],
};
