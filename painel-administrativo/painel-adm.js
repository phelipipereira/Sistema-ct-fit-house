const CHAVE = "ctfithouse_aulas";
const CHAVE_PROF = "ctfithouse_professores";
const MAX_VAGAS = 5;        // RN12
const MAX_AULAS_DIA = 2;    // RN14

let aulas = carregarAulas();
let professores = carregarProfessores();


/* ---------- Dados ---------- */

function dataRelativa(dias) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
}

function criarInscritos(nomes, qtdConfirmadas) {
    return nomes.map(function (nome, i) {
        return { nome: nome, status: i < qtdConfirmadas ? "confirmada" : "agendada", presenca: null };
    });
}

function aulasIniciais() {
    return [
        { id: 1, data: dataRelativa(0), inicio: "08:00", fim: "09:00", professores: ["Iago"], status: "agendada",
          inscritos: criarInscritos(["Ana Souza", "Bruno Lima", "Carla Mendes"], 2) },
        { id: 2, data: dataRelativa(1), inicio: "17:00", fim: "18:00", professores: ["Matheus"], status: "agendada",
          inscritos: criarInscritos(["Diego Alves", "Elisa Rocha"], 1) },
        { id: 3, data: dataRelativa(2), inicio: "08:00", fim: "09:00", professores: ["Iago", "Matheus"], status: "agendada",
          inscritos: criarInscritos(["Felipe Costa", "Gabriela Nunes", "Hugo Pires", "Isabela Reis", "João Teixeira"], 3) },
        { id: 4, data: dataRelativa(3), inicio: "18:00", fim: "19:00", professores: ["Matheus"], status: "agendada",
          inscritos: criarInscritos(["Karen Dias", "Lucas Moraes"], 2) }
    ];
}

function carregarAulas() {
    try {
        const salvo = localStorage.getItem(CHAVE);
        if (salvo) return JSON.parse(salvo);
    } catch (erro) { /* usa os dados iniciais */ }
    return aulasIniciais();
}

function salvarAulas() {
    try {
        localStorage.setItem(CHAVE, JSON.stringify(aulas));
    } catch (erro) { /* sem armazenamento: segue só em memória */ }
}


/* ---------- Funções auxiliares ---------- */

function esc(texto) {
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
}

function formatarData(data) {
    const partes = data.split("-");
    return partes[2] + "/" + partes[1];
}

function inscritosAtivos(aula) {
    return aula.inscritos.filter(function (i) { return i.status !== "cancelada"; });
}

function aulaIniciada(aula) {
    return new Date(aula.data + "T" + aula.inicio) <= new Date();
}

function ordenadas(lista) {
    return lista.slice().sort(function (a, b) {
        return (a.data + a.inicio).localeCompare(b.data + b.inicio);
    });
}

function avisar(mensagem) {
    const toast = document.querySelector("#aviso-toast");
    toast.textContent = mensagem;
    toast.classList.add("visivel");
    setTimeout(function () { toast.classList.remove("visivel"); }, 3000);
}


/* ---------- Renderização ---------- */

function celulaInscritos(aula) {
    return inscritosAtivos(aula).length + "/" + MAX_VAGAS;
}

function renderResumo() {
    const futuras = aulas.filter(function (a) { return a.status === "agendada"; });
    let inscritos = 0;
    let confirmadas = 0;

    futuras.forEach(function (a) {
        inscritos += inscritosAtivos(a).length;
        confirmadas += a.inscritos.filter(function (i) { return i.status === "confirmada"; }).length;
    });

    document.querySelector("#resumo-aulas").textContent = String(futuras.length).padStart(2, "0");
    document.querySelector("#resumo-inscritos").textContent = String(inscritos).padStart(2, "0");
    document.querySelector("#resumo-confirmacoes").textContent = String(confirmadas).padStart(2, "0");
}

