<?php

session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    exit('Abra o formulário de login para entrar.');
}

$cpf = $_POST['cpf'] ?? '';
$senhaDigitada = $_POST['senha'] ?? '';

if (!is_string($cpf) || !is_string($senhaDigitada) || $senhaDigitada === '') {
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
        'SELECT cpf, senha_hash, tipo
         FROM usuario
         WHERE cpf = :cpf AND ativo = 1'
    );

    $consulta->execute(['cpf' => $cpf]);
    $usuario = $consulta->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $erro) {
    http_response_code(500);
    exit('Não foi possível entrar agora. Tente novamente.');
}

if ($usuario === false || !password_verify($senhaDigitada, $usuario['senha_hash'])) {
    http_response_code(401);
    exit('CPF ou senha inválidos.');
}

$tipo = $usuario['tipo'];

if ($tipo === 'lead') {
    $destino = '../painel-lead/painel-lead.html';
} elseif (in_array($tipo, ['host', 'professor'], true)) {
    $destino = '../painel-administrativo/painel-adm.html';
} else {
    http_response_code(403);
    exit('Perfil sem acesso ao painel.');
}

session_regenerate_id(true);
unset($_SESSION['cpf_lead'], $_SESSION['csrf_adm']);
$_SESSION['cpf_usuario'] = $usuario['cpf'];

if ($tipo === 'lead') {
    $_SESSION['cpf_lead'] = $usuario['cpf'];
}

header('Location: ' . $destino, true, 303);
exit;