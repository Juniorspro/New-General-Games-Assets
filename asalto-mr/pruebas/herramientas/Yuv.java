import com.juniorspro.asaltomr.Mano;

import java.io.FileOutputStream;
import java.nio.file.Files;
import java.nio.file.Paths;

/**
 * Para pruebas/manos-camara.py: lee los planos YUV (como los da la cámara de
 * Android: U y V intercalados, paso 2), los pasa por Mano.yuvARgb (el mismo
 * código que en el teléfono) y escribe la imagen RGB (PPM), normal y girada.
 *
 *   java Yuv <dir> <ancho> <alto>
 */
public class Yuv {
    public static void main(String[] a) throws Exception {
        String d = a[0];
        int iw = Integer.parseInt(a[1]), ih = Integer.parseInt(a[2]);
        byte[] y = Files.readAllBytes(Paths.get(d, "y.bin")), uv = Files.readAllBytes(Paths.get(d, "uv.bin"));
        byte[] u = uv, v = new byte[uv.length];
        System.arraycopy(uv, 1, v, 0, uv.length - 1);   // V empieza un byte después (como en Android)
        for (int g = 0; g < 2; g++) {
            int W = 320, H = 240;
            int[] px = new int[W * H];
            Mano.yuvARgb(y, iw, 1, u, v, iw, 2, iw, ih, W, H, g == 1, px);
            try (FileOutputStream o = new FileOutputStream(d + (g == 1 ? "/girada.ppm" : "/normal.ppm"))) {
                o.write(("P6\n" + W + " " + H + "\n255\n").getBytes());
                byte[] b = new byte[W * H * 3];
                for (int i = 0; i < W * H; i++) { b[i * 3] = (byte) (px[i] >> 16); b[i * 3 + 1] = (byte) (px[i] >> 8); b[i * 3 + 2] = (byte) px[i]; }
                o.write(b);
            }
        }
    }
}
