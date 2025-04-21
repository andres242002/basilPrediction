document.getElementById('photo-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    const formData = new FormData();
    formData.append('photo1', document.getElementById('photo1').files[0]);
    formData.append('photo2', document.getElementById('photo2').files[0]);
    formData.append('photo3', document.getElementById('photo3').files[0]);

    try {
        const response = await fetch('http://localhost:3000/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        document.getElementById('response').innerHTML = `<p><strong>Resultado:</strong> ${result.message}</p>`;
    } catch (error) {
        document.getElementById('response').innerHTML = `<p>Error al procesar las fotos.</p>`;
    }
});