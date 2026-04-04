<script lang="ts">
  import {
    type SidebarItem,
    type SortMode,
    readSortMode,
    createComparator,
  } from '../../js/utils/sort';
  import DraftChip from '../DraftChip.svelte';
  import AdminSidebarSort from './AdminSidebarSort.svelte';
  import { navigate, adminPath } from '../../js/state/router.svelte';
  import { saveDraft } from '../../js/drafts/storage';
  import { refreshDrafts, disconnect } from '../../js/state/state.svelte';
  import ThemeToggle from '../ThemeToggle.svelte';

  export type { SidebarItem };

  // Props for the AdminSidebar component, which renders a filterable, sortable navigation list of collection items with a search input and optional sort popover.
  interface Props {
    // Heading text displayed at the top of the sidebar
    title: string;
    // Items to display in the sidebar list
    items: SidebarItem[];
    // href of the currently active item, highlighted with aria-current
    activeItem?: string;
    // Collection name for localStorage sort persistence (constructs key: cms-sort-{storageKey})
    storageKey?: string;
    // Whether items are currently loading
    loading?: boolean;
    // Error message to display instead of items
    error?: string;
    // Whether this collection has date fields, enabling sort controls
    hasDates?: boolean;
    // Collection name — used for the add button's navigation target
    collection?: string;
    // Whether to show the add button
    showAdd?: boolean;
    // Whether to show the logout footer at the bottom
    showFooter?: boolean;
  }

  let {
    title,
    items,
    activeItem,
    storageKey,
    loading = false,
    error,
    hasDates = false,
    collection,
    showAdd = false,
    showFooter = false,
  }: Props = $props();

  // Search query for filtering items by label
  let searchQuery = $state('');

  // Current sort mode — the $effect below sets the correct value reactively
  let sortMode = $state<SortMode>('alpha');

  // Re-read sort mode when storageKey changes (switching collections)
  $effect(() => {
    if (storageKey) {
      sortMode = readSortMode(storageKey);
    } else {
      sortMode = 'alpha';
    }
  });

  /**
   * Creates a new empty draft in IndexedDB and navigates to it.
   * @return {Promise<void>}
   */
  async function handleAdd(): Promise<void> {
    if (!collection) return;
    const id = crypto.randomUUID();
    await saveDraft({
      id,
      collection,
      filename: null,
      isNew: true,
      formData: {},
      body: '',
      snapshot: null,
      createdAt: new Date().toISOString(),
    });
    /*
     * Only refresh drafts — the live file list hasn't changed, so a full
     * collection reload (which re-reads all files from disk/GitHub) is wasteful.
     */
    await refreshDrafts(collection);
    navigate(adminPath(collection, `draft-${id}`));
  }

  /**
   * Handles the logout button click by disconnecting the backend.
   * @return {void}
   */
  function onLogout(): void {
    disconnect();
  }

  // Items filtered by search query and sorted by current mode
  const displayedItems = $derived.by(() => {
    const query = searchQuery.toLowerCase();
    const filtered = query
      ? items.filter((item) => item.label.toLowerCase().includes(query))
      : items;
    return [...filtered].sort(createComparator(sortMode));
  });
</script>

<nav class="sidebar" aria-label={title}>
  <div class="sidebar-header">
    <div class="sidebar-heading-row">
      <h2 class="sidebar-heading">{title}</h2>
      {#if showAdd}
        <button
          class="icon-btn add-btn"
          title="New {title.toLowerCase()}"
          onclick={handleAdd}
        >
          <span class="icon">add</span>
        </button>
      {/if}
    </div>

    <div class="toolbar" class:toolbar--search-only={!hasDates}>
      <input
        type="text"
        class="search-input"
        placeholder="Filter..."
        bind:value={searchQuery}
      />

      {#if hasDates}
        <AdminSidebarSort bind:sortMode {storageKey} />
      {/if}
    </div>
  </div>

  <div class="sidebar-items">
    {#if loading}
      <p class="status">Loading...</p>
    {:else if error}
      <p class="status status--error">{error}</p>
    {:else if displayedItems.length === 0}
      <p class="status">No items found.</p>
    {:else}
      <ul class="sidebar-list">
        {#each displayedItems as item}
          <li>
            <a
              href={item.href}
              class="sidebar-link"
              aria-current={activeItem === item.href ? 'page' : undefined}
            >
              <span class="item-label-row">
                <span class="item-label-text">{item.label}</span>
                {#if item.isDraft}
                  <DraftChip variant="draft" />
                {/if}
                {#if item.isOutdated}
                  <DraftChip variant="outdated" />
                {/if}
              </span>
              {#if item.subtitle}
                <span class="item-subtitle">{item.subtitle}</span>
              {/if}
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#if showFooter}
    <div class="sidebar-footer">
      <button class="logout-btn" onclick={onLogout}>
        <span class="icon">logout</span>
        <span>Log out</span>
      </button>
      <ThemeToggle />
    </div>
  {/if}
</nav>

<style>
  .sidebar {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100dvh;
    border-right: 1px solid var(--cms-border);
    position: sticky;
    top: 0;
  }

  .sidebar-header {
    padding: 1rem;
  }

  .sidebar-heading {
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--cms-muted);
    margin-bottom: 0;
  }

  .toolbar {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
    align-items: center;
  }

  .toolbar--search-only {
    grid-template-columns: 1fr;
  }

  .search-input {
    width: 100%;
    padding: 0.25rem 0.5rem;
    background: var(--cms-bg);
    border: 1px solid var(--cms-border);
    border-radius: 0.25rem;
    color: var(--cms-fg);
    font-size: 0.875rem;

    &::placeholder {
      color: var(--cms-muted);
    }
  }

  .sidebar-items {
    overflow-y: auto;
    padding: 0 0 1rem;
  }

  .status {
    color: var(--cms-muted);
    font-size: 0.875rem;
    padding: 0.5rem 0.75rem;
  }

  .status--error {
    color: var(--light-red);
  }

  .sidebar-list {
    display: grid;
  }

  .sidebar-link {
    display: block;
    padding: 0.5rem 1rem;
    color: var(--cms-fg);
    text-decoration: none;
    font-size: 1rem;
    /* Override global link box-shadow underline — sidebar items use background highlight instead */
    box-shadow: none;

    &:hover {
      background: var(--cms-border);
    }

    /*
     * Active highlight extends to sidebar edges with no border-radius.
     * Text is always white — --plum lacks sufficient contrast with
     * both --cms-fg values (light-on-pink and dark-on-pink both fail WCAG AA).
     */
    &[aria-current='page'] {
      background: var(--plum);
      color: #fff;

      .item-subtitle {
        color: #fff;
        opacity: 0.75;
      }
    }
  }

  .item-subtitle {
    display: block;
    font-size: 0.75rem;
    color: var(--cms-muted);
    margin-top: 0.25rem;
  }

  .sidebar-heading-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .add-btn .icon {
    font-size: 1rem;
  }

  /* Flex is appropriate here because chips need inline flow with wrapping */
  .item-label-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .item-label-text {
    /* Prevent long titles from pushing chips to a new line unnecessarily */
    min-width: 0;
  }

  .sidebar-footer {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    border-top: 1px solid var(--cms-border);
    padding: 0.75rem 1rem;
  }

  /* Flex is appropriate here for inline icon + text alignment */
  .logout-btn {
    background: none;
    border: none;
    color: var(--cms-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    padding: 0.25rem 0;

    &:hover {
      color: var(--cms-fg);
    }
  }
</style>
