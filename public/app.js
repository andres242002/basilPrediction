document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos DOM
    const photoForm = document.getElementById('photo-form');
    const fileInputs = document.querySelectorAll('.file-input');
    const useCameraCheckbox = document.getElementById('use-camera');
    const submitBtn = document.getElementById('submit-btn');
    const loadingSpinner = document.getElementById('loading-spinner');
    const responseContainer = document.getElementById('response');
    
    // Configuración de la opción de cámara para dispositivos móviles
    useCameraCheckbox.addEventListener('change', function() {
        fileInputs.forEach(input => {
            if (this.checked) {
                input.setAttribute('capture', 'camera');
            } else {
                input.removeAttribute('capture');
            }
        });
    });
    
    // Detección de dispositivo móvil
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Mostrar opción de cámara solo en dispositivos móviles
    if (!isMobile) {
        document.querySelector('.capture-option').style.display = 'none';
        fileInputs.forEach(input => input.removeAttribute('capture'));
    }
    
    // Manejo de vista previa de imágenes
    fileInputs.forEach((input, index) => {
        const previewId = `preview-${index + 1}`;
        const fileInfoId = `file-info-${index + 1}`;
        const preview = document.getElementById(previewId);
        const fileInfo = document.getElementById(fileInfoId);
        
        input.addEventListener('change', function(e) {
            const file = this.files[0];
            if (file) {
                // Validar tamaño de archivo (máximo 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    alert('La imagen es demasiado grande. El tamaño máximo es 5MB.');
                    this.value = '';
                    return;
                }
                
                // Actualizar información del archivo
                const fileName = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
                const fileSize = (file.size / 1024).toFixed(1) + ' KB';
                fileInfo.textContent = `${fileName} (${fileSize})`;
                
                // Crear vista previa
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.innerHTML = `<img src="${e.target.result}" alt="Vista previa">`;
                };
                reader.readAsDataURL(file);
            } else {
                // Restablecer vista previa e información
                preview.innerHTML = `<i class="fas fa-camera"></i><span>Foto ${index + 1}</span>`;
                fileInfo.textContent = 'Sin archivo seleccionado';
            }
            
            // Comprobar si todos los campos están completos
            checkFormCompletion();
        });
    });
    
    // Función para comprobar si todos los campos están completos
    function checkFormCompletion() {
        let allFilesSelected = true;
        fileInputs.forEach(input => {
            if (!input.files[0]) {
                allFilesSelected = false;
            }
        });
        
        submitBtn.disabled = !allFilesSelected;
    }
    
    // Inicialización: deshabilitar botón hasta que se seleccionen todas las fotos
    checkFormCompletion();
    
    // Manejo del envío del formulario
    photoForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Mostrar spinner de carga
        submitBtn.querySelector('.button-text').style.opacity = '0';
        loadingSpinner.style.display = 'block';
        submitBtn.disabled = true;
        
        // Limpiar contenedor de respuesta anterior
        responseContainer.innerHTML = '';
        responseContainer.className = 'response-container active';
        
        // Resultados acumulados
        const results = [];
        
        try {
            // Procesar cada imagen por separado
            for (let i = 0; i < fileInputs.length; i++) {
                const fileInput = fileInputs[i];
                const file = fileInput.files[0];
                
                // Comprimir la imagen actual
                const compressedFile = await compressImage(file);
                
                // Crear FormData para esta imagen específica - EXACTAMENTE como en Python
                const formData = new FormData();
                formData.append("file", compressedFile, "imagen.jpg");
                
                // Mostrar que estamos procesando esta imagen específica
                responseContainer.innerHTML += `<p>Procesando imagen ${i + 1}...</p>`;
                
                // Diagnósticos para debugging
                console.log(`Enviando imagen ${i + 1}, tamaño: ${compressedFile.size} bytes`);
                
                // Enviar al servidor - MODIFICADO para coincidir con Python
                const response = await fetch('https://basilprediction.ddns.net/predict', {
                    method: 'POST',
                    // No establecemos headers, dejamos que se configuren automáticamente como en Python
                    // El boundary del multipart/form-data será establecido automáticamente
                    body: formData,
                    // Añadimos estas opciones para manejo de CORS
                    mode: 'cors',
                    credentials: 'same-origin'
                });
                
                if (!response.ok) {
                    throw new Error(`Error HTTP: ${response.status} - ${await response.text()}`);
                }
                
                // Procesar respuesta individual
                const result = await response.json();
                results.push(result);
                
                console.log("Respuesta recibida:", result);
                
                // Verificar que result.detections existe y tiene elementos
                if (result.detections && result.detections.length > 0) {
                    const detection = result.detections[0];
                    
                    // Verificar que detection tiene una propiedad label antes de usarla
                    if (detection && detection.label) {
                        console.log(detection.label);
                        const isHealthy = detection.label === "healthy";
                        const confidence = (detection.confidence * 100).toFixed(1);
                        
                        responseContainer.innerHTML += `
                            <div class="image-result ${isHealthy ? 'healthy' : 'unhealthy'}">
                                <h3>Imagen ${i + 1}: ${detection.label}</h3>
                                <p>Confianza: ${confidence}%</p>
                                ${result.image_base64 ? `<img src="data:image/jpeg;base64,${result.image_base64}" alt="Imagen analizada ${i+1}" class="result-image">` : ''}
                            </div>
                        `;
                    } else {
                        // Manejo para cuando detection no tiene label
                        responseContainer.innerHTML += `
                            <div class="image-result error">
                                <h3>Imagen ${i + 1}: Error en detección</h3>
                                <p>No se pudo determinar el estado de la planta.</p>
                                ${result.image_base64 ? `<img src="data:image/jpeg;base64,${result.image_base64}" alt="Imagen analizada ${i+1}" class="result-image">` : ''}
                            </div>
                        `;
                        console.error('Detección sin etiqueta:', detection);
                    }
                } else {
                    // Manejo para cuando no hay detecciones
                    responseContainer.innerHTML += `
                        <div class="image-result error">
                            <h3>Imagen ${i + 1}: Sin detecciones</h3>
                            <p>El sistema no pudo realizar una detección en esta imagen.</p>
                            ${result.image_base64 ? `<img src="data:image/jpeg;base64,${result.image_base64}" alt="Imagen analizada ${i+1}" class="result-image">` : ''}
                        </div>
                    `;
                    console.error('Respuesta sin detecciones:', result);
                }
            }
            
            // Solo analizar resultados si tenemos detecciones válidas
            if (results.length > 0 && results.every(result => result.detections && result.detections.length > 0)) {
                // Analizar resultados para obtener conclusión general
                const totalHealthy = results.filter(result => 
                    result.detections[0] && result.detections[0].label === "healthy"
                ).length;
                
                const isGenerallyHealthy = totalHealthy >= 2; // Si al menos 2 de 3 son saludables
                
                // Mostrar conclusión general
                responseContainer.innerHTML += `
                    <div class="conclusion ${isGenerallyHealthy ? 'response-success' : 'response-error'}">
                        <h3>Conclusión:</h3>
                        <p>El análisis indica que tu planta de albahaca está ${isGenerallyHealthy ? 'mayormente saludable' : 'posiblemente enferma'}.</p>
                        ${isGenerallyHealthy 
                            ? '<p><strong>Recomendaciones:</strong> Continúa con tu rutina actual de cuidados.</p>' 
                            : '<p><strong>Recomendaciones:</strong> Revisa el riego, la exposición solar y asegúrate de que no tenga plagas. Considera aplicar un tratamiento orgánico preventivo.</p>'
                        }
                    </div>
                `;
            } else {
                // Si no hay detecciones válidas, mostrar un mensaje genérico
                responseContainer.innerHTML += `
                    <div class="conclusion response-warning">
                        <h3>No se pudo completar el análisis</h3>
                        <p>No se obtuvieron suficientes datos para realizar un diagnóstico completo.</p>
                        <p>Por favor, intenta tomar fotos más claras de las hojas de tu planta y asegúrate de que la iluminación sea adecuada.</p>
                    </div>
                `;
            }
            
        } catch (error) {
            console.error('Error:', error);
            // Mostrar error con detalles
            responseContainer.className = 'response-container active response-error';
            responseContainer.innerHTML = `
                <p><strong>Error:</strong> No se pudieron procesar las fotos.</p>
                <p>Por favor, intenta de nuevo o verifica tu conexión a internet.</p>
                <p>Detalles técnicos: ${error.message}</p>
            `;
        } finally {
            // Ocultar spinner de carga
            submitBtn.querySelector('.button-text').style.opacity = '1';
            loadingSpinner.style.display = 'none';
            submitBtn.disabled = false;
            
            // Desplazar a la respuesta
            setTimeout(() => {
                responseContainer.scrollIntoView({ behavior: 'smooth' });
            }, 300); // Pequeño retraso para dar tiempo a que se expanda el contenedor
        }
    });
    
    // Función para comprimir imágenes
    async function compressImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = function(event) {
                const img = new Image();
                img.src = event.target.result;
                img.onload = function() {
                    // Calcular dimensiones manteniendo proporción
                    let width = img.width;
                    let height = img.height;
                    const maxSize = 1024; // Tamaño máximo
                    
                    if (width > height && width > maxSize) {
                        height = Math.round((height * maxSize) / width);
                        width = maxSize;
                    } else if (height > maxSize) {
                        width = Math.round((width * maxSize) / height);
                        height = maxSize;
                    }
                    
                    // Crear canvas para compresión
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Convertir a Blob con calidad reducida
                    canvas.toBlob(
                        (blob) => {
                            resolve(blob);
                        },
                        'image/jpeg',
                        0.8 // Calidad (0-1)
                    );
                };
            };
        });
    }
    
    // Añadir efecto para hacer los contenedores de subida de archivos clickeables
    document.querySelectorAll('.upload-box').forEach((box, index) => {
        box.addEventListener('click', function(e) {
            if (e.target !== fileInputs[index]) {
                fileInputs[index].click();
            }
        });
    });
    
    // Guardar estado en localStorage para recuperar al recargar
    window.addEventListener('beforeunload', saveFormState);
    window.addEventListener('load', loadFormState);
    
    function saveFormState() {
        const formState = {
            useCamera: useCameraCheckbox.checked
        };
        localStorage.setItem('albahacaFormState', JSON.stringify(formState));
    }
    
    function loadFormState() {
        const savedState = localStorage.getItem('albahacaFormState');
        if (savedState) {
            const formState = JSON.parse(savedState);
            useCameraCheckbox.checked = formState.useCamera;
            
            // Actualizar atributos según el estado cargado
            if (formState.useCamera && isMobile) {
                fileInputs.forEach(input => input.setAttribute('capture', 'camera'));
            } else {
                fileInputs.forEach(input => input.removeAttribute('capture'));
            }
        }
    }
});