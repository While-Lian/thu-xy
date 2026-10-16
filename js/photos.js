/* 班级相册 v3.0.0 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;
  const U = window.Utils;

  let currentUser = null;
  let photos = [];
  let uploading = false;

  window.addEventListener('user-ready', (e) => {
    currentUser = e.detail;
    init();
  });

  function init() {
    const dropZone = document.getElementById('photo-drop');
    const uploadBtn = document.getElementById('photo-upload-btn');
    const fileInput = document.getElementById('photo-input');
    const grid = document.getElementById('photo-grid');
    const viewer = document.getElementById('photo-viewer');
    const isAdmin = U.isAdminRole(currentUser.role);

    if (!isAdmin) dropZone.style.display = 'none';

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) handleUploads(fileInput.files);
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
      if (e.dataTransfer.files.length) handleUploads(e.dataTransfer.files);
    });

    document.getElementById('photo-viewer-close').addEventListener('click', () => {
      viewer.style.display = 'none';
    });
    viewer.addEventListener('click', (e) => {
      if (e.target === viewer) viewer.style.display = 'none';
    });

    loadPhotos();

    async function loadPhotos() {
      grid.innerHTML = '<div class="photo-empty">加载中…</div>';
      const { data, error } = await db
        .from('class_photos')
        .select('*')
        .eq('class_id', window.currentClassId)
        .order('created_at', { ascending: false });

      if (error) {
        grid.innerHTML = '<div class="photo-empty">加载失败</div>';
        return;
      }
      photos = data || [];
      render();
    }

    function render() {
      if (!photos.length) {
        grid.innerHTML = '<div class="photo-empty">还没有照片，上传第一张吧 📷</div>';
        return;
      }
      grid.innerHTML = photos.map(p => {
        const { data: urlData } = db.storage.from('class-photos').getPublicUrl(p.path);
        const url = urlData.publicUrl;
        return `
          <div class="photo-item" data-photo="${p.id}">
            <img src="${url}" loading="lazy" alt="${U.escapeHtml(p.caption || '')}" />
            <div class="photo-overlay">
              ${p.caption ? `<div class="photo-caption">${U.escapeHtml(p.caption)}</div>` : ''}
              <div class="photo-meta">${U.escapeHtml(p.uploader_name)} · ${U.formatTime(p.created_at)}</div>
            </div>
            ${isAdmin ? `<button class="photo-del" data-del="${p.id}" title="删除">×</button>` : ''}
          </div>`;
      }).join('');

      grid.querySelectorAll('.photo-item').forEach(item => {
        item.addEventListener('click', (e) => {
          if (e.target.closest('.photo-del')) return;
          const p = photos.find(x => String(x.id) === item.dataset.photo);
          if (p) openViewer(p);
        });
      });

      grid.querySelectorAll('.photo-del').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const p = photos.find(x => String(x.id) === btn.dataset.del);
          if (!p) return;
          if (!confirm('确定删除这张照片？')) return;
          try {
            await db.storage.from('class-photos').remove([p.path]);
            await db.from('class_photos').delete().eq('id', p.id);
            await loadPhotos();
          } catch (err) {
            alert('删除失败：' + err.message);
          }
        });
      });
    }

    function openViewer(p) {
      const { data: urlData } = db.storage.from('class-photos').getPublicUrl(p.path);
      document.getElementById('photo-viewer-img').src = urlData.publicUrl;
      document.getElementById('photo-viewer-caption').textContent = p.caption || '';
      document.getElementById('photo-viewer-meta').textContent =
        p.uploader_name + ' · ' + U.formatTime(p.created_at);
      viewer.style.display = 'flex';
    }

    async function handleUploads(files) {
      if (uploading) return;
      const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
      if (!imageFiles.length) return alert('请选择图片文件');

      uploading = true;
      const btn = document.getElementById('photo-upload-btn');
      btn.disabled = true;
      let done = 0;

      for (const file of imageFiles) {
        if (file.size > 10 * 1024 * 1024) {
          alert(`「${file.name}」超过 10MB，已跳过`);
          continue;
        }
        btn.textContent = `上传中… (${done + 1}/${imageFiles.length})`;
        try {
          const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
          const path = `${window.currentClassId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;

          const { error: upErr } = await db.storage
            .from('class-photos')
            .upload(path, file, { upsert: false });
          if (upErr) throw upErr;

          const { error: dbErr } = await db.from('class_photos').insert({
            class_id: window.currentClassId,
            path,
            uploader_id: currentUser.id,
            uploader_name: currentUser.nickname
          });
          if (dbErr) throw dbErr;
          done++;
        } catch (err) {
          console.error(err);
          alert(`「${file.name}」上传失败：` + err.message);
        }
      }

      uploading = false;
      btn.disabled = false;
      btn.textContent = '＋ 上传照片';

      await loadPhotos();
    }
  }
})();