function renderProximas() {
    const corpo = document.querySelector("#tabela-proximas");
    const proximas = ordenadas(aulas.filter(function (a) { return a.status === "agendada"; })).slice(0, 3);

    if (proximas.length === 0) {
        corpo.innerHTML = '<tr><td colspan="4" class="vazio">Nenhuma aula agendada.</td></tr>';
        return;
    }

    corpo.innerHTML = proximas.map(function (a) {
        const lotada = inscritosAtivos(a).length >= MAX_VAGAS;
        return "<tr>" +
            '<td data-label="Data / horário">' + formatarData(a.data) + " • " + a.inicio + "</td>" +
            '<td data-label="Professor">' + esc(a.professores.join(" / ")) + "</td>" +
            '<td data-label="Inscritos">' + celulaInscritos(a) + "</td>" +
            '<td class="centro"><button class="btn-mini' + (lotada ? " lotada" : "") + '" data-ver="' + a.id + '">' +
            (lotada ? "Lotada" : "Ver alunos") + "</button></td>" +
            "</tr>";
    }).join("");
}

function renderAulas() {
    const corpo = document.querySelector("#tabela-aulas");

    if (aulas.length === 0) {
        corpo.innerHTML = '<tr><td colspan="4" class="vazio">Nenhuma aula cadastrada.</td></tr>';
        return;
    }

    corpo.innerHTML = ordenadas(aulas).map(function (a) {
        const cancelada = a.status === "cancelada";
        return '<tr class="' + (cancelada ? "cancelada" : "") + '">' +
            '<td data-label="Data / horário">' + formatarData(a.data) + " • " + a.inicio + "</td>" +
            '<td data-label="Professor">' + esc(a.professores.join(" / ")) + "</td>" +
            '<td data-label="Inscritos">' + celulaInscritos(a) + "</td>" +
            '<td class="centro"><div class="acoes">' +
            (cancelada
                ? '<span class="etiqueta">Cancelada</span>'
                : '<button class="btn-mini perigo" data-cancelar="' + a.id + '">Cancelar</button>') +
            '<button class="btn-mini" data-ver="' + a.id + '">Visualizar</button>' +
            "</div></td></tr>";
    }).join("");
}

function renderTudo() {
    renderResumo();
    renderProximas();
    renderAulas();
    renderInscricoes();
    renderProfessores();
}


/* ---------- Telas (menu lateral) ---------- */

const TEXTOS = {
    "visao-geral": ["Gerenciamento de aulas", "Controle das sessões, inscrições e professores responsáveis."],
    "aulas": ["Todas as Aulas", "Cancele ou visualize as sessões, inscrições e professores responsáveis."],
    "inscricoes": ["Inscrições", "Acompanhe as inscrições dos leads."],
    "professores": ["Professores", "Gerencie as contas dos professores."]
};

let vistaAtual = "visao-geral";

function mostrarVista(nome) {
    vistaAtual = nome;
    document.querySelectorAll(".vista").forEach(function (v) { v.hidden = true; });
    document.querySelector("#vista-" + nome).hidden = false;

    // o botão do topo muda conforme a tela
    const botaoTopo = document.querySelector("#btn-nova-aula");
    botaoTopo.hidden = nome === "inscricoes";
    botaoTopo.textContent = nome === "professores" ? "+ Novo professor" : "+ Nova aula";

    document.querySelectorAll(".menu-item").forEach(function (item) {
        item.classList.toggle("ativo", item.dataset.vista === nome);
    });

    document.querySelector("#titulo-vista").textContent = TEXTOS[nome][0];
    document.querySelector("#subtitulo-vista").textContent = TEXTOS[nome][1];
}

document.querySelectorAll(".menu-item").forEach(function (item) {
    item.addEventListener("click", function () { mostrarVista(item.dataset.vista); });
});


/* ---------- Perfil (RN06 a RN08) ---------- */
/* Em produção o perfil vem do login. Aqui é só para testar. */

const seletorPerfil = document.querySelector("#perfil");

function aplicarPerfil() {
    const ehHost = seletorPerfil.value === "host";
    document.querySelectorAll("[data-host]").forEach(function (el) { el.hidden = !ehHost; });
    if (!ehHost && document.querySelector('.menu-item[data-vista="professores"]').classList.contains("ativo")) {
        mostrarVista("visao-geral");
    }
}

seletorPerfil.addEventListener("change", aplicarPerfil);


/* ---------- Nova aula ---------- */

