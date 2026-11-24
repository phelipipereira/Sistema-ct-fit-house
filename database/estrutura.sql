CREATE TABLE usuario (
    cpf CHAR(11) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    data_nascimento DATE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    tipo ENUM('lead', 'professor', 'host') NOT NULL DEFAULT 'lead',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (cpf)
);

CREATE TABLE aula_experimental (
    id_aula INT AUTO_INCREMENT PRIMARY KEY,
    data_aula DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    status_aula ENUM('agendada', 'cancelada', 'realizada')
        NOT NULL DEFAULT 'agendada',
    CHECK (hora_fim > hora_inicio)
);

CREATE TABLE inscricao (
    id_inscricao INT AUTO_INCREMENT PRIMARY KEY,
    cpf_lead CHAR(11) NOT NULL,
    id_aula INT NOT NULL,
    data_inscricao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status_inscricao ENUM('agendada', 'confirmada', 'cancelada') NOT NULL DEFAULT 'agendada',
    comparecimento ENUM('presente', 'ausente') DEFAULT NULL,
    FOREIGN KEY (cpf_lead) REFERENCES usuario(cpf),
    FOREIGN KEY (id_aula) REFERENCES aula_experimental(id_aula)
);

CREATE TABLE atribuicao (
    id_aula INT NOT NULL,
    cpf_professor CHAR(11) NOT NULL,
    PRIMARY KEY (id_aula, cpf_professor),
    FOREIGN KEY (id_aula) REFERENCES aula_experimental(id_aula),
    FOREIGN KEY (cpf_professor) REFERENCES usuario(cpf)
);



CREATE TABLE notificacao (
    id_notificacao INT AUTO_INCREMENT PRIMARY KEY,
    id_inscricao INT NOT NULL,
    tipo ENUM('solicitacao_confirmacao', 'cancelamento_aula') NOT NULL,
    prevista_em DATETIME NOT NULL,
    enviada_em DATETIME DEFAULT NULL,
    status_envio ENUM('pendente', 'enviada', 'falhou')
        NOT NULL DEFAULT 'pendente',
    FOREIGN KEY (id_inscricao) REFERENCES inscricao(id_inscricao)
);