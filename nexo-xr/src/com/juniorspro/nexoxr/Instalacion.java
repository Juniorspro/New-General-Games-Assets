package com.juniorspro.nexoxr;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

/**
 * Lo que contesta el instalador del teléfono: si hay que confirmar, abre la
 * confirmación; si terminó, se lo cuenta al {@link Actualizador}. Y cuando
 * Nexo se acaba de actualizar, lo vuelve a abrir (si el teléfono lo deja).
 */
public class Instalacion extends BroadcastReceiver {
    static final String ACCION = "com.juniorspro.nexoxr.INSTALACION";

    @Override
    public void onReceive(Context c, Intent i) {
        if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(i.getAction())) {
            try { c.startActivity(new Intent(c, Principal.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Throwable ignorada) { }
            return;
        }
        int status = i.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirmar = i.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirmar != null) {
                try { c.startActivity(confirmar.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return; }
                catch (Throwable e) { Actualizador.de(c).resultado(PackageInstaller.STATUS_FAILURE, "no se pudo pedir la confirmación: " + e.getMessage()); return; }
            }
        }
        Actualizador.de(c).resultado(status, i.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE));
    }
}
