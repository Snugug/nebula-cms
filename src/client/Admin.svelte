<script lang="ts">
  import { onMount } from 'svelte';
  import { initRouter, nav, adminPath } from './js/state/router.svelte';
  import {
    backend,
    content,
    drafts,
    restoreBackend,
    loadCollection,
  } from './js/state/state.svelte';
  import {
    preloadFile,
    loadFileBody,
    clearEditor,
    editor,
    getEditorFile,
    loadDraftById,
    setDefaultFormat,
  } from './js/editor/editor.svelte';
  import {
    fetchSchema,
    schema,
    clearSchema,
    prefetchAllSchemas,
    collectionHasDates,
    getCollectionTitle,
  } from './js/state/schema.svelte';
  import {
    handleDeleteDraft,
    handleFilenameConfirm,
    buildContentItems,
    buildCollectionItems,
    buildActiveFileHref,
  } from './js/handlers/admin';
  import { dialog } from './js/state/dialogs.svelte';
  import { stripExtension } from './js/utils/file-types';
  import { initTheme, theme } from './js/state/theme.svelte';
  import './css/reset.css';
  import './css/icons.css';
  import './css/theme.css';
  import './css/btn.css';
  import './css/field-input.css';
  import './css/dialog.css';
  import './css/a11y.css';
  import BackendPicker from './components/BackendPicker.svelte';
  import AdminSidebar from './components/sidebar/AdminSidebar.svelte';
  import EditorToolbar from './components/editor/EditorToolbar.svelte';
  import EditorPane from './components/editor/EditorPane.svelte';
  import EditorTabs from './components/editor/EditorTabs.svelte';
  import MetadataForm from './components/MetadataForm.svelte';
  import FilenameDialog from './components/dialogs/FilenameDialog.svelte';
  import DeleteDraftDialog from './components/dialogs/DeleteDraftDialog.svelte';

  // Host application config — basePath controls the URL prefix for all admin routes
  interface Props {
    config?: {
      basePath?: string;
    };
  }
  let { config }: Props = $props();

  // Whether a collection is currently selected (including draft view)
  const hasCollection = $derived(nav.route.view !== 'home');

  // The active collection name, if any
  const activeCollection = $derived(
    nav.route.view !== 'home' ? nav.route.collection : null,
  );

  // Whether a file or draft is currently open in the editor
  const fileOpen = $derived(
    nav.route.view === 'file' || nav.route.view === 'draft',
  );

  // The active file/draft href for highlighting in the content sidebar
  const activeFileHref = $derived(buildActiveFileHref(nav.route));

  // Collection names mapped to SidebarItems, using schema title/description when available
  const collectionItems = $derived(buildCollectionItems());

  // Content items merged with draft data (DRAFT/OUTDATED chips) plus new draft items
  const contentItems = $derived(
    buildContentItems(
      content.list,
      drafts.all,
      drafts.outdated,
      activeCollection,
    ),
  );

  // Whether the active collection has date fields for sort controls
  const contentHasDates = $derived(
    activeCollection ? collectionHasDates(activeCollection) : false,
  );

  // Existing filenames for uniqueness validation in the filename dialog — includes both live files and drafts with filenames
  const existingFilenames = $derived([
    ...content.list.map((item) => item.filename),
    ...drafts.all.filter((d) => d.filename).map((d) => d.filename!),
  ]);

  // Type identifiers from the schema's files array, used to show the format selector
  const schemaFileTypes = $derived(
    Array.isArray(schema.active?.['files'])
      ? (schema.active['files'] as string[])
      : [],
  );

  // Sync the resolved theme to :root so top-layer elements (dialogs) inherit the tokens
  $effect(() => {
    document.documentElement.dataset.theme = theme.resolved;
  });

  // Trigger collection loading when route changes to a collection, file, or draft view
  $effect(() => {
    if (backend.ready && nav.route.view !== 'home') {
      loadCollection(nav.route.collection);
    }
  });

  /*
   * Loads content for the file or draft view. Both branches gate on `backend.ready`
   * so they re-run when the directory handle is restored on page load.
   */
  $effect(() => {
    if (backend.ready && nav.route.view === 'file' && content.list.length > 0) {
      const item = content.list.find(
        (i) => stripExtension(i.filename) === nav.route.slug,
      );
      if (!item) return;

      // preloadFile is async — it checks IDB for a draft first
      preloadFile(nav.route.collection, item.filename, item.data).then(() => {
        // If preloadFile loaded a draft (body already present), skip disk read
        const editorFile = getEditorFile();
        if (editorFile?.draftId) return;

        loadFileBody(nav.route.collection, item.filename);
      });
    } else if (backend.ready && nav.route.view === 'draft') {
      loadDraftById(nav.route.draftId, nav.route.collection);
    } else if (nav.route.view !== 'file' && nav.route.view !== 'draft') {
      clearEditor();
    }
  });

  /*
   * Set the default format for new drafts once the schema is available.
   * New drafts start with an empty filename, so setDefaultFormat assigns
   * the collection's first file type extension (e.g. '.mdx' for guides).
   */
  $effect(() => {
    const file = getEditorFile();
    if (file?.isNewDraft && !file.filename && schemaFileTypes.length > 0) {
      setDefaultFormat(schemaFileTypes);
    }
  });

  // Fetch the JSON Schema when the active collection changes
  $effect(() => {
    if (backend.ready && nav.route.view !== 'home') {
      fetchSchema(nav.route.collection);
    } else {
      clearSchema();
    }
  });

  /**
   * Handles filename dialog confirmation — hides the dialog and triggers publish with the chosen filename.
   * @param {string} filename - The chosen filename
   * @return {Promise<void>}
   */
  async function onFilenameConfirm(filename: string): Promise<void> {
    dialog.close();
    await handleFilenameConfirm(filename, activeCollection);
  }

  /**
   * Handles delete draft confirmation — hides the dialog and deletes the current draft.
   * @return {Promise<void>}
   */
  async function onDeleteConfirm(): Promise<void> {
    dialog.close();
    await handleDeleteDraft(activeCollection);
  }

  onMount(() => {
    const cleanupTheme = initTheme();
    initRouter(config?.basePath);
    restoreBackend();
    prefetchAllSchemas();
    return cleanupTheme;
  });
