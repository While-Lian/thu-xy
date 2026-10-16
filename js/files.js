/* 班级文件 v2.4.0（含文件夹分类） */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;
  const U = window.Utils;
  const SK = window.Skeleton;

  let currentUser = null;
  let files = [];
  let folders = [];
  let activeFolder = '';
  let searchKeyword = '';
  let pendingFile = null;

  window.addEventListener('user-ready', (e) => {
    currentUser = e.detail;
    initFilesPage();
  });

  function initFilesPage() {
    const listEl = document.getElementById('file-list');
    const uploadBtn = document.getElementById('file-upload-btn');
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');
    const searchInput = document.getElementById('file-search');
    const uploadModal = document.getElementById('upload-modal');
    const uploadFolderInput = document.getElementById('upload-folder');
    const isAdmin = U.isAdminRole(currentUser.role);

    if (!isAdmin) {
      dropZone.style.display = 'none';
    }

    loadFiles();

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) openUploadModal(fileInput.files[0]);
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
      if (e.dataTransfer.files.length) openUploadModal(e.dataTransfer.files[0]);
    });

    searchInput.addEventListener('input', () => {
      searchKeyword = searchInput.value.trim().toLowerCase();
      renderFiles();
    });

    document.getElementById('upload-cancel').addEventListener('click', closeUploadModal);
    uploadModal.addEventListener('click', (e) => { if (e.target === uploadModal) closeUploadModal(); });
    document.getElementById('upload-confirm').addEventListener('click', doUpload);

    function openUploadModal(file) {
      pendingFile = file;
      document.getElementById('upload-filename').textContent = file.name;
      uploadFolderInput.value = activeFolder || '默认';
      document.getElementById('upload-msg').textContent = '';
      uploadModal.style.display = 'flex';
      uploadFolderInput.focus();
    }

    function closeUploadModal() {
      uploadModal.style.display = 'none';
      pendingFile = null;
    }

    function updateFolderDatalist() {
      const dl = document.getElementById('folder-datalist');
      dl.innerHTML = folders.map(f =>
        `<option value="${U.escapeHtml(f.folder)}"></option>`
      ).join('');
    }

    async function loadFiles() {
      listEl.innerHTML = SK.files(4);
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

      // 计算文件夹
      const folderMap = {};
      files.forEach(f => {
        const k = f.folder || '默认';
        folderMap[k] = (folderMap[k] || 0) + 1;
      });
      folders = Object.keys(folderMap).sort().map(k => ({ folder: k, count: folderMap[k] }));

      renderFolders();
      updateFolderDatalist();
      renderFiles();
    }

    function renderFolders() {
      const tabsEl = document.getElementById('folder-tabs');
      const total = files.length;
      let html = `<button class="folder-tab${activeFolder === '' ? ' active' : ''}" data-folder="">📂 全部 (${total})</button>`;
      html += folders.map(f =>
        `<button class="folder-tab${activeFolder === f.folder ? ' active' : ''}" data-folder="${U.escapeHtml(f.folder)}">📁 ${U.escapeHtml(f.folder)} (${f.count})</button>`
      ).join('');
      tabsEl.innerHTML = html;

      tabsEl.querySelectorAll('.folder-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          activeFolder = tab.dataset.folder;
          renderFolders();
          renderFiles();
        });
      });
    }

    function renderFiles() {
      let list = files;
      if (activeFolder) {
        list = list.filter(f => (f.folder || '默认') === activeFolder);
      }
      if (searchKeyword) {
        list = list.filter(f => f.name.toLowerCase().includes(searchKeyword));
      }

      if (!list.length) {
        listEl.innerHTML = '<div class="file-empty">' +
          (searchKeyword ? '没有匹配的文件' : (activeFolder ? '此文件夹为空' : '暂无文件')) +
          '</div>';
        return;
      }

      const isAdmin2 = isAdmin;
      listEl.innerHTML = list.map(f => {
        const { data: urlData } = db.storage.from('class-files').getPublicUrl(f.path);
        const url = urlData.publicUrl;
        const ext = (f.name.split('.').pop() || '').toLowerCase();
        const folderName = f.folder || '默认';
        return `
          <div class="file-item">
            <div class="file-icon">${fileIcon(ext)}</div>
            <div class="file-info">
              <div class="file-name">${U.escapeHtml(f.name)}</div>
              <div class="file-meta">
                <span class="file-folder-tag">📁 ${U.escapeHtml(folderName)}</span>
                ${U.formatSize(f.size)} · 由 ${U.escapeHtml(f.uploader_name || '同学')} 上传 · ${U.formatTime(f.created_at)}
              </div>
            </div>
            <div class="file-actions">
              <a href="${url}" target="_blank" class="btn btn-primary btn-small">查看 / 下载</a>
              ${isAdmin2 ? `<button class="btn btn-danger btn-small" data-del="${f.id}">删除</button>` : ''}
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

    async function doUpload() {
      if (!pendingFile) return;
      const file = pendingFile;
      const folder = uploadFolderInput.value.trim() || '默认';
      const msgEl = document.getElementById('upload-msg');
      const btn = document.getElementById('upload-confirm');

      if (file.size > 50 * 1024 * 1024) {
        msgEl.textContent = '文件不能超过 50MB';
        msgEl.className = 'form-msg error';
        return;
      }

      const filePath = `${window.currentClassId}/${Date.now()}-${file.name}`;

      btn.disabled = true;
      btn.textContent = '上传中…';
      msgEl.textContent = '';

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
          uploader_name: currentUser.nickname,
          folder
        });
        if (dbErr) throw dbErr;

        closeUploadModal();
        await loadFiles();
      } catch (err) {
        msgEl.textContent = err.message || '上传失败';
        msgEl.className = 'form-msg error';
      } finally {
        btn.disabled = false;
        btn.textContent = '上传';
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