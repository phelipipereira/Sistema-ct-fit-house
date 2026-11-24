<?php
    $nome = $_POST['nome']?? '';
    $email = $_POST['email']?? '';
    $cpf = $_POST['cpf']??'';
    $dia = $_POST['dia']??'';
    $mes = $_POST['mes']??'';
    $ano = $_POST['ano']??'';
    $senha = $_POST['senha']??'';
    $confirmacao_senha = $_POST['confirmacao_senha']??'';

    if($senha === '' || $senha !== $confirmacao_senha){
        exit(' O Cadastro não pode ser efetuado');
    }

    $senha_hash = password_hash($senha, PASSWORD_DEFAULT);

    if (!checkdate((int) $mes, (int) $dia, (int) $ano)) {
    exit('Informe uma data de nascimento válida.');
    }

    $data_nascimento = sprintf('%04d-%02d-%02d', $ano, $mes, $dia);

    try {
    require __DIR__ . '/../db.php';

    $cadastro = $pdo->prepare(
        "INSERT INTO usuario (cpf, nome, email, data_nascimento, senha_hash, tipo)
         VALUES (:cpf, :nome, :email, :data_nascimento, :senha_hash, 'lead')"
    );

    $cadastro->execute([
        'cpf' => $cpf,
        'nome' => $nome,
        'email' => $email,
        'data_nascimento' => $data_nascimento,
        'senha_hash' => $senha_hash,
    ]);

    } catch (PDOException $erro) {
        if ((int) ($erro->errorInfo[1] ?? 0) === 1062) {
            http_response_code(409);
            exit('Já existe um cadastro com os dados informados.');
        }

        http_response_code(500);
        exit('Não foi possível salvar o cadastro.');
    }

echo 'Cadastro realizado com sucesso!';
