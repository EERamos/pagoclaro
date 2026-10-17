// Persistence boundary (design §5 sessions seam). JSON with atomic writes now; another backend
// (Postgres) implements the same interface without touching the domain.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { makeEntry, type AuditEntry } from '../domain/audit';
import type {
  Agreement,
  DocumentKind,
  Evaluation,
  Facts,
  FxTable,
  InvoiceStatus,
  PaymentInstruction,
  ReadResult,
  RuleCode,
  Rules,
  Vendor,
} from '../domain/types';

export interface StoredDocument {
  sha256: string;
  kind: DocumentKind;
  filename: string;
  media_type: string;
  size: number;
}

export interface InvoiceRecord {
  id: string;
  document: StoredDocument;
  uploaded_by: string;
  received_at: string;
  readings: { primary: ReadResult | null; check: ReadResult | null; check_attempts: number; primary_attempts: number };
  reading_used: 'primary' | 'check' | null;
  facts: Facts | null;
  vendor_id: string | null;
  issuer_name: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  total: number | null;
  currency: string | null;
  amount_usd: number | null;
  evaluation_id: string | null;
  status: InvoiceStatus;
  reasons: RuleCode[];
  decided_at: string | null;
  payment_id: string | null;
  pending_id: string | null;
}

export interface PendingRecord {
  id: string;
  invoice_id: string;
  reasons: RuleCode[];
  created_at: string;
  expires_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution: 'APPROVED_PAID' | 'APPROVED_HELD' | 'REJECTED' | 'EXPIRED' | null;
  note: string | null;
}

/** A paid or pending invoice that predates this system (seeded history). */
export interface ExternalLedgerEntry {
  invoice_number: string;
  vendor_id: string;
  total: number;
  currency: string;
  amount_usd: number;
  issue_date: string;
  decided_at: string;
  status: 'PAID' | 'PENDING';
}

export interface RulesVersion {
  rules: Rules;
  approved_by: string;
  at: string;
}

export interface State {
  rules_versions: RulesVersion[];
  fx_table: FxTable;
  vendors: Vendor[];
  agreements: Agreement[];
  /** USD already committed per period by spend outside this ledger. */
  budget_baselines: Record<string, number>;
  external_ledger: ExternalLedgerEntry[];
  invoices: Record<string, InvoiceRecord>;
  evaluations: Record<string, Evaluation>;
  payments: Record<string, PaymentInstruction>;
  pending: Record<string, PendingRecord>;
  audit: AuditEntry[];
}

export class StoreError extends Error {}

export function emptyState(): State {
  return {
    rules_versions: [],
    fx_table: { date: '', source: '', rates: {} },
    vendors: [],
    agreements: [],
    budget_baselines: {},
    external_ledger: [],
    invoices: {},
    evaluations: {},
    payments: {},
    pending: {},
    audit: [],
  };
}

export interface Store {
  read(): State;
  /** Runs fn on a draft; persists all of it or nothing. */
  tx<T>(fn: (draft: State) => T): T;
}

export class JsonStore implements Store {
  private state: State;

  constructor(
    private readonly file: string | null,
    initial?: State,
  ) {
    this.state = initial ?? emptyState();
    if (!initial && file && existsSync(file)) {
      try {
        this.state = { ...emptyState(), ...(JSON.parse(readFileSync(file, 'utf8')) as State) };
      } catch {
        renameSync(file, `${file}.corrupt-${Date.now()}`);
      }
    }
  }

  read(): State {
    return structuredClone(this.state);
  }

  tx<T>(fn: (draft: State) => T): T {
    const draft = structuredClone(this.state);
    const result = fn(draft);
    this.persist(draft);
    this.state = draft;
    return result;
  }

  protected persist(next: State): void {
    if (!this.file) return;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify(next, null, 2));
      renameSync(tmp, this.file);
    } catch (e) {
      throw new StoreError(`no se pudo guardar: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

export function currentRules(s: State): Rules {
  const v = s.rules_versions.at(-1);
  if (!v) throw new StoreError('no hay reglas cargadas');
  return v.rules;
}

export function appendAudit(draft: State, e: { at: string; invoice_id: string | null; type: string; actor: string; data: unknown }): AuditEntry {
  const entry = makeEntry(draft.audit.at(-1), e);
  draft.audit.push(entry);
  return entry;
}
