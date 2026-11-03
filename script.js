// ==================== 1. CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE ====================
const firebaseConfig = {
  apiKey: "AIzaSyBWDR_x3xZeYKMuF7Zs4f1SLSxX1BjdFWA",
  authDomain: "modular-344d1.firebaseapp.com",
  projectId: "modular-344d1",
  storageBucket: "modular-344d1.firebasestorage.app",
  messagingSenderId: "553880715300",
  appId: "1:553880715300:web:e0289a416109f8da79d8b1",
  measurementId: "G-QK2H7JCK35"
};

// Configuración del correo Administrador
const ADMIN_EMAIL = "roblesb921@gmail.com";

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let chartInstance = null;
let unsubscribeLecturas = null;
let targetUserId = null; // ID del usuario consultado o simulado

// ==================== 2. CONTROL DEL ESTADO DE AUTENTICACIÓN ====================
auth.onAuthStateChanged((user) => {
  if (user) {
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) userDisplay.innerText = user.email;

    document.getElementById('login-section')?.classList.add('hidden');
    document.getElementById('dashboard-section')?.classList.remove('hidden');

    initChart();

    const adminSelector = document.getElementById('admin-selector-container');
    const adminButtons = document.getElementById('admin-simulation-buttons');

    // Comprobación de correo admin (sin distinguir mayúsculas/minúsculas)
    const esAdminPorEmail = user.email && (user.email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase());

    if (esAdminPorEmail) {
      if (adminSelector) adminSelector.classList.remove('hidden');
      if (adminButtons) adminButtons.classList.remove('hidden');
      cargarListaUsuariosAdmin(user.uid);
    } else {
      if (adminSelector) adminSelector.classList.add('hidden');
      if (adminButtons) adminButtons.classList.add('hidden');
      targetUserId = user.uid;
      escucharLecturasEnTiempoReal();
    }
  } else {
    document.getElementById('login-section')?.classList.remove('hidden');
    document.getElementById('dashboard-section')?.classList.add('hidden');

    if (unsubscribeLecturas) unsubscribeLecturas();
  }
});

// ==================== 3. FUNCIONES DE ADMINISTRADOR ====================
function cargarListaUsuariosAdmin(currentAdminUid) {
  const select = document.getElementById('select-user');
  if (!select) return;

  db.collection('usuarios').get().then((querySnapshot) => {
    select.innerHTML = '';

    querySnapshot.forEach((doc) => {
      const uData = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = uData.email || doc.id;

      if (doc.id === currentAdminUid) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    targetUserId = select.value || currentAdminUid;
    escucharLecturasEnTiempoReal();
  }).catch((error) => console.error("Error al cargar la lista de usuarios: ", error));
}

function cambiarUsuarioConsultado(newUserId) {
  if (!newUserId) return;
  targetUserId = newUserId;
  escucharLecturasEnTiempoReal();

  const historyTab = document.getElementById('view-history');
  if (historyTab && !historyTab.classList.contains('hidden')) {
    cargarHistorialCompleto();
  }
}

// ==================== 4. AUTENTICACIÓN Y REGISTRO ====================
function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('error-message');

  if (errorMsg) errorMsg.style.display = 'none';

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      document.getElementById('email').value = '';
      document.getElementById('password').value = '';
    })
    .catch((error) => {
      if (errorMsg) {
        errorMsg.innerText = "Error: Email o contraseña incorrectos.";
        errorMsg.style.display = 'block';
      }
    });
}

function loginConGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  const errorMsg = document.getElementById('error-message');

  if (errorMsg) errorMsg.style.display = 'none';

  auth.signInWithPopup(provider)
    .then((result) => {
      const user = result.user;
      return db.collection('usuarios').doc(user.uid).set({
        email: user.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    })
    .catch((error) => {
      if (errorMsg) {
        errorMsg.innerText = "Error al conectar con Google: " + error.message;
        errorMsg.style.display = 'block';
      }
    });
}

function logout() {
  auth.signOut();
}

let isRegisterMode = false;

function toggleAuthMode(event) {
  event.preventDefault();
  isRegisterMode = !isRegisterMode;

  const authTitle = document.getElementById('auth-title');
  const authSubtitle = document.getElementById('auth-subtitle');
  const btnSubmit = document.getElementById('btn-auth-submit');
  const toggleText = document.getElementById('toggle-text');
  const toggleLink = document.getElementById('toggle-link');
  const errorMsg = document.getElementById('error-message');
  const successMsg = document.getElementById('success-message');

  if (errorMsg) errorMsg.style.display = 'none';
  if (successMsg) successMsg.style.display = 'none';

  if (isRegisterMode) {
    if (authTitle) authTitle.innerText = 'Crear Cuenta';
    if (authSubtitle) authSubtitle.innerText = 'Regístrate para ver tu monitoreo postural';
    if (btnSubmit) btnSubmit.innerText = 'Registrarse';
    if (toggleText) toggleText.innerText = '¿Ya tienes una cuenta?';
    if (toggleLink) toggleLink.innerText = 'Iniciar Sesión';
  } else {
    if (authTitle) authTitle.innerText = 'Iniciar Sesión';
    if (authSubtitle) authSubtitle.innerText = 'Plataforma de Monitoreo de Sensores';
    if (btnSubmit) btnSubmit.innerText = 'Ingresar al Panel';
    if (toggleText) toggleText.innerText = '¿No tienes una cuenta?';
    if (toggleLink) toggleLink.innerText = 'Registrarse';
  }
}

function handleSubmit() {
  if (isRegisterMode) {
    registrarUsuario();
  } else {
    login();
  }
}

function registrarUsuario() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('error-message');
  const successMsg = document.getElementById('success-message');

  if (errorMsg) errorMsg.style.display = 'none';
  if (successMsg) successMsg.style.display = 'none';

  if (!email || !password) {
    if (errorMsg) {
      errorMsg.innerText = "Por favor completa todos los campos.";
      errorMsg.style.display = 'block';
    }
    return;
  }

  auth.createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      return db.collection('usuarios').doc(user.uid).set({
        email: user.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    })
    .then(() => {
      if (successMsg) {
        successMsg.innerText = "¡Cuenta creada con éxito!";
        successMsg.style.display = 'block';
      }
    })
    .catch((error) => {
      if (!errorMsg) return;
      errorMsg.innerText = "Error: " + error.message;
      errorMsg.style.display = 'block';
    });
}

