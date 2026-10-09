/* Lo que en el original iba a Java: anuncios, ventanas y llamadas JNI.
 *
 * No hay publicidad. Los videos con premio se dan por vistos enseguida: el juego recibe "cargado",
 * "mostrado", "completo" y "cerrado" como si el video hubiera terminado, así los premios (dron,
 * botiquín, arma gratis, doble recompensa) siguen andando. Los anuncios de pantalla completa nunca
 * están cargados y el banner no existe. */
#include "rec.h"
#include "juego.h"
#include <stdio.h>
#include <string.h>

#define X(i) (C.x[i])
#define W(i) ((u32)C.x[i])
#define RET(v) (C.x[0] = (u64)(v))
#define P(a) ((char *)G2H(a))

void juego_encolar(u64 fn, u64 arg);

enum { CB_LOAD, CB_SHOW, CB_COMPLETE, CB_CLOSE, CB_FAIL, CB_SKIP, NCB };
typedef struct {
  u64 obj, unidad;
  u64 cb[NCB];
} Anuncio;
static Anuncio anuncios[32];
static int nanuncios;

static Anuncio *anuncio(u64 obj) {
  for (int i = 0; i < nanuncios; i++)
    if (anuncios[i].obj == obj) return &anuncios[i];
  if (nanuncios == 32) return &anuncios[31];
  Anuncio *a = &anuncios[nanuncios++];
  memset(a, 0, sizeof *a);
  a->obj = obj;
  return a;
}
static void avisar(Anuncio *a, int cual) {
  if (a->cb[cual]) juego_encolar(a->cb[cual], a->unidad);
}

/* ---- videos con premio */
void H__ZN15RewardInterfaceC1EPc(void) {
  WR64(X(0), X(1));
  anuncio(X(0))->unidad = X(1);
}
void H__ZN15RewardInterface17setOnLoadCallbackEPFvPcE(void) { anuncio(X(0))->cb[CB_LOAD] = X(1); }
void H__ZN15RewardInterface17setOnShowCallbackEPFvPcE(void) { anuncio(X(0))->cb[CB_SHOW] = X(1); }
void H__ZN15RewardInterface21setOnCompleteCallbackEPFvPcE(void) { anuncio(X(0))->cb[CB_COMPLETE] = X(1); }
void H__ZN15RewardInterface18setOnCloseCallbackEPFvPcE(void) { anuncio(X(0))->cb[CB_CLOSE] = X(1); }
void H__ZN15RewardInterface17setOnFailCallbackEPFvPcE(void) { anuncio(X(0))->cb[CB_FAIL] = X(1); }
void H__ZN15RewardInterface17setOnSkipCallbackEPFvPcE(void) { anuncio(X(0))->cb[CB_SKIP] = X(1); }
void H__ZN15RewardInterface4loadEv(void) { avisar(anuncio(X(0)), CB_LOAD); }
void H__ZN15RewardInterface8isLoadedEv(void) { RET(1); }
void H__ZN15RewardInterface4showEv(void) {
  Anuncio *a = anuncio(X(0));
  aos_log("video con premio (%s): se da por visto", a->unidad ? P(a->unidad) : "?");
  avisar(a, CB_SHOW);
  avisar(a, CB_COMPLETE);
  avisar(a, CB_CLOSE);
}
void H__ZN16RewardController12callCallbackEPcS0_(void) {}

/* ---- pantalla completa: nunca cargada */
void H__ZN21InterstitialInterfaceC1EPc(void) {
  WR64(X(0), X(1));
  anuncio(X(0))->unidad = X(1);
}
void H__ZN21InterstitialInterface17setOnLoadCallbackEPFvPcE(void) { anuncio(X(0))->cb[CB_LOAD] = X(1); }
void H__ZN21InterstitialInterface17setOnShowCallbackEPFvPcE(void) { anuncio(X(0))->cb[CB_SHOW] = X(1); }
void H__ZN21InterstitialInterface18setOnCloseCallbackEPFvPcE(void) { anuncio(X(0))->cb[CB_CLOSE] = X(1); }
void H__ZN21InterstitialInterface17setOnFailCallbackEPFvPcE(void) { anuncio(X(0))->cb[CB_FAIL] = X(1); }
void H__ZN21InterstitialInterface4loadEv(void) {}
void H__ZN21InterstitialInterface8isLoadedEv(void) { RET(0); }
void H__ZN21InterstitialInterface4showEv(void) { avisar(anuncio(X(0)), CB_CLOSE); }
void H__ZN22InterstitialController12callCallbackEPcS0_(void) {}

/* ---- banner y lo demás de anuncios */
void H__ZN15BannerInterfaceC1EPc(void) { WR64(X(0), X(1)); }
void H__ZN15BannerInterface11setIntervalEi(void) {}
void H__ZN15BannerInterface12removeBannerEv(void) {}
void H__ZN15BannerInterface14hideBannerViewEv(void) {}
void H__ZN15BannerInterface14showBannerViewEv(void) {}
void H__ZN15BannerInterface17setOnFailCallbackEPFvPcE(void) {}
void H__ZN15BannerInterface17setOnLoadCallbackEPFvPcE(void) {}
void H__ZN15BannerInterface4loadEii(void) {}
void H__ZN15BannerInterface7onPauseEv(void) {}
void H__ZN15BannerInterface8onResumeEv(void) {}
void H__ZN15CommonInterface12setDebugModeEb(void) {}
void H__ZN15CommonInterface26reqAdTrackingAuthorizationEPFviE(void) {}
void H__ZN15CommonInterface28setAdvertiserTrackingEnabledEb(void) {}

/* ---- JNI: se anotan (para saber qué pedía el juego a Java) y no hacen nada */
static void jni(const char *que) {
  aos_log("JNI %s: %s.%s", que, aos_string_c(X(0)), aos_string_c(X(1)));
}
void H__ZN7cocos2d9JniHelper20callStaticVoidMethodIJEEEvRKSsS3_DpT_(void) { jni("void()"); }
void H__ZN7cocos2d9JniHelper20callStaticVoidMethodIJSsEEEvRKSsS3_DpT_(void) { jni("void(String)"); }
void H__ZN7cocos2d9JniHelper20callStaticVoidMethodIJSsbEEEvRKSsS3_DpT_(void) { jni("void(String,bool)"); }
void H__ZN7cocos2d9JniHelper20callStaticVoidMethodIJSsiEEEvRKSsS3_DpT_(void) { jni("void(String,int)"); }
void H__ZN7cocos2d9JniHelper20callStaticVoidMethodIJSslEEEvRKSsS3_DpT_(void) { jni("void(String,long)"); }
void H__ZN7cocos2d9JniHelper23callStaticBooleanMethodIJEEEbRKSsS3_DpT_(void) {
  jni("bool()");
  RET(0);
}

/* ---- ventana de kPopup con botones de cocos2d::ui (se arma aparte, ver popup en juego.c) */
void H__ZN6kPopup6createEPN7cocos2d6SpriteENS0_7Color4BE(void) {
  aos_log("kPopup::create");
  RET(0);
}
void H__ZN6kPopup11setCallbackERKSt8functionIFvPN7cocos2d3RefEEE(void) {}
void H__ZN7cocos2d2ui6Button6createERKSsS3_S3_NS0_6Widget14TextureResTypeE(void) {
  aos_log("ui::Button::create %s", aos_string_c(X(0)));
  RET(0);
}
void H__ZN7cocos2d2ui6Button12setTitleTextERKSs(void) {}
void H__ZN7cocos2d2ui6Button16setTitleFontSizeEf(void) {}
