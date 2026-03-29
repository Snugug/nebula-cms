<script lang="ts">
  import {
    cycleTheme,
    getAriaChecked,
    getThemeIcon,
    getThemeLabel,
  } from '../js/state/theme.svelte';

  // Current aria-checked value reflecting the theme preference
  const ariaChecked = $derived(getAriaChecked());

  // Material Symbols icon name for the current preference
  const icon = $derived(getThemeIcon());

  // Human-readable label for the current preference
  const label = $derived(getThemeLabel());
</script>

<button
  class="theme-toggle"
  role="checkbox"
  aria-checked={ariaChecked}
  aria-label="Theme: {label}"
  onclick={cycleTheme}
>
  <span class="material-symbols-outlined">{icon}</span>
</button>

<style>
  .theme-toggle {
    background: none;
    border: none;
    color: var(--grey);
    cursor: pointer;
    display: grid;
    place-items: center;
    padding: 0;

    &:hover {
      color: var(--white);
    }

    .material-symbols-outlined {
      font-size: 1.25rem;
    }
  }
</style>
