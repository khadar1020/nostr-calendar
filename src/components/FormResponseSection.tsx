import { Box, Button, Divider, Link, Stack, Typography } from "@mui/material";
import dayjs from "dayjs";
import type { IFormAttachment, IFormResponseSnapshot } from "../utils/types";
import { buildFormstrUrl } from "../utils/formLink";

function formatAnswerValue(
  value: string | string[] | number | boolean | null,
): string {
  if (value == null) return "No response";
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "No response";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

interface FormResponseSectionProps {
  attachedForm?: IFormAttachment;
  formResponse?: IFormResponseSnapshot;
  compact?: boolean;
}

export function FormResponseSection({
  attachedForm,
  formResponse,
  compact = false,
}: FormResponseSectionProps) {
  if (!attachedForm && !formResponse) {
    return null;
  }

  const formLabel = attachedForm
    ? attachedForm.naddr.length > 24
      ? `${attachedForm.naddr.slice(0, 12)}…${attachedForm.naddr.slice(-8)}`
      : attachedForm.naddr
    : null;

  return (
    <>
      {!compact && <Divider />}
      <Box>
        <Stack
          direction={compact ? "column" : "row"}
          gap={1}
          justifyContent="space-between"
          alignItems={compact ? "flex-start" : "center"}
          mb={1}
        >
          <Box>
            <Typography variant="subtitle1">Form response</Typography>
            {attachedForm ? (
              <Typography variant="body2" color="text.secondary">
                {formLabel}
              </Typography>
            ) : null}
          </Box>
          {attachedForm ? (
            <Button
              component={Link}
              href={buildFormstrUrl(attachedForm)}
              target="_blank"
              rel="noreferrer"
              size="small"
            >
              Open form
            </Button>
          ) : null}
        </Stack>
        {formResponse?.submittedAt ? (
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
            Submitted {dayjs(formResponse.submittedAt).format("ddd, DD MMM YYYY ⋅ HH:mm")}
          </Typography>
        ) : null}

        {formResponse?.answers?.length ? (
          <Stack spacing={1}>
            {formResponse.answers.map((answer) => (
              <Box key={answer.fieldId}>
                <Typography variant="body2" fontWeight={600}>
                  {answer.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatAnswerValue(answer.value)}
                </Typography>
              </Box>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No form response was captured.
          </Typography>
        )}
      </Box>
    </>
  );
}
