<script lang="ts">
  import type { SchemaNode } from '../../js/utils/schema-utils';
  import { getLabel } from '../../js/utils/schema-utils';
  import type { Snippet } from 'svelte';

  /**
   * Shared wrapper for all form field components. Provides the label, required marker, deprecated dimming, description, and constraint text so individual field components only supply the input element via a Svelte snippet.
   */
  interface Props {
    // Field name used as the input id and label fallback
    name: string;
    // JSON Schema node describing this field
    schema: SchemaNode;
    // Whether this field is required
    required?: boolean;
    // The input element rendered inside the wrapper
    children: Snippet;
    // Optional constraint text displayed after the description (e.g., "max 200", "min 0, max 100")
    constraintText?: string;
    // When true, hides the default label — used by BooleanField which renders its own inline checkbox+label
    hideLabel?: boolean;
    // When true, visually hides label and help text using sr-only for inline array contexts where the parent provides visible labels
    inline?: boolean;
  }

  let {
    name,
    schema,
    required = false,
    children,
    constraintText,
    hideLabel = false,
    inline = false,
  }: Props = $props();

  // Display label — schema.title if present, otherwise title-cased name
  const label = $derived(getLabel(schema, name));

  // Description from schema
  const description = $derived(schema['description'] as string | undefined);

  // Whether field is deprecated — dims the entire field
  const deprecated = $derived(!!(schema['deprecated'] as boolean | undefined));
</script>

<div
  class="field"
  class:field--deprecated={deprecated}
  class:field--inline={inline}
>
  {#if !hideLabel}
    <label class="field-label" for={name}>
      {label}{#if required}<span class="field-required" aria-hidden="true"
          >*</span
        >{/if}
    </label>
  {/if}

  {@render children()}

  {#if description || constraintText}
    <p class="field-help">
      {#if description}{description}{/if}
      {#if description && constraintText}&ensp;{/if}
      {#if constraintText}<span class="field-constraint">{constraintText}</span
        >{/if}
    </p>
  {/if}
</div>

<style>
  .field {
    display: grid;
    gap: 0.25rem;
  }

  /* Dimmed appearance for deprecated fields */
  .field--deprecated {
    opacity: 0.5;
  }

  /* Inline mode: visually hide label and help text while keeping them in the DOM for screen readers */
  .field--inline .field-label,
  .field--inline .field-help {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .field-label {
    font-size: 0.875rem;
    color: var(--cms-fg);
  }

  .field-required {
    color: var(--light-red);
    margin-left: 0.25rem;
  }

  .field-help {
    font-size: 0.75rem;
    color: var(--cms-muted);
  }

  .field-constraint {
    font-style: italic;
  }
</style>
