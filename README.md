# 🫀 IEMAPro — Intelligent ECG Monitoring Application (Professional)

> Plataforma profesional de monitoreo electrocardiográfico en tiempo real basada en IoT, integrando firmware embebido, backend seguro, e inteligencia artificial Edge para dispositivos Holter EKG.

[![Firmware](https://img.shields.io/badge/MCU-nRF52832-blue)]()
[![AFE](https://img.shields.io/badge/AFE-ADS1298-green)]()
[![Backend](https://img.shields.io/badge/Backend-Node.js-brightgreen)]()
[![AI](https://img.shields.io/badge/AI-TensorFlow_Lite-orange)]()
[![Tests](https://img.shields.io/badge/Tests-40%2B_passing-success)]()

---

## 📑 Tabla de Contenidos

- [Visión General](#-visión-general)
- [Arquitectura](#-arquitectura)
- [Componentes](#-componentes)
- [Mejoras Implementadas](#-mejoras-implementadas)
- [Instalación](#-instalación)
- [Licencia](#-licencia)

---

## 🔭 Visión General

IEMAPro es el núcleo profesional del ecosistema Horizon Medical. Contiene los componentes de servidor, firmware embebido e inteligencia artificial necesarios para operar el sistema de monitoreo EKG de 12 derivaciones.

### Componentes Principales

| Directorio | Descripción | Tecnología |
|-----------|-------------|------------|
| `firmware/` | Firmware v2.0 para nRF52832 con ADS1298 | C/C++, nRF5 SDK |
| `firmware-legacy/` | Firmware original HRZ_IECG1A | C, nRF5 SDK 13.0 |
| `backend/` | Servidor WebSocket + REST API | Node.js, Socket.IO, Express |
| `edge-ai/` | Pipeline de clasificación ECG | Python, TensorFlow/Keras |
| `hardware/` | Diseño PCB LDL1A | KiCad |

---

## 🏗 Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    IEMAPro ARCHITECTURE                   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐     BLE LESC      ┌────────────────┐  │
│  │  FIRMWARE     │ ◄──────────────► │  BACKEND        │  │
│  │  nRF52832     │                  │  hrzmed_wss     │  │
│  │  + ADS1298    │                  │  - JWT Auth     │  │
│  │  + BLE LESC   │                  │  - REST API     │  │
│  │  + PowerMgmt  │                  │  - WebSocket    │  │
│  │  + LeadOff    │                  │  - MongoDB      │  │
│  │  + TxBuffer   │                  │  - Redis Cache  │  │
│  └──────────────┘                  │  - Monitoring   │  │
│                                     └────────┬───────┘  │
│                                              │           │
│                                     ┌────────▼───────┐  │
│                                     │  EDGE AI        │  │
│                                     │  CNN+LSTM 31KB  │  │
│                                     │  TFLite 0.13ms  │  │
│                                     └────────────────┘  │
│                                                           │
│  ┌──────────────┐                                        │
│  │  HARDWARE     │                                        │
│  │  PCB LDL1A    │                                        │
│  └──────────────┘                                        │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Mejoras Implementadas (Horizon Improvements)

### Fase 2: Seguridad Backend
- JWT authentication con rotación de tokens
- Validación de datos ECG médicos
- Rate limiting por IP/usuario
- Helmet.js + CORS configurado

### Fase 3: Refactorización Firmware
- Eliminación de código duplicado entre canales
- Módulos HZM_ independientes y reutilizables
- Configuración centralizada

### Fase 4: Documentación Técnica
- README completo con arquitectura del sistema
- Documentación de protocolo BLE
- Guías de configuración

### Fase 5: Encriptación BLE LESC
- Bluetooth LE Secure Connections
- Pairing con passkey display
- Bonding persistente con whitelist

### Fase 6: Persistencia MongoDB
- Compresión Delta-RLE para señales ECG
- Ratio de compresión ~60%
- Sesiones de grabación con metadatos

### Fase 7: Optimización IA
- Modelo CNN+LSTM de 31KB
- Cuantización TFLite (INT8, FP16, Dynamic)
- Latencia de inferencia: 0.13ms
- Pipeline 1D para señales temporales

### Fase 8: Tests de Integración
- 36+ tests end-to-end
- Cobertura de auth, validación, persistencia
- Tests de compresión y monitoreo

### Fase 9: CI/CD
- GitHub Actions para CI
- Pipeline de Docker build
- Linting y testing automatizado

### Fase 10: Sistema de Monitoreo
- Métricas de CPU, memoria, conexiones
- Alertas configurables
- Dashboard de monitoreo integrado

### Fase 12: Optimización Rendimiento
- Redis cache para sesiones activas
- Cluster manager para multi-core
- WebSocket optimizer con backpressure

### Fase 13: API REST Completa
- Swagger/OpenAPI documentation
- Exportación PDF, EDF, HL7 FHIR
- CRUD de usuarios médicos y pacientes
- Asignación de dispositivos

### Fase 14: Mejoras Firmware
- HZM_PowerManager (gestión energía avanzada)
- HZM_LeadOff (detección desconexión electrodos)
- HZM_BLE_TxBuffer (buffer circular optimizado)

---

## ⚙️ Instalación

### Backend
```bash
cd backend
cp .env.example .env
npm install
npm start
```

### Firmware
```bash
cd firmware
# Requiere ARM GCC toolchain y nRF5 SDK
cd armgcc && make
```

### Edge AI
```bash
cd edge-ai/signal_pipeline
pip install -r requirements.txt
python scripts/train.py
```

---

## 📄 Licencia

Proyecto propietario — Horizon Medical © 2026
