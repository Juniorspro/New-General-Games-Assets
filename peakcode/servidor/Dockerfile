# OmniRoute para un Space de Hugging Face (o cualquier host con Docker).
#
# Se parte de la imagen oficial en vez de instalar los 431 MB de npm a mano:
# 1180 MB ya armados, con Node y las 77 dependencias adentro.
FROM diegosouzapw/omniroute:latest

# Hugging Face Spaces sirve en el 7860. OmniRoute usa 20128 por defecto, asi
# que se lo mueve por entorno.
ENV PORT=7860
ENV OMNIROUTE_SERVER_HOST=0.0.0.0

# SEGURIDAD: en un servidor publico esto NO es opcional. Sin REQUIRE_API_KEY el
# plano de inferencia queda abierto a cualquiera que llegue a la URL, y lo
# gastan contra tus proveedores. El propio OmniRoute lo avisa al arrancar.
ENV REQUIRE_API_KEY=true

# Estos dos se ponen como *Secrets* del Space, NUNCA aca (este archivo va al
# repo publico). Se declaran para dejar constancia de que existen:
#   STORAGE_ENCRYPTION_KEY   -> una cadena larga al azar; cifra el storage
#   OMNIROUTE_ADMIN_PASSWORD -> la contraseña del panel, la que usa la app
# En el Space: Settings -> Variables and secrets -> New secret.

# Los datos (storage.sqlite con las keys emitidas) van a un directorio que en el
# free tier NO persiste entre rebuilds. Ver el README: es la limitacion grande.
ENV OMNIROUTE_DATA_DIR=/data

EXPOSE 7860
