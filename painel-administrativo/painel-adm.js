const MAX_VAGAS = 5;
const MAX_AULAS_DIA = 2;
let aulas = [];
let professores = [];
let perfil = "";
let token = "";
let ocupado = false;

async function api(acao, dados = {}) {
    const opcoes = acao ? {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
        body: JSON.stringify({ acao, ...dados })
    } : { cache: "no-store" };

    const resposta = await fetch("painel-adm.php", opcoes);
    const json = await resposta.json();
    if (!resposta.ok) throw new Error(json.erro || "Não foi possível acessar o painel.");
    return json;
}

async function carregarPainel() {
    const dados = await api();
    ({ aulas, professores, perfil, token } = dados);
    document.querySelector("#perfil-atual").textContent = perfil === "host" ? "Host" : "Professor";
    aplicarPerfil();
    renderTudo();
}

async function gravar(acao, dados, mensagem, erroCampo) {
    if (ocupado) return false;
    ocupado = true;

    try {
        await api(acao, dados);
        if (mensagem) avisar(mensagem);
        try {
            await carregarPainel();
        } catch {
            avisar("Alteração salva. Recarregue a página para ver os dados atualizados.");
        }
        return true;
    } catch (erro) {
        if (erroCampo) erroCampo.textContent = erro.message;
        else avisar(erro.message);
        return false;
    } finally {
        ocupado = false;
    }
}

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

    const botaoTopo = document.querySelector("#btn-nova-aula");
    botaoTopo.hidden = perfil !== "host" || nome === "inscricoes";
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

function aplicarPerfil() {
    const host = perfil === "host";
    document.querySelectorAll("[data-host]").forEach(function (el) { el.hidden = !host; });
    document.querySelector("#btn-nova-aula").hidden = !host || vistaAtual === "inscricoes";
    if (!host && vistaAtual === "professores") mostrarVista("visao-geral");
}

const modalAula = document.querySelector("#modal-aula");
const formAula = document.querySelector("#form-aula");
const erroAula = document.querySelector("#erro-aula");

function preencherProfessores() {
    const opcoes = professores
        .filter(function (p) { return p.ativo; })
        .map(function (p) { return '<option value="' + esc(p.cpf) + '">' + esc(p.nome) + "</option>"; })
        .join("");
    document.querySelector("#aula-prof1").innerHTML = opcoes;
    document.querySelector("#aula-prof2").innerHTML = '<option value="">Nenhum</option>' + opcoes;
}

