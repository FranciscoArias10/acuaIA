# AquaScan AI

Plataforma inteligente para el diagnóstico de patologías en camarón de cultivo mediante visión por computadora e inteligencia artificial.

AquaScan AI permite analizar imágenes estáticas o video en tiempo real desde la cámara del equipo para identificar condiciones como camarón sano, branquia negra, mancha blanca (WSSV) y coinfección.

## Descripción del proyecto

Este proyecto está pensado para apoyar la vigilancia sanitaria en acuicultura, facilitando una primera evaluación visual automatizada de la salud del camarón. La interfaz web permite:

- Activar la cámara del equipo o subir imágenes locales.
- Seleccionar diferentes modelos CNN y pesos disponibles.
- Enviar imágenes al backend para inferencia.
- Revisar la clase predicha, nivel de confianza y distribución de probabilidades.
- Consultar una guía visual con información sobre enfermedades relevantes.

## Funcionalidades principales

- Diagnóstico visual en modo foto y en tiempo real.
- Soporte para detección de cámara web del navegador.
- Carga de imágenes desde archivo local.
- Interfaz con selector de modelos y configuración de servidor.
- Visualización de resultados con métricas de confianza.
- Guía educativa sobre patologías del camarón.

## Tecnologías utilizadas

- HTML5
- CSS3
- JavaScript
- Bootstrap-like custom UI (estilos propios)
- API de cámara del navegador
- Modelos de redes neuronales convolucionales (CNN)

## Estructura del repositorio

```text
acuaIA/
├── index.html
├── static/
│   ├── app.js
│   └── style.css
└── README.md
```

## Cómo ejecutar el proyecto

### Opción 1: abrir directamente la aplicación

1. Clona este repositorio.
2. Abre el archivo `index.html` en tu navegador.

### Opción 2: servidor local

Desde la raíz del proyecto, puedes ejecutar:

```bash
python -m http.server 8000
```

Luego abre en el navegador:

```text
http://localhost:8000
```

## Uso

1. Selecciona el modelo CNN y el peso correspondiente.
2. Configura la URL del backend si es necesario.
3. Activa la cámara o sube una imagen.
4. Haz clic en "Analizar Imagen".
5. Revisa el diagnóstico y la confianza del modelo.

## Diagnósticos soportados

- Sano
- Branquia Negra (Black Gill)
- Mancha Blanca (WSSV)
- Coinfección (BG + WSSV)

## Notas

- La interfaz web está diseñada para trabajar con un backend de inferencia, ya sea local o remoto.
- El proyecto actual se enfoca en la experiencia de usuario y análisis visual, y puede extenderse con un servicio más robusto de IA en el futuro.
- Para un entorno de producción, se recomienda añadir validaciones de seguridad, manejo de errores y almacenamiento de resultados.

## Objetivo

Brindar una herramienta útil para monitoreo, diagnóstico preliminar y educación sobre enfermedades del camarón, apoyando la toma de decisiones en producción acuícola.

## Autor

Francisco Arias

## Estado

Proyecto en desarrollo activo, enfocado en una interfaz de diagnóstico basada en IA para acuicultura.
