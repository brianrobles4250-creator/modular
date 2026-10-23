// 1. Configuración de Firebase
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
const ADMIN_EMAIL = "roblesb921@gmail.com"; // <--- Reemplaza con tu correo admin

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let chartInstance = null;
let unsubscribeLecturas = null;
let targetUserId = null; // ID del usuario del cual estamos viendo los datos

// 2. Control del Estado de Autenticación en Tiempo Real
auth.onAuthStateChanged((user) => {
  if (user) {
    document.getElementById('user-display').innerText = user.email;
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');

    initChart();

    // Si el usuario es el administrador, mostramos el selector
    if (user.email === ADMIN_EMAIL) {
      document.getElementById('admin-selector-container').classList.remove('hidden');
      cargarListaUsuariosAdmin(user.uid);
    } else {
      document.getElementById('admin-selector-container').classList.add('hidden');
      targetUserId = user.uid;
      escucharDatosEnTiempoReal(targetUserId);
    }
  } else {
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
    
    if (unsubscribeLecturas) unsubscribeLecturas();
  }
});

// 3. Funciones de Administrador
function cargarListaUsuariosAdmin(currentAdminUid) {
  const select = document.getElementById('select-user');
  
  db.collection('usuarios').get().then((querySnapshot) => {
    select.innerHTML = '';
    
    querySnapshot.forEach((doc) => {
      const uData = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = uData.email || doc.id;
      
      // Seleccionar por defecto al admin al cargar
      if (doc.id === currentAdminUid) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    targetUserId = select.value || currentAdminUid;
    escucharDatosEnTiempoReal(targetUserId);
  }).catch((error) => {
    console.error("Error al cargar la lista de usuarios: ", error);
  });
}

function cambiarUsuarioConsultado(newUserId) {
  if (!newUserId) return;
  targetUserId = newUserId;
  
  // Reiniciar escucha para el nuevo usuario seleccionado
  escucharDatosEnTiempoReal(targetUserId);

  // Si estamos en la pestaña de historial, reloaded tabla
  const historyTab = document.getElementById('view-history');
  if (!historyTab.classList.contains('hidden')) {
    cargarHistorialCompleto();
  }
}

// 4. Autenticación (Login y Logout)
function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('error-message');

  errorMsg.style.display = 'none';

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      document.getElementById('email').value = '';
      document.getElementById('password').value = '';
    })
    .catch((error) => {
      errorMsg.innerText = "Error: Email o contraseña incorrectos.";
      errorMsg.style.display = 'block';
    });
}

function logout() {
  auth.signOut();
}

// 5. Registro de Nuevos Usuarios
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

  errorMsg.style.display = 'none';
  successMsg.style.display = 'none';

  if (isRegisterMode) {
    authTitle.innerText = 'Crear Cuenta';
    authSubtitle.innerText = 'Regístrate para vincular tu sensor ESP32';
    btnSubmit.innerText = 'Registrarse';
    toggleText.innerText = '¿Ya tienes una cuenta?';
    toggleLink.innerText = 'Iniciar Sesión';
  } else {
    authTitle.innerText = 'Iniciar Sesión';
    authSubtitle.innerText = 'Plataforma de Monitoreo de Sensores';
    btnSubmit.innerText = 'Ingresar al Panel';
    toggleText.innerText = '¿No tienes una cuenta?';
    toggleLink.innerText = 'Registrarse';
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

  errorMsg.style.display = 'none';
  successMsg.style.display = 'none';

  if (!email || !password) {
    errorMsg.innerText = "Por favor completa todos los campos.";
    errorMsg.style.display = 'block';
    return;
  }

  auth.createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      
      // Guardar el usuario en la colección 'usuarios' para que el admin pueda verlo en la lista
      return db.collection('usuarios').doc(user.uid).set({
        email: user.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    })
    .then(() => {
      successMsg.innerText = "¡Cuenta creada con éxito!";
      successMsg.style.display = 'block';
    })
    .catch((error) => {
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMsg.innerText = "El correo electrónico ya está registrado.";
          break;
        case 'auth/weak-password':
          errorMsg.innerText = "La contraseña debe tener al menos 6 caracteres.";
          break;
        case 'auth/invalid-email':
          errorMsg.innerText = "El formato de correo electrónico no es válido.";
          break;
        default:
          errorMsg.innerText = "Error al registrar usuario: " + error.message;
      }
      errorMsg.style.display = 'block';
    });
}

// 6. Configuración e Inicialización de Chart.js
function initChart() {
  if (chartInstance) return;

  const ctx = document.getElementById('realtimeChart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Flex',
          data: [],
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          tension: 0.3,
          fill: true
        },
        {
          label: 'MG',
          data: [],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.3,
          fill: true
        },
        {
          label: 'Variable del día',
          data: [],
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.3,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        y: { beginAtZero: false }
      }
    }
  });
}

