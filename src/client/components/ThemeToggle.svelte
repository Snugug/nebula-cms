<script lang="ts">
  /* Tri-state theme toggle that cycles through auto / light / dark preferences. */
  import { cycleTheme, theme } from '../js/state/theme.svelte';
</script>

<button
  class="icon-btn theme-toggle"
  aria-label="Theme: {theme.label}"
  onclick={cycleTheme}
>
  <span class="material-symbols-outlined">{theme.icon}</span>
</button>

<style>
  .theme-toggle .material-symbols-outlined {
    font-size: 1.25rem;
  }
</style>
