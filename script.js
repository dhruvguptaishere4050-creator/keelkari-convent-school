const defaultNotices = [
  { id: 'welcome', title: 'Admissions enquiries are open', body: 'For Classes I–VIII', date: '2026-04-01' },
  { id: 'session', title: 'Welcome to the new academic session', body: 'Information for parents and guardians', date: '2026-04-08' },
  { id: 'updates', title: 'Keep this page bookmarked', body: 'Notices and updates will be posted here', date: '2026-04-15' }
];

const getStored = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const setStored = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const getNotices = () => getStored('keelkari-notices', defaultNotices);
const getEnquiries = () => getStored('keelkari-enquiries', []);
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
const formatDate = value => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));

document.querySelectorAll('.year').forEach(element => element.textContent = new Date().getFullYear());
const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
if (menuButton && nav) {
  menuButton.addEventListener('click', () => { const open = nav.classList.toggle('open'); menuButton.setAttribute('aria-expanded', open); });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { nav.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); }));
}

document.querySelectorAll('[data-notices]').forEach(feed => {
  const notices = getNotices().sort((a, b) => new Date(b.date) - new Date(a.date));
  feed.innerHTML = notices.map(notice => `<article class="notice-card"><time datetime="${escapeHtml(notice.date)}">${formatDate(notice.date)}</time><div><h3>${escapeHtml(notice.title)}</h3><p>${escapeHtml(notice.body)}</p></div></article>`).join('');
});

const enquiryForm = document.querySelector('#enquiry-form');
if (enquiryForm) enquiryForm.addEventListener('submit', event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(enquiryForm));
  const enquiries = getEnquiries();
  enquiries.unshift({ id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(), ...values, received: new Date().toISOString() });
  setStored('keelkari-enquiries', enquiries);
  const status = enquiryForm.querySelector('.form-status');
  status.textContent = 'Thank you — your enquiry has been sent to the school office.';
  enquiryForm.reset();
});
const consentText = document.querySelector('.consent span');
if (consentText) consentText.innerHTML = 'I agree that the school may use these details only to respond to my admission enquiry. <a href="privacy.html">Privacy information</a>';