// 7. Escuchar Lecturas de la Base de Datos en Tiempo Real por Usuario Consultada
function escucharDatosEnTiempoReal(userId) {
  if (unsubscribeLecturas) unsubscribeLecturas();

  unsubscribeLecturas = db.collection('lecturas')
    .where('userId', '==', userId)
    .orderBy('timestamp', 'desc')
    .limit(10)
    .onSnapshot((snapshot) => {
      const registros = [];
      snapshot.forEach((doc) => {
        registros.push(doc.data());
      });

      registros.reverse();

      if (registros.length > 0) {
        const ultimo = registros[registros.length - 1];
        document.getElementById('val1').innerText = ultimo.flex !== undefined ? ultimo.flex : '--';
        document.getElementById('val2').innerText = ultimo.mg !== undefined ? ultimo.mg : '--';
        document.getElementById('val3').innerText = ultimo.variableDia !== undefined ? ultimo.variableDia : '--';

        const labels = registros.map(r => {
          if (r.timestamp && typeof r.timestamp.toDate === 'function') {
            return r.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          }
          return 'Ahora';
        });

        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = registros.map(r => r.flex);
        chartInstance.data.datasets[1].data = registros.map(r => r.mg);
        chartInstance.data.datasets[2].data = registros.map(r => r.variableDia);
        chartInstance.update();
      } else {
        // Limpiar tarjeta y gráfica si el usuario seleccionado no tiene datos
        document.getElementById('val1').innerText = '--';
        document.getElementById('val2').innerText = '--';
        document.getElementById('val3').innerText = '--';
        chartInstance.data.labels = [];
        chartInstance.data.datasets.forEach(ds => ds.data = []);
        chartInstance.update();
      }
    }, (error) => {
      console.error("Error al obtener lecturas: ", error);
    });
}

// 8. Simulación de Envío de Datos (Asociados al Usuario Seleccionado)
function generarLecturaPrueba() {
  if (!targetUserId) {
    alert("No hay un usuario activo o seleccionado.");
    return;
  }

  const nuevaLectura = {
    userId: targetUserId,
    flex: parseFloat((Math.random() * (90 - 10) + 10).toFixed(2)),
    mg: parseFloat((Math.random() * (50 - 5) + 5).toFixed(2)),
    variableDia: parseFloat((Math.random() * (100 - 20) + 20).toFixed(2)),
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection('lecturas').add(nuevaLectura)
    .then((docRef) => {
      console.log("Lectura simulada agregada con ID: ", docRef.id);
    })
    .catch((error) => {
      console.error("Error al agregar lectura de prueba: ", error);
    });
}

// 9. Navegación entre Pestañas
function switchTab(viewId, element) {
  document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
  document.getElementById(viewId).classList.remove('hidden');

  document.querySelectorAll('.sidebar nav a').forEach(link => link.classList.remove('active'));
  element.classList.add('active');

  if (viewId === 'view-history') {
    cargarHistorialCompleto();
  }
}

// 10. Cargar Historial Completo del Usuario Seleccionado
function cargarHistorialCompleto() {
  if (!targetUserId) return;

  const tableBody = document.getElementById('history-table-body');
  tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Cargando registros...</td></tr>`;

  db.collection('lecturas')
    .where('userId', '==', targetUserId)
    .orderBy('timestamp', 'desc')
    .limit(50)
    .get()
    .then((querySnapshot) => {
      if (querySnapshot.empty) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No hay lecturas registradas para este usuario.</td></tr>`;
        return;
      }

      let rowsHtml = '';
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        let fecha = 'Sin fecha';
        
        if (data.timestamp && typeof data.timestamp.toDate === 'function') {
          fecha = data.timestamp.toDate().toLocaleString([], { 
            dateStyle: 'short', 
            timeStyle: 'medium' 
          });
        }

        rowsHtml += `
          <tr>
            <td><strong>${fecha}</strong></td>
            <td>${data.flex !== undefined ? data.flex : '--'}</td>
            <td>${data.mg !== undefined ? data.mg : '--'}</td>
            <td>${data.variableDia !== undefined ? data.variableDia : '--'}</td>
          </tr>
        `;
      });

      tableBody.innerHTML = rowsHtml;
    })
    .catch((error) => {
      console.error("Error al cargar historial: ", error);
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ef4444;">Error al obtener datos.</td></tr>`;
    });
}

