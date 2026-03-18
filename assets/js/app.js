import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { auth, db } from './firebase-config.js';

const DEFAULT_DB = {
  reports: {},
  notebook: '',
  queue: '',
  updatedAt: null
};

const selectors = {
  authScreen: document.getElementById('auth-screen'),
  appScreen: document.getElementById('app-screen'),
  authStatus: document.getElementById('auth-status'),
  systemStatus: document.getElementById('system-status-label'),
  userEmail: document.getElementById('user-email'),
  reportDatePicker: document.getElementById('report-date-picker'),
  renderArea: document.getElementById('render-area'),
  queueField: document.getElementById('queue-field'),
  notebookField: document.getElementById('notebook-field'),
  lastSync: document.getElementById('last-sync'),
  nextSave: document.getElementById('next-save'),
  saveButton: document.getElementById('main-save-btn'),
  reportButton: document.getElementById('report-btn'),
  logoutButton: document.getElementById('logout-btn'),
  copyReportButton: document.getElementById('copy-report-btn'),
  reportText: document.getElementById('base-report-text'),
  chartsTab: document.getElementById('charts-tab'),
  kpiTasks: document.getElementById('kpi-tasks'),
  kpiHours: document.getElementById('kpi-hours'),
  kpiEfficiency: document.getElementById('kpi-efficiency')
};

let currentSelectedDate = new Date().toISOString().split('T')[0];
let currentUser = null;
let localDb = loadLocalBackup();
let trendChart = null;
let distChart = null;
let syncCountdown = 30;
let reportModal = null;

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const resetPasswordButton = document.getElementById('reset-password-btn');

function loadLocalBackup() {
  try {
    const stored = localStorage.getItem('mydaily_core');
    if (!stored) {
      return structuredClone(DEFAULT_DB);
    }
    return { ...structuredClone(DEFAULT_DB), ...JSON.parse(stored) };
  } catch {
    return structuredClone(DEFAULT_DB);
  }
}

function saveLocalBackup() {
  localStorage.setItem('mydaily_core', JSON.stringify(localDb));
}

function setStatus(message, type = 'info') {
  selectors.authStatus.textContent = message;
  selectors.systemStatus.textContent = message;
  const colorMap = {
    info: 'SYSTEM_READY',
    success: 'SYNC_OK',
    danger: 'SYNC_ERROR'
  };
  if (selectors.systemStatus && colorMap[type]) {
    selectors.systemStatus.textContent = colorMap[type];
  }
}

function showScreen(name) {
  selectors.authScreen.classList.toggle('active', name === 'auth');
  selectors.appScreen.classList.toggle('active', name === 'app');
}

function getTripleDates(baseDateStr) {
  const base = new Date(`${baseDateStr}T12:00:00`);
  return [2, 1, 0].map((offset) => {
    const d = new Date(base);
    d.setDate(base.getDate() - offset);
    return d;
  });
}

