import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDFTRTBj7WRVn4gG9OwDCPjHP0B_NYFpCc",
  authDomain: "unotfm.firebaseapp.com",
  databaseURL: "https://unotfm-default-rtdb.firebaseio.com",
  projectId: "unotfm",
  storageBucket: "unotfm.firebasestorage.app",
  messagingSenderId: "1035668265410",
  appId: "1:1035668265410:web:710e61682014f9d46a1e5b"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const salaID = localStorage.getItem('salaID');
const meuNick = localStorage.getItem('meuNick');

if (!salaID) {
    window.location.href = "index.html";
}

document.getElementById('displayCodigo').innerText = salaID;

// Fica "escutando" as mudanças na sala no Firebase
const salaRef = ref(db, 'salas/' + salaID);
onValue(salaRef, (snapshot) => {
    const dados = snapshot.val();
    if (dados) {
        // Atualiza lista de jogadores
        const lista = document.getElementById('listaJogadores');
        lista.innerHTML = "";
        
        const jogadores = dados.jogadores;
        for (let j in jogadores) {
            const li = document.createElement('li');
            li.className = "jogador-item";
            li.innerText = "🎴 " + j;
            lista.appendChild(li);
        }

        // Se você for o dono, mostra o botão de começar
        if (dados.dono === meuNick) {
            document.getElementById('btnComeçar').style.display = "block";
            document.getElementById('waitMsg').style.display = "none";
        }
    }
});
