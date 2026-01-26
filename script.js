import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDFTRTBj7WRVn4gG9OwDCPjHP0B_NYFpCc",
  authDomain: "unotfm.firebaseapp.com",
  projectId: "unotfm",
  storageBucket: "unotfm.firebasestorage.app",
  messagingSenderId: "1035668265410",
  appId: "1:1035668265410:web:710e61682014f9d46a1e5b",
  measurementId: "G-DRQ1T05JFB",
  // Adicionei a URL abaixo que é essencial para o Realtime Database
  databaseURL: "https://unotfm-default-rtdb.firebaseio.com" 
};

// Inicializa Firebase
console.log("Tentando conectar ao Firebase...");
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Seleciona os botões pelos IDs que colocamos no seu HTML
const btnCriar = document.getElementById('btnCriar');
const btnEntrar = document.getElementById('btnEntrar');
const inputNick = document.getElementById('username');
const inputSala = document.getElementById('roomCode');

// Função para criar a sala
btnCriar.onclick = async () => {
    console.log("Botão Criar clicado!");
    const nick = inputNick.value.trim();
    
    if (!nick) {
        alert("Por favor, digite um apelido!");
        return;
    }

    const codigoSala = Math.random().toString(36).substring(2, 6).toUpperCase();
    console.log("Gerando sala: " + codigoSala);

    try {
        await set(ref(db, 'salas/' + codigoSala), {
            status: "aguardando",
            dono: nick,
            jogadores: {
                [nick]: { pronto: true }
            }
        });
        
        console.log("Sucesso no Firebase!");
        localStorage.setItem('meuNick', nick);
        localStorage.setItem('salaID', codigoSala);
        window.location.href = "sala.html";
        
    } catch (error) {
        console.error("Erro detalhado:", error);
        alert("Erro ao criar sala. Verifique se o Realtime Database está em 'Modo de Teste'.");
    }
};

// Função para entrar
btnEntrar.onclick = async () => {
    const nick = inputNick.value.trim();
    const codigo = inputSala.value.trim().toUpperCase();

    if (!nick || !codigo) {
        alert("Preencha o nick e o código!");
        return;
    }

    const snapshot = await get(child(ref(db), `salas/${codigo}`));
    if (snapshot.exists()) {
        await set(ref(db, `salas/${codigo}/jogadores/${nick}`), { pronto: true });
        localStorage.setItem('meuNick', nick);
        localStorage.setItem('salaID', codigo);
        window.location.href = "sala.html";
    } else {
        alert("Sala não encontrada!");
    }
};
