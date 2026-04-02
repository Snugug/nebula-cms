<script lang="ts">
  import type { SchemaNode } from '../../js/utils/schema-utils';
  import { isReadOnly, isNullable } from '../../js/utils/schema-utils';
  import FieldWrapper from './FieldWrapper.svelte';

  /**
   * Props for the DateField component, which renders a date input for a JSON Schema string property with format "date-time".
   */
  interface Props {
    // Field name used as the input id and label fallback
    name: string;
    // JSON Schema node describing this field
    schema: SchemaNode;
    // Current field value — Date object or ISO string
    value: unknown;
    // Whether this field is required
    required?: boolean;
    // Callback fired when the value changes
    onchange: (value: string | null) => void;
    // When true, visually hides FieldWrapper chrome (label/help) for inline array contexts
    inline?: boolean;
  }

  let {
    name,
    schema,
    value,
    required = false,
    onchange,
    inline = false,
  }: Props = $props();

  /**
   * Converts a Date or ISO string to YYYY-MM-DD for the date input, or empty string if unset.
   * @param {unknown} val - The field value, which may be a Date object, ISO string, or unset
   * @return {string} A YYYY-MM-DD formatted string for the date input, or empty string
   */
  function toDateInputValue(val: unknown): string {
    if (val instanceof Date) {
      // Use UTC components to avoid timezone shifts converting to local date
      const y = val.getUTCFullYear();
      const m = String(val.getUTCMonth() + 1).padStart(2, '0');
      const d = String(val.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (typeof val === 'string' && val.length >= 10) {
      // Slice the YYYY-MM-DD portion from an ISO string (e.g. "2024-01-15T00:00:00Z")
      return val.slice(0, 10);
    }
    return '';
  }

  // YYYY-MM-DD string for the date input element
  const inputValue = $derived(toDateInputValue(value));

  // Whether field is read-only
  const readOnly = $derived(isReadOnly(schema));

  // Whether empty input should emit null (nullable anyOf-unwrapped types)
  const nullable = $derived(isNullable(schema));

  /**
   * Handles date input change, emitting null for empty nullable fields.
   * @param {Event} e - The input event from the date input element
   * @return {void}
   */
  function handleChange(e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    onchange(nullable && raw === '' ? null : raw);
  }
</script>

<FieldWrapper {name} {schema} {required} {inline}>
  <input
    type="date"
    id={name}
    class="field-input"
    value={inputValue}
    readonly={readOnly}
    oninput={handleChange}
  />
</FieldWrapper>

<style>
  .field-input {
    width: auto;
  }
</style>