const modalAula = document.querySelector("#modal-aula");
const formAula = document.querySelector("#form-aula");
const erroAula = document.querySelector("#erro-aula");

function preencherProfessores() {
    const opcoes = professores
        .filter(function (p) { return p.ativo; })
        .map(function (p) { return '<option value="' + esc(p.nome) + '">' + esc(p.nome) + "</option>"; })
        .join("");
    document.querySelector("#aula-prof1").innerHTML = opcoes;
    document.querySelector("#aula-prof2").innerHTML = '<option value="">Nenhum</option>' + opcoes;
}

function validarAula(nova) {
    if (nova.fim <= nova.inicio) return "O término deve ser depois do início.";
    if (new Date(nova.data + "T" + nova.inicio) <= new Date()) return "Escolha uma data e hora futuras.";

    // RN19 e RN21: de 1 a 2 professores, sem repetir
    if (nova.professores.length < 1) return "Escolha pelo menos um professor.";
    if (new Set(nova.professores).size !== nova.professores.length) return "Escolha dois professores diferentes.";

    const doDia = aulas.filter(function (a) { return a.data === nova.data && a.status === "agendada"; });

    // RN14: no máximo 2 aulas por dia
    if (doDia.length >= MAX_AULAS_DIA) return "Já existem 2 aulas agendadas neste dia.";

    // RN15 e RN24: sem sobreposição de horário (isso também evita professor em duas aulas ao mesmo tempo)
    const conflito = doDia.find(function (a) { return nova.inicio < a.fim && nova.fim > a.inicio; });
    if (conflito) return "O horário sobrepõe a aula das " + conflito.inicio + " às " + conflito.fim + ".";

    return "";
}

document.querySelector("#btn-nova-aula").addEventListener("click", function () {
    if (vistaAtual === "professores") {
        abrirProfessor(null);
        return;
    }
    preencherProfessores();
    formAula.reset();
    erroAula.textContent = "";
    modalAula.showModal();
});

document.querySelector("#cancelar-aula").addEventListener("click", function () { modalAula.close(); });

formAula.addEventListener("submit", function (evento) {
    evento.preventDefault();

    const profs = [document.querySelector("#aula-prof1").value, document.querySelector("#aula-prof2").value]
        .filter(Boolean);

    const nova = {
        id: Date.now(),
        data: document.querySelector("#aula-data").value,
        inicio: document.querySelector("#aula-inicio").value,
        fim: document.querySelector("#aula-fim").value,
        professores: profs,
        status: "agendada",
        inscritos: []
    };

    const erro = validarAula(nova);
    if (erro) {
        erroAula.textContent = erro;
        return;
    }

    aulas.push(nova);
    salvarAulas();
    renderTudo();
    modalAula.close();
    avisar("Aula criada com sucesso.");
});


/* ---------- Cancelar aula (RN16 e RN17) ---------- */

function cancelarAula(id) {
    const aula = aulas.find(function (a) { return a.id === id; });
    if (!aula || aula.status !== "agendada") return;

    if (!confirm("Cancelar a aula de " + formatarData(aula.data) + " às " + aula.inicio + "? Os inscritos serão avisados.")) return;

    aula.status = "cancelada";
    aula.inscritos.forEach(function (i) { i.status = "cancelada"; });
    salvarAulas();
    renderTudo();
    avisar("Aula cancelada. Inscritos notificados.");
}


/* ---------- Alunos da aula (RF27, RF28, RN13) ---------- */

const modalAlunos = document.querySelector("#modal-alunos");
let aulaAberta = null;

