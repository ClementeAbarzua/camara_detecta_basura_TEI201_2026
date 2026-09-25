# ♻️ Sistema IoT de Monitoreo Inteligente de Microbasurales

Sistema de monitoreo automatizado basado en IoT y Machine Learning, desarrollado para apoyar la detección temprana de acumulación de residuos y mejorar la gestión de microbasurales en la comuna de Peñalolén, Santiago de Chile.

El proyecto busca transformar una gestión principalmente reactiva en un modelo preventivo y basado en datos, mediante dispositivos de captura de imágenes instalados en puntos críticos y un sistema centralizado capaz de analizar el nivel de acumulación de residuos.

## 📌 Descripción del problema

La acumulación de basura en espacios públicos y la presencia de microbasurales representan un desafío para la gestión urbana de la comuna de Peñalolén.

Entre los principales factores identificados se encuentran:

- Generación excesiva de residuos.
- Aparición recurrente de microbasurales.
- Dificultad para identificar rápidamente puntos críticos.
- Limitaciones en la fiscalización.
- Insuficiencia de infraestructura para la valorización de residuos.
- Necesidad de optimizar los recursos destinados al retiro y gestión de basura.

El problema afecta principalmente a habitantes de Peñalolén, peatones, comerciantes, trabajadores municipales y personas que utilizan los espacios públicos para actividades deportivas y recreativas.

## 🎯 Objetivo general

Desarrollar un sistema IoT capaz de monitorear automáticamente puntos críticos de acumulación de residuos, utilizando cámaras de bajo costo y modelos de Machine Learning para generar información que permita apoyar la toma de decisiones y optimizar la respuesta de los servicios municipales.

## 💡 Propuesta de solución

La solución consiste en instalar dispositivos IoT equipados con cámaras en puntos donde históricamente se ha identificado acumulación de residuos.

Estos dispositivos capturan imágenes y las transmiten a un servidor centralizado. El procesamiento mediante Machine Learning permite identificar y cuantificar la acumulación de basura, generando métricas que pueden ser utilizadas para detectar tendencias y priorizar intervenciones.

### Flujo general

```
┌───────────────────┐
│  Punto crítico    │
│   de residuos     │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Cámara / IoT      │
│ Raspberry Pi      │
└─────────┬─────────┘
          │
          │ Imágenes
          ▼
┌───────────────────┐
│ Servidor          │
│ centralizado      │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Machine Learning  │
│ Análisis imágenes │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Métricas y        │
│ detección         │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Apoyo a la        │
│ gestión municipal │
└───────────────────┘
```

## ⚙️ Funcionamiento

El sistema contempla las siguientes etapas:

### 1. Captura

Una cámara instalada en un punto crítico obtiene imágenes periódicamente.

### 2. Transmisión

Las imágenes son enviadas desde el dispositivo IoT hacia un servidor centralizado.

### 3. Procesamiento

El servidor ejecuta modelos de Machine Learning encargados de analizar las imágenes.

### 4. Detección

El sistema identifica señales de acumulación de residuos y calcula métricas asociadas al nivel de basura presente.

### 5. Información

Los resultados pueden utilizarse para generar registros, visualizar tendencias y apoyar la planificación de los servicios de limpieza.


## 📊 Datos del problema

De acuerdo con antecedentes recopilados desde fuentes municipales y organismos relacionados con la gestión ambiental:

- La Municipalidad de Peñalolén informa la existencia de aproximadamente **45 microbasurales** en la comuna.
- Un estudio municipal registró aproximadamente **220 m³ de residuos diarios** presentes en microbasurales.
- Esto equivale aproximadamente a **6.600 m³ mensuales**, considerando una extrapolación de 30 días.
- La Municipalidad informa una inversión superior a **$5.124 millones** asociada a la gestión y retiro de residuos.
- Según antecedentes de gestión de residuos, se generan aproximadamente **91.797 toneladas de residuos al año**, de las cuales solo una fracción reducida es valorizada.

Estos antecedentes permiten dimensionar tanto la presencia del problema como los recursos involucrados en su gestión.

## 🌎 Objetivos de Desarrollo Sostenible

El proyecto se relaciona principalmente con dos Objetivos de Desarrollo Sostenible de las Naciones Unidas:

### ODS 11 — Ciudades y comunidades sostenibles

Busca promover ciudades inclusivas, seguras, resilientes y sostenibles.

El proyecto contribuye a este objetivo mediante el monitoreo de espacios públicos y el apoyo a una gestión urbana más eficiente.

### ODS 12 — Producción y consumo responsables

Se relaciona con la gestión adecuada de residuos y la necesidad de reducir y valorizar los desechos generados.

## 👥 Beneficiarios

**Municipalidad de Peñalolén**

Obtiene información sistematizada sobre los puntos críticos, permitiendo apoyar la planificación y priorización de los servicios de limpieza.

**Habitantes de la comuna**

Se busca contribuir a la recuperación y mantención de espacios públicos más limpios.

**Trabajadores municipales**

La información generada puede apoyar la planificación de rutas y priorización de puntos de intervención.

**Comunidad**

