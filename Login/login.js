
const campoCpf = document.querySelector("#cpf");

if (campoCpf) {

    campoCpf.addEventListener("input", function () {

        let numeros = campoCpf.value.replace(/\D/g, "").slice(0, 11);

        numeros = numeros
            .replace(/^(\d{3})(\d)/, "$1.$2")
            .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
            .replace(/\.(\d{3})(\d)/, ".$1-$2");

        campoCpf.value = numeros;

    });

}