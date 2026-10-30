export type Sex = 'male' | 'female';

/** How a parent link is known, strongest first. "Unknown" is represented by no link. */
export type ParentConfidence = 'dna' | 'observed' | 'reported' | 'assumed';

export const CONFIDENCE_RANK: Record<ParentConfidence, number> = {
  dna: 4,
  observed: 3,
  reported: 2,
  assumed: 1,
};

export type AnimalStatus =
  | 'active'
  | 'breeding'
  | 'pregnant'
  | 'nursing'
  | 'growing'
  | 'quarantined'
  | 'sold'
  | 'deceased'
  | 'culled';

export type Ownership = 'owned' | 'sold' | 'external_reference';

/** One animal as the engine sees it. Ids are opaque strings (UUIDs in the app). */
export interface AnimalInput {
  id: string;
  sex: Sex;
  speciesId: string;
  orgId?: string;
  breedId?: string;
  /** ISO date (YYYY-MM-DD) */
  birthDate?: string;
  birthDateEstimated?: boolean;
  sireId?: string | null;
  damId?: string | null;
  /** Defaults to 'reported' when a parent id is given without a confidence. */
  sireConfidence?: ParentConfidence;
  damConfidence?: ParentConfidence;
  /** Possible sires when paternity is uncertain (sireId should then be empty). */
  candidateSireIds?: string[];
  /** Farm explicitly treats this animal as an unrelated, non-inbred base animal. */
  isDeclaredFounder?: boolean;
  status?: AnimalStatus;
  ownership?: Ownership;
  /** Display label for explanations, e.g. farm tag. */
  label?: string;
}

export type RelationshipCode =
  | 'parent-offspring'
  | 'grandparent-grandchild'
  | 'great-grandparent-great-grandchild'
  | 'direct-ancestor'
  | 'full-siblings'
  | 'half-siblings'
  | 'uncle-aunt-niece-nephew'
  | 'half-uncle-aunt-niece-nephew'
  | 'first-cousins'
  | 'half-first-cousins'
  | 'double-first-cousins'
  | 'second-cousins'
  | 'half-second-cousins'
  | 'other-shared-ancestry';

export interface BreedingPolicy {
  id: string;
  speciesId: string;
  /** Known COI below this is the Low band. */
  lowBandMax: number;
  /** Known COI at or above this is High. */
  highBandMin: number;
  /** Known COI at or above this is Restricted (needs override). */
  maxCoi: number;
  /** Minimum pedigree completeness index (0..1). */
  minCompleteness: number;
  /** Generations used for the completeness index (generation 1 = buck or doe). */
  generations: number;
  blockedRelationships: RelationshipCode[];
  allowFounderAssumption: boolean;
  advisorName?: string;
  advisorNote?: string;
}

export type Band = 'low' | 'elevated' | 'high';

export type ClassificationCode =
  | 'restricted'
  | 'high'
  | 'insufficient'
  | 'elevated'
  | 'low';

export const CLASSIFICATION_LABEL: Record<ClassificationCode, string> = {
  restricted: 'Restricted by farm breeding policy',
  high: 'High pedigree risk',
  insufficient: 'Insufficient pedigree information',
  elevated: 'Elevated pedigree risk',
  low: 'Low known pedigree risk',
};

export interface CoiValue {
  /** Exact fraction, e.g. "1/8" */
  exact: string;
  /** Decimal (0..1) */
  value: number;
  /** Percentage rounded for display, e.g. "12.5%" */
  display: string;
}

export interface PathDetail {
  /** Animal ids from the buck up to the common ancestor (inclusive). */
  buckSide: string[];
  /** Animal ids from the doe up to the common ancestor (inclusive). */
  doeSide: string[];
  n: number;
  nPrime: number;
  contribution: CoiValue;
  /** Weakest parent-link confidence along this path. */
  weakestConfidence: ParentConfidence | null;
}

export interface CommonAncestorDetail {
  ancestorId: string;
  ancestorLabel: string;
  inbreedingOfAncestor: CoiValue;
  contribution: CoiValue;
  paths: PathDetail[];
}

export interface RelationshipDetail {
  code: RelationshipCode;
  label: string;
  /** Nearest shared ancestors that define this relationship. */
  viaAncestorIds: string[];
  /** Generations from buck and from doe to those ancestors. */
  n: number;
  nPrime: number;
}

export interface SideCompleteness {
  /** a_i for i = 1..d */
  perGeneration: number[];
  index: number;
}

export interface CompletenessResult {
  generations: number;
  recorded: { pci: number; buck: SideCompleteness; doe: SideCompleteness };
  founderAdjusted: { pci: number; buck: SideCompleteness; doe: SideCompleteness };
  /** The figure used for classification. */
  used: number;
  usesFounderAssumption: boolean;
  /** Equivalent complete generations of the proposed kid (recorded ancestors only). */
  equivalentCompleteGenerations: number;
}

export interface UncertainSireScenario {
  /** Animal whose sire is uncertain -> candidate chosen in this scenario. */
  assignment: Record<string, string>;
  coi: CoiValue;
  relationships: RelationshipDetail[];
}

export interface PairingAssessment {
  engineVersion: string;
  method: 'tabular-kinship+wright-paths';
  buckId: string;
  doeId: string;
  policy: BreedingPolicy;
  pedigreeRevision: number | null;
  /** SHA-256 over every parent link, confidence and founder flag used. */
  pedigreeHash: string;
  /** Known-pedigree COI using every recorded parent link. A lower bound. */
  knownCoi: CoiValue;
  /** COI using only DNA-confirmed and observed parent links. */
  verifiedOnlyCoi: CoiValue;
  /** Highest COI across candidate-sire scenarios, when paternity is uncertain. */
  worstCaseCoi: CoiValue | null;
  worstCaseScenario: UncertainSireScenario | null;
  /** Band of the known COI (always shown, whatever the classification). */
  knownBand: Band;
  /** COI the classification was based on (worst case when sires are uncertain). */
  classifiedCoi: CoiValue;
  classification: {
    code: ClassificationCode;
    label: string;
    /** True when the result rests on a possible (candidate) sire, not a recorded one. */
    possible: boolean;
    requiresOverride: boolean;
  };
  relationships: RelationshipDetail[];
  coefficientOfRelationship: CoiValue;
  commonAncestors: CommonAncestorDetail[];
  explanationTruncated: boolean;
  completeness: CompletenessResult;
  weakestContributingConfidence: ParentConfidence | null;
  limitations: string[];
  explanation: string[];
}