El sistema puede generar información útil para comprender los patrones de acumulación de residuos y promover una gestión más eficiente.

## 🔎 Actores involucrados

El proyecto considera la participación de distintos actores relacionados con la gestión de residuos:

- Municipalidad de Peñalolén.
- Equipos municipales de aseo.
- Ministerio del Medio Ambiente.
- Recicladores de base.
- Juntas de vecinos.
- Habitantes de la comuna.
- Comerciantes y usuarios de espacios públicos.

## 🚧 Consideraciones de implementación

Para implementar el sistema en un entorno real se deben considerar distintos factores:

**Privacidad**

Las cámaras estarán instaladas en espacios públicos, por lo que será necesario considerar medidas para evitar la identificación innecesaria de personas y cumplir con la normativa aplicable.

**Conectividad**

Los dispositivos necesitan una conexión estable para transmitir las imágenes hacia el servidor.

**Energía**

Se debe garantizar una fuente de alimentación adecuada para mantener los dispositivos operativos.

**Costos**

Se busca utilizar hardware de bajo costo que permita instalar y reemplazar dispositivos de manera sencilla.

**Mantenimiento**

Las cámaras y dispositivos IoT requieren mantenimiento periódico para asegurar su funcionamiento.

**Coordinación**

La implementación requiere coordinación con la municipalidad, equipos de aseo y comunidades de los sectores donde se instalen los dispositivos.

## 🚀 Escalabilidad

El proyecto está diseñado pensando en una implementación progresiva.

Inicialmente, se puede desarrollar un prototipo en uno o pocos puntos críticos. Una vez validado su funcionamiento, el sistema podría ampliarse para monitorear múltiples sectores de la comuna.

```
Prototipo
   │
   ▼
1 punto crítico
   │
   ▼
Validación
   │
   ▼
Varios puntos críticos
   │
   ▼
Monitoreo comunal
```

La arquitectura centralizada permite que el procesamiento de Machine Learning se realice en un servidor, manteniendo los dispositivos instalados en terreno relativamente simples y económicos.

## 📁 Estructura del proyecto

La estructura del repositorio puede organizarse de la siguiente manera:

```
├── frontend/          # Interfaz de visualización
├── backend/           # Servidor y lógica de procesamiento
├── model/             # Modelos de Machine Learning
├── iot/               # Código asociado a dispositivos IoT
├── data/              # Datos utilizados durante el desarrollo
├── docs/              # Documentación del proyecto
├── tests/             # Pruebas
├── .gitignore
└── README.md
```

La estructura puede modificarse a medida que avance el desarrollo del prototipo.

## 🛠️ Instalación

Clonar el repositorio:

```bash
git clone https://github.com/USUARIO/REPOSITORIO.git
```

Ingresar al proyecto:

```bash
cd REPOSITORIO
```

Instalar las dependencias correspondientes al módulo que se desea ejecutar.

Por ejemplo, si el backend utiliza Python:

```bash
pip install -r requirements.txt
```

## ▶️ Ejecución

La forma de ejecutar el proyecto dependerá de la arquitectura definitiva del sistema.

Una vez implementados los distintos módulos, se podrá iniciar:

```
Dispositivo IoT
      ↓
Servidor
      ↓
Modelo ML
      ↓
Dashboard / Métricas
```

Las instrucciones específicas de ejecución se documentarán a medida que cada componente sea integrado.

## 🔐 Privacidad y uso responsable

El sistema está diseñado para monitorear acumulación de residuos, no para realizar vigilancia de personas.

Por este motivo, la implementación deberá considerar:

- Minimización de datos personales.
- Evitar la identificación innecesaria de personas.
- Protección y almacenamiento seguro de las imágenes.
- Acceso restringido a los datos.
- Definición de períodos de conservación.
- Cumplimiento de la normativa chilena aplicable.

## 📚 Fuentes y antecedentes

Los antecedentes utilizados para definir la problemática provienen principalmente de organismos públicos y documentos relacionados con la gestión ambiental y territorial de Peñalolén.

- Municipalidad de Peñalolén — Gestión de residuos.
- Municipalidad de Peñalolén — Estudio de Contexto y Enfoque EAE.
- Municipalidad de Peñalolén — PLADECO 2026–2030.
- Ministerio del Medio Ambiente — Santiago Recicla.
- Ministerio del Medio Ambiente — Sistema de Certificación Ambiental Municipal.
- Instituto Nacional de Estadísticas — Censo 2024.

## 📌 Estado del proyecto

**Estado:** 🟡 En desarrollo

Actualmente el proyecto se encuentra en etapa de diseño y desarrollo del prototipo. Las funcionalidades, modelos de Machine Learning, arquitectura de comunicación y componentes de hardware podrán modificarse durante las etapas de implementación y validación.

## 👨‍💻 Proyecto

Proyecto académico orientado al desarrollo de una solución tecnológica para la gestión inteligente de residuos urbanos mediante IoT y Machine Learning.

**Área:** IoT · Machine Learning · Smart Cities · Gestión de residuos · Computer Vision

**Ubicación del problema:** Peñalolén, Santiago de Chile
