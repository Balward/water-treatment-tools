(() => {
  const equipmentContainer = document.getElementById('equipmentContainer');
  const groupTemplate = document.getElementById('groupTemplate');
  const equipmentTemplate = document.getElementById('equipmentTemplate');
  const syncStatus = document.getElementById('syncStatus');
  const lastUpdated = document.getElementById('lastUpdated');
  const opsLogo = document.getElementById('opsLogo');
  const themeToggle = document.getElementById('themeToggle');
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
  const hoverPopup = document.getElementById('hoverPopup');
  const hoverPopupTitle = document.getElementById('hoverPopupTitle');
  const hoverPopupSw = document.getElementById('hoverPopupSw');
  const hoverPopupNote = document.getElementById('hoverPopupNote');
  const hoverPopupMeta = document.getElementById('hoverPopupMeta');

  const isLocalDev = window.location.hostname === 'localhost' && window.location.port === '8080';
  const API_BASE = isLocalDev ? 'http://localhost:3001/api/live-ops' : '/api/live-ops';
  const operatorNameStorageKey = 'live-ops-operator-name';
  const themeStorageKey = 'live-ops-theme';
  const statusOptionsList = [
    { value: 'operational', label: 'Online' },
    { value: 'warning', label: 'Warning' },
    { value: 'offline', label: 'Out of Service' },
    { value: 'maintenance', label: 'Maintenance' },
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

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('theme-dark', isDark);
    if (opsLogo) {
      opsLogo.src = isDark
        ? '/assets/logos/logo-horizontal-dark.png'
        : '/assets/logos/logo-horizontal.png';
    }
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      const nextModeLabel = isDark ? 'Switch to light mode' : 'Switch to dark mode';
      themeToggle.setAttribute('aria-label', nextModeLabel);
      themeToggle.title = nextModeLabel;
      themeToggle.textContent = isDark ? '☼' : '☾';
    }
  }

  function initTheme() {
    const savedTheme = localStorage.getItem(themeStorageKey);
    if (savedTheme === 'dark' || savedTheme === 'light') {
      applyTheme(savedTheme);
      return;
    }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
      localStorage.setItem(themeStorageKey, nextTheme);
      applyTheme(nextTheme);
    });
  }

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
    if (statusOptionsList.some((statusOption) => statusOption.value === normalized)) {
      return normalized;
    }
    return inService ? 'operational' : 'offline';
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
      equipment: stateValue.equipment.map((equipment) => {
        const normalizedStatus = normalizeStatus(equipment.status, equipment.inService);
        return {
          ...equipment,
          status: normalizedStatus,
          inService: isInServiceStatus(normalizedStatus),
          swMaintenanceComplete: equipment.swMaintenanceComplete === true,
          swMaintenanceYear: Number.isInteger(equipment.swMaintenanceYear) ? equipment.swMaintenanceYear : null,
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

  function setCardAppearance(card, item) {
    const status = normalizeStatus(item.status, item.inService);
    const pill = card.querySelector('.status-pill');
    pill.textContent = `${getStatusEmoji(status)} ${getStatusLabel(status).toUpperCase()}`;
    pill.className = `status-pill status-pill--${status}`;
    card.classList.remove('status-operational', 'status-warning', 'status-offline', 'status-maintenance');
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

  function setCardDetails(card, item) {
    const hasNote = Boolean((item.note || '').trim());
    card.classList.toggle('has-note', hasNote);

    const swStatus = card.querySelector('.sw-status');
    if (!swStatus) {
      return;
    }
    if (item.groupKey !== 'filters') {
      swStatus.hidden = true;
      swStatus.textContent = '';
      swStatus.classList.remove('sw-status--complete', 'sw-status--incomplete');
      return;
    }

    const isComplete = item.swMaintenanceComplete === true;
    const year = Number.isInteger(item.swMaintenanceYear) ? ` (${item.swMaintenanceYear})` : '';
    swStatus.hidden = false;
    swStatus.textContent = isComplete
      ? `SW COMPLETE${year}`
      : 'SW INCOMPLETE';
    swStatus.classList.toggle('sw-status--complete', isComplete);
    swStatus.classList.toggle('sw-status--incomplete', !isComplete);
  }

  function buildEquipmentCard(item) {
    const card = equipmentTemplate.content.firstElementChild.cloneNode(true);
    if (item.groupKey !== 'filters') {
      card.classList.add('equipment-card--pump');
    }
    card.dataset.id = item.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${item.name} ${getStatusLabel(normalizeStatus(item.status, item.inService))}`);
    card.querySelector('.equipment-name').textContent = item.name;
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

  function setHoverPopupContent(item) {
    const status = getStatusLabel(normalizeStatus(item.status, item.inService));
    hoverPopupTitle.textContent = `${item.name} - ${status}`;
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
    drawerTitle.textContent = drawerEquipment.name;
    drawerMeta.textContent = `Last edit by ${equipment.updatedBy || 'operator'} at ${formatTimestamp(equipment.updatedAt)}`;
    renderStatusOptions(status);

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

    for (const group of grouped) {
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

      equipmentContainer.appendChild(groupNode);
    }

    updateLastUpdated();
  }

  function syncFromState() {
    if (!liveState) {
      return;
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
      card.setAttribute('aria-label', `${item.name} ${getStatusLabel(normalizeStatus(item.status, item.inService))}`);
    }

    refreshDrawer();
    updateLastUpdated();

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
        Object.assign(equipment, result.equipment);
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

  drawerClose.addEventListener('click', closeDrawer);
  drawerBackdrop.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && equipmentDrawer.classList.contains('is-open')) {
      closeDrawer();
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
    initTheme();
    buildMaintenanceYearOptions();
    try {
      await loadInitialState();
      connectStream();
      setConnectivity(true);
    } catch (error) {
      console.error(error);
      setConnectivity(false);
      equipmentContainer.innerHTML = '<p class="card" style="padding:1rem;">Live dashboard API is not reachable. Start the Node server on port 3001 to enable collaboration.</p>';
    }
  }

  init();
})();
