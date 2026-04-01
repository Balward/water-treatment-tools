(() => {
  const equipmentContainer = document.getElementById('equipmentContainer');
  const groupTemplate = document.getElementById('groupTemplate');
  const equipmentTemplate = document.getElementById('equipmentTemplate');
  const commentTemplate = document.getElementById('commentTemplate');
  const syncStatus = document.getElementById('syncStatus');
  const lastUpdated = document.getElementById('lastUpdated');
  const equipmentDrawer = document.getElementById('equipmentDrawer');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const drawerClose = document.getElementById('drawerClose');
  const drawerGroup = document.getElementById('drawerGroup');
  const drawerTitle = document.getElementById('drawerTitle');
  const statusOptions = document.getElementById('statusOptions');
  const filterMaintenanceSection = document.getElementById('filterMaintenanceSection');
  const swMaintenanceOptions = document.getElementById('swMaintenanceOptions');
  const swYearRow = document.getElementById('swYearRow');
  const swYearSelect = document.getElementById('swYearSelect');
  const drawerNotes = document.getElementById('drawerNotes');
  const clearNotesButton = document.getElementById('clearNotesButton');
  const saveSidebarButton = document.getElementById('saveSidebarButton');
  const drawerMeta = document.getElementById('drawerMeta');
  const assetLogList = document.getElementById('assetLogList');
  const hoverPopup = document.getElementById('hoverPopup');
  const hoverPopupTitle = document.getElementById('hoverPopupTitle');
  const hoverPopupSw = document.getElementById('hoverPopupSw');
  const hoverPopupNote = document.getElementById('hoverPopupNote');
  const hoverPopupMeta = document.getElementById('hoverPopupMeta');
  const generalCommentsForm = document.getElementById('generalCommentsForm');
  const generalCommentInput = document.getElementById('generalCommentInput');
  const generalCommentsMode = document.getElementById('generalCommentsMode');
  const submitCommentButton = document.getElementById('submitCommentButton');
  const cancelCommentEditButton = document.getElementById('cancelCommentEditButton');
  const generalCommentsList = document.getElementById('generalCommentsList');
  const openCommentDrawerButton = document.getElementById('openCommentDrawerButton');
  const commentDrawer = document.getElementById('commentDrawer');
  const commentDrawerBackdrop = document.getElementById('commentDrawerBackdrop');
  const commentDrawerClose = document.getElementById('commentDrawerClose');
  const commentDrawerTitle = document.getElementById('commentDrawerTitle');

  const isLocalDev = window.location.hostname === 'localhost' && window.location.port === '8080';
  const API_BASE = isLocalDev ? 'http://localhost:3001/api/live-ops' : '/api/live-ops';
  const operatorNameStorageKey = 'live-ops-operator-name';
  const displayMode = new URLSearchParams(window.location.search).get('mode');
  const statusOptionsList = [
    { value: 'operational', label: 'Online' },
    { value: 'warning', label: 'Warning' },
    { value: 'offline', label: 'Offline' },
    { value: 'out-of-service', label: 'Out of Service' },
    { value: 'maintenance', label: 'Maintenance Ongoing' },
  ];
  const swMaintenanceOptionsList = [
    { value: 'incomplete', label: 'Incomplete' },
    { value: 'complete', label: 'Complete' },
  ];

  let liveState = null;
  let selectedEquipmentId = null;
  let pendingSidebarChanges = {};
  let drawerOriginalEquipment = null;
  let popupCardId = null;
  let editingCommentId = null;

  function promptForOperatorName() {
    const savedName = localStorage.getItem(operatorNameStorageKey) || '';
    const enteredName = window.prompt('Save change as (name):', savedName);
    if (enteredName === null) {
      return null;
    }
    const cleaned = enteredName.trim();
    if (!cleaned) {
      return null;
    }
    localStorage.setItem(operatorNameStorageKey, cleaned);
    return cleaned;
  }

  function setSaveButtonState() {
    if (!saveSidebarButton) {
      return;
    }
    const hasPendingChanges = Boolean(selectedEquipmentId) && Object.keys(pendingSidebarChanges).length > 0;
    saveSidebarButton.disabled = !hasPendingChanges;
  }

  function setPendingChanges(changes) {
    if (!selectedEquipmentId) {
      return;
    }
    pendingSidebarChanges = {
      ...pendingSidebarChanges,
      ...changes,
    };
    setSaveButtonState();
  }

  function hasPendingSidebarChanges() {
    return Boolean(selectedEquipmentId) && Object.keys(pendingSidebarChanges).length > 0;
  }

  function confirmDiscardPendingChanges() {
    if (!hasPendingSidebarChanges()) {
      return true;
    }
    return window.confirm('You have unsaved sidebar edits. Discard them?');
  }

  function formatTimestamp(isoValue) {
    if (!isoValue) {
      return '--';
    }
    const date = new Date(isoValue);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  function normalizeStatus(statusValue, inService) {
    const normalized = typeof statusValue === 'string' ? statusValue.trim().toLowerCase() : '';
    if (normalized === 'out of service') {
      return 'out-of-service';
    }
    if (statusOptionsList.some((statusOption) => statusOption.value === normalized)) {
      return normalized;
    }
    return inService ? 'operational' : 'out-of-service';
  }

  function isInServiceStatus(statusValue) {
    return statusValue === 'operational' || statusValue === 'warning';
  }

  function getStatusLabel(statusValue) {
    const match = statusOptionsList.find((statusOption) => statusOption.value === statusValue);
    return match ? match.label : 'Out of Service';
  }

  function getStatusEmoji(statusValue) {
    switch (statusValue) {
      case 'operational':
        return '🟢';
      case 'warning':
        return '⚠️';
      case 'offline':
        return '⚫';
      case 'out-of-service':
        return '🔴';
      case 'maintenance':
        return '🛠️';
      default:
        return '';
    }
  }

  function normalizeState(stateValue) {
    if (!stateValue || !Array.isArray(stateValue.equipment)) {
      return stateValue;
    }
    return {
      ...stateValue,
      comments: Array.isArray(stateValue.comments)
        ? stateValue.comments
          .map((comment) => ({
            id: typeof comment.id === 'string' ? comment.id : '',
            message: typeof comment.message === 'string' ? comment.message.trim() : '',
            author: typeof comment.author === 'string' && comment.author.trim() ? comment.author.trim() : 'operator',
            updatedAt: typeof comment.updatedAt === 'string' ? comment.updatedAt : null,
          }))
          .filter((comment) => comment.id && comment.message)
        : [],
      equipment: stateValue.equipment.map((equipment) => {
        const normalizedStatus = normalizeStatus(equipment.status, equipment.inService);
        return {
          ...equipment,
          status: normalizedStatus,
          inService: isInServiceStatus(normalizedStatus),
          swMaintenanceComplete: equipment.swMaintenanceComplete === true,
          swMaintenanceYear: Number.isInteger(equipment.swMaintenanceYear) ? equipment.swMaintenanceYear : null,
          changeLog: Array.isArray(equipment.changeLog)
            ? equipment.changeLog
              .map((entry) => {
                const timestamp = typeof entry?.timestamp === 'string' ? entry.timestamp : null;
                const updatedBy = typeof entry?.updatedBy === 'string' && entry.updatedBy.trim()
                  ? entry.updatedBy.trim()
                  : 'operator';
                const changes = Array.isArray(entry?.changes)
                  ? entry.changes
                    .map((change) => {
                      const field = typeof change?.field === 'string' ? change.field.trim() : '';
                      const label = typeof change?.label === 'string' ? change.label.trim() : '';
                      const from = typeof change?.from === 'string' ? change.from : '';
                      const to = typeof change?.to === 'string' ? change.to : '';
                      if (!field || !label) {
                        return null;
                      }
                      return { field, label, from, to };
                    })
                    .filter(Boolean)
                  : [];

                if (!timestamp || !changes.length) {
                  return null;
                }

                return { timestamp, updatedBy, changes };
              })
              .filter(Boolean)
            : [],
        };
      }),
    };
  }

  function setConnectivity(isConnected) {
    const label = isConnected ? 'Live sync on' : 'Reconnecting';
    syncStatus.classList.toggle('sync-dot--online', isConnected);
    syncStatus.classList.toggle('sync-dot--offline', !isConnected);
    syncStatus.setAttribute('aria-label', label);
    syncStatus.title = label;
  }

  function updateLastUpdated() {
    lastUpdated.textContent = `Last updated: ${formatTimestamp(liveState?.updatedAt)}`;
  }

  function groupEquipment(equipment) {
    const grouped = [];
    const byGroup = new Map();

    for (const item of equipment) {
      if (!byGroup.has(item.groupKey)) {
        const group = {
          key: item.groupKey,
          label: item.groupLabel,
          equipment: [],
        };
        byGroup.set(item.groupKey, group);
        grouped.push(group);
      }
      byGroup.get(item.groupKey).equipment.push(item);
    }

    return grouped;
  }

  function setCommentFormState() {
    if (!submitCommentButton || !generalCommentInput || !generalCommentsMode || !commentDrawerTitle) {
      return;
    }
    const hasMessage = Boolean(generalCommentInput.value.trim());
    submitCommentButton.disabled = !hasMessage;
    submitCommentButton.textContent = editingCommentId ? 'Save comment' : 'Post comment';
    commentDrawerTitle.textContent = editingCommentId ? 'Edit Comment' : 'Add Comment';
    generalCommentsMode.textContent = editingCommentId
      ? 'Editing existing comment'
      : 'Posting as a new comment';
  }

  function resetCommentEditor() {
    editingCommentId = null;
    if (generalCommentsForm) {
      generalCommentsForm.reset();
    }
    setCommentFormState();
  }

  function openCommentDrawer(comment = null) {
    if (!commentDrawer || !commentDrawerBackdrop || !generalCommentInput) {
      return;
    }

    if (equipmentDrawer.classList.contains('is-open')) {
      const closed = closeDrawer();
      if (!closed) {
        return;
      }
    }

    editingCommentId = comment?.id || null;
    generalCommentInput.value = comment?.message || '';
    setCommentFormState();
    commentDrawer.classList.add('is-open');
    commentDrawer.setAttribute('aria-hidden', 'false');
    commentDrawerBackdrop.hidden = false;
    document.body.classList.add('drawer-open');
    generalCommentInput.focus();
    generalCommentInput.setSelectionRange(generalCommentInput.value.length, generalCommentInput.value.length);
  }

  function closeCommentDrawer() {
    if (!commentDrawer || !commentDrawerBackdrop) {
      return false;
    }
    resetCommentEditor();
    commentDrawer.classList.remove('is-open');
    commentDrawer.setAttribute('aria-hidden', 'true');
    commentDrawerBackdrop.hidden = true;
    if (!equipmentDrawer.classList.contains('is-open')) {
      document.body.classList.remove('drawer-open');
    }
    return true;
  }

  function findEquipment(id) {
    return liveState?.equipment.find((item) => item.id === id);
  }

  function cloneEquipmentSnapshot(equipment) {
    if (!equipment) {
      return null;
    }
    return {
      ...equipment,
    };
  }

  function buildCommentCard(comment) {
    const card = commentTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.commentId = comment.id;
    card.querySelector('.comment-card-author').textContent = comment.author || 'operator';
    card.querySelector('.comment-card-date').textContent = formatTimestamp(comment.updatedAt);
    card.querySelector('.comment-card-message').textContent = comment.message;
    return card;
  }

  function renderComments() {
    if (!generalCommentsList) {
      return;
    }

    const comments = Array.isArray(liveState?.comments) ? liveState.comments : [];
    generalCommentsList.innerHTML = '';

    if (!comments.length) {
      const emptyState = document.createElement('p');
      emptyState.className = 'comments-empty';
      emptyState.textContent = 'No general comments yet. Use the board to log shared equipment notes.';
      generalCommentsList.appendChild(emptyState);
      return;
    }

    for (const comment of comments) {
      generalCommentsList.appendChild(buildCommentCard(comment));
    }
  }

  function applyDisplayMode() {
    const isTvMode = typeof displayMode === 'string' && displayMode.toLowerCase() === 'tv';
    document.body.classList.toggle('mode-tv', isTvMode);
  }

  function restoreDrawerSnapshot() {
    if (!selectedEquipmentId || !drawerOriginalEquipment) {
      return;
    }
    const equipment = findEquipment(selectedEquipmentId);
    if (!equipment) {
      return;
    }
    Object.assign(equipment, drawerOriginalEquipment);
  }

  function getDrawerEquipmentView(equipment) {
    if (!equipment) {
      return equipment;
    }
    if (!selectedEquipmentId || equipment.id !== selectedEquipmentId) {
      return equipment;
    }
    return {
      ...equipment,
      ...pendingSidebarChanges,
    };
  }

  function getLowZonePartition(item) {
    const name = (item.name || '').toUpperCase();
    if (name.endsWith('B')) {
      return 'B';
    }
    if (name.endsWith('A')) {
      return 'A';
    }
    return 'Other';
  }

  function formatEquipmentDisplayName(item) {
    const rawName = typeof item?.name === 'string' ? item.name.trim() : '';
    if (!rawName) {
      return '';
    }

    if (item?.groupKey === 'low-zone-pumps') {
      const match = rawName.match(/^LZ\s*(\d+)([A-Z])$/i);
      if (match) {
        return `Low Zone ${match[1]}${match[2].toUpperCase()}`;
      }
    }

    if (item?.groupKey === 'high-zone-pumps') {
      const match = rawName.match(/^HZ\s*(\d+)$/i);
      if (match) {
        return `High Zone ${match[1]}`;
      }
    }

    return rawName;
  }

  function setCardAppearance(card, item) {
    const status = normalizeStatus(item.status, item.inService);
    const pill = card.querySelector('.status-pill');
    pill.textContent = `${getStatusEmoji(status)} ${getStatusLabel(status).toUpperCase()}`;
    pill.className = `status-pill status-pill--${status}`;
    card.classList.remove('status-operational', 'status-warning', 'status-offline', 'status-out-of-service', 'status-maintenance');
    card.classList.add(`status-${status}`);
  }

  function formatHoverNote(item) {
    const notePreview = (item.note || '').trim();
    if (!notePreview) {
      return 'No notes added';
    }
    const condensed = notePreview.replace(/\s+/g, ' ').slice(0, 120);
    return condensed.length < notePreview.length ? `${condensed}...` : condensed;
  }

  function formatHoverMeta(item) {
    return `Last edit ${formatTimestamp(item.updatedAt)}`;
  }

  function buildChangeDescription(change) {
    const fromValue = typeof change.from === 'string' && change.from.trim() ? change.from.trim() : 'None';
    const toValue = typeof change.to === 'string' && change.to.trim() ? change.to.trim() : 'None';
    return `${change.label}: ${fromValue} -> ${toValue}`;
  }

  function renderAssetLog(equipment) {
    if (!assetLogList) {
      return;
    }

    const changeLog = Array.isArray(equipment?.changeLog) ? equipment.changeLog : [];
    assetLogList.innerHTML = '';

    if (!changeLog.length) {
      const emptyState = document.createElement('p');
      emptyState.className = 'asset-log-empty';
      emptyState.textContent = 'No asset changes have been logged yet.';
      assetLogList.appendChild(emptyState);
      return;
    }

    for (const entry of changeLog) {
      const item = document.createElement('article');
      item.className = 'asset-log-item';

      const meta = document.createElement('div');
      meta.className = 'asset-log-item-meta';

      const author = document.createElement('p');
      author.className = 'asset-log-item-author';
      author.textContent = entry.updatedBy || 'operator';
      meta.appendChild(author);

      const timestamp = document.createElement('p');
      timestamp.className = 'asset-log-item-time';
      timestamp.textContent = formatTimestamp(entry.timestamp);
      meta.appendChild(timestamp);

      const changesList = document.createElement('ul');
      changesList.className = 'asset-log-item-changes';
      for (const change of entry.changes) {
        const listItem = document.createElement('li');
        listItem.textContent = buildChangeDescription(change);
        changesList.appendChild(listItem);
      }

      item.append(meta, changesList);
      assetLogList.appendChild(item);
    }
  }

  function setCardDetails(card, item) {
    const hasNote = Boolean((item.note || '').trim());
    card.classList.toggle('has-note', hasNote);

    const notePreview = card.querySelector('.equipment-note-preview');
    if (notePreview) {
      notePreview.hidden = !hasNote;
      notePreview.textContent = hasNote ? item.note.trim() : '';
    }

    const swStatus = card.querySelector('.sw-status');
    if (!swStatus) {
      return;
    }
    swStatus.hidden = true;
    swStatus.textContent = '';
    swStatus.classList.remove('sw-status--complete', 'sw-status--incomplete');
  }

  function buildEquipmentCard(item) {
    const card = equipmentTemplate.content.firstElementChild.cloneNode(true);
    const displayName = formatEquipmentDisplayName(item);
    if (item.groupKey !== 'filters') {
      card.classList.add('equipment-card--pump');
    }
    card.dataset.id = item.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${displayName} ${getStatusLabel(normalizeStatus(item.status, item.inService))}`);
    card.querySelector('.equipment-name').textContent = displayName;
    setCardAppearance(card, item);
    setCardDetails(card, item);
    return card;
  }

  function renderLowZoneLayout(groupNode, group) {
    const lowZoneLayout = document.createElement('div');
    lowZoneLayout.className = 'low-zone-layout';

    const partitionOrder = ['B', 'A', 'Other'];
    const partitionLabels = {
      B: 'Clearwell B',
      A: 'Clearwell A',
      Other: 'Other',
    };

    for (const partition of partitionOrder) {
      const items = group.equipment.filter((item) => getLowZonePartition(item) === partition);
      if (!items.length) {
        continue;
      }

      const section = document.createElement('section');
      section.className = 'low-zone-section';
      section.dataset.partition = partition;

      const title = document.createElement('h3');
      title.className = 'low-zone-title';
      title.textContent = partitionLabels[partition];
      section.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'card-grid';
      for (const item of items) {
        grid.appendChild(buildEquipmentCard(item));
      }
      section.appendChild(grid);
      lowZoneLayout.appendChild(section);
    }

    groupNode.appendChild(lowZoneLayout);
  }

  function buildGroupNode(group) {
    const groupNode = groupTemplate.content.firstElementChild.cloneNode(true);
    groupNode.classList.add(`group--${group.key}`);
    const onlineCount = group.equipment.filter(
      (item) => isInServiceStatus(normalizeStatus(item.status, item.inService))
    ).length;
    groupNode.querySelector('.group-title').textContent = group.label;
    groupNode.querySelector('.group-stats').textContent = `${onlineCount} / ${group.equipment.length} online`;

    const defaultGrid = groupNode.querySelector('.card-grid');
    if (group.key === 'low-zone-pumps') {
      defaultGrid.remove();
      renderLowZoneLayout(groupNode, group);
    } else {
      for (const item of group.equipment) {
        defaultGrid.appendChild(buildEquipmentCard(item));
      }
    }

    return groupNode;
  }

  function setHoverPopupContent(item) {
    const status = getStatusLabel(normalizeStatus(item.status, item.inService));
    hoverPopupTitle.textContent = `${formatEquipmentDisplayName(item)} - ${status}`;
    if (item.groupKey === 'filters') {
      const isComplete = item.swMaintenanceComplete === true;
      const year = Number.isInteger(item.swMaintenanceYear) ? ` (${item.swMaintenanceYear})` : '';
      hoverPopupSw.hidden = false;
      hoverPopupSw.textContent = isComplete
        ? `Surface Wash: Complete${year}`
        : 'Surface Wash: Incomplete';
    } else {
      hoverPopupSw.hidden = true;
      hoverPopupSw.textContent = '';
    }
    hoverPopupNote.textContent = formatHoverNote(item);
    hoverPopupMeta.textContent = `${formatHoverMeta(item)} by ${item.updatedBy || 'operator'}`;
  }

  function positionHoverPopup(card) {
    const cardRect = card.getBoundingClientRect();
    const popupRect = hoverPopup.getBoundingClientRect();
    const margin = 8;
    const popupWidth = popupRect.width || 320;
    const popupHeight = popupRect.height || 120;

    let left = cardRect.left + (cardRect.width / 2) - (popupWidth / 2);
    left = Math.max(margin, Math.min(left, window.innerWidth - popupWidth - margin));

    let top = cardRect.top - popupHeight - margin;
    if (top < margin) {
      top = cardRect.bottom + margin;
    }
    if (top + popupHeight > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - popupHeight - margin);
    }

    hoverPopup.style.left = `${Math.round(left)}px`;
    hoverPopup.style.top = `${Math.round(top)}px`;
  }

  function showHoverPopup(card) {
    const equipmentId = card.dataset.id;
    if (!equipmentId) {
      return;
    }
    const equipment = findEquipment(equipmentId);
    if (!equipment) {
      return;
    }

    popupCardId = equipmentId;
    setHoverPopupContent(equipment);
    hoverPopup.setAttribute('aria-hidden', 'false');
    hoverPopup.classList.add('is-visible');
    positionHoverPopup(card);
  }

  function hideHoverPopup() {
    popupCardId = null;
    hoverPopup.classList.remove('is-visible');
    hoverPopup.setAttribute('aria-hidden', 'true');
  }

  function renderStatusOptions(currentStatus) {
    statusOptions.innerHTML = '';
    for (const statusOption of statusOptionsList) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.status = statusOption.value;
      button.className = `status-option status-option--${statusOption.value}`;
      if (statusOption.value === currentStatus) {
        button.classList.add('is-active');
      }
      button.textContent = `${getStatusEmoji(statusOption.value)} ${statusOption.label}`;
      button.setAttribute('aria-label', statusOption.label);
      statusOptions.appendChild(button);
    }
  }

  function buildMaintenanceYearOptions() {
    if (!swYearSelect) {
      return;
    }
    swYearSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select year';
    swYearSelect.appendChild(placeholder);

    const currentYear = new Date().getFullYear();
    for (let year = currentYear + 1; year >= currentYear - 15; year -= 1) {
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = String(year);
      swYearSelect.appendChild(option);
    }
  }

  function renderSwMaintenanceOptions(isComplete) {
    swMaintenanceOptions.innerHTML = '';
    const currentValue = isComplete ? 'complete' : 'incomplete';
    for (const swOption of swMaintenanceOptionsList) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.swMaintenance = swOption.value;
      button.className = 'status-option';
      if (swOption.value === currentValue) {
        button.classList.add('is-active');
      }
      button.textContent = swOption.label;
      swMaintenanceOptions.appendChild(button);
    }
  }

  function refreshDrawer() {
    if (!selectedEquipmentId) {
      return;
    }
    const equipment = findEquipment(selectedEquipmentId);
    if (!equipment) {
      closeDrawer();
      return;
    }

    const drawerEquipment = getDrawerEquipmentView(equipment);
    const status = normalizeStatus(drawerEquipment.status, equipment.inService);
    drawerGroup.textContent = drawerEquipment.groupLabel;
    drawerTitle.textContent = formatEquipmentDisplayName(drawerEquipment);
    drawerMeta.textContent = `Last edit by ${equipment.updatedBy || 'operator'} at ${formatTimestamp(equipment.updatedAt)}`;
    renderStatusOptions(status);
    renderAssetLog(equipment);

    const isFilter = drawerEquipment.groupKey === 'filters';
    filterMaintenanceSection.hidden = !isFilter;
    if (isFilter) {
      const isComplete = drawerEquipment.swMaintenanceComplete === true;
      renderSwMaintenanceOptions(isComplete);
      swYearRow.hidden = !isComplete;
      swYearSelect.value = isComplete && drawerEquipment.swMaintenanceYear ? String(drawerEquipment.swMaintenanceYear) : '';
    }

    if (document.activeElement !== drawerNotes) {
      drawerNotes.value = drawerEquipment.note || '';
    }
  }

  function openDrawer(equipmentId) {
    if (commentDrawer?.classList.contains('is-open')) {
      closeCommentDrawer();
    }
    if (selectedEquipmentId && selectedEquipmentId !== equipmentId) {
      if (!confirmDiscardPendingChanges()) {
        return;
      }
      restoreDrawerSnapshot();
      syncFromState();
    }
    selectedEquipmentId = equipmentId;
    drawerOriginalEquipment = cloneEquipmentSnapshot(findEquipment(equipmentId));
    pendingSidebarChanges = {};
    setSaveButtonState();
    refreshDrawer();
    equipmentDrawer.classList.add('is-open');
    equipmentDrawer.setAttribute('aria-hidden', 'false');
    drawerBackdrop.hidden = false;
    document.body.classList.add('drawer-open');
  }

  function closeDrawer() {
    if (!confirmDiscardPendingChanges()) {
      return false;
    }
    restoreDrawerSnapshot();
    syncFromState();
    pendingSidebarChanges = {};
    setSaveButtonState();
    selectedEquipmentId = null;
    drawerOriginalEquipment = null;
    equipmentDrawer.classList.remove('is-open');
    equipmentDrawer.setAttribute('aria-hidden', 'true');
    drawerBackdrop.hidden = true;
    document.body.classList.remove('drawer-open');
    return true;
  }

  function renderAll() {
    if (!liveState) {
      return;
    }

    const grouped = groupEquipment(liveState.equipment);
    equipmentContainer.innerHTML = '';

    const renderedGroupKeys = new Set();

    for (const group of grouped) {
      if (renderedGroupKeys.has(group.key)) {
        continue;
      }

      if (group.key === 'reclaim-pumps') {
        const wasteGroup = grouped.find((item) => item.key === 'waste-pumps');
        if (wasteGroup) {
          const pairedGroupsRow = document.createElement('div');
          pairedGroupsRow.className = 'paired-groups-row';
          pairedGroupsRow.appendChild(buildGroupNode(group));
          pairedGroupsRow.appendChild(buildGroupNode(wasteGroup));
          equipmentContainer.appendChild(pairedGroupsRow);
          renderedGroupKeys.add(group.key);
          renderedGroupKeys.add(wasteGroup.key);
          continue;
        }
      }

      equipmentContainer.appendChild(buildGroupNode(group));
      renderedGroupKeys.add(group.key);
    }

    updateLastUpdated();
    renderComments();
  }

  function syncFromState() {
    if (!liveState) {
      return;
    }

    if (
      editingCommentId
      && (!Array.isArray(liveState.comments) || !liveState.comments.some((comment) => comment.id === editingCommentId))
    ) {
      closeCommentDrawer();
    }

    const grouped = groupEquipment(liveState.equipment);
    for (const group of grouped) {
      const titleNode = Array.from(document.querySelectorAll('.group')).find(
        (node) => node.querySelector('.group-title')?.textContent === group.label
      );
      if (titleNode) {
        const onlineCount = group.equipment.filter(
          (item) => isInServiceStatus(normalizeStatus(item.status, item.inService))
        ).length;
        titleNode.querySelector('.group-stats').textContent = `${onlineCount} / ${group.equipment.length} online`;
      }
    }

    for (const item of liveState.equipment) {
      const card = equipmentContainer.querySelector(`.equipment-card[data-id="${item.id}"]`);
      if (!card) {
        renderAll();
        return;
      }

      setCardAppearance(card, item);
      setCardDetails(card, item);
      card.setAttribute('aria-label', `${formatEquipmentDisplayName(item)} ${getStatusLabel(normalizeStatus(item.status, item.inService))}`);
    }

    refreshDrawer();
    updateLastUpdated();
    renderComments();

    if (popupCardId) {
      const card = equipmentContainer.querySelector(`.equipment-card[data-id="${popupCardId}"]`);
      const equipment = findEquipment(popupCardId);
      if (card && equipment) {
        setHoverPopupContent(equipment);
        positionHoverPopup(card);
      } else {
        hideHoverPopup();
      }
    }
  }

  async function pushUpdate(equipmentId, payload, updatedBy) {
    try {
      const response = await fetch(`${API_BASE}/equipment/${encodeURIComponent(equipmentId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, updatedBy }),
      });

      if (!response.ok) {
        throw new Error(`Update failed: ${response.status}`);
      }
      return await response.json();

    } catch (error) {
      console.error(error);
      setConnectivity(false);
      return null;
    }
  }

  async function createComment(message, updatedBy) {
    try {
      const response = await fetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, updatedBy }),
      });

      if (!response.ok) {
        throw new Error(`Comment create failed: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(error);
      setConnectivity(false);
      return null;
    }
  }

  async function updateComment(commentId, message, updatedBy) {
    try {
      const response = await fetch(`${API_BASE}/comments/${encodeURIComponent(commentId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, updatedBy }),
      });

      if (!response.ok) {
        throw new Error(`Comment update failed: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(error);
      setConnectivity(false);
      return null;
    }
  }

  async function removeComment(commentId) {
    try {
      const response = await fetch(`${API_BASE}/comments/${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Comment delete failed: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(error);
      setConnectivity(false);
      return null;
    }
  }

  equipmentContainer.addEventListener('click', (event) => {
    const card = event.target instanceof HTMLElement ? event.target.closest('.equipment-card') : null;
    if (!card) {
      return;
    }
    const equipmentId = card.dataset.id;
    if (!equipmentId) {
      return;
    }
    hideHoverPopup();
    openDrawer(equipmentId);
  });

  equipmentContainer.addEventListener('pointerover', (event) => {
    const card = event.target instanceof HTMLElement ? event.target.closest('.equipment-card') : null;
    if (!card) {
      return;
    }
    showHoverPopup(card);
  });

  equipmentContainer.addEventListener('pointerout', (event) => {
    const fromCard = event.target instanceof HTMLElement ? event.target.closest('.equipment-card') : null;
    if (!fromCard) {
      return;
    }
    const toCard = event.relatedTarget instanceof HTMLElement ? event.relatedTarget.closest('.equipment-card') : null;
    if (toCard === fromCard) {
      return;
    }
    if (!toCard) {
      hideHoverPopup();
    }
  });

  equipmentContainer.addEventListener('focusin', (event) => {
    const card = event.target instanceof HTMLElement ? event.target.closest('.equipment-card') : null;
    if (!card) {
      return;
    }
    showHoverPopup(card);
  });

  equipmentContainer.addEventListener('focusout', (event) => {
    const fromCard = event.target instanceof HTMLElement ? event.target.closest('.equipment-card') : null;
    if (!fromCard) {
      return;
    }
    const toCard = event.relatedTarget instanceof HTMLElement ? event.relatedTarget.closest('.equipment-card') : null;
    if (toCard) {
      return;
    }
    hideHoverPopup();
  });

  equipmentContainer.addEventListener('keydown', (event) => {
    const card = event.target instanceof HTMLElement ? event.target.closest('.equipment-card') : null;
    if (!card) {
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    const equipmentId = card.dataset.id;
    if (!equipmentId) {
      return;
    }
    openDrawer(equipmentId);
  });

  statusOptions.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest('.status-option') : null;
    if (!button || !selectedEquipmentId) {
      return;
    }
    const selectedStatus = normalizeStatus(button.dataset.status, false);
    setPendingChanges({ status: selectedStatus });
    refreshDrawer();
  });

  swMaintenanceOptions.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest('button[data-sw-maintenance]') : null;
    if (!button || !selectedEquipmentId) {
      return;
    }
    const equipment = findEquipment(selectedEquipmentId);
    if (!equipment || equipment.groupKey !== 'filters') {
      return;
    }
    const isComplete = button.dataset.swMaintenance === 'complete';
    const currentYear = Number.isInteger(pendingSidebarChanges.swMaintenanceYear)
      ? pendingSidebarChanges.swMaintenanceYear
      : (Number.isInteger(equipment.swMaintenanceYear) ? equipment.swMaintenanceYear : null);
    const nextYear = isComplete ? currentYear : null;
    setPendingChanges({
      swMaintenanceComplete: isComplete,
      swMaintenanceYear: nextYear,
    });
    refreshDrawer();
  });

  swYearSelect.addEventListener('change', () => {
    if (!selectedEquipmentId) {
      return;
    }
    const equipment = findEquipment(selectedEquipmentId);
    if (!equipment || equipment.groupKey !== 'filters') {
      return;
    }
    const workingEquipment = getDrawerEquipmentView(equipment);
    if (workingEquipment.swMaintenanceComplete !== true) {
      return;
    }
    const parsedYear = Number.parseInt(swYearSelect.value, 10);
    const year = Number.isInteger(parsedYear) ? parsedYear : null;
    setPendingChanges({ swMaintenanceYear: year });
    refreshDrawer();
  });

  drawerNotes.addEventListener('input', () => {
    if (!selectedEquipmentId) {
      return;
    }
    setPendingChanges({ note: drawerNotes.value });
  });

  clearNotesButton.addEventListener('click', () => {
    if (!selectedEquipmentId) {
      return;
    }
    drawerNotes.value = '';
    setPendingChanges({ note: '' });
    refreshDrawer();
  });

  saveSidebarButton.addEventListener('click', async () => {
    if (!selectedEquipmentId || Object.keys(pendingSidebarChanges).length === 0) {
      return;
    }
    const editorName = promptForOperatorName();
    if (!editorName) {
      return;
    }

    const payload = { ...pendingSidebarChanges };
    const result = await pushUpdate(selectedEquipmentId, payload, editorName);
    if (!result) {
      return;
    }

    const equipment = findEquipment(selectedEquipmentId);
    if (equipment) {
      if (result.equipment && typeof result.equipment === 'object') {
        Object.assign(equipment, normalizeState({ equipment: [result.equipment], comments: [] }).equipment[0]);
      } else {
        equipment.updatedBy = editorName;
        equipment.updatedAt = new Date().toISOString();
      }
      drawerOriginalEquipment = cloneEquipmentSnapshot(equipment);
    }

    pendingSidebarChanges = {};
    setSaveButtonState();
    syncFromState();
  });

  generalCommentInput.addEventListener('input', () => {
    setCommentFormState();
  });


  openCommentDrawerButton.addEventListener('click', () => {
    openCommentDrawer();
  });

  cancelCommentEditButton.addEventListener('click', () => {
    closeCommentDrawer();
  });

  generalCommentsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = generalCommentInput.value.trim();
    if (!message) {
      setCommentFormState();
      return;
    }

    const editorName = promptForOperatorName();
    if (!editorName) {
      return;
    }

    const result = editingCommentId
      ? await updateComment(editingCommentId, message, editorName)
      : await createComment(message, editorName);
    if (!result) {
      return;
    }

    if (result.state) {
      liveState = normalizeState(result.state);
      syncFromState();
    }
    closeCommentDrawer();
  });

  generalCommentsList.addEventListener('click', async (event) => {
    const button = event.target instanceof Element ? event.target.closest('button[data-action]') : null;
    if (!button) {
      return;
    }

    const commentCard = button.closest('.comment-card');
    const commentId = commentCard?.dataset.commentId;
    if (!commentId) {
      return;
    }

    const comment = Array.isArray(liveState?.comments)
      ? liveState.comments.find((item) => item.id === commentId)
      : null;
    if (!comment) {
      return;
    }

    if (button.dataset.action === 'edit') {
      openCommentDrawer(comment);
      return;
    }

    if (button.dataset.action === 'delete') {
      const shouldDelete = window.confirm(`Delete this comment from ${comment.author || 'operator'}?`);
      if (!shouldDelete) {
        return;
      }

      const result = await removeComment(commentId);
      if (!result) {
        return;
      }

      if (result.state) {
        liveState = normalizeState(result.state);
        syncFromState();
      }

      if (editingCommentId === commentId) {
        closeCommentDrawer();
      }
    }
  });

  drawerClose.addEventListener('click', closeDrawer);
  drawerBackdrop.addEventListener('click', closeDrawer);
  commentDrawerClose.addEventListener('click', closeCommentDrawer);
  commentDrawerBackdrop.addEventListener('click', closeCommentDrawer);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && equipmentDrawer.classList.contains('is-open')) {
      closeDrawer();
      return;
    }
    if (event.key === 'Escape' && commentDrawer.classList.contains('is-open')) {
      closeCommentDrawer();
      return;
    }
    if (event.key === 'Escape' && hoverPopup.classList.contains('is-visible')) {
      hideHoverPopup();
    }
  });

  window.addEventListener('resize', () => {
    if (!popupCardId) {
      return;
    }
    const card = equipmentContainer.querySelector(`.equipment-card[data-id="${popupCardId}"]`);
    if (!card) {
      hideHoverPopup();
      return;
    }
    positionHoverPopup(card);
  });

  window.addEventListener('scroll', () => {
    if (!popupCardId) {
      return;
    }
    const card = equipmentContainer.querySelector(`.equipment-card[data-id="${popupCardId}"]`);
    if (!card) {
      hideHoverPopup();
      return;
    }
    positionHoverPopup(card);
  }, true);

  async function loadInitialState() {
    const response = await fetch(`${API_BASE}/state`);
    if (!response.ok) {
      throw new Error(`Failed to load state: ${response.status}`);
    }

    liveState = normalizeState(await response.json());
    renderAll();
  }

  function connectStream() {
    const stream = new EventSource(`${API_BASE}/stream`);

    stream.addEventListener('open', () => {
      setConnectivity(true);
    });

    stream.addEventListener('snapshot', (event) => {
      liveState = normalizeState(JSON.parse(event.data));
      if (!equipmentContainer.children.length) {
        renderAll();
        return;
      }
      syncFromState();
    });

    stream.addEventListener('state-updated', (event) => {
      liveState = normalizeState(JSON.parse(event.data));
      syncFromState();
    });

    stream.addEventListener('error', () => {
      setConnectivity(false);
    });
  }

  async function init() {
    applyDisplayMode();
    buildMaintenanceYearOptions();
    setCommentFormState();
    try {
      await loadInitialState();
      connectStream();
      setConnectivity(true);
    } catch (error) {
      console.error(error);
      setConnectivity(false);
      equipmentContainer.innerHTML = '<p class="card" style="padding:1rem;">Live dashboard API is not reachable. Start the Node server on port 3001 to enable collaboration.</p>';
      if (generalCommentsList) {
        generalCommentsList.innerHTML = '<p class="comments-empty">Live dashboard API is not reachable. Comments are unavailable until the Node server is running.</p>';
      }
    }
  }

  init();
})();

