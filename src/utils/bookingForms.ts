import type {
  IAttachedFormRef,
  IFormResponseSnapshot,
} from "./types";

export interface FormstrNormalizedOption {
  id: string;
  labelHtml: string;
  config?: { isOther?: boolean } | null;
}

export interface FormstrNormalizedField {
  id: string;
  type: string;
  labelHtml: string;
  options?: FormstrNormalizedOption[];
  config: {
    required?: boolean;
    renderElement?: string;
    allowMultiplePerRow?: boolean;
    requiredRows?: string[];
    [key: string]: unknown;
  };
}

export interface FormstrSectionBlock {
  type: "section";
  id: string;
  title?: string;
  description?: string;
  questionIds: string[];
  order: number;
}

export interface FormstrIntroBlock {
  type: "intro";
  title?: string;
  description?: string;
}

export interface FormstrNormalizedForm {
  id: string;
  name?: string;
  fields: Record<string, FormstrNormalizedField>;
  fieldOrder: string[];
  relays: string[];
  pubkey: string;
  blocks?: Array<FormstrIntroBlock | FormstrSectionBlock>;
  settings?: Record<string, unknown>;
}

export type BookingFormValue =
  | string
  | string[]
  | number
  | boolean
  | null
  | Record<string, string>;

interface ParsedFormReference {
  naddr: string;
  normalizedUrl: string;
  viewKey?: string;
  nkeys?: string;
}

const FORMSTR_BASE_URL = "https://formstr.app";
const SUPPORTED_RENDER_ELEMENTS = new Set([
  "shortText",
  "paragraph",
  "number",
  "radioButton",
  "checkboxes",
  "dropdown",
  "date",
  "time",
  "datetime",
  "label",
  "multipleChoiceGrid",
  "checkboxGrid",
]);

