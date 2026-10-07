# Typetrees de los scripts (MonoBehaviour) con el generador de UnityPy, corregido para Unity 2018.2: el campo
# m_Enabled (bool de la cabecera) va alineado a 4 bytes y el generador no lo marca. Se valida que se lea todo.
import os
from UnityPy.helpers.TypeTreeGenerator import TypeTreeGenerator
from UnityPy.helpers.TypeTreeNode import TypeTreeNode

class Generador(TypeTreeGenerator):
    def get_nodes_up(self, assembly, fullname):
        key = (assembly, fullname)
        if key in self.cache: return self.cache[key]
        if not assembly.endswith('.dll'): assembly += '.dll'
        base = self.get_nodes(assembly, fullname)
        nodos = []
        for b in base:
            flag = b.m_MetaFlag
            if b.m_Level == 1 and b.m_Name == 'm_Enabled': flag |= 0x4000
            nodos.append(TypeTreeNode(b.m_Level, b.m_Type, b.m_Name, 0, 0, m_MetaFlag=flag))
        node = TypeTreeNode.from_list(nodos)
        self.cache[key] = node
        return node

def generador(data_dir, version):
    g = Generador(version); g.load_local_dll_folder(os.path.join(data_dir, 'Managed'))
    return g
