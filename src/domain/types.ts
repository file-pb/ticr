/** Datový model. Otázky a odpovědi jsou dva oddělené soubory spojené stabilním ID. */

export type CircuitId = 'ez1' | 'ez2' | 'ez3' | 'ez4'

/** Otázka přesně jak ji vydal TIČR. Generuje ji import, ručně se needituje. */
export interface Question {
  id: string
  circuit: CircuitId
  circuitTitle: string
  number: number
  /** Značka ve zdroji, např. "34/". null u nečíslovaných otázek na začátku ez4. */
  sourceMarker: string | null
  numberedInSource: boolean
  text: string
  normativeRef: string
}

export interface CircuitMeta {
  id: CircuitId
  sourceFile: string
  title: string
  expected: number
  imported: number
  withNormativeRef: number
}

export interface Bank {
  schemaVersion: number
  bankVersion: string
  validFrom: string
  scope: string
  disclaimer: string
  provenance: {
    pageUrl: string
    zipUrl: string
    importedAt: string
    zipSha256: string | null
    files: { name: string; sha256: string | null; bytes: number | null; questions: number }[]
  }
  circuits: CircuitMeta[]
  questions: Question[]
}

/**
 * Stav ověření odpovědi.
 * `overeno` — porovnáno s primárním zdrojem, který je uvedený ve `verification`.
 * `navrh`   — učební návrh, nikdo ho proti zdroji neověřil. Nehodnotí se.
 * `sporne`  — nalezen rozpor se zněním otázky nebo s edicí normy. Nehodnotí se.
 */
export type AnswerStatus = 'navrh' | 'overeno' | 'sporne'

export interface AnswerOption {
  /** Stabilní ID. Správnost se váže na něj, nikdy na písmeno ani pozici. */
  id: string
  text: string
}

export interface Verification {
  /** Co bylo skutečně přečteno, včetně ustanovení a data. */
  source: string
  method: string
  checkedAt: string
  /** Kdo ověřil. Nikdy netvrdí kontrolu člověkem, která neproběhla. */
  checkedBy: string
}

/** Odkaz na doplňující školicí podklad a výsledek posouzení jeho aktuálnosti. */
export interface TrainingMaterialRef {
  name: string
  /** Verze nebo datum podkladu; "nezjisteno", pokud je neuvádí. */
  version: string
  /** Strana, snímek nebo kapitola. */
  locator: string
  currency: 'aktualni' | 'zastarale' | 'neposouzeno'
  note?: string
}

/**
 * Z čeho odpověď vznikla. Rozhoduje o tom, jestli se smí zveřejnit.
 * `volny`   — volně dostupný primární zdroj (zákon, nařízení, veřejný dokument).
 * `placeny` — placený podklad: norma ČSN nebo materiál ze školení, za které
 *             se platí. Zůstává lokální; zveřejnit ho by znamenalo rozdávat
 *             cizí hodnotu, za kterou někdo zaplatil.
 */
export type SourceClass = 'volny' | 'placeny'

export type Visibility = 'verejne' | 'jen-lokalne'

export interface Answer {
  questionId: string
  options: AnswerOption[]
  correctOptionId: string
  explanation: string
  /** Proč jsou ostatní možnosti nesprávné, klíčem je ID možnosti. */
  whyWrong: Record<string, string>
  status: AnswerStatus
  verification: Verification | null
  sourceClass: SourceClass
  /**
   * Odvozuje se ze `sourceClass`, pokud není uvedená: placený podklad nikdy
   * neodchází do veřejného balíčku.
   */
  visibility?: Visibility
  /** Popis rozporu u stavu `sporne`. */
  dispute?: string
  /** Co je potřeba doložit, aby se dala odpověď ověřit. */
  missing?: string
  trainingMaterial?: TrainingMaterialRef | null
}

export interface AnswerSet {
  schemaVersion: number
  answersVersion: string
  /** Verze banky, pro kterou byly odpovědi psané. Nesoulad se hlásí. */
  bankVersion: string
  license: string
  answers: Answer[]
}

/** Otázka spojená se svou odpovědí. Odpověď chybí u většiny otázek. */
export interface Item {
  question: Question
  answer: Answer | null
}

export type AttemptMode = 'zkouska' | 'procvicovani'

export interface AttemptItem {
  questionId: string
  /** Pořadí možností pro tento pokus, ID možností. */
  optionOrder: string[]
  chosenOptionId: string | null
  flagged: boolean
  /** Přiznaný tip. Správná odpověď s tipem neznamená zvládnuté učivo. */
  guessed: boolean
}

export interface Attempt {
  id: string
  mode: AttemptMode
  createdAt: number
  /** Okamžik konce v ms. Zbývající čas se počítá z něj, ne z odpočtu v paměti. */
  deadlineAt: number | null
  finishedAt: number | null
  bankVersion: string
  answersVersion: string
  thresholdPercent: number
  label: string
  items: AttemptItem[]
}

/** Pokrok u jedné otázky. Řídí opakování v rostoucích intervalech. */
export interface Progress {
  questionId: string
  box: number
  dueAt: number
  seenCount: number
  wrongCount: number
  guessedCount: number
  lastSeenAt: number
  saved: boolean
}
