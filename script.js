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
  databaseURL: "https://unotfm-default-rtdb.firebaseio.com" // Link da sua imagem!
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// FORÇANDO A URL DIRETAMENTE NA INICIALIZAÇÃO DO DATABASE
const db = getDatabase(app, "https://unotfm-default-rtdb.firebaseio.com");

console.log("Conectado ao banco:", db.app.options.databaseURL);

const btnCriar = document.getElementById('btnCriar');
const inputNick = document.getElementById('username');

btnCriar.onclick = async () => {
    const nick = inputNick.value.trim();
    if (!nick) return alert("Digite seu apelido!");

    const codigoSala = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    console.log("Tentando gravar sala: " + codigoSala);

    try {
        // Referência direta para evitar erros de caminho
        const salaRef = ref(db, 'salas/' + codigoSala);
        
        await set(salaRef, {
            status: "aguardando",
            dono: nick,
            jogadores: {
                [nick]: { pronto: true }
            }
        });

        console.log("Sala criada com sucesso!");
        localStorage.setItem('meuNick', nick);
        localStorage.setItem('salaID', codigoSala);
        
        // Se ainda não criou a sala.html, ele vai dar erro 404, mas a sala aparecerá no Firebase!
        window.location.href = "sala.html";
    } catch (error) {
        console.error("ERRO CRÍTICO FIREBASE:", error);
        alert("Erro: " + error.message);
    }
};