function sanitize(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createTaskRow(dateStr, task = { desc: '', hour: '' }) {
  const container = document.getElementById(`tasks-${dateStr}`);
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'mb-2 d-flex gap-2 align-items-center task-row';
  div.innerHTML = `
    <input type="text" class="form-control form-control-sm t-desc" value="${sanitize(task.desc)}" placeholder="Descrição da task">
    <input type="text" class="form-control form-control-sm t-hour text-center" style="width: 90px;" value="${sanitize(task.hour)}" placeholder="0,0">
    <button class="btn btn-link text-danger p-0 remove-task-btn" type="button" aria-label="Remover task">
      <i class="bi bi-trash3-fill"></i>
    </button>
  `;
  div.querySelector('.remove-task-btn').addEventListener('click', () => div.remove());
  container.appendChild(div);
}

function renderAll() {
  selectors.renderArea.innerHTML = '';
  const labels = ['Anteontem', 'Ontem', 'Selecionado'];

  getTripleDates(currentSelectedDate).forEach((dateObject, index) => {
    const dateStr = dateObject.toISOString().split('T')[0];
    const data = localDb.reports[dateStr] || { tasks: [], comments: '' };

    selectors.renderArea.insertAdjacentHTML('beforeend', `
      <div class="col-xl-4">
        <div class="glass-card h-100 p-4">
          <div class="d-flex justify-content-between mb-3 gap-3">
            <h6 class="fw-bold ${index === 2 ? 'text-primary' : ''}">${labels[index]}</h6>
            <small class="opacity-50">${dateObject.toLocaleDateString('pt-BR')}</small>
          </div>
          <div id="tasks-${dateStr}"></div>
          <button class="btn btn-outline-secondary btn-sm w-100 mt-2 mb-3 add-task-btn" data-date="${dateStr}" type="button" style="border-style:dashed">+ Task</button>
          <textarea id="comm-${dateStr}" class="form-control" rows="3" placeholder="Comentários do dia">${sanitize(data.comments || '')}</textarea>
        </div>
      </div>
    `);

    data.tasks.forEach((task) => createTaskRow(dateStr, task));
  });

  document.querySelectorAll('.add-task-btn').forEach((button) => {
    button.addEventListener('click', () => createTaskRow(button.dataset.date));
  });

  selectors.queueField.value = localDb.queue || '';
  selectors.notebookField.value = localDb.notebook || '';
}

function collectCurrentScreenData() {
  getTripleDates(currentSelectedDate).forEach((dateObject) => {
    const dateStr = dateObject.toISOString().split('T')[0];
    const container = document.getElementById(`tasks-${dateStr}`);
    if (!container) return;

    const rows = Array.from(container.querySelectorAll('.task-row'));
    localDb.reports[dateStr] = {
      tasks: rows
        .map((row) => ({
          desc: row.querySelector('.t-desc')?.value.trim() || '',
          hour: row.querySelector('.t-hour')?.value.trim() || ''
        }))
        .filter((task) => task.desc || task.hour),
      comments: document.getElementById(`comm-${dateStr}`)?.value || ''
    };
  });

  localDb.queue = selectors.queueField.value;
  localDb.notebook = selectors.notebookField.value;
}

function updateSyncClock() {
  syncCountdown -= 1;
  if (syncCountdown < 0) {
    syncCountdown = 30;
  }
  selectors.nextSave.textContent = `Próximo sync: 00:${String(syncCountdown).padStart(2, '0')}`;
}

async function saveCloudData(manual = false) {
  if (!currentUser) return;

  collectCurrentScreenData();
  localDb.updatedAt = new Date().toISOString();
  saveLocalBackup();

  if (manual) {
    selectors.saveButton.disabled = true;
    selectors.saveButton.textContent = 'Salvando...';
  }

  try {
    await setDoc(doc(db, 'MyDaily', currentUser.uid), {
      ...localDb,
      email: currentUser.email,
      updatedAt: serverTimestamp()
    }, { merge: true });

    selectors.lastSync.textContent = `Último sync: ${new Date().toLocaleTimeString('pt-BR')}`;
    syncCountdown = 30;
    setStatus('Dados sincronizados com sucesso.', 'success');
  } catch (error) {
    console.error(error);
    setStatus(getFriendlyFirebaseError(error), 'danger');
  } finally {
    if (manual) {
      selectors.saveButton.disabled = false;
      selectors.saveButton.textContent = 'Salvar';
    }
  }
}

async function loadCloudData(user) {
  const cloudRef = doc(db, 'MyDaily', user.uid);
  const snapshot = await getDoc(cloudRef);

  if (snapshot.exists()) {
    const cloudData = snapshot.data();
    localDb = {
      ...structuredClone(DEFAULT_DB),
      ...cloudData,
      updatedAt: cloudData.updatedAt?.toDate?.()?.toISOString?.() || localDb.updatedAt
    };
  } else {
    localDb = loadLocalBackup();
    await setDoc(cloudRef, {
      ...localDb,
      email: user.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  saveLocalBackup();
  selectors.reportDatePicker.value = currentSelectedDate;
  selectors.userEmail.textContent = user.email;
  renderAll();
  updateCharts();
}

function updateCharts() {
  const labels = [];
  const taskCounts = [];
  const base = new Date(`${currentSelectedDate}T12:00:00`);

  for (let i = 6; i >= 0; i -= 1) {
    const current = new Date(base);
    current.setDate(base.getDate() - i);
    const key = current.toISOString().split('T')[0];
    labels.push(current.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    taskCounts.push(localDb.reports[key]?.tasks?.length || 0);
  }

  const currentData = localDb.reports[currentSelectedDate] || { tasks: [] };
  const totalHrs = currentData.tasks.reduce((acc, task) => acc + (parseFloat(String(task.hour).replace(',', '.')) || 0), 0);

  selectors.kpiTasks.textContent = String(currentData.tasks.length);
  selectors.kpiHours.textContent = totalHrs.toFixed(1);
  selectors.kpiEfficiency.textContent = `${Math.min((totalHrs / 8) * 100, 100).toFixed(0)}%`;

  if (trendChart) trendChart.destroy();
  if (distChart) distChart.destroy();

  trendChart = new Chart(document.getElementById('mainTrendChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Tasks',
        data: taskCounts,
        backgroundColor: '#3d5afe',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#d5d5d5' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#d5d5d5', precision: 0 }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });

  const distributionValues = currentData.tasks.map((task) => parseFloat(String(task.hour).replace(',', '.')) || 0);
  const fallbackValues = distributionValues.some((value) => value > 0) ? distributionValues : currentData.tasks.map(() => 1);
  const fallbackLabels = currentData.tasks.length ? currentData.tasks.map((task) => task.desc.slice(0, 14) || 'Task') : ['Sem tasks'];

  distChart = new Chart(document.getElementById('taskDistributionChart'), {
    type: 'doughnut',
    data: {
      labels: fallbackLabels,
      datasets: [{
        data: currentData.tasks.length ? fallbackValues : [1],
        backgroundColor: ['#00f2ff', '#3d5afe', '#8e24aa', '#ff9100', '#00ff41', '#ff5252'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: '#d5d5d5' }
        }
      }
    }
  });
}

function buildReport() {
  const data = localDb.reports[currentSelectedDate] || { tasks: [], comments: '' };
  const displayDate = currentSelectedDate.split('-').reverse().join('/');
  let text = `🚀 MYDAILY - ${displayDate}\n-------------------------------------------\n\n✅ [TASKS]\n`;

  if (data.tasks.length) {
    data.tasks.forEach((task) => {
      text += `- ${task.desc} (${task.hour || '0'}h)\n`;
    });
  } else {
    text += 'Nenhuma tarefa registrada.\n';
  }

  text += `\n📝 [NOTAS]\n${data.comments || 'Nenhuma nota.'}\n`;
  text += `\n⏳ [ANOTAÇÕES GLOBAIS]\n${localDb.queue || 'Vazio.'}`;
  return text;
}

function getFriendlyFirebaseError(error) {
  const code = error?.code || '';
  const map = {
    'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
    'auth/invalid-credential': 'E-mail ou senha inválidos.',
    'auth/invalid-email': 'O e-mail informado é inválido.',
    'auth/missing-password': 'Informe sua senha.',
    'auth/network-request-failed': 'Falha de rede ao falar com o Firebase.',
    'auth/too-many-requests': 'Muitas tentativas. Tente novamente em instantes.',
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/weak-password': 'Use uma senha com pelo menos 6 caracteres.'
  };
  return map[code] || 'Não foi possível concluir a operação no Firebase.';
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    setStatus('Autenticando...');
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    setStatus(getFriendlyFirebaseError(error), 'danger');
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm-password').value;

  if (password !== confirmPassword) {
    setStatus('As senhas não coincidem.', 'danger');
    return;
  }

  try {
    setStatus('Criando conta...');
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    setStatus(getFriendlyFirebaseError(error), 'danger');
  }
});

resetPasswordButton.addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim() || document.getElementById('register-email').value.trim();
  if (!email) {
    setStatus('Informe um e-mail para redefinir a senha.', 'danger');
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    setStatus('E-mail de recuperação enviado.', 'success');
  } catch (error) {
    setStatus(getFriendlyFirebaseError(error), 'danger');
  }
});

selectors.reportDatePicker.addEventListener('change', async (event) => {
  collectCurrentScreenData();
  currentSelectedDate = event.target.value;
  renderAll();
  updateCharts();
  await saveCloudData();
});

selectors.saveButton.addEventListener('click', async () => {
  await saveCloudData(true);
});

selectors.reportButton.addEventListener('click', async () => {
  collectCurrentScreenData();
  selectors.reportText.value = buildReport();
  reportModal.show();
  await saveCloudData();
});

selectors.copyReportButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(selectors.reportText.value);
  const originalText = selectors.copyReportButton.textContent;
  selectors.copyReportButton.textContent = 'Copiado com sucesso!';
  selectors.copyReportButton.classList.replace('btn-outline-info', 'btn-success');
  window.setTimeout(() => {
    selectors.copyReportButton.textContent = originalText;
    selectors.copyReportButton.classList.replace('btn-success', 'btn-outline-info');
  }, 2000);
});

selectors.logoutButton.addEventListener('click', async () => {
  await saveCloudData();
  await signOut(auth);
});

selectors.queueField.addEventListener('input', saveLocalBackupDebounced);
selectors.notebookField.addEventListener('input', saveLocalBackupDebounced);
selectors.chartsTab.addEventListener('click', () => {
  collectCurrentScreenData();
  updateCharts();
});

let localBackupTimer = null;
function saveLocalBackupDebounced() {
  window.clearTimeout(localBackupTimer);
  localBackupTimer = window.setTimeout(() => {
    collectCurrentScreenData();
    saveLocalBackup();
  }, 300);
}

onAuthStateChanged(auth, async (user) => {
  reportModal = new bootstrap.Modal(document.getElementById('reportModal'));

  if (!user) {
    currentUser = null;
    showScreen('auth');
    selectors.userEmail.textContent = '--';
    selectors.lastSync.textContent = 'Último sync: --:--:--';
    setStatus('Faça login para acessar seu workspace online.');
    return;
  }

  try {
    currentUser = user;
    setStatus('Carregando dados da nuvem...');
    await loadCloudData(user);
    showScreen('app');
    setStatus('Workspace online carregado.', 'success');
  } catch (error) {
    console.error(error);
    setStatus('Falha ao carregar dados do Firestore.', 'danger');
    showScreen('auth');
  }
});

window.setInterval(() => {
  updateSyncClock();
  if (syncCountdown === 0 && currentUser) {
    saveCloudData();
  }
}, 1000);

window.addEventListener('beforeunload', () => {
  collectCurrentScreenData();
  saveLocalBackup();
});
