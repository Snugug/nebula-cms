<script lang="ts">
  import type { SchemaNode } from '../../js/utils/schema-utils';
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
  }

  let {
    name,
    schema,
    value,
    options,
    required = false,
    onchange,
  }: Props = $props();

  // String representation of the current value for select binding
  const selectedValue = $derived(value != null ? String(value) : '');

  // Whether field is read-only
  const readOnly = $derived(!!(schema['readOnly'] as boolean | undefined));

  // Whether empty selection should emit null (nullable anyOf-unwrapped types)
  const nullable = $derived(!!(schema['_nullable'] as boolean | undefined));

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

<FieldWrapper {name} {schema} {required}>
  <select
    id={name}
    class="field-select"
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

<style>
  .field-select {
    /* Restore native dropdown arrow stripped by CSS reset */
    appearance: auto;
    width: auto;
    background: var(--cms-surface, #2a2a2e);
    border: 1px solid var(--cms-border);
    border-radius: 4px;
    padding: 0.5rem 2rem 0.5rem 0.5rem;
    font-size: 1rem;
    color: var(--cms-fg);
    cursor: pointer;

    &:focus {
      outline: 2px solid var(--plum);
      outline-offset: -1px;
    }

    &:disabled {
      opacity: 0.6;
      cursor: default;
    }
  }
</style>
