<?php

$host = 'sql100.infinityfree.com';
$banco = 'if0_43525823_ctfithouse';
$usuario = 'if0_43525823';
$senha = 'FxDQrRkMT1GU';

$pdo = new PDO(
    "mysql:host={$host};dbname={$banco};charset=utf8mb4",
    $usuario,
    $senha,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

