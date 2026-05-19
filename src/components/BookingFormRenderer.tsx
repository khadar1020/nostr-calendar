import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { IAttachedFormRef, IFormResponseSnapshot } from "../utils/types";
import {
  BookingFormValue,
  buildFormResponseSnapshot,
  FormstrNormalizedField,
  FormstrNormalizedForm,
  getAttachedFormDisplayTitle,
  getUnsupportedFormFields,
  loadAttachedFormDefinition,
  validateBookingFormValues,
} from "../utils/bookingForms";

export interface BookingFormRenderState {
  loading: boolean;
  isComplete: boolean;
  error?: string;
  snapshot?: IFormResponseSnapshot;
}

interface BookingFormRendererProps {
  attachedForm: IAttachedFormRef;
  onStateChange: (state: BookingFormRenderState) => void;
}

function getRenderElement(field: FormstrNormalizedField) {
  return field.config.renderElement || field.type;
}

function GridField({
  field,
  value,
  onChange,
}: {
  field: FormstrNormalizedField;
  value: Record<string, string>;
  onChange: (nextValue: Record<string, string>) => void;
}) {
  const options = field.options as unknown as
    | {
        columns: Array<[string, string]>;
        rows: Array<[string, string]>;
      }
    | undefined;
  const rows = options?.rows ?? [];
  const columns = options?.columns ?? [];
  const isCheckboxGrid = getRenderElement(field) === "checkboxGrid";

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell />
          {columns.map(([columnId, columnLabel]) => (
            <TableCell key={columnId} align="center">
              <Markdown remarkPlugins={[remarkGfm]}>{columnLabel}</Markdown>
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map(([rowId, rowLabel]) => (
          <TableRow key={rowId}>
            <TableCell sx={{ minWidth: 160 }}>
              <Markdown remarkPlugins={[remarkGfm]}>{rowLabel}</Markdown>
            </TableCell>
            {columns.map(([columnId]) => {
              const currentRowValue = value[rowId] || "";
              const isChecked = isCheckboxGrid
                ? currentRowValue.split(";").includes(columnId)
                : currentRowValue === columnId;

              return (
                <TableCell key={columnId} align="center">
                  {isCheckboxGrid ? (
                    <Checkbox
                      checked={isChecked}
                      onChange={(event) => {
                        const selections = currentRowValue
                          .split(";")
                          .filter(Boolean);
                        const nextSelections = event.target.checked
                          ? Array.from(new Set([...selections, columnId])).sort()
                          : selections.filter((item) => item !== columnId);
                        const nextValue = { ...value };
                        if (nextSelections.length > 0) {
                          nextValue[rowId] = nextSelections.join(";");
                        } else {
                          delete nextValue[rowId];
                        }
                        onChange(nextValue);
                      }}
                    />
                  ) : (
                    <Radio
                      checked={isChecked}
                      onChange={() => onChange({ ...value, [rowId]: columnId })}
                    />
                  )}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function FormField({
  field,
  value,
  onChange,
}: {
  field: FormstrNormalizedField;
  value: BookingFormValue;
  onChange: (nextValue: BookingFormValue) => void;
}) {
  const renderElement = getRenderElement(field);
  const label = field.labelHtml;

  if (renderElement === "label") {
    return <Markdown remarkPlugins={[remarkGfm]}>{label}</Markdown>;
  }

  if (renderElement === "paragraph") {
    return (
      <TextField
        fullWidth
        multiline
        minRows={4}
        label={label}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        required={Boolean(field.config.required)}
      />
    );
  }

  if (renderElement === "number") {
    return (
      <TextField
        fullWidth
        type="number"
        label={label}
        value={value == null ? "" : String(value)}
        onChange={(event) => onChange(event.target.value)}
        required={Boolean(field.config.required)}
      />
    );
  }

  if (renderElement === "radioButton") {
    return (
      <FormControl required={Boolean(field.config.required)}>
        <FormLabel>{label}</FormLabel>
        <RadioGroup
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        >
          {field.options?.map((option) => (
            <FormControlLabel
              key={option.id}
              value={option.id}
              control={<Radio />}
              label={
                <Markdown remarkPlugins={[remarkGfm]}>
                  {option.labelHtml}
                </Markdown>
              }
            />
          ))}
        </RadioGroup>
      </FormControl>
    );
  }

  if (renderElement === "checkboxes") {
    const values = Array.isArray(value) ? value : [];
    return (
      <FormControl required={Boolean(field.config.required)}>
        <FormLabel>{label}</FormLabel>
        <FormGroup>
          {field.options?.map((option) => (
            <FormControlLabel
              key={option.id}
              control={
                <Checkbox
                  checked={values.includes(option.id)}
                  onChange={(event) => {
                    const nextValues = event.target.checked
                      ? Array.from(new Set([...values, option.id]))
                      : values.filter((item) => item !== option.id);
                    onChange(nextValues);
                  }}
                />
              }
              label={
                <Markdown remarkPlugins={[remarkGfm]}>
                  {option.labelHtml}
                </Markdown>
              }
            />
          ))}
        </FormGroup>
      </FormControl>
    );
  }

  if (renderElement === "dropdown") {
    return (
      <FormControl fullWidth required={Boolean(field.config.required)}>
        <FormLabel sx={{ mb: 1 }}>{label}</FormLabel>
        <Select
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(String(event.target.value))}
          displayEmpty
        >
          <MenuItem value="">
            <em>Select an option</em>
          </MenuItem>
          {field.options?.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              {option.labelHtml}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  if (renderElement === "date") {
    return (
      <TextField
        fullWidth
        type="date"
        label={label}
        InputLabelProps={{ shrink: true }}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        required={Boolean(field.config.required)}
      />
    );
  }

  if (renderElement === "time") {
    return (
      <TextField
        fullWidth
        type="time"
        label={label}
        InputLabelProps={{ shrink: true }}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        required={Boolean(field.config.required)}
      />
    );
  }

  if (renderElement === "datetime") {
    return (
      <TextField
        fullWidth
        type="datetime-local"
        label={label}
        InputLabelProps={{ shrink: true }}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        required={Boolean(field.config.required)}
      />
    );
  }

  if (
    renderElement === "multipleChoiceGrid" ||
    renderElement === "checkboxGrid"
  ) {
    return (
      <FormControl fullWidth required={Boolean(field.config.required)}>
        <FormLabel sx={{ mb: 1 }}>{label}</FormLabel>
        <GridField
          field={field}
          value={
            typeof value === "object" && value && !Array.isArray(value)
              ? (value as Record<string, string>)
              : {}
          }
          onChange={onChange as (nextValue: Record<string, string>) => void}
        />
      </FormControl>
    );
  }

  return (
    <TextField
      fullWidth
      label={label}
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value)}
      required={Boolean(field.config.required)}
    />
  );
}

export function BookingFormRenderer({
  attachedForm,
  onStateChange,
}: BookingFormRendererProps) {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormstrNormalizedForm | null>(null);
  const [values, setValues] = useState<Record<string, BookingFormValue>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setForm(null);
    setValues({});
    onStateChange({ loading: true, isComplete: false });

    loadAttachedFormDefinition(attachedForm)
      .then((nextForm) => {
        if (cancelled) return;

        const unsupportedFields = getUnsupportedFormFields(nextForm);
        if (unsupportedFields.length > 0) {
          setError(
            `This form contains unsupported field types: ${unsupportedFields
              .map((field) => field.config.renderElement || field.type)
              .join(", ")}`,
          );
          setLoading(false);
          return;
        }

        setForm(nextForm);
        setLoading(false);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "We could not load the attached form.",
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attachedForm, onStateChange]);

  const missingFieldLabel = useMemo(() => {
    if (!form) return null;
    return validateBookingFormValues(form, values);
  }, [form, values]);

  useEffect(() => {
    if (loading) {
      onStateChange({ loading: true, isComplete: false });
      return;
    }

    if (error) {
      onStateChange({ loading: false, isComplete: false, error });
      return;
    }

    if (!form) {
      onStateChange({
        loading: false,
        isComplete: false,
        error: "We could not load the attached form.",
      });
      return;
    }

    if (missingFieldLabel) {
      onStateChange({
        loading: false,
        isComplete: false,
        error: `Complete the required field: ${missingFieldLabel}`,
      });
      return;
    }

    onStateChange({
      loading: false,
      isComplete: true,
      snapshot: buildFormResponseSnapshot(form, values),
    });
  }, [error, form, loading, missingFieldLabel, onStateChange, values]);

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <CircularProgress size={18} />
          <Typography variant="body2">
            Loading attached form…
          </Typography>
        </Stack>
      </Paper>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    );
  }

  if (!form) {
    return null;
  }

  const blocks = form.blocks?.length
    ? form.blocks
    : [
        {
          type: "section" as const,
          id: "default",
          questionIds: form.fieldOrder,
          order: 0,
        },
      ];

  return (
    <Paper variant="outlined" sx={{ p: 2, backgroundColor: "background.default" }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle1">
            {getAttachedFormDisplayTitle(attachedForm)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Complete this form before requesting the booking.
          </Typography>
        </Box>

        {blocks.map((block) => {
          if (block.type === "intro") {
            return (
              <Box key="intro">
                {block.title ? (
                  <Typography variant="h6" sx={{ mb: 0.5 }}>
                    {block.title}
                  </Typography>
                ) : null}
                {block.description ? (
                  <Typography variant="body2" color="text.secondary">
                    <Markdown remarkPlugins={[remarkGfm]}>
                      {block.description}
                    </Markdown>
                  </Typography>
                ) : null}
              </Box>
            );
          }

          return (
            <Stack
              key={block.id}
              spacing={2}
              sx={{
                borderTop: "1px solid",
                borderColor: "divider",
                pt: 2,
              }}
            >
              {block.title ? (
                <Typography variant="subtitle2">{block.title}</Typography>
              ) : null}
              {block.description ? (
                <Typography variant="body2" color="text.secondary">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {block.description}
                  </Markdown>
                </Typography>
              ) : null}
              {block.questionIds.map((fieldId) => {
                const field = form.fields[fieldId];
                if (!field) return null;

                return (
                  <FormField
                    key={fieldId}
                    field={field}
                    value={values[fieldId] ?? null}
                    onChange={(nextValue) =>
                      setValues((current) => ({
                        ...current,
                        [fieldId]: nextValue,
                      }))
                    }
                  />
                );
              })}
            </Stack>
          );
        })}

        {missingFieldLabel ? (
          <Alert severity="info">
            Complete the required field: {missingFieldLabel}
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
}
