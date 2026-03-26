<script lang="ts">
  import type { SchemaNode } from '../../js/utils/schema-utils';
  import { toTitleCase } from '../../js/utils/format';
  import SchemaField from './SchemaField.svelte';

  /**
   * Props for the ObjectField component, which renders a grouped fieldset of child SchemaField components for a JSON Schema object property.
   */
  interface Props {
    // Property name for labeling
    name: string;
    // JSON Schema node describing this object
    schema: SchemaNode;
    // Current object value
    value: unknown;
    // Whether this field is required
    required?: boolean;
    // Callback fired when the value changes
    onchange: (value: unknown) => void;
    // When true, renders fields without a fieldset wrapper (used inside ArrayItem).
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

  // Display label from schema title or property name
  const label = $derived(
    (schema['title'] as string | undefined) ?? toTitleCase(name),
  );

  // Properties map from the schema
  const properties = $derived(
    (schema['properties'] as Record<string, SchemaNode>) ?? {},
  );

  // Required field names within this object
  const requiredFields = $derived(
    Array.isArray(schema['required']) ? (schema['required'] as string[]) : [],
  );

  // Current object value, defaulting to empty object
  const objValue = $derived(
    (typeof value === 'object' && value !== null ? value : {}) as Record<
      string,
      unknown
    >,
  );

  /**
   * Updates a single property and dispatches the full updated object via onchange.
   * @param {string} key - The property key to update within the object
   * @param {unknown} newValue - The new value for the given property key
   * @return {void}
   */
  function handleFieldChange(key: string, newValue: unknown): void {
    onchange({ ...objValue, [key]: newValue });
  }
</script>

{#if inline}
  <!-- Inline mode: no fieldset wrapper, used inside ArrayItem -->
  <div class="object-field--inline">
    {#each Object.entries(properties) as [key, propSchema]}
      <SchemaField
        name={key}
        schema={propSchema}
        value={objValue[key]}
        required={requiredFields.includes(key)}
        onchange={(v) => handleFieldChange(key, v)}
      />
    {/each}
  </div>
{:else}
  <fieldset class="object-field">
    <legend class="object-field__legend">
      {label}
      {#if required}<span class="object-field__required">*</span>{/if}
    </legend>
    {#each Object.entries(properties) as [key, propSchema]}
      <SchemaField
        name={key}
        schema={propSchema}
        value={objValue[key]}
        required={requiredFields.includes(key)}
        onchange={(v) => handleFieldChange(key, v)}
      />
    {/each}
  </fieldset>
{/if}

<style>
  .object-field {
    border: 1px solid var(--dark-grey);
    border-radius: 4px;
    padding: 1rem;
    display: grid;
    gap: 1.25rem;
  }

  .object-field__legend {
    font-size: 0.875rem;
    color: var(--white);
    padding: 0 0.5rem;
  }

  .object-field__required {
    color: var(--light-plum);
    margin-left: 0.25rem;
  }

  /* Inline mode: no border/padding, just stack the fields */
  .object-field--inline {
    display: grid;
    gap: 1.25rem;
  }
</style>
