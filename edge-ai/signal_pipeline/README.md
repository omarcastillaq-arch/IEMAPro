# Horizon Medical - Edge AI ECG Signal Pipeline v2.0

## Resumen

Pipeline refactorizado para clasificación de arritmias cardíacas usando **señales ECG crudas 1D** en lugar del enfoque anterior basado en imágenes. Diseñado para inferencia en tiempo real en dispositivos edge (Raspberry Pi 4, Jetson Nano, nRF52840).

### Mejoras sobre v1.0 (basado en imágenes)

| Aspecto | v1.0 (Imágenes) | v2.0 (Señales 1D) |
|---|---|---|
| **Entrada** | Imágenes JPG 580×180 | Señales 1D crudas (2500 muestras) |
| **Clasificación** | Binaria (normal/anormal) | 5 clases AAMI (N, SVEB, VEB, F, Q) |
| **Tamaño modelo** | ~50 MB (Keras H5) | **31 KB** (TFLite INT8 cuantizado) |
| **Latencia** | ~500 ms | **< 1 ms** (edge optimizado) |
| **Preprocesamiento** | Redimensionar imagen | Filtrado digital + normalización |
| **Compatibilidad** | Solo servidor | Edge + servidor + TFLite Micro |

---

## Arquitectura

```
Señal ECG Cruda (ADS1298, 24-bit, 250 SPS)
    │
    ▼
┌──────────────────────────────────┐
│  Preprocesamiento (preprocessing.py)  │
│  1. Conversión ADC → mV          │
│  2. Filtro Butterworth 0.5-45 Hz │
│  3. Filtro notch 60 Hz            │
│  4. Remoción baseline wander     │
│  5. Normalización Z-score         │
│  6. Segmentación ventana fija    │
└──────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│  Modelo CNN-LSTM (model.py)       │
│  Conv1D → SepConv1D → BiLSTM    │
│  → Dense → Softmax (5 clases)    │
│  157K params (full) / 15K (lite) │
└──────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│  Cuantización (quantize.py)      │
│  TFLite INT8 / FP16 / Dynamic   │
│  Compresión 2-4x                  │
└──────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│  Inferencia Edge (edge_inference.py) │
│  Buffer circular streaming       │
│  Alertas en tiempo real          │
│  Latencia < 1 ms                 │
└──────────────────────────────────┘
```

---

## Estructura de Archivos

```
signal_pipeline/
├── __init__.py                 # Paquete principal
├── preprocessing.py            # Pipeline de preprocesamiento 1D
├── model.py                    # Arquitecturas CNN-LSTM y Lightweight
├── data_loader.py              # Carga datos MIT-BIH y sintéticos
├── evaluate.py                 # Métricas de evaluación completas
├── quantize.py                 # Cuantización TFLite / ONNX
├── README.md                   # Esta documentación
├── configs/
│   ├── __init__.py
│   └── config.py               # Configuración central
├── scripts/
│   ├── __init__.py
│   ├── train.py                # Script de entrenamiento
│   ├── export_model.py         # Exportación y cuantización
│   └── edge_inference.py       # Motor de inferencia edge
├── models/
│   ├── ecg_cnn_lstm_model.keras
│   ├── training_history.json
│   ├── evaluation_metrics.json
│   └── exported/
│       ├── ecg_model_quantized.tflite      # INT8 cuantizado
│       ├── ecg_model_quantized_fp16.tflite # FP16
│       ├── ecg_model_quantized_dynamic.tflite
│       └── quantization_report.json
└── data/
    └── mitbih/                 # Cache MIT-BIH (descarga automática)
```

---

## Guía Rápida

### Requisitos

```bash
pip install tensorflow numpy scipy scikit-learn wfdb
# Opcional para ONNX:
pip install tf2onnx onnx onnxruntime
# Para edge (solo TFLite runtime, ~5 MB vs ~500 MB TensorFlow):
pip install tflite-runtime
```

### 1. Entrenamiento