// ==================== 5. INICIALIZACIÓN DE CHART.JS ====================
function initChart() {
  if (chartInstance) return;

  const canvas = document.getElementById('realtimeChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Flex (°)', data: [], borderColor: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.1)', tension: 0.3, fill: true },
        { label: 'EMG (%)', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.3, fill: true },
        { label: 'Activación Motor', data: [], borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', tension: 0.3, fill: true }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// ==================== 6. LECTURAS EN TIEMPO REAL (FIRESTORE) ====================
function escucharLecturasEnTiempoReal() {
  if (!targetUserId) return;
  if (unsubscribeLecturas) unsubscribeLecturas();

  // Consulta ordenada por 'creadoEn' para obtener las 10 lecturas más recientes
  unsubscribeLecturas = db.collection('lecturas')
    .where('userId', '==', targetUserId)
    .orderBy('creadoEn', 'desc')
    .limit(10)
    .onSnapshot((snapshot) => {
      const registros = [];
      snapshot.forEach((doc) => {
        registros.push({ id: doc.id, ...doc.data() });
      });

      // Invertir arreglo para graficar en secuencia temporal (pasado -> presente)
      registros.reverse();

      if (registros.length > 0) {
        const ultimo = registros[registros.length - 1];

        const val1 = document.getElementById('val1');
        const val2 = document.getElementById('val2');
        const val3 = document.getElementById('val3');

        if (val1) val1.innerText = ultimo.flex !== undefined ? `${ultimo.flex}°` : '--';
        if (val2) val2.innerText = ultimo.mg !== undefined ? `${ultimo.mg}%` : '--';
        if (val3) val3.innerText = ultimo.activacionMotor === 1 ? '🟢 Activado (1)' : '⚪ Apagado (0)';

        const labels = registros.map(r => r.fecha || 'Sin fecha');

        if (chartInstance) {
          chartInstance.data.labels = labels;
          chartInstance.data.datasets[0].data = registros.map(r => r.flex);
          chartInstance.data.datasets[1].data = registros.map(r => r.mg);
          chartInstance.data.datasets[2].data = registros.map(r => r.activacionMotor);
          chartInstance.update();
        }
      } else {
        const val1 = document.getElementById('val1');
        const val2 = document.getElementById('val2');
        const val3 = document.getElementById('val3');

        if (val1) val1.innerText = '--';
        if (val2) val2.innerText = '--';
        if (val3) val3.innerText = '--';

        if (chartInstance) {
          chartInstance.data.labels = [];
          chartInstance.data.datasets.forEach(ds => ds.data = []);
          chartInstance.update();
        }
      }

      renderizarTablaHistorial(registros);
    }, (error) => console.error("Error al obtener lecturas en tiempo real: ", error));
}

// ==================== 7. SIMULACIÓN Y REGISTRO POSTURAL ====================
function simularLectura(estado) {
  const selectElement = document.getElementById('select-user');
  
  if (selectElement && selectElement.value) {
    targetUserId = selectElement.value;
  } else if (auth.currentUser) {
    targetUserId = auth.currentUser.uid;
  }

  if (!targetUserId) {
    alert("Por favor selecciona un usuario para enviarle la simulación.");
    return;
  }

  let rawFlex = 0;
  let rawEMG = 0;

  switch (estado) {
    case 'critico':
      // Flexión severa / crítica (80° a 90°)
      rawFlex = Math.floor(Math.random() * (1066 - 800 + 1)) + 800;
      rawEMG = Math.floor(Math.random() * (1500 - 1200 + 1)) + 1200;
      break;

    case 'muy_flexionado':
      // Flexión pronunciada (70° a 80°)
      rawFlex = Math.floor(Math.random() * (1333 - 1067 + 1)) + 1067;
      rawEMG = Math.floor(Math.random() * (1199 - 900 + 1)) + 900;
      break;

    case 'poco_flexionado':
      // Flexión leve / en el límite (60° a 70°)
      rawFlex = Math.floor(Math.random() * (1599 - 1334 + 1)) + 1334;
      rawEMG = Math.floor(Math.random() * (899 - 640 + 1)) + 640;
      break;

    case 'poco_recto':
      // Desviación ligera (40° a 60°)
      rawFlex = Math.floor(Math.random() * (2133 - 1600 + 1)) + 1600;
      rawEMG = Math.floor(Math.random() * (639 - 450 + 1)) + 450;
      break;

    case 'recto':
      // Buena postura (20° a 40°)
      rawFlex = Math.floor(Math.random() * (2666 - 2134 + 1)) + 2134;
      rawEMG = Math.floor(Math.random() * (449 - 250 + 1)) + 250;
      break;

    case 'muy_recto':
      // Postura excelente (0° a 20°)
      rawFlex = Math.floor(Math.random() * (3200 - 2667 + 1)) + 2667;
      rawEMG = Math.floor(Math.random() * (249 - 100 + 1)) + 100;
      break;

    default:
      console.warn("Estado de simulación no reconocido.");
      return;
  }

  // Mapeo a Ángulos (Flex: 3200 = 0°, 800 = 90°)
  let flexVal = ((3200 - rawFlex) / (3200 - 800)) * 90;
  flexVal = Math.max(0, Math.min(90, flexVal));

  // Mapeo a Porcentaje (EMG: 100 = 0%, 1500 = 100%)
  let mgVal = ((rawEMG - 100) / (1500 - 100)) * 100;
  mgVal = Math.max(0, Math.min(100, mgVal));

  // EVALUACIÓN DE ACTIVACIÓN DEL MOTOR (Activo únicamente en estados flexionados)
  let activacionMotor = (rawFlex < 1600 && rawEMG >= 640) ? 1 : 0;

  // Fecha visible (YYYY-MM-DD)
  const hoy = new Date();
  const fechaSinHora = hoy.toISOString().split('T')[0];

  const lectura = {
    userId: targetUserId,
    flex: parseFloat(flexVal.toFixed(1)),
    mg: parseFloat(mgVal.toFixed(1)),
    activacionMotor: activacionMotor,
    fecha: fechaSinHora,
    creadoEn: Date.now() // Ordenamiento cronológico preciso por milisegundos
  };

  db.collection('lecturas').add(lectura)
    .then((docRef) => console.log(`Lectura [${estado}] enviada a Firestore para ${targetUserId} | ID:`, docRef.id))
    .catch((err) => console.error("Error al guardar en Firestore: ", err));
}

// ==================== 8. NAVEGACIÓN Y HISTORIAL COMPLETO ====================
function switchTab(viewId, element) {
  document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
  const targetView = document.getElementById(viewId);
  if (targetView) targetView.classList.remove('hidden');

  document.querySelectorAll('.sidebar nav a').forEach(link => link.classList.remove('active'));
  if (element) element.classList.add('active');

  if (viewId === 'view-history') {
    cargarHistorialCompleto();
  }
}

function cargarHistorialCompleto() {
  if (!targetUserId) return;

  const tableBody = document.getElementById('history-table-body') || document.getElementById('tabla-historial-body');
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Cargando registros...</td></tr>`;

  db.collection('lecturas')
    .where('userId', '==', targetUserId)
    .orderBy('creadoEn', 'desc')
    .limit(50)
    .get()
    .then((querySnapshot) => {
      const lecturas = [];
      querySnapshot.forEach((doc) => lecturas.push(doc.data()));
      renderizarTablaHistorial(lecturas);
    })
    .catch((error) => {
      console.error("Error al cargar historial: ", error);
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ef4444;">Error al obtener datos.</td></tr>`;
    });
}

