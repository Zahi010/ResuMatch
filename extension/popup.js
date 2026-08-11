const API_BASE_URL = 'http://localhost:8000/api/v1';

document.addEventListener('DOMContentLoaded', async () => {
  const loginState = document.getElementById('auth-state');
  const loggedInState = document.getElementById('logged-in-state');
  const errorMsg = document.getElementById('error');
  const loading = document.getElementById('loading');

  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const resumeSelect = document.getElementById('resume-select');

  // Check login state on load
  chrome.storage.local.get(['token', 'activeResumeId'], async (result) => {
    if (result.token) {
      await showLoggedInState(result.token, result.activeResumeId);
    } else {
      loginState.classList.remove('hidden');
    }
  });

  loginBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) return showError('Please fill in both fields.');

    errorMsg.classList.add('hidden');
    loading.classList.remove('hidden');
    loginState.classList.add('hidden');

    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      });

      if (!res.ok) throw new Error('Invalid credentials');

      const data = await res.json();
      const token = data.access_token;
      
      chrome.storage.local.set({ token });
      await showLoggedInState(token);
    } catch (err) {
      loading.classList.add('hidden');
      loginState.classList.remove('hidden');
      showError(err.message);
    }
  });

  logoutBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['token', 'activeResumeId']);
    loggedInState.classList.add('hidden');
    loginState.classList.remove('hidden');
    emailInput.value = '';
    passwordInput.value = '';
  });

  resumeSelect.addEventListener('change', (e) => {
    if (e.target.value) {
      chrome.storage.local.set({ activeResumeId: parseInt(e.target.value) });
    }
  });

  async function showLoggedInState(token, activeResumeId = null) {
    loading.classList.remove('hidden');
    try {
      const res = await fetch(`${API_BASE_URL}/resumes/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch resumes. Token might be expired.');
      
      const resumes = await res.json();
      
      // Clear options except first
      resumeSelect.innerHTML = '<option value="">Select a Resume...</option>';
      
      resumes.forEach(resume => {
        const option = document.createElement('option');
        option.value = resume.id;
        option.textContent = resume.filename;
        resumeSelect.appendChild(option);
      });

      if (activeResumeId) {
        resumeSelect.value = activeResumeId;
      } else if (resumes.length > 0) {
        // Auto-save the first resume if none is selected
        chrome.storage.local.set({ activeResumeId: resumes[0].id });
      }

      loading.classList.add('hidden');
      loggedInState.classList.remove('hidden');
    } catch (err) {
      loading.classList.add('hidden');
      loginState.classList.remove('hidden');
      chrome.storage.local.remove(['token', 'activeResumeId']);
      showError('Session expired. Please log in again.');
    }
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
  }
});
