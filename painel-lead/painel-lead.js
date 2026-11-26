const elemento = (id) => document.getElementById(id);
const navegacao = document.querySelector(".painel-navegacao");
const abas = Array.from(navegacao.querySelectorAll('[role="tab"]'));
const tituloInscricoes = elemento("titulo-inscricoes");
const botaoAgendar = elemento("agendar-aula");
const modalConfirmar = elemento("modal-confirmar");
const modalSucesso = elemento("modal-sucesso");
const formularioPerfil = elemento("perfil-formulario");
const camposPerfil = formularioPerfil.elements;
const telaEstreita = window.matchMedia("(max-width: 700px)");

let dadosPainelLead;
let usuario;
let inscricaoAtiva = null;
let horariosVisiveis = false;
let horarioEscolhido = null;

const formatadoresData = {
    curta: new Intl.DateTimeFormat("pt-BR", {
        weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC"
    }),
    completa: new Intl.DateTimeFormat("pt-BR", {
        weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC"
    }),
    porExtenso: new Intl.DateTimeFormat("pt-BR", {
        weekday: "long", day: "numeric", month: "long", timeZone: "UTC"
    })
};

const rotulosStatus = {
    agendada: "Agendada",
    confirmada: "Confirmada",
    cancelada: "Cancelada",
    realizada: "Realizada"
};

