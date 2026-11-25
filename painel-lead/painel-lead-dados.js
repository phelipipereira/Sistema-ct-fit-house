// Na integração, substitua os dados fictícios pelos dados de exibição retornados pelo PHP.
const dadosPainelLead = {
    usuario: {
        nome: "Maria Silva",
        cpf: "***.***.***-**",
        email: "maria.exemplo@email.com",
        data_nascimento: "2002-08-15",
        tipo: "lead",
        ativo: true
    },
    horarios: [
        {
            id_aula: 1,
            data_aula: "2026-11-25",
            hora_inicio: "08:00:00",
            hora_fim: "09:00:00",
            professor: "Iago",
            local: "CT Fit House",
            vagas_disponiveis: 3,
            capacidade: 5
        },
        {
            id_aula: 2,
            data_aula: "2026-11-26",
            hora_inicio: "17:00:00",
            hora_fim: "18:00:00",
            professor: "Matheus",
            local: "CT Fit House",
            vagas_disponiveis: 2,
            capacidade: 5
        },
        {
            id_aula: 3,
            data_aula: "2026-11-27",
            hora_inicio: "09:00:00",
            hora_fim: "10:00:00",
            professor: "Iago e Matheus",
            local: "CT Fit House",
            vagas_disponiveis: 5,
            capacidade: 5
        }
    ],
    inscricaoAtiva: null,
    aulas: [
        {
            id_aula: 10,
            titulo: "Treino funcional",
            data_aula: "2026-11-19",
            hora_inicio: "18:00:00",
            hora_fim: "19:00:00",
            professor: "Matheus",
            local: "CT Fit House",
            status: "realizada"
        },
        {
            id_aula: 11,
            titulo: "Aula de mobilidade",
            data_aula: "2026-11-17",
            hora_inicio: "08:00:00",
            hora_fim: "09:00:00",
            professor: "Iago",
            local: "CT Fit House",
            status: "realizada"
        }
    ]
};
