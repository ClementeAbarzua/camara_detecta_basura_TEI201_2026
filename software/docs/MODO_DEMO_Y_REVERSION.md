# Modo de prueba y respaldo del metodo anterior

El propietario autorizo el 21 de noviembre de 2026 probar un sistema mas rapido para una demostracion de unos cuatro minutos, conservando una forma de volver atras.

## Respaldo exacto antes del cambio

- Repositorio: `santileonv/camara-basura`.
- Rama de respaldo: `respaldo/metodo-estable-antes-demo-5s`.
- Commit original: `8d7992c473f197e8dd9d068adfb95ba31b95bf1f`.
- Incluye el selector de fecha, intervalos y navegacion diaria de los graficos.
- No incluye `config.h` ni secretos de Railway: se conservan en el PC/placa y en las variables privadas.

| Parte | Metodo anterior | Prueba demo |
|---|---|---|
| Cadencia de la XIAO | Trabajo completo + pausa de 15000 ms por defecto | Objetivo de 5000 ms para trabajo + espera restante |
| Promedio | Ultimas 5 capturas | Ultimas 3 capturas |
| Minimo para evaluar | 3 capturas | 3 capturas |
| Confirmaciones seguidas | 3 | 2 |
| Primera confirmacion posible | Quinta foto | Cuarta foto |
| Umbral predeterminado | Basura >=80%, sin basura <=20% | Igual |
| Estado caducado | 90 s por defecto | Igual |
| Pagina y graficos en vivo | Consulta tras una espera de 15 s | Aviso SSE despues de guardar; consultas de respaldo cada 2 s |
| Resolucion/modelo/giro | JPEG 800x600, centro a 224x224, giro 180 grados | Igual |

La demo confirma por primera vez unos 15 s despues de la primera foto si las cuatro lecturas son claras y se sostiene el ciclo de 5 s. Tras un cambio claro suele necesitar cuatro fotos nuevas (aproximadamente 15-20 s desde el cambio). Internet y el procesamiento pueden aumentar esos tiempos. Si el trabajo tarda mas de 5 s, no se acumulan fotos ni se solapan envios: el siguiente ciclo empieza al terminar.

## Como probarlo

1. Integrar el PR en GitHub y dejar que Railway despliegue. El perfil predeterminado es `demo`; si existe `DETECTION_PROFILE=stable`, cambiarlo a `demo`.
2. Descargar el firmware actualizado completo, no solamente el `.ino`. Requiere `capture-schedule.h`, `certificados.h` y el `config.h` privado que ya usabas.
3. Conservar el `config.h` original (WiFi, URL, token y `CAPTURE_INTERVAL_MS=15000`). `DEMO_MODE=true` en el `.ino` selecciona el ciclo de 5000 ms sin cambiar tus credenciales.
4. Cargarlo en la XIAO con los mismos ajustes de placa que funcionaban. Abrir Serial a 115200: cada envio muestra tiempo HTTP, tiempo total del trabajo y espera restante.
5. En la pagina comprobar **Modo demo**, promedio de hasta 3 y confirmacion 2/2. La proxima captura tras cambiar de perfil reinicia el promedio, sin borrar el historial. Los registros anteriores conservan sus valores originales; el grafico muestra el numero real de confirmaciones sin imponerles el denominador nuevo.
6. Para la demo: caja vacia hasta confirmar, introducir un residuo, mantenerlo unos 20 s, retirarlo y esperar la nueva confirmacion. El tiempo real depende de la red y del modelo; comprobarlo antes de presentarlo.

## Volver a las reglas y cadencia anteriores conservando la pagina nueva

1. Railway, servicio web, Variables: `DETECTION_PROFILE=stable`. Aplicar y desplegar. Restaura promedio de 5 y 3 confirmaciones. El siguiente dato inicia su propia ventana, sin mezclar perfiles.
2. Firmware: poner `DEMO_MODE=false`; conservar `CAPTURE_INTERVAL_MS=15000` en `config.h` y volver a cargar en la placa. Restaura los 15 s de pausa despues de terminar el envio.
3. La pagina seguira recibiendo avisos rapidos, pero la decision y la captura usaran el metodo estable. Ningun paso borra mediciones.

## Volver a toda la implementacion exacta anterior

Usar el commit de respaldo indicado arriba como fuente para un nuevo PR de restauracion de `app` y `firmware`, revisarlo e integrarlo por el flujo habitual. Cargar tambien el firmware anterior en la placa. No borrar la base, no ejecutar la copia de Aiven y no hacer force-push. Esta restauracion incluye la consulta web anterior cada 15 s; conservar cualquier mejora posterior que se quiera mantener al preparar el PR.

No se han respaldado contrasenas, tokens ni archivos privados en este documento o en la rama de respaldo.
