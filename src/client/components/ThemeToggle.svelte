<script lang="ts">
  /* Tri-state theme toggle that cycles through auto / light / dark preferences. */
  import { cycleTheme, theme } from '../js/state/theme.svelte';
</script>

<button
  class="theme-toggle"
  aria-label="Theme: {theme.label}"
  onclick={cycleTheme}
>
  <span class="material-symbols-outlined">{theme.icon}</span>
</button>

<style>
  .theme-toggle {
    background: none;
    border: none;
    color: var(--cms-muted);
    cursor: pointer;
    display: grid;
    place-items: center;
    padding: 0;

    &:hover {
      color: var(--cms-fg);
    }

    .material-symbols-outlined {
      font-size: 1.25rem;
    }
  }
</style>
