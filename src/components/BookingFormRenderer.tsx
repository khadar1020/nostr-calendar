import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Paper, Stack, Typography } from "@mui/material";
import type { Event as NostrEvent } from "nostr-tools";
import { useIntl } from "react-intl";
import { fetchUserFormResponse } from "../common/nostr";
import { useFormSubmissionStatus } from "../hooks/useFormSubmissionStatus";
import { useUser } from "../stores/user";
import { fetchAttachedFormCached } from "../utils/formAttachment";
import { getFormAddress } from "../utils/formLink";
import type {
  IFormAttachment,
  IFormResponseAnswer,
  IFormResponseSnapshot,
} from "../utils/types";
import { FormAttachmentRow } from "./FormAttachmentRow";
import { FormFillerDialog } from "./FormFillerDialog";

type SdkOption = {
  id: string;
  labelHtml: string;
  config?: { isOther?: boolean };
};

type SdkField = {
  id: string;
  type: string;
  labelHtml: string;
  options?: SdkOption[] | unknown;
  config?: { renderElement?: string };
};

type SdkForm = {
  id: string;
  fields?: Record<string, SdkField>;
  fieldOrder?: string[];
};

export interface BookingFormRenderState {
  loading: boolean;
  isComplete: boolean;
  error?: string;
  snapshot?: IFormResponseSnapshot;
}

interface BookingFormRendererProps {
  attachedForm: IFormAttachment;
  onStateChange: (state: BookingFormRenderState) => void;
}