```bash
# Con datos sintéticos (prueba rápida)
python -m signal_pipeline.scripts.train --synthetic --epochs 20

# Con MIT-BIH Arrhythmia Database (descarga automática)
python -m signal_pipeline.scripts.train --mitbih --epochs 50

# Modelo lightweight para Cortex-M / nRF52840
python -m signal_pipeline.scripts.train --synthetic --lightweight --epochs 20
```

### 2. Exportación y Cuantización

```bash
# Exportar todos los formatos (INT8, FP16, Dynamic, ONNX)
python -m signal_pipeline.scripts.export_model --all

# Solo TFLite INT8 (más compacto)
python -m signal_pipeline.scripts.export_model --int8
```

### 3. Inferencia Edge

```bash
# Demo con datos sintéticos
python -m signal_pipeline.scripts.edge_inference \
    --model signal_pipeline/models/exported/ecg_model_quantized.tflite \
    --demo

# Streaming desde WebSocket (Horizon WSS)
python -m signal_pipeline.scripts.edge_inference \
    --model signal_pipeline/models/exported/ecg_model_quantized.tflite \
    --ws ws://localhost:3000 \
    --confidence-threshold 0.8
```

---

## Clases de Arritmia (AAMI)

| Clase | Nombre | Anotaciones MIT-BIH |
|-------|--------|----------------------|
| 0 | Normal (N) | N, L, R, e, j |
| 1 | Supraventricular (SVEB) | A, a, J, S |
| 2 | Ventricular (VEB) | V, E |
| 3 | Fusión (F) | F |
| 4 | Desconocido (Q) | /, f, Q |

---

## Preprocesamiento de Señales

### Pipeline completo

```python
from signal_pipeline.preprocessing import preprocess_and_segment

# Señal cruda del ADS1298 (24-bit ADC counts)
raw_signal = np.array([...])  # De BLE / MongoDB

# Preprocesar y segmentar para inferencia
segments = preprocess_and_segment(
    raw_signal,
    fs=250,              # Frecuencia de muestreo
    segment_len=2500,    # 10 segundos
    convert_adc=True,    # Convertir de ADC a mV
)
# segments.shape: (num_segments, 2500, 1)
```

### Etapas individuales

```python
from signal_pipeline.preprocessing import (
    adc_to_millivolts,    # 24-bit ADC → mV
    bandpass_filter,       # 0.5-45 Hz Butterworth
    notch_filter,          # 60 Hz notch
    remove_baseline_wander,# Mediana filter
    normalize,             # Z-score / min-max / robust
    segment_fixed_window,  # Ventana fija con overlap
    detect_rpeaks_simple,  # Detección R-peaks
    validate_signal,       # Control de calidad
)
```

---

## Modelos

### CNN-LSTM (modelo principal)

- **Entrada**: (2500, 1) - 10 segundos de ECG Lead II a 250 Hz
- **Arquitectura**: Conv1D → SeparableConv1D × 2 → BiLSTM × 2 → Dense → Softmax
- **Parámetros**: ~157K
- **Tamaño**: ~613 KB (float32), ~232 KB (TFLite cuantizado)
- **Uso**: Raspberry Pi 4, Jetson Nano, servidores

### Lightweight (para microcontroladores)

- **Entrada**: (2500, 1) - 10 segundos de ECG Lead II a 250 Hz
- **Arquitectura**: Conv1D × 3 → GlobalAveragePooling → Dense → Softmax
- **Parámetros**: ~15K
- **Tamaño**: ~61 KB (float32), **31 KB** (TFLite INT8)
- **Uso**: nRF52840 (Cortex-M4F), MCUs con TFLite Micro

---

## Integración con Horizon Medical

### Flujo de datos desde el Holter

```
IoT Holter (ADS1298 + nRF52832)
    │ BLE (LESC encrypted)
    ▼
ecg-broker (Ionic app)
    │ WebSocket / Socket.IO
    ▼
hrzmed_wss (Node.js server)
    │ MongoDB persistence
    │ WebSocket events
    ▼
Edge Inference Engine (Python)
    │ TFLite model
    ▼
Clasificación arritmia → Alerta médica
```

### Uso desde el servidor WebSocket

