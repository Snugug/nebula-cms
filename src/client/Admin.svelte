<script lang="ts">
  import { onMount } from 'svelte';
  import { initRouter, getRoute } from './js/state/router.svelte';
  import {
    getCollections,
    isBackendReady,
    restoreBackend,
    loadCollection,
    getContentList,
    isLoading,
    getError,
    getDrafts,
    getOutdatedMap,
  } from './js/state/state.svelte';
  import {
    preloadFile,
    loadFileBody,
    clearEditor,
    getActiveTab,
    getEditorFile,
    loadDraftById,
    changeFileFormat,
    setDefaultFormat,
  } from './js/editor/editor.svelte';
  import {
    fetchSchema,
    getSchema,
    clearSchema,
    prefetchAllSchemas,
    collectionHasDates,
    getCollectionTitle,
    getCollectionDescription,
  } from './js/state/schema.svelte';
  import {
    handleSave,
    handlePublish,
    handleDeleteDraft,
    handleFilenameConfirm,
    computePublishDisabled,
    buildContentItems,
  } from './js/handlers/admin';
  import { stripExtension, getTypeForFilename } from './js/utils/file-types';
  import './css/icons.css';
  import BackendPicker from './components/BackendPicker.svelte';
  import AdminSidebar from './components/sidebar/AdminSidebar.svelte';
  import EditorToolbar from './components/editor/EditorToolbar.svelte';
  import EditorPane from './components/editor/EditorPane.svelte';
  import EditorTabs from './components/editor/EditorTabs.svelte';
  import FormatSelector from './components/editor/FormatSelector.svelte';
  import MetadataForm from './components/MetadataForm.svelte';
  import FilenameDialog from './components/dialogs/FilenameDialog.svelte';
  import DeleteDraftDialog from './components/dialogs/DeleteDraftDialog.svelte';

  // Whether the admin backend is ready to serve content
  const ready = $derived(isBackendReady());

  // The current route for tracking collection changes
  const currentRoute = $derived(getRoute());

  // Whether a collection is currently selected (including draft view)
  const hasCollection = $derived(currentRoute.view !== 'home');

  // The active collection name, if any
  const activeCollection = $derived(
    currentRoute.view !== 'home' ? currentRoute.collection : null,
  );

  // Whether a file or draft is currently open in the editor
  const fileOpen = $derived(
    currentRoute.view === 'file' || currentRoute.view === 'draft',
  );

  // Active editor tab from shared editor state
  const activeTab = $derived(getActiveTab());

  // The active file/draft href for highlighting in the content sidebar
  const activeFileHref = $derived(
    currentRoute.view === 'file'
      ? `/admin/${currentRoute.collection}/${currentRoute.slug}`
      : currentRoute.view === 'draft'
        ? `/admin/${currentRoute.collection}/draft-${currentRoute.draftId}`
        : undefined,
  );

  // Collection names mapped to SidebarItems, using schema title/description when available
  const collectionItems = $derived(
    getCollections().map((name) => ({
      label:
        getCollectionTitle(name) ??
        name.charAt(0).toUpperCase() + name.slice(1),
      href: `/admin/${name}`,
      subtitle: getCollectionDescription(name) ?? undefined,
    })),
  );

  // Content items merged with draft data (DRAFT/OUTDATED chips) plus new draft items
  const contentItems = $derived(
    buildContentItems(
      getContentList(),
      getDrafts(),
      getOutdatedMap(),
      activeCollection,
    ),
  );

  // Whether the active collection has date fields for sort controls
  const contentHasDates = $derived(
    activeCollection ? collectionHasDates(activeCollection) : false,
  );

  // Current JSON Schema for the active collection
  const currentSchema = $derived(getSchema());

  // Whether the publish button should be disabled (missing required fields)
  const publishDisabled = $derived(
    computePublishDisabled(currentSchema, getEditorFile()?.formData ?? {}),
  );

  // Existing filenames for uniqueness validation in the filename dialog — includes both live files and drafts with filenames
  const existingFilenames = $derived([
    ...getContentList().map((item) => item.filename),
    ...getDrafts()
      .filter((d) => d.filename)
      .map((d) => d.filename!),
  ]);

  // Type identifiers from the schema's files array, used to show the format selector
  const schemaFileTypes = $derived(
    Array.isArray(currentSchema?.['files'])
      ? (currentSchema['files'] as string[])
      : [],
  );

  // The type identifier of the currently open file (e.g. 'md', 'mdx')
  const activeFileType = $derived(
    getEditorFile()?.filename
      ? (getTypeForFilename(getEditorFile()!.filename) ??
          schemaFileTypes[0] ??
          '')
      : (schemaFileTypes[0] ?? ''),
  );

  // Dialog visibility state
  let showFilenameDialog = $state(false);
  let showDeleteDialog = $state(false);

  // Trigger collection loading when route changes to a collection, file, or draft view
  $effect(() => {
    if (ready && currentRoute.view !== 'home') {
      loadCollection(currentRoute.collection);
    }
  });

  // Loads content for the file or draft view. Both branches gate on `ready`
  // so they re-run when the directory handle is restored on page load.
  $effect(() => {
    const items = getContentList();
    if (ready && currentRoute.view === 'file' && items.length > 0) {
      const item = items.find(
        (i) => stripExtension(i.filename) === currentRoute.slug,
      );
      if (!item) return;

      // preloadFile is async — it checks IDB for a draft first
      preloadFile(currentRoute.collection, item.filename, item.data).then(
        () => {
          // If preloadFile loaded a draft (body already present), skip disk read
          const editorFile = getEditorFile();
          if (editorFile?.draftId) return;

          loadFileBody(currentRoute.collection, item.filename);
        },
      );
    } else if (ready && currentRoute.view === 'draft') {
      loadDraftById(currentRoute.draftId, currentRoute.collection);
    } else if (currentRoute.view !== 'file' && currentRoute.view !== 'draft') {
      clearEditor();
    }
  });

  // Set the default format for new drafts once the schema is available.
  // New drafts start with an empty filename, so setDefaultFormat assigns
  // the collection's first file type extension (e.g. '.mdx' for guides).
  $effect(() => {
    const file = getEditorFile();
    if (file?.isNewDraft && !file.filename && schemaFileTypes.length > 0) {
      setDefaultFormat(schemaFileTypes);
    }
  });

  // Fetch the JSON Schema when the active collection changes
  $effect(() => {
    if (ready && currentRoute.view !== 'home') {
      fetchSchema(currentRoute.collection);
    } else {
      clearSchema();
    }
  });

  /**
   * Handles the publish button click, showing the filename dialog if needed.
   * @return {Promise<void>}
   */
  async function onPublish(): Promise<void> {
    const result = await handlePublish(activeCollection);
    if (result.status === 'needs-filename') {
      showFilenameDialog = true;
    }
  }

  /**
   * Handles filename dialog confirmation.
   * @param {string} filename - The chosen filename
   * @return {Promise<void>}
   */
  async function onFilenameConfirm(filename: string): Promise<void> {
    showFilenameDialog = false;
    await handleFilenameConfirm(filename, activeCollection);
  }

  /**
   * Handles delete draft confirmation.
   * @return {Promise<void>}
   */
  async function onDeleteConfirm(): Promise<void> {
    showDeleteDialog = false;
    await handleDeleteDraft(activeCollection);
  }

  onMount(() => {
    initRouter();
    restoreBackend();
    prefetchAllSchemas();
  });
