
// animação do header
const header = document.querySelector(".header");
const hero = document.querySelector(".hero");

if (header && hero) {
    function atualizarHeader() {
        const fimDoHero = hero.getBoundingClientRect().bottom;
        header.classList.toggle("fundo-preto", fimDoHero <= 0);
    }

    atualizarHeader();
    window.addEventListener("scroll", atualizarHeader, { passive: true });
    window.addEventListener("resize", atualizarHeader);
}
