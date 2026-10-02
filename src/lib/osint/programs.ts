// Sanctions program metadata — maps program codes to human-readable labels + severity.
// Used by the SanctionsPanel for richer display.

export interface ProgramMeta {
  code: string;
  label: string;
  authority: string;
  severity: "critical" | "high" | "moderate";
}

export const PROGRAM_META: Record<string, ProgramMeta> = {
  "RUSSIA-EO14024": {
    code: "RUSSIA-EO14024",
    label: "Russia Harmful Foreign Activities",
    authority: "EO 14024 / CAATSA",
    severity: "high",
  },
  DPRK2: { code: "DPRK2", label: "North Korea Weapons of Mass Destruction", authority: "WMDPSR / NPKS", severity: "critical" },
  DPRK3: { code: "DPRK3", label: "North Korea Other Sanctions", authority: "DPRK authorities", severity: "critical" },
  IRAN: { code: "IRAN", label: "Iran Transactions Regulations", authority: "ITR / IEEPA", severity: "high" },
  "IRAN-HR": { code: "IRAN-HR", label: "Iran Human Rights", authority: "EO 13553 / 13628", severity: "moderate" },
  "IRAN-EO13599": { code: "IRAN-EO13599", label: "Iran Government Officials", authority: "EO 13599", severity: "high" },
  SDGT: { code: "SDGT", label: "Global Terrorism", authority: "EO 13224", severity: "critical" },
  SDNTK: { code: "SDNTK", label: "Narcotics Trafficking (Kingpin Act)", authority: "Kingpin Act", severity: "high" },
  CYBER2: { code: "CYBER2", label: "Significant Malicious Cyber Activities", authority: "EO 13694 (amended)", severity: "high" },
  VENEZUELA: { code: "VENEZUELA", label: "Venezuela Sanctions", authority: "EO 13884 / 13850", severity: "high" },
  BELARUS: { code: "BELARUS", label: "Belarus Sanctions", authority: "EO 13405 / BELARUS", severity: "moderate" },
  NICARAGUA: { code: "NICARAGUA", label: "Nicaragua Sanctions", authority: "NICA Act / EO 13851", severity: "moderate" },
  CUBA: { code: "CUBA", label: "Cuba Sanctions", authority: "Cuban Assets Control Regulations", severity: "moderate" },
  BURMA: { code: "BURMA", label: "Burma Sanctions", authority: "Burma Sanctions Regulations", severity: "moderate" },
  LIBYA2: { code: "LIBYA2", label: "Libya Sanctions", authority: "EO 13726", severity: "high" },
  SUDAN: { code: "SUDAN", label: "Sudan Sanctions", authority: "Darfur/Sudan authorities", severity: "moderate" },
  ZIMBABWE: { code: "ZIMBABWE", label: "Zimbabwe Sanctions", authority: "Zimbabwe Democracy Act", severity: "moderate" },
  SSUDAN: { code: "SSUDAN", label: "South Sudan Sanctions", authority: "EO 13664", severity: "moderate" },
  DRC: { code: "DRC", label: "Democratic Republic of the Congo", authority: "EO 13413", severity: "moderate" },
  DARFOUR: { code: "DARFOUR", label: "Darfur/Sahel Sanctions", authority: "EO 13400", severity: "moderate" },
  Mali: { code: "Mali", label: "Mali Sanctions", authority: "IEEPA / Mali authorities", severity: "moderate" },
};

export function getProgramMeta(code: string): ProgramMeta {
  return (
    PROGRAM_META[code] || {
      code,
      label: code,
      authority: "OFAC",
      severity: "moderate",
    }
  );
}
