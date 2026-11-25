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

    $usuario['cpf'] = '***.***.***-**';

    echo json_encode([
        'usuario' => $usuario,
        'horarios' => [],
        'inscricaoAtiva' => null,
        'aulas' => [],
    ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (PDOException | JsonException $erro) {
    http_response_code(500);
    echo json_encode(['erro' => 'Não foi possível carregar os dados do painel.']);
}