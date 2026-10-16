/* 班级文件 v1.0.0 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;
  const U = window.Utils;

  let currentUser = null;
  let files = [];

  window.addEventListener('user-ready', (e) => {
    currentUser = e.detail;
    initFilesPage();
  });

  function initFilesPage() {
    const listEl = document.getElementById('file-list');
    const uploadBtn = document.getElementById('file-upload-btn');
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');
    const isAdmin = currentUser.role === 'admin';

    if (!isAdmin) {
      dropZone.style.display = 'none';
    }

    loadFiles();

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) handleUpload(fileInput.files[0]);
      fileInput.value = '';
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (!isAdmin) return;
      if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files[0]);
    });

    async function loadFiles() {
      listEl.innerHTML = '<div class="file-empty">加载中…</div>';
      const { data, error } = await db
        .from('class_files')
        .select('*')
        .eq('class_id', window.currentClassId)
        .order('created_at', { ascending: false });

      if (error) {
        listEl.innerHTML = '<div class="file-empty">加载失败</div>';
        return;
      }
      files = data || [];
      renderFiles();
    }

    function renderFiles() {
      if (!files.length) {
        listEl.innerHTML = '<div class="file-empty">暂无文件</div>';
        return;
      }
      listEl.innerHTML = files.map(f => {
        const { data: urlData } = db.storage.from('class-files').getPublicUrl(f.path);
        const url = urlData.publicUrl;
        const showDelete = isAdmin;
        const ext = (f.name.split('.').pop() || '').toLowerCase();
        return `
          <div class="file-item">
            <div class="file-icon">${fileIcon(ext)}</div>
            <div class="file-info">
              <div class="file-name">${U.escapeHtml(f.name)}</div>
              <div class="file-meta">
                ${U.formatSize(f.size)} · 由 ${U.escapeHtml(f.uploader_name || '同学')} 上传 · ${U.formatTime(f.created_at)}
              </div>
            </div>
            <div class="file-actions">
              <a href="${url}" target="_blank" class="btn btn-primary btn-small">查看 / 下载</a>
              ${showDelete ? `<button class="btn btn-danger btn-small" data-del="${f.id}">删除</button>` : ''}
            </div>
          </div>`;
      }).join('');

      listEl.querySelectorAll('[data-del]').forEach(btn => {
        btn.addEventListener('click', () => deleteFile(btn.dataset.del));
      });
    }

    function fileIcon(ext) {
      if (['pdf'].includes(ext)) return '📕';
      if (['doc', 'docx'].includes(ext)) return '📘';
      if (['xls', 'xlsx', 'csv'].includes(ext)) return '📗';
      if (['ppt', 'pptx'].includes(ext)) return '📙';
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
      if (['zip', 'rar', '7z'].includes(ext)) return '📦';
      if (['mp4', 'mov', 'avi'].includes(ext)) return '🎬';
      if (['mp3', 'wav'].includes(ext)) return '🎵';
      return '📄';
    }

    async function handleUpload(file) {
      if (file.size > 50 * 1024 * 1024) {
        return alert('文件不能超过 50MB');
      }
      const filePath = `${window.currentClassId}/${Date.now()}-${file.name}`;

      const btn = uploadBtn;
      btn.disabled = true;
      btn.textContent = '上传中…';

      try {
        const { error: upErr } = await db.storage
          .from('class-files')
          .upload(filePath, file, { upsert: false });
        if (upErr) throw upErr;

        const { error: dbErr } = await db.from('class_files').insert({
          class_id: window.currentClassId,
          name: file.name,
          path: filePath,
          size: file.size,
          mime_type: file.type,
          uploader_id: currentUser.id,
          uploader_name: currentUser.nickname
        });
        if (dbErr) throw dbErr;

        await loadFiles();
      } catch (err) {
        console.error(err);
        alert('上传失败：' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = '＋ 上传文件';
      }
    }

    async function deleteFile(id) {
      const f = files.find(x => String(x.id) === String(id));
      if (!f) return;
      if (!confirm(`确定删除「${f.name}」吗？`)) return;

      try {
        const { error: stErr } = await db.storage.from('class-files').remove([f.path]);
        if (stErr) console.warn('删除存储失败', stErr);

        const { error: dbErr } = await db.from('class_files').delete().eq('id', id);
        if (dbErr) throw dbErr;

        await loadFiles();
      } catch (err) {
        alert('删除失败：' + err.message);
      }
    }
  }
})();