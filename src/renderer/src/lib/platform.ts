/** Rodando dentro do app Android (Capacitor), sem o servidor do computador por trás. */
export const isNativeApp = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

/** Versão do programa (vem do package.json na hora do build). */
export const APP_VERSION: string = __APP_VERSION__;
