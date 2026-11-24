<?php

try {
    require __DIR__ . '/db.php';

    $aula = $pdo->query(
        'SELECT id_aula FROM aula_experimental WHERE id_aula = 1'
    )->fetchColumn();

    echo $aula !== false
        ? 'Conexão OK. Aula 1 encontrada.'
        : 'Conexão OK. Aula 1 não encontrada.';
} catch (PDOException $erro) {
    http_response_code(500);
    echo 'Não foi possível consultar o banco.';
}
