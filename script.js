// 1. Importações necessárias via CDN (Web SDK)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 2. Sua configuração (que você acabou de pegar)
const firebaseConfig = {
  apiKey: "AIzaSyDFTRTBj7WRVn4gG9OwDCPjHP0B_NYFpCc",
  authDomain: "unotfm.firebaseapp.com",
  projectId: "unotfm",
  storageBucket: "unotfm.firebasestorage.app",
  messagingSenderId: "1035668265410",
  appId: "1:1035668265410:web:710e61682014f9d46a1e5b",
  measurementId: "G-DRQ1T05JFB",
  databaseURL: "https://unotfm-default-rtdb.firebaseio.com" // Verifique se esta é a URL correta no seu console
};

// 3. Inicializa o Firebase e o Banco de Dados
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- LÓGICA DO LOBBY ---

// Captura os elementos da tela
const btnCriar = document.querySelector('.btn-play:not(.btn-join)');
const btnEntrar = document.querySelector('.btn-join');
const inputNick = document.getElementById('username');
const inputSala = document.getElementById('roomCode');

// Gerar código de sala curto (ex: AB12)
function gerarCodigo() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Botão CRIAR MESA
btnCriar.onclick = async () => {
    const nick = inputNick.value.trim();
    if (!nick) return alert("Digite seu apelido!");

    const codigoSala = gerarCodigo();

    try {
        // Cria a sala no Firebase
        await set(ref(db, 'salas/' + codigoSala), {
            status: "aguardando",
            dono: nick,
            cartasNaMesa: "7_blue", // Carta inicial exemplo
            jogadores: {
                [nick]: { pronto: true, cartas: 0 }
            }
        });

        // Salva localmente para a próxima página saber quem é você
        localStorage.setItem('meuNick', nick);
        localStorage.setItem('salaID', codigoSala);
        
        window.location.href = "sala.html";
    } catch (error) {
        console.error("Erro ao criar sala:", error);
        alert("Erro ao conectar ao Firebase. Verifique as Regras do Banco!");
    }
};

// Botão ENTRAR NA SALA
btnEntrar.onclick = async () => {
    const nick = inputNick.value.trim();
    const codigo = inputSala.value.trim().toUpperCase();

    if (!nick || !codigo) return alert("Preencha o nick e o código da sala!");

    // Verifica se a sala existe
    const snapshot = await get(child(ref(db), `salas/${codigo}`));
    
    if (snapshot.exists()) {
        // Adiciona você na sala
        await set(ref(db, `salas/${codigo}/jogadores/${nick}`), {
            pronto: true,
            cartas: 0
        });

        localStorage.setItem('meuNick', nick);
        localStorage.setItem('salaID', codigo);
        window.location.href = "sala.html";
    } else {
        alert("Sala não encontrada!");
    }
};
