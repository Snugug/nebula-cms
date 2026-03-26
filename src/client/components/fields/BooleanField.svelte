<script lang="ts">
  import type { SchemaNode } from '../../js/utils/schema-utils';
  import { toTitleCase } from '../../js/utils/format';
  import FieldWrapper from './FieldWrapper.svelte';

  /**
   * Props for the BooleanField component, which renders a labeled checkbox for a JSON Schema boolean property.
   */
  interface Props {
    // Field name used as the input id and label fallback
    name: string;
    // JSON Schema node describing this field
    schema: SchemaNode;
    // Current field value
    value: unknown;
    // Whether this field is required
    required?: boolean;
    // Callback fired when the value changes
    onchange: (value: boolean | null) => void;
  }

  let { name, schema, value, required = false, onchange }: Props = $props();

  // Display label — schema.title if present, otherwise title-cased name
  const label = $derived(
    (schema['title'] as string | undefined) ?? toTitleCase(name),
  );

  // Checked state for the checkbox
  const checked = $derived(typeof value === 'boolean' ? value : false);

  // Whether field is read-only
  const readOnly = $derived(!!(schema['readOnly'] as boolean | undefined));

  // Whether empty input should emit null (nullable anyOf-unwrapped types)
  const nullable = $derived(!!(schema['_nullable'] as boolean | undefined));

  /**
   * Handles checkbox change. Preserves null for nullable fields only while the value is already null and unchecked.
   * @param {Event} e - The change event from the checkbox input element
   * @return {void}
   */
  function handleChange(e: Event): void {
    const isChecked = (e.target as HTMLInputElement).checked;
    onchange(nullable && value === null && !isChecked ? null : isChecked);
  }
</script>

<FieldWrapper {name} {schema} {required} hideLabel={true}>
  <label class="field-label-wrap" for={name}>
    <input
      type="checkbox"
      id={name}
      class="field-checkbox"
      {checked}
      disabled={readOnly}
      onchange={handleChange}
    />
    <span class="field-label-text">
      {label}{#if required}<span class="field-required" aria-hidden="true"
          >*</span
        >{/if}
    </span>
  </label>
</FieldWrapper>

<style>
  /* Label wraps checkbox + text in a flex row — no separate label above */
  .field-label-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    width: fit-content;
  }

  .field-checkbox {
    width: 1rem;
    height: 1rem;
    accent-color: var(--plum);
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

  .field-label-text {
    font-size: 0.875rem;
    color: var(--white);
  }

  .field-required {
    color: var(--light-red);
    margin-left: 0.25rem;
  }
</style>