function renderAlunos() {
    const aula = aulas.find(function (a) { return a.id === aulaAberta; });
    if (!aula) return;

    document.querySelector("#alunos-titulo").textContent =
        "Aula de " + formatarData(aula.data) + " • " + aula.inicio + " (" + inscritosAtivos(aula).length + "/" + MAX_VAGAS + ")";

    const lista = document.querySelector("#alunos-lista");

    if (aula.inscritos.length === 0) {
        lista.innerHTML = '<li class="vazio">Ninguém se inscreveu ainda.</li>';
        return;
    }

    const podeMarcar = aulaIniciada(aula) && aula.status === "agendada";

    lista.innerHTML = aula.inscritos.map(function (i, indice) {
        const selo = i.presenca ? i.presenca : i.status;
        let acoes = "";

        if (i.status !== "cancelada" && !i.presenca) {
            if (podeMarcar) {
                acoes += '<button class="btn-mini" data-presenca="presente" data-indice="' + indice + '">Presente</button>' +
                         '<button class="btn-mini perigo" data-presenca="ausente" data-indice="' + indice + '">Ausente</button>';
            } else if (aula.status === "agendada") {
                acoes += '<button class="btn-mini perigo" data-cancelar-inscricao="' + indice + '">Cancelar inscrição</button>';
            }
        }

        return '<li><div class="info"><span>' + esc(i.nome) + '</span><span class="selo ' + selo + '">' + selo + "</span></div>" +
               '<div class="acoes-aluno">' + acoes + "</div></li>";
    }).join("");
}

function abrirAlunos(id) {
    aulaAberta = id;
    renderAlunos();
    modalAlunos.showModal();
}

document.querySelector("#fechar-alunos").addEventListener("click", function () { modalAlunos.close(); });

document.querySelector("#alunos-lista").addEventListener("click", function (evento) {
    const aula = aulas.find(function (a) { return a.id === aulaAberta; });
    const botao = evento.target.closest("button");
    if (!aula || !botao) return;

    if (botao.dataset.presenca) {
        aula.inscritos[botao.dataset.indice].presenca = botao.dataset.presenca;
    } else if (botao.dataset.cancelarInscricao !== undefined) {
        aula.inscritos[botao.dataset.cancelarInscricao].status = "cancelada";
    } else {
        return;
    }

    salvarAulas();
    renderAlunos();
    renderTudo();
});


/* ---------- Cliques nas tabelas ---------- */

document.addEventListener("click", function (evento) {
    const botao = evento.target.closest("button");
    if (!botao) return;

    if (botao.dataset.ver) abrirAlunos(Number(botao.dataset.ver));
    if (botao.dataset.cancelar) cancelarAula(Number(botao.dataset.cancelar));
});


/* ---------- Inscrições (RF27, RF28, RF34) ---------- */

function renderInscricoes() {
    const corpo = document.querySelector("#tabela-inscricoes");
    const busca = document.querySelector("#filtro-busca").value.trim().toLowerCase();
    const filtro = document.querySelector("#filtro-status").value;
    let html = "";

    ordenadas(aulas).forEach(function (a) {
        a.inscritos.forEach(function (i, indice) {
            const estado = i.presenca || i.status;
            if (filtro && estado !== filtro) return;
            if (busca && i.nome.toLowerCase().indexOf(busca) === -1) return;

            const dados = ' data-aula="' + a.id + '" data-indice="' + indice + '"';
            let acoes = '<span class="etiqueta">—</span>';

            if (a.status === "agendada" && i.status !== "cancelada" && !i.presenca) {
                acoes = aulaIniciada(a)
                    ? '<button class="btn-mini" data-acao="presente"' + dados + '>Presente</button>' +
                      '<button class="btn-mini perigo" data-acao="ausente"' + dados + '>Ausente</button>'
                    : '<button class="btn-mini perigo" data-acao="cancelar"' + dados + '>Cancelar inscrição</button>';
            }

            html += '<tr><td data-label="Aluno">' + esc(i.nome) + "</td>" +
                '<td data-label="Data / horário">' + formatarData(a.data) + " • " + a.inicio + "</td>" +
                '<td data-label="Professor">' + esc(a.professores.join(" / ")) + "</td>" +
                '<td data-label="Status"><span class="selo ' + estado + '">' + i.status + (i.presenca ? " · " + i.presenca : "") + "</span></td>" +
                '<td class="centro"><div class="acoes">' + acoes + "</div></td></tr>";
        });
    });

    corpo.innerHTML = html || '<tr><td colspan="5" class="vazio">Nenhuma inscrição encontrada.</td></tr>';
}

document.querySelector("#filtro-busca").addEventListener("input", renderInscricoes);
document.querySelector("#filtro-status").addEventListener("change", renderInscricoes);

