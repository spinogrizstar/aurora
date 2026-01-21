// ВНИМАНИЕ:
// Этот файл больше НЕ используется текущим UI.
// Основной интерфейс и логика находятся в frontend/index.html (внутри <script>).
// app.js оставлен как простой пример "как делать fetch на бэкенд".

async function calculate() {
    const cashboxes = Number(document.getElementById("cashboxes").value);
    const support = document.getElementById("support").checked;

    const response = await fetch("/calculate", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ cashboxes, support })
    });

    const data = await response.json();
    document.getElementById("result").textContent =
        data.package_name + "\n" + data.works.join("\n");
}
