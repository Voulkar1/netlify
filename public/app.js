// Vanilla JS enhancements — no build step, no dependencies.
(function () {
  const search = document.getElementById('employee-search');
  if (search) {
    search.addEventListener('input', () => {
      const term = search.value.trim().toLowerCase();
      document.querySelectorAll('[data-employee-name]').forEach((row) => {
        row.hidden = term && !row.dataset.employeeName.includes(term);
      });
    });
  }

  const grid = document.getElementById('schedule-grid');
  if (!grid) return;

  const STATUS_CLASS_PREFIX = 'status-';

  function setSaving(el, state) {
    el.classList.remove('save-ok', 'save-error', 'save-pending');
    if (state) el.classList.add(state);
  }

  async function saveEntry({ employeeId, date, status, note }, sourceEl) {
    setSaving(sourceEl, 'save-pending');
    try {
      const res = await fetch('/api/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: Number(employeeId), date, status, note }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaving(sourceEl, 'save-ok');
      setTimeout(() => setSaving(sourceEl, null), 900);
    } catch (err) {
      setSaving(sourceEl, 'save-error');
      console.error(err);
    }
  }

  grid.addEventListener('change', (e) => {
    const target = e.target;
    if (target.classList.contains('status-select')) {
      const { emp, date } = target.dataset;
      const cell = target.closest('.edit-cell');
      const noteInput = cell ? cell.querySelector('.note-input') : null;
      const note = noteInput ? noteInput.value : '';
      const status = target.value;

      // Update select color class immediately for feedback.
      target.className = 'status-select ' + STATUS_CLASS_PREFIX + (status || 'none');

      saveEntry({ employeeId: emp, date, status, note }, target);
    }
  });

  grid.addEventListener(
    'blur',
    (e) => {
      const target = e.target;
      if (!target.classList || !target.classList.contains('note-input')) return;
      const { emp, date } = target.dataset;
      const cell = target.closest('.edit-cell');
      const select = cell ? cell.querySelector('.status-select') : null;
      const status = select ? select.value : '';
      if (!status) return; // no point saving a note without a status
      saveEntry({ employeeId: emp, date, status, note: target.value }, target);
    },
    true
  );
})();