// Función para iniciar sesión o registrarse con Google
function loginConGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  const errorMsg = document.getElementById('error-message');
  
  if (errorMsg) errorMsg.style.display = 'none';

  auth.signInWithPopup(provider)
    .then((result) => {
      const user = result.user;
      
      // Registrar/actualizar documento del usuario en Firestore para que el Admin lo pueda ver
      return db.collection('usuarios').doc(user.uid).set({
        email: user.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    })
    .catch((error) => {
      console.error("Error al iniciar sesión con Google: ", error);
      if (errorMsg) {
        errorMsg.innerText = "Error al conectar con Google: " + error.message;
        errorMsg.style.display = 'block';
      }
    });
}

// ==================== LÓGICA DE CONEXIÓN BLUETOOTH ====================
let portBT = null;
let readerBT = null;

async function conectarBluetooth() {
  const btn = document.getElementById('btn-bluetooth');

  // Verificar soporte de Web Serial API en el navegador (Chrome/Edge)
  if (!("serial" in navigator)) {
    alert("Tu navegador no soporta la conexión Serial/Bluetooth. Utiliza Google Chrome o Microsoft Edge.");
    return;
  }

  try {
    // Abrir ventana emergente para seleccionar el puerto/dispositivo ESP32
    portBT = await navigator.serial.requestPort();
    await portBT.open({ baudRate: 115200 });

    btn.innerText = "🔴 Desconectar Bluetooth";
    btn.style.backgroundColor = "#ef4444";
    btn.onclick = desconectarBluetooth;

    leerDatosBluetooth();
  } catch (error) {
    console.error("Error al conectar por Bluetooth: ", error);
  }
}

async function leerDatosBluetooth() {
  const textDecoder = new TextDecoderStream();
  const readableStreamClosed = portBT.readable.pipeTo(textDecoder.writable);
  readerBT = textDecoder.readable.getReader();

  let lineBuffer = "";

  while (true) {
    const { value, done } = await readerBT.read();
    if (done) {
      readerBT.releaseLock();
      break;
    }
    
    lineBuffer += value;
    const lines = lineBuffer.split("\n");
    lineBuffer = lines.pop();

    for (const line of lines) {
      const mensaje = line.trim();

      // Detectar mensajes de calibración
      if (mensaje === "INICIO_CALIBRACION") {
        console.log("⚙️ El ESP32 ha iniciado la secuencia de calibración.");
        continue;
      }
      
      if (mensaje === "FIN_CALIBRACION") {
        alert("✅ ¡Calibración completada y guardada en la memoria Flash del ESP32!");
        continue;
      }

      // Procesar datos de lecturas normales (flex,emg,variableDia)
      const datos = mensaje.split(",");
      if (datos.length === 3) {
        const flexVal = parseFloat(datos[0]);
        const mgVal = parseFloat(datos[1]);
        const varDiaVal = parseFloat(datos[2]);

        guardarLecturaBluetooth(flexVal, mgVal, varDiaVal);
      }
    }
  }
}

function guardarLecturaBluetooth(flex, mg, varDia) {
  if (!targetUserId) return;

  const lectura = {
    userId: targetUserId,
    flex: flex,
    mg: mg,
    variableDia: varDia,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection('lecturas').add(lectura)
    .catch((err) => console.error("Error al guardar lectura por Bluetooth: ", err));
}

async function desconectarBluetooth() {
  if (readerBT) {
    await readerBT.cancel();
  }
  if (portBT) {
    await portBT.close();
  }

  const btn = document.getElementById('btn-bluetooth');
  btn.innerText = "🔵 Conectar ESP32 (Bluetooth)";
  btn.style.backgroundColor = "#2563eb";
  btn.onclick = conectarBluetooth;
}

// ==================== ENVIAR COMANDO DE CALIBRACIÓN ====================
async function enviarComandoCalibrar() {
  if (!portBT || !portBT.writable) {
    alert("Primero debes conectar el ESP32 por Bluetooth.");
    return;
  }

  const confirmacion = confirm(
    "Iniciando secuencia de calibración:\n\n" +
    "1. Tendrás 5 seg para relajar el cuello.\n" +
    "2. 3 seg para hacer fuerza máxima hacia atrás.\n" +
    "3. 3 seg para mantener la cabeza recta.\n" +
    "4. 3 seg para mirar hacia abajo al máximo.\n\n" +
    "¿Deseas comenzar ahora?"
  );

  if (!confirmacion) return;

  try {
    const textEncoder = new TextEncoderStream();
    const writableStreamClosed = textEncoder.readable.pipeTo(portBT.writable);
    const writer = textEncoder.writable.getWriter();

    // Enviar el comando exacto que espera el ESP32
    await writer.write("calibrar\n");
    writer.releaseLock();

    console.log("Comando 'calibrar' enviado al ESP32.");
    alert("Calibración iniciada en el ESP32. Sigue las instrucciones del dispositivo.");
  } catch (error) {
    console.error("Error al enviar el comando de calibración: ", error);
    alert("No se pudo enviar el comando por Bluetooth.");
  }
}