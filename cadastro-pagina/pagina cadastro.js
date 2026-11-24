
// animação menu header

const linksDoMenu = document.querySelectorAll(".menu-pricipal .nav-link");

linksDoMenu.forEach((link) => {
    link.addEventListener("click", () => {
        linksDoMenu.forEach((item) => item.classList.remove("active"));
        link.classList.add("active");
    });
});