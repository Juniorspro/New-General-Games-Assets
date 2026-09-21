# Kernel de prueba. No hace nada util a proposito: solo late.
#
# Para que: hay que averiguar si `kaggle kernels logs` devuelve el log de un
# kernel que TODAVIA esta corriendo, o solo de uno terminado. De eso depende
# si se puede tener una interfaz grafica en Kaggle manejada desde afuera: si
# el log habla en vivo, el kernel puede imprimir la direccion de un tunel y
# nosotros leerla mientras sigue abierto. Si no habla, no hay forma de
# enterarse de esa direccion sin que una persona mire la pantalla.
import datetime, subprocess, sys, time

def ahora():
    return datetime.datetime.utcnow().isoformat(timespec="seconds")

print("ARRANCO", ahora(), flush=True)

# nvidia-smi NO existe si el kernel no consiguio GPU, y un subprocess.run
# sobre un binario ausente tira FileNotFoundError y se lleva el kernel entero
# al primer segundo. Ya paso: hay que preguntar antes.
import shutil, urllib.request
if shutil.which("nvidia-smi"):
    placa = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total",
                            "--format=csv,noheader"], capture_output=True, text=True)
    print("PLACA:", (placa.stdout or placa.stderr).strip(), flush=True)
else:
    print("PLACA: NINGUNA (no hay nvidia-smi: el kernel corrio sin GPU)", flush=True)

try:
    c = urllib.request.urlopen("https://pypi.org/pypi/kaggle/json", timeout=20).status
    print(f"INTERNET: si (HTTP {c})", flush=True)
except Exception as e:
    print(f"INTERNET: NO ({type(e).__name__})", flush=True)

# 20 latidos de 30 s = 10 minutos. Tiempo de sobra para preguntar desde afuera.
for i in range(20):
    print(f"LATIDO {i:02d} {ahora()}", flush=True)
    time.sleep(30)

print("TERMINE", ahora(), flush=True)