function stripMarkup(value?: string): string {
  if (!value) return "";
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGridValues(
  field: FormstrNormalizedField,
  rawValue: BookingFormValue,
): string[] {
  if (typeof rawValue !== "object" || !rawValue || Array.isArray(rawValue)) {
    return [];
  }

  const options = field.options as unknown as
    | {
        columns: Array<[string, string]>;
        rows: Array<[string, string]>;
      }
    | undefined;
  const columns = new Map(options?.columns?.map(([id, label]) => [id, label]) ?? []);
  const rows = new Map(options?.rows?.map(([id, label]) => [id, label]) ?? []);

  return Object.entries(rawValue).flatMap(([rowId, columnIds]) => {
    const rowLabel = rows.get(rowId) ?? rowId;
    return columnIds
      .split(";")
      .filter(Boolean)
      .map((columnId) => `${rowLabel}: ${columns.get(columnId) ?? columnId}`);
  });
}

function normalizeAnswerValue(
  field: FormstrNormalizedField,
  rawValue: BookingFormValue,
): string | string[] | number | boolean | null {
  if (rawValue == null || rawValue === "") {
    return null;
  }

  const renderElement = field.config.renderElement || field.type;
  if (renderElement === "number") {
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : String(rawValue);
  }

  if (
    renderElement === "checkboxes" ||
    (Array.isArray(rawValue) && renderElement !== "checkboxGrid")
  ) {
    const values = Array.isArray(rawValue)
      ? rawValue
      : String(rawValue)
          .split(";")
          .filter(Boolean);

    return values.map((entry) => {
      const option = field.options?.find((candidate) => candidate.id === entry);
      return stripMarkup(option?.labelHtml) || entry;
    });
  }

  if (
    renderElement === "radioButton" ||
    renderElement === "dropdown"
  ) {
    const option = field.options?.find(
      (candidate) => candidate.id === String(rawValue),
    );
    return stripMarkup(option?.labelHtml) || String(rawValue);
  }

  if (
    renderElement === "multipleChoiceGrid" ||
    renderElement === "checkboxGrid"
  ) {
    return normalizeGridValues(field, rawValue);
  }

  return rawValue as string | number | boolean;
}

export function parseAttachedFormReference(
  input: string,
): ParsedFormReference | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("naddr1")) {
    return {
      naddr: trimmed,
      normalizedUrl: `${FORMSTR_BASE_URL}/f/${trimmed}`,
    };
  }

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `${FORMSTR_BASE_URL}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  const markerIndex = pathParts.findIndex((part) => part === "f");
  const naddr = markerIndex >= 0 ? pathParts[markerIndex + 1] : pathParts[0];
  if (!naddr?.startsWith("naddr1")) {
    return null;
  }

  const viewKey = url.searchParams.get("viewKey") || undefined;
  const hashValue = url.hash.replace(/^#/, "").trim();
  const nkeys = hashValue.startsWith("nkeys1") ? hashValue : undefined;
  const normalizedUrl = `${url.origin}/f/${naddr}${url.search}${nkeys ? `#${nkeys}` : ""}`;

  return { naddr, normalizedUrl, viewKey, nkeys };
}

export function getAttachedFormDisplayTitle(form?: IAttachedFormRef | null) {
  return form?.formTitle?.trim() || "Attached form";
}

export async function loadAttachedFormDefinition(
  reference: IAttachedFormRef,
): Promise<FormstrNormalizedForm> {
  const parsed = parseAttachedFormReference(reference.formUrl);
  if (!parsed) {
    throw new Error("Invalid Formstr form URL");
  }

  const { FormstrSDK } = await import("@formstr/sdk");
  const sdk = new FormstrSDK();
  const form = parsed.viewKey
    ? await sdk.fetchFormWithViewKey(parsed.naddr, parsed.viewKey)
    : await sdk.fetchForm(parsed.naddr, parsed.nkeys);

  return form as FormstrNormalizedForm;
}

export async function resolveAttachedFormReference(
  inputUrl: string,
  fallbackTitle?: string,
): Promise<IAttachedFormRef> {
  const parsed = parseAttachedFormReference(inputUrl);
  if (!parsed) {
    throw new Error("Please enter a valid Formstr form link or naddr");
  }

  try {
    const form = await loadAttachedFormDefinition({
      formId: parsed.naddr,
      formTitle: fallbackTitle,
      formUrl: parsed.normalizedUrl,
    });

    return {
      formId: form.id || parsed.naddr,
      formTitle: fallbackTitle?.trim() || stripMarkup(form.name) || undefined,
      formUrl: parsed.normalizedUrl,
    };
  } catch {
    return {
      formId: parsed.naddr,
      formTitle: fallbackTitle?.trim() || undefined,
      formUrl: parsed.normalizedUrl,
    };
  }
}

export function getUnsupportedFormFields(form: FormstrNormalizedForm) {
  return Object.values(form.fields).filter((field) => {
    const renderElement = field.config.renderElement || field.type;
    return !SUPPORTED_RENDER_ELEMENTS.has(renderElement);
  });
}

export function validateBookingFormValues(
  form: FormstrNormalizedForm,
  values: Record<string, BookingFormValue>,
): string | null {
  for (const fieldId of form.fieldOrder) {
    const field = form.fields[fieldId];
    const renderElement = field.config.renderElement || field.type;
    const rawValue = values[fieldId];

    if (!field.config.required) {
      continue;
    }

    if (renderElement === "multipleChoiceGrid" || renderElement === "checkboxGrid") {
      if (
        typeof rawValue !== "object" ||
        !rawValue ||
        Array.isArray(rawValue)
      ) {
        return stripMarkup(field.labelHtml) || fieldId;
      }

      const entries = Object.entries(rawValue);
      if (entries.length === 0) {
        return stripMarkup(field.labelHtml) || fieldId;
      }

      const requiredRows = field.config.requiredRows;
      if (requiredRows?.length) {
        const missingRow = requiredRows.find((rowId) => !rawValue[rowId]);
        if (missingRow) {
          return stripMarkup(field.labelHtml) || fieldId;
        }
      }
      continue;
    }

    if (Array.isArray(rawValue)) {
      if (rawValue.length === 0) {
        return stripMarkup(field.labelHtml) || fieldId;
      }
      continue;
    }

    if (
      rawValue == null ||
      (typeof rawValue === "string" && rawValue.trim() === "")
    ) {
      return stripMarkup(field.labelHtml) || fieldId;
    }
  }

  return null;
}

export function buildFormResponseSnapshot(
  form: FormstrNormalizedForm,
  values: Record<string, BookingFormValue>,
): IFormResponseSnapshot {
  return {
    submittedAt: Date.now(),
    answers: form.fieldOrder
      .map((fieldId) => {
        const field = form.fields[fieldId];
        const renderElement = field.config.renderElement || field.type;
        if (renderElement === "label") {
          return null;
        }

        return {
          fieldId,
          label: stripMarkup(field.labelHtml) || fieldId,
          value: normalizeAnswerValue(field, values[fieldId] ?? null),
        };
      })
      .filter((answer): answer is IFormResponseSnapshot["answers"][number] =>
        Boolean(answer),
      ),
  };
}