function renderizarTablaHistorial(lecturas) {
  const tableBody = document.getElementById('history-table-body') || document.getElementById('tabla-historial-body');
  if (!tableBody) return;

  if (!lecturas || lecturas.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No hay lecturas registradas para este usuario.</td></tr>`;
    return;
  }

  tableBody.innerHTML = '';

  lecturas.forEach((item) => {
    const fechaTexto = item.fecha || "Sin fecha";
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${fechaTexto}</strong></td>
      <td>${item.flex !== undefined ? `${item.flex}°` : '--'}</td>
      <td>${item.mg !== undefined ? `${item.mg}%` : '--'}</td>
      <td>${item.activacionMotor === 1 ? '🟢 Activado (1)' : '⚪ Apagado (0)'}</td>
    `;
    tableBody.appendChild(tr);
  });
}

// ==================== 9. CONTROL CON MOUSE ATTACK SHARK X11 ====================
let wheelClickTimer = null;

document.addEventListener('mousedown', (event) => {
  const adminButtons = document.getElementById('admin-simulation-buttons');
  if (!adminButtons || adminButtons.classList.contains('hidden')) return;

  const targetTag = event.target.tagName.toLowerCase();
  if (['select', 'input', 'option', 'a'].includes(targetTag)) return;

  if ([1, 2, 3, 4].includes(event.button)) {
    event.preventDefault();
  }

  switch (event.button) {
    case 0: // Clic Izquierdo
      if (targetTag !== 'button') simularLectura('poco_recto');
      break;

    case 1: // Clic Central / Rueda (Un Clic vs Doble Clic)
      if (wheelClickTimer === null) {
        wheelClickTimer = setTimeout(() => {
          simularLectura('muy_flexionado');
          wheelClickTimer = null;
        }, 250);
      } else {
        clearTimeout(wheelClickTimer);
        wheelClickTimer = null;
        simularLectura('critico');
      }
      break;

    case 2: // Clic Derecho
      simularLectura('poco_flexionado');
      break;

    case 4: // Lateral Adelante
      simularLectura('recto');
      break;

    case 3: // Lateral Atrás
      simularLectura('muy_recto');
      break;
  }
});

// Desactivar menú contextual del clic derecho en modo simulación
document.addEventListener('contextmenu', (event) => {
  const adminButtons = document.getElementById('admin-simulation-buttons');
  if (adminButtons && !adminButtons.classList.contains('hidden')) {
    event.preventDefault();
  }
});