function formatarData(data, formato = "completa") {
    const texto = formatadoresData[formato].format(new Date(`${data}T00:00:00Z`));
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function formatarHorario(aula, separador = " às ") {
    return aula.hora_inicio.slice(0, 5) + separador + aula.hora_fim.slice(0, 5);
}

function clonarCartao(modelo, campos) {
    const cartao = elemento(modelo).content.firstElementChild.cloneNode(true);
    for (const [campo, valor] of Object.entries(campos)) {
        cartao.querySelector(`[data-campo="${campo}"]`).textContent = valor;
    }
    return cartao;
}

function selecionarAba(abaSelecionada) {
    for (const aba of abas) {
        const selecionada = aba === abaSelecionada;
        aba.setAttribute("aria-selected", String(selecionada));
        aba.tabIndex = selecionada ? 0 : -1;
        elemento(aba.getAttribute("aria-controls")).hidden = !selecionada;
    }
    window.scrollTo(0, 0);
}

function atualizarOrientacao() {
    navegacao.setAttribute("aria-orientation", telaEstreita.matches ? "horizontal" : "vertical");
}

function renderizarInscricoes() {
    const ativa = Boolean(inscricaoAtiva);
    const primeiroNome = usuario.nome.trim().split(/\s+/)[0];

    tituloInscricoes.textContent = ativa ? "Minhas inscrições" : `Boas-vindas, ${primeiroNome}!`;
    elemento("subtitulo-inscricoes").textContent = ativa
        ? "Acompanhe sua aula experimental e consulte os detalhes da inscrição."
        : "Encontre sua aula experimental e comece sua jornada no Fit House.";

    elemento("sem-inscricao").hidden = ativa;
    elemento("com-inscricao").hidden = !ativa;
    botaoAgendar.hidden = ativa || horariosVisiveis;
    elemento("horarios-disponiveis").hidden = ativa || !horariosVisiveis;

    if (!ativa) {
        return;
    }

    const aula = inscricaoAtiva.aula;
    elemento("inscricao-status").textContent = rotulosStatus[inscricaoAtiva.status_inscricao];
    elemento("inscricao-data").textContent = formatarData(aula.data_aula);
    elemento("inscricao-horario").textContent = formatarHorario(aula);
    elemento("inscricao-professor").textContent = aula.professor;
    elemento("inscricao-local").textContent = aula.local;
}

function renderizarHorarios() {
    const cartoes = dadosPainelLead.horarios.map((aula) => {
        const data = formatarData(aula.data_aula, "curta");
        const vagas = aula.vagas_disponiveis;
        const cartao = clonarCartao("modelo-horario", {
            data,
            horario: formatarHorario(aula, " — "),
            professor: `Professor: ${aula.professor}`,
            vagas: vagas > 0 ? `${vagas} ${vagas === 1 ? "vaga disponível" : "vagas disponíveis"}` : "Sem vagas"
        });

        const botao = cartao.querySelector("button");
        botao.disabled = vagas <= 0;
        botao.setAttribute("aria-label", `Inscrever-se para ${data}, ${formatarHorario(aula)}`);
        botao.addEventListener("click", () => escolherHorario(aula));
        return cartao;
    });

    elemento("lista-horarios").replaceChildren(...cartoes);
    elemento("sem-horarios").hidden = cartoes.length > 0;
}

function renderizarAulas() {
    const aulaAtiva = inscricaoAtiva?.aula;
    const aulas = dadosPainelLead.aulas.filter((aula) => String(aula.id_aula) !== String(aulaAtiva?.id_aula));

    if (aulaAtiva) {
        aulas.unshift({ ...aulaAtiva, titulo: "Aula experimental", status: inscricaoAtiva.status_inscricao });
    }

    const cartoes = aulas.map((aula) => clonarCartao("modelo-aula", {
        titulo: aula.titulo,
        quando: `${formatarData(aula.data_aula)} · ${formatarHorario(aula)}`,
        professor: `Professor: ${aula.professor}`,
        local: aula.local,
        status: rotulosStatus[aula.status]
    }));

    elemento("lista-aulas").replaceChildren(...cartoes);
    elemento("sem-aulas").hidden = cartoes.length > 0;
}

function escolherHorario(aula) {
    if (inscricaoAtiva || aula.vagas_disponiveis <= 0 || modalConfirmar.open) {
        return;
    }

    horarioEscolhido = aula;
    elemento("confirmar-quando").textContent = `${formatarData(aula.data_aula, "porExtenso")} · ${formatarHorario(aula)}`;
    elemento("confirmar-professor").textContent = aula.professor;
    elemento("confirmar-vagas").textContent = `${aula.vagas_disponiveis} de ${aula.capacidade}`;
    modalConfirmar.showModal();
}



async function confirmarInscricao() {
    const aula = horarioEscolhido;
    if (inscricaoAtiva || !modalConfirmar.open || !aula || aula.vagas_disponiveis <= 0) {
        return;
    }
    
    if (!await alterarInscricao("inscrever", aula.id_aula, elemento("confirmar-inscricao"))) {
        return;
    }

    inscricaoAtiva = { aula, status_inscricao: "agendada" };
    horariosVisiveis = false;
    elemento("mensagem-inscricao").textContent = "";
    elemento("sucesso-quando").textContent = `${formatarData(aula.data_aula, "curta")} · ${formatarHorario(aula)}`;
    elemento("sucesso-professor").textContent = `Professor: ${aula.professor}`;
    elemento("sucesso-status").textContent = "Status: agendada";

    modalConfirmar.close();
    renderizarInscricoes();
    renderizarAulas();
    modalSucesso.showModal();
}

async function alterarInscricao(acao, idAula, botao) {
    if (botao.disabled) return false;
    botao.disabled = true;

    try {
        const resposta = await fetch("./painel-lead.php", {
            method: "POST",
            headers: { "X-Painel-Lead": "1" },
            body: new URLSearchParams({ acao, id_aula: String(idAula) })
        });

        const texto = await resposta.text();
        let dados;

        try {
            dados = JSON.parse(texto);
        } catch {
            alert(`O servidor respondeu HTTP ${resposta.status} sem JSON. Recarregue o painel antes de repetir.`);
            return false;
        }

        if (!resposta.ok || !dados.ok) {
            alert(dados.erro || `Não foi possível alterar a inscrição (HTTP ${resposta.status}).`);
            return false;
        }

        return true;
    } catch {
        alert("Falha de conexão. Recarregue o painel antes de repetir.");
        return false;
    } finally {
        botao.disabled = false;
    }
}

async function cancelarInscricao() {
    if (!inscricaoAtiva) {
        return;
    }

    if (!await alterarInscricao("cancelar", inscricaoAtiva.aula.id_aula, elemento("cancelar-inscricao"))) {
        return;
    }

    inscricaoAtiva = null;
    horariosVisiveis = false;
    renderizarInscricoes();
    await iniciarPainel();
    elemento("mensagem-inscricao").textContent = "Inscrição cancelada.";
    botaoAgendar.focus();
}

function renderizarPerfil() {
    const [primeiroNome, ...outrosNomes] = usuario.nome.trim().split(/\s+/);
    const inicialFinal = outrosNomes.at(-1)?.charAt(0) ?? "";
    const ativa = Number(usuario.ativo) === 1;

    elemento("perfil-iniciais").textContent = (primeiroNome.charAt(0) + inicialFinal).toLocaleUpperCase("pt-BR");
    elemento("perfil-nome").textContent = usuario.nome;
    elemento("perfil-tipo").textContent = usuario.tipo === "lead" ? "Lead • Aula experimental" : usuario.tipo;
    const status = elemento("perfil-status");
    status.textContent = ativa ? "Conta ativa" : "Conta inativa";
    status.toggleAttribute("data-inativo", !ativa);

    camposPerfil.nome.setCustomValidity("");
    camposPerfil.nome.value = usuario.nome;
    camposPerfil.email.value = usuario.email;
    camposPerfil.data_nascimento.value = usuario.data_nascimento;
    elemento("cpf").value = usuario.cpf ? "***.***.***-**" : "";
}

for (const aba of abas) {
    aba.addEventListener("click", () => selecionarAba(aba));
}

navegacao.addEventListener("keydown", (evento) => {
    const indice = abas.indexOf(evento.target);
    if (indice < 0) {
        return;
    }

    const proxima = telaEstreita.matches ? "ArrowRight" : "ArrowDown";
    const anterior = telaEstreita.matches ? "ArrowLeft" : "ArrowUp";
    let destino;

    if (evento.key === "Home") {
        destino = 0;
    } else if (evento.key === "End") {
        destino = abas.length - 1;
    } else if (evento.key === proxima) {
        destino = (indice + 1) % abas.length;
    } else if (evento.key === anterior) {
        destino = (indice + abas.length - 1) % abas.length;
    } else {
        return;
    }

    evento.preventDefault();
    selecionarAba(abas[destino]);
    abas[destino].focus();
});

telaEstreita.addEventListener("change", atualizarOrientacao);

botaoAgendar.addEventListener("click", () => {
    if (inscricaoAtiva) {
        return;
    }

    horariosVisiveis = true;
    elemento("mensagem-inscricao").textContent = "";
    renderizarInscricoes();
    elemento("titulo-horarios").focus();
});

elemento("voltar-horarios").addEventListener("click", () => modalConfirmar.close());
modalConfirmar.addEventListener("close", () => {
    horarioEscolhido = null;
});
elemento("confirmar-inscricao").addEventListener("click", confirmarInscricao);
elemento("ver-inscricao").addEventListener("click", () => modalSucesso.close());
modalSucesso.addEventListener("close", () => {
    selecionarAba(elemento("aba-inscricoes"));
    tituloInscricoes.focus();
});
elemento("cancelar-inscricao").addEventListener("click", cancelarInscricao);

camposPerfil.nome.addEventListener("input", () => camposPerfil.nome.setCustomValidity(""));
formularioPerfil.addEventListener("submit", (evento) => {
    evento.preventDefault();

    const nome = camposPerfil.nome.value.trim();
    if (!nome) {
        camposPerfil.nome.setCustomValidity("Informe o nome completo.");
        camposPerfil.nome.reportValidity();
        return;
    }

    usuario.nome = nome;
    usuario.email = camposPerfil.email.value;
    usuario.data_nascimento = camposPerfil.data_nascimento.value;
    renderizarPerfil();
    renderizarInscricoes();
    elemento("mensagem-perfil").textContent = "Alterações salvas no protótipo.";
});

elemento("descartar-perfil").addEventListener("click", () => {
    renderizarPerfil();
    elemento("mensagem-perfil").textContent = "Alterações descartadas.";
});

async function iniciarPainel() {
    atualizarOrientacao();

    try {
        const resposta = await fetch("./painel-lead.php");
        const dados = await resposta.json();

        if (!resposta.ok) {
            tituloInscricoes.textContent = dados.erro;
            return;
        }

        dadosPainelLead = dados;
        usuario = { ...dados.usuario };
        inscricaoAtiva = dados.inscricaoAtiva;

        renderizarHorarios();
        renderizarInscricoes();
        renderizarAulas();
        renderizarPerfil();
    } catch {
        tituloInscricoes.textContent = "Não foi possível carregar o painel.";
    }
}

iniciarPainel();
