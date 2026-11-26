<?php

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$cpf = $_SESSION['cpf_lead'] ?? null;

if ($cpf === null) {
    http_response_code(401);
    echo json_encode(['erro' => 'Entre na sua conta para acessar o painel.']);
    exit;
}

try {
    require __DIR__ . '/../db.php';

    if (function_exists('conectarBanco')) {
        $pdo = conectarBanco();
    }

    $consulta = $pdo->prepare(
        "SELECT nome, email, data_nascimento, tipo, ativo
         FROM usuario
         WHERE cpf = :cpf AND tipo = 'lead' AND ativo = 1"
    );
    $consulta->execute(['cpf' => $cpf]);
    $usuario = $consulta->fetch(PDO::FETCH_ASSOC);

    if ($usuario === false) {
        http_response_code(403);
        echo json_encode(['erro' => 'Acesso indisponível para esta conta.']);
        exit;
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $acao = $_POST['acao'] ?? 'inscrever';
        if (!in_array($acao, ['inscrever', 'cancelar'], true)) {
            http_response_code(400);
            echo json_encode(['erro' => 'Ação inválida.']);
            exit;
        }
        if (($_SERVER['HTTP_X_PAINEL_LEAD'] ?? '') !== '1') {
            http_response_code(403);
            echo json_encode(['erro' => 'Solicitação inválida.']);
            exit;
        }

        $idAula = filter_input(INPUT_POST, 'id_aula', FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1],
        ]);

        if (!$idAula) {
            http_response_code(400);
            echo json_encode(['erro' => 'Selecione uma aula válida.']);
            exit;
        }

        $agora = (new DateTimeImmutable(
            'now',
            new DateTimeZone('America/Sao_Paulo')
        ))->format('Y-m-d H:i:s');

        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->beginTransaction();

        try {
            // Impede duas reservas simultâneas do mesmo lead.
            $consulta = $pdo->prepare(
                "SELECT cpf FROM usuario
                     WHERE cpf = ? AND tipo = 'lead' AND ativo = 1 FOR UPDATE"
            );
            $consulta->execute([$cpf]);

            if ($consulta->fetchColumn() === false) {
                throw new DomainException('Sua conta não pode realizar inscrições.');
            }

            // Mantém a última vaga protegida até o INSERT terminar.
            $consulta = $pdo->prepare(
                "SELECT id_aula FROM aula_experimental
                     WHERE id_aula = ? AND status_aula = 'agendada'
                       AND TIMESTAMP(data_aula, hora_inicio) > ?
                     FOR UPDATE"
            );
            $consulta->execute([$idAula, $agora]);

            if ($consulta->fetchColumn() === false) {
                throw new DomainException('Esta aula não está mais disponível.');
            }

            if ($acao === 'cancelar') {
                $consulta = $pdo->prepare(
                    "UPDATE inscricao SET status_inscricao = 'cancelada'
                     WHERE cpf_lead = ? AND id_aula = ?
                       AND status_inscricao IN ('agendada', 'confirmada')
                       AND comparecimento IS NULL"
                );
                $consulta->execute([$cpf, $idAula]);
                if ($consulta->rowCount() === 0) {
                    throw new DomainException('Nenhuma inscrição ativa encontrada para cancelar.');
                }
                $pdo->commit();
                echo json_encode(['ok' => true]);
                exit;
            }

            $consulta = $pdo->prepare(
                "SELECT 1
                     FROM inscricao i
                     JOIN aula_experimental a ON a.id_aula = i.id_aula
                     WHERE i.cpf_lead = ?
                       AND i.status_inscricao IN ('agendada', 'confirmada')
                       AND (
                           i.comparecimento = 'presente'
                           OR (
                               a.status_aula = 'agendada'
                               AND TIMESTAMP(a.data_aula, a.hora_inicio) > ?
                           )
                           OR (
                               i.status_inscricao = 'confirmada'
                               AND i.comparecimento = 'ausente'
                               AND DATE_ADD(TIMESTAMP(a.data_aula, a.hora_inicio), INTERVAL 7 DAY) > ?
                           )
                       )
                     LIMIT 1"
            );
            $consulta->execute([$cpf, $agora, $agora]);

            if ($consulta->fetchColumn() !== false) {
                throw new DomainException('Você já tem uma inscrição ativa ou ainda não pode agendar outra aula.');
            }

            $consulta = $pdo->prepare(
                "SELECT COUNT(*) FROM inscricao
                     WHERE id_aula = ?
                       AND status_inscricao IN ('agendada', 'confirmada')"
            );
            $consulta->execute([$idAula]);

            if ((int) $consulta->fetchColumn() >= 5) {
                throw new DomainException('Esta aula está lotada.');
            }

            $consulta = $pdo->prepare(
                "INSERT INTO inscricao (cpf_lead, id_aula, status_inscricao)
                     VALUES (?, ?, 'agendada')"
            );
            $consulta->execute([$cpf, $idAula]);

            $pdo->commit();
            http_response_code(201);
            echo json_encode(['ok' => true]);
        } catch (Throwable $erro) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            if ($erro instanceof DomainException) {
                http_response_code(409);
                echo json_encode(['erro' => $erro->getMessage()]);
            } else {
                http_response_code(500);
                echo json_encode(['erro' => 'Não foi possível salvar a inscrição.']);
            }
        }

        exit;
    }

    $usuario['cpf'] = '***.***.***-**';
    
    $agora = new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo'));

    $consultaHorarios = $pdo->prepare(
        "SELECT a.id_aula, a.data_aula, a.hora_inicio, a.hora_fim,
                COALESCE((
                    SELECT GROUP_CONCAT(u.nome ORDER BY u.nome SEPARATOR ' / ')
                    FROM atribuicao AS atb
                    JOIN usuario AS u ON u.cpf = atb.cpf_professor
                    WHERE atb.id_aula = a.id_aula
                ), 'A definir') AS professor,
                5 AS capacidade,
                5 - (
                    SELECT COUNT(*)
                    FROM inscricao AS i
                    WHERE i.id_aula = a.id_aula
                      AND i.status_inscricao IN ('agendada', 'confirmada')
                ) AS vagas_disponiveis
         FROM aula_experimental AS a
         WHERE a.status_aula = 'agendada'
           AND TIMESTAMP(a.data_aula, a.hora_inicio) > :agora
         HAVING vagas_disponiveis > 0
         ORDER BY a.data_aula, a.hora_inicio"
    );

    $consultaHorarios->execute(['agora' => $agora->format('Y-m-d H:i:s')]);
    $horarios = $consultaHorarios->fetchAll(PDO::FETCH_ASSOC);

    foreach ($horarios as &$aula) {
        $aula['capacidade'] = (int) $aula['capacidade'];
        $aula['vagas_disponiveis'] = (int) $aula['vagas_disponiveis'];
        $aula['local'] = 'CT Fit House';
    }
    unset($aula);

    $consultaInscricoes = $pdo->prepare(
        "SELECT i.id_inscricao, i.status_inscricao, a.id_aula, a.data_aula,
                a.hora_inicio, a.hora_fim, a.status_aula,
                TIMESTAMP(a.data_aula, a.hora_inicio) > ? AS futura,
                COALESCE((
                    SELECT GROUP_CONCAT(u.nome ORDER BY u.nome SEPARATOR ' / ')
                    FROM atribuicao atb
                    JOIN usuario u ON u.cpf = atb.cpf_professor
                    WHERE atb.id_aula = a.id_aula
                ), 'A definir') AS professor
         FROM inscricao i
         JOIN aula_experimental a ON a.id_aula = i.id_aula
         WHERE i.cpf_lead = ?
         ORDER BY i.id_inscricao DESC"
    );
    $consultaInscricoes->execute([$agora->format('Y-m-d H:i:s'), $cpf]);

    $inscricaoAtiva = null;
    $aulas = [];

    foreach ($consultaInscricoes->fetchAll(PDO::FETCH_ASSOC) as $inscricao) {
        $aula = [
            'id_aula' => (int) $inscricao['id_aula'],
            'data_aula' => $inscricao['data_aula'],
            'hora_inicio' => $inscricao['hora_inicio'],
            'hora_fim' => $inscricao['hora_fim'],
            'professor' => $inscricao['professor'],
            'local' => 'CT Fit House',
            'titulo' => 'Aula experimental',
            'status' => $inscricao['status_inscricao'],
        ];

        if ($inscricao['status_inscricao'] !== 'cancelada') {
            if ($inscricao['status_aula'] === 'cancelada') {
                $aula['status'] = 'cancelada';
            } elseif ($inscricao['status_aula'] === 'realizada') {
                $aula['status'] = 'realizada';
            }
        }

        if ($inscricaoAtiva === null && (int) $inscricao['futura'] === 1
            && $inscricao['status_aula'] === 'agendada'
            && in_array($inscricao['status_inscricao'], ['agendada', 'confirmada'], true)) {
            $inscricaoAtiva = ['aula' => $aula, 'status_inscricao' => $inscricao['status_inscricao']];
        }

        $aulas[] = $aula;
    }

    echo json_encode([
        'usuario' => $usuario,
        'horarios' => $horarios,
        'inscricaoAtiva' => $inscricaoAtiva,
        'aulas' => $aulas,
    ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $erro) {
    http_response_code(500);
    echo json_encode(['erro' => 'Não foi possível carregar os dados do painel.']);
}