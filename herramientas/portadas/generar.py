#!/usr/bin/env python3
"""Pide a Rezona Lab las ilustraciones de pedidos.json y las baja a ilustraciones/<juego>.png.

    REZONA_PROYECTO=<public_id> python3 herramientas/portadas/generar.py [morfi cripta ...]

Cada imagen gasta créditos (el 30/09/2026, unos 81 cada una). Hace falta la
sesión de Rezona (`npx rezona@latest login --no-browser`: se aprueba el link
que imprime; la clave queda en ~/.rezona/, nunca en el repo) y un proyecto:
el public_id de "Portadas JXSTUDIOS" sale de `rz.py call list_projects '{}'`.
No va escrito acá: con él se arman los links públicos de las imágenes.
"""
import json, os, pathlib, shutil, subprocess, sys, time

AQUI = pathlib.Path(__file__).resolve().parent
RZ = AQUI.parent / 'rezona' / 'rz.py'
PROYECTO = os.environ.get('REZONA_PROYECTO') or sys.exit('falta REZONA_PROYECTO (el public_id del proyecto en Rezona Lab)')


def llamar(herramienta, args):
    out = subprocess.run(['python3', str(RZ), 'call', herramienta, json.dumps(args)], capture_output=True, text=True, timeout=300).stdout
    return json.loads(out[out.index('{'):out.rindex('}') + 1])


def main():
    pedidos = json.loads((AQUI / 'pedidos.json').read_text(encoding='utf-8'))
    juegos = sys.argv[1:] or list(pedidos)
    tareas = {}
    for j in juegos:
        p = pedidos[j]
        r = llamar('submit_image_generation', {'project_id': PROYECTO, 'output_path': f'assets/portada-{j}.png', 'prompt': p['prompt'], 'size': p['size'], 'n': 1})
        tareas[r['task_id']] = (j, r['output_path'])        # el output_path que vale es el de la respuesta
        print('pedida', j, r['task_id'])
    pendientes = set(tareas)
    while pendientes:
        time.sleep(10)
        r = llamar('check_generation_tasks', {'task_ids': list(pendientes), 'project_id': PROYECTO})
        for i in r.get('items', []):
            if i['status'] in ('ready', 'failed'):
                pendientes.discard(i['task_id'])
                j, ruta = tareas[i['task_id']]
                if i['status'] == 'failed':
                    print('FALLÓ', j, i.get('error') or i.get('failure')); continue
                # fetch exige la carpeta .rezona/ donde escribe
                trabajo = AQUI / 'ilustraciones' / '.bajada'
                (trabajo / '.rezona').mkdir(parents=True, exist_ok=True)
                f = llamar('fetch_generated_asset', {'project_id': PROYECTO, 'output_path': ruta, 'dir': str(trabajo)})
                shutil.copy(f['absolute_path'], AQUI / 'ilustraciones' / f'{j}.png')
                print('lista', j)


if __name__ == '__main__':
    main()