```python
import json
import asyncio
import websockets
from signal_pipeline.scripts.edge_inference import ECGEdgeInferenceEngine

engine = ECGEdgeInferenceEngine(
    model_path="signal_pipeline/models/exported/ecg_model_quantized.tflite"
)

async def process_ecg(websocket):
    async for message in websocket:
        data = json.loads(message)
        if data["type"] == "ecg_data":
            samples = np.array(data["samples"])
            result = engine.feed_samples(samples)
            if result and result["is_alert"]:
                await websocket.send(json.dumps({
                    "type": "arrhythmia_alert",
                    "class": result["class_name"],
                    "confidence": result["confidence"],
                }))
```

---

## Despliegue en Dispositivos Edge

### Raspberry Pi 4

```bash
# Instalar TFLite runtime (mucho más ligero que TensorFlow completo)
pip install tflite-runtime numpy scipy

# Copiar modelo y scripts
scp -r signal_pipeline/ pi@raspberrypi:~/ecg/

# Ejecutar inferencia
python -m signal_pipeline.scripts.edge_inference \
    --model signal_pipeline/models/exported/ecg_model_quantized.tflite \
    --ws ws://holter-server:3000
```

### Jetson Nano

```bash
# Aprovechar GPU con TFLite GPU delegate
pip install tensorflow numpy scipy

# Ejecutar con FP16 para GPU
python -m signal_pipeline.scripts.edge_inference \
    --model signal_pipeline/models/exported/ecg_model_quantized_fp16.tflite \
    --ws ws://holter-server:3000
```

### Docker (Kubernetes)

```dockerfile
FROM python:3.11-slim
RUN pip install --no-cache-dir tflite-runtime numpy scipy scikit-learn
COPY signal_pipeline/ /app/signal_pipeline/
WORKDIR /app
CMD ["python", "-m", "signal_pipeline.scripts.edge_inference", \
     "--model", "signal_pipeline/models/exported/ecg_model_quantized.tflite", \
     "--ws", "ws://websocket-server:3000"]
```

### nRF52840 (TFLite Micro)

Para despliegue en el MCU del Holter:
1. Exportar modelo lightweight INT8 (< 100 KB)
2. Convertir a C array: `xxd -i ecg_model_quantized.tflite > model_data.cc`
3. Integrar con TFLite Micro en firmware C++
4. Ver: https://www.tensorflow.org/lite/microcontrollers

---

## Métricas de Evaluación

El pipeline genera reportes automáticos con:

- **Accuracy** global
- **Precision, Recall, F1-Score** (por clase y macro)
- **ROC AUC** (por clase y macro)
- **Matriz de confusión**
- **Latencia de inferencia** (mean, median, P95, P99)

Ejemplo de reporte:

```
── Overall Metrics ──
  Accuracy:          0.9734
  Precision (macro): 0.9521
  Recall (macro):    0.9489
  F1 Score (macro):  0.9501
  ROC AUC (macro):   0.9912

── Inference Latency (single sample) ──
  Mean:   0.13 ms  (TFLite cuantizado)
  P95:    0.18 ms
```

*Nota: Las métricas anteriores son ilustrativas. Entrenar con MIT-BIH (~48 registros, ~110K beats) durante 50+ epochs con el modelo CNN-LSTM produce resultados cercanos al estado del arte.*

---

## Configuración

Todos los parámetros están centralizados en `configs/config.py`:

```python
# Señal
SAMPLING_RATE_HZ = 250
BANDPASS_LOW_HZ = 0.5
BANDPASS_HIGH_HZ = 45.0
NOTCH_FREQ_HZ = 60.0        # Cambiar a 50 para Europa

# Modelo
MODEL_INPUT_LENGTH = 2500    # 10 segundos @ 250 Hz
CNN_FILTERS = [32, 64, 128]
LSTM_UNITS = [64, 32]
DROPOUT_RATE = 0.3

# Entrenamiento
BATCH_SIZE = 64
EPOCHS = 50
LEARNING_RATE = 1e-3

# Edge
EDGE_MAX_MODEL_SIZE_KB = 500
EDGE_MAX_LATENCY_MS = 100
```

---

## Licencia

Parte del ecosistema Horizon Medical.
