<script lang="ts">
  import type { SchemaNode } from '../js/utils/schema-utils';
  import {
    getFieldsForTab,
    getProperties,
    getRequiredFields,
  } from '../js/utils/schema-utils';
  import { editor, updateFormField } from '../js/editor/editor.svelte';
  import SchemaField from './fields/SchemaField.svelte';

  /**
   * Props for the MetadataForm component, which renders the set of schema fields assigned to a given editor tab (or all fields when no tab is specified).
   */
  interface Props {
    // The JSON Schema for the collection
    schema: SchemaNode;
    // Tab name to filter by, or null for Metadata (all fields)
    tab?: string | null;
  }

  let { schema, tab = null }: Props = $props();

  // List of property names to render for this tab
  const fieldNames = $derived(getFieldsForTab(schema, tab));

  // Schema properties map
  const properties = $derived(getProperties(schema) ?? {});

  // Required field names
  const requiredFields = $derived(getRequiredFields(schema));
</script>

<div class="metadata-form">
  {#each fieldNames as fieldName}
    {@const fieldSchema = properties[fieldName]}
    {#if fieldSchema}
      <SchemaField
        name={fieldName}
        schema={fieldSchema}
        value={editor.data[fieldName]}
        required={requiredFields.includes(fieldName)}
        onchange={(v) => updateFormField([fieldName], v)}
      />
    {/if}
  {/each}
</div>

<style>
  .metadata-form {
    display: grid;
    gap: 1.25rem;
    padding: 1.5rem;
    max-width: 80ch;
    margin: 0 auto;
  }
</style>
