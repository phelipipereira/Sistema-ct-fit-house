<?php

session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    exit('Abra o formulário de login para entrar.');
}

$cpf = $_POST['cpf'] ?? '';
$senha = $_POST['senha'] ?? '';

if (!is_string($cpf) || !is_string($senha) || $senha === '') {
    http_response_code(400);
    exit('Preencha o CPF e a senha.');
}

$cpf = str_replace(['.', '-', ' '], '', $cpf);

if (!preg_match('/\A[0-9]{11}\z/', $cpf)) {
    http_response_code(400);
    exit('Informe um CPF com 11 dígitos.');
}

try {
    require __DIR__ . '/../db.php';

    $consulta = $pdo->prepare(
        "SELECT cpf, senha_hash
         FROM usuario
         WHERE cpf = :cpf AND tipo = 'lead' AND ativo = 1"
    );

    $consulta->execute(['cpf' => $cpf]);
    $usuario = $consulta->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $erro) {
    http_response_code(500);
    exit('Não foi possível entrar agora. Tente novamente.');
}

if ($usuario === false || !password_verify($senha, $usuario['senha_hash'])) {
    http_response_code(401);
    exit('CPF ou senha inválidos.');
}

session_regenerate_id(true);
$_SESSION['cpf_lead'] = $usuario['cpf'];

header('Location:/../painel-lead/painel-lead.html', true, 303);
exit;