function plainText(html: string | undefined): string {
  if (!html) return "";
  if (typeof document === "undefined") {
    return html.replace(/<[^>]*>/g, "").trim();
  }
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

function parseMetadata(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeAnswerValue(
  field: SdkField | undefined,
  rawValue: string | undefined,
  metadataRaw: string | undefined,
): IFormResponseAnswer["value"] {
  if (!rawValue) return null;
  if (!field) return rawValue;

  if (field.type === "option" && Array.isArray(field.options)) {
    const metadata = parseMetadata(metadataRaw);
    const labels = rawValue
      .split(";")
      .filter(Boolean)
      .map((id) => {
        const options = Array.isArray(field.options) ? field.options : [];
        const option = options.find((entry) => entry.id === id);
        const label = option ? plainText(option.labelHtml) || id : id;
        if (option?.config?.isOther && typeof metadata.message === "string") {
          return `${label} (${metadata.message})`;
        }
        return label;
      });
    if (labels.length === 0) return null;
    return labels.length === 1 ? labels[0] : labels;
  }

  if (field.config?.renderElement === "number") {
    const numeric = Number(rawValue);
    return Number.isFinite(numeric) ? numeric : rawValue;
  }

  if (field.config?.renderElement === "datetime") {
    const timestamp = Number(rawValue);
    if (Number.isFinite(timestamp)) {
      return new Date(timestamp * 1000).toLocaleString();
    }
  }

  if (field.config?.renderElement === "fileUpload") {
    try {
      const metadata = JSON.parse(rawValue) as { filename?: string };
      if (metadata.filename) return metadata.filename;
    } catch {
      return rawValue;
    }
  }

  if (field.type === "grid") {
    try {
      const parsed = JSON.parse(rawValue) as Record<string, string>;
      if (parsed && typeof parsed === "object") {
        return Object.entries(parsed)
          .map(([rowId, selected]) => `${rowId}: ${selected}`)
          .join(" | ");
      }
    } catch {
      return rawValue;
    }
  }

  return rawValue;
}

function buildSnapshotFromResponse(
  response: NostrEvent,
  form: SdkForm,
): IFormResponseSnapshot {
  const responseTags = response.tags.filter(
    (tag) => tag[0] === "response" && tag[1],
  );
  const tagsByField = new Map<string, string[]>();
  for (const tag of responseTags) {
    tagsByField.set(tag[1], tag);
  }

  const fields = form.fields ?? {};
  const fieldOrder = form.fieldOrder ?? [];
  const answers: IFormResponseAnswer[] = [];
  const consumed = new Set<string>();

  for (const fieldId of fieldOrder) {
    const field = fields[fieldId];
    if (!field || field.type === "label") continue;
    const tag = tagsByField.get(fieldId);
    if (!tag) continue;
    consumed.add(fieldId);
    answers.push({
      fieldId,
      label: plainText(field.labelHtml) || fieldId,
      value: normalizeAnswerValue(field, tag[2], tag[3]),
    });
  }

  for (const tag of responseTags) {
    const fieldId = tag[1];
    if (consumed.has(fieldId)) continue;
    const field = fields[fieldId];
    answers.push({
      fieldId,
      label: field ? plainText(field.labelHtml) || fieldId : fieldId,
      value: normalizeAnswerValue(field, tag[2], tag[3]),
    });
  }

  return {
    submittedAt: response.created_at * 1000,
    answers,
  };
}

export function BookingFormRenderer({
  attachedForm,
  onStateChange,
}: BookingFormRendererProps) {
  const intl = useIntl();
  const { user } = useUser();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<IFormResponseSnapshot>();
  const [resolveError, setResolveError] = useState<string>();
  const [resolvingSnapshot, setResolvingSnapshot] = useState(false);
  const { status, refresh } = useFormSubmissionStatus(
    attachedForm.naddr,
    user?.pubkey,
  );

  const submittedAtLabel = useMemo(() => {
    if (!snapshot?.submittedAt) return null;
    return new Date(snapshot.submittedAt).toLocaleString();
  }, [snapshot]);

  const resolveSnapshot = useCallback(
    async (responseEvent: NostrEvent | null) => {
      const formAddress = getFormAddress(attachedForm.naddr);
      if (!formAddress || !user?.pubkey) {
        setSnapshot(undefined);
        return;
      }

      setResolvingSnapshot(true);
      setResolveError(undefined);

      try {
        const [form, event] = await Promise.all([
          fetchAttachedFormCached<SdkForm>(attachedForm),
          responseEvent
            ? Promise.resolve(responseEvent)
            : fetchUserFormResponse(
                formAddress.coordinate,
                user.pubkey,
                formAddress.relayHints,
              ),
        ]);

        if (!event) {
          throw new Error(
            intl.formatMessage({ id: "form.responseUnavailable" }),
          );
        }

        setSnapshot(buildSnapshotFromResponse(event, form));
      } catch (error) {
        console.error("[BookingFormRenderer] resolve snapshot failed", error);
        setSnapshot(undefined);
        setResolveError(
          error instanceof Error
            ? error.message
            : intl.formatMessage({ id: "form.fetchError" }),
        );
      } finally {
        setResolvingSnapshot(false);
      }
    },
    [attachedForm, intl, user?.pubkey],
  );

  useEffect(() => {
    if (status.state === "submitted") {
      void resolveSnapshot(status.event);
      return;
    }

    if (status.state === "loading") {
      setSnapshot(undefined);
      setResolveError(undefined);
      return;
    }

    if (status.state === "error") {
      setSnapshot(undefined);
      setResolveError(status.error);
      return;
    }

    setSnapshot(undefined);
    setResolveError(undefined);
  }, [resolveSnapshot, status]);

  useEffect(() => {
    const loading = status.state === "loading" || resolvingSnapshot;
    const error =
      resolveError || (status.state === "error" ? status.error : undefined);
    onStateChange({
      loading,
      isComplete: Boolean(snapshot),
      error,
      snapshot,
    });
  }, [onStateChange, resolveError, resolvingSnapshot, snapshot, status]);

  return (
    <>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="subtitle2">
              {intl.formatMessage({ id: "form.fillTitle" })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Complete the attached form before requesting this booking.
            </Typography>
          </Box>

          <FormAttachmentRow
            attachment={attachedForm}
            onFill={() => setDialogOpen(true)}
            showSubmissionStatus
          />

          {status.state === "loading" || resolvingSnapshot ? (
            <Typography variant="body2" color="text.secondary">
              Checking your form submission…
            </Typography>
          ) : null}

          {resolveError ? <Alert severity="error">{resolveError}</Alert> : null}

          {snapshot ? (
            <Alert severity="success">
              {intl.formatMessage({ id: "form.alreadySubmitted" })}
            </Alert>
          ) : null}

          {snapshot?.answers?.length ? (
            <Stack spacing={1}>
              {submittedAtLabel ? (
                <Typography variant="caption" color="text.secondary">
                  Submitted {submittedAtLabel}
                </Typography>
              ) : null}
              {snapshot.answers.map((answer) => (
                <Box key={answer.fieldId}>
                  <Typography variant="body2" fontWeight={600}>
                    {answer.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {Array.isArray(answer.value)
                      ? answer.value.join(", ")
                      : answer.value == null
                        ? intl.formatMessage({ id: "form.noAnswer" })
                        : String(answer.value)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      <FormFillerDialog
        open={dialogOpen}
        attachment={attachedForm}
        onClose={() => setDialogOpen(false)}
        onSubmitted={(event) => {
          setDialogOpen(false);
          void resolveSnapshot(event);
          void refresh();
        }}
      />
    </>
  );
}
