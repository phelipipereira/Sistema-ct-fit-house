<?php

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
date_default_timezone_set('America/Sao_Paulo');

function responder(array $dados, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function executar(PDO $pdo, string $sql, array $dados = []): PDOStatement
{
    $consulta = $pdo->prepare($sql);
    $consulta->execute($dados);
    return $consulta;
}

function dataValida(string $data): bool
{
    $dataConvertida = DateTimeImmutable::createFromFormat('!Y-m-d', $data);
    return $dataConvertida && $dataConvertida->format('Y-m-d') === $data;
}

function cpfValido(string $cpf): bool
{
    if (!preg_match('/^[0-9]{11}$/D', $cpf) || preg_match('/^(.)\1+$/D', $cpf)) {
        return false;
    }
    for ($t = 9; $t <= 10; $t++) {
        $soma = 0;
        for ($i = 0; $i < $t; $i++) {
            $soma += (int) $cpf[$i] * ($t + 1 - $i);
        }
        if ((($soma * 10) % 11) % 10 !== (int) $cpf[$t]) {
            return false;
        }
    }
    return true;
}

$cpfSessao = $_SESSION['cpf_usuario'] ?? '';
if (!is_string($cpfSessao) || !preg_match('/^[0-9]{11}$/D', $cpfSessao)) {
    responder(['erro' => 'Entre com uma conta de Host ou professor.'], 401);
}

try {
    require __DIR__ . '/../db.php';
    if (function_exists('conectarBanco')) {
        $pdo = conectarBanco();
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $perfil = executar($pdo, 'SELECT tipo FROM usuario WHERE cpf = ? AND ativo = 1', [$cpfSessao])->fetchColumn();
    if (!in_array($perfil, ['host', 'professor'], true)) {
        responder(['erro' => 'Acesso restrito a Host e professor ativos.'], 403);
    }

    $filtro = $perfil === 'host' ? '' :
        ' WHERE EXISTS (SELECT 1 FROM atribuicao ap WHERE ap.id_aula = a.id_aula AND ap.cpf_professor = ?)';
    $parametros = $perfil === 'host' ? [] : [$cpfSessao];

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $_SESSION['csrf_adm'] = $_SESSION['csrf_adm'] ?? bin2hex(random_bytes(32));
        $aulas = [];
        foreach (executar($pdo, "SELECT a.id_aula, a.data_aula, a.hora_inicio, a.hora_fim, a.status_aula
                                FROM aula_experimental a" . $filtro, $parametros) as $linha) {
            $id = (int) $linha['id_aula'];
            $aulas[$id] = [
                'id' => $id, 'data' => $linha['data_aula'],
                'inicio' => substr($linha['hora_inicio'], 0, 5), 'fim' => substr($linha['hora_fim'], 0, 5),
                'status' => $linha['status_aula'], 'professores' => [], 'inscritos' => [],
            ];
        }
        foreach (executar($pdo, 'SELECT a.id_aula, u.nome FROM aula_experimental a
                                  JOIN atribuicao x ON x.id_aula = a.id_aula
                                  JOIN usuario u ON u.cpf = x.cpf_professor' . $filtro, $parametros) as $linha) {
            if (isset($aulas[$linha['id_aula']])) {
                $aulas[$linha['id_aula']]['professores'][] = $linha['nome'];
            }
        }
        foreach (executar($pdo, 'SELECT a.id_aula, i.id_inscricao, u.nome, i.status_inscricao, i.comparecimento
                                  FROM aula_experimental a JOIN inscricao i ON i.id_aula = a.id_aula
                                  JOIN usuario u ON u.cpf = i.cpf_lead' . $filtro . ' ORDER BY i.id_inscricao', $parametros) as $linha) {
            if (isset($aulas[$linha['id_aula']])) {
                $aulas[$linha['id_aula']]['inscritos'][] = [
                    'id' => (int) $linha['id_inscricao'], 'nome' => $linha['nome'],
                    'status' => $linha['status_inscricao'], 'presenca' => $linha['comparecimento'],
                ];
            }
        }
        $professores = [];
        if ($perfil === 'host') {
            foreach (executar($pdo, "SELECT cpf, nome, email, data_nascimento, ativo
                                     FROM usuario WHERE tipo = 'professor' ORDER BY nome") as $linha) {
                $professores[] = [
                    'id' => $linha['cpf'], 'cpf' => $linha['cpf'], 'nome' => $linha['nome'],
                    'email' => $linha['email'], 'nascimento' => $linha['data_nascimento'],
                    'ativo' => (bool) $linha['ativo'],
                ];
            }
        }
        responder(['aulas' => array_values($aulas), 'professores' => $professores, 'perfil' => $perfil, 'token' => $_SESSION['csrf_adm']]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        header('Allow: GET, POST');
        responder(['erro' => 'Método indisponível.'], 405);
    }
    $token = $_SESSION['csrf_adm'] ?? '';
    if ($token === '' || !hash_equals($token, $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
        responder(['erro' => 'Recarregue a página e tente novamente.'], 403);
    }

    $dados = json_decode(file_get_contents('php://input'), true);
    if (!is_array($dados)) {
        responder(['erro' => 'Dados inválidos.'], 400);
    }
    $acao = $dados['acao'] ?? '';
    if (!in_array($acao, ['criar_aula', 'cancelar_aula', 'inscricao', 'salvar_professor', 'status_professor'], true)) {
        responder(['erro' => 'Ação inválida.'], 400);
    }
    if ($perfil !== 'host' && in_array($acao, ['criar_aula', 'salvar_professor', 'status_professor'], true)) {
        responder(['erro' => 'Ação exclusiva do Host.'], 403);
    }
    $campo = static function (string $chave) use ($dados): string {
        return is_string($dados[$chave] ?? null) ? $dados[$chave] : '';
    };
    $agora = date('Y-m-d H:i:s');
    $pdo->beginTransaction();

    if ($acao === 'criar_aula') {
        $data = $campo('data');
        $inicio = $campo('inicio');
        $fim = $campo('fim');
        $profs = $dados['professores'] ?? null;
        if (!dataValida($data) || !preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/D', $inicio)
            || !preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/D', $fim)
            || $fim <= $inicio || "$data $inicio:00" <= $agora || !is_array($profs)
            || count($profs) < 1 || count($profs) > 2) {
            throw new DomainException('Confira a data, os horários e os professores.');
        }
        foreach ($profs as $cpf) {
            if (!is_string($cpf) || !preg_match('/^[0-9]{11}$/D', $cpf)) {
                throw new DomainException('Escolha professores válidos.');
            }
        }
        if (count(array_unique($profs)) !== count($profs)) {
            throw new DomainException('Escolha professores diferentes.');
        }

        // Serializa criações de aulas entre sessões administrativas.
        $lock = 'ctfh:agenda:' . substr(hash('sha256', (string) $pdo->query('SELECT DATABASE()')->fetchColumn()), 0, 32);
        if ((int) executar($pdo, 'SELECT GET_LOCK(?, 5)', [$lock])->fetchColumn() !== 1) {
            throw new DomainException('Agenda ocupada. Tente novamente.');
        }
        sort($profs);
        foreach ($profs as $cpf) {
            if (!executar($pdo, "SELECT cpf FROM usuario WHERE cpf = ? AND ativo = 1 AND tipo = 'professor' FOR UPDATE", [$cpf])->fetchColumn()) {
                throw new DomainException('Escolha professores ativos.');
            }
        }

        $agenda = executar($pdo, "SELECT hora_inicio, hora_fim FROM aula_experimental
                                   WHERE data_aula = ? AND status_aula <> 'cancelada' FOR UPDATE", [$data])->fetchAll(PDO::FETCH_ASSOC);
        if (count($agenda) >= 2) {
            throw new DomainException('Já existem duas aulas neste dia.');
        }
        foreach ($agenda as $aula) {
            if ("$inicio:00" < $aula['hora_fim'] && "$fim:00" > $aula['hora_inicio']) {
                throw new DomainException('O horário sobrepõe outra aula.');
            }
        }
        executar($pdo, 'INSERT INTO aula_experimental (data_aula, hora_inicio, hora_fim) VALUES (?, ?, ?)', [$data, $inicio, $fim]);
        $id = $pdo->lastInsertId();
        foreach ($profs as $cpf) {
            executar($pdo, 'INSERT INTO atribuicao (id_aula, cpf_professor) VALUES (?, ?)', [$id, $cpf]);
        }
    }

    if ($acao === 'cancelar_aula' || $acao === 'inscricao') {
        $id = filter_var($dados['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($id === false) {
            throw new DomainException('Registro inválido.');
        }
        $idAula = $acao === 'cancelar_aula' ? $id :
            executar($pdo, 'SELECT id_aula FROM inscricao WHERE id_inscricao = ?', [$id])->fetchColumn();
        $aula = executar($pdo, "SELECT * FROM aula_experimental WHERE id_aula = ? FOR UPDATE", [$idAula])->fetch(PDO::FETCH_ASSOC);
        if (!$aula || ($perfil === 'professor' && !executar($pdo,
            'SELECT 1 FROM atribuicao WHERE id_aula = ? AND cpf_professor = ?', [$idAula, $cpfSessao])->fetchColumn())) {
            throw new DomainException('Aula indisponível para esta conta.');
        }
        $futura = $aula['status_aula'] === 'agendada' && $aula['data_aula'] . ' ' . $aula['hora_inicio'] > $agora;
        if ($acao === 'cancelar_aula') {
            if (!$futura) {
                throw new DomainException('Só é possível cancelar uma aula futura agendada.');
            }
            executar($pdo, "INSERT INTO notificacao (id_inscricao, tipo, prevista_em)
                            SELECT id_inscricao, 'cancelamento_aula', ? FROM inscricao
                            WHERE id_aula = ? AND status_inscricao IN ('agendada', 'confirmada')", [$agora, $idAula]);
            executar($pdo, "UPDATE inscricao SET status_inscricao = 'cancelada'
                            WHERE id_aula = ? AND status_inscricao IN ('agendada', 'confirmada')", [$idAula]);
            executar($pdo, "UPDATE aula_experimental SET status_aula = 'cancelada' WHERE id_aula = ?", [$idAula]);
        } else {
            $valor = $campo('valor');
            $inscricao = executar($pdo, 'SELECT status_inscricao, comparecimento FROM inscricao WHERE id_inscricao = ? AND id_aula = ? FOR UPDATE',
                [$id, $idAula])->fetch(PDO::FETCH_ASSOC);
            if (!$inscricao || $inscricao['status_inscricao'] === 'cancelada' || $inscricao['comparecimento'] !== null) {
                throw new DomainException('Esta inscrição não está disponível para alteração.');
            }
            if ($valor === 'cancelar' && $futura) {
                executar($pdo, "UPDATE inscricao SET status_inscricao = 'cancelada' WHERE id_inscricao = ?", [$id]);
            } elseif (in_array($valor, ['presente', 'ausente'], true) && $aula['status_aula'] !== 'cancelada'
                && $aula['data_aula'] . ' ' . $aula['hora_fim'] <= $agora) {
                executar($pdo, 'UPDATE inscricao SET comparecimento = ? WHERE id_inscricao = ?', [$valor, $id]);
            } else {
                throw new DomainException('Esta ação não está disponível neste horário.');
            }
        }
    }

    if ($acao === 'salvar_professor' || $acao === 'status_professor') {
        $cpf = $campo('cpf');
        if (!cpfValido($cpf)) {
            throw new DomainException('CPF inválido.');
        }
        if ($acao === 'salvar_professor') {
            $nome = trim($campo('nome'));
            $email = trim($campo('email'));
            $nascimento = $campo('nascimento');
            $senhaDigitada = $campo('senha');
            $editar = ($dados['editar'] ?? false) === true;
            if (strlen($nome) < 2 || strlen($nome) > 100 || strlen($email) > 100 || !filter_var($email, FILTER_VALIDATE_EMAIL)
                || !dataValida($nascimento) || $nascimento > date('Y-m-d')) {
                throw new DomainException('Confira o nome, e-mail e data de nascimento.');
            }
            if ((!$editar || $senhaDigitada !== '') && (strlen($senhaDigitada) < 6 || strlen($senhaDigitada) > 72 || strpos($senhaDigitada, "\0") !== false)) {
                throw new DomainException('Use uma senha de 6 a 72 bytes.');
            }
            $hash = $senhaDigitada === '' ? null : password_hash($senhaDigitada, PASSWORD_DEFAULT);
            if ($editar) {
                if (!executar($pdo, "SELECT cpf FROM usuario WHERE cpf = ? AND tipo = 'professor' FOR UPDATE", [$cpf])->fetchColumn()) {
                    throw new DomainException('Professor não encontrado.');
                }
                executar($pdo, "UPDATE usuario SET nome = ?, email = ?, data_nascimento = ?, senha_hash = COALESCE(?, senha_hash)
                                WHERE cpf = ? AND tipo = 'professor'", [$nome, $email, $nascimento, $hash, $cpf]);
            } else {
                executar($pdo, "INSERT INTO usuario (cpf, nome, email, data_nascimento, senha_hash, tipo)
                                VALUES (?, ?, ?, ?, ?, 'professor')", [$cpf, $nome, $email, $nascimento, $hash]);
            }
        } else {
            if (!is_bool($dados['ativo'] ?? null) ||
                !executar($pdo, "SELECT cpf FROM usuario WHERE cpf = ? AND tipo = 'professor' FOR UPDATE", [$cpf])->fetchColumn()) {
                throw new DomainException('Professor não encontrado ou estado inválido.');
            }
            if (!$dados['ativo'] && executar($pdo, "SELECT 1 FROM atribuicao x JOIN aula_experimental a ON a.id_aula = x.id_aula
                                                    WHERE x.cpf_professor = ? AND a.status_aula = 'agendada'
                                                      AND TIMESTAMP(a.data_aula, a.hora_fim) > ? LIMIT 1", [$cpf, $agora])->fetchColumn()) {
                throw new DomainException('O professor ainda tem aula agendada.');
            }
            executar($pdo, "UPDATE usuario SET ativo = ? WHERE cpf = ? AND tipo = 'professor'", [(int) $dados['ativo'], $cpf]);
        }
    }

    $pdo->commit();
    if (isset($lock)) {
        executar($pdo, 'SELECT RELEASE_LOCK(?)', [$lock]);
    }
    responder(['ok' => true]);
} catch (Throwable $erro) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    if ($erro instanceof DomainException) {
        responder(['erro' => $erro->getMessage()], 422);
    }
    if ($erro instanceof PDOException && (int) ($erro->errorInfo[1] ?? 0) === 1062) {
        responder(['erro' => 'Já existe um registro com estes dados.'], 409);
    }
    responder(['erro' => 'Não foi possível concluir a operação. Confira a conexão e o esquema do banco.'], 500);
}