</script>

<div
  class="admin"
  class:admin--connected={backend.ready}
  class:admin--collection={backend.ready && hasCollection}
  class:admin--file-open={backend.ready && fileOpen}
>
  {#if !backend.ready}
    <BackendPicker />
  {:else}
    <AdminSidebar
      title="Collections"
      items={collectionItems}
      activeItem={activeCollection ? adminPath(activeCollection) : undefined}
      showFooter={true}
    />
    {#if hasCollection && activeCollection}
      <AdminSidebar
        title={getCollectionTitle(activeCollection) ??
          activeCollection.charAt(0).toUpperCase() + activeCollection.slice(1)}
        items={contentItems}
        activeItem={activeFileHref}
        storageKey={activeCollection}
        loading={content.loading}
        error={content.error ?? undefined}
        hasDates={contentHasDates}
        collection={activeCollection}
        showAdd={true}
      />
    {/if}
    {#if fileOpen}
      <div class="editor-area">
        <EditorToolbar />
        <EditorTabs schema={schema.active} />
        <div class="editor-content">
          {#if editor.tab === 'body'}
            <EditorPane />
          {:else if schema.active}
            <MetadataForm
              schema={schema.active}
              tab={editor.tab === 'metadata' ? null : editor.tab}
            />
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

{#if dialog.active === 'filename'}
  {@const file = getEditorFile()}
  <FilenameDialog
    title={typeof file?.formData.title === 'string' ? file.formData.title : ''}
    {existingFilenames}
    onConfirm={onFilenameConfirm}
    onCancel={dialog.close}
  />
{/if}

{#if dialog.active === 'delete'}
  <DeleteDraftDialog onConfirm={onDeleteConfirm} onCancel={dialog.close} />
{/if}

<style>
  .admin {
    /* Lock to viewport height so the page never scrolls — all scrolling happens inside editor-content or sidebars */
    height: 100dvh;
  }

  .admin--connected {
    display: grid;
    grid-template-columns: 15rem 1fr;
  }

  .admin--collection {
    grid-template-columns: 15rem 15rem 1fr;
  }

  .admin--file-open {
    grid-template-columns: 15rem 15rem 1fr;
  }

  .editor-area {
    display: grid;
    /* Toolbar + tabs above, scrollable content below */
    grid-template-rows: auto auto 1fr;
    overflow: hidden;
    border-left: 1px solid var(--cms-border);
  }

  /* Scrollable content area; min-height: 0 allows the 1fr grid row to shrink */
  .editor-content {
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
  }
</style>