function validarAula(nova) {
    if (nova.fim <= nova.inicio) return "O término deve ser depois do início.";
    if (new Date(nova.data + "T" + nova.inicio) <= new Date()) return "Escolha uma data e hora futuras.";
    if (nova.professores.length < 1) return "Escolha pelo menos um professor.";
    if (new Set(nova.professores).size !== nova.professores.length) return "Escolha dois professores diferentes.";

    const doDia = aulas.filter(function (a) { return a.data === nova.data && a.status === "agendada"; });
    if (doDia.length >= MAX_AULAS_DIA) return "Já existem 2 aulas agendadas neste dia.";

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

formAula.addEventListener("submit", async function (evento) {
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

    if (await gravar("criar_aula", nova, "Aula criada.", erroAula)) modalAula.close();
});

async function cancelarAula(id) {
    const aula = aulas.find(function (a) { return a.id === id; });
    if (!aula || aula.status !== "agendada") return;

    if (!confirm("Cancelar a aula de " + formatarData(aula.data) + " às " + aula.inicio + "? As inscrições também serão canceladas.")) return;

    await gravar("cancelar_aula", { id }, "Aula cancelada.");
}

const modalAlunos = document.querySelector("#modal-alunos");
let aulaAberta = null;

function renderAlunos() {
    const aula = aulas.find(function (a) { return a.id === aulaAberta; });
    if (!aula) return;

    document.querySelector("#alunos-titulo").textContent =
        "Aula de " + formatarData(aula.data) + " • " + aula.inicio + " (" + celulaInscritos(aula) + ")";

    const lista = document.querySelector("#alunos-lista");
    if (aula.inscritos.length === 0) {
        lista.innerHTML = '<li class="vazio">Ninguém se inscreveu ainda.</li>';
        return;
    }

    const podeMarcar = new Date(aula.data + "T" + aula.fim) <= new Date() &&
        ["agendada", "realizada"].includes(aula.status);

    lista.innerHTML = aula.inscritos.map(function (i, indice) {
        const selo = i.presenca || i.status;
        let acoes = "";

        if (i.status !== "cancelada" && !i.presenca) {
            if (podeMarcar) {
                acoes = '<button class="btn-mini" data-presenca="presente" data-indice="' + indice + '">Presente</button>' +
                    '<button class="btn-mini perigo" data-presenca="ausente" data-indice="' + indice + '">Ausente</button>';
            } else if (aula.status === "agendada" && !aulaIniciada(aula)) {
                acoes = '<button class="btn-mini perigo" data-cancelar-inscricao="' + indice + '">Cancelar inscrição</button>';
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

document.querySelector("#alunos-lista").addEventListener("click", async function (evento) {
    const aula = aulas.find(function (a) { return a.id === aulaAberta; });
    const botao = evento.target.closest("button");
    if (!aula || !botao) return;

    const indice = botao.dataset.indice ?? botao.dataset.cancelarInscricao;
    const inscricao = aula.inscritos[indice];
    if (!inscricao) return;

    if (await gravar("inscricao", { id: inscricao.id, valor: botao.dataset.presenca ?? "cancelar" })) {
        renderAlunos();
    }
});

document.addEventListener("click", function (evento) {
    const botao = evento.target.closest("button");
    if (!botao) return;

    if (botao.dataset.ver) abrirAlunos(Number(botao.dataset.ver));
    if (botao.dataset.cancelar) cancelarAula(Number(botao.dataset.cancelar));
});

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

            if (a.status !== "cancelada" && i.status !== "cancelada" && !i.presenca &&
                (!aulaIniciada(a) || new Date(a.data + "T" + a.fim) <= new Date())) {
                acoes = aulaIniciada(a)
                    ? '<button class="btn-mini" data-acao="presente"' + dados + '>Presente</button>' +
                      '<button class="btn-mini perigo" data-acao="ausente"' + dados + '>Ausente</button>'
                    : '<button class="btn-mini perigo" data-acao="cancelar"' + dados + '>Cancelar inscrição</button>';
            }

            html += '<tr><td data-label="Aluno">' + esc(i.nome) + "</td>" +
                '<td data-label="Data / horário">' + formatarData(a.data) + " • " + a.inicio + "</td>" +
                '<td data-label="Professor">' + esc(a.professores.join(" / ")) + "</td>" +
                '<td data-label="Status"><span class="selo ' + estado + '">' + i.status +
                (i.presenca ? " · " + i.presenca : "") + "</span></td>" +
                '<td class="centro"><div class="acoes">' + acoes + "</div></td></tr>";
        });
    });

    corpo.innerHTML = html || '<tr><td colspan="5" class="vazio">Nenhuma inscrição encontrada.</td></tr>';
}

document.querySelector("#filtro-busca").addEventListener("input", renderInscricoes);
document.querySelector("#filtro-status").addEventListener("change", renderInscricoes);

document.querySelector("#tabela-inscricoes").addEventListener("click", async function (evento) {
    const botao = evento.target.closest("button");
    if (!botao || !botao.dataset.acao) return;

    const aula = aulas.find(function (a) { return a.id === Number(botao.dataset.aula); });
    const inscricao = aula && aula.inscritos[botao.dataset.indice];
    if (!inscricao) return;

    await gravar("inscricao", { id: inscricao.id, valor: botao.dataset.acao });
});

function ehHost() {
    return perfil === "host";
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
            '<td data-label="Status"><span class="selo ' + (p.ativo ? "confirmada" : "cancelada") + '">' +
            (p.ativo ? "ativo" : "inativo") + "</span></td>" +
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
        document.querySelector("#prof-nascimento").value = prof.nascimento;
    }

    campoCpfProf.readOnly = Boolean(prof);
    modalProfessor.showModal();
}

campoCpfProf.addEventListener("input", function () {
    const numeros = campoCpfProf.value.replace(/\D/g, "").slice(0, 11);
    campoCpfProf.value = numeros
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
});

document.querySelector("#cancelar-professor").addEventListener("click", function () { modalProfessor.close(); });

formProfessor.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    if (!ehHost()) {
        erroProfessor.textContent = "Somente o Host pode gerenciar professores.";
        return;
    }

    const nome = document.querySelector("#prof-nome").value.trim();
    const email = document.querySelector("#prof-email").value.trim().toLowerCase();
    const cpf = campoCpfProf.value.replace(/\D/g, "");
    const senha = document.querySelector("#prof-senha").value;
    const nascimento = document.querySelector("#prof-nascimento").value;

    let erro = "";
    if (nome.length < 2) erro = "Informe o nome.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erro = "Informe um e-mail válido.";
    else if (!cpfValido(cpf)) erro = "CPF inválido.";
    else if ((profEditando === null || senha) && senha.length < 6) erro = "A senha deve ter pelo menos 6 caracteres.";

    if (erro) {
        erroProfessor.textContent = erro;
        return;
    }

    const dados = { cpf, nome, email, senha, nascimento, editar: profEditando !== null };
    if (await gravar("salvar_professor", dados, "Professor salvo.", erroProfessor)) modalProfessor.close();
});

document.querySelector("#tabela-professores").addEventListener("click", async function (evento) {
    const botao = evento.target.closest("button");
    if (!botao || !ehHost()) return;

    if (botao.dataset.profEditar) {
        abrirProfessor(botao.dataset.profEditar);
        return;
    }

    if (botao.dataset.profStatus) {
        const prof = professores.find(function (p) { return p.id === botao.dataset.profStatus; });
        if (!prof) return;

        if (prof.ativo) {
            const futuras = aulasFuturasDe(prof.nome);
            if (futuras > 0) {
                avisar(prof.nome + " tem " + futuras + " aula(s) futura(s). Cancele-as antes de desativar.");
                return;
            }
            if (!confirm("Desativar a conta de " + prof.nome + "?")) return;
        }

        await gravar("status_professor", { cpf: prof.cpf, ativo: !prof.ativo }, "Conta atualizada.");
    }
});

aplicarPerfil();
carregarPainel().catch(function (erro) {
    document.querySelector("#erro-painel").textContent = erro.message;
});