document.querySelector("#tabela-inscricoes").addEventListener("click", function (evento) {
    const botao = evento.target.closest("button");
    if (!botao || !botao.dataset.acao) return;

    const aula = aulas.find(function (a) { return a.id === Number(botao.dataset.aula); });
    const inscricao = aula && aula.inscritos[botao.dataset.indice];
    if (!inscricao) return;

    if (botao.dataset.acao === "cancelar") {
        inscricao.status = "cancelada";
    } else {
        inscricao.presenca = botao.dataset.acao;   // presente ou ausente
    }

    salvarAulas();
    renderTudo();
});


/* ---------- Professores (RF10, RN03, RN04, RN08) ---------- */

/* ATENÇÃO: a senha NÃO é guardada aqui. No back-end ela deve ser
   enviada ao PHP e salva com hash (password_hash), conforme RNF05. */

function professoresIniciais() {
    return [
        { id: 1, nome: "Iago", email: "iago@ctfithouse.com.br", cpf: "52998224725", ativo: true },
        { id: 2, nome: "Matheus", email: "matheus@ctfithouse.com.br", cpf: "11144477735", ativo: true },
        { id: 3, nome: "Julio", email: "julio@ctfithouse.com.br", cpf: "12345678909", ativo: true }
    ];
}

function carregarProfessores() {
    try {
        const salvo = localStorage.getItem(CHAVE_PROF);
        if (salvo) return JSON.parse(salvo);
    } catch (erro) { /* usa os dados iniciais */ }
    return professoresIniciais();
}

function salvarProfessores() {
    try {
        localStorage.setItem(CHAVE_PROF, JSON.stringify(professores));
    } catch (erro) { /* segue só em memória */ }
}

function ehHost() {
    return seletorPerfil.value === "host";
}

function cpfValido(cpf) {
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

    for (let t = 9; t < 11; t++) {
        let soma = 0;
        for (let i = 0; i < t; i++) soma += Number(cpf[i]) * (t + 1 - i);
        if (((soma * 10) % 11) % 10 !== Number(cpf[t])) return false;
    }
    return true;
}

