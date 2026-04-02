<script lang="ts">
  import type { SchemaNode } from '../../js/utils/schema-utils';
  import { isReadOnly, isNullable } from '../../js/utils/schema-utils';
  import FieldWrapper from './FieldWrapper.svelte';

  /**
   * Props for the EnumField component, which renders a select dropdown for a JSON Schema enum property.
   */
  interface Props {
    // Field name used as the select id and label fallback
    name: string;
    // JSON Schema node describing this field
    schema: SchemaNode;
    // Current field value
    value: unknown;
    // The enum values to render as options
    options: unknown[];
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
    options,
    required = false,
    onchange,
    inline = false,
  }: Props = $props();

  // String representation of the current value for select binding
  const selectedValue = $derived(value != null ? String(value) : '');

  // Whether field is read-only
  const readOnly = $derived(isReadOnly(schema));

  // Whether empty selection should emit null (nullable anyOf-unwrapped types)
  const nullable = $derived(isNullable(schema));

  // Whether to show the empty placeholder option — when not required or no value is set
  const showEmptyOption = $derived(!required || value == null);

  /**
   * Handles select change, emitting null when empty option is selected on nullable fields.
   * @param {Event} e - The change event from the select element
   * @return {void}
   */
  function handleChange(e: Event): void {
    const raw = (e.target as HTMLSelectElement).value;
    onchange(raw === '' ? (nullable ? null : '') : raw);
  }
</script>

<FieldWrapper {name} {schema} {required} {inline}>
  <select
    id={name}
    class="field-input field-input--select"
    value={selectedValue}
    disabled={readOnly}
    onchange={handleChange}
  >
    {#if showEmptyOption}
      <option value="">—</option>
    {/if}
    {#each options as option}
      <option value={String(option)}>{String(option)}</option>
    {/each}
  </select>
</FieldWrapper>