</script>

<div
  class="admin"
  class:admin--connected={ready}
  class:admin--collection={ready && hasCollection}
  class:admin--file-open={ready && fileOpen}
>
  {#if !ready}
    <BackendPicker />
  {:else}
    <AdminSidebar
      title="Collections"
      items={collectionItems}
      activeItem={activeCollection ? `/admin/${activeCollection}` : undefined}
      showFooter={true}
    />
    {#if hasCollection && activeCollection}
      <AdminSidebar
        title={getCollectionTitle(activeCollection) ??
          activeCollection.charAt(0).toUpperCase() + activeCollection.slice(1)}
        items={contentItems}
        activeItem={activeFileHref}
        storageKey={activeCollection}
        loading={isLoading()}
        error={getError() ?? undefined}
        hasDates={contentHasDates}
        collection={activeCollection}
        showAdd={true}
      />
    {/if}
    {#if fileOpen}
      <div class="editor-area">
        <EditorToolbar
          onSave={() => handleSave(activeCollection)}
          {onPublish}
          onDelete={() => {
            showDeleteDialog = true;
          }}
          {publishDisabled}
        />
        <EditorTabs schema={currentSchema} />
        <FormatSelector
          fileTypes={schemaFileTypes}
          activeType={activeFileType}
          onChange={changeFileFormat}
        />
        <div class="editor-content">
          {#if activeTab === 'body'}
            <EditorPane />
          {:else if currentSchema}
            <MetadataForm
              schema={currentSchema}
              tab={activeTab === 'metadata' ? null : activeTab}
            />
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

{#if showFilenameDialog}
  {@const file = getEditorFile()}
  <FilenameDialog
    title={typeof file?.formData.title === 'string' ? file.formData.title : ''}
    {existingFilenames}
    onConfirm={onFilenameConfirm}
    onCancel={() => {
      showFilenameDialog = false;
    }}
  />
{/if}

{#if showDeleteDialog}
  <DeleteDraftDialog
    onConfirm={onDeleteConfirm}
    onCancel={() => {
      showDeleteDialog = false;
    }}
  />
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
    /* FormatSelector is conditionally rendered between tabs and content; grid-template-rows uses auto for all header rows and 1fr for the scrollable content area */
    grid-template-rows: auto auto auto 1fr;
    overflow: hidden;
    border-left: 1px solid var(--dark-grey);
  }

  /* Scrollable content area; min-height: 0 allows the 1fr grid row to shrink */
  .editor-content {
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
  }
</style>
