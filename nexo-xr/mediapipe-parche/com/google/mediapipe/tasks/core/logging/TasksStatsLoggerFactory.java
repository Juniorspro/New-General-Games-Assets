package com.google.mediapipe.tasks.core.logging;

import android.content.Context;

/**
 * Reemplazo de la fábrica de MediaPipe: siempre el logger vacío que trae la
 * propia librería (TasksStatsDummyLogger). La original manda estadísticas de
 * uso a Google por "datatransport" (otra librería más); acá no se manda nada.
 * construir.sh saca la original (y las dos clases que la usan) del jar.
 */
public final class TasksStatsLoggerFactory {
    public TasksStatsLoggerFactory() {}

    public static TasksStatsLogger create(Context context, String taskNameStr, String taskRunningModeStr) {
        return TasksStatsDummyLogger.create(context, taskNameStr, taskRunningModeStr);
    }
}