function formatarCpf(cpf) {
    return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

// RNF06: na tabela o CPF aparece parcialmente oculto
function cpfOculto(cpf) {
    return "•••." + cpf.slice(3, 6) + "." + cpf.slice(6, 9) + "-••";
}

function aulasFuturasDe(nome) {
    return aulas.filter(function (a) {
        return a.status === "agendada" && a.professores.indexOf(nome) !== -1 &&
            new Date(a.data + "T" + a.inicio) > new Date();
    }).length;
}

function renderProfessores() {
    const corpo = document.querySelector("#tabela-professores");

    corpo.innerHTML = professores.map(function (p) {
        return '<tr class="' + (p.ativo ? "" : "inativo") + '">' +
            '<td data-label="Nome">' + esc(p.nome) + "</td>" +
            '<td data-label="E-mail">' + esc(p.email) + "</td>" +
            '<td data-label="CPF">' + cpfOculto(p.cpf) + "</td>" +
            '<td data-label="Status"><span class="selo ' + (p.ativo ? "confirmada" : "cancelada") + '">' + (p.ativo ? "ativo" : "inativo") + "</span></td>" +
            '<td data-label="Aulas futuras">' + aulasFuturasDe(p.nome) + "</td>" +
            '<td class="centro"><div class="acoes">' +
            '<button class="btn-mini" data-prof-editar="' + p.id + '">Editar</button>' +
            '<button class="btn-mini ' + (p.ativo ? "perigo" : "") + '" data-prof-status="' + p.id + '">' +
            (p.ativo ? "Desativar" : "Reativar") + "</button>" +
            "</div></td></tr>";
    }).join("");
}

const modalProfessor = document.querySelector("#modal-professor");
const formProfessor = document.querySelector("#form-professor");
const erroProfessor = document.querySelector("#erro-professor");
const campoCpfProf = document.querySelector("#prof-cpf");
let profEditando = null;

function abrirProfessor(id) {
    if (!ehHost()) return;

    const prof = professores.find(function (p) { return p.id === id; });
    profEditando = prof ? prof.id : null;

    formProfessor.reset();
    erroProfessor.textContent = "";
    document.querySelector("#titulo-professor").textContent = prof ? "Editar professor" : "Novo professor";
    document.querySelector("#rotulo-senha").textContent = prof ? "Nova senha (deixe em branco para manter)" : "Senha";

    if (prof) {
        document.querySelector("#prof-nome").value = prof.nome;
        campoCpfProf.value = formatarCpf(prof.cpf);
        document.querySelector("#prof-email").value = prof.email;
    }

    campoCpfProf.readOnly = Boolean(prof);   // CPF não pode ser alterado (RN25)
    modalProfessor.showModal();
}

campoCpfProf.addEventListener("input", function () {
    const n = campoCpfProf.value.replace(/\D/g, "").slice(0, 11);
    campoCpfProf.value = n
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
});

document.querySelector("#cancelar-professor").addEventListener("click", function () { modalProfessor.close(); });

formProfessor.addEventListener("submit", function (evento) {
    evento.preventDefault();

    if (!ehHost()) {
        erroProfessor.textContent = "Somente o Host pode gerenciar professores.";
        return;
    }

    const nome = document.querySelector("#prof-nome").value.trim();
    const email = document.querySelector("#prof-email").value.trim().toLowerCase();
    const cpf = campoCpfProf.value.replace(/\D/g, "");
    const senha = document.querySelector("#prof-senha").value;
    const outros = professores.filter(function (p) { return p.id !== profEditando; });

    let erro = "";
    if (nome.length < 2) erro = "Informe o nome.";
    else if (outros.some(function (p) { return p.nome.toLowerCase() === nome.toLowerCase(); })) erro = "Já existe um professor com esse nome.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erro = "Informe um e-mail válido.";
    else if (outros.some(function (p) { return p.email === email; })) erro = "Esse e-mail já está cadastrado.";
    else if (!cpfValido(cpf)) erro = "CPF inválido.";
    else if (outros.some(function (p) { return p.cpf === cpf; })) erro = "Já existe um professor com esse CPF.";   // RN01
    else if ((profEditando === null || senha) && senha.length < 6) erro = "A senha deve ter pelo menos 6 caracteres.";

    if (erro) {
        erroProfessor.textContent = erro;
        return;
    }

    if (profEditando === null) {
        professores.push({ id: Date.now(), nome: nome, email: email, cpf: cpf, ativo: true });
        avisar("Professor cadastrado.");
    } else {
        const prof = professores.find(function (p) { return p.id === profEditando; });

        // as aulas guardam o nome do professor, então acompanham a troca de nome
        if (prof.nome !== nome) {
            aulas.forEach(function (a) {
                a.professores = a.professores.map(function (n) { return n === prof.nome ? nome : n; });
            });
            salvarAulas();
        }

        prof.nome = nome;
        prof.email = email;
        avisar("Professor atualizado.");
    }

    salvarProfessores();
    renderTudo();
    modalProfessor.close();
});

document.querySelector("#tabela-professores").addEventListener("click", function (evento) {
    const botao = evento.target.closest("button");
    if (!botao || !ehHost()) return;

    if (botao.dataset.profEditar) {
        abrirProfessor(Number(botao.dataset.profEditar));
        return;
    }

    if (botao.dataset.profStatus) {
        const prof = professores.find(function (p) { return p.id === Number(botao.dataset.profStatus); });
        if (!prof) return;

        if (prof.ativo) {
            const futuras = aulasFuturasDe(prof.nome);
            if (futuras > 0) {
                avisar(prof.nome + " tem " + futuras + " aula(s) futura(s). Cancele-as antes de desativar.");
                return;
            }
            if (!confirm("Desativar a conta de " + prof.nome + "?")) return;
        }

        prof.ativo = !prof.ativo;
        salvarProfessores();
        renderTudo();
        avisar(prof.ativo ? "Conta reativada." : "Conta desativada.");
    }
});


/* ---------- Início ---------- */

preencherProfessores();
aplicarPerfil();
renderTudo();