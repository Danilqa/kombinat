export interface PromoApi {
  seek: (time: number) => Promise<void>;
}

declare global {
  interface Window {
    promo?: PromoApi;
  }
}
