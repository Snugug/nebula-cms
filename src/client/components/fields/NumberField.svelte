<script lang="ts">
  import type { SchemaNode } from '../../js/utils/schema-utils';
  import { isReadOnly, isNullable } from '../../js/utils/schema-utils';
  import FieldWrapper from './FieldWrapper.svelte';

  /**
   * Props for the NumberField component, which renders a numeric input for a JSON Schema number or integer property.
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
    onchange: (value: number | null) => void;
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

  // Numeric value for the input, coerced from the value prop
  const inputValue = $derived(typeof value === 'number' ? value : '');

  // Min attribute: minimum takes precedence, exclusiveMinimum adds 1
  const min = $derived.by(() => {
    const minimum = schema['minimum'] as number | undefined;
    const exclusiveMin = schema['exclusiveMinimum'] as number | undefined;
    if (minimum != null) return minimum;
    if (exclusiveMin != null) return exclusiveMin + 1;
    return undefined;
  });

  // Max attribute: maximum takes precedence, exclusiveMaximum subtracts 1
  const max = $derived.by(() => {
    const maximum = schema['maximum'] as number | undefined;
    const exclusiveMax = schema['exclusiveMaximum'] as number | undefined;
    if (maximum != null) return maximum;
    if (exclusiveMax != null) return exclusiveMax - 1;
    return undefined;
  });

  // Step attribute from multipleOf
  const step = $derived(schema['multipleOf'] as number | undefined);

  // Whether field is read-only
  const readOnly = $derived(isReadOnly(schema));

  // Whether empty input should emit null (nullable anyOf-unwrapped types)
  const nullable = $derived(isNullable(schema));

  // Human-readable constraint summary (e.g. "min 0, max 100, step 5")
  const constraintText = $derived.by(() => {
    const parts: string[] = [];
    if (min != null) parts.push(`min ${min}`);
    if (max != null) parts.push(`max ${max}`);
    if (step != null) parts.push(`step ${step}`);
    return parts.length > 0 ? parts.join(', ') : undefined;
  });

  /**
   * Handles input change, emitting null for empty nullable fields or 0 for non-nullable.
   * @param {Event} e - The input event from the number input element
   * @return {void}
   */
  function handleChange(e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    if (raw === '') {
      onchange(nullable ? null : 0);
    } else {
      onchange(parseFloat(raw));
    }
  }
</script>

<FieldWrapper {name} {schema} {required} {constraintText} {inline}>
  <input
    type="number"
    id={name}
    class="field-input field-input--auto"
    value={inputValue}
    {min}
    {max}
    {step}
    readonly={readOnly}
    oninput={handleChange}
  />
</FieldWrapper>
