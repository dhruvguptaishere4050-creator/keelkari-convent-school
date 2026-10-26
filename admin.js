const demoCredentials = { username: 'admin', password: 'keelkari2026' };
const loggedIn = () => sessionStorage.getItem('keelkari-admin') === 'true';
const redirectToLogin = () => { window.location.href = 'admin.html'; };

const loginForm = document.querySelector('#login-form');
if (loginForm) {
  if (loggedIn()) window.location.href = 'dashboard.html';
  loginForm.addEventListener('submit', event => {
    event.preventDefault();
    const { username, password } = Object.fromEntries(new FormData(loginForm));
    const status = loginForm.querySelector('.form-status');
    if (username === demoCredentials.username && password === demoCredentials.password) {
      sessionStorage.setItem('keelkari-admin', 'true');
      window.location.href = 'dashboard.html';
    } else status.textContent = 'The username or password is not correct.';
  });
}

if (document.body.classList.contains('dashboard-body')) {
  if (!loggedIn()) redirectToLogin();
  const renderDashboard = () => {
    const notices = getNotices().sort((a, b) => new Date(b.date) - new Date(a.date));
    const enquiries = getEnquiries();
    document.querySelector('#notice-count').textContent = notices.length;
    document.querySelector('#enquiry-count').textContent = enquiries.length;
    document.querySelector('#admin-notices').innerHTML = notices.map(item => `<article><div><strong>${escapeHtml(item.title)}</strong><span>${formatDate(item.date)} · ${escapeHtml(item.body)}</span></div><button class="delete-notice" data-id="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.title)}">×</button></article>`).join('') || '<p class="empty-state">No notices published yet.</p>';
    document.querySelector('#enquiries-table').innerHTML = enquiries.map(item => `<tr><td><strong>${escapeHtml(item.parent)}</strong>${item.email ? `<small>${escapeHtml(item.email)}</small>` : ''}</td><td>${escapeHtml(item.class)}</td><td>${escapeHtml(item.phone)}${item.message ? `<small>${escapeHtml(item.message)}</small>` : ''}</td><td>${new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(new Date(item.received))}</td></tr>`).join('') || '<tr><td colspan="4" class="empty-state">No admission enquiries have been received yet.</td></tr>';
    document.querySelectorAll('.delete-notice').forEach(button => button.addEventListener('click', () => {
      setStored('keelkari-notices', getNotices().filter(item => item.id !== button.dataset.id)); renderDashboard();
    }));
  };
  document.querySelector('#notice-form input[type=date]').value = new Date().toISOString().slice(0, 10);
  document.querySelector('#notice-form').addEventListener('submit', event => {
    event.preventDefault();
    const notice = Object.fromEntries(new FormData(event.currentTarget));
    const notices = getNotices();
    notices.unshift({ id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(), ...notice });
    setStored('keelkari-notices', notices);
    event.currentTarget.reset();
    event.currentTarget.querySelector('input[type=date]').value = new Date().toISOString().slice(0, 10);
    event.currentTarget.querySelector('.form-status').textContent = 'Notice published on the public noticeboard.';
    renderDashboard();
  });
  document.querySelector('#logout').addEventListener('click', () => { sessionStorage.removeItem('keelkari-admin'); redirectToLogin(); });
  renderDashboard();
}
