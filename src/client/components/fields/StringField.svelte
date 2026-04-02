<script lang="ts">
  import type { SchemaNode } from '../../js/utils/schema-utils';
  import { isReadOnly, isNullable } from '../../js/utils/schema-utils';
  import FieldWrapper from './FieldWrapper.svelte';

  /**
   * Props for the StringField component, which renders a text input or textarea for a JSON Schema string property.
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

  // Current string value for the input
  const inputValue = $derived(typeof value === 'string' ? value : '');

  // Max length constraint from schema, if any
  const maxLength = $derived(schema['maxLength'] as number | undefined);

  // Pattern constraint from schema, if any
  const pattern = $derived(schema['pattern'] as string | undefined);

  // Whether field is read-only
  const readOnly = $derived(isReadOnly(schema));

  // Whether empty input should emit null (nullable anyOf-unwrapped types)
  const nullable = $derived(isNullable(schema));

  // Whether to render as a textarea (widget: "textarea" in schema meta)
  const isTextarea = $derived(schema['widget'] === 'textarea');

  // Constraint text for the help line
  const constraintText = $derived(
    maxLength != null ? `max ${maxLength}` : undefined,
  );

  /**
   * Handles input change, emitting null for empty nullable fields.
   * @param {Event} e - The input or change event from the text input or textarea
   * @return {void}
   */
  function handleChange(e: Event): void {
    const raw = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
    onchange(nullable && raw === '' ? null : raw);
  }
</script>

<FieldWrapper {name} {schema} {required} {constraintText} compact={inline}>
  {#if isTextarea}
    <textarea
      id={name}
      class="field-input field-input--textarea"
      maxlength={maxLength}
      readonly={readOnly}
      rows={3}
      oninput={handleChange}>{inputValue}</textarea
    >
  {:else}
    <input
      type="text"
      id={name}
      class="field-input field-input--text"
      value={inputValue}
      maxlength={maxLength}
      {pattern}
      readonly={readOnly}
      oninput={handleChange}
    />
  {/if}
</FieldWrapper>

<style>
  .field-input--text {
    width: 100%;
  }

  /* Auto-grows with content; rows="3" sets minimum height */
  .field-input--textarea {
    width: 100%;
    field-sizing: content;
    resize: none;
    font-family: inherit;
    line-height: 1.5;
  }
</style>
