/**
 * Announcements & Noticeboard Module
 */
const Announcements = {
  currentAnnouncements: [],

  async load() {
    await this.fetchAnnouncements();
  },

  async fetchAnnouncements() {
    try {
      const data = await API.get('/announcements');
      this.currentAnnouncements = data.data || [];
      this.renderFeed(this.currentAnnouncements);
    } catch (err) {
      UI.showToast('Failed to load notices: ' + err.message, 'error');
    }
  },

  renderFeed(announcements) {
    const feed = document.getElementById('announcements-feed');
    if (!feed) return;

    if (!announcements || announcements.length === 0) {
      feed.innerHTML = `<p class="text-muted text-center col-span-2 py-4">No campus notices posted yet.</p>`;
      return;
    }

    const isAdmin = Auth.currentUser?.role === 'ADMIN';

    feed.innerHTML = announcements.map(a => {
      let prioBadge = '<span class="badge badge-neutral">Normal</span>';
      if (a.PRIORITY === 'URGENT') prioBadge = '<span class="badge badge-danger">Urgent Notice</span>';
      else if (a.PRIORITY === 'HIGH') prioBadge = '<span class="badge badge-warning">High Priority</span>';

      return `
        <div class="announcement-card">
          <div>
            <div class="announcement-card-header">
              <span class="badge badge-info">Audience: ${a.TARGET_ROLE}</span>
              ${prioBadge}
            </div>

            <h3 class="announcement-card-title">${a.TITLE}</h3>
            <p class="announcement-card-content">${a.CONTENT}</p>
          </div>

          <div class="announcement-card-footer">
            <span><i class="fa-regular fa-user"></i> By ${a.AUTHOR_NAME || 'Administration'} &bull; ${UI.formatDate(a.CREATED_AT)}</span>
            ${isAdmin ? `
              <button class="btn btn-sm btn-outline" title="Delete Announcement" onclick="Announcements.deleteAnnouncement(${a.ANNOUNCEMENT_ID})">
                <i class="fa-solid fa-trash text-danger"></i>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  openAddModal() {
    document.getElementById('form-announcement').reset();
    UI.openModal('modal-add-announcement');
  },

  async handleSubmit() {
    const title = document.getElementById('ann-title').value.trim();
    const targetRole = document.getElementById('ann-target').value;
    const priority = document.getElementById('ann-prio').value;
    const content = document.getElementById('ann-content').value.trim();

    try {
      await API.post('/announcements', {
        title,
        targetRole,
        priority,
        content
      });

      UI.showToast('Notice published successfully!', 'success');
      UI.closeModal('modal-add-announcement');
      this.fetchAnnouncements();
    } catch (err) {
      UI.showToast('Failed to post announcement: ' + err.message, 'error');
    }
  },

  async deleteAnnouncement(announcementId) {
    if (!confirm('Are you sure you want to delete this notice?')) return;
    try {
      await API.delete(`/announcements/${announcementId}`);
      UI.showToast('Notice removed.', 'success');
      this.fetchAnnouncements();
    } catch (err) {
      UI.showToast('Failed to delete notice: ' + err.message, 'error');
    }
  }
};
